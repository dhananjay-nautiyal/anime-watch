package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "import_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ImportLog {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private ImportJob job;

    @Column(name = "mal_id")
    private Integer malId;

    private String title;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ImportRecordStatus status;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum ImportRecordStatus {
        SUCCESS, SKIPPED, FAILED
    }
}
