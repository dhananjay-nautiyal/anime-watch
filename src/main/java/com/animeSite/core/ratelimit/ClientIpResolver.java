package com.animeSite.core.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;

/**
 * Resolves the address used to key rate limits.
 *
 * <p>A client can send any {@code X-Forwarded-For} value it likes, so the
 * header is only honoured when the request actually arrived from a proxy we
 * trust. The chain is then walked from right to left (the side written by our
 * own proxies) and the first untrusted address is the client. This stops the
 * classic bypass of rotating a forged leftmost value on every attempt.
 *
 * <p>The default trusted set is loopback, RFC1918, link-local and IPv6
 * unique-local addresses. Deployments behind a proxy with public source
 * addresses must set {@code app.rate-limit.trusted-proxies} (env:
 * {@code RATE_LIMIT_TRUSTED_PROXIES}) to that proxy's CIDR.
 */
@Component
public class ClientIpResolver {

    static final String DEFAULT_TRUSTED_PROXIES =
            "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16,"
                    + "::1/128,fc00::/7,fe80::/10";

    private final List<Cidr> trustedProxies;

    public ClientIpResolver(
            @Value("${app.rate-limit.trusted-proxies:" + DEFAULT_TRUSTED_PROXIES + "}") String trustedProxies) {
        this.trustedProxies = parse(trustedProxies);
    }

    /** Returns a stable, spoof-resistant key for the caller. */
    public String resolve(HttpServletRequest request) {
        String peer = normalize(request.getRemoteAddr());
        if (!isTrusted(peer)) {
            // Direct connection (or an untrusted hop): the header is attacker
            // controlled, so ignore it entirely.
            return peer;
        }

        String header = request.getHeader("X-Forwarded-For");
        if (header == null || header.isBlank()) {
            return peer;
        }

        String[] hops = header.split(",");
        for (int i = hops.length - 1; i >= 0; i--) {
            String hop = normalize(hops[i]);
            if (hop == null) continue;
            if (!isTrusted(hop)) {
                return hop;
            }
        }
        return peer;
    }

    private boolean isTrusted(String ip) {
        byte[] address = parseAddress(ip);
        if (address == null) return false;
        for (Cidr cidr : trustedProxies) {
            if (cidr.contains(address)) return true;
        }
        return false;
    }

    private static List<Cidr> parse(String value) {
        List<Cidr> result = new ArrayList<>();
        if (value == null || value.isBlank()) return result;
        for (String token : value.split(",")) {
            Cidr cidr = Cidr.parse(token.trim());
            if (cidr != null) result.add(cidr);
        }
        return result;
    }

    /** Strips an IPv4 port or IPv6 brackets, and returns null for blanks. */
    static String normalize(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        if (value.isEmpty()) return null;
        if (value.startsWith("[")) {
            int end = value.indexOf(']');
            if (end > 1) return value.substring(1, end);
        }
        int colon = value.indexOf(':');
        if (colon > 0 && colon == value.lastIndexOf(':') && value.indexOf('.') > 0) {
            // IPv4:port
            return value.substring(0, colon);
        }
        return value;
    }

    /**
     * Parses a literal IP without ever performing a DNS lookup. Anything that
     * is not made of hex digits, dots or colons (optionally with an IPv6 zone)
     * is rejected.
     */
    static byte[] parseAddress(String ip) {
        if (ip == null || ip.isBlank()) return null;
        if (!ip.matches("[0-9a-fA-F:.%]+")) return null;
        try {
            return InetAddress.getByName(ip).getAddress();
        } catch (UnknownHostException e) {
            return null;
        }
    }

    record Cidr(byte[] network, int prefixBits) {

        static Cidr parse(String token) {
            if (token == null || token.isBlank()) return null;
            String address = token;
            Integer prefix = null;
            int slash = token.indexOf('/');
            if (slash >= 0) {
                address = token.substring(0, slash);
                try {
                    prefix = Integer.parseInt(token.substring(slash + 1));
                } catch (NumberFormatException e) {
                    return null;
                }
            }

            byte[] bytes = parseAddress(normalize(address));
            if (bytes == null) return null;

            int bits = bytes.length * 8;
            int prefixBits = prefix == null ? bits : prefix;
            if (prefixBits < 0 || prefixBits > bits) return null;
            return new Cidr(bytes, prefixBits);
        }

        boolean contains(byte[] address) {
            if (address == null || address.length != network.length) return false;
            int fullBytes = prefixBits / 8;
            for (int i = 0; i < fullBytes; i++) {
                if (address[i] != network[i]) return false;
            }
            int remaining = prefixBits % 8;
            if (remaining == 0) return true;
            int mask = 0xFF << (8 - remaining);
            return (address[fullBytes] & mask) == (network[fullBytes] & mask);
        }
    }
}
