package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.persist.Anime;
import com.animeSite.persist.Episode;
import com.animeSite.pipeline.*;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.EpisodeRepository;
import com.animeSite.persist.User;
import com.animeSite.persist.WatchHistory;
import com.animeSite.repo.UserRepository;
import com.animeSite.service.EpisodeSyncService;
import com.animeSite.service.WatchHistoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/anime")
public class EpisodeController {

    private static final Logger log = LoggerFactory.getLogger(EpisodeController.class);

    private final EpisodeRepository episodeRepository;
    private final AnimeRepository animeRepository;
    private final ProviderResolver providerResolver;
    private final ValidationService validationService;
    private final ProviderHealthMonitor healthMonitor;
    private final EpisodeSyncService episodeSyncService;
    private final WatchHistoryService watchHistoryService;
    private final UserRepository userRepository;
    private final StreamVerificationService streamVerificationService;

    public EpisodeController(EpisodeRepository episodeRepository, AnimeRepository animeRepository,
                             ProviderResolver providerResolver, ValidationService validationService,
                             ProviderHealthMonitor healthMonitor, EpisodeSyncService episodeSyncService,
                             WatchHistoryService watchHistoryService, UserRepository userRepository,
                             StreamVerificationService streamVerificationService) {
        this.episodeRepository = episodeRepository;
        this.animeRepository = animeRepository;
        this.providerResolver = providerResolver;
        this.validationService = validationService;
        this.healthMonitor = healthMonitor;
        this.episodeSyncService = episodeSyncService;
        this.watchHistoryService = watchHistoryService;
        this.userRepository = userRepository;
        this.streamVerificationService = streamVerificationService;
    }

    @GetMapping("/{malId}/episodes")
    public ResponseEntity<ApiResponse<List<Episode>>> getEpisodes(@PathVariable int malId) {
        long start = System.currentTimeMillis();
        log.info("[EPISODES] GET | malId={}", malId);
        List<Episode> episodes = episodeRepository.findByAnimeMalIdOrderByEpisodeNumberAsc(malId);
        long elapsed = System.currentTimeMillis() - start;
        log.info("[EPISODES] GET | malId={} count={} duration={}ms", malId, episodes.size(), elapsed);
        return ResponseEntity.ok(ApiResponse.success(episodes));
    }

    @PostMapping("/{malId}/episodes/sync")
    public ResponseEntity<Map<String, Object>> syncEpisodes(@PathVariable int malId) {
        long start = System.currentTimeMillis();
        log.info("[SYNC] STEP 1: Controller reached | malId={}", malId);
        log.info("[SYNC] STEP 2: Security check passed | endpoint=/api/anime/{}/episodes/sync | CSRF=disabled | auth=permitAll", malId);

        try {
            log.info("[SYNC] STEP 3: Calling EpisodeSyncService.syncEpisodes | malId={}", malId);
            EpisodeSyncService.SyncResult result = episodeSyncService.syncEpisodes(malId);
            log.info("[SYNC] STEP 4: SyncService returned | malId={} status={} provider={} count={}",
                malId, result.status(), result.provider(), result.episodeCount());

            long elapsed = System.currentTimeMillis() - start;

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", result.isSuccess() || result.isComingSoon());
            response.put("status", result.status());
            response.put("message", result.message());
            response.put("durationMs", elapsed);
            response.put("timestamp", Instant.now().toString());

            if (result.provider() != null) response.put("provider", result.provider());
            if (result.episodeCount() > 0) response.put("episodeCount", result.episodeCount());
            if (result.episodes() != null && !result.episodes().isEmpty()) response.put("episodes", result.episodes());
            if (result.providerFailures() != null) response.put("providerFailures", result.providerFailures());

            log.info("[SYNC] STEP 5: Returning HTTP 200 | malId={} status={} provider={} count={} duration={}ms",
                malId, result.status(), result.provider(), result.episodeCount(), elapsed);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[SYNC] EXCEPTION | malId={} type='{}' message='{}' duration={}ms", malId, e.getClass().getName(), e.getMessage(), elapsed, e);
            Map<String, Object> errorResponse = new LinkedHashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("status", "ERROR");
            errorResponse.put("message", e.getMessage());
            errorResponse.put("errorCode", e.getClass().getSimpleName());
            errorResponse.put("durationMs", elapsed);
            errorResponse.put("timestamp", Instant.now().toString());
            return ResponseEntity.ok(errorResponse);
        }
    }

    @GetMapping("/{malId}/episode/languages")
    public ResponseEntity<?> getEpisodeLanguages(@PathVariable int malId, @RequestParam String episodeUrl) {
        long start = System.currentTimeMillis();
        log.info("[LANGUAGES] GET | malId={} episodeUrl={}", malId, episodeUrl);

        ProviderResolver.PipelineResult<List<String>> result =
            providerResolver.resolveLanguages(malId, episodeUrl);

        long elapsed = System.currentTimeMillis() - start;

        if (!result.success || result.data == null || result.data.isEmpty()) {
            log.warn("[LANGUAGES] NONE_FOUND | malId={} duration={}ms", malId, elapsed);
            return ResponseEntity.ok()
                .header("Cache-Control", "no-cache")
                .body(ApiResponse.success(Map.of(
                    "languages", List.of("SUB"),
                    "provider", "fallback",
                    "durationMs", elapsed
                )));
        }

        log.info("[LANGUAGES] FOUND | malId={} languages={} provider={} duration={}ms",
            malId, result.data, result.provider, elapsed);
        return ResponseEntity.ok()
            .header("Cache-Control", "public, max-age=120")
            .body(ApiResponse.builder()
                .success(true)
                .data(Map.of("languages", result.data, "provider", result.provider, "durationMs", elapsed))
                .timestamp(Instant.now())
                .build());
    }

    @GetMapping("/{malId}/episode/embed")
    public ResponseEntity<?> getEpisodeEmbed(@PathVariable int malId, @RequestParam String episodeUrl) {
        long start = System.currentTimeMillis();
        log.info("[EMBED] GET | malId={} episodeUrl={}", malId, episodeUrl);

        ProviderResolver.PipelineResult<StreamResult> result =
            providerResolver.resolveStream(malId, episodeUrl);

        long elapsed = System.currentTimeMillis() - start;

        if (!result.success || result.data == null || !result.data.isSuccess()) {
            String msg = result.data != null ? result.data.getError() : "All providers failed";
            String code = result.errorCode != null ? result.errorCode : "STREAM_RESOLVE_FAILED";
            String userMessage = "Stream is temporarily unavailable. Please try again later.";

            log.warn("[EMBED] FAILED | malId={} code={} msg='{}' duration={}ms", malId, code, msg, elapsed);
            return ResponseEntity.ok(ApiResponse.builder()
                .success(false)
                .message(userMessage)
                .errorCode(code)
                .data(Map.of(
                    "provider", result.provider,
                    "durationMs", elapsed,
                    "detail", msg
                ))
                .timestamp(Instant.now())
                .build());
        }

        StreamResult sr = result.data;
        String providerBaseUrl = getProviderBaseUrl(sr.getProvider());

        String validatedUrl = sr.getPrimaryUrl();
        String streamType = sr.getType();
        if (streamType.equals("hls") && validatedUrl != null) {
            ValidationService.StreamValidation sv = validationService.validateStreamUrl(validatedUrl, "embed/malId=" + malId);
            if (!sv.valid) {
                log.warn("[EMBED] HLS_VALIDATION_FAILED | url={} error={} | trying backup servers", validatedUrl, sv.errorCode);
                for (StreamResult.ServerOption backup : sr.getServers()) {
                    if (backup.isBackup) {
                        log.info("[EMBED] TRYING_BACKUP | url={}", backup.url);
                        validatedUrl = backup.url;
                        streamType = backup.url.contains(".m3u8") ? "hls" : "iframe";
                        ValidationService.StreamValidation backupSv =
                            validationService.validateStreamUrl(validatedUrl, "embed/backup/" + sr.getProvider());
                        if (backupSv.valid) break;
                    }
                }
            }
        }

        if (validatedUrl != null) {
            validatedUrl = "iframe".equalsIgnoreCase(streamType)
                ? validatedUrl
                : toProxyUrl(validatedUrl, providerBaseUrl);
        }

        if (streamType == null) streamType = "hls";
        final String finalStreamType = streamType;

        List<Map<String, Object>> serverList = sr.getServers().stream()
            .map(s -> {
                String embedUrl = "iframe".equalsIgnoreCase(finalStreamType)
                    ? s.url
                    : toProxyUrl(s.url, providerBaseUrl);
                return Map.<String, Object>of(
                    "url", embedUrl,
                    "label", s.label,
                    "isBackup", s.isBackup
                );
            })
            .collect(Collectors.toList());

        log.info("[EMBED] SUCCESS | malId={} provider={} type={} servers={} duration={}ms",
            malId, sr.getProvider(), streamType, serverList.size(), elapsed);
        return ResponseEntity.ok()
            .header("Cache-Control", "public, max-age=300")
            .body(ApiResponse.builder()
                .success(true)
                .message("Stream source resolved from " + sr.getProvider())
                .data(Map.of(
                    "embedUrl", validatedUrl,
                    "type", streamType,
                    "provider", sr.getProvider(),
                    "servers", serverList,
                    "attempts", result.attempts,
                    "providerFailover", result.attempts,
                    "durationMs", elapsed
                ))
                .timestamp(Instant.now())
                .build());
    }

    @GetMapping("/{malId}/episode/streams")
    public ResponseEntity<?> getEpisodeStreams(
            @PathVariable int malId,
            @RequestParam String episodeUrl,
            @RequestParam(required = false) String language) {
        long start = System.currentTimeMillis();
        log.info("[STREAMS] GET | malId={} episodeUrl={} language={}", malId, episodeUrl, language);

        ProviderResolver.PipelineResult<StreamResult> result =
            providerResolver.resolveStream(malId, episodeUrl);

        if (!result.success || result.data == null || !result.data.isSuccess()) {
            String msg = result.data != null ? result.data.getError() : "All providers failed";
            log.warn("[STREAMS] FAILED | malId={} msg='{}'", malId, msg);
            return ResponseEntity.ok(ApiResponse.error(
                result.errorCode != null ? result.errorCode : "STREAM_RESOLVE_FAILED",
                "Stream is temporarily unavailable. Please try again later."));
        }

        StreamResult sr = result.data;
        String providerBaseUrl = getProviderBaseUrl(sr.getProvider());
        String streamType = sr.getType();
        if (streamType == null) streamType = "hls";

        List<StreamsResponse.ServerInfo> verifiedServers = new ArrayList<>();
        for (StreamResult.ServerOption server : sr.getServers()) {
            long verifyStart = System.currentTimeMillis();
            String proxyUrl = "iframe".equalsIgnoreCase(streamType)
                ? server.url
                : toProxyUrl(server.url, providerBaseUrl);
            String status = "unknown";
            boolean verified = false;
            long latencyMs = 0;

            try {
                var verifResult = streamVerificationService.verify(
                    StreamResult.success(sr.getProvider(), streamType, List.of(server)),
                    providerBaseUrl);
                latencyMs = System.currentTimeMillis() - verifyStart;
                if (verifResult.valid()) {
                    status = "online";
                    verified = true;
                } else {
                    status = "offline";
                }
            } catch (Exception e) {
                latencyMs = System.currentTimeMillis() - verifyStart;
                status = "error";
            }

            verifiedServers.add(new StreamsResponse.ServerInfo(
                server.label, server.url, proxyUrl,
                List.of("1080p", "720p", "480p"),
                List.of(),
                List.of(),
                status, latencyMs, verified
            ));
        }

        verifiedServers.sort((a, b) -> {
            if (a.isVerified() && !b.isVerified()) return -1;
            if (!a.isVerified() && b.isVerified()) return 1;
            return Long.compare(a.getLatencyMs(), b.getLatencyMs());
        });

        // Dynamically split servers into SUB/DUB language groups based on labels
        List<StreamsResponse.ServerInfo> subServers = new ArrayList<>();
        List<StreamsResponse.ServerInfo> dubServers = new ArrayList<>();
        for (StreamsResponse.ServerInfo server : verifiedServers) {
            String label = server.getLabel() != null ? server.getLabel().toLowerCase() : "";
            if (label.contains("dub") || label.contains("english")) {
                dubServers.add(server);
            } else {
                subServers.add(server);
            }
        }
        List<StreamsResponse.LanguageGroup> languages = new ArrayList<>();
        if (!subServers.isEmpty() && (language == null || language.equalsIgnoreCase("SUB"))) {
            languages.add(new StreamsResponse.LanguageGroup("SUB", subServers));
        }
        if (!dubServers.isEmpty() && (language == null || language.equalsIgnoreCase("DUB"))) {
            languages.add(new StreamsResponse.LanguageGroup("DUB", dubServers));
        }
        // Fallback: if no language-specific split was possible, put all under SUB
        if (languages.isEmpty() && !verifiedServers.isEmpty()) {
            languages.add(new StreamsResponse.LanguageGroup("SUB", verifiedServers));
        }

        StreamsResponse response = new StreamsResponse(
            sr.getProvider(), streamType, languages);

        log.info("[STREAMS] SUCCESS | malId={} provider={} servers={} verified={} languages={} duration={}ms",
            malId, sr.getProvider(), verifiedServers.size(),
            verifiedServers.stream().filter(StreamsResponse.ServerInfo::isVerified).count(),
            languages.stream().map(StreamsResponse.LanguageGroup::getLanguage).collect(Collectors.toList()),
            System.currentTimeMillis() - start);

        return ResponseEntity.ok()
            .header("Cache-Control", "public, max-age=120")
            .body(ApiResponse.success(response));
    }

    private String toProxyUrl(String url, String referer) {
        try {
            return "/api/stream/proxy?url=" + URLEncoder.encode(url, "UTF-8")
                + "&referer=" + URLEncoder.encode(referer != null ? referer : "https://anineko.to/", "UTF-8");
        } catch (UnsupportedEncodingException e) {
            return url;
        }
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

    @PostMapping("/{malId}/episodes/clear")
    public ResponseEntity<ApiResponse<String>> clearEpisodes(@PathVariable int malId) {
        log.info("[CLEAR] clearing episodes for malId={}", malId);
        episodeRepository.deleteByAnimeMalId(malId);
        providerResolver.invalidateCache(malId);
        return ResponseEntity.ok(ApiResponse.success("Episodes and cache cleared"));
    }

    @PostMapping("/episodes/sync-all")
    public ResponseEntity<ApiResponse<Map<String, Object>>> syncAllEpisodes() {
        long start = System.currentTimeMillis();
        log.info("[BULK SYNC] START");

        List<Anime> allAnime = animeRepository.findAll();
        log.info("[BULK SYNC] total anime: {}", allAnime.size());

        int success = 0;
        int skipped = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (int i = 0; i < allAnime.size(); i++) {
            Anime anime = allAnime.get(i);
            log.info("[BULK SYNC] [{}/{}] '{}' (malId={})", i + 1, allAnime.size(), anime.getTitle(), anime.getMalId());
            try {
                episodeRepository.deleteByAnimeMalId(anime.getMalId());

                var result = providerResolver.resolveEpisodes(anime.getMalId(), anime.getTitle());

                if (result.success && result.data != null && !result.data.isEmpty()) {
                    List<Episode> valid = validationService.validateEpisodes(result.data, "bulk/" + anime.getMalId());
                    if (!valid.isEmpty()) {
                        episodeRepository.saveAll(valid);
                        success++;
                    } else {
                        skipped++;
                    }
                } else {
                    skipped++;
                }
            } catch (Exception e) {
                failed++;
                errors.add(String.format("'%s' (%d): %s", anime.getTitle(), anime.getMalId(), e.getMessage()));
            }
            try { Thread.sleep(1500); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); break; }
        }

        healthMonitor.logHealthReport();

        long elapsed = System.currentTimeMillis() - start;
        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "total", allAnime.size(),
            "success", success,
            "skipped", skipped,
            "failed", failed,
            "errors", errors,
            "durationMs", elapsed
        )));
    }

    @GetMapping("/episodes/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getHealth() {
        List<String> healthy = healthMonitor.getHealthyProviders();
        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "healthyProviders", healthy,
            "report", "Check logs for full provider health report"
        )));
    }

    @GetMapping("/{malId}/streamable")
    public ResponseEntity<?> isStreamable(@PathVariable int malId) {
        long start = System.currentTimeMillis();
        String provider = providerResolver.getCachedProviderForAnime(malId);
        boolean streamable = provider != null;

        if (!streamable) {
            Anime anime = animeRepository.findByMalId(malId).orElse(null);
            if (anime != null) {
                var result = providerResolver.resolveEpisodes(malId, anime.getTitle());
                streamable = result.success && result.data != null && !result.data.isEmpty();
                provider = result.provider;
            }
        }

        return ResponseEntity.ok(ApiResponse.builder()
            .success(true)
            .message(streamable ? "Streamable" : "Not streamable")
            .data(Map.of(
                "malId", malId,
                "streamable", streamable,
                "provider", provider != null ? provider : "none",
                "durationMs", System.currentTimeMillis() - start
            ))
            .timestamp(Instant.now())
            .build());
    }

    @GetMapping("/streamable")
    public ResponseEntity<?> getStreamable(@RequestParam String ids) {
        long start = System.currentTimeMillis();
        String[] idArr = ids.split(",");
        List<Map<String, Object>> results = new ArrayList<>();

        for (String idStr : idArr) {
            try {
                int malId = Integer.parseInt(idStr.trim());
                String provider = providerResolver.getCachedProviderForAnime(malId);
                boolean streamable = provider != null;
                results.add(Map.of("malId", malId, "streamable", streamable, "provider", provider != null ? provider : "none"));
            } catch (NumberFormatException ignored) {}
        }

        log.info("[STREAMABLE] BATCH | requested={} returned={} duration={}ms", idArr.length, results.size(), System.currentTimeMillis() - start);
        return ResponseEntity.ok(ApiResponse.success(results));
    }

    // ========================================================================
    // Resume Playback API
    // ========================================================================

    @GetMapping("/{malId}/resume")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getResume(@PathVariable int malId, Authentication auth) {
        if (auth == null) {
            return ResponseEntity.ok(ApiResponse.success(Map.of("available", false)));
        }
        String email = auth.getName();
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.ok(ApiResponse.success(Map.of("available", false)));
        }
        Optional<WatchHistory> history = watchHistoryService.getProgress(user.getId(), malId);
        if (history.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success(Map.of("available", false)));
        }
        WatchHistory h = history.get();
        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "available", true,
            "episodeNumber", h.getEpisodeNumber(),
            "progressSeconds", h.getProgressSeconds(),
            "durationSeconds", h.getDurationSeconds(),
            "updatedAt", h.getUpdatedAt().toString()
        )));
    }

    @PostMapping("/{malId}/resume")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveResume(
            @PathVariable int malId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        if (auth == null) {
            return ResponseEntity.ok(ApiResponse.error("AUTH_REQUIRED", "Login required to save progress"));
        }
        String email = auth.getName();
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.ok(ApiResponse.error("USER_NOT_FOUND", "User not found"));
        }

        int episodeNumber = body.get("episodeNumber") instanceof Number n ? n.intValue() : 1;
        double progressSeconds = body.get("progressSeconds") instanceof Number n ? n.doubleValue() : 0.0;
        double durationSeconds = body.get("durationSeconds") instanceof Number n ? n.doubleValue() : 0.0;
        String animeTitle = (String) body.getOrDefault("animeTitle", "");
        String animeImage = (String) body.getOrDefault("animeImage", "");

        watchHistoryService.saveProgress(user.getId(), malId, episodeNumber, progressSeconds, durationSeconds, animeTitle, animeImage);

        log.info("[RESUME] Saved | userId={} malId={} episode={} progress={}s", user.getId(), malId, episodeNumber, Math.round(progressSeconds));
        return ResponseEntity.ok(ApiResponse.success(Map.of("saved", true)));
    }

    @GetMapping("/continue-watching")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getContinueWatching(Authentication auth) {
        if (auth == null) {
            return ResponseEntity.ok(ApiResponse.success(List.of()));
        }
        String email = auth.getName();
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.ok(ApiResponse.success(List.of()));
        }

        List<WatchHistory> history = watchHistoryService.getRecentHistory(user.getId(), 20);
        List<Map<String, Object>> result = history.stream().map(h -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("malId", h.getMalId());
            m.put("slug", animeRepository.findByMalId(h.getMalId()).map(Anime::getSlug).orElse(null));
            m.put("episodeNumber", h.getEpisodeNumber());
            m.put("progressSeconds", h.getProgressSeconds());
            m.put("durationSeconds", h.getDurationSeconds());
            m.put("animeTitle", h.getAnimeTitle());
            m.put("animeImage", h.getAnimeImage());
            m.put("updatedAt", h.getUpdatedAt().toString());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
