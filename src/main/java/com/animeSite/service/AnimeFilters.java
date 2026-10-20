package com.animeSite.service;

import com.animeSite.constant.AnimeStatus;
import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeGenre;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.util.UUID;

/**
 * Database-side half of /api/anime/filter. Kept separate from the service so
 * the queries can be exercised against a real schema in tests.
 */
public final class AnimeFilters {

    private AnimeFilters() {
    }

    public static Specification<Anime> build(List<Integer> includeIds, List<Integer> excludeIds,
                                             String type, String status, Integer year) {
        Specification<Anime> spec = Specification.where(null);

        if (includeIds != null) spec = spec.and(genre(includeIds, false));
        if (excludeIds != null) spec = spec.and(genre(excludeIds, true));
        if (type != null && !type.isBlank()) {
            String wanted = type.trim().toLowerCase();
            spec = spec.and((root, query, cb) -> cb.equal(cb.lower(root.get("type")), wanted));
        }
        if (status != null && !status.isBlank()) {
            String wanted = AnimeStatus.normalize(status);
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), wanted));
        }
        if (year != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("year"), year));
        }

        return spec;
    }

    private static Specification<Anime> genre(List<Integer> genreIds, boolean exclude) {
        return (root, query, cb) -> {
            Subquery<UUID> sub = query.subquery(UUID.class);
            Root<Anime> subRoot = sub.from(Anime.class);
            Join<Anime, AnimeGenre> join = subRoot.join("animeGenres");
            sub.select(subRoot.get("id")).where(join.get("malId").in(genreIds));
            return exclude ? cb.not(root.get("id").in(sub)) : root.get("id").in(sub);
        };
    }

    public static Sort sort(String orderBy, String sort) {
        boolean ascending = "asc".equalsIgnoreCase(sort);
        String field = switch (orderBy == null ? "" : orderBy.trim().toLowerCase()) {
            case "title" -> "title";
            case "score" -> "score";
            case "episodes" -> "episodes";
            case "popularity" -> "popularity";
            case "members" -> "members";
            case "favorites" -> "favorites";
            case "rank" -> "rank";
            case "start_date", "end_date" -> "year";
            default -> "rating";
        };
        return Sort.by(ascending ? Sort.Direction.ASC : Sort.Direction.DESC, field);
    }
}
