package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.pipeline.StreamProxyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/stream")
@Tag(name = "Stream Proxy", description = "Backend streaming proxy for HLS content")
public class StreamProxyController {

    private static final Logger log = LoggerFactory.getLogger(StreamProxyController.class);
    private final StreamProxyService streamProxyService;

    public StreamProxyController(StreamProxyService streamProxyService) {
        this.streamProxyService = streamProxyService;
    }

    @GetMapping("/proxy")
    @Operation(summary = "Proxy stream content", description = "Proxies HLS playlists, segments, subtitles, and encryption keys from providers")
    public void proxyStream(
            @RequestParam String url,
            @RequestParam(required = false) String referer,
            @RequestHeader(value = "Accept", required = false) String acceptHeader,
            HttpServletResponse response) {
        
        long start = System.currentTimeMillis();
        log.info("[PROXY_CONTROLLER] REQUEST | url='{}' referer='{}'", url, referer);

        StreamProxyService.ProxyResult result = streamProxyService.proxyStream(url, referer, acceptHeader);

        response.setStatus(result.status());
        response.setContentType(result.contentType());

        response.setHeader("Cache-Control", "public, max-age=300");
        response.setContentLength(result.data().length);

        try {
            response.getOutputStream().write(result.data());
            response.getOutputStream().flush();
        } catch (Exception e) {
            log.warn("[PROXY_CONTROLLER] WRITE_FAILED | url='{}' error='{}'", url, e.getMessage());
        }

        long elapsed = System.currentTimeMillis() - start;
        log.info("[PROXY_CONTROLLER] COMPLETE | url='{}' status={} type='{}' size={} duration={}ms",
            url, result.status(), result.contentType(), result.data().length, elapsed);
    }

    @GetMapping("/resolve/{malId}")
    @Operation(summary = "Resolve stream for episode", description = "Resolves a stream URL and returns proxy-compatible URLs")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resolveStream(
            @PathVariable int malId,
            @RequestParam String episodeUrl) {
        
        long start = System.currentTimeMillis();
        log.info("[PROXY] RESOLVE | malId={} episodeUrl={}", malId, episodeUrl);
        
        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "malId", malId,
            "message", "Use /api/anime/{malId}/episode/embed to resolve streams"
        )));
    }

    @GetMapping("/health")
    @Operation(summary = "Stream proxy health check")
    public ResponseEntity<ApiResponse<Map<String, Object>>> health() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "status", "healthy",
            "proxyEnabled", true
        )));
    }
}
