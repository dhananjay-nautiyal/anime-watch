package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "anime_recommendation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AnimeRecommendation {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "anime_id", nullable = false)
    private Anime anime;

    @Column(name = "mal_id", nullable = false)
    private Integer malId;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String imageUrl;

    private Integer votes;
}
