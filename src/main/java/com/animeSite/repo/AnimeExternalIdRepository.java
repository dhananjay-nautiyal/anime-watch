package com.animeSite.repo;

import com.animeSite.persist.AnimeExternalId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AnimeExternalIdRepository extends JpaRepository<AnimeExternalId, UUID> {
}
