package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "producer")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "malId")
public class AnimeProducer {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @Column(unique = true, nullable = false)
    private Integer malId;

    @Column(nullable = false)
    private String name;
}
