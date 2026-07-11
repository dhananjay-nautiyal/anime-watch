package com.animeSite.pipeline;

import com.animeSite.persist.Episode;
import com.animeSite.repo.EpisodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class ValidationService {

    private static final Logger log = LoggerFactory.getLogger(ValidationService.class);
    private static final Pattern HLS_PATTERN = Pattern.compile("#EXTM3U", Pattern.CASE_INSENSITIVE);
    private static final Pattern VALID_URL = Pattern.compile("^https?://[^\\s/$.?#].[^\\s]*$");

    private final RestTemplate restTemplate;
    private final EpisodeRepository episodeRepository;

    public ValidationService(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate,
                             EpisodeRepository episodeRepository) {
        this.restTemplate = restTemplate;
        this.episodeRepository = episodeRepository;
    }

    public List<Episode> findEpisodesByMalId(int malId) {
        return episodeRepository.findByAnimeMalIdOrderByEpisodeNumberAsc(malId);
    }

    public boolean episodeBelongsToAnime(int malId, String episodeUrl, int episodeNumber) {
        var ep = episodeRepository.findByAnimeMalIdAndEpisodeNumber(malId, episodeNumber);
        if (ep.isPresent()) {
            return ep.get().getEmbedUrl() != null && ep.get().getEmbedUrl().equals(episodeUrl);
        }
        return false;
    }

    public List<Episode> validateEpisodes(List<Episode> episodes, String context) {
        if (episodes == null || episodes.isEmpty()) {
            log.warn("[VALIDATION] {} | EPISODES_EMPTY", context);
            return new ArrayList<>();
        }
        List<Episode> valid = new ArrayList<>();
        int rejected = 0;
        for (Episode ep : episodes) {
            if (ep.getEpisodeNumber() == null || ep.getEpisodeNumber() <= 0) {
                log.warn("[VALIDATION] {} | INVALID_EP_NUM | epNum={}", context, ep.getEpisodeNumber());
                rejected++;
            } else if (ep.getEmbedUrl() == null || ep.getEmbedUrl().isBlank()) {
                log.warn("[VALIDATION] {} | MISSING_EMBED_URL | epNum={}", context, ep.getEpisodeNumber());
                rejected++;
            } else if (!VALID_URL.matcher(ep.getEmbedUrl()).matches()) {
                log.warn("[VALIDATION] {} | INVALID_EMBED_URL | epNum={} url='{}'", context, ep.getEpisodeNumber(), ep.getEmbedUrl());
                rejected++;
            } else {
                valid.add(ep);
            }
        }
        if (rejected > 0) {
            log.warn("[VALIDATION] {} | {}/{} episodes failed validation", context, rejected, episodes.size());
        }
        return valid;
    }

    public StreamValidation validateStreamUrl(String url, String context) {
        if (url == null || url.isBlank()) {
            return StreamValidation.invalid("URL_EMPTY", "Stream URL is empty");
        }
        if (!VALID_URL.matcher(url).matches()) {
            return StreamValidation.invalid("URL_INVALID", "Malformed URL: " + url);
        }

        if (url.contains(".m3u8")) {
            return validateHlsStream(url, context);
        }
        if (url.contains("megaplay") || url.contains("vivibebe") || url.contains("otakuhg")) {
            return StreamValidation.valid("EMBED", url);
        }

        return StreamValidation.valid("UNKNOWN", url);
    }

    public StreamValidation validateHlsStream(String url, String context) {
        long start = System.currentTimeMillis();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            headers.set("Referer", "https://anineko.to/");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                URI.create(url), HttpMethod.GET, entity, String.class);

            long elapsed = System.currentTimeMillis() - start;

            if (!response.getStatusCode().is2xxSuccessful()) {
                log.warn("[VALIDATION] {} | HLS_HTTP_{} | duration={}ms", context, response.getStatusCode().value(), elapsed);
                return StreamValidation.invalid("HLS_HTTP_" + response.getStatusCode().value(),
                    "HTTP " + response.getStatusCode().value() + " for HLS playlist");
            }

            String body = response.getBody();
            if (body == null || body.isBlank()) {
                log.warn("[VALIDATION] {} | HLS_EMPTY | duration={}ms", context, elapsed);
                return StreamValidation.invalid("HLS_EMPTY", "HLS playlist is empty");
            }

            if (!HLS_PATTERN.matcher(body).find()) {
                log.warn("[VALIDATION] {} | HLS_NO_EXTM3U | preview='{}' | duration={}ms",
                    context, body.substring(0, Math.min(100, body.length())).replace('\n', ' '), elapsed);
                return StreamValidation.invalid("HLS_NO_EXTM3U", "Not a valid HLS playlist");
            }

            log.info("[VALIDATION] {} | HLS_VALID | length={} lines={} | duration={}ms",
                context, body.length(), body.split("\n").length, elapsed);
            return StreamValidation.valid("HLS", url);

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[VALIDATION] {} | HLS_CHECK_FAILED | error='{}' | duration={}ms", context, e.getMessage(), elapsed);
            return StreamValidation.invalid("HLS_CHECK_FAILED", e.getMessage());
        }
    }

    public static class StreamValidation {
        public final boolean valid;
        public final String type;
        public final String url;
        public final String errorCode;
        public final String errorMessage;

        private StreamValidation(boolean valid, String type, String url, String errorCode, String errorMessage) {
            this.valid = valid;
            this.type = type;
            this.url = url;
            this.errorCode = errorCode;
            this.errorMessage = errorMessage;
        }

        static StreamValidation valid(String type, String url) {
            return new StreamValidation(true, type, url, null, null);
        }

        static StreamValidation invalid(String code, String msg) {
            return new StreamValidation(false, null, null, code, msg);
        }
    }
}
