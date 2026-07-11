package com.animeSite.service;

import com.animeSite.httpclient.JikanApiClient;
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

    /**
     * Sync episodes for a given MAL ID.
     * NEVER throws exceptions. ALWAYS returns a structured SyncResult.
     */
    @Transactional
    public SyncResult syncEpisodes(int malId) {
        long start = System.currentTimeMillis();
        log.info("[SYNC_SERVICE] START | malId={}", malId);

        try {
            // 1. Get anime from database
            Optional<Anime> animeOpt = animeRepository.findByMalId(malId);
            if (animeOpt.isEmpty()) {
                log.warn("[SYNC_SERVICE] ANIME_NOT_FOUND | malId={}", malId);
                return SyncResult.unavailable("ANIME_NOT_FOUND", "No anime found with MAL ID: " + malId, System.currentTimeMillis() - start);
            }
            Anime anime = animeOpt.get();

            // 2. Check release state — skip provider lookup for unreleased anime
            try {
                if (releaseDetector.shouldSkipProviderLookup(malId)) {
                    log.info("[SYNC_SERVICE] COMING_SOON | malId={} title='{}'", malId, anime.getTitle());
                    return SyncResult.comingSoon(anime, System.currentTimeMillis() - start);
                }
            } catch (Exception e) {
                log.warn("[SYNC_SERVICE] RELEASE_CHECK_FAILED | malId={} error='{}'", malId, e.getMessage());
                // Non-fatal — continue to provider lookup
            }

            // 3. Try each provider in priority order
            List<ProviderAttempt> failures = new ArrayList<>();
            List<Episode> jikanEpisodes = null;

            for (String providerName : DEFAULT_PRIORITY) {
                ProviderAttempt attempt = tryProvider(malId, anime.getTitle(), providerName);
                log.info("[SYNC_SERVICE] PROVIDER_ATTEMPT | malId={} provider={} success={} episodes={} duration={}ms error='{}'",
                    malId, providerName, attempt.success(),
                    attempt.episodes() != null ? attempt.episodes().size() : 0,
                    attempt.durationMs(),
                    attempt.error() != null ? attempt.error() : "");

                if (attempt.success() && attempt.episodes() != null && !attempt.episodes().isEmpty()) {
                    // Validate before saving
                    List<Episode> valid = safeValidateEpisodes(attempt.episodes(), "sync/" + malId + "/" + providerName);
                    if (valid != null && !valid.isEmpty()) {
                        // Verify episode count against Jikan
                        if (!verifyEpisodeCount(malId, valid)) {
                            log.warn("[SYNC_SERVICE] EPISODE_COUNT_REJECTED | malId={} provider={} count={}",
                                malId, providerName, valid.size());
                            failures.add(new ProviderAttempt(providerName, false, null, attempt.durationMs(),
                                "Episode count mismatch", "COUNT_MISMATCH"));
                            continue;
                        }
                        // Save to database
                        SyncResult saved = saveEpisodes(malId, valid, providerName);
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

            // 4. All providers failed — try recovery with alternate titles
            log.warn("[SYNC_SERVICE] ALL_PROVIDERS_FAILED | malId={} failures={}", malId, failures.size());
            SyncResult recoveryResult = attemptRecovery(malId, anime, failures, start);
            if (recoveryResult != null) {
                return recoveryResult;
            }

            // 5. Truly all failed
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[SYNC_SERVICE] COMPLETE_UNAVAILABLE | malId={} title='{}' duration={}ms", malId, anime.getTitle(), elapsed);

            // Cache failure
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
            // ABSOLUTE LAST RESORT: catch anything that escaped
            long elapsed = System.currentTimeMillis() - start;
            log.error("[SYNC_SERVICE] CATASTROPHIC_FAILURE | malId={} error='{}'", malId, e.getMessage(), e);
            return SyncResult.temporaryFailure("Unexpected error during sync: " + e.getMessage(), elapsed);
        }
    }

    /**
     * Try a single provider with full exception isolation.
     * NEVER throws.
     */
    private ProviderAttempt tryProvider(int malId, String title, String providerName) {
        long start = System.currentTimeMillis();
        log.info("[SYNC_SERVICE] TRY_PROVIDER | malId={} provider={} title='{}'", malId, providerName, title);

        try {
            StreamProvider provider = findProvider(providerName);
            if (provider == null) {
                return new ProviderAttempt(providerName, false, null, System.currentTimeMillis() - start,
                    "Provider implementation not found", "PROVIDER_NOT_FOUND");
            }

            // Log before call
            log.info("[SYNC_SERVICE] CALLING_PROVIDER | malId={} provider={} title='{}' timestamp={}",
                malId, providerName, title, Instant.now());

            List<Episode> episodes = provider.fetchEpisodes(malId, title);

            long elapsed = System.currentTimeMillis() - start;

            // Log after call
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

    /**
     * Attempt recovery with alternate titles.
     */
    private SyncResult attemptRecovery(int malId, Anime anime, List<ProviderAttempt> failures, long overallStart) {
        try {
            log.warn("[SYNC_SERVICE] ATTEMPTING_RECOVERY | malId={} title='{}'", malId, anime.getTitle());
            // Try each provider with alternate titles
            for (String providerName : DEFAULT_PRIORITY) {
                if (hasFailed(failures, providerName)) {
                    continue;
                }
                StreamProvider provider = findProvider(providerName);
                if (provider == null) continue;

                // Get Jikan data for alternate titles
                List<String> altTitles = fetchAlternateTitles(malId);
                for (String altTitle : altTitles) {
                    if (altTitle.equalsIgnoreCase(anime.getTitle())) continue;
                    ProviderAttempt attempt = tryProvider(malId, altTitle, providerName);
                    if (attempt.success() && attempt.episodes() != null && !attempt.episodes().isEmpty()) {
                        List<Episode> valid = safeValidateEpisodes(attempt.episodes(), "recovery/" + malId + "/" + providerName);
                        if (valid != null && !valid.isEmpty()) {
                            SyncResult saved = saveEpisodes(malId, valid, providerName);
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

    /**
     * Save episodes to database. Never throws.
     */
    @Transactional
    protected SyncResult saveEpisodes(int malId, List<Episode> validEpisodes, String providerName) {
        if (validEpisodes == null || validEpisodes.isEmpty()) {
            return SyncResult.unavailable("NO_VALID_EPISODES", "No valid episodes to save", 0);
        }
        try {
            // Remove duplicates
            List<Episode> deduplicated = new ArrayList<>();
            Set<Integer> seen = new LinkedHashSet<>();
            for (Episode ep : validEpisodes) {
                if (ep.getEpisodeNumber() != null && seen.add(ep.getEpisodeNumber())) {
                    deduplicated.add(ep);
                }
            }

            // Delete old episodes and save new ones
            episodeRepository.deleteByAnimeMalId(malId);
            episodeRepository.saveAll(deduplicated);

            // Update cache
            try {
                cacheRepository.deleteByMalId(malId);
                cacheRepository.save(AnimeProviderCache.success(malId, providerName, deduplicated.size()));
            } catch (Exception e) {
                log.warn("[SYNC_SERVICE] CACHE_UPDATE_FAILED | malId={} error='{}'", malId, e.getMessage());
            }

            return SyncResult.success(providerName, deduplicated.size(), deduplicated);
        } catch (Exception e) {
            log.error("[SYNC_SERVICE] SAVE_FAILED | malId={} error='{}'", malId, e.getMessage(), e);
            return SyncResult.temporaryFailure("Failed to save episodes: " + e.getMessage(), 0);
        }
    }

    private List<Episode> safeValidateEpisodes(List<Episode> episodes, String context) {
        if (episodes == null) return Collections.emptyList();
        try {
            return validationService.validateEpisodes(episodes, context);
        } catch (Exception e) {
            log.warn("[SYNC_SERVICE] VALIDATION_FAILED | context='{}' error='{}'", context, e.getMessage());
            return Collections.emptyList();
        }
    }

    private boolean verifyEpisodeCount(int malId, List<Episode> episodes) {
        if (episodes == null || episodes.isEmpty()) return false;
        try {
            JikanSingleResponse response = jikanApiClient.fetchAnimeById(malId);
            if (response != null && response.getData() != null) {
                Integer expectedEpisodes = response.getData().getEpisodes();
                if (expectedEpisodes != null && expectedEpisodes > 0) {
                    int actual = episodes.size();
                    int tolerance = Math.max(1, (int) Math.ceil(expectedEpisodes * 0.2));
                    boolean match = Math.abs(actual - expectedEpisodes) <= tolerance;
                    if (!match) {
                        log.warn("[SYNC_SERVICE] EPISODE_COUNT_MISMATCH | malId={} expected={} actual={} tolerance={}",
                            malId, expectedEpisodes, actual, tolerance);
                    }
                    return match;
                }
            }
        } catch (Exception e) {
            log.warn("[SYNC_SERVICE] EPISODE_COUNT_VERIFY_FAILED | malId={} error='{}'", malId, e.getMessage());
        }
        // If we can't verify against Jikan, check that episodes have valid episode numbers
        return episodes.stream().allMatch(ep -> ep.getEpisodeNumber() != null && ep.getEpisodeNumber() > 0);
    }

    private List<String> fetchAlternateTitles(int malId) {
        Set<String> titles = new LinkedHashSet<>();
        try {
            JikanSingleResponse response = jikanApiClient.fetchAnimeById(malId);
            if (response != null && response.getData() != null) {
                JikanAnimeData data = response.getData();
                if (data.getTitle() != null) titles.add(data.getTitle());
                if (data.getTitleEnglish() != null) titles.add(data.getTitleEnglish());
                if (data.getTitleJapanese() != null) titles.add(data.getTitleJapanese());
                if (data.getTitleSynonyms() != null) {
                    titles.addAll(data.getTitleSynonyms());
                }
            }
        } catch (Exception e) {
            log.warn("[SYNC_SERVICE] ALTERNATE_TITLES_FAILED | malId={} error='{}'", malId, e.getMessage());
        }
        return new ArrayList<>(titles);
    }

    private StreamProvider findProvider(String name) {
        if (name == null) return null;
        for (StreamProvider p : providers) {
            if (p.getName().equalsIgnoreCase(name)) return p;
        }
        return null;
    }

    private boolean hasFailed(List<ProviderAttempt> failures, String providerName) {
        if (failures == null || providerName == null) return false;
        return failures.stream().anyMatch(f -> providerName.equalsIgnoreCase(f.providerName()));
    }

    // -----------------------------------------------------------------------
    // Result types
    // -----------------------------------------------------------------------

    public record ProviderAttempt(
        String providerName,
        boolean success,
        List<Episode> episodes,
        long durationMs,
        String error,
        String errorCode
    ) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("provider", providerName);
            m.put("success", success);
            if (error != null) m.put("error", error);
            if (errorCode != null) m.put("errorCode", errorCode);
            m.put("durationMs", durationMs);
            if (episodes != null) m.put("episodeCount", episodes.size());
            return m;
        }
    }

    public record SyncResult(
        String status,       // SUCCESS, UNAVAILABLE, COMING_SOON, TEMPORARY_FAILURE
        String message,
        String provider,
        int episodeCount,
        List<Episode> episodes,
        List<Map<String, Object>> providerFailures,
        long durationMs
    ) {
        public static SyncResult success(String provider, int episodeCount, List<Episode> episodes) {
            return new SyncResult("SUCCESS", null, provider, episodeCount, episodes, null, 0);
        }

        public static SyncResult unavailable(String errorCode, String message, long durationMs) {
            return new SyncResult("UNAVAILABLE", message, null, 0, Collections.emptyList(), null, durationMs);
        }

        public static SyncResult unavailableWithFailures(String errorCode, String message,
                                                          List<ProviderAttempt> failures, long durationMs) {
            List<Map<String, Object>> failureMaps = failures != null
                ? failures.stream().map(ProviderAttempt::toMap).collect(Collectors.toList())
                : Collections.emptyList();
            return new SyncResult("UNAVAILABLE", message, null, 0, Collections.emptyList(), failureMaps, durationMs);
        }

        public static SyncResult comingSoon(Anime anime, long durationMs) {
            return new SyncResult("COMING_SOON",
                "This anime has not been released yet.",
                null, 0, Collections.emptyList(), null, durationMs);
        }

        public static SyncResult temporaryFailure(String message, long durationMs) {
            return new SyncResult("TEMPORARY_FAILURE", message, null, 0, Collections.emptyList(), null, durationMs);
        }

        public boolean isSuccess() { return "SUCCESS".equals(status); }
        public boolean isComingSoon() { return "COMING_SOON".equals(status); }
        public boolean isUnavailable() { return "UNAVAILABLE".equals(status); }
        public boolean isTemporaryFailure() { return "TEMPORARY_FAILURE".equals(status); }

        public Map<String, Object> toApiResponse() {
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status", status);
            resp.put("message", message);
            if (provider != null) resp.put("provider", provider);
            if (episodeCount > 0) resp.put("episodeCount", episodeCount);
            if (episodes != null && !episodes.isEmpty()) resp.put("episodes", episodes);
            if (providerFailures != null) resp.put("providerFailures", providerFailures);
            resp.put("durationMs", durationMs);
            resp.put("timestamp", Instant.now().toString());
            return resp;
        }
    }
}
