package com.animeSite.pipeline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class StreamVerificationService {

    private static final Logger log = LoggerFactory.getLogger(StreamVerificationService.class);

    private static final Pattern HLS_PLAYLIST = Pattern.compile("#EXTM3U", Pattern.CASE_INSENSITIVE);
    private static final Pattern VARIANT_STREAM = Pattern.compile("#EXT-X-STREAM-INF", Pattern.CASE_INSENSITIVE);
    private static final Pattern URI_LINE = Pattern.compile("^(?!\\s*#)(https?://\\S+)", Pattern.MULTILINE);
    private static final Pattern EXTINF = Pattern.compile("#EXTINF:\\s*([\\d.]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern EXT_X_KEY = Pattern.compile("#EXT-X-KEY.*URI=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern EXT_X_MEDIA_SUBTITLE = Pattern.compile(
        "#EXT-X-MEDIA:TYPE=SUBTITLES.*URI=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);

    private static final Set<String> VALID_CONTENT_TYPES = Set.of(
        "application/vnd.apple.mpegurl", "application/x-mpegurl",
        "video/mp2t", "video/mp4", "audio/mp4", "audio/aac", "audio/mpeg",
        "text/vtt", "application/octet-stream", "video/MP2T"
    );

    private static final int MAX_SEGMENTS_TO_VERIFY = 2;
    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int READ_TIMEOUT_MS = 8000;

    private final RestTemplate restTemplate;
    private final TelemetryService telemetry;

    public StreamVerificationService(
            @Qualifier("aninekoRestTemplate") RestTemplate restTemplate,
            TelemetryService telemetry) {
        this.restTemplate = restTemplate;
        this.telemetry = telemetry;
    }

    public VerificationResult verify(StreamResult streamResult, String referer) {
        long start = System.currentTimeMillis();
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (streamResult == null) {
            return new VerificationResult(false, "Stream result is null", errors, warnings, 0);
        }

        String primaryUrl = streamResult.getPrimaryUrl();
        if (primaryUrl == null || primaryUrl.isBlank()) {
            return new VerificationResult(false, "No primary stream URL", errors, warnings, 0);
        }

        String type = streamResult.getType();
        if (type == null) type = "hls";

        if ("hls".equalsIgnoreCase(type)) {
            return verifyHlsStream(primaryUrl, referer, start);
        } else if ("iframe".equalsIgnoreCase(type)) {
            return verifyIframeUrl(primaryUrl, start);
        } else if ("mp4".equalsIgnoreCase(type)) {
            return verifyDirectUrl(primaryUrl, start);
        }

        return new VerificationResult(true, "Unknown stream type, accepted", errors, warnings,
            System.currentTimeMillis() - start);
    }

    private VerificationResult verifyHlsStream(String url, String referer, long start) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Set<String> verifiedUrls = new LinkedHashSet<>();

        // 1. Verify master playlist
        HttpResult master = fetchUrl(url, referer);
        if (!master.success) {
            telemetry.recordStreamValidationFailure("MASTER_PLAYLIST", master.statusCode);
            return new VerificationResult(false,
                "Master playlist unreachable: HTTP " + master.statusCode, errors, warnings,
                System.currentTimeMillis() - start);
        }

        if (!isValidPlaylist(master.body, master.contentType)) {
            telemetry.recordStreamValidationFailure("INVALID_MASTER", 0);
            return new VerificationResult(false,
                "Invalid master playlist content", errors, warnings,
                System.currentTimeMillis() - start);
        }

        verifiedUrls.add(url);
        String baseUrl = HlsPlaylistRewriter.detectBaseUrl(url, url);

        // 2. Extract and verify variant playlists
        List<String> variantUrls = extractVariantUrls(master.body, baseUrl);
        if (!variantUrls.isEmpty()) {
            for (int i = 0; i < variantUrls.size(); i++) {
                String vUrl = variantUrls.get(i);
                if (!verifiedUrls.add(vUrl)) continue;
                HttpResult variant = fetchUrl(vUrl, referer);
                if (!variant.success) {
                    warnings.add("Variant " + i + " unreachable: HTTP " + variant.statusCode);
                    continue;
                }
                if (!isValidPlaylist(variant.body, variant.contentType)) {
                    warnings.add("Variant " + i + " invalid content");
                    continue;
                }
                // 3. Verify a sample media segment from this variant
                List<String> segments = extractSegmentUrls(variant.body,
                    HlsPlaylistRewriter.detectBaseUrl(vUrl, vUrl));
                int verified = 0;
                for (String segUrl : segments) {
                    if (!verifiedUrls.add(segUrl)) continue;
                    if (verified >= MAX_SEGMENTS_TO_VERIFY) break;
                    HttpResult seg = fetchUrl(segUrl, referer);
                    if (!seg.success) {
                        warnings.add("Segment " + seg.statusCode + " unreachable: HTTP " + seg.statusCode);
                        continue;
                    }
                    if (seg.body == null || seg.length == 0) {
                        warnings.add("Empty segment at " + segUrl);
                        continue;
                    }
                    verified++;
                }
            }
        } else {
            // No variants — this might be a single-quality playlist. Verify segments directly.
            List<String> segments = extractSegmentUrls(master.body, baseUrl);
            int verified = 0;
            for (String segUrl : segments) {
                if (!verifiedUrls.add(segUrl)) continue;
                if (verified >= MAX_SEGMENTS_TO_VERIFY) break;
                HttpResult seg = fetchUrl(segUrl, referer);
                if (!seg.success) {
                    warnings.add("Segment unreachable: HTTP " + seg.statusCode);
                    continue;
                }
                verified++;
            }
        }

        // 4. Verify subtitle playlists
        List<String> subtitleUrls = extractSubtitleUrls(master.body, baseUrl);
        for (String subUrl : subtitleUrls) {
            if (!verifiedUrls.add(subUrl)) continue;
            HttpResult sub = fetchUrl(subUrl, referer);
            if (!sub.success) {
                warnings.add("Subtitle playlist unreachable: HTTP " + sub.statusCode);
                continue;
            }
            if (sub.body == null || sub.length == 0) {
                warnings.add("Empty subtitle playlist");
                continue;
            }
        }

        // 5. Verify encryption keys
        List<String> keyUrls = extractKeyUrls(master.body, baseUrl);
        for (String variantUrl : variantUrls) {
            HttpResult vr = fetchUrl(variantUrl, referer);
            if (vr.success) {
                String vBase = HlsPlaylistRewriter.detectBaseUrl(variantUrl, variantUrl);
                keyUrls.addAll(extractKeyUrls(vr.body, vBase));
            }
        }
        for (String keyUrl : keyUrls) {
            if (!verifiedUrls.add(keyUrl)) continue;
            HttpResult key = fetchUrl(keyUrl, referer);
            if (!key.success) {
                warnings.add("Encryption key unreachable: HTTP " + key.statusCode);
                continue;
            }
            if (key.body == null || key.length < 16) {
                warnings.add("Encryption key too short (" + key.length + " bytes)");
                continue;
            }
        }

        long elapsed = System.currentTimeMillis() - start;
        boolean passed = errors.isEmpty();
        if (passed) {
            log.info("[STREAM_VERIFY] PASSED | urlsVerified={} segmentsVerified={} warnings={} duration={}ms",
                verifiedUrls.size(), MAX_SEGMENTS_TO_VERIFY, warnings.size(), elapsed);
        } else {
            log.warn("[STREAM_VERIFY] FAILED | errors={} warnings={} duration={}ms", errors.size(), warnings.size(), elapsed);
        }

        return new VerificationResult(passed, passed ? "Stream verified" : "Stream verification failed: " + errors,
            errors, warnings, elapsed);
    }

    private VerificationResult verifyIframeUrl(String url, long start) {
        HttpResult result = fetchUrl(url, null);
        long elapsed = System.currentTimeMillis() - start;
        if (result.success) {
            return new VerificationResult(true, "Embed URL reachable", List.of(), List.of(), elapsed);
        }
        telemetry.recordStreamValidationFailure("IFRAME_UNREACHABLE", result.statusCode);
        return new VerificationResult(false, "Embed URL unreachable: HTTP " + result.statusCode, List.of(), List.of(), elapsed);
    }

    private VerificationResult verifyDirectUrl(String url, long start) {
        HttpResult result = fetchUrl(url, null);
        long elapsed = System.currentTimeMillis() - start;
        if (result.success && isValidMediaContent(result.contentType)) {
            return new VerificationResult(true, "Direct URL verified", List.of(), List.of(), elapsed);
        }
        telemetry.recordStreamValidationFailure("DIRECT_URL_FAILED", result.statusCode);
        return new VerificationResult(false, "Direct URL verification failed: HTTP " + result.statusCode, List.of(), List.of(), elapsed);
    }

    private boolean isValidPlaylist(String body, String contentType) {
        if (body == null || body.isBlank()) return false;
        return HLS_PLAYLIST.matcher(body).find();
    }

    private boolean isValidMediaContent(String contentType) {
        if (contentType == null) return true;
        String ct = contentType.toLowerCase();
        return VALID_CONTENT_TYPES.stream().anyMatch(ct::startsWith) || ct.contains("octet-stream");
    }

    private List<String> extractVariantUrls(String playlist, String baseUrl) {
        List<String> urls = new ArrayList<>();
        String[] lines = playlist.split("\n");
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (VARIANT_STREAM.matcher(line).find() && i + 1 < lines.length) {
                String next = lines[i + 1].trim();
                if (!next.startsWith("#") && !next.isEmpty()) {
                    urls.add(resolveUrl(baseUrl, next));
                }
            }
        }
        return urls;
    }

    private List<String> extractSegmentUrls(String playlist, String baseUrl) {
        List<String> urls = new ArrayList<>();
        String[] lines = playlist.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("#") && !trimmed.isEmpty()) {
                String resolved = resolveUrl(baseUrl, trimmed);
                if (isSegmentUrl(resolved)) {
                    urls.add(resolved);
                }
            }
        }
        return urls;
    }

    private boolean isSegmentUrl(String url) {
        String lower = url.toLowerCase();
        for (String ext : SEGMENT_EXTS) {
            if (lower.contains(ext)) return true;
        }
        return false;
    }

    private List<String> extractSubtitleUrls(String playlist, String baseUrl) {
        List<String> urls = new ArrayList<>();
        Matcher m = EXT_X_MEDIA_SUBTITLE.matcher(playlist);
        while (m.find()) {
            urls.add(resolveUrl(baseUrl, m.group(1)));
        }
        return urls;
    }

    private List<String> extractKeyUrls(String playlist, String baseUrl) {
        List<String> urls = new ArrayList<>();
        Matcher m = EXT_X_KEY.matcher(playlist);
        while (m.find()) {
            urls.add(resolveUrl(baseUrl, m.group(1)));
        }
        return urls;
    }

    private String resolveUrl(String base, String relative) {
        try {
            URI baseUri = new URI(base);
            URI resolved = baseUri.resolve(relative);
            return resolved.toString();
        } catch (Exception e) {
            String baseDir = base.contains("/") ? base.substring(0, base.lastIndexOf('/') + 1) : base + "/";
            return baseDir + relative;
        }
    }

    private HttpResult fetchUrl(String url, String referer) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            headers.set("Referer", referer != null ? referer : "https://anineko.to/");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                URI.create(url), HttpMethod.GET, entity, byte[].class);

            String contentType = response.getHeaders().getContentType() != null
                ? response.getHeaders().getContentType().toString() : "";

            byte[] body = response.getBody();
            return new HttpResult(response.getStatusCode().is2xxSuccessful(),
                response.getStatusCode().value(), body != null ? new String(body, java.nio.charset.StandardCharsets.UTF_8) : "",
                contentType, body != null ? body.length : 0);
        } catch (Exception e) {
            return new HttpResult(false, 0, "", "", 0);
        }
    }

    private static final String[] SEGMENT_EXTS = {".ts", ".aac", ".mp3", ".ac3", ".ec3", ".m4s", ".mp4"};

    public record VerificationResult(boolean valid, String message, List<String> errors,
                                      List<String> warnings, long durationMs) {}

    private record HttpResult(boolean success, int statusCode, String body, String contentType, int length) {}

    public record VerifiedStream(String type, String url, boolean hlsValid, boolean segmentsValid,
                                  boolean subtitlesValid, boolean keysValid, long durationMs) {}
}
