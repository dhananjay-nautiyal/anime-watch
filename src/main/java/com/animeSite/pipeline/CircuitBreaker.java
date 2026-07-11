package com.animeSite.pipeline;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class CircuitBreaker {

    private static final Logger log = LoggerFactory.getLogger(CircuitBreaker.class);

    public enum State { CLOSED, OPEN, HALF_OPEN }

    private final String name;
    private final int failureThreshold;
    private final Duration cooldown;
    private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
    private final AtomicInteger failureCount = new AtomicInteger(0);
    private volatile Instant lastFailure = Instant.now();

    public CircuitBreaker(String name, int failureThreshold, Duration cooldown) {
        this.name = name;
        this.failureThreshold = failureThreshold;
        this.cooldown = cooldown;
    }

    public CircuitBreaker(String name) {
        this(name, 3, Duration.ofSeconds(30));
    }

    public boolean isAvailable() {
        State s = state.get();
        if (s == State.CLOSED) return true;
        if (s == State.OPEN) {
            if (Duration.between(lastFailure, Instant.now()).compareTo(cooldown) >= 0) {
                if (state.compareAndSet(State.OPEN, State.HALF_OPEN)) {
                    log.warn("[CIRCUIT] {} half-open → allowing test request", name);
                }
                return true;
            }
            return false;
        }
        return true;
    }

    public void onSuccess() {
        state.set(State.CLOSED);
        failureCount.set(0);
    }

    public void onFailure() {
        lastFailure = Instant.now();
        int count = failureCount.incrementAndGet();
        if (count >= failureThreshold) {
            State prev = state.getAndSet(State.OPEN);
            if (prev != State.OPEN) {
                log.warn("[CIRCUIT] {} OPEN after {} failures (cooldown={}s)", name, count, cooldown.getSeconds());
            }
        }
    }

    public State getState() { return state.get(); }
    public int getFailureCount() { return failureCount.get(); }
    public void reset() { state.set(State.CLOSED); failureCount.set(0); }
}
