package com.animeSite.repo;

import com.animeSite.persist.RelatedAnime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface RelatedAnimeRepository extends JpaRepository<RelatedAnime, UUID> {
}
