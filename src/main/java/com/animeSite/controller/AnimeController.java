package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.ReviewRequest;
import com.animeSite.persist.Anime;
import com.animeSite.persist.Review;
import com.animeSite.persist.User;
import java.util.UUID;
import com.animeSite.pipeline.AnimeMatcherV2;
import com.animeSite.pipeline.AnimeState;
import com.animeSite.pipeline.ReleaseDetector;
import com.animeSite.repo.UserRepository;
import com.animeSite.service.AnimeService;
import com.animeSite.service.AnimeService.AnimePage;
import com.animeSite.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping("/api/anime")
@Tag(name = "Anime", description = "Public anime endpoints")
public class AnimeController {

    private final AnimeService animeService;
    private final ReviewService reviewService;
    private final UserRepository userRepository;
    private final ReleaseDetector releaseDetector;

    public AnimeController(AnimeService animeService, ReviewService reviewService,
                           UserRepository userRepository, ReleaseDetector releaseDetector) {
        this.animeService = animeService;
        this.reviewService = reviewService;
        this.userRepository = userRepository;
        this.releaseDetector = releaseDetector;
    }

    @GetMapping("/trending")
    @Operation(summary = "Get trending anime", description = "Fetches top-rated anime with pagination.")
    public ResponseEntity<ApiResponse<java.util.List<Anime>>> getTrending(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "25") int size) {
        AnimePage result = animeService.getTrending(page);
        return ResponseEntity.ok(ApiResponse.success(result.animeList(), result.page(), result.totalPages()));
    }

    @GetMapping("/search")
    @Operation(summary = "Search anime by name", description = "Searches anime with pagination.")
    public ResponseEntity<ApiResponse<java.util.List<Anime>>> searchAnime(
            @Parameter(description = "Anime title to search for", required = true) @RequestParam String q,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "25") int size) {
        if (q == null || q.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Search query 'q' must not be empty"));
        }
        AnimePage result = animeService.searchAnime(q, page);
        return ResponseEntity.ok(ApiResponse.success(result.animeList(), result.page(), result.totalPages()));
    }

    @GetMapping("/filter")
    @Operation(summary = "Filter anime", description = "Filter anime by genres, type, status, etc.")
    public ResponseEntity<ApiResponse<java.util.List<Anime>>> filterAnime(
            @Parameter(description = "Genre IDs (comma-separated)") @RequestParam(required = false) String genres,
            @Parameter(description = "Genre IDs to exclude (comma-separated)") @RequestParam(required = false) String genresExclude,
            @Parameter(description = "Type (tv, movie, ova, special, ona, music)") @RequestParam(required = false) String type,
            @Parameter(description = "Status (airing, complete, upcoming)") @RequestParam(required = false) String status,
            @Parameter(description = "Order by (title, score, episodes, start_date, end_date)") @RequestParam(required = false) String orderBy,
            @Parameter(description = "Sort direction (asc, desc)") @RequestParam(required = false) String sort,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "25") int size) {
        AnimePage result = animeService.filterAnime(genres, genresExclude, type, status, orderBy, sort, page);
        return ResponseEntity.ok(ApiResponse.success(result.animeList(), result.page(), result.totalPages()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get anime by ID", description = "Fetches anime detail by MyAnimeList ID.")
    public ResponseEntity<ApiResponse<Anime>> getAnimeById(
            @Parameter(description = "MyAnimeList ID", required = true) @PathVariable int id) {
        Anime anime = animeService.getAnimeById(id);
        return ResponseEntity.ok(ApiResponse.success(anime));
    }

    @GetMapping("/slug/{slug}")
    @Operation(summary = "Get anime by slug", description = "Fetches anime detail by URL-friendly slug.")
    public ResponseEntity<ApiResponse<Anime>> getAnimeBySlug(
            @Parameter(description = "URL-friendly slug", required = true) @PathVariable String slug) {
        Anime anime = animeService.getAnimeBySlug(slug);
        return ResponseEntity.ok(ApiResponse.success(anime));
    }



    @GetMapping("/seasonal")
    @Operation(summary = "Get current seasonal anime", description = "Fetches current season anime with pagination.")
    public ResponseEntity<ApiResponse<java.util.List<Anime>>> getSeasonal(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "25") int size) {
        AnimePage result = animeService.getSeasonal(page);
        return ResponseEntity.ok(ApiResponse.success(result.animeList(), result.page(), result.totalPages()));
    }

    @PostMapping("/{id}/review")
    @Operation(summary = "Add review", description = "Add a star rating and comment for an anime (authenticated, one per user).")
    public ResponseEntity<ApiResponse<Review>> addReview(
            @Parameter(description = "Anime ID", required = true) @PathVariable UUID id,
            @RequestBody ReviewRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Review review = reviewService.addReview(id, user.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(review));
    }

    @GetMapping("/{id}/reviews")
    @Operation(summary = "Get anime reviews", description = "Fetches paginated reviews for an anime.")
    public ResponseEntity<ApiResponse<Page<Review>>> getReviews(
            @Parameter(description = "Anime ID", required = true) @PathVariable UUID id,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size) {
        Page<Review> reviews = reviewService.getReviews(id, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(reviews, reviews.getNumber(), reviews.getTotalPages()));
    }

    @GetMapping("/{id}/state")
    @Operation(summary = "Get anime state", description = "Returns the current state of an anime (COMING_SOON, AIRING, FINISHED, etc.)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAnimeState(@PathVariable int id) {
        ReleaseDetector.AnimeInfo info = releaseDetector.getAnimeInfo(id);
        if (info == null) {
            return ResponseEntity.ok(ApiResponse.success(Map.of(
                "malId", id,
                "state", AnimeState.UNKNOWN.name(),
                "comingSoon", false,
                "released", false
            )));
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("malId", info.malId());
        resp.put("state", info.state().name());
        resp.put("title", info.title());
        resp.put("titleEnglish", info.titleEnglish());
        resp.put("comingSoon", info.state() == AnimeState.COMING_SOON || info.state() == AnimeState.NOT_RELEASED);
        resp.put("released", info.state() == AnimeState.AIRING || info.state() == AnimeState.FINISHED || info.state() == AnimeState.AVAILABLE);
        resp.put("releaseDate", info.releaseDate() != null ? info.releaseDate().toString() : null);
        resp.put("synopsis", info.synopsis());
        resp.put("score", info.score());
        resp.put("episodes", info.episodes());
        resp.put("status", info.status());
        resp.put("type", info.type());
        resp.put("year", info.year());
        resp.put("trailerUrl", info.trailerUrl());
        resp.put("trailerEmbedUrl", info.trailerEmbedUrl());
        resp.put("largeImageUrl", info.largeImageUrl());
        resp.put("imageUrl", info.imageUrl());
        resp.put("genres", info.genres());
        resp.put("studios", info.studios());
        resp.put("duration", info.duration());
        resp.put("aired", info.aired());
        return ResponseEntity.ok(ApiResponse.success(resp));
    }

    @GetMapping("/states")
    @Operation(summary = "Get states for multiple anime", description = "Returns states for multiple anime IDs at once")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAnimeStates(
            @RequestParam String ids) {
        String[] idArr = ids.split(",");
        List<Map<String, Object>> results = new ArrayList<>();
        for (String idStr : idArr) {
            try {
                int malId = Integer.parseInt(idStr.trim());
                AnimeState state = releaseDetector.detectState(malId);
                results.add(Map.of(
                    "malId", malId,
                    "state", state.name(),
                    "comingSoon", state == AnimeState.COMING_SOON || state == AnimeState.NOT_RELEASED,
                    "released", state == AnimeState.AIRING || state == AnimeState.FINISHED || state == AnimeState.AVAILABLE
                ));
            } catch (NumberFormatException ignored) {}
        }
        return ResponseEntity.ok(ApiResponse.success(results));
    }
}
