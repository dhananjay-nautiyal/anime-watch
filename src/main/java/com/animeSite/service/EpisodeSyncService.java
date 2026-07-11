package com.animeSite.service;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.httpclient.TitleNormalizer;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanSingleResponse;
import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeProviderCache;
import com.animeSite.persist.Episode;
import com.animeSite.pipeline.*;
import com.animeSite.repo.AnimeProviderCacheRepository;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.EpisodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EpisodeSyncService {

    private static final Logger log = LoggerFactory.getLogger(EpisodeSyncService.class);

    private final List<StreamProvider> providers;
    private final ValidationService validationService;
    private final AnimeRepository animeRepository;
    private final EpisodeRepository episodeRepository;
    private final AnimeProviderCacheRepository cacheRepository;
    private final JikanApiClient jikanApiClient;
    private final ProviderHealthMonitor healthMonitor;
    private final ReleaseDetector releaseDetector;

    private static final List<String> DEFAULT_PRIORITY = List.of("Anineko", "GoGoAnime");
    private static final int MAX_EPISODE_COUNT_TOLERANCE_PERCENT = 30;

    public EpisodeSyncService(List<StreamProvider> providers,
                               ValidationService validationService,
                               AnimeRepository animeRepository,
                               EpisodeRepository episodeRepository,
                               AnimeProviderCacheRepository cacheRepository,
                               JikanApiClient jikanApiClient,
                               ProviderHealthMonitor healthMonitor,
                               ReleaseDetector releaseDetector) {
        this.providers = providers;
        this.validationService = validationService;
        this.animeRepository = animeRepository;
        this.episodeRepository = episodeRepository;
        this.cacheRepository = cacheRepository;
        this.jikanApiClient = jikanApiClient;
        this.healthMonitor = healthMonitor;
        this.releaseDetector = releaseDetector;
    }

    @Transactional
    public SyncResult syncEpisodes(int malId) {
        long start = System.currentTimeMillis();
        log.info("[SYNC_SERVICE] START | malId={}", malId);

        try {
            Optional<Anime> animeOpt = animeRepository.findByMalId(malId);
            if (animeOpt.isEmpty()) {
                log.warn("[SYNC_SERVICE] ANIME_NOT_FOUND | malId={}", malId);
                return SyncResult.unavailable("ANIME_NOT_FOUND", "No anime found with MAL ID: " + malId, System.currentTimeMillis() - start);
            }
            Anime anime = animeOpt.get();

            try {
                if (releaseDetector.shouldSkipProviderLookup(malId)) {
                    log.info("[SYNC_SERVICE] COMING_SOON | malId={} title='{}'", malId, anime.getTitle());
                    return SyncResult.comingSoon(anime, System.currentTimeMillis() - start);
                }
            } catch (Exception e) {
                log.warn("[SYNC_SERVICE] RELEASE_CHECK_FAILED | malId={} error='{}'", malId, e.getMessage());
            }

            // Fetch Jikan data once for identity verification
            JikanAnimeData jikanData = fetchJikanDataSafe(malId);
            List<String> altTitles = collectAltTitles(jikanData, anime.getTitle());

            // Build provider priority: last-successful first, then default order
            List<String> providerOrder = buildProviderOrder(malId);

            List<ProviderAttempt> failures = new ArrayList<>();

            for (String providerName : providerOrder) {
                // Try primary title first
                ProviderAttempt attempt = tryProvider(malId, anime.getTitle(), providerName);
                log.info("[SYNC_SERVICE] PROVIDER_ATTEMPT | malId={} provider={} success={} episodes={} duration={}ms error='{}'",
                    malId, providerName, attempt.success(),
                    attempt.episodes() != null ? attempt.episodes().size() : 0,
                    attempt.durationMs(),
                    attempt.error() != null ? attempt.error() : "");

                if (attempt.success() && attempt.episodes() != null && !attempt.episodes().isEmpty()) {
                    List<Episode> valid = safeValidateEpisodes(attempt.episodes(), "sync/" + malId + "/" + providerName);
                    if (valid != null && !valid.isEmpty()) {
                        // Verify identity: reject if episodes belong to a different anime
                        if (jikanData != null && !verifyAnimeIdentity(malId, providerName, valid, jikanData, anime.getTitle(), altTitles)) {
                            log.warn("[SYNC_SERVICE] IDENTITY_REJECTED | malId={} provider={} count={} — episodes don't match requested anime",
                                malId, providerName, valid.size());
                            failures.add(new ProviderAttempt(providerName, false, null, attempt.durationMs(),
                                "Episodes do not match requested anime", "IDENTITY_MISMATCH"));
                            continue;
                        }
                        SyncResult saved = saveEpisodes(malId, valid, providerName, jikanData);
                        long elapsed = System.currentTimeMillis() - start;
                        log.info("[SYNC_SERVICE] SUCCESS | malId={} provider={} saved={} totalDuration={}ms",
                            malId, providerName, saved.episodeCount(), elapsed);
                        return saved;
                    } else {
                        failures.add(new ProviderAttempt(providerName, false, null, attempt.durationMs(),
                            "All episodes failed validation", "VALIDATION_FAILED"));
                    }
                } else {
                    failures.add(attempt);
                }
            }

            // Recovery: try all providers with all alternate titles
            log.warn("[SYNC_SERVICE] ALL_PROVIDERS_FAILED | malId={} failures={}", malId, failures.size());
            SyncResult recoveryResult = attemptRecovery(malId, anime, failures, altTitles, jikanData, start);
            if (recoveryResult != null) {
                return recoveryResult;
            }

            long elapsed = System.currentTimeMillis() - start;
            log.warn("[SYNC_SERVICE] COMPLETE_UNAVAILABLE | malId={} title='{}' duration={}ms", malId, anime.getTitle(), elapsed);

            try {
                cacheRepository.deleteByMalId(malId);
                cacheRepository.save(AnimeProviderCache.failure(malId));
            } catch (Exception e) {
                log.warn("[SYNC_SERVICE] CACHE_FAILED | malId={} error='{}'", malId, e.getMessage());
            }

            return SyncResult.unavailableWithFailures(
                "ALL_PROVIDERS_FAILED",
                "No provider currently has playable episodes for this title.",
                failures,
                elapsed
            );

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[SYNC_SERVICE] CATASTROPHIC_FAILURE | malId={} error='{}'", malId, e.getMessage(), e);
            return SyncResult.temporaryFailure("Unexpected error during sync: " + e.getMessage(), elapsed);
        }
    }

    /**
     * Build provider order: last-successful provider first, then default priority.
     */
    private List<String> buildProviderOrder(int malId) {
        Set<String> ordered = new LinkedHashSet<>();
        try {
            Optional<AnimeProviderCache> cached = cacheRepository.findByMalId(malId);
            if (cached.isPresent() && cached.get().isStreamable()) {
                String preferred = cached.get().getProvider();
                if (preferred != null && !preferred.isBlank()) {
                    ordered.add(preferred);
                }
            }
        } catch (Exception e) {
            log.warn("[SYNC_SERVICE] CACHE_LOOKUP_FAILED | malId={}", malId);
        }
        ordered.addAll(DEFAULT_PRIORITY);
        return new ArrayList<>(ordered);
    }

    /**
     * Verify that episodes returned by a provider actually belong to the requested anime.
     */
    private boolean verifyAnimeIdentity(int malId, String providerName, List<Episode> episodes,
                                         JikanAnimeData jikanData, String title, List<String> altTitles) {
        // Check episode count bounds
        int count = episodes.size();
        int expected = jikanData.getEpisodes() != null ? jikanData.getEpisodes() : 0;
        if (expected > 0) {
            double ratio = (double) count / expected;
            if (count > expected * 2) {
                log.warn("[SYNC_SERVICE] IDENTITY: episode count too high | malId={} expected={} got={} provider={}",
                    malId, expected, count, providerName);
                return false;
            }
            if (expected >= 12 && ratio < 0.2) {
                log.warn("[SYNC_SERVICE] IDENTITY: episode count too low | malId={} expected={} got={} provider={}",
                    malId, expected, count, providerName);
                return false;
            }
        }

        // Verify episode numbers are sequential starting from 1
        List<Integer> epNums = episodes.stream()
            .map(Episode::getEpisodeNumber)
            .filter(Objects::nonNull)
            .sorted()
            .collect(Collectors.toList());
        if (!epNums.isEmpty() && epNums.get(0) > 3) {
            log.warn("[SYNC_SERVICE] IDENTITY: episodes don't start near 1 | malId={} firstEp={} provider={}",
                malId, epNums.get(0), providerName);
            return false;
        }

        // Allow different episode numbering schemes
        return true;
    }

    private ProviderAttempt tryProvider(int malId, String title, String providerName) {
        long start = System.currentTimeMillis();
        log.info("[SYNC_SERVICE] TRY_PROVIDER | malId={} provider={} title='{}'", malId, providerName, title);

        try {
            StreamProvider provider = findProvider(providerName);
            if (provider == null) {
                return new ProviderAttempt(providerName, false, null, System.currentTimeMillis() - start,
                    "Provider implementation not found", "PROVIDER_NOT_FOUND");
            }

            log.info("[SYNC_SERVICE] CALLING_PROVIDER | malId={} provider={} title='{}' timestamp={}",
                malId, providerName, title, Instant.now());

            List<Episode> episodes = provider.fetchEpisodes(malId, title);

            long elapsed = System.currentTimeMillis() - start;

            log.info("[SYNC_SERVICE] PROVIDER_RESPONSE | malId={} provider={} status=RESPONDED episodes={} duration={}ms",
                malId, providerName, episodes != null ? episodes.size() : 0, elapsed);

            if (episodes == null) {
                log.warn("[SYNC_SERVICE] NULL_EPISODES | malId={} provider={} duration={}ms", malId, providerName, elapsed);
                return new ProviderAttempt(providerName, false, null, elapsed, "Provider returned null episodes", "NULL_RESPONSE");
            }

            if (episodes.isEmpty()) {
                log.warn("[SYNC_SERVICE] EMPTY_EPISODES | malId={} provider={} duration={}ms", malId, providerName, elapsed);
                return new ProviderAttempt(providerName, false, null, elapsed, "Provider returned empty episode list", "EMPTY_EPISODES");
            }

            healthMonitor.recordSuccess(providerName, elapsed);
            return new ProviderAttempt(providerName, true, episodes, elapsed, null, null);

        } catch (ProviderException e) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[SYNC_SERVICE] PROVIDER_EXCEPTION | malId={} provider={} code={} httpStatus={} message='{}' duration={}ms",
                malId, providerName, e.getErrorCode(), e.getHttpStatus(), e.getMessage(), elapsed);
            healthMonitor.recordFailure(providerName, elapsed);
            return new ProviderAttempt(providerName, false, null, elapsed, e.getMessage(), e.getErrorCode());

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[SYNC_SERVICE] UNEXPECTED_EXCEPTION | malId={} provider={} type='{}' message='{}' duration={}ms",
                malId, providerName, e.getClass().getSimpleName(), e.getMessage(), elapsed);
            healthMonitor.recordFailure(providerName, elapsed);
            return new ProviderAttempt(providerName, false, null, elapsed, e.getMessage(), "UNEXPECTED_ERROR");
        }
    }

    private SyncResult attemptRecovery(int malId, Anime anime, List<ProviderAttempt> previousFailures,
                                        List<String> altTitles, JikanAnimeData jikanData, long overallStart) {
        try {
            log.warn("[SYNC_SERVICE] ATTEMPTING_RECOVERY | malId={} title='{}' altTitles={}", malId, anime.getTitle(), altTitles.size());

            // Collect which providers already failed
            Set<String> failedProviders = previousFailures.stream()
                .map(ProviderAttempt::providerName)
                .collect(Collectors.toSet());

            for (String providerName : DEFAULT_PRIORITY) {
                // Even if provider failed before, retry with alternate titles
                StreamProvider provider = findProvider(providerName);
                if (provider == null) continue;

                for (String altTitle : altTitles) {
                    if (altTitle == null || altTitle.isBlank()) continue;
                    if (altTitle.equalsIgnoreCase(anime.getTitle())) continue;

                    ProviderAttempt attempt = tryProvider(malId, altTitle, providerName);
                    if (attempt.success() && attempt.episodes() != null && !attempt.episodes().isEmpty()) {
                        List<Episode> valid = safeValidateEpisodes(attempt.episodes(), "recovery/" + malId + "/" + providerName);
                        if (valid != null && !valid.isEmpty()) {
                            if (jikanData != null && !verifyAnimeIdentity(malId, providerName, valid, jikanData, anime.getTitle(), altTitles)) {
                                log.warn("[SYNC_SERVICE] RECOVERY_IDENTITY_REJECTED | malId={} provider={} altTitle='{}'",
                                    malId, providerName, altTitle);
                                continue;
                            }
                            SyncResult saved = saveEpisodes(malId, valid, providerName, jikanData);
                            long elapsed = System.currentTimeMillis() - overallStart;
                            log.info("[SYNC_SERVICE] RECOVERY_SUCCESS | malId={} provider={} altTitle='{}' saved={} totalDuration={}ms",
                                malId, providerName, altTitle, saved.episodeCount(), elapsed);
                            return saved;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[SYNC_SERVICE] RECOVERY_FAILED | malId={} error='{}'", malId, e.getMessage());
        }
        return null;
    }

    protected SyncResult saveEpisodes(int malId, List<Episode> validEpisodes, String providerName, JikanAnimeData jikanData) {
        if (validEpisodes == null || validEpisodes.isEmpty()) {
            return SyncResult.unavailable("NO_VALID_EPISODES", "No valid episodes to save", 0);
        }
        try {
            List<Episode> deduplicated = new ArrayList<>();
            Set<Integer> seen = new LinkedHashSet<>();
            for (Episode ep : validEpisodes) {
                if (ep.getEpisodeNumber() != null && seen.add(ep.getEpisodeNumber())) {
                    // Fill in episode titles from Jikan data if available
                    if (jikanData != null && (ep.getTitle() == null || ep.getTitle().startsWith("Episode "))) {
                        String episodeTitle = lookupEpisodeTitle(jikanData, ep.getEpisodeNumber());
                        if (episodeTitle != null) {
                            ep.setTitle(episodeTitle);
                        }
                    }
                    deduplicated.add(ep);
                }
            }

            deduplicated.sort(Comparator.comparingInt(Episode::getEpisodeNumber));

            episodeRepository.deleteByAnimeMalId(malId);
            episodeRepository.flush();
            episodeRepository.saveAll(deduplicated);
            episodeRepository.flush();

            updateCacheIndependent(malId, providerName, deduplicated.size());

            return SyncResult.success(providerName, deduplicated.size(), deduplicated);
        } catch (Exception e) {
            log.error("[SYNC_SERVICE] SAVE_FAILED | malId={} error='{}'", malId, e.getMessage(), e);
            return SyncResult.temporaryFailure("Failed to save episodes: " + e.getMessage(), 0);
        }
    }

    private String lookupEpisodeTitle(JikanAnimeData jikanData, int episodeNumber) {
        try {
            // Jikan API v4 doesn't include individual episode titles in anime endpoint
            // We'll set a default title
            return "Episode " + episodeNumber;
        } catch (Exception e) {
            return "Episode " + episodeNumber;
        }
    }

    private void updateCacheIndependent(int malId, String providerName, int episodeCount) {
        try {
            cacheRepository.deleteByMalId(malId);
            AnimeProviderCache cache = AnimeProviderCache.success(malId, providerName, episodeCount);
            cache.setLastSuccessTime(Instant.now());
            cache.setPreferredProvider(providerName);
            cacheRepository.save(cache);
        } catch (Exception e) {
            log.warn("[SYNC_SERVICE] CACHE_UPDATE_FAILED | malId={} error='{}'", malId, e.getMessage());
        }
    }

    private boolean verifyEpisodeCount(int malId, List<Episode> episodes) {
        if (episodes == null || episodes.isEmpty()) return false;
        try {
            JikanSingleResponse resp = jikanApiClient.fetchAnimeById(malId);
            if (resp == null || resp.getData() == null) return true;
            Integer expected = resp.getData().getEpisodes();
            if (expected == null || expected <= 0) return true;
            int actual = episodes.size();
            double ratio = (double) actual / expected;
            return ratio >= (1.0 - MAX_EPISODE_COUNT_TOLERANCE_PERCENT / 100.0) &&
                   ratio <= (1.0 + MAX_EPISODE_COUNT_TOLERANCE_PERCENT / 100.0);
        } catch (Exception e) {
            log.warn("[SYNC_SERVICE] EPISODE_COUNT_VERIFY_FAILED | malId={} error='{}'", malId, e.getMessage());
            return true;
        }
    }

    private List<Episode> safeValidateEpisodes(List<Episode> episodes, String context) {
        if (episodes == null || episodes.isEmpty()) return List.of();
        try {
            return validationService.validateEpisodes(episodes, context);
        } catch (Exception e) {
            log.warn("[SYNC_SERVICE] VALIDATION_FAILED | context={} error='{}'", context, e.getMessage());
            return null;
        }
    }

    private StreamProvider findProvider(String name) {
        for (StreamProvider p : providers) {
            if (p.getName().equalsIgnoreCase(name)) return p;
        }
        return null;
    }

    private JikanAnimeData fetchJikanDataSafe(int malId) {
        try {
            JikanSingleResponse resp = jikanApiClient.fetchAnimeById(malId);
            return resp != null ? resp.getData() : null;
        } catch (Exception e) {
            log.warn("[SYNC_SERVICE] JIKAN_FETCH_FAILED | malId={} error='{}'", malId, e.getMessage());
            return null;
        }
    }

    private List<String> collectAltTitles(JikanAnimeData data, String primaryTitle) {
        Set<String> titles = new LinkedHashSet<>();
        if (primaryTitle != null) titles.add(primaryTitle);
        if (data != null) {
            if (data.getTitle() != null) titles.add(data.getTitle());
            if (data.getTitleEnglish() != null) titles.add(data.getTitleEnglish());
            if (data.getTitleJapanese() != null) titles.add(data.getTitleJapanese());
            if (data.getTitleSynonyms() != null) titles.addAll(data.getTitleSynonyms());
        }
        return new ArrayList<>(titles);
    }

    public record ProviderAttempt(String providerName, boolean success, List<Episode> episodes,
                                   long durationMs, String error, String errorCode) {}

    public record SyncResult(String status, String message, String provider, int episodeCount,
                              List<Episode> episodes, List<Map<String, Object>> providerFailures, long durationMs) {
        public boolean isSuccess() { return "SUCCESS".equals(status); }
        public boolean isComingSoon() { return "COMING_SOON".equals(status); }
        public boolean isTemporaryFailure() { return "TEMPORARY_FAILURE".equals(status); }
        public boolean isUnavailable() { return !isSuccess() && !isComingSoon() && !isTemporaryFailure(); }
        public boolean hasFailed() { return !isSuccess() && !isComingSoon(); }

        public static SyncResult success(String provider, int count, List<Episode> episodes) {
            return new SyncResult("SUCCESS", "Episodes synchronized successfully", provider, count, episodes, List.of(), 0);
        }
        public static SyncResult unavailable(String code, String message, long durationMs) {
            return new SyncResult(code, message, null, 0, List.of(), List.of(), durationMs);
        }
        public static SyncResult unavailableWithFailures(String code, String message,
                                                          List<ProviderAttempt> failures, long durationMs) {
            List<Map<String, Object>> failureMaps = failures.stream().map(f -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("provider", f.providerName());
                m.put("error", f.error());
                m.put("errorCode", f.errorCode());
                m.put("durationMs", f.durationMs());
                return m;
            }).collect(Collectors.toList());
            return new SyncResult(code, message, null, 0, List.of(), failureMaps, durationMs);
        }
        public static SyncResult comingSoon(Anime anime, long durationMs) {
            return new SyncResult("COMING_SOON", "This anime has not aired yet.", null, 0, List.of(), List.of(), durationMs);
        }
        public static SyncResult temporaryFailure(String message, long durationMs) {
            return new SyncResult("TEMPORARY_FAILURE", message, null, 0, List.of(), List.of(), durationMs);
        }
    }

    /**
     * Sync episodes from a specific provider directly.
     */
    public Map<String, Object> syncFromProvider(int malId, String providerName) {
        long start = System.currentTimeMillis();
        try {
            Optional<Anime> animeOpt = animeRepository.findByMalId(malId);
            if (animeOpt.isEmpty()) {
                return Map.of("status", "ANIME_NOT_FOUND", "message", "No anime found with MAL ID: " + malId);
            }
            Anime anime = animeOpt.get();

            ProviderAttempt attempt = tryProvider(malId, anime.getTitle(), providerName);
            if (attempt.success() && attempt.episodes() != null && !attempt.episodes().isEmpty()) {
                JikanAnimeData jikanData = fetchJikanDataSafe(malId);
                List<Episode> valid = safeValidateEpisodes(attempt.episodes(), "direct/" + malId + "/" + providerName);
                if (valid != null && !valid.isEmpty()) {
                    SyncResult result = saveEpisodes(malId, valid, providerName, jikanData);
                    return Map.of(
                        "status", "SUCCESS",
                        "provider", providerName,
                        "episodeCount", result.episodeCount(),
                        "episodes", valid.stream().map(e -> Map.of(
                            "episodeNumber", e.getEpisodeNumber(),
                            "title", e.getTitle() != null ? e.getTitle() : "Episode " + e.getEpisodeNumber()
                        )).collect(Collectors.toList()),
                        "durationMs", System.currentTimeMillis() - start
                    );
                }
            }
            return Map.of(
                "status", "FAILED",
                "provider", providerName,
                "error", attempt.error() != null ? attempt.error() : "No episodes found",
                "errorCode", attempt.errorCode() != null ? attempt.errorCode() : "NO_EPISODES"
            );
        } catch (Exception e) {
            log.error("[SYNC_SERVICE] DIRECT_SYNC_FAILED | malId={} provider={} error='{}'", malId, providerName, e.getMessage());
            return Map.of("status", "ERROR", "message", e.getMessage());
        }
    }
}
