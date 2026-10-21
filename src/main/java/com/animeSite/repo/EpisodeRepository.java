package com.animeSite.repo;

import com.animeSite.persist.Episode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EpisodeRepository extends JpaRepository<Episode, UUID> {
    List<Episode> findByAnimeMalIdOrderByEpisodeNumberAsc(Integer animeMalId);
    Optional<Episode> findByAnimeMalIdAndEpisodeNumber(Integer animeMalId, Integer episodeNumber);
    void deleteByAnimeMalId(Integer animeMalId);

    List<Episode> findAllByAnimeMalIdAndEpisodeNumber(Integer animeMalId, Integer episodeNumber);

    /** (animeMalId, episodeNumber) pairs that exist more than once. */
    @Query("SELECT e.animeMalId, e.episodeNumber FROM Episode e "
        + "GROUP BY e.animeMalId, e.episodeNumber HAVING COUNT(e.id) > 1")
    List<Object[]> findDuplicateEpisodeKeys();
}
