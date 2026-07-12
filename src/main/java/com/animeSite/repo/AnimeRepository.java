package com.animeSite.repo;

import com.animeSite.persist.Anime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnimeRepository extends JpaRepository<Anime, UUID> {
    Optional<Anime> findByMalId(Integer malId);
    Optional<Anime> findBySlug(String slug);
    boolean existsByMalId(Integer malId);
    boolean existsBySlug(String slug);
    List<Anime> findAllByMalIdIn(Collection<Integer> malIds);
    Page<Anime> findAllByOrderByRatingDesc(Pageable pageable);
    Page<Anime> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Anime> findByTitleContainingIgnoreCase(String query, Pageable pageable);

    @Query("SELECT a FROM Anime a WHERE " +
           "LOWER(a.title) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(a.titleEnglish) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(a.titleJapanese) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(a.titleSynonyms) LIKE LOWER(CONCAT('%', :q, '%'))")
    Page<Anime> searchByTitle(@Param("q") String query, Pageable pageable);

    Page<Anime> findByTypeIgnoreCase(String type, Pageable pageable);
    Page<Anime> findByStatusIgnoreCase(String status, Pageable pageable);
    Page<Anime> findByYear(Integer year, Pageable pageable);
    Page<Anime> findBySeasonIgnoreCaseAndYear(String season, Integer year, Pageable pageable);

    @Query("SELECT a FROM Anime a WHERE a.score >= :minScore")
    Page<Anime> findByMinScore(@Param("minScore") double minScore, Pageable pageable);

    @Query("SELECT a FROM Anime a JOIN a.animeGenres g WHERE g.malId IN :genreIds")
    Page<Anime> findByGenreIds(@Param("genreIds") Collection<Integer> genreIds, Pageable pageable);

    @Query("SELECT a FROM Anime a JOIN a.animeGenres g WHERE g.malId IN :genreIds AND a.type = :type")
    Page<Anime> findByGenreIdsAndType(@Param("genreIds") Collection<Integer> genreIds,
                                       @Param("type") String type, Pageable pageable);

    @Query("SELECT a FROM Anime a JOIN a.animeStudios s WHERE s.malId = :studioId")
    Page<Anime> findByStudioId(@Param("studioId") Integer studioId, Pageable pageable);

    List<Anime> findTop10ByOrderByScoreDesc();
    List<Anime> findTop10ByOrderByPopularityAsc();
    List<Anime> findByImportedAtIsNull();
}
