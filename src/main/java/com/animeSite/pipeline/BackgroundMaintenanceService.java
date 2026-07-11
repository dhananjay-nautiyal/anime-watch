package com.animeSite.pipeline;

import com.animeSite.repo.AnimeProviderCacheRepository;
import com.animeSite.persist.AnimeProviderCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class BackgroundMaintenanceService {

    private static final Logger log = LoggerFactory.getLogger(BackgroundMaintenanceService.class);

    private final AnimeProviderCacheRepository cacheRepository;
    private final List<StreamProvider> providers;
    private final ProviderHealthMonitor healthMonitor;

    public BackgroundMaintenanceService(
            AnimeProviderCacheRepository cacheRepository,
            List<StreamProvider> providers,
            ProviderHealthMonitor healthMonitor) {
        this.cacheRepository = cacheRepository;
        this.providers = providers;
        this.healthMonitor = healthMonitor;
    }

    @Scheduled(fixedRate = 300_000)
    public void cleanupStaleCache() {
        long start = System.currentTimeMillis();
        log.info("[MAINTENANCE] CLEANUP_STALE_CACHE | start");
        try {
            int removed = 0;
            List<AnimeProviderCache> all = cacheRepository.findAll();
            Instant now = Instant.now();
            for (AnimeProviderCache c : all) {
                if (c.isExpired()) {
                    cacheRepository.delete(c);
                    removed++;
                }
            }
            long elapsed = System.currentTimeMillis() - start;
            if (removed > 0) {
                log.info("[MAINTENANCE] CLEANED | removed={} duration={}ms", removed, elapsed);
            }
        } catch (Exception e) {
            log.warn("[MAINTENANCE] CLEANUP_FAILED | error='{}'", e.getMessage());
        }
    }

    @Scheduled(fixedRate = 600_000)
    public void refreshProviderHealth() {
        long start = System.currentTimeMillis();
        log.info("[MAINTENANCE] REFRESH_PROVIDER_HEALTH | start");
        try {
            for (StreamProvider provider : providers) {
                try {
                    boolean healthy = provider.healthCheck();
                    long elapsed = System.currentTimeMillis() - start;
                    long latency = elapsed;
                    if (healthy) {
                        healthMonitor.recordSuccess(provider.getName(), latency);
                        log.info("[MAINTENANCE] HEALTH_OK | provider={} latency={}ms", provider.getName(), latency);
                    } else {
                        healthMonitor.recordFailure(provider.getName(), latency);
                        log.warn("[MAINTENANCE] HEALTH_FAIL | provider={} latency={}ms", provider.getName(), latency);
                    }
                } catch (Exception e) {
                    log.warn("[MAINTENANCE] HEALTH_CHECK_FAILED | provider='{}' error='{}'", provider.getName(), e.getMessage());
                    healthMonitor.recordFailure(provider.getName(), System.currentTimeMillis() - start);
                }
            }
            long elapsed = System.currentTimeMillis() - start;
            log.info("[MAINTENANCE] HEALTH_REFRESH_COMPLETE | providers={} duration={}ms", providers.size(), elapsed);
        } catch (Exception e) {
            log.warn("[MAINTENANCE] HEALTH_REFRESH_FAILED | error='{}'", e.getMessage());
        }
    }

    @Scheduled(fixedRate = 900_000)
    public void refreshStreamability() {
        long start = System.currentTimeMillis();
        log.info("[MAINTENANCE] REFRESH_STREAMABILITY | start");
        try {
            int refreshed = 0;
            int total = 0;
            List<AnimeProviderCache> all = cacheRepository.findAll();
            for (AnimeProviderCache c : all) {
                total++;
                if (c.isStreamable() && c.getEpisodeCount() > 0) {
                    if (c.isExpired() || c.getExpiresAt().isBefore(Instant.now().plusSeconds(3600))) {
                        c.setExpiresAt(Instant.now().plusSeconds(86400));
                        cacheRepository.save(c);
                        refreshed++;
                    }
                }
            }
            long elapsed = System.currentTimeMillis() - start;
            if (refreshed > 0) {
                log.info("[MAINTENANCE] STREAMABILITY_REFRESHED | total={} refreshed={} duration={}ms", total, refreshed, elapsed);
            } else {
                log.debug("[MAINTENANCE] STREAMABILITY_CHECKED | total={} duration={}ms", total, elapsed);
            }
        } catch (Exception e) {
            log.warn("[MAINTENANCE] STREAMABILITY_REFRESH_FAILED | error='{}'", e.getMessage());
        }
    }
}
