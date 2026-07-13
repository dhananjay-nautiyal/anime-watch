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

    private final Cache<String, AtomicInteger> authRequestCounts = CacheBuilder.newBuilder()
        .expireAfterWrite(AUTH_WINDOW_SECONDS, TimeUnit.SECONDS)
        .build();

    private final Cache<String, AtomicInteger> generalRequestCounts = CacheBuilder.newBuilder()
        .expireAfterWrite(GENERAL_WINDOW_SECONDS, TimeUnit.SECONDS)
        .build();

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpReq = (HttpServletRequest) request;
        HttpServletResponse httpRes = (HttpServletResponse) response;
        String path = httpReq.getRequestURI();
        String ip = getClientIp(httpReq);

        if (path.startsWith("/api/auth/")) {
            AtomicInteger count = authRequestCounts.getIfPresent(ip);
            if (count == null) {
                count = new AtomicInteger(0);
                authRequestCounts.put(ip, count);
            }
            if (count.incrementAndGet() > AUTH_MAX_REQUESTS) {
                log.warn("Rate limit exceeded for auth endpoint from IP: {}", ip);
                httpRes.setStatus(429);
                httpRes.setContentType("application/json");
                httpRes.getWriter().write("{\"message\":\"Too many requests. Please wait a moment and try again.\",\"errorCode\":\"RATE_LIMIT_EXCEEDED\"}");
                return;
            }
        } else if (path.startsWith("/api/")) {
            AtomicInteger count = generalRequestCounts.getIfPresent(ip);
            if (count == null) {
                count = new AtomicInteger(0);
                generalRequestCounts.put(ip, count);
            }
            if (count.incrementAndGet() > GENERAL_MAX_REQUESTS) {
                httpRes.setStatus(429);
                httpRes.setContentType("application/json");
                httpRes.getWriter().write("{\"message\":\"Too many requests. Please wait a moment and try again.\",\"errorCode\":\"RATE_LIMIT_EXCEEDED\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
