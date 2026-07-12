package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "anime_external_id")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AnimeExternalId {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "anime_id", nullable = false)
    private Anime anime;

    @Column(nullable = false)
    private String site;

    @Column(columnDefinition = "TEXT")
    private String url;

    @Column(name = "external_id")
    private String externalId;
}
