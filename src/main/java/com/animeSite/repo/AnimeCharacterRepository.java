package com.animeSite.repo;

import com.animeSite.persist.AnimeCharacter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnimeCharacterRepository extends JpaRepository<AnimeCharacter, UUID> {
    Optional<AnimeCharacter> findByMalId(Integer malId);
}
