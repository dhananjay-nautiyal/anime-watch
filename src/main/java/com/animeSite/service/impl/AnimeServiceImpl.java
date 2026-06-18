package com.animeSite.service.impl;

import com.animeSite.core.exception.BusinessException;
import com.animeSite.core.exception.ErrorCode;
import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanListResponse;
import com.animeSite.persist.Anime;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.service.AnimeService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
        try {
            return toAnimePage(jikanApiClient.fetchTopAnime(page), page);
        } catch (Exception e) {
            Page<Anime> dbPage = animeRepository.findAllByOrderByRatingDesc(PageRequest.of(page, 25));
            return toAnimePageFromDb(dbPage, page);
        }
    }

    public AnimePage searchAnime(String query, int page) {
        try {
            return toAnimePage(jikanApiClient.searchAnime(query, page), page);
        } catch (Exception e) {
            Page<Anime> dbPage = animeRepository.findByTitleContainingIgnoreCase(query, PageRequest.of(page, 25));
            return toAnimePageFromDb(dbPage, page);
        }
    }

    public AnimePage filterAnime(String genres, String type, String status, String orderBy, String sort, int page) {
        try {
            String url = jikanApiClient.buildFilterUrl("", genres, type, status, orderBy, sort, page);
            return toAnimePage(jikanApiClient.filterAnime(url), page);
        } catch (Exception e) {
            Page<Anime> dbPage = animeRepository.findAllByOrderByRatingDesc(PageRequest.of(page, 25));
            return toAnimePageFromDb(dbPage, page);
        }
    }

    public Anime getAnimeById(int id) {
        try {
            var response = jikanApiClient.fetchAnimeById(id);
            if (response != null && response.getData() != null) {
                return saveAnime(response.getData());
            }
        } catch (Exception ignored) {}
        return animeRepository.findByMalId(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ANIME_0001, "Anime not found with ID: " + id));
    }

    public AnimePage getSeasonal(int page) {
        try {
            return toAnimePage(jikanApiClient.fetchSeasonalAnime(page), page);
        } catch (Exception e) {
            Page<Anime> dbPage = animeRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, 25));
            return toAnimePageFromDb(dbPage, page);
        }
    }

    @Transactional
    public Anime addAnimeByMalId(int malId) {
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

    private AnimePage toAnimePageFromDb(Page<Anime> dbPage, int page) {
        return new AnimePage(dbPage.getContent(), page, dbPage.getTotalPages());
    }

    private Anime saveAnime(JikanAnimeData data) {
        Optional<Anime> existing = animeRepository.findByMalId(data.getMalId());
        Anime anime = existing.orElseGet(Anime::new);
        anime.setMalId(data.getMalId());
        anime.setTitle(data.getTitle());
        anime.setSynopsis(data.getSynopsis());
        anime.setRating(data.getScore());
        anime.setEpisodes(data.getEpisodes());
        if (data.getTrailer() != null) {
            anime.setTrailerUrl(data.getTrailer().getUrl());
            anime.setTrailerEmbedUrl(data.getTrailer().getEmbedUrl());
        }
        anime.setImageUrl(data.getImages() != null && data.getImages().getJpg() != null
                ? data.getImages().getJpg().getLargeImageUrl() != null
                    ? data.getImages().getJpg().getLargeImageUrl()
                    : data.getImages().getJpg().getImageUrl()
                : null);
        return animeRepository.save(anime);
    }

}
