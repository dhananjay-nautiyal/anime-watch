package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "watch_history", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "mal_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class WatchHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "mal_id", nullable = false)
    private int malId;

    @Column(name = "episode_number", nullable = false)
    private int episodeNumber;

    @Column(name = "progress_seconds")
    private double progressSeconds;

    @Column(name = "duration_seconds")
    private double durationSeconds;

    @Column(name = "anime_title")
    private String animeTitle;

    @Column(name = "anime_image")
    private String animeImage;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
