package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.httpclient.AnimePaheService;
import com.animeSite.persist.Anime;
import com.animeSite.persist.Episode;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.EpisodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/anime")
public class EpisodeController {

    private static final Logger log = LoggerFactory.getLogger(EpisodeController.class);

    private final EpisodeRepository episodeRepository;
    private final AnimeRepository animeRepository;
    private final AnimePaheService animePaheService;

    public EpisodeController(EpisodeRepository episodeRepository, AnimeRepository animeRepository,
                             AnimePaheService animePaheService) {
        this.episodeRepository = episodeRepository;
        this.animeRepository = animeRepository;
        this.animePaheService = animePaheService;
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
    public ResponseEntity<?> syncEpisodes(@PathVariable int malId) {
        long start = System.currentTimeMillis();
        log.info("[SYNC] POST START | malId={}", malId);

        Anime anime = animeRepository.findByMalId(malId)
                .orElseThrow(() -> {
                    log.error("[SYNC] FAILED | anime not found with malId={}", malId);
                    return new IllegalArgumentException("Anime not found with MAL ID: " + malId);
                });

        log.info("[SYNC] ANIME FOUND | title='{}' existingAnimePaheId={} malId={}",
                anime.getTitle(), anime.getAnimePaheId(), malId);

        Integer animePaheId = anime.getAnimePaheId();
        if (animePaheId == null) {
            log.info("[ANIMEPAHE SEARCH] START | searching for title='{}'", anime.getTitle());
            animePaheId = animePaheService.searchAnime(anime.getTitle());

            if (animePaheId == null) {
                log.warn("[ANIMEPAHE SEARCH] FAILED | using malId={} as fallback ID", malId);
                animePaheId = malId;
            } else {
                log.info("[ANIMEPAHE SEARCH] SUCCESS | animePaheId={}", animePaheId);
            }

            anime.setAnimePaheId(animePaheId);
            animeRepository.save(anime);
            log.info("[SYNC] SAVED | animePaheId={} for malId={}", animePaheId, malId);
        }

        List<Episode> episodes = animePaheService.syncEpisodes(animePaheId, malId);

        long elapsed = System.currentTimeMillis() - start;

        if (episodes.isEmpty()) {
            log.warn("[SYNC] COMPLETE | 0 episodes saved | provider likely unreachable | duration={}ms", elapsed);
            return ResponseEntity.badRequest().body(ApiResponse.error(
                    "Unable to connect to the stream provider. The server cannot reach animepahe.ru (49.44.79.236:443). " +
                    "The provider may be temporarily down, blocked by firewall, or your server's outbound traffic is restricted."));
        }

        int realCount = (int) episodes.stream().filter(e -> e.getEmbedUrl() != null).count();
        log.info("[SYNC] COMPLETE | saved={} real={} placeholder={} duration={}ms",
                episodes.size(), realCount, episodes.size() - realCount, elapsed);

        return ResponseEntity.ok(ApiResponse.success("Episodes synced successfully", episodes));
    }

    @GetMapping("/proxy/animepahe")
    public ResponseEntity<?> proxyAnimePahe(@RequestParam String url) {
        long start = System.currentTimeMillis();
        log.info("[PROXY] START | url={}", url);

        try {
            String lower = url.toLowerCase();
            if (lower.contains("animepahe.ru/play/")) {
                String[] parts = url.substring(url.indexOf("animepahe.ru/play/") + 18).split("/");
                if (parts.length < 2) {
                    log.warn("[PROXY] FAILED | invalid play URL: {}", url);
                    return ResponseEntity.badRequest().body(ApiResponse.error("Invalid URL"));
                }
                log.info("[PROXY] FETCH PLAY PAGE | animePaheId={} session={}", parts[0], parts[1]);
                String html = animePaheService.fetchPlayPage(Integer.parseInt(parts[0]), parts[1]);
                long elapsed = System.currentTimeMillis() - start;
                log.info("[PROXY] SUCCESS | duration={}ms", elapsed);
                return ResponseEntity.ok()
                        .header("Content-Type", "text/html; charset=UTF-8")
                        .body(html);
            }

            log.info("[PROXY] FETCH PAGE | generic={}", url);
            String html = animePaheService.fetchPage(url);
            long elapsed = System.currentTimeMillis() - start;
            log.info("[PROXY] SUCCESS | duration={}ms", elapsed);
            return ResponseEntity.ok()
                    .header("Content-Type", "text/html; charset=UTF-8")
                    .body(html);

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[PROXY] FAILED | type={} msg={} duration={}ms",
                    e.getClass().getSimpleName(), e.getMessage(), elapsed);
            String errorHtml = """
                <html><body style="background:#050816;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;flex-direction:column;gap:12px;text-align:center;padding:20px">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                <h2 style="color:white;font-size:18px;margin:0">Stream Unavailable</h2>
                <p style="margin:0;font-size:14px">Unable to connect to stream provider.</p>
                <p style="margin:0;font-size:12px;opacity:0.7">The server cannot reach the video source. Provider may be down or blocked.</p>
                </body></html>
                """;
            return ResponseEntity.ok()
                    .header("Content-Type", "text/html; charset=UTF-8")
                    .body(errorHtml);
        }
    }

    @PostMapping("/{malId}/episodes/clear")
    public ResponseEntity<ApiResponse<String>> clearEpisodes(@PathVariable int malId) {
        log.info("[CLEAR] clearing episodes for malId={}", malId);
        episodeRepository.deleteByAnimeMalId(malId);
        log.info("[CLEAR] complete for malId={}", malId);
        return ResponseEntity.ok(ApiResponse.success("Episodes cleared"));
    }
}
