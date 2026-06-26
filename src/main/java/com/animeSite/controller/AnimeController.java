package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.model.ReviewRequest;
import com.animeSite.persist.Anime;
import com.animeSite.persist.Review;
import com.animeSite.persist.User;
import java.util.UUID;
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

@RestController
@RequestMapping("/api/anime")
@Tag(name = "Anime", description = "Public anime endpoints")
public class AnimeController {

    private final AnimeService animeService;
    private final ReviewService reviewService;
    private final UserRepository userRepository;

    public AnimeController(AnimeService animeService, ReviewService reviewService,
                           UserRepository userRepository) {
        this.animeService = animeService;
        this.reviewService = reviewService;
        this.userRepository = userRepository;
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
}
