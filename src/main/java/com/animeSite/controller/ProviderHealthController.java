package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.pipeline.*;
import com.animeSite.repo.AnimeProviderCacheRepository;
import com.animeSite.persist.AnimeProviderCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/providers")
public class ProviderHealthController {

    private static final Logger log = LoggerFactory.getLogger(ProviderHealthController.class);

    private final List<StreamProvider> providers;
    private final ProviderHealthMonitor healthMonitor;
    private final ProviderMetrics providerMetrics;
    private final ProviderPriority providerPriority;
    private final TelemetryService telemetry;
    private final AnimeProviderCacheRepository cacheRepository;

    public ProviderHealthController(
            List<StreamProvider> providers,
            ProviderHealthMonitor healthMonitor,
            ProviderMetrics providerMetrics,
            ProviderPriority providerPriority,
            TelemetryService telemetry,
            AnimeProviderCacheRepository cacheRepository) {
        this.providers = providers;
        this.healthMonitor = healthMonitor;
        this.providerMetrics = providerMetrics;
        this.providerPriority = providerPriority;
        this.telemetry = telemetry;
        this.cacheRepository = cacheRepository;
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getProviderHealth() {
        List<Map<String, Object>> result = providers.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", p.getName());
            m.put("healthy", p.healthCheck());
            try {
                var stats = healthMonitor.getStats(p.getName());
                m.put("stats", stats);
            } catch (Exception e) {
                m.put("stats", Map.of("error", e.getMessage()));
            }
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/metrics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMetrics() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("telemetry", telemetry.getReport());
        result.put("priorities", providerPriority.getPriorityReport());

        Map<String, Object> providerDetails = new LinkedHashMap<>();
        for (StreamProvider p : providers) {
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("healthScore", healthMonitor.getHealthScore(p.getName()));
            pm.put("stats", healthMonitor.getStats(p.getName()));
            providerDetails.put(p.getName(), pm);
        }
        result.put("providers", providerDetails);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/cache")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCacheStats() {
        List<AnimeProviderCache> all = cacheRepository.findAll();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", all.size());
        result.put("streamable", all.stream().filter(AnimeProviderCache::isStreamable).count());
        result.put("expired", all.stream().filter(AnimeProviderCache::isExpired).count());
        result.put("validated", all.stream().filter(c -> c.isValidated()).count());

        Map<String, Long> byProvider = all.stream()
            .filter(c -> c.getProvider() != null && !c.getProvider().isBlank())
            .collect(Collectors.groupingBy(AnimeProviderCache::getProvider, Collectors.counting()));
        result.put("byProvider", byProvider);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
