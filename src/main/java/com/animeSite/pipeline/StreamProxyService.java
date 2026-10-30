package com.animeSite.pipeline;

import com.animeSite.core.util.UrlValidator;
import com.animeSite.repo.AnimeProviderCacheRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class StreamProxyService {

    private static final Logger log = LoggerFactory.getLogger(StreamProxyService.class);
    private static final int MAX_CACHED_PLAYLIST_KB = 500;
    private static final int MAX_BUFFERED_BODY = 1024 * 1024;
    private static final int COPY_BUFFER = 64 * 1024;
    private static final String DEFAULT_REFERER = "https://anineko.to/";
    /** Redirects are followed manually so every hop is re-validated. */
    private static final int MAX_REDIRECTS = 5;

    private final RestTemplate restTemplate;
    private final ProviderResolver providerResolver;
    private final AnimeProviderCacheRepository cacheRepository;
    private final UrlValidator urlValidator;

    private final ConcurrentHashMap<String, CachedEntry> cache = new ConcurrentHashMap<>();

    public StreamProxyService(@Qualifier("streamProxyRestTemplate") RestTemplate restTemplate,
                               ProviderResolver providerResolver,
                               AnimeProviderCacheRepository cacheRepository,
                               UrlValidator urlValidator) {
        this.restTemplate = restTemplate;
        this.providerResolver = providerResolver;
        this.cacheRepository = cacheRepository;
        this.urlValidator = urlValidator;
    }

    /**
     * Proxies an HLS resource straight into the servlet response.
     *
     * <p>Media segments used to be downloaded completely into a byte[] before
     * the browser received the first byte. On slow CDNs a 1-3 MB segment took
     * several seconds, which delayed the first frame and could even trip the
     * player's stall watchdog. Small bodies (playlists, subtitles, keys and
     * sub-megabyte segments) are still buffered so they can be cached; larger
     * segments are copied through as they arrive.</p>
     */
    public void proxyStream(String url, String referer, String acceptHeader, HttpServletResponse response) {
        if (!urlValidator.isValidStreamUrl(url)) {
            log.warn("[PROXY] BLOCKED_SSRF | url='{}'", url);
            writeText(response, 403, "Forbidden: URL not allowed");
            return;
        }

        long start = System.currentTimeMillis();
        log.info("[PROXY] REQUEST | url='{}' referer='{}'", url, referer);

        String cacheKey = "proxy:" + url;
        CachedEntry cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            long elapsed = System.currentTimeMillis() - start;
            log.info("[PROXY] CACHE_HIT | url='{}' size={} age={}ms duration={}ms",
                url, cached.result().data().length, System.currentTimeMillis() - cached.timestamp(), elapsed);
            writeResult(response, cached.result());
            return;
        }

        String effectiveReferer = referer != null ? referer : DEFAULT_REFERER;

        // The backing RestTemplate has redirects disabled so every hop is
        // surfaced here and re-validated against UrlValidator before we follow
        // it. Without this an allow-listed host could 302 us to an arbitrary
        // (including internal) target.
        String currentUrl = url;
        try {
            for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                final String fetchUrl = currentUrl;
                final AtomicReference<String> redirect = new AtomicReference<>();

                restTemplate.execute(URI.create(fetchUrl), HttpMethod.GET,
                    request -> {
                        HttpHeaders headers = request.getHeaders();
                        headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
                        headers.set("Referer", effectiveReferer);
                        headers.set("Origin", effectiveReferer);
                        if (acceptHeader != null) {
                            headers.set("Accept", acceptHeader);
                        }
                    },
                    resp -> {
                        int status = resp.getStatusCode().value();
                        // Capture the redirect target and let the outer loop
                        // re-validate it; do not write anything yet.
                        if (status >= 300 && status < 400) {
                            String location = resp.getHeaders().getFirst(HttpHeaders.LOCATION);
                            if (location != null) {
                                redirect.set(location);
                                return null;
                            }
                        }
                        MediaType mediaType = resp.getHeaders().getContentType();
                        String contentType = mediaType != null ? mediaType.toString() : "application/octet-stream";
                        // Browser <track> elements refuse WebVTT served as
                        // application/octet-stream, so trust the .vtt extension.
                        if (isWebVtt(fetchUrl, contentType)) {
                            contentType = "text/vtt; charset=utf-8";
                        }
                        long contentLength = resp.getHeaders().getContentLength();
                        InputStream body = resp.getBody();

                        boolean playlistByType = contentType.contains("m3u8")
                            || contentType.contains("vnd.apple.mpegurl");
                        boolean isHtml = contentType.contains("text/html");
                        long elapsed = System.currentTimeMillis() - start;

                        if (playlistByType || fetchUrl.contains(".m3u8")) {
                            byte[] bytes = body.readAllBytes();
                            String text = new String(bytes, StandardCharsets.UTF_8);
                            if (status == 200 && (playlistByType || (bytes.length < MAX_CACHED_PLAYLIST_KB * 1024
                                    && text.contains("#EXTM3U")))) {
                                String baseUrl = HlsPlaylistRewriter.detectBaseUrl(fetchUrl, fetchUrl);
                                String rewritten = HlsPlaylistRewriter.rewritePlaylist(text, baseUrl, referer);
                                ProxyResult result = new ProxyResult(status,
                                    rewritten.getBytes(StandardCharsets.UTF_8),
                                    "application/vnd.apple.mpegurl", elapsed);
                                cache.put(cacheKey, new CachedEntry(result, System.currentTimeMillis(),
                                    TimeUnit.SECONDS.toMillis(30)));
                                writeResult(response, result);
                            } else {
                                writeBody(response, status, contentType, bytes);
                            }
                            logResponse(fetchUrl, status, contentType, bytes.length, elapsed);
                            return null;
                        }

                        if (isHtml) {
                            // Some CDNs disguise media segments as .html and serve
                            // them as text/html. Only genuine HTML documents need
                            // the relaxed CSP and no-store; everything else is
                            // media and should stream like any other segment.
                            if (contentLength > MAX_BUFFERED_BODY) {
                                long copied = streamMedia(response, status, "video/mp2t", contentLength, body);
                                logResponse(fetchUrl, status, "video/mp2t", copied, System.currentTimeMillis() - start);
                                return null;
                            }
                            byte[] bytes = body.readAllBytes();
                            String head = new String(bytes, 0, Math.min(bytes.length, 512),
                                StandardCharsets.UTF_8).trim().toLowerCase(Locale.ROOT);
                            boolean realHtml = head.startsWith("<!doctype") || head.startsWith("<html")
                                || head.startsWith("<head") || head.contains("<body");
                            if (realHtml) {
                                writeHtml(response, status, bytes);
                            } else {
                                writeBody(response, status, "video/mp2t", bytes);
                            }
                            logResponse(fetchUrl, status, realHtml ? "text/html" : "video/mp2t", bytes.length, elapsed);
                            return null;
                        }

                        if (status < 200 || status >= 300) {
                            byte[] bytes = body.readAllBytes();
                            writeBody(response, status, contentType, bytes);
                            logResponse(fetchUrl, status, contentType, bytes.length, elapsed);
                            return null;
                        }

                        if (contentLength >= 0 && contentLength < MAX_BUFFERED_BODY) {
                            byte[] bytes = body.readAllBytes();
                            ProxyResult result = new ProxyResult(status, bytes, contentType, elapsed);
                            cache.put(cacheKey, new CachedEntry(result, System.currentTimeMillis(),
                                TimeUnit.MINUTES.toMillis(5)));
                            writeResult(response, result);
                            logResponse(fetchUrl, status, contentType, bytes.length, elapsed);
                            return null;
                        }

                        // Large segment: stream it through instead of buffering.
                        long copied = streamMedia(response, status, contentType, contentLength, body);
                        logResponse(fetchUrl, status, contentType, copied, System.currentTimeMillis() - start);
                        return null;
                    });

                String location = redirect.get();
                if (location == null) {
                    // Terminal response already written to the client.
                    log.info("[PROXY] COMPLETE | url='{}' duration={}ms", url, System.currentTimeMillis() - start);
                    return;
                }

                String next = URI.create(fetchUrl).resolve(location).toString();
                if (!urlValidator.isValidStreamUrl(next)) {
                    log.warn("[PROXY] BLOCKED_REDIRECT | from='{}' to='{}'", fetchUrl, next);
                    writeText(response, 403, "Forbidden: redirect target not allowed");
                    return;
                }
                log.info("[PROXY] REDIRECT | from='{}' to='{}' (hop {})", fetchUrl, next, hop + 1);
                currentUrl = next;
            }

            log.warn("[PROXY] TOO_MANY_REDIRECTS | url='{}'", url);
            writeText(response, 502, "Proxy error: too many redirects");
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[PROXY] FAILED | url='{}' error='{}' duration={}ms", url, e.getMessage(), elapsed);
            if (!response.isCommitted()) {
                writeText(response, 502, "Proxy error: " + e.getMessage());
            }
        }
    }

    private static long streamMedia(HttpServletResponse response, int status, String contentType,
                                    long contentLength, InputStream body) throws IOException {
        response.setStatus(status);
        response.setContentType(contentType);
        response.setHeader("Cache-Control", "public, max-age=300");
        if (contentLength > 0) {
            response.setContentLengthLong(contentLength);
        }
        return copy(body, response.getOutputStream());
    }

    private static long copy(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[COPY_BUFFER];
        long total = 0;
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
            total += read;
        }
        out.flush();
        return total;
    }

    private static void writeResult(HttpServletResponse response, ProxyResult result) {
        writeBody(response, result.status(), result.contentType(), result.data());
    }

    private static void writeBody(HttpServletResponse response, int status, String contentType, byte[] data) {
        response.setStatus(status);
        response.setContentType(contentType);
        if (status == 200) {
            response.setHeader("Cache-Control", "public, max-age=300");
        } else {
            response.setHeader("Cache-Control", "no-store");
        }
        response.setContentLength(data.length);
        try {
            response.getOutputStream().write(data);
            response.getOutputStream().flush();
        } catch (IOException e) {
            log.warn("[PROXY] WRITE_FAILED | error='{}'", e.getMessage());
        }
    }

    private static void writeHtml(HttpServletResponse response, int status, byte[] data) {
        response.setStatus(status);
        response.setContentType("text/html");
        // Third-party player pages load their own scripts, styles and media
        // from their CDN. The app-wide CSP forbids that, so relax it here.
        response.setHeader("Content-Security-Policy",
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
            "script-src * 'unsafe-inline' 'unsafe-eval' blob:; " +
            "style-src * 'unsafe-inline'; img-src * data: blob:; " +
            "media-src * data: blob:; connect-src *; frame-src *; child-src *;");
        response.setHeader("X-Frame-Options", "");
        response.setHeader("Cache-Control", "no-store");
        response.setContentLength(data.length);
        try {
            response.getOutputStream().write(data);
            response.getOutputStream().flush();
        } catch (IOException e) {
            log.warn("[PROXY] WRITE_FAILED | error='{}'", e.getMessage());
        }
    }

    private static void writeText(HttpServletResponse response, int status, String message) {
        writeBody(response, status, "text/plain", message.getBytes(StandardCharsets.UTF_8));
    }

    private static boolean isWebVtt(String url, String contentType) {
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).contains("text/vtt")) return true;
        int query = url.indexOf('?');
        String path = query >= 0 ? url.substring(0, query) : url;
        return path.toLowerCase(Locale.ROOT).endsWith(".vtt");
    }

    private static void logResponse(String url, int status, String contentType, long size, long duration) {
        log.info("[PROXY] RESPONSE | url='{}' status={} contentType='{}' size={} duration={}ms",
            url, status, contentType, size, duration);
    }

    public void clearCache() {
        cache.clear();
        log.info("[PROXY] CACHE_CLEARED");
    }

    public void clearCacheForUrl(String url) {
        String cacheKey = "proxy:" + url;
        cache.remove(cacheKey);
        log.info("[PROXY] CACHE_CLEARED | url='{}'", url);
    }

    public record ProxyResult(int status, byte[] data, String contentType, long durationMs) {
        public boolean isSuccess() { return status >= 200 && status < 300; }
    }

    private record CachedEntry(ProxyResult result, long timestamp, long ttl) {
        public boolean isExpired() { return System.currentTimeMillis() - timestamp > ttl; }
    }
}
