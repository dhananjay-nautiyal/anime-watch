package com.animeSite.service.impl;

import com.animeSite.core.exception.BusinessException;
import com.animeSite.core.exception.ErrorCode;
import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanListResponse;
import com.animeSite.persist.Anime;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.service.AnimeService;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class AnimeServiceImpl implements AnimeService {

    private final JikanApiClient jikanApiClient;
    private final AnimeRepository animeRepository;

    public AnimeServiceImpl(JikanApiClient jikanApiClient, AnimeRepository animeRepository) {
        this.jikanApiClient = jikanApiClient;
        this.animeRepository = animeRepository;
    }

    public AnimePage getTrending(int page) {
        return toAnimePage(jikanApiClient.fetchTopAnime(page), page);
    }

    public AnimePage searchAnime(String query, int page) {
        return toAnimePage(jikanApiClient.searchAnime(query, page), page);
    }

    public AnimePage filterAnime(String genres, String type, String status, String orderBy, String sort, int page) {
        String url = jikanApiClient.buildFilterUrl("", genres, type, status, orderBy, sort, page);
        return toAnimePage(jikanApiClient.filterAnime(url), page);
    }

    @Cacheable(value = "anime", key = "#id")
    public Anime getAnimeById(int id) {
        return animeRepository.findByMalId(id)
                .orElseGet(() -> {
                    var response = jikanApiClient.fetchAnimeById(id);
                    if (response == null || response.getData() == null) {
                        throw new BusinessException(ErrorCode.ANIME_0001, "Anime not found with ID: " + id);
                    }
                    return saveAnime(response.getData());
                });
    }

    public AnimePage getSeasonal(int page) {
        return toAnimePage(jikanApiClient.fetchSeasonalAnime(page), page);
    }

    @Transactional
    public Anime addAnimeByMalId(int malId) {
        if (animeRepository.existsByMalId(malId)) {
            return animeRepository.findByMalId(malId).orElseThrow();
        }
        var response = jikanApiClient.fetchAnimeById(malId);
        if (response == null || response.getData() == null) {
            throw new BusinessException(ErrorCode.ANIME_0001, "Anime not found with MAL ID: " + malId);
        }
        return saveAnime(response.getData());
    }

    @Transactional
    public List<Anime> importTrendingAnime(int page) {
        JikanListResponse response = jikanApiClient.fetchTopAnime(page);
        return importFromResponse(response);
    }

    @Transactional
    public List<Anime> importSeasonalAnime(int page) {
        JikanListResponse response = jikanApiClient.fetchSeasonalAnime(page);
        return importFromResponse(response);
    }

    private List<Anime> importFromResponse(JikanListResponse response) {
        List<Anime> imported = new ArrayList<>();
        if (response != null && response.getData() != null) {
            for (JikanAnimeData data : response.getData()) {
                imported.add(saveAnime(data));
            }
        }
        return imported;
    }

    @Transactional
    public Anime updateAffiliateUrl(UUID animeId, String affiliateUrl) {
        Anime anime = animeRepository.findById(animeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ANIME_0001, "Anime not found with ID: " + animeId));
        anime.setAffiliateUrl(affiliateUrl);
        return animeRepository.save(anime);
    }

    @Transactional
    public void deleteAnime(UUID animeId) {
        Anime anime = animeRepository.findById(animeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ANIME_0001, "Anime not found with ID: " + animeId));
        animeRepository.delete(anime);
    }

    public AnimePage toAnimePage(JikanListResponse response, int page) {
        List<Anime> animeList = new ArrayList<>();
        int totalPages = 1;
        if (response != null && response.getData() != null) {
            for (JikanAnimeData data : response.getData()) {
                animeList.add(saveAnime(data));
            }
            if (response.getPagination() != null) {
                totalPages = response.getPagination().getLastVisiblePage();
            }
        }
        return new AnimePage(animeList, page, totalPages);
    }

    private Anime saveAnime(JikanAnimeData data) {
        if (animeRepository.existsByMalId(data.getMalId())) {
            return animeRepository.findByMalId(data.getMalId()).orElseThrow();
        }
        Anime anime = new Anime();
        anime.setMalId(data.getMalId());
        anime.setTitle(data.getTitle());
        anime.setSynopsis(data.getSynopsis());
        anime.setRating(data.getScore());
        anime.setEpisodes(data.getEpisodes());
        anime.setTrailerUrl(data.getTrailer() != null ? data.getTrailer().getUrl() : null);
        anime.setImageUrl(data.getImages() != null && data.getImages().getJpg() != null
                ? data.getImages().getJpg().getImageUrl() : null);
        return animeRepository.save(anime);
    }

}
