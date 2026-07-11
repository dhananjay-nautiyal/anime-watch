package com.animeSite.pipeline;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanSingleResponse;
import com.animeSite.persist.AnimeProviderCache;
import com.animeSite.repo.AnimeProviderCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

@Service
public class ReleaseDetector {

    private static final Logger log = LoggerFactory.getLogger(ReleaseDetector.class);
    private final JikanApiClient jikanApiClient;
    private final AnimeProviderCacheRepository cacheRepository;

    public ReleaseDetector(JikanApiClient jikanApiClient, AnimeProviderCacheRepository cacheRepository) {
        this.jikanApiClient = jikanApiClient;
        this.cacheRepository = cacheRepository;
    }

    public AnimeState detectState(int malId) {
        try {
            JikanSingleResponse response = jikanApiClient.fetchAnimeById(malId);
            if (response == null || response.getData() == null) return AnimeState.UNKNOWN;
            JikanAnimeData data = response.getData();
            return detectStateFromData(malId, data);
        } catch (Exception e) {
            log.warn("[STATE] FETCH_FAILED | malId={} error='{}'", malId, e.getMessage());
            return AnimeState.UNKNOWN;
        }
    }

    public AnimeState detectStateFromData(int malId, JikanAnimeData data) {
        if (data == null) return AnimeState.UNKNOWN;

        String status = data.getStatus();
        String airedFrom = data.getAired() != null ? data.getAired().getFrom() : null;
        LocalDate releaseDate = parseDate(airedFrom);
        LocalDate today = LocalDate.now();

        log.info("[STATE] CHECK | malId={} title='{}' status='{}' airedFrom='{}'",
            malId, data.getTitle(), status, airedFrom);

        // Check Jikan status
        if ("Not yet aired".equalsIgnoreCase(status) || "upcoming".equalsIgnoreCase(status)) {
            if (releaseDate != null) {
                if (releaseDate.isAfter(today)) {
                    log.info("[STATE] COMING_SOON | malId={} releaseDate={}", malId, releaseDate);
                    return AnimeState.COMING_SOON;
                } else {
                    log.info("[STATE] NOT_RELEASED | malId={} releaseDate={} (past)", malId, releaseDate);
                    return AnimeState.NOT_RELEASED;
                }
            }
            log.info("[STATE] NOT_RELEASED | malId={} (no release date)", malId);
            return AnimeState.NOT_RELEASED;
        }

        if ("Currently Airing".equalsIgnoreCase(status) || "airing".equalsIgnoreCase(status)) {
            log.info("[STATE] AIRING | malId={}", malId);
            return AnimeState.AIRING;
        }

        if ("Finished Airing".equalsIgnoreCase(status) || "complete".equalsIgnoreCase(status)) {
            log.info("[STATE] FINISHED | malId={}", malId);
            return AnimeState.FINISHED;
        }

        // Check provider cache for availability
        AnimeProviderCache cache = cacheRepository.findByMalId(malId).orElse(null);
        if (cache != null && !cache.isExpired()) {
            if (cache.isStreamable() && cache.getEpisodeCount() > 0) {
                log.info("[STATE] AVAILABLE | malId={} provider={} count={}", malId, cache.getProvider(), cache.getEpisodeCount());
                return AnimeState.AVAILABLE;
            }
            if (!cache.isStreamable()) {
                log.info("[STATE] PROVIDER_DOWN | malId={}", malId);
                return AnimeState.PROVIDER_DOWN;
            }
        }

        log.info("[STATE] UNKNOWN | malId={}", malId);
        return AnimeState.UNKNOWN;
    }

    public boolean isComingSoon(int malId) {
        return detectState(malId) == AnimeState.COMING_SOON;
    }

    public boolean isReleased(int malId) {
        AnimeState state = detectState(malId);
        return state == AnimeState.AIRING || state == AnimeState.FINISHED || state == AnimeState.AVAILABLE;
    }

    public boolean shouldSkipProviderLookup(int malId) {
        AnimeState state = detectState(malId);
        boolean skip = state == AnimeState.COMING_SOON || state == AnimeState.NOT_RELEASED;
        if (skip) {
            log.info("[STATE] SKIP_PROVIDER | malId={} state={}", malId, state);
        }
        return skip;
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            return LocalDate.parse(dateStr.substring(0, 10), DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException | StringIndexOutOfBoundsException e) {
            try {
                return LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX"));
            } catch (DateTimeParseException e2) {
                log.debug("[STATE] PARSE_FAILED | dateStr='{}'", dateStr);
                return null;
            }
        }
    }

    public AnimeInfo getAnimeInfo(int malId) {
        try {
            JikanSingleResponse response = jikanApiClient.fetchAnimeById(malId);
            if (response == null || response.getData() == null) return null;
            JikanAnimeData data = response.getData();
            AnimeState state = detectStateFromData(malId, data);
            LocalDate releaseDate = parseDate(data.getAired() != null ? data.getAired().getFrom() : null);
            return new AnimeInfo(
                data.getMalId(),
                data.getTitle(),
                data.getTitleEnglish(),
                state,
                releaseDate,
                data.getSynopsis(),
                data.getScore(),
                data.getEpisodes(),
                data.getStatus(),
                data.getType(),
                data.getYear(),
                data.getTrailer() != null ? data.getTrailer().getUrl() : null,
                data.getTrailer() != null ? data.getTrailer().getEmbedUrl() : null,
                data.getImages() != null && data.getImages().getJpg() != null ? data.getImages().getJpg().getLargeImageUrl() : null,
                data.getImages() != null && data.getImages().getJpg() != null ? data.getImages().getJpg().getImageUrl() : null,
                data.getGenres(),
                data.getStudios(),
                data.getDuration(),
                data.getAired() != null ? data.getAired().getAiredString() : null
            );
        } catch (Exception e) {
            log.warn("[STATE] INFO_FAILED | malId={} error='{}'", malId, e.getMessage());
            return null;
        }
    }

    public record AnimeInfo(
        int malId,
        String title,
        String titleEnglish,
        AnimeState state,
        LocalDate releaseDate,
        String synopsis,
        Double score,
        Integer episodes,
        String status,
        String type,
        Integer year,
        String trailerUrl,
        String trailerEmbedUrl,
        String largeImageUrl,
        String imageUrl,
        java.util.List<JikanAnimeData.Genre> genres,
        java.util.List<JikanAnimeData.Studio> studios,
        String duration,
        String aired
    ) {}
}
