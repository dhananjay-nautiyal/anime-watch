package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.httpclient.AnimePaheService;
import com.animeSite.persist.Anime;
import com.animeSite.persist.Episode;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.EpisodeRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/anime")
public class EpisodeController {

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
        List<Episode> episodes = episodeRepository.findByAnimeMalIdOrderByEpisodeNumberAsc(malId);
        return ResponseEntity.ok(ApiResponse.success(episodes));
    }

    @PostMapping("/{malId}/episodes/sync")
    public ResponseEntity<ApiResponse<List<Episode>>> syncEpisodes(@PathVariable int malId) {
        Anime anime = animeRepository.findByMalId(malId)
                .orElseThrow(() -> new IllegalArgumentException("Anime not found with MAL ID: " + malId));

        Integer animePaheId = anime.getAnimePaheId();
        if (animePaheId == null) {
            animePaheId = animePaheService.searchAnime(anime.getTitle());
            if (animePaheId == null) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Could not find this anime on AnimePahe"));
            }
            anime.setAnimePaheId(animePaheId);
            animeRepository.save(anime);
        }

        List<Episode> episodes = animePaheService.syncEpisodes(animePaheId, malId);
        return ResponseEntity.ok(ApiResponse.success("Episodes synced successfully", episodes));
    }

    @GetMapping("/proxy/animepahe")
    public ResponseEntity<?> proxyAnimePahe(@RequestParam String url) {
        try {
            String lower = url.toLowerCase();
            if (lower.contains("animepahe.ru/play/")) {
                String[] parts = url.substring(url.indexOf("animepahe.ru/play/") + 18).split("/");
                if (parts.length < 2) {
                    return ResponseEntity.badRequest().body(ApiResponse.error("Invalid URL"));
                }
                String html = animePaheService.fetchPlayPage(Integer.parseInt(parts[0]), parts[1]);
                return ResponseEntity.ok()
                        .header("Content-Type", "text/html; charset=UTF-8")
                        .body(html);
            }
            String html = animePaheService.fetchPage(url);
            return ResponseEntity.ok()
                    .header("Content-Type", "text/html; charset=UTF-8")
                    .body(html);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to fetch: " + e.getMessage()));
        }
    }

    @PostMapping("/{malId}/episodes/clear")
    public ResponseEntity<ApiResponse<String>> clearEpisodes(@PathVariable int malId) {
        episodeRepository.deleteByAnimeMalId(malId);
        return ResponseEntity.ok(ApiResponse.success("Episodes cleared"));
    }
}
