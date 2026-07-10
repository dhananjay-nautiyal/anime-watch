package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.httpclient.AnimeGogoService;
import com.animeSite.httpclient.AninekoService;
import com.animeSite.persist.Anime;
import com.animeSite.persist.Episode;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.EpisodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/anime")
public class EpisodeController {

    private static final Logger log = LoggerFactory.getLogger(EpisodeController.class);

    private final EpisodeRepository episodeRepository;
    private final AnimeRepository animeRepository;
    private final AninekoService aninekoService;
    private final AnimeGogoService animeGogoService;

    public EpisodeController(EpisodeRepository episodeRepository, AnimeRepository animeRepository,
                             AninekoService aninekoService, AnimeGogoService animeGogoService) {
        this.episodeRepository = episodeRepository;
        this.animeRepository = animeRepository;
        this.aninekoService = aninekoService;
        this.animeGogoService = animeGogoService;
    }

    @GetMapping("/{malId}/episodes")
    public ResponseEntity<ApiResponse<List<Episode>>> getEpisodes(@PathVariable int malId) {
        long start = System.currentTimeMillis();
        log.info("[EPISODES] GET START | malId={}", malId);
        List<Episode> episodes = episodeRepository.findByAnimeMalIdOrderByEpisodeNumberAsc(malId);
        long elapsed = System.currentTimeMillis() - start;
        log.info("[EPISODES] GET COMPLETE | malId={} count={} duration={}ms", malId, episodes.size(), elapsed);
        return ResponseEntity.ok(ApiResponse.success(episodes));
    }

    @PostMapping("/{malId}/episodes/sync")
    @Transactional
    public ResponseEntity<?> syncEpisodes(@PathVariable int malId) {
        long start = System.currentTimeMillis();
        log.info("[SYNC] POST START | malId={}", malId);

        Anime anime = animeRepository.findByMalId(malId)
                .orElseThrow(() -> {
                    log.error("[SYNC] FAILED | anime not found with malId={}", malId);
                    return new IllegalArgumentException("Anime not found with MAL ID: " + malId);
                });

        log.info("[SYNC] ANIME FOUND | title='{}' malId={}", anime.getTitle(), malId);

        List<Episode> episodes = List.of();
        String provider = "Anineko";

        try {
            episodes = aninekoService.fetchEpisodes(anime.getMalId(), anime.getTitle());
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[SYNC] ANINEKO ERROR | title='{}' error='{}' duration={}ms", anime.getTitle(), e.getMessage(), elapsed);
        }

        if (episodes.isEmpty()) {
            log.info("[SYNC] ANINEKO EMPTY | falling back to GoGoAnime...");
            provider = "GoGoAnime";
            try {
                episodes = animeGogoService.fetchEpisodes(anime.getMalId(), anime.getTitle());
            } catch (Exception e) {
                long elapsed = System.currentTimeMillis() - start;
                log.error("[SYNC] BOTH PROVIDERS FAILED | title='{}' error='{}' duration={}ms", anime.getTitle(), e.getMessage(), elapsed);
                return ResponseEntity.ok(ApiResponse.error("PROVIDER_ERROR",
                    "Both streaming providers returned errors: " + e.getMessage()));
            }
        }

        long elapsed = System.currentTimeMillis() - start;

        if (episodes.isEmpty()) {
            log.warn("[SYNC] NO EPISODES | title='{}' duration={}ms", anime.getTitle(), elapsed);
            return ResponseEntity.ok(ApiResponse.error("PROVIDER_NOT_FOUND",
                "No episodes available on streaming providers for \"" + anime.getTitle() + "\" (MAL ID: " + malId + ")."));
        }

        episodeRepository.deleteByAnimeMalId(malId);
        episodeRepository.saveAll(episodes);
        log.info("[SYNC] COMPLETE | provider={} saved {} episodes for '{}' | duration={}ms", provider, episodes.size(), anime.getTitle(), elapsed);

        return ResponseEntity.ok(ApiResponse.success("Episodes synced successfully", episodes));
    }

    @GetMapping("/{malId}/episode/embed")
    public ResponseEntity<?> getEpisodeEmbed(@PathVariable int malId, @RequestParam String episodeUrl) {
        long start = System.currentTimeMillis();
        log.info("[EMBED] GET | malId={} episodeUrl={}", malId, episodeUrl);

        String embedUrl = null;
        String provider;
        String streamType;

        if (episodeUrl.contains("gogoanime")) {
            provider = "GoGoAnime";
            embedUrl = animeGogoService.fetchEmbedUrl(episodeUrl);
            streamType = "iframe";
        } else {
            provider = "Anineko";
            embedUrl = aninekoService.fetchEmbedUrl(episodeUrl);
            streamType = embedUrl != null && embedUrl.contains(".m3u8") ? "hls" : "iframe";
        }

        long elapsed = System.currentTimeMillis() - start;

        if (embedUrl == null) {
            log.warn("[EMBED] FAILED | malId={} provider={} url={} duration={}ms", malId, provider, episodeUrl, elapsed);
            return ResponseEntity.ok(ApiResponse.builder()
                .success(false)
                .message("No stream source found for this episode.")
                .data(Map.of(
                    "provider", provider,
                    "step", "Extract embed url",
                    "reason", "No video source found on episode page",
                    "durationMs", elapsed
                ))
                .timestamp(java.time.Instant.now())
                .build());
        }

        log.info("[EMBED] SUCCESS | provider={} type={} embedUrl={} duration={}ms", provider, streamType, embedUrl, elapsed);
        return ResponseEntity.ok(ApiResponse.builder()
            .success(true)
            .message("Stream source found")
            .data(Map.of(
                "embedUrl", embedUrl,
                "provider", provider,
                "type", streamType
            ))
            .timestamp(java.time.Instant.now())
            .build());
    }

    @PostMapping("/{malId}/episodes/clear")
    public ResponseEntity<ApiResponse<String>> clearEpisodes(@PathVariable int malId) {
        log.info("[CLEAR] clearing episodes for malId={}", malId);
        episodeRepository.deleteByAnimeMalId(malId);
        log.info("[CLEAR] complete for malId={}", malId);
        return ResponseEntity.ok(ApiResponse.success("Episodes cleared"));
    }

    @PostMapping("/episodes/sync-all")
    public ResponseEntity<ApiResponse<Map<String, Object>>> syncAllEpisodes() {
        long start = System.currentTimeMillis();
        log.info("[BULK SYNC] START | fetching all anime from DB");

        List<Anime> allAnime = animeRepository.findAll();
        log.info("[BULK SYNC] total anime in DB: {}", allAnime.size());

        int success = 0;
        int skipped = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (int i = 0; i < allAnime.size(); i++) {
            Anime anime = allAnime.get(i);
            log.info("[BULK SYNC] [{}/{}] processing '{}' (malId={})", i + 1, allAnime.size(), anime.getTitle(), anime.getMalId());
            try {
                episodeRepository.deleteByAnimeMalId(anime.getMalId());
                List<Episode> episodes = aninekoService.fetchEpisodes(anime.getMalId(), anime.getTitle());
                if (episodes.isEmpty()) {
                    episodes = animeGogoService.fetchEpisodes(anime.getMalId(), anime.getTitle());
                }
                if (episodes.isEmpty()) {
                    skipped++;
                    log.warn("[BULK SYNC] no episodes found for '{}'", anime.getTitle());
                } else {
                    episodeRepository.saveAll(episodes);
                    success++;
                    log.info("[BULK SYNC] saved {} episodes for '{}'", episodes.size(), anime.getTitle());
                }
            } catch (Exception e) {
                failed++;
                String msg = String.format("'%s' (malId=%d): %s", anime.getTitle(), anime.getMalId(), e.getMessage());
                errors.add(msg);
                log.error("[BULK SYNC] failed for '{}': {}", anime.getTitle(), e.getMessage());
            }
            try {
                Thread.sleep(1500);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        long elapsed = System.currentTimeMillis() - start;
        Map<String, Object> result = Map.of(
            "total", allAnime.size(),
            "success", success,
            "skipped", skipped,
            "failed", failed,
            "errors", errors,
            "durationMs", elapsed
        );
        log.info("[BULK SYNC] COMPLETE | total={} success={} skipped={} failed={} duration={}ms",
            allAnime.size(), success, skipped, failed, elapsed);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
