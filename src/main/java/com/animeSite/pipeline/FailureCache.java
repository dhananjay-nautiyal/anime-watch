package com.animeSite.pipeline;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class FailureCache {

    private static final Duration DEFAULT_TTL = Duration.ofHours(1);
    private static final Duration RETRY_AFTER_FAILURE = Duration.ofMinutes(30);
    private static final int MAX_ENTRIES = 10000;

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public void recordFailure(int malId, String provider, String errorCode) {
        String key = key(malId, provider);
        CacheEntry entry = cache.get(key);
        if (entry == null) {
            entry = new CacheEntry(malId, provider, errorCode, Instant.now());
        } else {
            entry.lastFailure = Instant.now();
            entry.failureCount++;
            entry.lastErrorCode = errorCode;
        }
        cache.put(key, entry);
        evictIfNeeded();
    }

    public boolean isBlacklisted(int malId, String provider) {
        String key = key(malId, provider);
        CacheEntry entry = cache.get(key);
        if (entry == null) return false;
        if (Duration.between(entry.lastFailure, Instant.now()).compareTo(RETRY_AFTER_FAILURE) > 0) {
            cache.remove(key);
            return false;
        }
        return true;
    }

    public void recordSuccess(int malId, String provider) {
        cache.remove(key(malId, provider));
    }

    public List<String> getBlacklistedProviders(int malId) {
        List<String> result = new ArrayList<>();
        for (Map.Entry<String, CacheEntry> e : cache.entrySet()) {
            if (e.getValue().malId == malId &&
                Duration.between(e.getValue().lastFailure, Instant.now()).compareTo(RETRY_AFTER_FAILURE) <= 0) {
                result.add(e.getValue().provider);
            }
        }
        return result;
    }

    public void clear(int malId) {
        cache.entrySet().removeIf(e -> e.getValue().malId == malId);
    }

    public void clearAll() {
        cache.clear();
    }

    public int size() { return cache.size(); }

    private void evictIfNeeded() {
        if (cache.size() > MAX_ENTRIES) {
            cache.entrySet().removeIf(e ->
                Duration.between(e.getValue().lastFailure, Instant.now()).compareTo(DEFAULT_TTL) > 0
            );
        }
    }

    private String key(int malId, String provider) {
        return malId + ":" + (provider != null ? provider.toLowerCase() : "unknown");
    }

    static class CacheEntry {
        final int malId;
        final String provider;
        String lastErrorCode;
        Instant lastFailure;
        int failureCount;

        CacheEntry(int malId, String provider, String errorCode, Instant lastFailure) {
            this.malId = malId;
            this.provider = provider;
            this.lastErrorCode = errorCode;
            this.lastFailure = lastFailure;
            this.failureCount = 1;
        }
    }
}
