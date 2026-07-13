package com.animeSite.persist;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "import_job", indexes = {
    @Index(name = "idx_import_job_status_created", columnList = "status,created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ImportJob {

    @Id
    @Column(length = 36)
    private UUID id = UUID.randomUUID();

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ImportStatus status = ImportStatus.PENDING;

    @Column(name = "total_items")
    private Integer totalItems;

    @Column(name = "processed_items")
    private Integer processedItems = 0;

    @Column(name = "success_count")
    private Integer successCount = 0;

    @Column(name = "fail_count")
    private Integer failCount = 0;

    @Column(name = "skip_count")
    private Integer skipCount = 0;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String parameters;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum ImportStatus {
        PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
    }
}
