package com.animeSite.service;

import com.animeSite.persist.Anime;
import com.animeSite.pipeline.ProviderResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

/**
 * Builds the home page payload.
 *
 * <p>Two problems made the home endpoint unusably slow (24s on Render):
 * every section tried Jikan first and waited for the connect timeout before
 * falling back to the local database, and the ten sections were then joined
 * together, so the slowest one set the response time. The provider-cache
 * lookups for {@code streamableIds} also ran one query per anime id.
 *
 * <p>Now the sections are assembled once and cached for a few minutes, the
 * Jikan circuit breaker short-circuits dead upstreams, and the provider cache
 * is read with a single query.
 */
@Service
public class HomePageService {

    private static final Logger log = LoggerFactory.getLogger(HomePageService.class);

    private final AnimeService animeService;
    private final ProviderResolver providerResolver;

    public HomePageService(AnimeService animeService, ProviderResolver providerResolver) {
        this.animeService = animeService;
        this.providerResolver = providerResolver;
    }

    @Cacheable(value = "home", key = "'payload'")
    public Map<String, Object> buildHomePage() {
        long start = System.currentTimeMillis();
        String exclude = "15";

        CompletableFuture<List<Anime>> trendingF = CompletableFuture.supplyAsync(() ->
            animeService.getTrending(0, 25).animeList());
        CompletableFuture<List<Anime>> airingF = CompletableFuture.supplyAsync(() ->
            animeService.filterAnime(null, exclude, null, "airing", null, null, null, 0, 25).animeList());
        CompletableFuture<List<Anime>> topRatedF = CompletableFuture.supplyAsync(() ->
            animeService.filterAnime(null, exclude, null, "finished", null, "score", "desc", 0, 25).animeList());
        CompletableFuture<List<Anime>> upcomingF = CompletableFuture.supplyAsync(() ->
            animeService.filterAnime(null, exclude, null, "upcoming", null, null, null, 0, 25).animeList());
        CompletableFuture<List<Anime>> seasonalF = CompletableFuture.supplyAsync(() ->
            animeService.getSeasonal(0, 25).animeList());
        CompletableFuture<List<Anime>> newReleasesF = CompletableFuture.supplyAsync(() ->
            animeService.filterAnime(null, exclude, null, null, null, "popularity", "desc", 0, 25).animeList());
        CompletableFuture<List<Anime>> completedF = CompletableFuture.supplyAsync(() ->
            animeService.filterAnime(null, exclude, null, "finished", null, "popularity", "desc", 0, 25).animeList());
        CompletableFuture<List<Anime>> popularWeekF = CompletableFuture.supplyAsync(() ->
            animeService.filterAnime(null, exclude, null, null, null, "popularity", "desc", 0, 25).animeList());
        CompletableFuture<List<Anime>> moviesF = CompletableFuture.supplyAsync(() ->
            animeService.filterAnime(null, exclude, "Movie", null, null, "score", "desc", 0, 25).animeList());
        CompletableFuture<List<Anime>> mostViewedF = CompletableFuture.supplyAsync(() ->
            animeService.filterAnime(null, exclude, null, null, null, "members", "desc", 0, 25).animeList());

        List<CompletableFuture<List<Anime>>> all = List.of(trendingF, airingF, topRatedF, upcomingF,
            seasonalF, newReleasesF, completedF, popularWeekF, moviesF, mostViewedF);

        Map<String, Object> response = new LinkedHashMap<>();
        Set<Integer> allIds = new HashSet<>();
        for (CompletableFuture<List<Anime>> f : all) {
            List<Anime> list = safeJoin(f);
            for (Anime a : list) {
                if (a.getMalId() != null) allIds.add(a.getMalId());
            }
        }

        response.put("trending", limit(join(trendingF), 25));
        response.put("airing", limit(join(airingF), 20));
        response.put("topRated", limit(join(topRatedF), 20));
        response.put("upcoming", limit(join(upcomingF), 20));
        response.put("seasonal", limit(join(seasonalF), 20));
        response.put("newReleases", limit(join(newReleasesF), 20));
        response.put("completed", limit(join(completedF), 20));
        response.put("popularWeek", limit(join(popularWeekF), 20));
        response.put("movies", limit(join(moviesF), 20));
        response.put("mostViewed", limit(join(mostViewedF), 20));

        // One query for every id instead of one per id.
        List<Integer> streamableIds = new ArrayList<>(providerResolver.getStreamableProviderIds(allIds));
        response.put("streamableIds", streamableIds);

        log.info("[HOME] assembled in {}ms | streamable={}", System.currentTimeMillis() - start, streamableIds.size());
        return response;
    }

    private List<Anime> join(CompletableFuture<List<Anime>> future) {
        try {
            return safeJoin(future);
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<Anime> safeJoin(CompletableFuture<List<Anime>> future) {
        try {
            return future.join();
        } catch (Exception e) {
            log.warn("[HOME] section failed: {}", e.getMessage());
            return List.of();
        }
    }

    private <T> List<T> limit(List<T> list, int max) {
        if (list == null) return List.of();
        return list.subList(0, Math.min(list.size(), max));
    }
}
