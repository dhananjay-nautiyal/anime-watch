package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.UUID;

@RestController
@RequestMapping("/api/stream")
public class StreamProxyController {

    private static final Logger log = LoggerFactory.getLogger(StreamProxyController.class);
    private final RestTemplate restTemplate;
    private final Map<String, String> tokenStore = new ConcurrentHashMap<>();

    public StreamProxyController(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @PostMapping("/token")
    public ResponseEntity<ApiResponse<String>> createToken(@RequestBody Map<String, String> body) {
        String embedUrl = body.get("url");
        if (embedUrl == null || embedUrl.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("url is required"));
        }
        String token = UUID.randomUUID().toString();
        tokenStore.put(token, embedUrl);
        log.info("[STREAM] token created | token={} url={}", token, embedUrl);
        return ResponseEntity.ok(ApiResponse.success(token));
    }

    @GetMapping("/proxy/{token}")
    public ResponseEntity<?> proxy(@PathVariable String token) {
        String embedUrl = tokenStore.remove(token);
        if (embedUrl == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Invalid or expired token"));
        }
        log.info("[STREAM] proxy | token={} url={}", token, embedUrl);
        try {
            ResponseEntity<byte[]> response = restTemplate.getForEntity(embedUrl, byte[].class);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(response.getHeaders().getContentType());
            return new ResponseEntity<>(response.getBody(), headers, HttpStatus.OK);
        } catch (Exception e) {
            log.error("[STREAM] proxy failed | token={} error={}", token, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(ApiResponse.error("Failed to fetch stream source"));
        }
    }
}
