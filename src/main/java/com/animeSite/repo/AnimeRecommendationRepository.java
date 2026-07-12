package com.animeSite.repo;

import com.animeSite.persist.AnimeRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AnimeRecommendationRepository extends JpaRepository<AnimeRecommendation, UUID> {
}
