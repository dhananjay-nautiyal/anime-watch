package com.animeSite.pipeline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Service
public class StreamHealthService {

    private static final Logger log = LoggerFactory.getLogger(StreamHealthService.class);

    private final List<StreamProvider> providers;
    private final ProviderMetrics metrics;
    private final ProviderManager providerManager;
    private final RestTemplate restTemplate;

    private final Map<String, HealthStatus> healthCache = new ConcurrentHashMap<>();
    private volatile Instant lastFullCheck = Instant.EPOCH;
    private static final Duration CHECK_INTERVAL = Duration.ofMinutes(5);
    private static final Duration PROVIDER_TIMEOUT = Duration.ofSeconds(10);

    public StreamHealthService(List<StreamProvider> providers,
                                ProviderMetrics metrics,
                                ProviderManager providerManager,
                                @Qualifier("jikanRestTemplate") RestTemplate restTemplate) {
        this.providers = providers;
        this.metrics = metrics;
        this.providerManager = providerManager;
        this.restTemplate = restTemplate;
    }

    public HealthStatus checkProviderHealth(String providerName) {
        HealthStatus cached = healthCache.get(providerName.toLowerCase());
        if (cached != null && !cached.isStale()) {
            return cached;
        }

        HealthStatus status = performHealthCheck(providerName);
        healthCache.put(providerName.toLowerCase(), status);
        return status;
    }

    public Map<String, HealthStatus> checkAllProviders() {
        if (Duration.between(lastFullCheck, Instant.now()).compareTo(CHECK_INTERVAL) < 0) {
            return getAllCachedHealth();
        }

        Map<String, HealthStatus> results = new ConcurrentHashMap<>();
        List<CompletableFuture<Void>> futures = providers.stream()
            .map(p -> CompletableFuture.runAsync(() -> {
                HealthStatus s = performHealthCheck(p.getName());
                results.put(p.getName().toLowerCase(), s);
                healthCache.put(p.getName().toLowerCase(), s);
            }))
            .collect(Collectors.toList());

        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).get(30, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("[HEALTH] Health check timed out for some providers");
        }

        lastFullCheck = Instant.now();
        return results;
    }

    public List<String> getHealthyProviders() {
        return checkAllProviders().entrySet().stream()
            .filter(e -> e.getValue().healthy)
            .map(e -> e.getKey())
            .collect(Collectors.toList());
    }

    public String getBestProvider() {
        List<String> healthy = getHealthyProviders();
        if (healthy.isEmpty()) return null;

        List<String> prioritized = providerManager.getPriority().getPrioritizedProviders();
        for (String p : prioritized) {
            if (healthy.contains(p.toLowerCase())) return p;
        }
        return healthy.get(0);
    }

    public Map<String, Object> getFullHealthReport() {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("timestamp", Instant.now().toString());
        report.put("healthyProviders", getHealthyProviders());
        report.put("bestProvider", getBestProvider());

        Map<String, Object> details = new LinkedHashMap<>();
        for (StreamProvider p : providers) {
            HealthStatus hs = checkProviderHealth(p.getName());
            Map<String, Object> pd = new LinkedHashMap<>();
            pd.put("healthy", hs.healthy);
            pd.put("latencyMs", hs.latencyMs);
            pd.put("lastChecked", hs.lastChecked.toString());
            pd.put("error", hs.error);
            pd.put("successRate", metrics.getSuccessRate(p.getName()));
            pd.put("avgLatency", metrics.getAvgLatency(p.getName()));
            pd.put("totalRequests", metrics.getTotalRequests(p.getName()));
            details.put(p.getName(), pd);
        }
        report.put("providers", details);

        report.put("priority", providerManager.getPriority().getPriorityReport());
        report.put("metrics", metrics.getAllReports());
        return report;
    }

    public void invalidateCache(String providerName) {
        healthCache.remove(providerName.toLowerCase());
    }

    public void invalidateAll() {
        healthCache.clear();
        lastFullCheck = Instant.EPOCH;
    }

    private HealthStatus performHealthCheck(String providerName) {
        long start = System.currentTimeMillis();
        try {
            StreamProvider provider = findProvider(providerName);
            if (provider == null) {
                return new HealthStatus(false, System.currentTimeMillis() - start, Instant.now(), "Provider not found");
            }

            String healthUrl = getHealthUrl(providerName);
            if (healthUrl == null) {
                return new HealthStatus(true, 0, Instant.now(), null);
            }

            restTemplate.headForHeaders(healthUrl);
            long elapsed = System.currentTimeMillis() - start;
            metrics.recordSuccess(providerName, elapsed);
            return new HealthStatus(true, elapsed, Instant.now(), null);

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            metrics.recordFailure(providerName, elapsed, "HEALTH_CHECK_FAILED");
            return new HealthStatus(false, elapsed, Instant.now(), e.getMessage());
        }
    }

    private Map<String, HealthStatus> getAllCachedHealth() {
        Map<String, HealthStatus> result = new LinkedHashMap<>();
        for (StreamProvider p : providers) {
            HealthStatus hs = healthCache.get(p.getName().toLowerCase());
            if (hs != null) {
                result.put(p.getName(), hs);
            }
        }
        return result;
    }

    private String getHealthUrl(String providerName) {
        String name = providerName.toLowerCase();
        if (name.contains("anineko")) return "https://anineko.to/";
        if (name.contains("gogo")) return "https://gogoanime.live/";
        return null;
    }

    private StreamProvider findProvider(String name) {
        if (name == null) return null;
        for (StreamProvider p : providers) {
            if (p.getName().equalsIgnoreCase(name)) return p;
        }
        return null;
    }

    public record HealthStatus(
        boolean healthy,
        long latencyMs,
        Instant lastChecked,
        String error
    ) {
        public boolean isStale() {
            return Duration.between(lastChecked, Instant.now()).compareTo(CHECK_INTERVAL) > 0;
        }
    }
}
