package com.animeSite.pipeline;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanSingleResponse;
import com.animeSite.persist.AnimeProviderCache;
import com.animeSite.persist.Episode;
import com.animeSite.repo.AnimeProviderCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ProviderResolver {

    private static final Logger log = LoggerFactory.getLogger(ProviderResolver.class);

    private final List<StreamProvider> providers;
    private final RetryEngine retryEngine;
    private final ValidationService validationService;
    private final ProviderHealthMonitor healthMonitor;
    private final AnimeProviderCacheRepository cacheRepository;
    private final RecoveryEngine recoveryEngine;
    private final JikanApiClient jikanApiClient;

    private static final List<String> DEFAULT_PRIORITY = List.of("Anineko", "GoGoAnime");
    private static final long BLACKLIST_COOLDOWN_MS = 300_000;

    private final Set<String> perAnimeProviderBlacklist = ConcurrentHashMap.newKeySet();
    private final Map<String, Long> blacklistTimestamps = new ConcurrentHashMap<>();

    public ProviderResolver(List<StreamProvider> providers, ValidationService validationService,
                            ProviderHealthMonitor healthMonitor,
                            AnimeProviderCacheRepository cacheRepository,
                            RecoveryEngine recoveryEngine,
                            JikanApiClient jikanApiClient) {
        this.providers = providers;
        this.retryEngine = RetryEngine.builder()
            .maxRetries(2)
            .baseDelayMs(500)
            .maxDelayMs(2000)
            .jitterMs(200)
            .build();
        this.validationService = validationService;
        this.healthMonitor = healthMonitor;
        this.cacheRepository = cacheRepository;
        this.recoveryEngine = recoveryEngine;
        this.jikanApiClient = jikanApiClient;
    }

    public PipelineResult<List<Episode>> resolveEpisodes(int malId, String title) {
        long start = System.currentTimeMillis();
        log.info("[RESOLVER] RESOLVE_EPISODES | malId={} title='{}'", malId, title);

        // 1. Check cache — validate before use
        AnimeProviderCache cached = getValidatedCache(malId);
        if (cached != null) {
            log.info("[RESOLVER] CACHE_VALID | malId={} provider={} count={}", malId, cached.getProvider(), cached.getEpisodeCount());
            List<Episode> dbEpisodes = validationService.findEpisodesByMalId(malId);
            if (!dbEpisodes.isEmpty()) {
                log.info("[RESOLVER] CACHE_EPISODES_FOUND | malId={} count={} provider={}", malId, dbEpisodes.size(), cached.getProvider());
                return PipelineResult.success(dbEpisodes, cached.getProvider(), 0, System.currentTimeMillis() - start);
            }
        }

        if (cached != null) {
            log.warn("[RESOLVER] CACHE_INVALID | malId={} cachedProvider={} — re-fetching", malId, cached.getProvider());
            cacheRepository.deleteByMalId(malId);
        }

        // 2. Fetch Jikan metadata for verification (used across provider attempts)
        JikanAnimeData jikanData = fetchJikanAnimeData(malId);

        // 3. Try each provider in priority order
        List<String> errors = new ArrayList<>();

        for (String providerName : DEFAULT_PRIORITY) {
            if (isProviderBlacklisted(malId, providerName)) {
                log.info("[RESOLVER] PROVIDER_BLACKLISTED | malId={} provider={}", malId, providerName);
                errors.add(providerName + ": blacklisted");
                continue;
            }

            StreamProvider provider = findProvider(providerName);
            if (provider == null) continue;

            log.info("[RESOLVER] TRY_PROVIDER | malId={} provider={}", malId, providerName);

            // Try with original title
            PipelineResult<List<Episode>> result = tryFetchFromProvider(malId, title, provider, providerName, start, jikanData);
            if (result != null) return result;

            // If failed and we have Jikan data, retry with alternate titles
            if (jikanData != null) {
                List<String> alternateTitles = collectAlternateTitles(jikanData);
                for (String altTitle : alternateTitles) {
                    if (altTitle.equalsIgnoreCase(title)) continue;
                    log.info("[RESOLVER] TRY_ALT_TITLE | malId={} provider={} altTitle='{}'", malId, providerName, altTitle);
                    result = tryFetchFromProvider(malId, altTitle, provider, providerName, start, jikanData);
                    if (result != null) return result;
                }
            }

            // Mark provider as failed for this specific anime
            blacklistProvider(malId, providerName);
            errors.add(providerName + ": failed");
        }

        // 4. Try all providers via recovery
        PipelineResult<List<Episode>> recoveryResult = attemptFullRecovery(malId, title, errors, start);
        if (recoveryResult != null) return recoveryResult;

        // 5. All providers failed — cache failure to avoid repeated expensive retries
        long elapsed = System.currentTimeMillis() - start;
        String summary = "All providers failed: " + String.join(" | ", errors);
        log.warn("[RESOLVER] ALL_PROVIDERS_FAILED | malId={} errors={} duration={}ms", malId, errors, elapsed);

        cacheRepository.deleteByMalId(malId);
        cacheRepository.save(AnimeProviderCache.failure(malId));
        log.info("[RESOLVER] FAILURE_CACHED | malId={} ttl=5min", malId);
        return PipelineResult.failure(summary, "ALL_PROVIDERS_FAILED", elapsed);
    }

    private PipelineResult<List<Episode>> tryFetchFromProvider(int malId, String title, StreamProvider provider,
                                                                String providerName, long overallStart,
                                                                JikanAnimeData jikanData) {
        long start = System.currentTimeMillis();
        ProviderException[] exceptionRef = new ProviderException[1];

        var result = retryEngine.execute(
            () -> provider.fetchEpisodes(malId, title),
            (List<Episode> episodes) -> {
                if (episodes == null || episodes.isEmpty()) return false;
                List<Episode> valid = validationService.validateEpisodes(episodes, providerName + "/" + malId + "/" + title);
                return !valid.isEmpty();
            },
            (Exception e) -> {
                if (e instanceof ProviderException) {
                    ProviderException pe = (ProviderException) e;
                    if (pe.getErrorCode() != null && pe.getErrorCode().startsWith("HTTP_400")) {
                        exceptionRef[0] = pe;
                        log.warn("[RESOLVER] HTTP_400 on first try | malId={} provider={} title='{}' cause={}", malId, providerName, title, pe.getErrorCode());
                        cacheRepository.deleteByMalId(malId);
                        return false;
                    }
                    return pe.isRecoverable();
                }
                return !(e instanceof IllegalArgumentException);
            },
            providerName + "/episodes/malId=" + malId
        );

        long elapsed = System.currentTimeMillis() - start;

        if (result.isSuccess()) {
            List<Episode> episodes = result.get();
            List<Episode> valid = new ArrayList<>(validationService.validateEpisodes(episodes, providerName + "/" + malId));
            if (!valid.isEmpty()) {
                // ----- VERIFICATION: never return mismatched data -----

                // Verify episode count matches Jikan (within 20% tolerance)
                if (!verifyEpisodeCount(malId, valid)) {
                    log.warn("[RESOLVER] EPISODE_COUNT_REJECTED | malId={} provider={} title='{}' count={}",
                        malId, providerName, title, valid.size());
                    healthMonitor.recordFailure(providerName, elapsed);
                    return null;
                }

                // Verify anime identity confidence >= 90%
                if (jikanData != null && !verifyAnimeIdentity(malId, jikanData, title)) {
                    log.warn("[RESOLVER] IDENTITY_REJECTED | malId={} provider={} title='{}'",
                        malId, providerName, title);
                    healthMonitor.recordFailure(providerName, elapsed);
                    return null;
                }

                // All verifications passed
                healthMonitor.recordSuccess(providerName, elapsed);
                valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                log.info("[RESOLVER] EPISODES_FOUND | malId={} provider={} title='{}' count={} duration={}ms",
                    malId, providerName, title, valid.size(), elapsed);

                cacheRepository.deleteByMalId(malId);
                cacheRepository.save(AnimeProviderCache.success(malId, providerName, valid.size()));
                log.info("[RESOLVER] CACHED | malId={} → provider={} expires=24h", malId, providerName);

                return PipelineResult.success(valid, providerName, result.getAttempts(), elapsed);
            }
        }

        if (exceptionRef[0] != null) {
            ProviderException pe = exceptionRef[0];
            healthMonitor.recordFailure(providerName, elapsed);
            log.warn("[RESOLVER] HTTP_400 | malId={} provider={} code={}", malId, providerName, pe.getErrorCode());
        } else {
            healthMonitor.recordFailure(providerName, elapsed);
        }

        return null;
    }

    private PipelineResult<List<Episode>> attemptFullRecovery(int malId, String title, List<String> errors, long overallStart) {
        log.warn("[RESOLVER] MAIN_PROVIDERS_FAILED | malId={} | delegating to RecoveryEngine", malId);

        ProviderException triggerError = new ProviderException("ALL_PROVIDERS_FAILED", "ALL_PROVIDERS_FAILED",
            "All main providers failed", 0, null, "PROVIDER_UNAVAILABLE", true);

        RecoveryEngine.RecoveryResult rr = recoveryEngine.attemptRecovery(malId, title, triggerError);

        long elapsed = System.currentTimeMillis() - overallStart;

        if (rr.success && rr.episodes != null && !rr.episodes.isEmpty()) {
            log.info("[RESOLVER] RECOVERY_ENGINE_SUCCEEDED | malId={} provider={} count={} stages={} duration={}ms",
                malId, rr.provider, rr.episodes.size(), rr.attempts, elapsed);
            return PipelineResult.success(rr.episodes, rr.provider, rr.attempts, elapsed);
        }

        errors.add("RecoveryEngine exhausted all " + rr.attempts + " stages");
        return null;
    }

    public PipelineResult<StreamResult> resolveStream(int malId, String episodeUrl) {
        long start = System.currentTimeMillis();
        log.info("[RESOLVER] RESOLVE_STREAM | malId={} episodeUrl={}", malId, episodeUrl);

        List<String> errors = new ArrayList<>();

        for (StreamProvider provider : providers) {
            log.info("[RESOLVER] TRY_STREAM | malId={} provider={}", malId, provider.getName());

            var result = retryEngine.execute(
                () -> provider.resolveStream(episodeUrl),
                (StreamResult sr) -> sr != null && sr.isSuccess() && sr.getPrimaryUrl() != null,
                (Exception e) -> {
                    if (e instanceof ProviderException) {
                        return ((ProviderException) e).isRecoverable();
                    }
                    return true;
                },
                provider.getName() + "/stream/malId=" + malId
            );

            if (result.isSuccess()) {
                StreamResult sr = result.get();
                if (sr.getPrimaryUrl() != null) {
                    healthMonitor.recordSuccess(provider.getName(), System.currentTimeMillis() - start);
                    log.info("[RESOLVER] STREAM_FOUND | provider={} type={} servers={} duration={}ms",
                        provider.getName(), sr.getType(), sr.getServers().size(), result.getDurationMs());
                    return PipelineResult.success(sr, provider.getName(), result.getAttempts(), result.getDurationMs());
                }
            }

            healthMonitor.recordFailure(provider.getName(), System.currentTimeMillis() - start);
            String err = provider.getName() + ": " + (result.getError() != null ? result.getError() : "no stream URL");
            errors.add(err);
            log.warn("[RESOLVER] STREAM_FAILED | provider={} error='{}'", provider.getName(), err);
        }

        long elapsed = System.currentTimeMillis() - start;
        String summary = "All providers failed for stream: " + String.join(" | ", errors);
        log.warn("[RESOLVER] ALL_STREAM_FAILED | malId={} duration={}ms", malId, elapsed);
        return PipelineResult.failure(summary, "ALL_PROVIDERS_FAILED", elapsed);
    }

    private AnimeProviderCache getValidatedCache(int malId) {
        AnimeProviderCache cached = cacheRepository.findByMalId(malId).orElse(null);
        if (cached == null) return null;
        if (cached.isExpired()) {
            log.info("[RESOLVER] CACHE_EXPIRED | malId={} provider={}", malId, cached.getProvider());
            cacheRepository.deleteByMalId(malId);
            return null;
        }
        if (!cached.isStreamable()) {
            log.info("[RESOLVER] CACHE_FAILURE_HIT | malId={} — previous failure, will retry", malId);
            cacheRepository.deleteByMalId(malId);
            return null;
        }
        if (cached.getEpisodeCount() <= 0) {
            log.warn("[RESOLVER] CACHE_INVALID_EP_COUNT | malId={} count={} — clearing", malId, cached.getEpisodeCount());
            cacheRepository.deleteByMalId(malId);
            return null;
        }
        return cached;
    }

    public PipelineResult<List<Episode>> resolveEpisodesForProvider(int malId, String title, String providerName) {
        StreamProvider provider = findProvider(providerName);
        if (provider == null) return PipelineResult.failure("Provider not found: " + providerName, "PROVIDER_NOT_FOUND", 0);

        long start = System.currentTimeMillis();
        try {
            List<Episode> episodes = provider.fetchEpisodes(malId, title);
            List<Episode> valid = validationService.validateEpisodes(episodes, "direct/" + malId);
            if (!valid.isEmpty()) {
                valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                return PipelineResult.success(valid, providerName, 1, System.currentTimeMillis() - start);
            }
        } catch (Exception e) {
            log.warn("[RESOLVER] DIRECT_FETCH_FAILED | malId={} provider={} error='{}'", malId, providerName, e.getMessage());
        }
        return PipelineResult.failure("No episodes from " + providerName, "NO_EPISODES", System.currentTimeMillis() - start);
    }

    public boolean isStreamable(int malId) {
        AnimeProviderCache cached = cacheRepository.findByMalId(malId).orElse(null);
        return cached != null && !cached.isExpired() && cached.isStreamable() && cached.getEpisodeCount() > 0;
    }

    public String getCachedProviderForAnime(int malId) {
        AnimeProviderCache cached = cacheRepository.findByMalId(malId).orElse(null);
        if (cached != null && !cached.isExpired() && cached.isStreamable() && cached.getEpisodeCount() > 0) {
            return cached.getProvider();
        }
        return null;
    }

    public void invalidateCache(int malId) {
        cacheRepository.deleteByMalId(malId);
        log.info("[RESOLVER] CACHE_INVALIDATED | malId={}", malId);
    }

    private StreamProvider findProvider(String name) {
        return providers.stream()
            .filter(p -> p.getName().equalsIgnoreCase(name))
            .findFirst().orElse(null);
    }

    // -----------------------------------------------------------------------
    // Verification helpers
    // -----------------------------------------------------------------------

    private JikanAnimeData fetchJikanAnimeData(int malId) {
        try {
            JikanSingleResponse response = jikanApiClient.fetchAnimeById(malId);
            if (response != null && response.getData() != null) {
                return response.getData();
            }
        } catch (Exception e) {
            log.warn("[RESOLVER] JIKAN_FETCH_FAILED | malId={} error='{}'", malId, e.getMessage());
        }
        return null;
    }

    private boolean verifyEpisodeCount(int malId, List<Episode> episodes) {
        try {
            JikanSingleResponse response = jikanApiClient.fetchAnimeById(malId);
            if (response != null && response.getData() != null) {
                Integer expectedEpisodes = response.getData().getEpisodes();
                if (expectedEpisodes != null && expectedEpisodes > 0 && !episodes.isEmpty()) {
                    int actual = episodes.size();
                    int tolerance = Math.max(1, (int) Math.ceil(expectedEpisodes * 0.2));
                    boolean match = Math.abs(actual - expectedEpisodes) <= tolerance;
                    if (!match) {
                        log.warn("[RESOLVER] EPISODE_COUNT_MISMATCH | malId={} expected={} actual={} tolerance={}",
                            malId, expectedEpisodes, actual, tolerance);
                    }
                    return match;
                }
            }
        } catch (Exception e) {
            log.warn("[RESOLVER] EPISODE_COUNT_VERIFY_FAILED | malId={} error='{}'", malId, e.getMessage());
        }
        return true;
    }

    private boolean verifyAnimeIdentity(int malId, JikanAnimeData jikanData, String searchTitle) {
        try {
            AnimeMatcherV2.MatchResult matchResult = AnimeMatcherV2.findBestMatch(searchTitle, List.of(jikanData));
            boolean accepted = matchResult.accepted;
            if (!accepted) {
                log.warn("[RESOLVER] IDENTITY_LOW_CONFIDENCE | malId={} title='{}' confidence={} scores={}",
                    malId, searchTitle, String.format("%.4f", matchResult.confidence), matchResult.scores);
                log.warn("[RESOLVER] IDENTITY_REJECTED | malId={} title='{}' confidence < 0.90 | matched wrong anime",
                    malId, searchTitle);
            }
            return accepted;
        } catch (Exception e) {
            log.warn("[RESOLVER] IDENTITY_VERIFY_FAILED | malId={} error='{}'", malId, e.getMessage());
            return true;
        }
    }

    private List<String> collectAlternateTitles(JikanAnimeData data) {
        Set<String> titles = new LinkedHashSet<>();
        if (data.getTitleEnglish() != null && !data.getTitleEnglish().isBlank()) {
            titles.add(data.getTitleEnglish());
        }
        if (data.getTitle() != null && !data.getTitle().isBlank()) {
            titles.add(data.getTitle());
        }
        if (data.getTitleJapanese() != null && !data.getTitleJapanese().isBlank()) {
            titles.add(data.getTitleJapanese());
        }
        if (data.getTitleSynonyms() != null) {
            for (String syn : data.getTitleSynonyms()) {
                if (syn != null && !syn.isBlank()) {
                    titles.add(syn);
                }
            }
        }
        return new ArrayList<>(titles);
    }

    // -----------------------------------------------------------------------
    // Per-anime provider blacklist (cooldown-based)
    // -----------------------------------------------------------------------

    private boolean isProviderBlacklisted(int malId, String providerName) {
        String key = malId + ":" + providerName;
        if (!perAnimeProviderBlacklist.contains(key)) return false;
        Long timestamp = blacklistTimestamps.get(key);
        if (timestamp != null && System.currentTimeMillis() - timestamp > BLACKLIST_COOLDOWN_MS) {
            perAnimeProviderBlacklist.remove(key);
            blacklistTimestamps.remove(key);
            return false;
        }
        return true;
    }

    private void blacklistProvider(int malId, String providerName) {
        String key = malId + ":" + providerName;
        perAnimeProviderBlacklist.add(key);
        blacklistTimestamps.put(key, System.currentTimeMillis());
        log.info("[RESOLVER] PROVIDER_BLACKLISTED | malId={} provider={} cooldown=5min", malId, providerName);
    }

    // -----------------------------------------------------------------------
    // PipelineResult (unchanged)
    // -----------------------------------------------------------------------

    public static class PipelineResult<T> {
        public final T data;
        public final String provider;
        public final int attempts;
        public final long durationMs;
        public final boolean success;
        public final String error;
        public final String errorCode;

        private PipelineResult(T data, String provider, int attempts, long durationMs, boolean success, String error, String errorCode) {
            this.data = data;
            this.provider = provider;
            this.attempts = attempts;
            this.durationMs = durationMs;
            this.success = success;
            this.error = error;
            this.errorCode = errorCode;
        }

        public static <T> PipelineResult<T> success(T data, String provider, int attempts, long durationMs) {
            return new PipelineResult<>(data, provider, attempts, durationMs, true, null, null);
        }

        public static <T> PipelineResult<T> failure(String error, String errorCode, long durationMs) {
            return new PipelineResult<>(null, null, 0, durationMs, false, error, errorCode);
        }
    }
}
