package com.animeSite.core.util;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Validates outbound proxy destinations (streams and images).
 *
 * <p>This is a Spring bean so the allow-lists can be tuned per deployment via
 * configuration ({@code app.proxy.*}) without a code change — the provider
 * CDNs rotate host families over time, and the previous way to cope with that
 * was to accept <em>any</em> publicly resolvable host, which turned the proxy
 * into an open SSRF primitive. Now a URL must match one of the explicit
 * allow-lists; there is deliberately no "resolves publicly, therefore allowed"
 * fallback.</p>
 *
 * <p>Even an allow-listed host is re-resolved and rejected if any of its DNS
 * answers point at a loopback / private / link-local address, so a rebound or
 * mis-pointed subdomain cannot reach internal services.</p>
 */
@Component
public class UrlValidator {

    private static final Logger log = LoggerFactory.getLogger(UrlValidator.class);

    private static final String DEFAULT_STREAM_DOMAINS =
        "anineko.to,gogoanime.live,megaplay.buzz,megaplay-1.buzz,vivibebe.net," +
        "otakuhg.me,nexabloom.top,eclipseharbor.space,nekostream.site";

    /**
     * The MegaPlay CDN rotates the segment host per title and even per stream
     * ("7v8gl.eclipseharbor.space", "7o819.twilightharbor.space",
     * "dmlmc.oakhorizon.space", ...). New families appear over time, so the
     * suffix list is the explicit, configurable extension point for those
     * families — it is no longer a licence to fetch arbitrary public hosts.
     */
    private static final String DEFAULT_STREAM_SUFFIXES =
        "harbor.space,horizon.space,nexabloom.top";

    private static final String DEFAULT_IMAGE_DOMAINS =
        "myanimelist.net,cdn.myanimelist.net";

    private static final Pattern PRIVATE_IP_PATTERN = Pattern.compile(
        "^(127\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|0\\.0\\.0\\.0|169\\.254\\.)"
    );

    /**
     * DNS answers are cached per host so segment playback does not pay a lookup
     * per request. Entries expire so a transient resolution failure cannot
     * permanently block a healthy host, and so a later rebinding is re-checked.
     */
    private final Cache<String, Boolean> publicHostCache = CacheBuilder.newBuilder()
        .maximumSize(2048)
        .expireAfterWrite(10, TimeUnit.MINUTES)
        .build();

    private final List<String> allowedStreamDomains;
    private final List<String> allowedStreamSuffixes;
    private final List<String> allowedImageDomains;
    private final boolean verifyDns;

    public UrlValidator(
            @Value("${app.proxy.allowed-stream-domains:}") String streamDomains,
            @Value("${app.proxy.allowed-stream-suffixes:}") String streamSuffixes,
            @Value("${app.proxy.allowed-image-domains:}") String imageDomains,
            @Value("${app.proxy.verify-dns:true}") boolean verifyDns) {
        this.allowedStreamDomains = parse(streamDomains, DEFAULT_STREAM_DOMAINS);
        this.allowedStreamSuffixes = parse(streamSuffixes, DEFAULT_STREAM_SUFFIXES);
        this.allowedImageDomains = parse(imageDomains, DEFAULT_IMAGE_DOMAINS);
        this.verifyDns = verifyDns;
    }

    /** Streams are proxyable only from explicit provider hosts/suffixes. */
    public boolean isValidStreamUrl(String url) {
        if (isValidUrl(url, allowedStreamDomains, allowedStreamSuffixes) && dnsAllows(url)) {
            return true;
        }
        log.warn("[URL_VALIDATOR] Blocked stream URL: {}", url);
        return false;
    }

    /** Images are proxyable only from the MyAnimeList CDN hosts. */
    public boolean isValidImageUrl(String url) {
        return isValidUrl(url, allowedImageDomains, List.of());
    }

    /**
     * Resolves the host and requires every answer to be public. This is
     * defence-in-depth on top of the allow-list: a rebound or mis-pointed
     * subdomain of an allow-listed family must not reach loopback/private
     * ranges.
     */
    private boolean dnsAllows(String url) {
        if (!verifyDns) {
            return true;
        }
        String host;
        try {
            host = URI.create(url).getHost();
        } catch (Exception e) {
            return false;
        }
        if (host == null || host.isBlank()) {
            return false;
        }
        String key = host.toLowerCase(Locale.ROOT);
        Boolean cached = publicHostCache.getIfPresent(key);
        if (cached != null) {
            return cached;
        }
        boolean allPublic = resolvesPublicly(host);
        publicHostCache.put(key, allPublic);
        if (!allPublic) {
            log.warn("[URL_VALIDATOR] Host {} did not resolve to public addresses", host);
        }
        return allPublic;
    }

    private static boolean resolvesPublicly(String host) {
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                    || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                    || address.isMulticastAddress()) {
                    return false;
                }
            }
            return true;
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
            String normalized = host.toLowerCase(Locale.ROOT);
            return allowedDomains.stream().anyMatch(domain ->
                    normalized.equals(domain) || normalized.endsWith("." + domain))
                || allowedSuffixes.stream().anyMatch(normalized::endsWith);
        } catch (Exception e) {
            log.warn("[URL_VALIDATOR] Failed to parse URL: {} error: {}", url, e.getMessage());
            return false;
        }
    }

    /**
     * Splits a comma-separated override, trimming and lower-casing each entry.
     * Falls back to the built-in default when the override is blank so the
     * validator is always populated even if config is absent.
     */
    private static List<String> parse(String value, String fallback) {
        String source = (value == null || value.isBlank()) ? fallback : value;
        List<String> result = new ArrayList<>();
        for (String token : Arrays.asList(source.split(","))) {
            String entry = token.trim().toLowerCase(Locale.ROOT);
            if (!entry.isEmpty()) {
                result.add(entry);
            }
        }
        return List.copyOf(result);
    }
}
