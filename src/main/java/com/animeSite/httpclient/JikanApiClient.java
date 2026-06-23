package com.animeSite.httpclient;

import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanListResponse;
import com.animeSite.model.JikanSingleResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.concurrent.Semaphore;

@Component
public class JikanApiClient {

    private static final String BASE_URL = "https://api.jikan.moe/v4";
    private static final long RATE_LIMIT_MS = 1000;

    private final RestTemplate restTemplate;
    private final Semaphore rateLimiter = new Semaphore(1);
    private volatile long lastApiCall = 0;

    public JikanApiClient(@Qualifier("jikanRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public JikanListResponse fetchTopAnime(int page) {
        return callApi(BASE_URL + "/top/anime?page={page}", page + 1);
    }

    public JikanListResponse searchAnime(String query, int page) {
        return callApi(BASE_URL + "/anime?q={query}&page={page}", query, page + 1);
    }

    public JikanListResponse filterAnime(String url) {
        return callApi(url);
    }

    public JikanSingleResponse fetchAnimeById(int id) {
        return callApiSingle(BASE_URL + "/anime/{id}", id);
    }

    public JikanListResponse fetchSeasonalAnime(int page) {
        return callApi(BASE_URL + "/seasons/now?page={page}", page + 1);
    }

    public String buildFilterUrl(String baseParams, String genres, String type, String status,
                                  String orderBy, String sort, int page) {
        StringBuilder url = new StringBuilder(BASE_URL + "/anime?" + baseParams + "page=" + (page + 1));
        if (genres != null && !genres.isBlank()) url.append("&genres=").append(genres);
        if (type != null && !type.isBlank()) url.append("&type=").append(type);
        if (status != null && !status.isBlank()) url.append("&status=").append(status);
        if (orderBy != null && !orderBy.isBlank()) url.append("&order_by=").append(orderBy);
        if (sort != null && !sort.isBlank()) url.append("&sort=").append(sort);
        return url.toString();
    }

    private void rateLimit() {
        rateLimiter.acquireUninterruptibly();
        try {
            long now = System.currentTimeMillis();
            long wait = RATE_LIMIT_MS - (now - lastApiCall);
            if (wait > 0) {
                Thread.sleep(wait);
            }
            lastApiCall = System.currentTimeMillis();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            rateLimiter.release();
        }
    }

    private JikanListResponse callApi(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanListResponse.class, args);
    }

    private JikanSingleResponse callApiSingle(String url, Object... args) {
        rateLimit();
        return restTemplate.getForObject(url, JikanSingleResponse.class, args);
    }
}
