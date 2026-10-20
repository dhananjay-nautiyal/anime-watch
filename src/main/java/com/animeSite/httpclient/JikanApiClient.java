package com.animeSite.httpclient;

import com.animeSite.model.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import com.google.common.util.concurrent.RateLimiter;

@Component
public class JikanApiClient {

    private static final String BASE_URL = "https://api.jikan.moe/v4";
    private static final long RATE_LIMIT_MS = 1000;

    private final RestTemplate restTemplate;
    @SuppressWarnings("UnstableApiUsage")
    private final RateLimiter rateLimiter = RateLimiter.create(1.0);

    public JikanApiClient(@Qualifier("jikanRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public JikanListResponse fetchTopAnime(int page) {
        return fetchTopAnime(page, 25);
    }

    public JikanListResponse fetchTopAnime(int page, int size) {
        return callApi(BASE_URL + "/top/anime?page={page}&limit={limit}", page + 1, clampLimit(size));
    }

    public JikanListResponse searchAnime(String query, int page) {
        return searchAnime(query, page, 25);
    }

    public JikanListResponse searchAnime(String query, int page, int size) {
        return callApi(BASE_URL + "/anime?q={query}&page={page}&limit={limit}", query, page + 1, clampLimit(size));
    }

    public JikanListResponse filterAnime(String url) {
        return callApi(url);
    }

    public JikanListResponse fetchSeasonalAnime(int page) {
        return fetchSeasonalAnime(page, 25);
    }

    public JikanListResponse fetchSeasonalAnime(int page, int size) {
        return callApi(BASE_URL + "/seasons/now?page={page}&limit={limit}", page + 1, clampLimit(size));
    }

    /** Jikan accepts at most 25 results per request. */
    private int clampLimit(int size) {
        return Math.max(1, Math.min(size, 25));
    }

    public JikanSingleResponse fetchAnimeById(int id) {
        return callApiSingle(BASE_URL + "/anime/{id}", id);
    }

    public JikanFullAnimeResponse fetchAnimeFull(int id) {
        return callApiFull(BASE_URL + "/anime/{id}/full", id);
    }

    public JikanCharactersResponse fetchAnimeCharacters(int id) {
        return callApiCharacters(BASE_URL + "/anime/{id}/characters", id);
    }

    public JikanStaffResponse fetchAnimeStaff(int id) {
        return callApiStaff(BASE_URL + "/anime/{id}/staff", id);
    }

    public JikanRecommendationsResponse fetchAnimeRecommendations(int id) {
        return callApiRecommendations(BASE_URL + "/anime/{id}/recommendations", id);
    }

    public JikanExternalResponse fetchAnimeExternal(int id) {
        return callApiExternal(BASE_URL + "/anime/{id}/external", id);
    }

    public JikanListResponse fetchAnimeBySeason(int year, String season, int page) {
        return callApi(BASE_URL + "/seasons/{year}/{season}?page={page}", year, season, page + 1);
    }

    public JikanListResponse fetchAnimeByGenre(int genreId, int page) {
        return callApi(BASE_URL + "/anime?genres={genreId}&page={page}", genreId, page + 1);
    }

    public String buildFilterUrl(String baseParams, String genres, String genresExclude, String type, String status,
                                  String orderBy, String sort, int page) {
        return buildFilterUrl(baseParams, genres, genresExclude, type, status, orderBy, sort, page, null, 25);
    }

    public String buildFilterUrl(String baseParams, String genres, String genresExclude, String type, String status,
                                  String orderBy, String sort, int page, Integer year, int size) {
        StringBuilder url = new StringBuilder(BASE_URL + "/anime?" + baseParams + "page=" + (page + 1)
                + "&limit=" + clampLimit(size));
        if (genres != null && !genres.isBlank()) url.append("&genres=").append(genres);
        if (genresExclude != null && !genresExclude.isBlank()) url.append("&genres_exclude=").append(genresExclude);
        if (type != null && !type.isBlank()) url.append("&type=").append(type);
        if (status != null && !status.isBlank()) url.append("&status=").append(status);
        if (year != null) url.append("&start_date=").append(year).append("-01-01&end_date=")
                .append(year).append("-12-31");
        if (orderBy != null && !orderBy.isBlank()) url.append("&order_by=").append(orderBy);
        if (sort != null && !sort.isBlank()) url.append("&sort=").append(sort);
        return url.toString();
    }

    private void rateLimit() {
        rateLimiter.acquire();
    }

    private JikanListResponse callApi(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanListResponse.class, args);
    }

    private JikanSingleResponse callApiSingle(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanSingleResponse.class, args);
    }

    private JikanFullAnimeResponse callApiFull(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanFullAnimeResponse.class, args);
    }

    private JikanCharactersResponse callApiCharacters(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanCharactersResponse.class, args);
    }

    private JikanStaffResponse callApiStaff(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanStaffResponse.class, args);
    }

    private JikanRecommendationsResponse callApiRecommendations(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanRecommendationsResponse.class, args);
    }

    private JikanExternalResponse callApiExternal(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanExternalResponse.class, args);
    }

    public JikanEpisodeListResponse fetchAnimeEpisodes(int id, int page) {
        return callApiEpisodes(BASE_URL + "/anime/{id}/episodes?page={page}", id, page);
    }

    private JikanEpisodeListResponse callApiEpisodes(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanEpisodeListResponse.class, args);
    }
}
