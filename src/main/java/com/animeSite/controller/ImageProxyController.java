package com.animeSite.controller;

import com.animeSite.core.util.UrlValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Proxies MyAnimeList images so the browser never makes a cross-origin call.
 *
 * <p>Redirects are deliberately NOT followed automatically. An allow-listed
 * host could otherwise 302 us to an arbitrary (including internal) target, so
 * every hop's {@code Location} is re-validated against
 * {@link UrlValidator#isValidImageUrl} before we follow it, up to a small hop
 * limit. The response body is also size-capped so a hostile endpoint cannot
 * exhaust memory.</p>
 */
@RestController
@RequestMapping("/api/image-proxy")
public class ImageProxyController {

    private static final Logger log = LoggerFactory.getLogger(ImageProxyController.class);

    /** Redirects are followed manually so each hop is re-validated. */
    private static final int MAX_REDIRECTS = 5;

    private final UrlValidator urlValidator;
    private final long maxImageBytes;
    private final Duration requestTimeout;

    private final HttpClient client = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NEVER)
        .connectTimeout(Duration.ofSeconds(5))
        .build();

    public ImageProxyController(
            UrlValidator urlValidator,
            @Value("${app.proxy.max-image-bytes:10485760}") long maxImageBytes,
            @Value("${app.proxy.image-timeout-ms:10000}") long imageTimeoutMs) {
        this.urlValidator = urlValidator;
        this.maxImageBytes = maxImageBytes;
        this.requestTimeout = Duration.ofMillis(imageTimeoutMs);
    }

    @GetMapping
    public ResponseEntity<byte[]> proxyImage(@RequestParam String url) {
        String current = url;
        try {
            for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                if (!urlValidator.isValidImageUrl(current)) {
                    log.warn("[IMAGE_PROXY] BLOCKED | url='{}'", current);
                    return ResponseEntity.badRequest().build();
                }

                HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(current))
                    .timeout(requestTimeout)
                    .header("User-Agent", "Mozilla/5.0")
                    .header("Referer", "https://myanimelist.net/")
                    .GET()
                    .build();
                HttpResponse<InputStream> res = client.send(req, HttpResponse.BodyHandlers.ofInputStream());
                int status = res.statusCode();

                // Re-validate and follow each redirect hop explicitly.
                if (status >= 300 && status < 400) {
                    String location = res.headers().firstValue("Location").orElse(null);
                    res.body().close();
                    if (location == null) {
                        return ResponseEntity.badRequest().build();
                    }
                    current = URI.create(current).resolve(location).toString();
                    continue;
                }

                if (status < 200 || status >= 300) {
                    res.body().close();
                    return ResponseEntity.status(status).build();
                }

                byte[] body = readCapped(res.body(), maxImageBytes);
                if (body == null) {
                    log.warn("[IMAGE_PROXY] TOO_LARGE | url='{}' cap={}", current, maxImageBytes);
                    return ResponseEntity.status(413).build();
                }

                String contentType = res.headers().firstValue("Content-Type").orElse("image/jpeg");
                return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .header("X-Content-Type-Options", "nosniff")
                    .body(body);
            }

            log.warn("[IMAGE_PROXY] TOO_MANY_REDIRECTS | url='{}'", url);
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.warn("[IMAGE_PROXY] FAILED | url='{}' error='{}'", url, e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Reads at most {@code cap} bytes, returning {@code null} if the body
     * exceeds the cap. Guards against endpoints that omit (or lie about)
     * {@code Content-Length}.
     */
    private static byte[] readCapped(InputStream in, long cap) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        long total = 0;
        int read;
        while ((read = in.read(buffer)) != -1) {
            total += read;
            if (total > cap) {
                return null;
            }
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }
}
