package com.animeSite.controller;

import com.animeSite.core.util.UrlValidator;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@RestController
@RequestMapping("/api/image-proxy")
public class ImageProxyController {

    private final HttpClient client = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build();

    @GetMapping
    public ResponseEntity<byte[]> proxyImage(@RequestParam String url) {
        if (!UrlValidator.isValidImageUrl(url)) {
            return ResponseEntity.badRequest().build();
        }
        try {
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent", "Mozilla/5.0")
                .header("Referer", "https://myanimelist.net/")
                .GET()
                .build();
            HttpResponse<byte[]> res = client.send(req, HttpResponse.BodyHandlers.ofByteArray());
            String contentType = res.headers().firstValue("Content-Type").orElse("image/jpeg");
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")

                .body(res.body());
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
