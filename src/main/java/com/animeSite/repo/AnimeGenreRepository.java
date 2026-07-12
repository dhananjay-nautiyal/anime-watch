package com.animeSite.repo;

import com.animeSite.persist.AnimeGenre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnimeGenreRepository extends JpaRepository<AnimeGenre, UUID> {
    Optional<AnimeGenre> findByMalId(Integer malId);
    List<AnimeGenre> findAllByMalIdIn(java.util.Collection<Integer> malIds);
}
