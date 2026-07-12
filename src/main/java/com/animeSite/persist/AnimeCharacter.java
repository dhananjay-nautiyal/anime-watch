package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "anime_character")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "malId")
public class AnimeCharacter {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @Column(nullable = false)
    private Integer malId;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String imageUrl;

    private String role;
}
