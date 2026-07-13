package com.animeSite.core.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetAddress;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

public final class UrlValidator {

    private static final Logger log = LoggerFactory.getLogger(UrlValidator.class);
    private static final List<String> ALLOWED_STREAM_DOMAINS = Arrays.asList(
        "anineko.to",
        "gogoanime.live",
        "megaplay.buzz",
        "vivibebe.net",
        "otakuhg.me"
    );
    private static final List<String> ALLOWED_IMAGE_DOMAINS = Arrays.asList(
        "myanimelist.net",
        "cdn.myanimelist.net"
    );
    private static final Pattern PRIVATE_IP_PATTERN = Pattern.compile(
        "^(127\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|0\\.0\\.0\\.0|169\\.254\\.)"
    );

    public static boolean isValidStreamUrl(String url) {
        return isValidUrl(url, ALLOWED_STREAM_DOMAINS);
    }

    public static boolean isValidImageUrl(String url) {
        return isValidUrl(url, ALLOWED_IMAGE_DOMAINS);
    }

    private static boolean isValidUrl(String url, List<String> allowedDomains) {
        if (url == null || url.isBlank()) {
            log.warn("[URL_VALIDATOR] URL is null or empty");
            return false;
        }
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (scheme == null || (!"http".equals(scheme) && !"https".equals(scheme))) {
                log.warn("[URL_VALIDATOR] Invalid scheme: {} for URL: {}", scheme, url);
                return false;
            }
            String host = uri.getHost();
            if (host == null) {
                log.warn("[URL_VALIDATOR] No host in URL: {}", url);
                return false;
            }
            if (PRIVATE_IP_PATTERN.matcher(host).find()) {
                log.warn("[URL_VALIDATOR] Private IP blocked: {} for URL: {}", host, url);
                return false;
            }
            boolean allowed = allowedDomains.stream().anyMatch(domain -> host.equals(domain) || host.endsWith("." + domain));
            if (!allowed) {
                log.warn("[URL_VALIDATOR] Domain not allowed: {} for URL: {}", host, url);
            }
            return allowed;
        } catch (Exception e) {
            log.warn("[URL_VALIDATOR] Failed to parse URL: {} error: {}", url, e.getMessage());
            return false;
        }
    }

    private UrlValidator() {}
}
