package com.animeSite.repo;

import com.animeSite.persist.ImportLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ImportLogRepository extends JpaRepository<ImportLog, UUID> {
    List<ImportLog> findByJobIdOrderByCreatedAtDesc(UUID jobId);
    Page<ImportLog> findByJobIdAndStatus(UUID jobId, ImportLog.ImportRecordStatus status, Pageable pageable);
    long countByJobIdAndStatus(UUID jobId, ImportLog.ImportRecordStatus status);
}
