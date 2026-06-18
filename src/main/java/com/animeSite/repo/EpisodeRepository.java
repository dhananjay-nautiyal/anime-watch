package com.animeSite.repo;

import com.animeSite.persist.Episode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EpisodeRepository extends JpaRepository<Episode, UUID> {
    List<Episode> findByAnimeMalIdOrderByEpisodeNumberAsc(Integer animeMalId);
    Optional<Episode> findByAnimeMalIdAndEpisodeNumber(Integer animeMalId, Integer episodeNumber);
    void deleteByAnimeMalId(Integer animeMalId);
}
