package com.animeSite.pipeline;

import com.animeSite.constant.AnimeStatus;
import com.animeSite.persist.Anime;
import com.animeSite.repo.AnimeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Rewrites legacy status values (FINISHED, "Finished Airing", complete, ...)
 * to the canonical lowercase vocabulary. Runs after seeding so a fresh
 * database is already correct, and repairs databases that predate the change.
 */
@Component
@Order(3)
public class StatusMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(StatusMigration.class);

    private final AnimeRepository animeRepository;

    public StatusMigration(AnimeRepository animeRepository) {
        this.animeRepository = animeRepository;
    }

    @Override
    public void run(String... args) {
        List<Anime> changed = new ArrayList<>();
        for (Anime anime : animeRepository.findAll()) {
            String canonical = AnimeStatus.canonicalOrNull(anime.getStatus());
            if (canonical != null && !canonical.equals(anime.getStatus())) {
                anime.setStatus(canonical);
                changed.add(anime);
            }
        }

        if (changed.isEmpty()) {
            log.info("[STATUS_MIGRATION] All anime already use the canonical status vocabulary.");
            return;
        }

        animeRepository.saveAll(changed);
        log.info("[STATUS_MIGRATION] Normalized {} anime status values.", changed.size());
    }
}
