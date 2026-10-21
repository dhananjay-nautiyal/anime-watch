package com.animeSite.service;

import com.animeSite.persist.Episode;
import com.animeSite.repo.EpisodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Removes duplicate episode rows left behind by older builds.
 *
 * <p>Earlier versions deleted every episode of a title and re-inserted the
 * fresh list. Two concurrent syncs (two tabs, a retry racing the original
 * request) could both delete before either inserted, which stored every
 * episode number twice — One Piece showed 2360 episodes instead of 1180 and
 * the player looked broken.
 *
 * <p>The sync service now merges instead of replacing, and this runner cleans
 * up whatever is already in the database on start-up.
 */
@Component
public class EpisodeDedupeRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EpisodeDedupeRunner.class);

    /** Safety limit so a huge table can never block the boot sequence. */
    private static final int MAX_KEYS_PER_RUN = 5000;

    private final EpisodeRepository episodeRepository;

    public EpisodeDedupeRunner(EpisodeRepository episodeRepository) {
        this.episodeRepository = episodeRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            dedupe();
        } catch (Exception e) {
            log.warn("[DEDUPE] skipped: {}", e.getMessage());
        }
    }

    @Transactional
    public int dedupe() {
        List<Object[]> keys = episodeRepository.findDuplicateEpisodeKeys();
        if (keys == null || keys.isEmpty()) {
            log.info("[DEDUPE] no duplicate episodes found");
            return 0;
        }

        int removed = 0;
        int processed = 0;
        List<Episode> doomed = new ArrayList<>();

        for (Object[] key : keys) {
            if (processed++ >= MAX_KEYS_PER_RUN) {
                log.warn("[DEDUPE] stopped after {} keys, run again for the rest", MAX_KEYS_PER_RUN);
                break;
            }
            Integer malId = (Integer) key[0];
            Integer number = (Integer) key[1];
            if (malId == null || number == null) continue;

            List<Episode> group = episodeRepository.findAllByAnimeMalIdAndEpisodeNumber(malId, number);
            if (group.size() < 2) continue;

            // Keep the first row, drop the rest.
            for (int i = 1; i < group.size(); i++) {
                doomed.add(group.get(i));
            }
        }

        if (!doomed.isEmpty()) {
            episodeRepository.deleteAll(doomed);
            episodeRepository.flush();
            removed = doomed.size();
        }

        log.info("[DEDUPE] removed {} duplicate episode rows across {} episode numbers", removed, processed);
        return removed;
    }
}
