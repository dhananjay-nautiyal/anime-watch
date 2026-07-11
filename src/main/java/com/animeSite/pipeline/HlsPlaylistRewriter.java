package com.animeSite.pipeline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.net.URI;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

public class HlsPlaylistRewriter {

    private static final Logger log = LoggerFactory.getLogger(HlsPlaylistRewriter.class);
    private static final String PROXY_BASE = "/api/stream/proxy";
    
    public static String rewritePlaylist(String playlist, String baseUrl, String referer) {
        if (playlist == null || playlist.isBlank()) return playlist;
        
        StringBuilder rewritten = new StringBuilder();
        String[] lines = playlist.split("\n");
        
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#") || trimmed.startsWith("</")) {
                rewritten.append(line).append("\n");
                continue;
            }
            
            String rewrittenUrl = rewriteUrl(trimmed, baseUrl, referer);
            rewritten.append(rewrittenUrl).append("\n");
        }
        
        return rewritten.toString();
    }
    
    private static String rewriteUrl(String url, String baseUrl, String referer) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return PROXY_BASE + "?url=" + encodeUrl(url) + "&referer=" + encodeUrl(referer != null ? referer : baseUrl);
        }
        String resolved = resolveUrl(baseUrl, url);
        return PROXY_BASE + "?url=" + encodeUrl(resolved) + "&referer=" + encodeUrl(referer != null ? referer : baseUrl);
    }
    
    private static String resolveUrl(String base, String relative) {
        try {
            URI baseUri = new URI(base);
            URI resolved = baseUri.resolve(relative);
            return resolved.toString();
        } catch (Exception e) {
            log.warn("[HLS] URL_RESOLVE_FAILED base='{}' relative='{}' error='{}'", base, relative, e.getMessage());
            return base.endsWith("/") ? base + relative : base + "/" + relative;
        }
    }
    
    public static String encodeUrl(String url) {
        return java.net.URLEncoder.encode(url, java.nio.charset.StandardCharsets.UTF_8);
    }
    
    public static String detectBaseUrl(String episodeUrl, String streamUrl) {
        try {
            URI uri = new URI(streamUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            int port = uri.getPort();
            String path = uri.getPath();
            
            int lastSlash = path.lastIndexOf('/');
            String basePath = lastSlash > 0 ? path.substring(0, lastSlash + 1) : "/";
            
            if (port > 0 && port != 80 && port != 443) {
                return scheme + "://" + host + ":" + port + basePath;
            }
            return scheme + "://" + host + basePath;
        } catch (Exception e) {
            log.warn("[HLS] BASE_URL_DETECT_FAILED streamUrl='{}' error='{}'", streamUrl, e.getMessage());
            return streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
        }
    }
}
