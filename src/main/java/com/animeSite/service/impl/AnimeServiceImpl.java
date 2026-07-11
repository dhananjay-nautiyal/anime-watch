package com.animeSite.service.impl;

import com.animeSite.core.exception.BusinessException;
import com.animeSite.core.exception.ErrorCode;
import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanListResponse;
import com.animeSite.persist.Anime;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.service.AnimeService;
import com.animeSite.service.SlugService;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
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
    private final SlugService slugService;

    public AnimeServiceImpl(JikanApiClient jikanApiClient, AnimeRepository animeRepository, SlugService slugService) {
        this.jikanApiClient = jikanApiClient;
        this.animeRepository = animeRepository;
        this.slugService = slugService;
    }

    @Cacheable(value = "trending", key = "'page-'+#page", unless = "#result == null")
    public AnimePage getTrending(int page) {
        try {
            return toAnimePage(jikanApiClient.fetchTopAnime(page), page);
        } catch (Exception e) {
            Page<Anime> dbPage = animeRepository.findAllByOrderByRatingDesc(PageRequest.of(page, 25));
            return toAnimePageFromDb(dbPage, page);
        }
    }

    @Cacheable(value = "search", key = "'q-'+#query+'-page-'+#page", unless = "#result == null")
    public AnimePage searchAnime(String query, int page) {
        try {
            return toAnimePage(jikanApiClient.searchAnime(query, page), page);
        } catch (Exception e) {
            Page<Anime> dbPage = animeRepository.findByTitleContainingIgnoreCase(query, PageRequest.of(page, 25));
            return toAnimePageFromDb(dbPage, page);
        }
    }

    @Cacheable(value = "search", key = "'filter-'+#genres+'-'+#genresExclude+'-'+#type+'-'+#status+'-'+#orderBy+'-'+#sort+'-'+#page", unless = "#result == null")
    public AnimePage filterAnime(String genres, String genresExclude, String type, String status, String orderBy, String sort, int page) {
        try {
            String url = jikanApiClient.buildFilterUrl("", genres, genresExclude, type, status, orderBy, sort, page);
            return toAnimePage(jikanApiClient.filterAnime(url), page);
        } catch (Exception e) {
            Page<Anime> dbPage = animeRepository.findAllByOrderByRatingDesc(PageRequest.of(page, 25));
            return toAnimePageFromDb(dbPage, page);
        }
    }

    @Cacheable(value = "anime", key = "'id-'+#id", unless = "#result == null")
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

    @Cacheable(value = "anime", key = "'slug-'+#slug", unless = "#result == null")
    public Anime getAnimeBySlug(String slug) {
        return animeRepository.findBySlug(slug)
                .orElseThrow(() -> new BusinessException(ErrorCode.ANIME_0001, "Anime not found with slug: " + slug));
    }

    @Cacheable(value = "seasonal", key = "'page-'+#page", unless = "#result == null")
    public AnimePage getSeasonal(int page) {
        try {
            return toAnimePage(jikanApiClient.fetchSeasonalAnime(page), page);
        } catch (Exception e) {
            Page<Anime> dbPage = animeRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, 25));
            return toAnimePageFromDb(dbPage, page);
        }
    }

    @Transactional
    @CacheEvict(value = "anime", key = "'id-'+#malId")
    public Anime addAnimeByMalId(int malId) {
        var response = jikanApiClient.fetchAnimeById(malId);
        if (response == null || response.getData() == null) {
            throw new BusinessException(ErrorCode.ANIME_0001, "Anime not found with MAL ID: " + malId);
        }
        return saveAnime(response.getData());
    }

    @Transactional
    @CacheEvict(value = "trending", allEntries = true)
    public List<Anime> importTrendingAnime(int page) {
        JikanListResponse response = jikanApiClient.fetchTopAnime(page);
        return importFromResponse(response);
    }

    @Transactional
    @CacheEvict(value = "seasonal", allEntries = true)
    public List<Anime> importSeasonalAnime(int page) {
        JikanListResponse response = jikanApiClient.fetchSeasonalAnime(page);
        return importFromResponse(response);
    }

    private List<Anime> saveAnimeBatch(List<JikanAnimeData> dataList) {
        if (dataList == null || dataList.isEmpty()) {
            return List.of();
        }
        List<Integer> malIds = dataList.stream().map(JikanAnimeData::getMalId).toList();
        List<Anime> existingList = animeRepository.findAllByMalIdIn(malIds);
        java.util.Map<Integer, Anime> existingMap = existingList.stream()
                .collect(java.util.stream.Collectors.toMap(Anime::getMalId, a -> a));

        List<Anime> toSave = new ArrayList<>();
        for (JikanAnimeData data : dataList) {
            Anime anime = existingMap.get(data.getMalId());
            if (anime == null) {
                anime = new Anime();
                anime.setMalId(data.getMalId());
            }
            String englishTitle = data.getTitleEnglish();
            String title = englishTitle != null && !englishTitle.isBlank() ? englishTitle : data.getTitle();
            anime.setTitle(title);
            if (anime.getSlug() == null) {
                String rawSlug = slugService.generateSlug(title);
                anime.setSlug(slugService.ensureUniqueSlug(rawSlug, data.getMalId()));
            }
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
            populateTransientFields(anime, data);
            toSave.add(anime);
        }
        return animeRepository.saveAll(toSave);
    }

    private List<Anime> importFromResponse(JikanListResponse response) {
        if (response != null && response.getData() != null) {
            return saveAnimeBatch(response.getData());
        }
        return new ArrayList<>();
    }

    @Transactional
    @CacheEvict(value = "anime", allEntries = true)
    public Anime updateAffiliateUrl(UUID animeId, String affiliateUrl) {
        Anime anime = animeRepository.findById(animeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ANIME_0001, "Anime not found with ID: " + animeId));
        anime.setAffiliateUrl(affiliateUrl);
        return animeRepository.save(anime);
    }

    @Transactional
    @CacheEvict(value = "anime", allEntries = true)
    public void deleteAnime(UUID animeId) {
        Anime anime = animeRepository.findById(animeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ANIME_0001, "Anime not found with ID: " + animeId));
        animeRepository.delete(anime);
    }

    public AnimePage toAnimePage(JikanListResponse response, int page) {
        List<Anime> animeList = new ArrayList<>();
        int totalPages = 1;
        if (response != null && response.getData() != null) {
            animeList = saveAnimeBatch(response.getData());
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
        String englishTitle = data.getTitleEnglish();
        String title = englishTitle != null && !englishTitle.isBlank() ? englishTitle : data.getTitle();
        anime.setTitle(title);
        if (anime.getSlug() == null) {
            String rawSlug = slugService.generateSlug(title);
            anime.setSlug(slugService.ensureUniqueSlug(rawSlug, data.getMalId()));
        }
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
        populateTransientFields(anime, data);
        return animeRepository.save(anime);
    }

    private void populateTransientFields(Anime anime, JikanAnimeData data) {
        anime.setType(data.getType());
        anime.setStatus(data.getStatus());
        anime.setYear(data.getYear());
        anime.setDuration(data.getDuration());
        if (data.getAired() != null) {
            anime.setAired(data.getAired().getAiredString());
        }
        anime.setGenres(data.getGenres() != null ? data.getGenres() : new java.util.ArrayList<>());
        anime.setStudios(data.getStudios() != null ? data.getStudios() : new java.util.ArrayList<>());
    }

}
