package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "studio")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "malId")
public class AnimeStudio {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @Column(unique = true, nullable = false)
    private Integer malId;

    @Column(nullable = false)
    private String name;
}
