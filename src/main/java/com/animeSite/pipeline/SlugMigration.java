package com.animeSite.pipeline;

import com.animeSite.persist.Anime;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.service.SlugService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class SlugMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SlugMigration.class);

    private final AnimeRepository animeRepository;
    private final SlugService slugService;

    public SlugMigration(AnimeRepository animeRepository, SlugService slugService) {
        this.animeRepository = animeRepository;
        this.slugService = slugService;
    }

    @Override
    public void run(String... args) {
        java.util.List<Anime> withoutSlug = animeRepository.findAll().stream()
            .filter(a -> a.getSlug() == null || a.getSlug().isBlank())
            .toList();

        if (withoutSlug.isEmpty()) {
            log.info("[SLUG_MIGRATION] All anime already have slugs.");
            return;
        }

        log.info("[SLUG_MIGRATION] Generating slugs for {} anime...", withoutSlug.size());

        int count = 0;
        for (Anime anime : withoutSlug) {
            try {
                String rawSlug = slugService.generateSlug(anime.getTitle());
                anime.setSlug(slugService.ensureUniqueSlug(rawSlug, anime.getMalId()));
                animeRepository.save(anime);
                count++;
                if (count % 50 == 0) {
                    log.info("[SLUG_MIGRATION] Progress: {}/{}", count, withoutSlug.size());
                }
            } catch (Exception e) {
                log.error("[SLUG_MIGRATION] Failed for animeId={} malId={} title='{}': {}",
                    anime.getId(), anime.getMalId(), anime.getTitle(), e.getMessage());
            }
        }

        log.info("[SLUG_MIGRATION] Complete. Generated {} slugs.", count);
    }
}
