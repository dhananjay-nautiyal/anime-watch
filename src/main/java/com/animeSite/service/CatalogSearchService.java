package com.animeSite.service;

import com.animeSite.persist.Anime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

public interface CatalogSearchService {

    Page<Anime> search(String query, Pageable pageable);

    Page<Anime> filter(Map<String, String> filters, Pageable pageable);

    List<Anime> getTopRated(int limit);

    List<Anime> getMostPopular(int limit);

    Page<Anime> getByGenre(int genreId, Pageable pageable);

    Page<Anime> getByStudio(int studioId, Pageable pageable);

    Page<Anime> getBySeason(String season, Integer year, Pageable pageable);

    Page<Anime> getByStatus(String status, Pageable pageable);

    Page<Anime> getByType(String type, Pageable pageable);
}
