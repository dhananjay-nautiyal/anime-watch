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
    private final ProviderPriorityManager priorityManager;
    private final TelemetryService telemetry;
    private final AnimeProviderCacheRepository cacheRepository;

    public ProviderHealthController(
            List<StreamProvider> providers,
            ProviderHealthMonitor healthMonitor,
            ProviderMetrics providerMetrics,
            ProviderPriority providerPriority,
            ProviderPriorityManager priorityManager,
            TelemetryService telemetry,
            AnimeProviderCacheRepository cacheRepository) {
        this.providers = providers;
        this.healthMonitor = healthMonitor;
        this.providerMetrics = providerMetrics;
        this.providerPriority = providerPriority;
        this.priorityManager = priorityManager;
        this.telemetry = telemetry;
        this.cacheRepository = cacheRepository;
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getProviderHealth() {
        List<Map<String, Object>> result = providers.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", p.getName());
            m.put("healthy", p.healthCheck());
            m.put("enabled", priorityManager.isEnabled(p.getName()));
            m.put("inPriority", priorityManager.existsInPriority(p.getName()));
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
            pm.put("enabled", priorityManager.isEnabled(p.getName()));
            providerDetails.put(p.getName(), pm);
        }
        result.put("providers", providerDetails);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProviderConfig() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("priorityOrder", priorityManager.getPriorityList());
        result.put("disabledProviders", priorityManager.getDisabledProviders());
        result.put("activeProviders", priorityManager.getActiveProviders().stream()
            .map(StreamProvider::getName).collect(Collectors.toList()));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/config/reload")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reloadConfig() {
        long start = System.currentTimeMillis();
        priorityManager.reload();
        long elapsed = System.currentTimeMillis() - start;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("priorityOrder", priorityManager.getPriorityList());
        result.put("disabledProviders", priorityManager.getDisabledProviders());
        result.put("activeProviders", priorityManager.getActiveProviders().stream()
            .map(StreamProvider::getName).collect(Collectors.toList()));
        result.put("durationMs", elapsed);
        log.info("[ADMIN] Provider config reloaded in {}ms", elapsed);
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
        result.put("withPreferredProvider", all.stream()
            .filter(c -> c.getPreferredProvider() != null).count());

        Map<String, Long> byProvider = all.stream()
            .filter(c -> c.getProvider() != null && !c.getProvider().isBlank())
            .collect(Collectors.groupingBy(AnimeProviderCache::getProvider, Collectors.counting()));
        result.put("byProvider", byProvider);

        Map<String, Long> byPreferred = all.stream()
            .filter(c -> c.getPreferredProvider() != null && !c.getPreferredProvider().isBlank())
            .collect(Collectors.groupingBy(AnimeProviderCache::getPreferredProvider, Collectors.counting()));
        result.put("byPreferredProvider", byPreferred);

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/preferred-cache/{malId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> clearPreferredCache(@PathVariable int malId) {
        cacheRepository.findByMalId(malId).ifPresent(cache -> {
            cache.setPreferredProvider(null);
            cache.setFailureCount(0);
            cacheRepository.save(cache);
            log.info("[ADMIN] Preferred cache cleared for malId={}", malId);
        });
        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "malId", malId,
            "cleared", true
        )));
    }

    @DeleteMapping("/cache")
    public ResponseEntity<ApiResponse<Map<String, Object>>> clearAllCache() {
        long count = cacheRepository.count();
        cacheRepository.deleteAll();
        log.info("[ADMIN] All provider cache cleared ({} entries)", count);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "cleared", count
        )));
    }
}
