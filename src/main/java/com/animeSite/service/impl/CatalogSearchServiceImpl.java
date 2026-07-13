package com.animeSite.service.impl;

import com.animeSite.persist.Anime;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.service.CatalogSearchService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CatalogSearchServiceImpl implements CatalogSearchService {

    private final AnimeRepository animeRepository;

    public CatalogSearchServiceImpl(AnimeRepository animeRepository) {
        this.animeRepository = animeRepository;
    }

    @Override
    public Page<Anime> search(String query, Pageable pageable) {
        if (query == null || query.isBlank()) {
            return Page.empty();
        }
        return animeRepository.searchByTitle(query, pageable);
    }

    @Override
    public Page<Anime> filter(Map<String, String> filters, Pageable pageable) {
        String type = filters.get("type");
        String status = filters.get("status");
        String season = filters.get("season");
        String yearStr = filters.get("year");
        String genres = filters.get("genres");
        String minScoreStr = filters.get("minScore");
        String sortBy = filters.get("sortBy");
        String sortDir = filters.get("sortDir");

        // Build sort
        Sort sort = Sort.unsorted();
        if (sortBy != null && !sortBy.isBlank()) {
            List<String> allowedSortFields = List.of("title", "score", "episodes", "startDate", "endDate", "popularity", "members", "malId", "rank", "type", "status");
            if (!allowedSortFields.contains(sortBy)) {
                sortBy = "score";
            }
            Sort.Direction dir = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
            sort = Sort.by(dir, sortBy);
        }
        Pageable sortedPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);

        // Simple filtering by single criterion (can be enhanced with Specifications later)
        if (genres != null && !genres.isBlank()) {
            List<Integer> genreIds = Arrays.stream(genres.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).map(Integer::parseInt).toList();
            if (type != null && !type.isBlank()) {
                return animeRepository.findByGenreIdsAndType(genreIds, type, sortedPageable);
            }
            return animeRepository.findByGenreIds(genreIds, sortedPageable);
        }
        if (type != null && !type.isBlank()) {
            return animeRepository.findByTypeIgnoreCase(type, sortedPageable);
        }
        if (status != null && !status.isBlank()) {
            return animeRepository.findByStatusIgnoreCase(status, sortedPageable);
        }
        if (season != null && !season.isBlank() && yearStr != null && !yearStr.isBlank()) {
            return animeRepository.findBySeasonIgnoreCaseAndYear(season, Integer.parseInt(yearStr), sortedPageable);
        }
        if (yearStr != null && !yearStr.isBlank()) {
            return animeRepository.findByYear(Integer.parseInt(yearStr), sortedPageable);
        }
        if (minScoreStr != null && !minScoreStr.isBlank()) {
            return animeRepository.findByMinScore(Double.parseDouble(minScoreStr), sortedPageable);
        }
        return animeRepository.findAll(sortedPageable);
    }

    @Override
    public List<Anime> getTopRated(int limit) {
        return animeRepository.findTop10ByOrderByScoreDesc().stream()
            .limit(limit).toList();
    }

    @Override
    public List<Anime> getMostPopular(int limit) {
        return animeRepository.findTop10ByOrderByPopularityAsc().stream()
            .limit(limit).toList();
    }

    @Override
    public Page<Anime> getByGenre(int genreId, Pageable pageable) {
        return animeRepository.findByGenreIds(List.of(genreId), pageable);
    }

    @Override
    public Page<Anime> getByStudio(int studioId, Pageable pageable) {
        return animeRepository.findByStudioId(studioId, pageable);
    }

    @Override
    public Page<Anime> getBySeason(String season, Integer year, Pageable pageable) {
        return animeRepository.findBySeasonIgnoreCaseAndYear(season, year, pageable);
    }

    @Override
    public Page<Anime> getByStatus(String status, Pageable pageable) {
        return animeRepository.findByStatusIgnoreCase(status, pageable);
    }

    @Override
    public Page<Anime> getByType(String type, Pageable pageable) {
        return animeRepository.findByTypeIgnoreCase(type, pageable);
    }
}
