package com.animeSite.repo;

import com.animeSite.persist.AnimeTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnimeTagRepository extends JpaRepository<AnimeTag, UUID> {
    Optional<AnimeTag> findByName(String name);
}
