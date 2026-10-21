package com.animeSite.core.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetAddress;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

public final class UrlValidator {

    private static final Logger log = LoggerFactory.getLogger(UrlValidator.class);
    private static final List<String> ALLOWED_STREAM_DOMAINS = Arrays.asList(
        "anineko.to",
        "gogoanime.live",
        "megaplay.buzz",
        "megaplay-1.buzz",
        "vivibebe.net",
        "otakuhg.me",
        "nexabloom.top",
        "eclipseharbor.space",
        "nekostream.site"
    );
    /**
     * The MegaPlay CDN rotates the segment host per title and even per stream
     * ("7v8gl.eclipseharbor.space", "7o819.twilightharbor.space",
     * "dmlmc.oakhorizon.space", ...). New families appear over time, so beyond
     * the explicit list we accept any host that resolves only to public
     * addresses. That keeps SSRF protection (loopback/private ranges are
     * rejected) while surviving CDN rotation.
     */
    private static final List<String> ALLOWED_STREAM_SUFFIXES = Arrays.asList(
        "harbor.space",
        "horizon.space",
        "nexabloom.top"
    );
    private static final List<String> ALLOWED_IMAGE_DOMAINS = Arrays.asList(
        "myanimelist.net",
        "cdn.myanimelist.net"
    );
    private static final Pattern PRIVATE_IP_PATTERN = Pattern.compile(
        "^(127\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|0\\.0\\.0\\.0|169\\.254\\.)"
    );
    private static final Map<String, Boolean> PUBLIC_HOST_CACHE = new ConcurrentHashMap<>();

    public static boolean isValidStreamUrl(String url) {
        if (isValidUrl(url, ALLOWED_STREAM_DOMAINS, ALLOWED_STREAM_SUFFIXES)) {
            return true;
        }
        if (isPubliclyResolvable(url)) {
            return true;
        }
        log.warn("[URL_VALIDATOR] Blocked stream URL: {}", url);
        return false;
    }

    public static boolean isValidImageUrl(String url) {
        return isValidUrl(url, ALLOWED_IMAGE_DOMAINS, List.of());
    }

    /**
     * Accept absolute http(s) URLs whose DNS answers are all public. Cached per
     * host so segment playback does not pay a lookup per request.
     */
    private static boolean isPubliclyResolvable(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
                return false;
            }
            String host = uri.getHost();
            if (host == null || PRIVATE_IP_PATTERN.matcher(host).find()) {
                return false;
            }
            return PUBLIC_HOST_CACHE.computeIfAbsent(host, h -> {
                try {
                    for (InetAddress address : InetAddress.getAllByName(h)) {
                        if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                            || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                            || address.isMulticastAddress()) {
                            return false;
                        }
                    }
                    log.info("[URL_VALIDATOR] Allowing public CDN host: {}", h);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            });
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isValidUrl(String url, List<String> allowedDomains,
                                      List<String> allowedSuffixes) {
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
            boolean allowed = allowedDomains.stream().anyMatch(domain -> host.equals(domain) || host.endsWith("." + domain))
                || allowedSuffixes.stream().anyMatch(host::endsWith);
            return allowed;
        } catch (Exception e) {
            log.warn("[URL_VALIDATOR] Failed to parse URL: {} error: {}", url, e.getMessage());
            return false;
        }
    }

    private UrlValidator() {}
}
