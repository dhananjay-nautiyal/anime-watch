package com.animeSite.persist;

import com.animeSite.core.audit.Auditable;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.ArrayList;
import java.util.List;
import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "anime", indexes = {
    @Index(name = "idx_anime_title", columnList = "title"),
    @Index(name = "idx_anime_rating", columnList = "rating"),
    @Index(name = "idx_anime_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Schema(description = "Anime entity mapped to the MySQL database")
public class Anime extends Auditable implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(length = 36)
    @Schema(description = "UUID primary key", example = "550e8400-e29b-41d4-a716-446655440000")
    private UUID id = UUID.randomUUID();

    @Column(unique = true, nullable = false)
    @Schema(description = "MyAnimeList ID", example = "21")
    private Integer malId;

    @Column(nullable = false)
    @Schema(description = "Anime title", example = "One Piece")
    private String title;

    @Column(columnDefinition = "TEXT")
    @Schema(description = "Plot synopsis", example = "Monkey D. Luffy sets off on an adventure...")
    private String synopsis;

    @Schema(description = "Average rating score", example = "8.7")
    private Double rating;

    @Schema(description = "Number of episodes", example = "24")
    private Integer episodes;

    @Schema(description = "YouTube trailer URL", example = "https://www.youtube.com/watch?v=...")
    private String trailerUrl;

    @Schema(description = "Anime poster image URL", example = "https://cdn.myanimelist.net/images/...")
    private String imageUrl;

    @Schema(description = "Affiliate / referral link (manually set)", example = "https://www.crunchyroll.com/series/...")
    private String affiliateUrl;

    @Column(columnDefinition = "TEXT")
    @Schema(description = "YouTube trailer embed URL", example = "https://www.youtube.com/embed/...")
    private String trailerEmbedUrl;

    @Transient
    @Schema(description = "Anime type (TV, Movie, OVA, etc.)", example = "TV")
    private String type;

    @Transient
    @Schema(description = "Airing status", example = "Finished Airing")
    private String status;

    @Transient
    @Schema(description = "Release year", example = "2022")
    private Integer year;

    @Transient
    @Schema(description = "Episode duration", example = "24 min per ep")
    private String duration;

    @Transient
    @Schema(description = "Aired date range string", example = "Apr 9, 2022 to Jun 25, 2022")
    private String aired;

    @Transient
    @Schema(description = "List of genres")
    private List<com.animeSite.model.JikanAnimeData.Genre> genres = new ArrayList<>();

    @Transient
    @Schema(description = "List of studios")
    private List<com.animeSite.model.JikanAnimeData.Studio> studios = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Review> reviews = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Watchlist> watchlistEntries = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Favorites> favorites = new ArrayList<>();
}
