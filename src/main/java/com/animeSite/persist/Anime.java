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
    @Index(name = "idx_anime_created_at", columnList = "created_at"),
    @Index(name = "idx_anime_status", columnList = "status"),
    @Index(name = "idx_anime_type", columnList = "type"),
    @Index(name = "idx_anime_season_year", columnList = "season,year"),
    @Index(name = "idx_anime_score", columnList = "score"),
    @Index(name = "idx_anime_rank", columnList = "rank")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Schema(description = "Anime entity mapped to the PostgreSQL database")
public class Anime extends Auditable implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(length = 36)
    @Schema(description = "UUID primary key", example = "550e8400-e29b-41d4-a716-446655440000")
    private UUID id = UUID.randomUUID();

    @Column(unique = true, nullable = false)
    @Schema(description = "MyAnimeList ID", example = "21")
    private Integer malId;

    @Column(unique = true)
    @Schema(description = "URL-friendly slug", example = "one-piece")
    private String slug;

    @Column(nullable = false)
    @Schema(description = "Anime title", example = "One Piece")
    private String title;

    @Column(name = "title_english")
    @Schema(description = "English title", example = "One Piece")
    private String titleEnglish;

    @Column(name = "title_japanese")
    @Schema(description = "Japanese title", example = "ONE PIECE")
    private String titleJapanese;

    @Column(name = "title_synonyms", columnDefinition = "TEXT")
    @Schema(description = "Alternative titles (JSON array)")
    private String titleSynonyms;

    @Column(columnDefinition = "TEXT")
    @Schema(description = "Plot synopsis", example = "Monkey D. Luffy sets off on an adventure...")
    private String synopsis;

    @Schema(description = "Average score from MyAnimeList", example = "8.71")
    private Double score;

    @Column(name = "\"rank\"")
    @Schema(description = "Popularity rank on MyAnimeList", example = "45")
    private Integer rank;

    @Schema(description = "Popularity score", example = "123456")
    private Integer popularity;

    @Schema(description = "Number of users who favorited this", example = "50000")
    private Integer favorites;

    @Schema(description = "Number of MAL members", example = "200000")
    private Integer members;

    @Schema(description = "MAL age rating", example = "PG-13")
    private String rating;

    @Schema(description = "Number of episodes", example = "24")
    private Integer episodes;

    @Schema(description = "Anime type (TV, Movie, OVA, etc.)", example = "TV")
    private String type;

    @Schema(description = "Airing status", example = "Finished Airing")
    private String status;

    @Schema(description = "Release year", example = "2022")
    private Integer year;

    @Schema(description = "Season (spring, summer, fall, winter)", example = "spring")
    private String season;

    @Schema(description = "Episode duration", example = "24 min per ep")
    private String duration;

    @Schema(description = "Source material", example = "Manga")
    private String source;

    @Column(columnDefinition = "TEXT")
    @Schema(description = "Aired date range string", example = "Apr 9, 2022 to Jun 25, 2022")
    private String aired;

    @Schema(description = "YouTube trailer URL", example = "https://www.youtube.com/watch?v=...")
    private String trailerUrl;

    @Column(columnDefinition = "TEXT")
    @Schema(description = "YouTube trailer embed URL", example = "https://www.youtube.com/embed/...")
    private String trailerEmbedUrl;

    @Column(columnDefinition = "TEXT")
    @Schema(description = "Anime poster image URL", example = "https://cdn.myanimelist.net/images/...")
    private String imageUrl;

    @Column(name = "banner_url", columnDefinition = "TEXT")
    @Schema(description = "Large banner image URL")
    private String bannerUrl;

    @Column(name = "mal_url", columnDefinition = "TEXT")
    @Schema(description = "MyAnimeList page URL", example = "https://myanimelist.net/anime/21")
    private String malUrl;

    @Column(columnDefinition = "TEXT")
    @Schema(description = "Affiliate / referral link (manually set)", example = "https://www.crunchyroll.com/series/...")
    private String affiliateUrl;

    @Schema(description = "Background/summary of the anime's background")
    @Column(columnDefinition = "TEXT")
    private String background;

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @JoinTable(name = "anime_genres",
        joinColumns = @JoinColumn(name = "anime_id"),
        inverseJoinColumns = @JoinColumn(name = "genre_id"))
    @JsonIgnore
    @Schema(description = "Persistent genre relations")
    private List<AnimeGenre> animeGenres = new ArrayList<>();

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @JoinTable(name = "anime_studios",
        joinColumns = @JoinColumn(name = "anime_id"),
        inverseJoinColumns = @JoinColumn(name = "studio_id"))
    @JsonIgnore
    @Schema(description = "Persistent studio relations")
    private List<AnimeStudio> animeStudios = new ArrayList<>();

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @JoinTable(name = "anime_producers",
        joinColumns = @JoinColumn(name = "anime_id"),
        inverseJoinColumns = @JoinColumn(name = "producer_id"))
    @JsonIgnore
    private List<AnimeProducer> animeProducers = new ArrayList<>();

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @JoinTable(name = "anime_licensors",
        joinColumns = @JoinColumn(name = "anime_id"),
        inverseJoinColumns = @JoinColumn(name = "licensor_id"))
    @JsonIgnore
    private List<AnimeLicensor> animeLicensors = new ArrayList<>();

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @JoinTable(name = "anime_tags",
        joinColumns = @JoinColumn(name = "anime_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id"))
    @JsonIgnore
    private List<AnimeTag> animeTags = new ArrayList<>();

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @JoinTable(name = "anime_characters",
        joinColumns = @JoinColumn(name = "anime_id"),
        inverseJoinColumns = @JoinColumn(name = "character_id"))
    @JsonIgnore
    private List<AnimeCharacter> animeCharacters = new ArrayList<>();

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    @JoinTable(name = "anime_staff",
        joinColumns = @JoinColumn(name = "anime_id"),
        inverseJoinColumns = @JoinColumn(name = "staff_id"))
    @JsonIgnore
    private List<AnimeStaff> animeStaff = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<RelatedAnime> relatedAnime = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<AnimeExternalId> externalIds = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<AnimeTheme> themes = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<AnimeRecommendation> recommendations = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Review> reviews = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Watchlist> watchlistEntries = new ArrayList<>();

    @OneToMany(mappedBy = "anime", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Favorites> favoritesList = new ArrayList<>();

    @Column(name = "imported_at")
    @Schema(description = "When this record was last imported/updated by the import pipeline")
    private java.time.LocalDateTime importedAt;
}
