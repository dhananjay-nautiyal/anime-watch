package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.persist.Anime;
import com.animeSite.persist.User;
import com.animeSite.repo.UserRepository;
import com.animeSite.service.AnimeService;
import com.animeSite.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@Tag(name = "Admin", description = "Admin-only endpoints")
public class AdminController {

    private final AnimeService animeService;
    private final ReviewService reviewService;
    private final UserRepository userRepository;

    public AdminController(AnimeService animeService, ReviewService reviewService,
                           UserRepository userRepository) {
        this.animeService = animeService;
        this.reviewService = reviewService;
        this.userRepository = userRepository;
    }

    @PutMapping("/anime/{id}/affiliate")
    @Operation(summary = "Set affiliate URL", description = "Sets the affiliate link for an anime (Admin only).")
    public ResponseEntity<ApiResponse<Anime>> setAffiliateUrl(
            @Parameter(description = "Anime ID", required = true) @PathVariable UUID id,
            @RequestBody Map<String, String> body) {
        String url = body.get("affiliateUrl");
        if (url == null || url.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("affiliateUrl is required"));
        }
        Anime anime = animeService.updateAffiliateUrl(id, url);
        return ResponseEntity.ok(ApiResponse.success(anime));
    }

    @PostMapping("/anime/import/{malId}")
    @Operation(summary = "Import anime by MAL ID", description = "Fetches an anime from Jikan API by MAL ID and saves it to the database (Admin only).")
    public ResponseEntity<ApiResponse<Anime>> importAnimeByMalId(
            @Parameter(description = "MyAnimeList ID", required = true) @PathVariable int malId) {
        Anime anime = animeService.addAnimeByMalId(malId);
        return ResponseEntity.ok(ApiResponse.success("Anime imported successfully", anime));
    }

    @PostMapping("/anime/import/trending")
    @Operation(summary = "Import trending anime", description = "Fetches top anime from Jikan API and saves them to the database (Admin only).")
    public ResponseEntity<ApiResponse<List<Anime>>> importTrending(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page) {
        List<Anime> imported = animeService.importTrendingAnime(page);
        return ResponseEntity.ok(ApiResponse.success("Imported " + imported.size() + " trending anime", imported));
    }

    @PostMapping("/anime/import/seasonal")
    @Operation(summary = "Import seasonal anime", description = "Fetches current seasonal anime from Jikan API and saves them to the database (Admin only).")
    public ResponseEntity<ApiResponse<List<Anime>>> importSeasonal(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page) {
        List<Anime> imported = animeService.importSeasonalAnime(page);
        return ResponseEntity.ok(ApiResponse.success("Imported " + imported.size() + " seasonal anime", imported));
    }

    @DeleteMapping("/anime/{id}")
    @Operation(summary = "Delete anime", description = "Deletes an anime and cascades reviews, watchlist, and favorites (Admin only).")
    public ResponseEntity<ApiResponse<String>> deleteAnime(
            @Parameter(description = "Anime ID", required = true) @PathVariable UUID id) {
        animeService.deleteAnime(id);
        return ResponseEntity.ok(ApiResponse.success("Anime deleted successfully"));
    }

    @DeleteMapping("/review/{id}")
    @Operation(summary = "Delete review", description = "Deletes any review by ID (Admin only).")
    public ResponseEntity<ApiResponse<String>> deleteReview(
            @Parameter(description = "Review ID", required = true) @PathVariable UUID id) {
        reviewService.deleteReview(id);
        return ResponseEntity.ok(ApiResponse.success("Review deleted successfully"));
    }

    @GetMapping("/users")
    @Operation(summary = "List all users", description = "Returns all registered users (Admin only).")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listUsers() {
        List<User> users = userRepository.findAll();
        List<Map<String, Object>> result = users.stream().map(u -> Map.<String, Object>of(
                "id", u.getId(),
                "name", u.getName(),
                "email", u.getEmail(),
                "role", u.getRole().name(),
                "verified", u.isVerified(),
                "createdAt", u.getCreatedAt()
        )).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/users/{id}")
    @Operation(summary = "Delete user", description = "Deletes a user account (Admin only).")
    public ResponseEntity<ApiResponse<String>> deleteUser(
            @Parameter(description = "User ID", required = true) @PathVariable UUID id) {
        userRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success("User deleted successfully"));
    }
}
