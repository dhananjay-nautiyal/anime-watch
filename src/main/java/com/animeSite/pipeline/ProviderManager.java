package com.animeSite.pipeline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ProviderManager {

    private static final Logger log = LoggerFactory.getLogger(ProviderManager.class);

    private final List<StreamProvider> providers;
    private final ProviderMetrics metrics;
    private final ProviderPriority priority;
    private final FailureCache failureCache;
    private final RetryPolicy defaultRetryPolicy;
    private final Map<String, RetryPolicy> providerRetryPolicies;

    public ProviderManager(List<StreamProvider> providers,
                           ProviderMetrics metrics,
                           ProviderPriority priority,
                           FailureCache failureCache) {
        this.providers = providers;
        this.metrics = metrics;
        this.priority = priority;
        this.failureCache = failureCache;
        this.defaultRetryPolicy = RetryPolicy.DEFAULT;
        this.providerRetryPolicies = new ConcurrentHashMap<>();
    }

    public void setRetryPolicy(String provider, RetryPolicy policy) {
        providerRetryPolicies.put(provider.toLowerCase(), policy);
    }

    public List<StreamProvider> getAvailableProviders(int malId) {
        List<String> prioritized = priority.getPrioritizedProviders();
        List<StreamProvider> available = new ArrayList<>();

        for (String name : prioritized) {
            if (failureCache.isBlacklisted(malId, name)) {
                log.debug("[PROVIDER_MANAGER] Skipping blacklisted provider={} for malId={}", name, malId);
                continue;
            }
            StreamProvider provider = findProvider(name);
            if (provider != null) {
                available.add(provider);
            }
        }

        return available;
    }

    public <T> ProviderResult<T> executeWithRetry(
            int malId,
            String providerName,
            String operation,
            ProviderOperation<T> operationFn) {

        RetryPolicy policy = providerRetryPolicies.getOrDefault(providerName.toLowerCase(), defaultRetryPolicy);
        long start = System.currentTimeMillis();
        List<ProviderAttempt> attempts = new ArrayList<>();

        for (int attempt = 0; attempt <= policy.maxRetries(); attempt++) {
            long attemptStart = System.currentTimeMillis();
            try {
                log.info("[PROVIDER_MANAGER] attempt={} malId={} provider={} operation={}",
                    attempt + 1, malId, providerName, operation);

                T result = operationFn.execute();

                long elapsed = System.currentTimeMillis() - attemptStart;
                metrics.recordSuccess(providerName, elapsed);
                priority.recordSuccess(providerName, elapsed);
                failureCache.recordSuccess(malId, providerName);

                log.info("[PROVIDER_MANAGER] SUCCESS attempt={} malId={} provider={} duration={}ms",
                    attempt + 1, malId, providerName, elapsed);

                return ProviderResult.success(result, providerName, attempts, elapsed);

            } catch (ProviderException e) {
                long elapsed = System.currentTimeMillis() - attemptStart;
                metrics.recordFailure(providerName, elapsed, e.getErrorCode());
                priority.recordFailure(providerName, elapsed, e.getErrorCode());

                attempts.add(new ProviderAttempt(providerName, false, attempt, elapsed, e.getMessage(), e.getErrorCode()));

                log.warn("[PROVIDER_MANAGER] FAILURE attempt={} malId={} provider={} code={} duration={}ms",
                    attempt + 1, malId, providerName, e.getErrorCode(), elapsed);

                if (!policy.shouldRetry(attempt, e, e.getErrorCode())) {
                    failureCache.recordFailure(malId, providerName, e.getErrorCode());
                    return ProviderResult.failure(providerName, attempts, e.getErrorCode(), e.getMessage(), elapsed);
                }

                long delayMs = policy.delayMs(attempt);
                if (delayMs > 0 && attempt < policy.maxRetries()) {
                    try { Thread.sleep(delayMs); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return ProviderResult.failure(providerName, attempts, "INTERRUPTED", "Interrupted during retry delay", elapsed);
                    }
                }

            } catch (Exception e) {
                long elapsed = System.currentTimeMillis() - attemptStart;
                metrics.recordFailure(providerName, elapsed, "UNEXPECTED");
                priority.recordFailure(providerName, elapsed, "UNEXPECTED");

                attempts.add(new ProviderAttempt(providerName, false, attempt, elapsed, e.getMessage(), "UNEXPECTED"));

                log.warn("[PROVIDER_MANAGER] UNEXPECTED attempt={} malId={} provider={} type={} duration={}ms",
                    attempt + 1, malId, providerName, e.getClass().getSimpleName(), elapsed);

                if (!policy.shouldRetry(attempt, e, null)) {
                    failureCache.recordFailure(malId, providerName, "UNEXPECTED");
                    return ProviderResult.failure(providerName, attempts, "UNEXPECTED", e.getMessage(), elapsed);
                }

                long delayMs = policy.delayMs(attempt);
                if (delayMs > 0 && attempt < policy.maxRetries()) {
                    try { Thread.sleep(delayMs); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return ProviderResult.failure(providerName, attempts, "INTERRUPTED", "Interrupted during retry delay", elapsed);
                    }
                }
            }
        }

        return ProviderResult.failure(providerName, attempts, "MAX_RETRIES_EXCEEDED", "All retry attempts exhausted", System.currentTimeMillis() - start);
    }

    public StreamProvider getBestProvider(int malId) {
        List<StreamProvider> available = getAvailableProviders(malId);
        return available.isEmpty() ? null : available.get(0);
    }

    public List<String> getAllProviderNames() {
        return providers.stream().map(StreamProvider::getName).collect(java.util.stream.Collectors.toList());
    }

    public ProviderMetrics getMetrics() { return metrics; }
    public ProviderPriority getPriority() { return priority; }
    public FailureCache getFailureCache() { return failureCache; }

    private StreamProvider findProvider(String name) {
        if (name == null) return null;
        for (StreamProvider p : providers) {
            if (p.getName().equalsIgnoreCase(name)) return p;
        }
        return null;
    }

    @FunctionalInterface
    public interface ProviderOperation<T> {
        T execute() throws ProviderException;
    }

    public record ProviderAttempt(
        String providerName,
        boolean success,
        int attempt,
        long durationMs,
        String error,
        String errorCode
    ) {}

    public record ProviderResult<T>(
        boolean success,
        T data,
        String provider,
        List<ProviderAttempt> attempts,
        String errorCode,
        String errorMessage,
        long totalDurationMs
    ) {
        public static <T> ProviderResult<T> success(T data, String provider, List<ProviderAttempt> attempts, long duration) {
            return new ProviderResult<>(true, data, provider, attempts, null, null, duration);
        }

        public static <T> ProviderResult<T> failure(String provider, List<ProviderAttempt> attempts, String errorCode, String errorMessage, long duration) {
            return new ProviderResult<>(false, null, provider, attempts, errorCode, errorMessage, duration);
        }
    }
}
