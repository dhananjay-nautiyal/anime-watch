package com.animeSite.pipeline;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

public class ProviderMetrics {

    private static final int WINDOW_SIZE = 100;

    private final Map<String, ProviderStats> stats = new ConcurrentHashMap<>();

    public void recordSuccess(String provider, long latencyMs) {
        stats.computeIfAbsent(provider, ProviderStats::new).recordSuccess(latencyMs);
    }

    public void recordFailure(String provider, long latencyMs, String errorCode) {
        stats.computeIfAbsent(provider, ProviderStats::new).recordFailure(latencyMs, errorCode);
    }

    public void recordTimeout(String provider) {
        stats.computeIfAbsent(provider, ProviderStats::new).recordTimeout();
    }

    public double getSuccessRate(String provider) {
        ProviderStats s = stats.get(provider);
        return s != null ? s.successRate() : 0.0;
    }

    public double getAvgLatency(String provider) {
        ProviderStats s = stats.get(provider);
        return s != null ? s.avgLatency() : 0.0;
    }

    public long getTotalRequests(String provider) {
        ProviderStats s = stats.get(provider);
        return s != null ? s.total.get() : 0;
    }

    public Map<String, Object> getProviderReport(String provider) {
        ProviderStats s = stats.get(provider);
        if (s == null) return Map.of("provider", provider, "status", "no_data");
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("provider", provider);
        r.put("totalRequests", s.total.get());
        r.put("successes", s.successes.get());
        r.put("failures", s.failures.get());
        r.put("timeouts", s.timeouts.get());
        r.put("successRate", Math.round(s.successRate() * 100.0) / 100.0);
        r.put("avgLatencyMs", Math.round(s.avgLatency()));
        r.put("lastError", s.lastError);
        r.put("lastErrorAt", s.lastErrorAt);
        r.put("lastSuccessAt", s.lastSuccessAt);
        return r;
    }

    public List<Map<String, Object>> getAllReports() {
        return stats.keySet().stream()
            .sorted()
            .map(this::getProviderReport)
            .collect(Collectors.toList());
    }

    public List<String> getRankedProviders() {
        return stats.entrySet().stream()
            .sorted((a, b) -> {
                int cmp = Double.compare(b.getValue().successRate(), a.getValue().successRate());
                if (cmp != 0) return cmp;
                return Double.compare(a.getValue().avgLatency(), b.getValue().avgLatency());
            })
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }

    public void reset(String provider) {
        stats.remove(provider);
    }

    public void resetAll() {
        stats.clear();
    }

    static class ProviderStats {
        final String name;
        final AtomicInteger total = new AtomicInteger();
        final AtomicInteger successes = new AtomicInteger();
        final AtomicInteger failures = new AtomicInteger();
        final AtomicInteger timeouts = new AtomicInteger();
        final AtomicLong totalLatency = new AtomicLong();
        final List<Long> recentLatencies = new ArrayList<>();
        final List<Boolean> recentResults = new ArrayList<>();
        String lastError = "";
        String lastErrorAt = "";
        String lastSuccessAt = "";

        ProviderStats(String name) { this.name = name; }

        synchronized void recordSuccess(long latencyMs) {
            total.incrementAndGet();
            successes.incrementAndGet();
            totalLatency.addAndGet(latencyMs);
            recentLatencies.add(latencyMs);
            recentResults.add(true);
            lastSuccessAt = Instant.now().toString();
            trim();
        }

        synchronized void recordFailure(long latencyMs, String errorCode) {
            total.incrementAndGet();
            failures.incrementAndGet();
            totalLatency.addAndGet(latencyMs);
            recentLatencies.add(latencyMs);
            recentResults.add(false);
            lastError = errorCode;
            lastErrorAt = Instant.now().toString();
            trim();
        }

        synchronized void recordTimeout() {
            timeouts.incrementAndGet();
            recordFailure(30000, "TIMEOUT");
        }

        synchronized double successRate() {
            if (total.get() == 0) return 0.0;
            return (double) successes.get() / total.get();
        }

        synchronized double avgLatency() {
            if (total.get() == 0) return 0.0;
            return (double) totalLatency.get() / total.get();
        }

        private void trim() {
            while (recentLatencies.size() > WINDOW_SIZE) {
                int idx = recentLatencies.size() - WINDOW_SIZE - 1;
                recentLatencies.remove(idx);
                recentResults.remove(idx);
            }
        }
    }
}
