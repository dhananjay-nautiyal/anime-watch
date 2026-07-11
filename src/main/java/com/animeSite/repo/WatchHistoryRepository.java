package com.animeSite.repo;

import com.animeSite.persist.WatchHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WatchHistoryRepository extends JpaRepository<WatchHistory, UUID> {
    Optional<WatchHistory> findByUserIdAndMalId(UUID userId, int malId);
    List<WatchHistory> findByUserIdOrderByUpdatedAtDesc(UUID userId);
    void deleteByUserIdAndMalId(UUID userId, int malId);
}
