package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "related_anime")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RelatedAnime {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "anime_id", nullable = false)
    private Anime anime;

    @Column(name = "relation_type", nullable = false)
    private String relationType;

    @Column(name = "related_mal_id", nullable = false)
    private Integer relatedMalId;

    @Column(name = "related_title")
    private String relatedTitle;

    @Column(name = "related_image_url", columnDefinition = "TEXT")
    private String relatedImageUrl;
}
