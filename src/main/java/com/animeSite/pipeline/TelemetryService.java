package com.animeSite.pipeline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class TelemetryService {

    private static final Logger log = LoggerFactory.getLogger(TelemetryService.class);

    private final AtomicLong startupTime = new AtomicLong(System.currentTimeMillis());
    private final AtomicInteger providerSwitchCount = new AtomicInteger(0);
    private final AtomicInteger streamValidationFailures = new AtomicInteger(0);
    private final AtomicInteger recoverySuccessCount = new AtomicInteger(0);
    private final AtomicInteger recoveryAttemptCount = new AtomicInteger(0);

    private final CopyOnWriteArrayList<BufferingRecord> bufferingHistory = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<ValidationFailureRecord> validationHistory = new CopyOnWriteArrayList<>();
    private final Map<String, ProviderTelemetry> providerTelemetry = new ConcurrentHashMap<>();

    private static final int MAX_HISTORY = 500;

    public TelemetryService() {
        log.info("[TELEMETRY] INITIALIZED");
    }

    public void recordProviderSwitch(String fromProvider, String toProvider, int malId) {
        providerSwitchCount.incrementAndGet();
        ProviderTelemetry pt = providerTelemetry.computeIfAbsent(toProvider, ProviderTelemetry::new);
        pt.switchCount.incrementAndGet();
        log.debug("[TELEMETRY] PROVIDER_SWITCH | malId={} from='{}' to='{}'", malId, fromProvider, toProvider);
    }

    public void recordStreamValidationFailure(String errorCode, int httpStatus) {
        streamValidationFailures.incrementAndGet();
        ValidationFailureRecord rec = new ValidationFailureRecord(errorCode, httpStatus, Instant.now());
        validationHistory.add(rec);
        if (validationHistory.size() > MAX_HISTORY) {
            validationHistory.remove(0);
        }
    }

    public void recordRecoveryAttempt() {
        recoveryAttemptCount.incrementAndGet();
    }

    public void recordRecoverySuccess() {
        recoverySuccessCount.incrementAndGet();
    }

    public void recordBuffering(int malId, long durationMs) {
        BufferingRecord rec = new BufferingRecord(malId, durationMs, Instant.now());
        bufferingHistory.add(rec);
        if (bufferingHistory.size() > MAX_HISTORY) {
            bufferingHistory.remove(0);
        }
    }

    public TelemetryReport getReport() {
        long uptime = System.currentTimeMillis() - startupTime.get();
        double recoveryRate = recoveryAttemptCount.get() > 0
            ? (double) recoverySuccessCount.get() / recoveryAttemptCount.get() * 100.0
            : 0.0;

        double avgBuffering = bufferingHistory.isEmpty()
            ? 0.0
            : bufferingHistory.stream().mapToLong(BufferingRecord::durationMs).average().orElse(0.0);

        Map<String, Object> providerStats = new LinkedHashMap<>();
        providerTelemetry.forEach((name, pt) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("switches", pt.switchCount.get());
            m.put("requests", pt.requestCount.get());
            m.put("failures", pt.failureCount.get());
            m.put("avgLatencyMs", pt.requestCount.get() > 0
                ? pt.totalLatencyMs.get() / pt.requestCount.get() : 0);
            providerStats.put(name, m);
        });

        return new TelemetryReport(
            startupTime.get(),
            uptime,
            providerSwitchCount.get(),
            streamValidationFailures.get(),
            recoveryAttemptCount.get(),
            recoverySuccessCount.get(),
            recoveryRate,
            avgBuffering,
            bufferingHistory.size(),
            validationHistory.size(),
            providerStats
        );
    }

    public void recordProviderRequest(String provider, long latencyMs, boolean success) {
        ProviderTelemetry pt = providerTelemetry.computeIfAbsent(provider, ProviderTelemetry::new);
        pt.requestCount.incrementAndGet();
        pt.totalLatencyMs.addAndGet(latencyMs);
        if (!success) pt.failureCount.incrementAndGet();
    }

    public record BufferingRecord(int malId, long durationMs, Instant timestamp) {}
    public record ValidationFailureRecord(String errorCode, int httpStatus, Instant timestamp) {}

    public record TelemetryReport(
        long startupTime,
        long uptimeMs,
        int providerSwitches,
        int validationFailures,
        int recoveryAttempts,
        int recoverySuccesses,
        double recoveryRate,
        double avgBufferingMs,
        int bufferingCount,
        int validationCount,
        Map<String, Object> providerStats
    ) {}

    private static class ProviderTelemetry {
        final String name;
        final AtomicInteger switchCount = new AtomicInteger(0);
        final AtomicInteger requestCount = new AtomicInteger(0);
        final AtomicInteger failureCount = new AtomicInteger(0);
        final AtomicLong totalLatencyMs = new AtomicLong(0);

        ProviderTelemetry(String name) { this.name = name; }
    }
}
