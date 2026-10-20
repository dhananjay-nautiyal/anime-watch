package com.animeSite.pipeline;

import com.animeSite.constant.AnimeStatus;
import com.animeSite.persist.Anime;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.service.SlugService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Seeds the offline catalogue on first boot. Runs before {@link SlugMigration}
 * so that every seeded title already carries a slug; the migration remains as
 * a repair pass for pre-existing rows.
 */
@Component
@Order(1)
public class OfflineCatalogSeeder implements CommandLineRunner {

    private final AnimeRepository animeRepository;
    private final SlugService slugService;

    public OfflineCatalogSeeder(AnimeRepository animeRepository, SlugService slugService) {
        this.animeRepository = animeRepository;
        this.slugService = slugService;
    }

    @Override
    public void run(String... args) {
        // Catalog top-up: existing DBs seeded with the old 20-title list
        // (count < 100) get the offline catalog added on next boot.
        // Skip only once the catalog is in (count >= 100).
        if (animeRepository.count() >= 100) return;

        // Offline catalog first (works with zero external connectivity):
        // 1500 curated titles. Episodes are deliberately not fabricated here;
        // they are filled in by a real provider sync.
        try {
            ClassPathResource res = new ClassPathResource("static-data/offline-catalog.json");
            if (res.exists()) {
                ObjectMapper mapper = new ObjectMapper();
                List<Map<String, Object>> rows = mapper.readValue(
                        res.getInputStream(), new TypeReference<>() {});
                List<Anime> catalog = new ArrayList<>();
                // Never duplicate: skip titles already present.
                Set<Integer> present = new HashSet<>();
                Set<String> usedSlugs = new HashSet<>();
                for (Anime existing : animeRepository.findAll()) {
                    present.add(existing.getMalId());
                    if (existing.getSlug() != null && !existing.getSlug().isBlank()) {
                        usedSlugs.add(existing.getSlug());
                    }
                }
                for (Map<String, Object> r : rows) {
                    int rowMalId = (Integer) r.get("malId");
                    int eps = r.get("episodes") instanceof Number n ? n.intValue() : 0;
                    if (!present.contains(rowMalId)) {
                        Anime a = new Anime();
                        a.setMalId(rowMalId);
                        a.setTitle((String) r.get("title"));
                        a.setSlug(uniqueSlug(a.getTitle(), rowMalId, usedSlugs));
                        Object syn = r.get("synonyms");
                        if (syn instanceof List<?> l && !l.isEmpty()) {
                            a.setTitleSynonyms(String.join("|", l.stream().map(String::valueOf).toList()));
                        }
                        if (r.get("score") instanceof Number n) a.setScore(n.doubleValue());
                        a.setEpisodes(eps);
                        a.setType((String) r.get("type"));
                        a.setStatus(AnimeStatus.normalize((String) r.get("status")));
                        if (r.get("year") instanceof Number n) a.setYear(n.intValue());
                        a.setSeason((String) r.get("season"));
                        a.setImageUrl((String) r.get("imageUrl"));
                        catalog.add(a);
                        present.add(rowMalId);
                    }
                }
                animeRepository.saveAll(catalog);
                System.out.println("Seeded offline catalog: " + catalog.size() + " anime.");
                return;
            }
        } catch (Exception e) {
            System.out.println("Offline catalog seed failed, falling back: " + e.getMessage());
        }

        List<Anime> seedList = List.of(
            createAnime(1, "Cowboy Bebop", "Spike and Jet chase criminals across the galaxy aboard the Bebop.", 8.75, 26,
                "https://cdn.myanimelist.net/images/anime/4/19644.jpg"),
            createAnime(5, "Cowboy Bebop: Tengoku no Tobira", "A terrorist bombing leads Spike and the Bebop crew to investigate a deadly virus.", 8.35, 1,
                "https://cdn.myanimelist.net/images/anime/5/14334.jpg"),
            createAnime(6, "Trigun", "Vash the Stampede, a gunslinger with a $60 billion bounty, tries to avoid violence.", 8.22, 26,
                "https://cdn.myanimelist.net/images/anime/7/20310.jpg"),
            createAnime(7, "Witch Hunter Robin", "Robin Sena joins STN-J to hunt witches, but uncovers dark secrets.", 7.33, 26,
                "https://cdn.myanimelist.net/images/anime/6/75477.jpg"),
            createAnime(15, "Eyeshield 21", "A timid boy becomes a star running back in American football.", 8.16, 145,
                "https://cdn.myanimelist.net/images/anime/3/76170.jpg"),
            createAnime(16, "Hack//Sign", "Trapped in an MMORPG, a young boy searches for a way out.", 7.20, 26,
                "https://cdn.myanimelist.net/images/anime/11/80197.jpg"),
            createAnime(17, "Hack//Dusk", "The story of the .hack//SIGN characters in the real world.", 7.46, 12,
                "https://cdn.myanimelist.net/images/anime/11/80198.jpg"),
            createAnime(19, "Monster", "Dr. Tenma faces the horrific consequences of saving a child's life.", 8.87, 74,
                "https://cdn.myanimelist.net/images/anime/10/18793.jpg"),
            createAnime(20, "Naruto", "A young ninja seeks acknowledgment and dreams of becoming Hokage.", 7.99, 220,
                "https://cdn.myanimelist.net/images/anime/13/17405.jpg"),
            createAnime(21, "One Piece", "Monkey D. Luffy sails the Grand Line in search of the One Piece treasure.", 8.73, null,
                "https://cdn.myanimelist.net/images/anime/1244/138851.jpg"),
            createAnime(24, "Shin Seiki Evangelion", "Teenagers pilot giant mechas to protect Earth from mysterious Angels.", 8.34, 26,
                "https://cdn.myanimelist.net/images/anime/1314/108941.jpg"),
            createAnime(25, "Evangelion: 1.0 You Are (Not) Alone", "Rebuild of Evangelion part 1.", 7.97, 1,
                "https://cdn.myanimelist.net/images/anime/8/40385.jpg"),
            createAnime(26, "Evangelion: 2.0 You Can (Not) Advance", "Rebuild of Evangelion part 2.", 8.19, 1,
                "https://cdn.myanimelist.net/images/anime/6/12322.jpg"),
            createAnime(30, "Evangelion: 3.0 You Can (Not) Redo", "Rebuild of Evangelion part 3.", 7.42, 1,
                "https://cdn.myanimelist.net/images/anime/9/12643.jpg"),
            createAnime(32, "Neon Genesis Evangelion: The End of Evangelion", "The epic conclusion to the Evangelion series.", 8.58, 1,
                "https://cdn.myanimelist.net/images/anime/1404/110007.jpg"),
            createAnime(52, "Mobile Suit Gundam: Dai 08 MS Shotai", "A ground-based Gundam squad fights in the jungles of Earth.", 8.20, 12,
                "https://cdn.myanimelist.net/images/anime/8/11642.jpg"),
            createAnime(73, "Full Metal Panic!", "Sousuke Sagara, a military specialist, must protect female high school student Kaname Chidori.", 7.70, 24,
                "https://cdn.myanimelist.net/images/anime/3/84353.jpg"),
            createAnime(74, "Full Metal Panic? Fumoffu", "A comedic spin-off of Full Metal Panic!", 8.07, 12,
                "https://cdn.myanimelist.net/images/anime/4/75203.jpg"),
            createAnime(80, "Mobile Suit Gundam: Dai 08 MS Shotai - Miller's Report", "A side story complementing the 08th MS Team series.", 7.56, 1,
                "https://cdn.myanimelist.net/images/anime/6/11644.jpg"),
            createAnime(100, "Shinigami no Ballad", "A gentle girl who acts as a psychopomp helps souls pass on.", 7.05, 6,
                "https://cdn.myanimelist.net/images/anime/9/75188.jpg")
        );
        // Legacy 20-title seed: only on a truly empty DB, so it can never
        // duplicate rows on catalog top-up boots.
        if (animeRepository.count() == 0) {
            Set<String> usedSlugs = new HashSet<>();
            for (Anime anime : seedList) {
                anime.setSlug(uniqueSlug(anime.getTitle(), anime.getMalId(), usedSlugs));
            }
            animeRepository.saveAll(seedList);
            System.out.println("Seeded " + seedList.size() + " anime into the database.");
        }
    }

    /**
     * SlugService only checks the database, but a seed batch is saved in one
     * go, so catalog rows cannot see each other yet (the catalogue contains
     * real duplicate titles, e.g. four Gintama entries). Track the batch here.
     */
    private String uniqueSlug(String title, int malId, Set<String> used) {
        String base = slugService.ensureUniqueSlug(slugService.generateSlug(title), malId);
        String candidate = base;
        if (used.contains(candidate)) candidate = base + "-" + malId;
        int suffix = 2;
        while (!used.add(candidate)) {
            candidate = base + "-" + malId + "-" + suffix++;
        }
        return candidate;
    }

    private Anime createAnime(int malId, String title, String synopsis, double score, Integer episodes, String imageUrl) {
        Anime anime = new Anime();
        anime.setMalId(malId);
        anime.setTitle(title);
        anime.setSynopsis(synopsis);
        anime.setScore(score);
        anime.setEpisodes(episodes);
        anime.setImageUrl(imageUrl);
        return anime;
    }
}
