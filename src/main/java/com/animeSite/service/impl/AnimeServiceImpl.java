package com.animeSite.service.impl;

import com.animeSite.constant.AnimeStatus;
import com.animeSite.core.exception.BusinessException;
import com.animeSite.core.exception.ErrorCode;
import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.importpipeline.JikanMetadataProvider;
import com.animeSite.importpipeline.MetadataProvider;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanListResponse;
import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeGenre;
import com.animeSite.repo.AnimeGenreRepository;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.service.AnimeFilters;
import com.animeSite.service.AnimeService;
import com.animeSite.service.SlugService;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;


import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class AnimeServiceImpl implements AnimeService {

    private final JikanApiClient jikanApiClient;
    private final AnimeRepository animeRepository;
    private final AnimeGenreRepository animeGenreRepository;
    private final SlugService slugService;
    private final JikanMetadataProvider jikanMetadataProvider;
    private final AnimeMetadataEnricher metadataEnricher;
    private final TransactionTemplate readOnlyTx;
    private final TransactionTemplate writeTx;

    public AnimeServiceImpl(JikanApiClient jikanApiClient, AnimeRepository animeRepository,
                             AnimeGenreRepository animeGenreRepository,
                             SlugService slugService, JikanMetadataProvider jikanMetadataProvider,
                             AnimeMetadataEnricher metadataEnricher,
                             PlatformTransactionManager transactionManager) {
        this.jikanApiClient = jikanApiClient;
        this.animeRepository = animeRepository;
        this.animeGenreRepository = animeGenreRepository;
        this.slugService = slugService;
        this.jikanMetadataProvider = jikanMetadataProvider;
        this.metadataEnricher = metadataEnricher;
        this.readOnlyTx = new TransactionTemplate(transactionManager);
        this.readOnlyTx.setReadOnly(true);
        this.writeTx = new TransactionTemplate(transactionManager);
    }

    @Transactional
    @Cacheable(value = "trending", key = "'page-'+#page+'-size-'+#size", unless = "#result == null")
    public AnimePage getTrending(int page, int size) {
        try {
            return toAnimePage(jikanApiClient.fetchTopAnime(page, size), page);
        } catch (Exception e) {
            return fromDb(() -> animeRepository.findAllByOrderByRatingDesc(PageRequest.of(page, size)), page);
        }
    }

    @Transactional
    @Cacheable(value = "search", key = "'q-'+#query+'-page-'+#page+'-size-'+#size", unless = "#result == null")
    public AnimePage searchAnime(String query, int page, int size) {
        try {
            return toAnimePage(jikanApiClient.searchAnime(query, page, size), page);
        } catch (Exception e) {
            return fromDb(() -> animeRepository.findByTitleContainingIgnoreCase(query, PageRequest.of(page, size)), page);
        }
    }

    @Transactional
    @Cacheable(value = "search",
            key = "'filter-'+#genres+'-'+#genresExclude+'-'+#type+'-'+#status+'-year-'+#year+'-'+#orderBy+'-'+#sort+'-'+#page+'-size-'+#size",
            unless = "#result == null")
    public AnimePage filterAnime(String genres, String genresExclude, String type, String status,
                                 Integer year, String orderBy, String sort, int page, int size) {
        List<Integer> includeIds = resolveGenreIds(genres);
        List<Integer> excludeIds = resolveGenreIds(genresExclude);

        // A genre name/id that matches nothing must return nothing. Falling
        // back to an unfiltered list is what made the filters look broken.
        if (includeIds != null && includeIds.isEmpty()) {
            return new AnimePage(List.of(), page, 0);
        }

        try {
            String url = jikanApiClient.buildFilterUrl("", toCsv(includeIds), toCsv(excludeIds),
                    type == null ? null : type.toLowerCase(),
                    AnimeStatus.toJikanFilterValue(status),
                    orderBy, sort, page, year, size);
            return toAnimePage(jikanApiClient.filterAnime(url), page);
        } catch (Exception e) {
            return filterFromDb(includeIds, excludeIds, type, status, year, orderBy, sort, page, size);
        }
    }

    private AnimePage filterFromDb(List<Integer> includeIds, List<Integer> excludeIds, String type,
                                   String status, Integer year, String orderBy, String sort,
                                   int page, int size) {
        Specification<Anime> spec = AnimeFilters.build(includeIds, excludeIds, type, status, year);
        Pageable pageable = PageRequest.of(page, size, AnimeFilters.sort(orderBy, sort));
        return fromDb(() -> animeRepository.findAll(spec, pageable), page);
    }

    /**
     * Accepts MAL genre IDs or genre names (the browse UI sends names).
     * Returns null when there is no filter, an empty list when a name cannot
     * be resolved, and the resolved IDs otherwise.
     */
    private List<Integer> resolveGenreIds(String csv) {
        if (csv == null || csv.isBlank()) return null;
        Set<Integer> ids = new LinkedHashSet<>();
        for (String token : csv.split(",")) {
            String value = token.trim();
            if (value.isEmpty()) continue;
            try {
                ids.add(Integer.parseInt(value));
            } catch (NumberFormatException e) {
                Optional<AnimeGenre> genre = animeGenreRepository.findByNameIgnoreCase(value);
                if (genre.isEmpty()) return List.of();
                ids.add(genre.get().getMalId());
            }
        }
        return new ArrayList<>(ids);
    }

    private String toCsv(List<Integer> ids) {
        if (ids == null) return null;
        return ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
    }

    @Cacheable(value = "anime", key = "'id-'+#id", unless = "#result == null")
    public Anime getAnimeById(int id) {
        // Prefer the local catalog: the Jikan API is slow or unreachable on
        // some networks, and blocking the detail page for 15 s on every view
        // is far worse than a slightly stale record.
        if (animeRepository.findByMalId(id).isPresent()) {
            return enrich(loadByIdWithRelations(id));
        }

        try {
            var response = jikanApiClient.fetchAnimeById(id);
            if (response != null && response.getData() != null) {
                Integer malId = saveAnime(response.getData()).getMalId();
                return enrich(loadByIdWithRelations(malId));
            }
        } catch (Exception ignored) {}
        return enrich(loadByIdWithRelations(id));
    }

    @Cacheable(value = "anime", key = "'slug-'+#slug", unless = "#result == null")
    public Anime getAnimeBySlug(String slug) {
        Anime anime = readOnlyTx.execute(status -> {
            Anime found = animeRepository.findBySlug(slug)
                    .or(() -> {
                        try {
                            return animeRepository.findByMalId(Integer.parseInt(slug));
                        } catch (NumberFormatException e) {
                            return Optional.empty();
                        }
                    })
                    .orElseThrow(() -> new BusinessException(ErrorCode.ANIME_0001, "Anime not found with slug: " + slug));
            initializeRelations(found);
            return found;
        });
        return enrich(anime);
    }

    /**
     * Detail responses are the only place the full metadata is shown, so this
     * is where the MAL enrichment runs. It is persisted, making subsequent
     * lookups free. Runs after the read-only transaction above so the write
     * is not swallowed by a read-only Hibernate session.
     */
    private Anime enrich(Anime anime) {
        if (metadataEnricher.needsEnrichment(anime)) {
            metadataEnricher.enrich(anime);
        }
        return anime;
    }

    private Anime loadByIdWithRelations(int id) {
        return readOnlyTx.execute(status -> {
            Anime anime = animeRepository.findByMalId(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ANIME_0001, "Anime not found with ID: " + id));
            initializeRelations(anime);
            return anime;
        });
    }

    /**
     * Detail responses and cached list pages expose genres and studios. Both
     * collections are lazy, so touching them here (two batched queries inside
     * the surrounding transaction) stores fully initialized entities in the
     * cache. Serializing a cached page later happens outside any session, and
     * an uninitialized proxy there used to fail /api/anime/home with
     * LazyInitializationException.
     */
    private void initializeRelations(Anime anime) {
        anime.getAnimeGenres().size();
        anime.getAnimeStudios().size();
    }

    @Transactional
    @Cacheable(value = "seasonal", key = "'page-'+#page+'-size-'+#size", unless = "#result == null")
    public AnimePage getSeasonal(int page, int size) {
        try {
            return toAnimePage(jikanApiClient.fetchSeasonalAnime(page, size), page);
        } catch (Exception e) {
            return fromDb(() -> animeRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size)), page);
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
            anime.setTitleEnglish(data.getTitleEnglish());
            anime.setTitleJapanese(data.getTitleJapanese());
            if (data.getTitleSynonyms() != null && !data.getTitleSynonyms().isEmpty()) {
                anime.setTitleSynonyms(String.join(", ", data.getTitleSynonyms()));
            }
            anime.setSynopsis(data.getSynopsis());
            anime.setScore(data.getScore());
            anime.setEpisodes(data.getEpisodes());
            anime.setType(data.getType());
            anime.setStatus(AnimeStatus.normalize(data.getStatus()));
            anime.setYear(data.getYear());
            anime.setDuration(data.getDuration());
            if (data.getAired() != null) {
                anime.setAired(data.getAired().getAiredString());
            }
            if (data.getTrailer() != null) {
                anime.setTrailerUrl(data.getTrailer().getUrl());
                anime.setTrailerEmbedUrl(data.getTrailer().getEmbedUrl());
            }
            anime.setImageUrl(data.getImages() != null && data.getImages().getJpg() != null
                    ? data.getImages().getJpg().getLargeImageUrl() != null
                        ? data.getImages().getJpg().getLargeImageUrl()
                        : data.getImages().getJpg().getImageUrl()
                    : null);
            anime.setImportedAt(java.time.LocalDateTime.now());
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
            List<Anime> saved = writeTx.execute(status -> {
                List<Anime> batch = saveAnimeBatch(response.getData());
                batch.forEach(this::initializeRelations);
                return batch;
            });
            animeList = saved == null ? List.of() : saved;
            if (response.getPagination() != null) {
                totalPages = response.getPagination().getLastVisiblePage();
            }
        }
        initRelations(animeList);
        return new AnimePage(animeList, page, totalPages);
    }

    /**
     * Runs the query and relation initialization in one read-only transaction,
     * so the page that gets cached is safe to serialize after the session is
     * closed. The DB half of /api/anime/home runs on CompletableFuture threads,
     * where Open Session in View does not apply.
     */
    private AnimePage fromDb(java.util.function.Supplier<Page<Anime>> query, int page) {
        return readOnlyTx.execute(status -> {
            Page<Anime> dbPage = query.get();
            dbPage.getContent().forEach(this::initializeRelations);
            return toAnimePageFromDb(dbPage, page);
        });
    }

    private AnimePage toAnimePageFromDb(Page<Anime> dbPage, int page) {
        initRelations(dbPage.getContent());
        return new AnimePage(dbPage.getContent(), page, dbPage.getTotalPages());
    }

    /**
     * Home/trending/seasonal are loaded on worker threads (see HomeController's
     * CompletableFutures) where open-in-view cannot keep a session alive. If the
     * lazy relations stay uninitialized, Jackson's getGenres()/getStudios()
     * projections blow up with LazyInitializationException while writing the
     * response. Touch them here, inside the transaction, so the returned
     * entities are safe to serialize on any thread.
     */
    private void initRelations(List<Anime> animeList) {
        if (animeList == null) return;
        for (Anime anime : animeList) {
            if (anime == null) continue;
            anime.getAnimeGenres().size();
            anime.getAnimeStudios().size();
        }
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
        anime.setTitleEnglish(data.getTitleEnglish());
        anime.setTitleJapanese(data.getTitleJapanese());
        if (data.getTitleSynonyms() != null && !data.getTitleSynonyms().isEmpty()) {
            anime.setTitleSynonyms(String.join(", ", data.getTitleSynonyms()));
        }
        anime.setSynopsis(data.getSynopsis());
        anime.setScore(data.getScore());
        anime.setEpisodes(data.getEpisodes());
        anime.setType(data.getType());
        anime.setStatus(AnimeStatus.normalize(data.getStatus()));
        anime.setYear(data.getYear());
        anime.setDuration(data.getDuration());
        if (data.getAired() != null) {
            anime.setAired(data.getAired().getAiredString());
        }
        if (data.getTrailer() != null) {
            anime.setTrailerUrl(data.getTrailer().getUrl());
            anime.setTrailerEmbedUrl(data.getTrailer().getEmbedUrl());
        }
        anime.setImageUrl(data.getImages() != null && data.getImages().getJpg() != null
                ? data.getImages().getJpg().getLargeImageUrl() != null
                    ? data.getImages().getJpg().getLargeImageUrl()
                    : data.getImages().getJpg().getImageUrl()
                : null);
        anime.setImportedAt(java.time.LocalDateTime.now());
        return animeRepository.save(anime);
    }
}
