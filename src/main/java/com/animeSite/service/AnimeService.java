package com.animeSite.service;

import com.animeSite.persist.Anime;

import java.util.List;
import java.util.UUID;

public interface AnimeService {
    AnimePage getTrending(int page);
    AnimePage searchAnime(String query, int page);
    AnimePage filterAnime(String genres, String type, String status, String orderBy, String sort, int page);
    Anime getAnimeById(int id);
    AnimePage getSeasonal(int page);
    Anime updateAffiliateUrl(UUID animeId, String affiliateUrl);
    void deleteAnime(UUID animeId);

    Anime addAnimeByMalId(int malId);
    List<Anime> importTrendingAnime(int page);
    List<Anime> importSeasonalAnime(int page);

    record AnimePage(List<Anime> animeList, int page, int totalPages) {}
}
