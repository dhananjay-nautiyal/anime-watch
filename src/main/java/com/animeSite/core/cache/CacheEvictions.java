package com.animeSite.core.cache;

import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Clearing a cache from inside a write transaction is too early: the row has
 * not committed yet, so a concurrent read would cache the pre-write value and
 * serve it for the cache TTL. The two writers that bypass {@code @Cacheable} -
 * the boot-time seeder and the lazy enricher - both run inside a transaction,
 * so their eviction is deferred to after commit. When no transaction is active
 * (direct calls, unit tests) the eviction runs immediately.
 */
public final class CacheEvictions {

    private CacheEvictions() {
    }

    /** Clear whole caches once the surrounding transaction has committed. */
    public static void clearAfterCommit(CacheManager cacheManager, String... cacheNames) {
        if (cacheManager == null || cacheNames == null || cacheNames.length == 0) return;
        afterCommit(() -> {
            for (String name : cacheNames) {
                Cache cache = cacheManager.getCache(name);
                if (cache != null) cache.clear();
            }
        });
    }

    /** Evict individual keys once the surrounding transaction has committed. */
    public static void evictKeysAfterCommit(CacheManager cacheManager, String cacheName, String... keys) {
        if (cacheManager == null || keys == null || keys.length == 0) return;
        afterCommit(() -> {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache == null) return;
            for (String key : keys) cache.evict(key);
        });
    }

    private static void afterCommit(Runnable eviction) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    eviction.run();
                }
            });
        } else {
            eviction.run();
        }
    }
}
