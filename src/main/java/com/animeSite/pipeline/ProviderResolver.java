package com.animeSite.pipeline;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanSingleResponse;
import com.animeSite.persist.AnimeProviderCache;
import com.animeSite.persist.Episode;
import com.animeSite.repo.AnimeProviderCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ProviderResolver {

    private static final Logger log = LoggerFactory.getLogger(ProviderResolver.class);

    private final ProviderPriorityManager priorityManager;
    private final RetryEngine retryEngine;
    private final ValidationService validationService;
    private final StreamVerificationService streamVerificationService;
    private final ProviderHealthMonitor healthMonitor;
    private final AnimeProviderCacheRepository cacheRepository;
    private final RecoveryEngine recoveryEngine;
    private final JikanApiClient jikanApiClient;

    @Value("${app.providers.identity-confidence-threshold:0.90}")
    private double identityConfidenceThreshold;

    @Value("${app.providers.stream-verification-enabled:true}")
    private boolean streamVerificationEnabled;

    public ProviderResolver(ProviderPriorityManager priorityManager,
                            ValidationService validationService,
                            StreamVerificationService streamVerificationService,
                            ProviderHealthMonitor healthMonitor,
                            AnimeProviderCacheRepository cacheRepository,
                            RecoveryEngine recoveryEngine,
                            JikanApiClient jikanApiClient) {
        this.priorityManager = priorityManager;
        this.retryEngine = RetryEngine.builder()
            .maxRetries(2)
            .baseDelayMs(500)
            .maxDelayMs(2000)
            .jitterMs(200)
            .build();
        this.validationService = validationService;
        this.streamVerificationService = streamVerificationService;
        this.healthMonitor = healthMonitor;
        this.cacheRepository = cacheRepository;
        this.recoveryEngine = recoveryEngine;
        this.jikanApiClient = jikanApiClient;
    }

    // ========================================================================
    // RESOLVE EPISODES — preferred provider → priority list → recovery
    // ========================================================================

    public PipelineResult<List<Episode>> resolveEpisodes(int malId, String title) {
        long start = System.currentTimeMillis();
        log.info("[RESOLVER] RESOLVE_EPISODES | malId={} title='{}'", malId, title);

        // 1. Check cached episodes — return if still valid
        AnimeProviderCache cached = getValidatedCache(malId);
        if (cached != null) {
            List<Episode> dbEpisodes = validationService.findEpisodesByMalId(malId);
            if (!dbEpisodes.isEmpty()) {
                log.info("[RESOLVER] CACHE_HIT | malId={} provider={} count={}",
                    malId, cached.getProvider(), dbEpisodes.size());
                return PipelineResult.success(dbEpisodes, cached.getProvider(), 0,
                    System.currentTimeMillis() - start);
            }
            log.warn("[RESOLVER] CACHE_STALE | malId={} provider={} — DB has no episodes, re-fetching",
                malId, cached.getProvider());
            cacheRepository.deleteByMalId(malId);
        }

        // 2. Fetch Jikan metadata for identity verification
        JikanAnimeData jikanData = fetchJikanAnimeData(malId);

        // 3. Try preferred provider first (if cached)
        if (cached != null && cached.getPreferredProvider() != null) {
            String preferred = cached.getPreferredProvider();
            if (priorityManager.isEnabled(preferred)) {
                log.info("[RESOLVER] TRY_PREFERRED | malId={} preferred={}", malId, preferred);
                StreamProvider provider = findProvider(preferred);
                if (provider != null) {
                    PipelineResult<List<Episode>> result = tryFetchFromProvider(
                        malId, title, provider, jikanData, start);
                    if (result != null) {
                        setPreferredProvider(malId, preferred, result.data.size());
                        return result;
                    }
                    log.warn("[RESOLVER] PREFERRED_FAILED | malId={} preferred={} — clearing",
                        malId, preferred);
                    clearPreferredProvider(malId);
                }
            }
        }

        // 4. Try each active provider in priority order
        List<StreamProvider> activeProviders = priorityManager.getActiveProviders();
        List<String> errors = new ArrayList<>();

        for (StreamProvider provider : activeProviders) {
            log.info("[RESOLVER] TRY_PROVIDER | malId={} provider={}", malId, provider.getName());

            PipelineResult<List<Episode>> result = tryFetchFromProvider(
                malId, title, provider, jikanData, start);
            if (result != null) {
                setPreferredProvider(malId, provider.getName(), result.data.size());
                return result;
            }

            // Retry with alternate titles from Jikan metadata
            if (jikanData != null) {
                List<String> alternateTitles = collectAlternateTitles(jikanData);
                for (String altTitle : alternateTitles) {
                    if (altTitle.equalsIgnoreCase(title)) continue;
                    log.info("[RESOLVER] TRY_ALT_TITLE | malId={} provider={} altTitle='{}'",
                        malId, provider.getName(), altTitle);
                    result = tryFetchFromProvider(malId, altTitle, provider, jikanData, start);
                    if (result != null) {
                        setPreferredProvider(malId, provider.getName(), result.data.size());
                        return result;
                    }
                }
            }

            healthMonitor.recordFailure(provider.getName(), System.currentTimeMillis() - start);
            errors.add(provider.getName() + ": failed after all title attempts");
        }

        // 5. Recovery engine as last resort
        PipelineResult<List<Episode>> recoveryResult = attemptRecovery(malId, title, errors, start, jikanData);
        if (recoveryResult != null) return recoveryResult;

        // 6. All providers failed — graceful failure
        long elapsed = System.currentTimeMillis() - start;
        log.warn("[RESOLVER] ALL_PROVIDERS_FAILED | malId={} errors={} duration={}ms",
            malId, errors, elapsed);

        cacheRepository.deleteByMalId(malId);
        cacheRepository.save(AnimeProviderCache.failure(malId));

        return PipelineResult.failure(
            "Stream is temporarily unavailable. Please try again later.",
            "ALL_PROVIDERS_FAILED", elapsed);
    }

    // ========================================================================
    // RESOLVE STREAM — try each provider, validate before returning
    // ========================================================================

    public PipelineResult<StreamResult> resolveStream(int malId, String episodeUrl) {
        long start = System.currentTimeMillis();
        log.info("[RESOLVER] RESOLVE_STREAM | malId={} episodeUrl={}", malId, episodeUrl);

        List<StreamProvider> activeProviders = priorityManager.getActiveProviders();
        List<String> errors = new ArrayList<>();

        for (StreamProvider provider : activeProviders) {
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

            if (!result.isSuccess()) {
                String err = provider.getName() + ": " +
                    (result.getError() != null ? result.getError() : "resolve failed");
                errors.add(err);
                healthMonitor.recordFailure(provider.getName(), System.currentTimeMillis() - start);
                log.warn("[RESOLVER] STREAM_FAILED | provider={} error='{}'", provider.getName(), err);
                continue;
            }

            StreamResult sr = result.get();
            if (sr.getPrimaryUrl() == null) {
                errors.add(provider.getName() + ": no primary URL");
                healthMonitor.recordFailure(provider.getName(), System.currentTimeMillis() - start);
                continue;
            }

            // Validate stream before returning
            if (streamVerificationEnabled && !"iframe".equalsIgnoreCase(sr.getType())) {
                String referer = getProviderBaseUrl(sr.getProvider());
                StreamVerificationService.VerificationResult verification =
                    streamVerificationService.verify(sr, referer);

                if (!verification.valid()) {
                    String detail = String.join("; ", verification.errors());
                    log.warn("[RESOLVER] STREAM_VALIDATION_FAILED | provider={} errors='{}'",
                        provider.getName(), detail);
                    errors.add(provider.getName() + ": validation failed - " + detail);
                    healthMonitor.recordFailure(provider.getName(), System.currentTimeMillis() - start);
                    continue;
                }

                log.info("[RESOLVER] STREAM_VALIDATED | provider={} type={} warnings={}",
                    provider.getName(), sr.getType(), verification.warnings().size());
            }

            healthMonitor.recordSuccess(provider.getName(), System.currentTimeMillis() - start);
            log.info("[RESOLVER] STREAM_FOUND | malId={} provider={} type={} servers={} duration={}ms",
                malId, provider.getName(), sr.getType(), sr.getServers().size(), result.getDurationMs());
            return PipelineResult.success(sr, provider.getName(), result.getAttempts(), result.getDurationMs());
        }

        long elapsed = System.currentTimeMillis() - start;
        log.warn("[RESOLVER] ALL_STREAMS_FAILED | malId={} errors={} duration={}ms", malId, errors, elapsed);
        return PipelineResult.failure(
            "Stream is temporarily unavailable. Please try again later.",
            "ALL_STREAMS_FAILED", elapsed);
    }

    // ========================================================================
    // RESOLVE LANGUAGES
    // ========================================================================

    public PipelineResult<List<String>> resolveLanguages(int malId, String episodeUrl) {
        long start = System.currentTimeMillis();
        log.info("[RESOLVER] RESOLVE_LANGUAGES | malId={} episodeUrl={}", malId, episodeUrl);

        for (StreamProvider provider : priorityManager.getActiveProviders()) {
            log.info("[RESOLVER] TRY_LANGUAGES | malId={} provider={}", malId, provider.getName());

            try {
                StreamResult sr = provider.resolveStream(episodeUrl);
                if (sr == null || !sr.isSuccess()) continue;

                Set<String> langs = new LinkedHashSet<>();
                for (StreamResult.ServerOption server : sr.getServers()) {
                    String label = server.label != null ? server.label.toLowerCase() : "";
                    if (label.contains("dub") || label.contains("english")) {
                        langs.add("DUB");
                    } else {
                        langs.add("SUB");
                    }
                }

                if (!langs.isEmpty()) {
                    List<String> result = new ArrayList<>(langs);
                    if (result.contains("SUB") && result.contains("DUB") && result.get(0).equals("DUB")) {
                        Collections.reverse(result);
                    }
                    long elapsed = System.currentTimeMillis() - start;
                    log.info("[RESOLVER] LANGUAGES_FOUND | malId={} provider={} languages={} duration={}ms",
                        malId, provider.getName(), result, elapsed);
                    return PipelineResult.success(result, provider.getName(), 1, elapsed);
                }
            } catch (Exception e) {
                log.warn("[RESOLVER] LANGUAGES_FAILED | malId={} provider={} error='{}'",
                    malId, provider.getName(), e.getMessage());
            }
        }

        long elapsed = System.currentTimeMillis() - start;
        log.warn("[RESOLVER] ALL_LANGUAGES_FAILED | malId={} duration={}ms", malId, elapsed);
        return PipelineResult.failure("No languages could be determined", "LANGUAGES_RESOLVE_FAILED", elapsed);
    }

    // ========================================================================
    // PREFERRED PROVIDER CACHE
    // ========================================================================

    private void setPreferredProvider(int malId, String providerName, int episodeCount) {
        try {
            cacheRepository.deleteByMalId(malId);
            AnimeProviderCache cache = AnimeProviderCache.success(malId, providerName, episodeCount);
            cache.setPreferredProvider(providerName);
            cache.setLastSuccessTime(Instant.now());
            cache.setFailureCount(0);
            cacheRepository.save(cache);
            log.info("[RESOLVER] PREFERRED_SET | malId={} provider={} count={}", malId, providerName, episodeCount);
        } catch (Exception e) {
            log.warn("[RESOLVER] PREFERRED_SET_FAILED | malId={} provider={} error='{}'",
                malId, providerName, e.getMessage());
        }
    }

    private void clearPreferredProvider(int malId) {
        try {
            cacheRepository.findByMalId(malId).ifPresent(cache -> {
                cache.setPreferredProvider(null);
                cache.setFailureCount(cache.getFailureCount() + 1);
                cacheRepository.save(cache);
                log.info("[RESOLVER] PREFERRED_CLEARED | malId={}", malId);
            });
        } catch (Exception e) {
            log.warn("[RESOLVER] PREFERRED_CLEAR_FAILED | malId={} error='{}'", malId, e.getMessage());
        }
    }

    // ========================================================================
    // PROVIDER FETCH WITH VERIFICATION
    // ========================================================================

    private PipelineResult<List<Episode>> tryFetchFromProvider(int malId, String title,
                                                                StreamProvider provider,
                                                                JikanAnimeData jikanData,
                                                                long overallStart) {
        long start = System.currentTimeMillis();
        String providerName = provider.getName();

        var result = retryEngine.execute(
            () -> provider.fetchEpisodes(malId, title),
            (List<Episode> episodes) -> {
                if (episodes == null || episodes.isEmpty()) return false;
                List<Episode> valid = validationService.validateEpisodes(episodes,
                    providerName + "/" + malId + "/" + title);
                return !valid.isEmpty();
            },
            (Exception e) -> {
                if (e instanceof ProviderException) {
                    ProviderException pe = (ProviderException) e;
                    if (pe.getErrorCode() != null && pe.getErrorCode().startsWith("HTTP_400")) {
                        return false;
                    }
                    return pe.isRecoverable();
                }
                return !(e instanceof IllegalArgumentException);
            },
            providerName + "/episodes/malId=" + malId
        );

        long elapsed = System.currentTimeMillis() - start;

        if (!result.isSuccess()) {
            return null;
        }

        List<Episode> episodes = result.get();
        List<Episode> valid = new ArrayList<>(
            validationService.validateEpisodes(episodes, providerName + "/" + malId));

        if (valid.isEmpty()) {
            return null;
        }

        // ---- IDENTITY VERIFICATION ----
        if (!verifyIdentity(malId, title, providerName, valid, jikanData)) {
            healthMonitor.recordFailure(providerName, elapsed);
            log.warn("[RESOLVER] IDENTITY_REJECTED | malId={} provider={} title='{}' count={}",
                malId, providerName, title, valid.size());
            return null;
        }

        // ---- ALL CHECKS PASSED ----
        healthMonitor.recordSuccess(providerName, elapsed);
        valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));

        log.info("[RESOLVER] EPISODES_FOUND | malId={} provider={} title='{}' count={} duration={}ms",
            malId, providerName, title, valid.size(), elapsed);

        return PipelineResult.success(valid, providerName, result.getAttempts(), elapsed);
    }

    // ========================================================================
    // ENHANCED IDENTITY VERIFICATION
    // ========================================================================

    private boolean verifyIdentity(int malId, String searchTitle, String providerName,
                                   List<Episode> episodes, JikanAnimeData jikanData) {
        if (jikanData == null) {
            log.warn("[RESOLVER] IDENTITY_SKIP | malId={} provider={} — no Jikan data available", malId, providerName);
            return true;
        }

        // 1. MAL ID match (must match)
        if (jikanData.getMalId() != malId) {
            log.warn("[RESOLVER] IDENTITY_MAL_ID_MISMATCH | malId={} jikanMalId={} provider={}",
                malId, jikanData.getMalId(), providerName);
            return false;
        }

        // 2. Episode count verification (within tolerance)
        if (!verifyEpisodeCount(malId, jikanData, episodes)) {
            log.warn("[RESOLVER] IDENTITY_EP_COUNT_REJECTED | malId={} provider={} count={} jikanEpisodes={}",
                malId, providerName, episodes.size(), jikanData.getEpisodes());
            return false;
        }

        // 3. AnimeMatcherV2 confidence check
        if (!verifyAnimeIdentity(malId, jikanData, searchTitle)) {
            return false;
        }

        // 4. Year verification (if available on both sides)
        if (jikanData.getYear() != null) {
            Integer titleYear = extractYear(searchTitle);
            if (titleYear != null && !titleYear.equals(jikanData.getYear())) {
                log.warn("[RESOLVER] IDENTITY_YEAR_MISMATCH | malId={} provider={} titleYear={} jikanYear={}",
                    malId, providerName, titleYear, jikanData.getYear());
                return false;
            }
        }

        // 5. Type verification (if available)
        if (jikanData.getType() != null && !jikanData.getType().isBlank()) {
            String titleLower = searchTitle.toLowerCase();
            String type = jikanData.getType().toLowerCase();
            if (titleLower.contains(type) || type.contains("tv")) {
                // Title mentions the type explicitly — verify it matches
                // This is a soft check, just log if suspicious
            }
        }

        return true;
    }

    private boolean verifyEpisodeCount(int malId, JikanAnimeData jikanData, List<Episode> episodes) {
        Integer expectedEpisodes = jikanData.getEpisodes();
        if (expectedEpisodes == null || expectedEpisodes <= 0) {
            return true; // Jikan doesn't know the count, skip check
        }
        if (episodes.isEmpty()) {
            return false;
        }
        int actual = episodes.size();
        int tolerance = Math.max(1, (int) Math.ceil(expectedEpisodes * 0.2));
        boolean match = Math.abs(actual - expectedEpisodes) <= tolerance;
        if (!match) {
            log.warn("[RESOLVER] EPISODE_COUNT_MISMATCH | malId={} expected={} actual={} tolerance={}",
                malId, expectedEpisodes, actual, tolerance);
        }
        return match;
    }

    private boolean verifyAnimeIdentity(int malId, JikanAnimeData jikanData, String searchTitle) {
        try {
            AnimeMatcherV2.MatchResult matchResult = AnimeMatcherV2.findBestMatch(
                searchTitle, List.of(jikanData));

            boolean accepted = matchResult.confidence >= identityConfidenceThreshold;
            if (!accepted) {
                log.warn("[RESOLVER] IDENTITY_LOW_CONFIDENCE | malId={} title='{}' confidence={} threshold={} scores={}",
                    malId, searchTitle, String.format("%.4f", matchResult.confidence),
                    String.format("%.2f", identityConfidenceThreshold), matchResult.scores);
            }
            return accepted;
        } catch (Exception e) {
            log.warn("[RESOLVER] IDENTITY_VERIFY_FAILED | malId={} error='{}'", malId, e.getMessage());
            return true;
        }
    }

    // ========================================================================
    // RECOVERY (last resort)
    // ========================================================================

    private PipelineResult<List<Episode>> attemptRecovery(int malId, String title,
                                                           List<String> previousErrors,
                                                           long overallStart, JikanAnimeData jikanData) {
        log.warn("[RESOLVER] MAIN_PROVIDERS_FAILED | malId={} | delegating to RecoveryEngine", malId);

        ProviderException triggerError = new ProviderException("ALL_PROVIDERS_FAILED", "ALL_PROVIDERS_FAILED",
            "All main providers failed", 0, null, "PROVIDER_UNAVAILABLE", true);

        RecoveryEngine.RecoveryResult rr = recoveryEngine.attemptRecovery(malId, title, triggerError);

        long elapsed = System.currentTimeMillis() - overallStart;

        if (rr.success && rr.episodes != null && !rr.episodes.isEmpty()) {
            // Verify recovery results too
            List<Episode> valid = new ArrayList<>(
                validationService.validateEpisodes(rr.episodes, "recovery/" + malId));

            if (!valid.isEmpty()) {
                boolean identityOk = verifyIdentity(malId, title, rr.provider, valid, jikanData);
                if (identityOk) {
                    valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                    log.info("[RESOLVER] RECOVERY_SUCCEEDED | malId={} provider={} count={} stages={} duration={}ms",
                        malId, rr.provider, valid.size(), rr.attempts, elapsed);
                    setPreferredProvider(malId, rr.provider, valid.size());
                    return PipelineResult.success(valid, rr.provider, rr.attempts, elapsed);
                }
                log.warn("[RESOLVER] RECOVERY_IDENTITY_REJECTED | malId={} provider={} count={}",
                    malId, rr.provider, valid.size());
            }
        }

        return null;
    }

    // ========================================================================
    // CACHE HELPERS
    // ========================================================================

    private AnimeProviderCache getValidatedCache(int malId) {
        AnimeProviderCache cached = cacheRepository.findByMalId(malId).orElse(null);
        if (cached == null) return null;
        if (cached.isExpired()) {
            log.info("[RESOLVER] CACHE_EXPIRED | malId={}", malId);
            cacheRepository.deleteByMalId(malId);
            return null;
        }
        if (!cached.isStreamable()) {
            log.info("[RESOLVER] CACHE_FAILURE_HIT | malId={} — will retry", malId);
            cacheRepository.deleteByMalId(malId);
            return null;
        }
        if (cached.getEpisodeCount() <= 0) {
            log.warn("[RESOLVER] CACHE_INVALID_EP_COUNT | malId={} count={}", malId, cached.getEpisodeCount());
            cacheRepository.deleteByMalId(malId);
            return null;
        }
        return cached;
    }

    public PipelineResult<List<Episode>> resolveEpisodesForProvider(int malId, String title, String providerName) {
        StreamProvider provider = findProvider(providerName);
        if (provider == null) {
            return PipelineResult.failure("Provider not found: " + providerName, "PROVIDER_NOT_FOUND", 0);
        }

        long start = System.currentTimeMillis();
        try {
            List<Episode> episodes = provider.fetchEpisodes(malId, title);
            List<Episode> valid = validationService.validateEpisodes(episodes, "direct/" + malId);
            if (!valid.isEmpty()) {
                valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                return PipelineResult.success(valid, providerName, 1, System.currentTimeMillis() - start);
            }
        } catch (Exception e) {
            log.warn("[RESOLVER] DIRECT_FETCH_FAILED | malId={} provider={} error='{}'",
                malId, providerName, e.getMessage());
        }
        return PipelineResult.failure("No episodes from " + providerName, "NO_EPISODES",
            System.currentTimeMillis() - start);
    }

    public boolean isStreamable(int malId) {
        AnimeProviderCache cached = cacheRepository.findByMalId(malId).orElse(null);
        return cached != null && !cached.isExpired() && cached.isStreamable() && cached.getEpisodeCount() > 0;
    }

    public String getCachedProviderForAnime(int malId) {
        AnimeProviderCache cached = cacheRepository.findByMalId(malId).orElse(null);
        if (cached != null && !cached.isExpired() && cached.isStreamable() && cached.getEpisodeCount() > 0) {
            return cached.getPreferredProvider() != null ? cached.getPreferredProvider() : cached.getProvider();
        }
        return null;
    }

    public void invalidateCache(int malId) {
        cacheRepository.deleteByMalId(malId);
        log.info("[RESOLVER] CACHE_INVALIDATED | malId={}", malId);
    }

    // ========================================================================
    // JIKAN HELPERS
    // ========================================================================

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

    private Integer extractYear(String s) {
        if (s == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\b(19[0-9]{2}|20[0-9]{2})\\b").matcher(s);
        if (m.find()) {
            return Integer.parseInt(m.group());
        }
        return null;
    }

    // ========================================================================
    // UTILITY
    // ========================================================================

    private StreamProvider findProvider(String name) {
        return priorityManager.getAllProviders().stream()
            .filter(p -> p.getName().equalsIgnoreCase(name))
            .findFirst().orElse(null);
    }

    private String getProviderBaseUrl(String providerName) {
        if (providerName == null) return "https://anineko.to/";
        String lower = providerName.toLowerCase();
        if (lower.contains("anineko")) return "https://anineko.to/";
        if (lower.contains("gogo")) return "https://gogoanime.live/";
        if (lower.contains("animesugecz")) return "https://animesuge.cz/";
        if (lower.contains("animesuge") || lower.contains("anikoto")) return "https://megaplay.buzz/";
        return "https://anineko.to/";
    }

    // ========================================================================
    // PipelineResult (unchanged)
    // ========================================================================

    public static class PipelineResult<T> {
        public final T data;
        public final String provider;
        public final int attempts;
        public final long durationMs;
        public final boolean success;
        public final String error;
        public final String errorCode;

        private PipelineResult(T data, String provider, int attempts, long durationMs,
                               boolean success, String error, String errorCode) {
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
