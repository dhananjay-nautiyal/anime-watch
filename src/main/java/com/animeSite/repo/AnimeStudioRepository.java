package com.animeSite.repo;

import com.animeSite.persist.AnimeStudio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnimeStudioRepository extends JpaRepository<AnimeStudio, UUID> {
    Optional<AnimeStudio> findByMalId(Integer malId);
    List<AnimeStudio> findAllByMalIdIn(java.util.Collection<Integer> malIds);
}
