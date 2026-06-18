package com.animeSite.persist;

import com.animeSite.core.audit.Auditable;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.UUID;

@Entity
@Table(name = "episodes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Episode extends Auditable {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @Column(nullable = false)
    private Integer animeMalId;

    @Column(nullable = false)
    private Integer episodeNumber;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String embedUrl;

    @Column(columnDefinition = "TEXT")
    private String videoUrl;

}
