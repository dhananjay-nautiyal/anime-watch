package com.animeSite.pipeline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.Random;
import java.util.concurrent.Callable;
import java.util.function.Predicate;

public class RetryEngine {

    private static final Logger log = LoggerFactory.getLogger(RetryEngine.class);
    private static final Random RNG = new Random();

    private final int maxRetries;
    private final long baseDelayMs;
    private final long maxDelayMs;
    private final int jitterMs;
    private final CircuitBreaker circuitBreaker;

    private RetryEngine(Builder builder) {
        this.maxRetries = builder.maxRetries;
        this.baseDelayMs = builder.baseDelayMs;
        this.maxDelayMs = builder.maxDelayMs;
        this.jitterMs = builder.jitterMs;
        this.circuitBreaker = builder.circuitBreaker;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private int maxRetries = 5;
        private long baseDelayMs = 500;
        private long maxDelayMs = 8000;
        private int jitterMs = 300;
        private CircuitBreaker circuitBreaker;

        public Builder maxRetries(int v) { this.maxRetries = v; return this; }
        public Builder baseDelayMs(long v) { this.baseDelayMs = v; return this; }
        public Builder maxDelayMs(long v) { this.maxDelayMs = v; return this; }
        public Builder jitterMs(int v) { this.jitterMs = v; return this; }
        public Builder circuitBreaker(CircuitBreaker v) { this.circuitBreaker = v; return this; }
        public RetryEngine build() { return new RetryEngine(this); }
    }

    public <T> RetryResult<T> execute(Callable<T> call, Predicate<T> validator, String context) {
        return execute(call, validator, t -> true, context);
    }

    public <T> RetryResult<T> execute(Callable<T> call, Predicate<T> validator,
                                       Predicate<Exception> isRetryable, String context) {
        long start = System.currentTimeMillis();
        Exception lastException = null;
        T lastResult = null;

        if (circuitBreaker != null && !circuitBreaker.isAvailable()) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[RETRY] {} | CIRCUIT_OPEN | skipping immediately | duration={}ms", context, elapsed);
            return RetryResult.failure("Circuit breaker open for " + context, 0, elapsed);
        }

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            long attemptStart = System.currentTimeMillis();
            try {
                T result = call.call();
                long elapsed = System.currentTimeMillis() - attemptStart;

                // Call succeeded without exception
                if (validator != null && !validator.test(result)) {
                    log.warn("[RETRY] {} | attempt={}/{} | VALIDATION_FAILED | duration={}ms", context, attempt, maxRetries, elapsed);
                    // Don't retry — provider returned successfully with no/invalid data (permanent)
                    long total = System.currentTimeMillis() - start;
                    String msg = "Provider returned invalid result on attempt " + attempt;
                    return RetryResult.failure(msg, attempt, total);
                }

                if (circuitBreaker != null) circuitBreaker.onSuccess();
                if (attempt > 1) {
                    log.info("[RETRY] {} | SUCCESS on attempt {}/{} | duration={}ms", context, attempt, maxRetries, elapsed);
                } else {
                    log.info("[RETRY] {} | SUCCESS on attempt 1 | duration={}ms", context, elapsed);
                }
                return RetryResult.success(result, attempt, System.currentTimeMillis() - start);

            } catch (Exception e) {
                lastException = e;
                long elapsed = System.currentTimeMillis() - attemptStart;
                boolean retryable = isRetryable.test(e);
                log.warn("[RETRY] {} | attempt={}/{} | {} | {} | duration={}ms",
                    context, attempt, maxRetries,
                    retryable ? "RETRYABLE" : "FATAL",
                    e.getClass().getSimpleName() + ": " + e.getMessage(),
                    elapsed);

                if (!retryable) {
                    if (circuitBreaker != null) {
                        circuitBreaker.onFailure();
                        if (!circuitBreaker.isAvailable()) {
                            log.warn("[RETRY] {} | circuit breaker opened by fatal error", context);
                        }
                    }
                    long total = System.currentTimeMillis() - start;
                    return RetryResult.failure(e.getMessage(), attempt, total);
                }

                // Retryable exception — wait and retry
                if (attempt < maxRetries) {
                    long delay = computeDelay(attempt);
                    log.info("[RETRY] {} | waiting {}ms before attempt {}/{}", context, delay, attempt + 1, maxRetries);
                    try { Thread.sleep(delay); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        long total = System.currentTimeMillis() - start;
                        return RetryResult.failure("Interrupted", attempt, total);
                    }
                }
            }
        }

        if (circuitBreaker != null) circuitBreaker.onFailure();
        long total = System.currentTimeMillis() - start;
        String msg = lastException != null
            ? "All " + maxRetries + " attempts failed: " + lastException.getMessage()
            : "All " + maxRetries + " attempts returned invalid results";
        return RetryResult.failure(msg, maxRetries, total);
    }

    private long computeDelay(int attempt) {
        long delay = Math.min(baseDelayMs * (1L << (attempt - 1)), maxDelayMs);
        int jitter = jitterMs > 0 ? RNG.nextInt(jitterMs * 2 + 1) - jitterMs : 0;
        return Math.max(0, delay + jitter);
    }

    public static class RetryResult<T> {
        private final T result;
        private final String error;
        private final int attempts;
        private final long totalDurationMs;
        private final boolean success;

        private RetryResult(T result, String error, int attempts, long totalDurationMs, boolean success) {
            this.result = result;
            this.error = error;
            this.attempts = attempts;
            this.totalDurationMs = totalDurationMs;
            this.success = success;
        }

        public static <T> RetryResult<T> success(T result, int attempts, long totalDurationMs) {
            return new RetryResult<>(result, null, attempts, totalDurationMs, true);
        }

        public static <T> RetryResult<T> failure(String error, int attempts, long totalDurationMs) {
            return new RetryResult<>(null, error, attempts, totalDurationMs, false);
        }

        public T get() { return result; }
        public String getError() { return error; }
        public int getAttempts() { return attempts; }
        public long getDurationMs() { return totalDurationMs; }
        public boolean isSuccess() { return success; }
    }
}
