package com.animeSite.pipeline;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class ProviderPriority {

    private static final Duration STALE_THRESHOLD = Duration.ofMinutes(5);
    private static final int MIN_SAMPLES = 5;
    private static final double SCORE_WEIGHT_SUCCESS = 0.5;
    private static final double SCORE_WEIGHT_LATENCY = 0.3;
    private static final double SCORE_WEIGHT_FRESHNESS = 0.2;

    private final ProviderMetrics metrics;
    private final Map<String, ProviderScore> scores = new ConcurrentHashMap<>();
    private final List<String> defaultOrder;

    public ProviderPriority(ProviderMetrics metrics, List<StreamProvider> providers) {
        this.metrics = metrics;
        this.defaultOrder = providers.stream().map(StreamProvider::getName).collect(Collectors.toUnmodifiableList());
    }

    public List<String> getPrioritizedProviders() {
        List<String> ranked = metrics.getRankedProviders();
        if (ranked.isEmpty()) return defaultOrder;

        Map<String, Double> computed = new LinkedHashMap<>();
        for (String p : defaultOrder) {
            double score = computeScore(p);
            computed.put(p, score);
        }

        return computed.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }

    public void recordSuccess(String provider, long latencyMs) {
        metrics.recordSuccess(provider, latencyMs);
        scores.computeIfAbsent(provider, ProviderScore::new).recordSuccess();
    }

    public void recordFailure(String provider, long latencyMs, String errorCode) {
        metrics.recordFailure(provider, latencyMs, errorCode);
        scores.computeIfAbsent(provider, ProviderScore::new).recordFailure();
    }

    public String getBestProvider() {
        List<String> prioritized = getPrioritizedProviders();
        return prioritized.isEmpty() ? null : prioritized.get(0);
    }

    public double getProviderScore(String provider) {
        return computeScore(provider);
    }

    public Map<String, Object> getPriorityReport() {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("order", getPrioritizedProviders());
        Map<String, Double> scoresMap = new LinkedHashMap<>();
        for (String p : defaultOrder) {
            scoresMap.put(p, computeScore(p));
        }
        report.put("scores", scoresMap);
        return report;
    }

    private double computeScore(String provider) {
        double successRate = metrics.getSuccessRate(provider);
        double avgLatency = metrics.getAvgLatency(provider);
        long totalRequests = metrics.getTotalRequests(provider);

        if (totalRequests < MIN_SAMPLES) {
            int defaultIdx = defaultOrder.indexOf(provider);
            return defaultIdx >= 0 ? 1.0 - (defaultIdx * 0.1) : 0.5;
        }

        double latencyScore = avgLatency > 0 ? Math.max(0, 1.0 - (avgLatency / 10000.0)) : 0.5;
        double freshness = computeFreshness(provider);

        return (successRate * SCORE_WEIGHT_SUCCESS) +
               (latencyScore * SCORE_WEIGHT_LATENCY) +
               (freshness * SCORE_WEIGHT_FRESHNESS);
    }

    private double computeFreshness(String provider) {
        ProviderScore s = scores.get(provider);
        if (s == null || s.lastAttempt == null) return 0.5;
        long elapsed = Duration.between(s.lastAttempt, Instant.now()).toMillis();
        if (elapsed < 60000) return 1.0;
        if (elapsed < 300000) return 0.8;
        if (elapsed < 3600000) return 0.5;
        return 0.2;
    }

    static class ProviderScore {
        final String name;
        final AtomicInteger successes = new AtomicInteger();
        final AtomicInteger failures = new AtomicInteger();
        Instant lastAttempt;

        ProviderScore(String name) { this.name = name; }

        void recordSuccess() {
            successes.incrementAndGet();
            lastAttempt = Instant.now();
        }

        void recordFailure() {
            failures.incrementAndGet();
            lastAttempt = Instant.now();
        }

        double successRate() {
            int total = successes.get() + failures.get();
            return total > 0 ? (double) successes.get() / total : 0.0;
        }
    }
}
