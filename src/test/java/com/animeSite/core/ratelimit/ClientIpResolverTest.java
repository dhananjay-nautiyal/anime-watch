package com.animeSite.core.ratelimit;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

class ClientIpResolverTest {

    private final ClientIpResolver resolver =
            new ClientIpResolver("127.0.0.0/8,10.0.0.0/8,192.168.0.0/16,::1/128");

    private static MockHttpServletRequest request(String remoteAddr, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/login");
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        return request;
    }

    @Test
    void ignoresForwardedForFromAnUntrustedDirectClient() {
        // The classic bypass: rotate X-Forwarded-For on every attempt.
        assertEquals("203.0.113.7", resolver.resolve(request("203.0.113.7", "198.51.100.1")));
        assertEquals("203.0.113.7", resolver.resolve(request("203.0.113.7", "198.51.100.2")));
    }

    @Test
    void usesTheClientAddressSuppliedByATrustedProxy() {
        assertEquals("203.0.113.9", resolver.resolve(request("127.0.0.1", "203.0.113.9")));
    }

    @Test
    void takesTheRightmostUntrustedHopSoPrependedValuesCannotSpoof() {
        // Client sent "1.2.3.4"; the proxy appended the real peer.
        assertEquals("203.0.113.9", resolver.resolve(request("10.0.0.5", "1.2.3.4, 203.0.113.9")));
    }

    @Test
    void skipsTrustedHopsWhenWalkingRightToLeft() {
        assertEquals("203.0.113.9", resolver.resolve(request("127.0.0.1", "203.0.113.9, 10.0.0.5")));
    }

    @Test
    void ignoresInvalidEntriesInsteadOfUsingThemAsKeys() {
        assertEquals("203.0.113.9", resolver.resolve(request("127.0.0.1", "not-an-ip, 203.0.113.9")));
    }

    @Test
    void fallsBackToThePeerWhenEveryHopIsTrusted() {
        assertEquals("127.0.0.1", resolver.resolve(request("127.0.0.1", "10.0.0.5, 192.168.1.5")));
    }

    @Test
    void handlesIpv6AndBracketedAddresses() {
        assertEquals("2001:db8::1", resolver.resolve(request("::1", "2001:db8::1")));
        assertEquals("2001:db8::1", resolver.resolve(request("127.0.0.1", "[2001:db8::1]")));
    }

    @Test
    void stripsAnIpv4Port() {
        assertEquals("203.0.113.9", resolver.resolve(request("127.0.0.1", "203.0.113.9:51234")));
    }

    @Test
    void usesThePeerWhenThereIsNoHeader() {
        assertEquals("198.51.100.7", resolver.resolve(request("198.51.100.7", null)));
    }

    @Test
    void supportsCidrRanges() {
        ClientIpResolver custom = new ClientIpResolver("10.1.0.0/16");
        assertEquals("203.0.113.9", custom.resolve(request("10.1.2.3", "203.0.113.9")));
        // 10.2.x is outside 10.1.0.0/16, so the header is not trusted.
        assertEquals("10.2.3.4", custom.resolve(request("10.2.3.4", "203.0.113.9")));
    }
}
