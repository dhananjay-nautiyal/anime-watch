package com.animeSite.httpclient;

import com.animeSite.model.ConsumetInfoResponse;
import com.animeSite.model.ConsumetSearchResponse;
import com.animeSite.model.ConsumetWatchResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Client for the self-hosted Consumet bridge (see consumet-bridge/).
 * Base URL comes from CONSUMET_BASE_URL; blank means "not configured"
 * and every call fails soft so other providers still run.
 */
@Component
public class ConsumetApiClient {

    private static final Logger log = LoggerFactory.getLogger(ConsumetApiClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public ConsumetApiClient(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate,
                             @Value("${consumet.base-url:}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl != null ? baseUrl.trim().replaceAll("/$", "") : "";
    }

    public boolean isConfigured() {
        return !baseUrl.isBlank();
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new IllegalStateException("CONSUMET_BASE_URL is not configured");
        }
    }

    public ConsumetSearchResponse search(String query) {
        requireConfigured();
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl + "/anime/hianime/{query}")
                .buildAndExpand(query).encode().toUriString();
        log.info("[CONSUMET] SEARCH | q='{}'", query);
        return restTemplate.getForObject(url, ConsumetSearchResponse.class);
    }

    public ConsumetInfoResponse info(String hianimeId) {
        requireConfigured();
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl + "/anime/hianime/info")
                .queryParam("id", hianimeId).build().encode().toUriString();
        log.info("[CONSUMET] INFO | id='{}'", hianimeId);
        return restTemplate.getForObject(url, ConsumetInfoResponse.class);
    }

    public ConsumetWatchResponse watch(String episodeId, String server, String category) {
        requireConfigured();
        UriComponentsBuilder b = UriComponentsBuilder
                .fromHttpUrl(baseUrl + "/anime/hianime/watch/{episodeId}")
                .queryParam("category", category != null ? category : "sub");
        if (server != null && !server.isBlank()) b.queryParam("server", server);
        String url = b.buildAndExpand(episodeId).encode().toUriString();
        log.info("[CONSUMET] WATCH | ep='{}' server='{}'", episodeId, server);
        return restTemplate.getForObject(url, ConsumetWatchResponse.class);
    }
}
