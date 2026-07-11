package com.animeSite.pipeline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class HlsPlaylistRewriter {

    private static final Logger log = LoggerFactory.getLogger(HlsPlaylistRewriter.class);
    private static final String PROXY_BASE = "/api/stream/proxy";

    private static final Pattern URI_QUOTED = Pattern.compile("URI=\"([^\"]+)\"");
    private static final Pattern URI_SQUOTED = Pattern.compile("URI='([^']+)'");

    private static final String[] SUBTITLE_EXTS = {".vtt", ".srt", ".ass", ".ssa", ".smi"};
    private static final String[] SEGMENT_EXTS = {".ts", ".aac", ".mp3", ".ac3", ".ec3", ".m4s"};
    private static final String[] PLAYLIST_EXTS = {".m3u8"};

    public static String rewritePlaylist(String playlist, String baseUrl, String referer) {
        if (playlist == null || playlist.isBlank()) return playlist;

        StringBuilder rewritten = new StringBuilder();
        String[] lines = playlist.split("\n");

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("</")) {
                rewritten.append(line).append("\n");
                continue;
            }

            // Rewrite URI="..." inside HLS tags
            if (trimmed.startsWith("#")) {
                String processed = rewriteQuotedUris(trimmed, baseUrl, referer);
                rewritten.append(processed).append("\n");
                continue;
            }

            // Treat as direct URL (segment or variant playlist)
            String rewrittenUrl = rewriteUrl(trimmed, baseUrl, referer);
            rewritten.append(rewrittenUrl).append("\n");
        }

        return rewritten.toString();
    }

    private static String rewriteQuotedUris(String line, String baseUrl, String referer) {
        // Rewrite URI="..." patterns
        Matcher m = URI_QUOTED.matcher(line);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String uri = m.group(1);
            String rewritten = isAbsolute(uri) ? rewriteAbsoluteUrl(uri, referer) : rewriteUrl(uri, baseUrl, referer);
            m.appendReplacement(sb, Matcher.quoteReplacement("URI=\"" + rewritten + "\""));
        }
        m.appendTail(sb);

        // Rewrite URI='...' patterns
        m = URI_SQUOTED.matcher(sb.toString());
        sb = new StringBuffer();
        while (m.find()) {
            String uri = m.group(1);
            String rewritten = isAbsolute(uri) ? rewriteAbsoluteUrl(uri, referer) : rewriteUrl(uri, baseUrl, referer);
            m.appendReplacement(sb, Matcher.quoteReplacement("URI='" + rewritten + "'"));
        }
        m.appendTail(sb);

        return sb.toString();
    }

    private static boolean isAbsolute(String url) {
        return url.startsWith("http://") || url.startsWith("https://");
    }

    private static String rewriteUrl(String url, String baseUrl, String referer) {
        if (isAbsolute(url)) {
            return rewriteAbsoluteUrl(url, referer);
        }
        String resolved = resolveUrl(baseUrl, url);
        return rewriteAbsoluteUrl(resolved, referer);
    }

    private static String rewriteAbsoluteUrl(String url, String referer) {
        return PROXY_BASE + "?url=" + encodeUrl(url) + "&referer=" + encodeUrl(referer != null ? referer : url.substring(0, url.lastIndexOf('/') + 1));
    }

    private static String resolveUrl(String base, String relative) {
        try {
            URI baseUri = new URI(base);
            URI resolved = baseUri.resolve(relative);
            return resolved.toString();
        } catch (Exception e) {
            log.warn("[HLS] URL_RESOLVE_FAILED base='{}' relative='{}' error='{}'", base, relative, e.getMessage());
            String baseDir = base.contains("/") ? base.substring(0, base.lastIndexOf('/') + 1) : base + "/";
            return baseDir + relative;
        }
    }

    public static String encodeUrl(String url) {
        return java.net.URLEncoder.encode(url, java.nio.charset.StandardCharsets.UTF_8);
    }

    public static String detectBaseUrl(String episodeUrl, String streamUrl) {
        try {
            URI uri = new URI(streamUrl != null ? streamUrl : episodeUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            int port = uri.getPort();
            String path = uri.getPath();
            int lastSlash = path != null ? path.lastIndexOf('/') : -1;
            String basePath = lastSlash > 0 ? path.substring(0, lastSlash + 1) : "/";
            if (port > 0 && port != 80 && port != 443) {
                return scheme + "://" + host + ":" + port + basePath;
            }
            return scheme + "://" + host + basePath;
        } catch (Exception e) {
            log.warn("[HLS] BASE_URL_DETECT_FAILED error='{}'", e.getMessage());
            String fallback = episodeUrl != null ? episodeUrl : streamUrl;
            if (fallback != null && fallback.contains("/")) {
                return fallback.substring(0, fallback.lastIndexOf('/') + 1);
            }
            return fallback != null ? fallback + "/" : "/";
        }
    }
}
