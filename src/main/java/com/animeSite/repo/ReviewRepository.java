package com.animeSite.repo;

import com.animeSite.persist.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewRepository extends JpaRepository<Review, UUID> {
    @org.springframework.data.jpa.repository.Query(
        value = "SELECT r FROM Review r JOIN FETCH r.user WHERE r.anime.id = :animeId",
        countQuery = "SELECT COUNT(r) FROM Review r WHERE r.anime.id = :animeId"
    )
    Page<Review> findByAnimeId(UUID animeId, Pageable pageable);
    Optional<Review> findByAnimeIdAndUserId(UUID animeId, UUID userId);
    boolean existsByAnimeIdAndUserId(UUID animeId, UUID userId);
    void deleteByAnimeId(UUID animeId);
}
