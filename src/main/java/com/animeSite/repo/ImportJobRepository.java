package com.animeSite.repo;

import com.animeSite.persist.ImportJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ImportJobRepository extends JpaRepository<ImportJob, UUID> {
    List<ImportJob> findAllByOrderByCreatedAtDesc();
    Optional<ImportJob> findTopByStatusOrderByCreatedAtDesc(ImportJob.ImportStatus status);
    List<ImportJob> findByStatusOrderByCreatedAtDesc(ImportJob.ImportStatus status);
}
