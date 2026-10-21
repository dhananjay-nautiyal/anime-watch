package com.animeSite.pipeline;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolves a MegaPlay embed page into a direct HLS playlist.
 *
 * <p>MegaPlay embed pages (the ones AnimeSuge stores) are hotlink protected and
 * load their player from their own origin, so they cannot be framed directly and
 * they cannot be served through our HTML proxy either: their player calls
 * {@code /stream/getSources} from a foreign origin and the endpoint rejects it
 * (HTTP 403, "accepts only AJAX requests"). That left the video stuck at 0:00
 * behind a spinner.
 *
 * <p>This resolver does the same work server side: read the page, find the
 * internal file id, call {@code getSources} with the required headers, decrypt
 * the payload (AES-256-CBC with MegaPlay's public trust key/IV) and return the
 * real {@code .m3u8} URL. The CDN allows {@code *} origins, so our own HLS
 * player (through the stream proxy) can play it.
 */
@Service
public class MegaPlayResolver {

    private static final Logger log = LoggerFactory.getLogger(MegaPlayResolver.class);

    private static final Pattern DATA_ID = Pattern.compile("data-id=\"(\\d+)\"");
    private static final Pattern HOST = Pattern.compile("^https?://([^/]+)/stream/", Pattern.CASE_INSENSITIVE);

    private static final String REFERER = "https://anikototv.to/";
    private static final String AES_KEY = "i?LMTAx0Q6,:}50U";
    private static final String AES_IV = "W0;27ToaUpl_P%'c";

    private static final long SUCCESS_TTL_MS = 5 * 60 * 1000L;
    private static final long FAILURE_TTL_MS = 60 * 1000L;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private record CacheEntry(String hlsUrl, long expiresAt) {
        boolean expired() { return System.currentTimeMillis() > expiresAt; }
        boolean valid() { return hlsUrl != null && !expired(); }
    }

    public MegaPlayResolver(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate,
                            ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    /** True when the URL is a MegaPlay embed page this resolver understands. */
    public boolean supports(String url) {
        return url != null && HOST.matcher(url).find() && url.toLowerCase().contains("megaplay");
    }

    /**
     * Resolve an embed page to a direct HLS URL. Returns empty when the page is
     * dead (HTTP 410 / "Error - MegaPlay") or the payload cannot be decrypted.
     */
    public Optional<String> resolve(String embedUrl) {
        if (!supports(embedUrl)) return Optional.empty();

        CacheEntry cached = cache.get(embedUrl);
        if (cached != null && !cached.expired()) {
            return cached.hlsUrl() != null ? Optional.of(cached.hlsUrl()) : Optional.empty();
        }

        try {
            String page = fetchPage(embedUrl);
            if (page == null) {
                cache.put(embedUrl, new CacheEntry(null, System.currentTimeMillis() + FAILURE_TTL_MS));
                return Optional.empty();
            }

            Matcher idMatcher = DATA_ID.matcher(page);
            if (!idMatcher.find()) {
                log.debug("[MEGAPLAY] NO_FILE_ID | url={}", embedUrl);
                cache.put(embedUrl, new CacheEntry(null, System.currentTimeMillis() + FAILURE_TTL_MS));
                return Optional.empty();
            }
            String fileId = idMatcher.group(1);
            String host = hostOf(embedUrl);

            String payload = fetchSources(host, fileId);
            if (payload == null) {
                cache.put(embedUrl, new CacheEntry(null, System.currentTimeMillis() + FAILURE_TTL_MS));
                return Optional.empty();
            }

            String hlsUrl = decryptFile(payload);
            if (hlsUrl == null) {
                cache.put(embedUrl, new CacheEntry(null, System.currentTimeMillis() + FAILURE_TTL_MS));
                return Optional.empty();
            }

            cache.put(embedUrl, new CacheEntry(hlsUrl, System.currentTimeMillis() + SUCCESS_TTL_MS));
            log.info("[MEGAPLAY] RESOLVED | fileId={} hls={}", fileId, hlsUrl);
            return Optional.of(hlsUrl);

        } catch (Exception e) {
            log.warn("[MEGAPLAY] RESOLVE_FAILED | url={} error='{}'", embedUrl, e.getMessage());
            cache.put(embedUrl, new CacheEntry(null, System.currentTimeMillis() + FAILURE_TTL_MS));
            return Optional.empty();
        }
    }

    /** Convenience for language probing: does this embed page actually exist? */
    public boolean isAvailable(String embedUrl) {
        return resolve(embedUrl).isPresent();
    }

    /** Build the sibling language URL, e.g. .../sub -> .../dub. */
    public static String withLanguage(String embedUrl, String language) {
        if (embedUrl == null) return null;
        String lower = embedUrl.toLowerCase();
        if (lower.endsWith("/sub")) return embedUrl.substring(0, embedUrl.length() - 4) + "/" + language;
        if (lower.endsWith("/dub")) return embedUrl.substring(0, embedUrl.length() - 4) + "/" + language;
        return null;
    }

    private String fetchPage(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.REFERER, REFERER);
        headers.set(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        ResponseEntity<String> response = restTemplate.exchange(
            URI.create(url), HttpMethod.GET, new HttpEntity<>(headers), String.class);
        String body = response.getBody();
        if (body == null || body.contains("Error - MegaPlay") || body.contains("Error Code: 410")) {
            return null;
        }
        return body;
    }

    private String fetchSources(String host, String fileId) {
        String url = "https://" + host + "/stream/getSources?id=" + fileId + "&platform=OTHER";
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.REFERER, REFERER);
        headers.set(HttpHeaders.ACCEPT, "application/json, text/javascript, */*; q=0.01");
        // MegaPlay rejects requests without this header with HTTP 403.
        headers.set("X-Requested-With", "XMLHttpRequest");
        ResponseEntity<String> response = restTemplate.exchange(
            URI.create(url), HttpMethod.GET, new HttpEntity<>(headers), String.class);
        return response.getBody();
    }

    private String decryptFile(String json) throws Exception {
        JsonNode root = objectMapper.readTree(json);
        String encrypted = root.path("enc").asText(null);
        if (encrypted == null || encrypted.isBlank()) {
            // Some responses already carry the plain file URL.
            String plain = root.path("file").asText(null);
            return plain != null && !plain.isBlank() ? plain : null;
        }

        byte[] key = Arrays.copyOf(AES_KEY.getBytes(StandardCharsets.UTF_8), 32);
        byte[] iv = Arrays.copyOf(AES_IV.getBytes(StandardCharsets.UTF_8), 16);
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));

        byte[] plainBytes = cipher.doFinal(Base64.getUrlDecoder().decode(encrypted));
        JsonNode payload = objectMapper.readTree(new String(plainBytes, StandardCharsets.UTF_8));
        String file = payload.path("file").asText(null);
        return file != null && !file.isBlank() ? file : null;
    }

    private String hostOf(String url) {
        Matcher matcher = HOST.matcher(url);
        if (matcher.find()) return matcher.group(1);
        return "megaplay.buzz";
    }
}
