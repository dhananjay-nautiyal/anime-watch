package com.animeSite.pipeline;

import java.time.Duration;
import java.util.*;
import java.util.function.Predicate;

public class RetryPolicy {

    private final int maxRetries;
    private final Duration baseDelay;
    private final Duration maxDelay;
    private final double jitterFactor;
    private final List<Predicate<Throwable>> retryConditions;
    private final Set<String> retryableErrorCodes;
    private final Set<String> nonRetryableErrorCodes;

    private RetryPolicy(Builder builder) {
        this.maxRetries = builder.maxRetries;
        this.baseDelay = builder.baseDelay;
        this.maxDelay = builder.maxDelay;
        this.jitterFactor = builder.jitterFactor;
        this.retryConditions = List.copyOf(builder.retryConditions);
        this.retryableErrorCodes = Set.copyOf(builder.retryableErrorCodes);
        this.nonRetryableErrorCodes = Set.copyOf(builder.nonRetryableErrorCodes);
    }

    public int maxRetries() { return maxRetries; }
    public Duration baseDelay() { return baseDelay; }
    public Duration maxDelay() { return maxDelay; }

    public boolean shouldRetry(int attempt, Throwable error, String errorCode) {
        if (attempt >= maxRetries) return false;
        if (errorCode != null && nonRetryableErrorCodes.contains(errorCode)) return false;
        if (errorCode != null && !retryableErrorCodes.isEmpty() && !retryableErrorCodes.contains(errorCode)) return false;
        for (Predicate<Throwable> condition : retryConditions) {
            if (condition.test(error)) return false;
        }
        return true;
    }

    public long delayMs(int attempt) {
        double exponentialBackoff = baseDelay.toMillis() * Math.pow(2, attempt);
        double capped = Math.min(exponentialBackoff, maxDelay.toMillis());
        double jitter = capped * jitterFactor * (new Random().nextDouble() * 2 - 1);
        return Math.max(0, (long) (capped + jitter));
    }

    public static Builder builder() { return new Builder(); }

    public static final RetryPolicy DEFAULT = RetryPolicy.builder()
        .maxRetries(3)
        .baseDelay(Duration.ofSeconds(1))
        .maxDelay(Duration.ofSeconds(10))
        .jitterFactor(0.3)
        .retryableErrorCodes("TIMEOUT", "NETWORK_ERROR", "HTTP_429", "HTTP_503", "HTTP_502", "SERVER_ERROR")
        .nonRetryableErrorCodes("HTTP_400_INVALID_ID", "HTTP_404", "HTTP_403", "ANTI_BOT", "PROVIDER_NOT_FOUND")
        .build();

    public static final RetryPolicy STREAM_RETRY = RetryPolicy.builder()
        .maxRetries(2)
        .baseDelay(Duration.ofMillis(500))
        .maxDelay(Duration.ofSeconds(5))
        .jitterFactor(0.2)
        .retryableErrorCodes("TIMEOUT", "NETWORK_ERROR", "HTTP_429")
        .build();

    public static final RetryPolicy HEALTH_CHECK = RetryPolicy.builder()
        .maxRetries(1)
        .baseDelay(Duration.ofSeconds(1))
        .maxDelay(Duration.ofSeconds(2))
        .jitterFactor(0.1)
        .build();

    public static final RetryPolicy NO_RETRY = RetryPolicy.builder()
        .maxRetries(0)
        .build();

    public static class Builder {
        private int maxRetries = 3;
        private Duration baseDelay = Duration.ofSeconds(1);
        private Duration maxDelay = Duration.ofSeconds(30);
        private double jitterFactor = 0.3;
        private final List<Predicate<Throwable>> retryConditions = new ArrayList<>();
        private final Set<String> retryableErrorCodes = new HashSet<>();
        private final Set<String> nonRetryableErrorCodes = new HashSet<>();

        public Builder maxRetries(int maxRetries) { this.maxRetries = maxRetries; return this; }
        public Builder baseDelay(Duration baseDelay) { this.baseDelay = baseDelay; return this; }
        public Builder maxDelay(Duration maxDelay) { this.maxDelay = maxDelay; return this; }
        public Builder jitterFactor(double jitterFactor) { this.jitterFactor = jitterFactor; return this; }
        public Builder addRetryCondition(Predicate<Throwable> condition) { this.retryConditions.add(condition); return this; }
        public Builder retryableErrorCodes(String... codes) { Collections.addAll(this.retryableErrorCodes, codes); return this; }
        public Builder nonRetryableErrorCodes(String... codes) { Collections.addAll(this.nonRetryableErrorCodes, codes); return this; }
        public RetryPolicy build() { return new RetryPolicy(this); }
    }
}
