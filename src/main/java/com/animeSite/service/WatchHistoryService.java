package com.animeSite.service;

import com.animeSite.persist.WatchHistory;
import com.animeSite.repo.WatchHistoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class WatchHistoryService {

    private static final Logger log = LoggerFactory.getLogger(WatchHistoryService.class);

    private final WatchHistoryRepository repository;

    public WatchHistoryService(WatchHistoryRepository repository) {
        this.repository = repository;
    }

    public WatchHistory saveProgress(UUID userId, int malId, int episodeNumber,
                                     double progressSeconds, double durationSeconds,
                                     String animeTitle, String animeImage) {
        WatchHistory entry = repository.findByUserIdAndMalId(userId, malId)
            .orElse(new WatchHistory());

        entry.setUserId(userId);
        entry.setMalId(malId);
        entry.setEpisodeNumber(episodeNumber);
        entry.setProgressSeconds(progressSeconds);
        entry.setDurationSeconds(durationSeconds);
        entry.setAnimeTitle(animeTitle);
        entry.setAnimeImage(animeImage);
        entry.setUpdatedAt(Instant.now());

        WatchHistory saved = repository.save(entry);
        log.debug("[WATCH_HISTORY] Saved | userId={} malId={} episode={} progress={}s", userId, malId, episodeNumber, Math.round(progressSeconds));
        return saved;
    }

    public Optional<WatchHistory> getProgress(UUID userId, int malId) {
        return repository.findByUserIdAndMalId(userId, malId);
    }

    public List<WatchHistory> getRecentHistory(UUID userId, int limit) {
        return repository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
            .limit(limit)
            .toList();
    }

    public void deleteProgress(UUID userId, int malId) {
        repository.deleteByUserIdAndMalId(userId, malId);
        log.debug("[WATCH_HISTORY] Deleted | userId={} malId={}", userId, malId);
    }
}
