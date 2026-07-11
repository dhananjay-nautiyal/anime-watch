package com.animeSite.pipeline;

import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeProviderCache;
import com.animeSite.repo.AnimeProviderCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
public class VerificationService {

    private static final Logger log = LoggerFactory.getLogger(VerificationService.class);

    private final ProviderResolver providerResolver;
    private final AnimeProviderCacheRepository cacheRepository;

    public VerificationService(ProviderResolver providerResolver,
                                AnimeProviderCacheRepository cacheRepository) {
        this.providerResolver = providerResolver;
        this.cacheRepository = cacheRepository;
    }

    public List<Integer> filterStreamable(List<Integer> malIds) {
        List<Integer> result = new ArrayList<>();
        List<Integer> toVerify = new ArrayList<>();

        for (int malId : malIds) {
            AnimeProviderCache cached = cacheRepository.findByMalId(malId).orElse(null);
            if (cached != null && !cached.isExpired()) {
                if (cached.isStreamable()) {
                    result.add(malId);
                }
            } else {
                toVerify.add(malId);
            }
        }

        if (!toVerify.isEmpty()) {
            log.info("[VERIFY] checking {} uncached anime", toVerify.size());
            for (int malId : toVerify) {
                boolean streamable = checkAnimeSync(malId);
                if (streamable) result.add(malId);
            }
        }

        return result;
    }

    public List<Anime> filterStreamableAnime(List<Anime> animeList) {
        List<Integer> malIds = animeList.stream()
            .map(Anime::getMalId)
            .collect(Collectors.toList());

        Set<Integer> streamableIds = new HashSet<>(filterStreamable(malIds));

        return animeList.stream()
            .filter(a -> streamableIds.contains(a.getMalId()))
            .collect(Collectors.toList());
    }

    @Async
    public CompletableFuture<Void> verifyInBackground(List<Integer> malIds) {
        for (int malId : malIds) {
            AnimeProviderCache cached = cacheRepository.findByMalId(malId).orElse(null);
            if (cached != null && !cached.isExpired()) continue;
            checkAnimeSync(malId);
            try { Thread.sleep(2000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); break; }
        }
        return CompletableFuture.completedFuture(null);
    }

    private boolean checkAnimeSync(int malId) {
        long start = System.currentTimeMillis();
        log.info("[VERIFY] CHECK_ANIME | malId={}", malId);

        AnimeProviderCache cached = cacheRepository.findByMalId(malId).orElse(null);
        if (cached != null && !cached.isExpired()) {
            log.info("[VERIFY] CACHED | malId={} streamable={} cachedAt={}", malId, cached.isStreamable(), cached.getCreatedAt());
            return cached.isStreamable();
        }

        try {
            String title = "Anime " + malId;
            var result = providerResolver.resolveEpisodes(malId, title);
            boolean streamable = result.success && result.data != null && !result.data.isEmpty();
            long elapsed = System.currentTimeMillis() - start;
            log.info("[VERIFY] RESULT | malId={} streamable={} provider={} count={} duration={}ms",
                malId, streamable, result.provider, result.data != null ? result.data.size() : 0, elapsed);
            return streamable;
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[VERIFY] FAILED | malId={} error='{}' duration={}ms", malId, e.getMessage(), elapsed);
            return false;
        }
    }
}
