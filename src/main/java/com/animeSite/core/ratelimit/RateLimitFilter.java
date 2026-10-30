package com.animeSite.core.ratelimit;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Order(1)
public class RateLimitFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    private static final int AUTH_MAX_REQUESTS = 5;
    private static final int AUTH_WINDOW_SECONDS = 60;
    private static final int GENERAL_MAX_REQUESTS = 100;
    private static final int GENERAL_WINDOW_SECONDS = 60;
    /**
     * The stream and image proxies relay third-party content and are
     * unauthenticated, so they get their own, larger per-IP bucket: streaming
     * one episode pulls a segment every few seconds (well over the general
     * API budget), yet a single client is still bounded so the proxies cannot
     * be used for open bandwidth amplification.
     */
    private static final int PROXY_MAX_REQUESTS = 300;
    private static final int PROXY_WINDOW_SECONDS = 60;

    private final Cache<String, AtomicInteger> authRequestCounts = CacheBuilder.newBuilder()
        .expireAfterWrite(AUTH_WINDOW_SECONDS, TimeUnit.SECONDS)
        .build();

    private final Cache<String, AtomicInteger> generalRequestCounts = CacheBuilder.newBuilder()
        .expireAfterWrite(GENERAL_WINDOW_SECONDS, TimeUnit.SECONDS)
        .build();

    private final Cache<String, AtomicInteger> proxyRequestCounts = CacheBuilder.newBuilder()
        .expireAfterWrite(PROXY_WINDOW_SECONDS, TimeUnit.SECONDS)
        .build();

    private final ClientIpResolver clientIpResolver;

    public RateLimitFilter(ClientIpResolver clientIpResolver) {
        this.clientIpResolver = clientIpResolver;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpReq = (HttpServletRequest) request;
        HttpServletResponse httpRes = (HttpServletResponse) response;
        String path = httpReq.getRequestURI();
        String ip = clientIpResolver.resolve(httpReq);

        if (path.startsWith("/api/auth/")) {
            if (exceeds(authRequestCounts, ip, AUTH_MAX_REQUESTS)) {
                log.warn("Rate limit exceeded for auth endpoint from IP: {}", ip);
                writeTooManyRequests(httpRes);
                return;
            }
        } else if (isProxyPath(path)) {
            if (exceeds(proxyRequestCounts, ip, PROXY_MAX_REQUESTS)) {
                log.warn("Rate limit exceeded for proxy endpoint from IP: {}", ip);
                writeTooManyRequests(httpRes);
                return;
            }
        } else if (path.startsWith("/api/")) {
            if (exceeds(generalRequestCounts, ip, GENERAL_MAX_REQUESTS)) {
                log.warn("Rate limit exceeded for general endpoint from IP: {}", ip);
                writeTooManyRequests(httpRes);
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private static boolean isProxyPath(String path) {
        return path.startsWith("/api/stream/proxy") || path.startsWith("/api/image-proxy");
    }

    private static boolean exceeds(Cache<String, AtomicInteger> counts, String ip, int max) {
        AtomicInteger count = counts.getIfPresent(ip);
        if (count == null) {
            count = new AtomicInteger(0);
            counts.put(ip, count);
        }
        return count.incrementAndGet() > max;
    }

    private static void writeTooManyRequests(HttpServletResponse httpRes) throws IOException {
        httpRes.setStatus(429);
        httpRes.setContentType("application/json");
        httpRes.getWriter().write("{\"message\":\"Too many requests. Please wait a moment and try again.\",\"errorCode\":\"RATE_LIMIT_EXCEEDED\"}");
    }
}
