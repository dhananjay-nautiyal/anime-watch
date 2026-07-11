package com.animeSite.pipeline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class ProviderHealthMonitor {

    private static final Logger log = LoggerFactory.getLogger(ProviderHealthMonitor.class);

    private final Map<String, ProviderStats> stats = new ConcurrentHashMap<>();

    public ProviderStats getOrCreate(String provider) {
        return stats.computeIfAbsent(provider, ProviderStats::new);
    }

    public void recordSuccess(String provider, long latencyMs) {
        ProviderStats s = getOrCreate(provider);
        s.recordSuccess(latencyMs);
    }

    public void recordFailure(String provider, long latencyMs) {
        ProviderStats s = getOrCreate(provider);
        s.recordFailure(latencyMs);
    }

    public void recordTimeout(String provider) {
        ProviderStats s = getOrCreate(provider);
        s.recordTimeout();
    }

    public void record429(String provider) {
        ProviderStats s = getOrCreate(provider);
        s.record429();
    }

    public double getHealthScore(String provider) {
        ProviderStats s = stats.get(provider);
        return s != null ? s.getHealthScore() : 1.0;
    }

    public List<String> getHealthyProviders() {
        List<Map.Entry<String, ProviderStats>> entries = new ArrayList<>(stats.entrySet());
        entries.sort((a, b) -> Double.compare(b.getValue().getHealthScore(), a.getValue().getHealthScore()));
        List<String> result = new ArrayList<>();
        for (Map.Entry<String, ProviderStats> e : entries) {
            if (e.getValue().getHealthScore() > 0.3) {
                result.add(e.getKey());
            }
        }
        return result;
    }

    public void logHealthReport() {
        StringBuilder sb = new StringBuilder("[HEALTH REPORT]\n");
        for (Map.Entry<String, ProviderStats> e : stats.entrySet()) {
            ProviderStats s = e.getValue();
            sb.append(String.format("  %s: score=%.2f success=%d/%d avgLatency=%.0fms rate429=%d\n",
                e.getKey(), s.getHealthScore(), s.successCount.get(),
                s.successCount.get() + s.failureCount.get(),
                s.totalLatencyMs.get() / Math.max(1, s.successCount.get()),
                s.rate429Count.get()));
        }
        log.info(sb.toString());
    }

    public void reset() { stats.clear(); }

    public static class ProviderStats {
        final String name;
        final AtomicInteger successCount = new AtomicInteger(0);
        final AtomicInteger failureCount = new AtomicInteger(0);
        final AtomicInteger timeoutCount = new AtomicInteger(0);
        final AtomicInteger rate429Count = new AtomicInteger(0);
        final AtomicLong totalLatencyMs = new AtomicLong(0);
        final AtomicInteger windowSuccess = new AtomicInteger(0);
        final AtomicInteger windowFailure = new AtomicInteger(0);
        final AtomicInteger windowCount = new AtomicInteger(0);
        private static final int WINDOW_SIZE = 50;

        ProviderStats(String name) { this.name = name; }

        void recordSuccess(long latencyMs) {
            successCount.incrementAndGet();
            totalLatencyMs.addAndGet(latencyMs);
            incrementWindow(true);
        }

        void recordFailure(long latencyMs) {
            failureCount.incrementAndGet();
            totalLatencyMs.addAndGet(latencyMs);
            incrementWindow(false);
        }

        void recordTimeout() { timeoutCount.incrementAndGet(); incrementWindow(false); }
        void record429() { rate429Count.incrementAndGet(); incrementWindow(false); }

        private synchronized void incrementWindow(boolean success) {
            if (success) windowSuccess.incrementAndGet();
            else windowFailure.incrementAndGet();
            windowCount.incrementAndGet();
            if (windowCount.get() >= WINDOW_SIZE) {
                windowSuccess.set(0);
                windowFailure.set(0);
                windowCount.set(0);
            }
        }

        double getHealthScore() {
            long total = successCount.get() + failureCount.get();
            if (total == 0) return 1.0;
            double successRate = (double) successCount.get() / total;
            double windowRate = windowCount.get() > 0
                ? (double) windowSuccess.get() / Math.max(1, windowCount.get())
                : successRate;
            double avgLatencyPenalty = Math.min(1.0, 5000.0 / Math.max(1, totalLatencyMs.get() / Math.max(1, total)));
            double rate429Penalty = Math.max(0, 1.0 - rate429Count.get() * 0.1);
            return Math.max(0, Math.min(1.0, windowRate * 0.6 + successRate * 0.2 + avgLatencyPenalty * 0.1 + rate429Penalty * 0.1));
        }
    }
}
