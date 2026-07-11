package com.animeSite.repo;

import com.animeSite.persist.AnimeProviderCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AnimeProviderCacheRepository extends JpaRepository<AnimeProviderCache, Long> {
    Optional<AnimeProviderCache> findByMalId(int malId);
    void deleteByMalId(int malId);
}
