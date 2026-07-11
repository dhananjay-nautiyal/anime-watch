package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "anime_provider_cache", uniqueConstraints = {
    @UniqueConstraint(columnNames = "mal_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AnimeProviderCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "mal_id", nullable = false, unique = true)
    private int malId;

    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    @Column(name = "episode_count")
    private int episodeCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt = Instant.now().plusSeconds(86400);

    @Column(name = "streamable", nullable = false)
    private boolean streamable = false;

    @Column(name = "validated")
    private boolean validated = false;

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public static AnimeProviderCache success(int malId, String provider, int episodeCount) {
        AnimeProviderCache c = new AnimeProviderCache();
        c.malId = malId;
        c.provider = provider;
        c.episodeCount = episodeCount;
        c.streamable = true;
        c.validated = true;
        c.createdAt = Instant.now();
        c.expiresAt = Instant.now().plusSeconds(86400);
        return c;
    }

    public static AnimeProviderCache failure(int malId) {
        AnimeProviderCache c = new AnimeProviderCache();
        c.malId = malId;
        c.provider = "";
        c.episodeCount = 0;
        c.streamable = false;
        c.validated = true;
        c.createdAt = Instant.now();
        c.expiresAt = Instant.now().plusSeconds(300);
        return c;
    }

    public static AnimeProviderCache unvalidated(int malId, String provider, int episodeCount) {
        AnimeProviderCache c = new AnimeProviderCache();
        c.malId = malId;
        c.provider = provider;
        c.episodeCount = episodeCount;
        c.streamable = true;
        c.validated = false;
        c.createdAt = Instant.now();
        c.expiresAt = Instant.now().plusSeconds(300);
        return c;
    }
}
