package com.animeSite.httpclient;

import com.animeSite.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import com.google.common.util.concurrent.RateLimiter;

import java.util.concurrent.atomic.AtomicInteger;

@Component
public class JikanApiClient {

    private static final String BASE_URL = "https://api.jikan.moe/v4";
    private static final long RATE_LIMIT_MS = 1000;

    /**
     * Jikan allows about 3 requests per second. A slower limiter serialised
     * the ten home-page sections, so a cold home request spent most of its
     * time waiting for permits instead of doing work.
     */
    private static final double REQUESTS_PER_SECOND = 3.0;

    private static final Logger log = LoggerFactory.getLogger(JikanApiClient.class);

    private final RestTemplate restTemplate;
    @SuppressWarnings("UnstableApiUsage")
    private final RateLimiter rateLimiter = RateLimiter.create(REQUESTS_PER_SECOND);

    /**
     * Circuit breaker. Jikan is regularly unreachable from datacenter IPs
     * (Render, CI, containers). Without a breaker every single request paid
     * the full connect timeout before falling back to the local database, and
     * the 1 req/s rate limiter serialised the failures on top of that — the
     * home page took 24s and every browse request 6s.
     *
     * After a few consecutive failures we stop calling Jikan entirely for a
     * cool-down window and let the database fallback answer instantly.
     */
    private final AtomicInteger consecutiveFailures = new AtomicInteger();
    private volatile long circuitOpenUntil = 0L;

    private final int failureThreshold;
    private final long openDurationMs;

    public JikanApiClient(@Qualifier("jikanRestTemplate") RestTemplate restTemplate,
                          @Value("${app.jikan.failure-threshold:3}") int failureThreshold,
                          @Value("${app.jikan.circuit-open-ms:60000}") long openDurationMs) {
        this.restTemplate = restTemplate;
        this.failureThreshold = failureThreshold;
        this.openDurationMs = openDurationMs;
    }

    /** True while Jikan is considered unreachable. */
    public boolean isCircuitOpen() {
        return System.currentTimeMillis() < circuitOpenUntil;
    }

    private void assertCircuitClosed() {
        if (isCircuitOpen()) {
            throw new JikanUnavailableException("Jikan is unreachable, using local data");
        }
    }

    private void recordSuccess() {
        if (consecutiveFailures.getAndSet(0) > 0) {
            log.info("[JIKAN] recovered, circuit closed");
        }
        circuitOpenUntil = 0L;
    }

    private void recordFailure(Throwable error) {
        int failures = consecutiveFailures.incrementAndGet();
        // A network-level failure (connect timeout, unknown host) means Jikan
        // is unreachable, not busy. Open the circuit right away instead of
        // paying the timeout several times over.
        boolean unreachable = error instanceof org.springframework.web.client.ResourceAccessException
            || (error != null && error.getMessage() != null
                && (error.getMessage().contains("Connect timed out")
                    || error.getMessage().contains("UnknownHost")
                    || error.getMessage().contains("Connection refused")));
        if ((unreachable || failures >= failureThreshold) && !isCircuitOpen()) {
            circuitOpenUntil = System.currentTimeMillis() + openDurationMs;
            log.warn("[JIKAN] circuit OPEN for {}ms after {} failure(s) (unreachable={}, last error='{}')",
                openDurationMs, failures, unreachable, error != null ? error.getMessage() : "?");
        }
    }

    /** Thrown when the breaker is open; callers fall back to the database. */
    public static class JikanUnavailableException extends RuntimeException {
        public JikanUnavailableException(String message) {
            super(message);
        }
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

    private <T> T guarded(java.util.function.Supplier<T> call) {
        assertCircuitClosed();
        rateLimit();
        // The circuit may have opened while this call was queued behind the
        // rate limiter - bail out instead of paying another timeout.
        assertCircuitClosed();
        try {
            T result = call.get();
            recordSuccess();
            return result;
        } catch (RuntimeException e) {
            recordFailure(e);
            throw e;
        }
    }

    private JikanListResponse callApi(String url, Object... args) {
        return guarded(() -> {
            return restTemplate.getForObject(url, JikanListResponse.class, args);
        });
    }

    private JikanSingleResponse callApiSingle(String url, Object... args) {
        return guarded(() -> {
            return restTemplate.getForObject(url, JikanSingleResponse.class, args);
        });
    }

    private JikanFullAnimeResponse callApiFull(String url, Object... args) {
        return guarded(() -> {
            return restTemplate.getForObject(url, JikanFullAnimeResponse.class, args);
        });
    }

    private JikanCharactersResponse callApiCharacters(String url, Object... args) {
        return guarded(() -> {
            return restTemplate.getForObject(url, JikanCharactersResponse.class, args);
        });
    }

    private JikanStaffResponse callApiStaff(String url, Object... args) {
        return guarded(() -> {
            return restTemplate.getForObject(url, JikanStaffResponse.class, args);
        });
    }

    private JikanRecommendationsResponse callApiRecommendations(String url, Object... args) {
        return guarded(() -> {
            return restTemplate.getForObject(url, JikanRecommendationsResponse.class, args);
        });
    }

    private JikanExternalResponse callApiExternal(String url, Object... args) {
        return guarded(() -> {
            return restTemplate.getForObject(url, JikanExternalResponse.class, args);
        });
    }

    public JikanEpisodeListResponse fetchAnimeEpisodes(int id, int page) {
        return callApiEpisodes(BASE_URL + "/anime/{id}/episodes?page={page}", id, page);
    }

    private JikanEpisodeListResponse callApiEpisodes(String url, Object... args) {
        return guarded(() -> {
            return restTemplate.getForObject(url, JikanEpisodeListResponse.class, args);
        });
    }
}
