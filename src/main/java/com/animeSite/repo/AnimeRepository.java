package com.animeSite.repo;

import com.animeSite.persist.Anime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnimeRepository extends JpaRepository<Anime, UUID> {
    Optional<Anime> findByMalId(Integer malId);
    boolean existsByMalId(Integer malId);
    java.util.List<Anime> findAllByMalIdIn(java.util.Collection<Integer> malIds);
    Page<Anime> findAllByOrderByRatingDesc(Pageable pageable);
    Page<Anime> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Anime> findByTitleContainingIgnoreCase(String query, Pageable pageable);
}
