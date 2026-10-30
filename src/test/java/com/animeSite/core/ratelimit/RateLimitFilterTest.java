package com.animeSite.core.ratelimit;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RateLimitFilterTest {

    private static MockHttpServletRequest request(String remoteAddr, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        return request;
    }

    private static int statusAfter(RateLimitFilter filter, String remoteAddr, String forwardedFor)
            throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request(remoteAddr, forwardedFor), response, new MockFilterChain());
        return response.getStatus();
    }

    @Test
    void spoofedForwardedForDoesNotBypassTheAuthLimit() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new ClientIpResolver("127.0.0.0/8"));

        for (int i = 0; i < 5; i++) {
            assertEquals(200, statusAfter(filter, "203.0.113.7", "198.51.100." + i));
        }

        // Sixth attempt from the same peer, with yet another forged header.
        assertEquals(429, statusAfter(filter, "203.0.113.7", "198.51.100.99"));
    }

    @Test
    void keepsSeparateBucketsForDistinctClientsBehindATrustedProxy() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new ClientIpResolver("127.0.0.0/8"));

        for (int i = 0; i < 5; i++) {
            assertEquals(200, statusAfter(filter, "127.0.0.1", "203.0.113.10"));
        }
        assertEquals(429, statusAfter(filter, "127.0.0.1", "203.0.113.10"));

        // A different real client behind the same proxy still has its own
        // allowance.
        assertEquals(200, statusAfter(filter, "127.0.0.1", "203.0.113.11"));
    }

    private static MockHttpServletRequest proxyRequest(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/stream/proxy");
        request.setRequestURI("/api/stream/proxy");
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    @Test
    void proxyEndpointsUseTheirOwnBucket() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new ClientIpResolver("127.0.0.0/8"));

        // Exhaust the tight auth bucket (5) from one IP.
        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(request("203.0.113.50", null), res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilter(request("203.0.113.50", null), blocked, new MockFilterChain());
        assertEquals(429, blocked.getStatus());

        // The same IP is NOT blocked on the proxy path: it is metered by the
        // separate, larger proxy bucket.
        MockHttpServletResponse proxyOk = new MockHttpServletResponse();
        filter.doFilter(proxyRequest("203.0.113.50"), proxyOk, new MockFilterChain());
        assertEquals(200, proxyOk.getStatus());
    }
}
