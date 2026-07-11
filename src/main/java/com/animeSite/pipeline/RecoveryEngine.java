package com.animeSite.pipeline;

import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeProviderCache;
import com.animeSite.persist.Episode;
import com.animeSite.repo.AnimeProviderCacheRepository;
import com.animeSite.repo.AnimeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecoveryEngine {

    private static final Logger log = LoggerFactory.getLogger(RecoveryEngine.class);

    private final List<StreamProvider> providers;
    private final AnimeProviderCacheRepository cacheRepository;
    private final ValidationService validationService;
    private final AnimeRepository animeRepository;

    public RecoveryEngine(List<StreamProvider> providers,
                          AnimeProviderCacheRepository cacheRepository,
                          ValidationService validationService,
                          AnimeRepository animeRepository) {
        this.providers = providers;
        this.cacheRepository = cacheRepository;
        this.validationService = validationService;
        this.animeRepository = animeRepository;
    }

    public RecoveryResult attemptRecovery(int malId, String title, ProviderException originalError) {
        long start = System.currentTimeMillis();
        log.info("[RECOVERY] START | malId={} title='{}' error='{}'", malId, title, originalError.getMessage());

        Anime anime = animeRepository.findByMalId(malId).orElse(null);

        Map<String, Object> recoveryLog = new LinkedHashMap<>();
        List<RecoveryAction> actions = new ArrayList<>();
        recoveryLog.put("originalError", originalError.toErrorReport());
        recoveryLog.put("stages", new ArrayList<Map<String, Object>>());

        // Stage 1: Retry same request (same provider, same title)
        RecoveryResult r1 = attemptStage(malId, title, anime, originalError.getProvider(),
            1, "RETRY_SAME", originalError.getProvider(), false, 1000);
        if (r1.success) return r1;
        actions.add(r1.lastAction);
        ((List<Map<String, Object>>) recoveryLog.get("stages")).add(r1.asMap());

        // Stage 2: Title search cascade — try normalized and variant titles
        RecoveryResult r2 = attemptTitleSearchCascade(malId, title, anime, originalError.getProvider(), 2);
        if (r2.success) return r2;
        actions.add(r2.lastAction);
        ((List<Map<String, Object>>) recoveryLog.get("stages")).add(r2.asMap());

        // Stage 3: Invalidate mapping and try all providers with title variants
        RecoveryResult r3 = attemptFullSearch(malId, title, anime, originalError.getProvider(), 3);
        if (r3.success) return r3;
        actions.add(r3.lastAction);
        ((List<Map<String, Object>>) recoveryLog.get("stages")).add(r3.asMap());

        // Stage 4: Try all providers (switch provider)
        RecoveryResult r4 = attemptSwitchProvider(malId, title, anime, originalError.getProvider(), 4);
        if (r4.success) return r4;
        actions.add(r4.lastAction);
        ((List<Map<String, Object>>) recoveryLog.get("stages")).add(r4.asMap());

        // Stage 5: Attempt with fuzzy/near-match titles on all providers
        RecoveryResult r5 = attemptFuzzySearch(malId, title, anime, originalError.getProvider(), 5);
        if (r5.success) return r5;
        actions.add(r5.lastAction);
        ((List<Map<String, Object>>) recoveryLog.get("stages")).add(r5.asMap());

        long elapsed = System.currentTimeMillis() - start;
        log.warn("[RECOVERY] ALL_STAGES_FAILED | malId={} attempts={} duration={}ms", malId, 5, elapsed);
        return RecoveryResult.failure(5, actions, recoveryLog, elapsed);
    }

    private RecoveryResult attemptStage(int malId, String title, Anime anime, String failedProvider,
                                        int stageNum, String stageName, String targetProvider,
                                        boolean skipCache, long delayMs) {
        if (delayMs > 0) {
            try { Thread.sleep(delayMs); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }

        long start = System.currentTimeMillis();
        log.info("[RECOVERY] STAGE_{}={} | malId={} provider={}", stageNum, stageName, malId, targetProvider);

        if (skipCache) {
            cacheRepository.deleteByMalId(malId);
        }

        StreamProvider provider = findProvider(targetProvider);
        if (provider == null) {
            return RecoveryResult.failedAction(stageNum, stageName, "Provider not found: " + targetProvider,
                System.currentTimeMillis() - start);
        }

        try {
            List<Episode> episodes = provider.fetchEpisodes(malId, title);
            List<Episode> valid = new ArrayList<>(validationService.validateEpisodes(episodes, "recovery/" + stageName + "/" + malId));
            if (!valid.isEmpty()) {
                long elapsed = System.currentTimeMillis() - start;
                valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                cacheRepository.deleteByMalId(malId);
                cacheRepository.save(AnimeProviderCache.success(malId, targetProvider, valid.size()));
                log.info("[RECOVERY] {} SUCCESS | malId={} provider={} count={} duration={}ms",
                    stageName, malId, targetProvider, valid.size(), elapsed);
                return RecoveryResult.success(stageNum, stageName, targetProvider, valid,
                    recoveryAction(stageName, targetProvider, elapsed));
            }
            log.warn("[RECOVERY] {} NO_VALID | malId={} provider={} got {} episodes",
                stageName, malId, targetProvider, episodes != null ? episodes.size() : 0);
        } catch (ProviderException pe) {
            log.warn("[RECOVERY] {} PROVIDER_ERROR | malId={} provider={} code={}",
                stageName, malId, targetProvider, pe.getErrorCode());
        } catch (Exception e) {
            log.warn("[RECOVERY] {} ERROR | malId={} provider={} msg='{}'",
                stageName, malId, targetProvider, e.getMessage());
        }

        return RecoveryResult.failedAction(stageNum, stageName, stageName + " failed",
            System.currentTimeMillis() - start);
    }

    private RecoveryResult attemptTitleSearchCascade(int malId, String title, Anime anime,
                                                      String failedProvider, int stageNum) {
        long start = System.currentTimeMillis();
        log.info("[RECOVERY] STAGE_{}=TITLE_CASCADE | malId={} title='{}'", stageNum, malId, title);

        cacheRepository.deleteByMalId(malId);

        StreamProvider provider = findProvider(failedProvider);
        if (provider == null) {
            return RecoveryResult.failedAction(stageNum, "TITLE_CASCADE", "Provider not found",
                System.currentTimeMillis() - start);
        }

        List<String> titleVariants = generateTitleVariants(title);

        for (String variant : titleVariants) {
            try {
                Thread.sleep(400);
                log.info("[RECOVERY] TITLE_VARIANT | malId={} variant='{}'", malId, variant);
                List<Episode> episodes = provider.fetchEpisodes(malId, variant);
                List<Episode> valid = new ArrayList<>(validationService.validateEpisodes(episodes, "recovery/variant/" + malId));
                if (!valid.isEmpty()) {
                    long elapsed = System.currentTimeMillis() - start;
                    valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                    cacheRepository.deleteByMalId(malId);
                    cacheRepository.save(AnimeProviderCache.success(malId, failedProvider, valid.size()));
                    log.info("[RECOVERY] TITLE_CASCADE SUCCESS | malId={} variant='{}' count={} duration={}ms",
                        malId, variant, valid.size(), elapsed);
                    return RecoveryResult.success(stageNum, "TITLE_CASCADE", failedProvider, valid,
                        recoveryAction("TITLE_CASCADE", failedProvider, elapsed));
                }
            } catch (Exception e) {
                log.warn("[RECOVERY] TITLE_VARIANT_FAILED | malId={} variant='{}' error='{}'",
                    malId, variant, e.getMessage());
            }
        }

        return RecoveryResult.failedAction(stageNum, "TITLE_CASCADE", "All title variants failed",
            System.currentTimeMillis() - start);
    }

    private RecoveryResult attemptFullSearch(int malId, String title, Anime anime,
                                              String failedProvider, int stageNum) {
        long start = System.currentTimeMillis();
        log.info("[RECOVERY] STAGE_{}=FULL_SEARCH | malId={} title='{}'", stageNum, malId, title);

        cacheRepository.deleteByMalId(malId);

        Integer expectedCount = (anime != null && anime.getEpisodes() != null && anime.getEpisodes() > 0)
            ? anime.getEpisodes() : null;

        List<String> titleVariants = generateTitleVariants(title);

        for (StreamProvider provider : providers) {
            for (String variant : titleVariants) {
                try {
                    Thread.sleep(300);
                    log.info("[RECOVERY] FULL_SEARCH | malId={} provider={} variant='{}'", malId, provider.getName(), variant);
                    List<Episode> episodes = provider.fetchEpisodes(malId, variant);
                    if (episodes == null || episodes.isEmpty()) continue;

                    List<Episode> valid = new ArrayList<>(validationService.validateEpisodes(episodes, "recovery/full/" + malId));
                    if (valid.isEmpty()) continue;

                    if (expectedCount != null && isGoodMatch(valid.size(), expectedCount)) {
                        long elapsed = System.currentTimeMillis() - start;
                        valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                        cacheRepository.deleteByMalId(malId);
                        cacheRepository.save(AnimeProviderCache.success(malId, provider.getName(), valid.size()));
                        log.info("[RECOVERY] FULL_SEARCH SUCCESS | malId={} provider={} count={} expected={} duration={}ms",
                            malId, provider.getName(), valid.size(), expectedCount, elapsed);
                        return RecoveryResult.success(stageNum, "FULL_SEARCH", provider.getName(), valid,
                            recoveryAction("FULL_SEARCH", provider.getName(), elapsed));
                    }

                    if (expectedCount == null) {
                        long elapsed = System.currentTimeMillis() - start;
                        valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                        cacheRepository.deleteByMalId(malId);
                        cacheRepository.save(AnimeProviderCache.unvalidated(malId, provider.getName(), valid.size()));
                        log.info("[RECOVERY] FULL_SEARCH UNVALIDATED SUCCESS | malId={} provider={} count={} duration={}ms",
                            malId, provider.getName(), valid.size(), elapsed);
                        return RecoveryResult.success(stageNum, "FULL_SEARCH", provider.getName(), valid,
                            recoveryAction("FULL_SEARCH", provider.getName(), elapsed));
                    }

                    log.info("[RECOVERY] FULL_SEARCH COUNT_MISMATCH | malId={} provider={} got={} expected={}",
                        malId, provider.getName(), valid.size(), expectedCount);
                } catch (Exception e) {
                    log.warn("[RECOVERY] FULL_SEARCH_FAILED | malId={} provider={} error='{}'",
                        malId, provider.getName(), e.getMessage());
                }
            }
        }

        return RecoveryResult.failedAction(stageNum, "FULL_SEARCH", "All providers and variants failed",
            System.currentTimeMillis() - start);
    }

    private RecoveryResult attemptSwitchProvider(int malId, String title, Anime anime,
                                                  String failedProvider, int stageNum) {
        long start = System.currentTimeMillis();
        log.info("[RECOVERY] STAGE_{}=SWITCH_PROVIDER | malId={} failed={}", stageNum, malId, failedProvider);

        cacheRepository.deleteByMalId(malId);

        for (StreamProvider provider : providers) {
            if (provider.getName().equalsIgnoreCase(failedProvider)) continue;
            try {
                Thread.sleep(500);
                log.info("[RECOVERY] SWITCH_TO | malId={} provider={}", malId, provider.getName());
                List<Episode> episodes = provider.fetchEpisodes(malId, title);
                List<Episode> valid = new ArrayList<>(validationService.validateEpisodes(episodes, "recovery/switch/" + malId));
                if (!valid.isEmpty()) {
                    long elapsed = System.currentTimeMillis() - start;
                    valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                    cacheRepository.deleteByMalId(malId);
                    cacheRepository.save(AnimeProviderCache.success(malId, provider.getName(), valid.size()));
                    log.info("[RECOVERY] SWITCH_SUCCESS | malId={} provider={} count={} duration={}ms",
                        malId, provider.getName(), valid.size(), elapsed);
                    return RecoveryResult.success(stageNum, "SWITCH_PROVIDER", provider.getName(), valid,
                        recoveryAction("SWITCH_PROVIDER", provider.getName(), elapsed));
                }
            } catch (Exception e) {
                log.warn("[RECOVERY] SWITCH_FAILED | malId={} provider={} error='{}'",
                    malId, provider.getName(), e.getMessage());
            }
        }

        return RecoveryResult.failedAction(stageNum, "SWITCH_PROVIDER", "No alternative providers succeeded",
            System.currentTimeMillis() - start);
    }

    private RecoveryResult attemptFuzzySearch(int malId, String title, Anime anime,
                                               String failedProvider, int stageNum) {
        long start = System.currentTimeMillis();
        log.info("[RECOVERY] STAGE_{}=FUZZY_SEARCH | malId={} title='{}'", stageNum, malId, title);

        cacheRepository.deleteByMalId(malId);

        List<String> fuzzyTitles = generateFuzzyTitles(title);

        for (StreamProvider provider : providers) {
            for (String fuzzy : fuzzyTitles) {
                try {
                    Thread.sleep(200);
                    log.info("[RECOVERY] FUZZY | malId={} provider={} query='{}'", malId, provider.getName(), fuzzy);
                    List<Episode> episodes = provider.fetchEpisodes(malId, fuzzy);
                    List<Episode> valid = new ArrayList<>(validationService.validateEpisodes(episodes, "recovery/fuzzy/" + malId));
                    if (!valid.isEmpty()) {
                        long elapsed = System.currentTimeMillis() - start;
                        valid.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                        cacheRepository.deleteByMalId(malId);
                        cacheRepository.save(AnimeProviderCache.unvalidated(malId, provider.getName(), valid.size()));
                        log.info("[RECOVERY] FUZZY_SUCCESS | malId={} provider={} query='{}' count={} duration={}ms",
                            malId, provider.getName(), fuzzy, valid.size(), elapsed);
                        return RecoveryResult.success(stageNum, "FUZZY_SEARCH", provider.getName(), valid,
                            recoveryAction("FUZZY_SEARCH", provider.getName(), elapsed));
                    }
                } catch (Exception e) {
                    log.warn("[RECOVERY] FUZZY_FAILED | malId={} provider={} error='{}'",
                        malId, provider.getName(), e.getMessage());
                }
            }
        }

        return RecoveryResult.failedAction(stageNum, "FUZZY_SEARCH", "All fuzzy searches failed",
            System.currentTimeMillis() - start);
    }

    private List<String> generateTitleVariants(String title) {
        Set<String> variants = new LinkedHashSet<>();
        if (title == null || title.isBlank()) return new ArrayList<>(variants);

        variants.add(title);
        variants.add(title.trim());

        // Normalized: lowercase, collapse whitespace
        String normalized = title.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        variants.add(normalized);

        // Without special characters
        String noSpecial = normalized.replaceAll("[^a-z0-9\\s]", "").trim();
        if (!noSpecial.isEmpty() && !noSpecial.equals(normalized)) {
            variants.add(noSpecial);
        }

        // Without subtitle (remove anything after parentheses or colon for main title)
        String mainTitle = title.replaceAll("\\s*[(\\(].*?[)\\)]\\s*", "").trim();
        mainTitle = mainTitle.replaceAll("\\s*:.*$", "").trim();
        if (!mainTitle.isEmpty() && !mainTitle.equalsIgnoreCase(title)) {
            variants.add(mainTitle);
            variants.add(mainTitle.toLowerCase(Locale.ROOT));
        }

        // First few words if title is long
        String[] words = normalized.split("\\s+");
        if (words.length > 3) {
            String shortTitle = String.join(" ", Arrays.copyOf(words, Math.min(3, words.length)));
            variants.add(shortTitle);
        }

        // Without common suffixes
        String noSuffix = normalized.replaceAll("\\s*(part\\s+\\d+|season\\s+\\d+|s\\d+|episode\\s+\\d+)$", "").trim();
        if (!noSuffix.isEmpty() && !noSuffix.equals(normalized)) {
            variants.add(noSuffix);
        }

        return new ArrayList<>(variants);
    }

    private List<String> generateFuzzyTitles(String title) {
        Set<String> fuzzy = new LinkedHashSet<>();
        if (title == null || title.isBlank()) return new ArrayList<>(fuzzy);

        String normalized = title.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();

        // Remove all punctuation and special chars
        String stripped = normalized.replaceAll("[^a-z0-9\\s]", "").trim();
        fuzzy.add(stripped);

        // Take first 2 words
        String[] words = stripped.split("\\s+");
        if (words.length >= 2) {
            fuzzy.add(words[0] + " " + words[1]);
        }
        if (words.length >= 1) {
            fuzzy.add(words[0]);
        }

        // Without articles
        String noArticles = Arrays.stream(words)
            .filter(w -> !w.matches("^(the|a|an|and|or|of|in|to|for|with)$"))
            .collect(Collectors.joining(" "));
        if (!noArticles.isEmpty() && !noArticles.equals(stripped)) {
            fuzzy.add(noArticles);
        }

        return new ArrayList<>(fuzzy);
    }

    private boolean isGoodMatch(int got, int expected) {
        if (expected <= 0) return got > 0;
        // Allow within 20% of expected, or at least 1 if expected is small
        int tolerance = Math.max(1, (int) Math.ceil(expected * 0.2));
        return Math.abs(got - expected) <= tolerance;
    }

    private StreamProvider findProvider(String name) {
        return providers.stream()
            .filter(p -> p.getName().equalsIgnoreCase(name))
            .findFirst().orElse(null);
    }

    private Map<String, Object> recoveryAction(String stage, String provider, long durationMs) {
        Map<String, Object> action = new LinkedHashMap<>();
        action.put("stage", stage);
        action.put("provider", provider);
        action.put("durationMs", durationMs);
        return action;
    }

    public static class RecoveryResult {
        public final boolean success;
        public final int attempts;
        public final List<RecoveryAction> actions;
        public final Map<String, Object> recoveryLog;
        public final long totalDurationMs;
        public final List<Episode> episodes;
        public final String provider;
        public final RecoveryAction lastAction;

        private RecoveryResult(boolean success, int attempts, List<RecoveryAction> actions,
                              Map<String, Object> recoveryLog, long totalDurationMs,
                              List<Episode> episodes, String provider, RecoveryAction lastAction) {
            this.success = success;
            this.attempts = attempts;
            this.actions = actions;
            this.recoveryLog = recoveryLog;
            this.totalDurationMs = totalDurationMs;
            this.episodes = episodes;
            this.provider = provider;
            this.lastAction = lastAction;
        }

        static RecoveryResult success(int attempt, String stage, String provider, List<Episode> episodes, Map<String, Object> action) {
            List<RecoveryAction> actions = new ArrayList<>();
            RecoveryAction ra = new RecoveryAction(attempt, stage, provider, true, null, System.currentTimeMillis());
            actions.add(ra);
            Map<String, Object> logMap = new LinkedHashMap<>();
            logMap.put("finalStage", stage);
            logMap.put("provider", provider);
            logMap.put("episodeCount", episodes != null ? episodes.size() : 0);
            return new RecoveryResult(true, attempt, actions, logMap, 0, episodes, provider, ra);
        }

        static RecoveryResult failure(int attempts, List<RecoveryAction> actions, Map<String, Object> recoveryLog, long totalDurationMs) {
            RecoveryAction last = actions.isEmpty() ? null : actions.get(actions.size() - 1);
            return new RecoveryResult(false, attempts, actions, recoveryLog, totalDurationMs, null, null, last);
        }

        static RecoveryResult failedAction(int attempt, String stage, String error, long durationMs) {
            List<RecoveryAction> actions = new ArrayList<>();
            RecoveryAction ra = new RecoveryAction(attempt, stage, null, false, error, durationMs);
            actions.add(ra);
            Map<String, Object> logMap = new LinkedHashMap<>();
            logMap.put("stage", stage);
            logMap.put("error", error);
            return new RecoveryResult(false, attempt, actions, logMap, durationMs, null, null, ra);
        }

        public Map<String, Object> asMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("success", success);
            m.put("attempts", attempts);
            if (lastAction != null) m.put("lastAction", lastAction.stage);
            if (provider != null) m.put("provider", provider);
            return m;
        }
    }

    public static class RecoveryAction {
        public final int attempt;
        public final String stage;
        public final String provider;
        public final boolean success;
        public final String error;
        public final long durationMs;

        RecoveryAction(int attempt, String stage, String provider, boolean success, String error, long durationMs) {
            this.attempt = attempt;
            this.stage = stage;
            this.provider = provider;
            this.success = success;
            this.error = error;
            this.durationMs = durationMs;
        }
    }
}
