package com.animeSite.pipeline;

import com.animeSite.constant.AnimeStatus;
import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeStudio;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.AnimeStudioRepository;
import com.animeSite.service.SlugService;
import com.animeSite.util.MalPlaceholders;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Seeds the offline catalogue on first boot. Runs before {@link SlugMigration}
 * so that every seeded title already carries a slug; the migration remains as
 * a repair pass for pre-existing rows.
 *
 * <p>The catalogue is applied idempotently: titles the database does not know
 * yet are inserted, and detail fields (synopsis, studios, duration, source,
 * aired, rating, members, popularity, favourites, rank) that the catalogue
 * ships but an older seed left empty are filled in. Nothing already present is
 * overwritten, so rows imported through the Jikan pipeline keep their data.
 */
@Component
@Order(1)
public class OfflineCatalogSeeder implements CommandLineRunner {

    private final AnimeRepository animeRepository;
    private final SlugService slugService;
    private final AnimeStudioRepository studioRepository;

    public OfflineCatalogSeeder(AnimeRepository animeRepository, SlugService slugService,
                                AnimeStudioRepository studioRepository) {
        this.animeRepository = animeRepository;
        this.slugService = slugService;
        this.studioRepository = studioRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        // Offline catalog first (works with zero external connectivity):
        // 1500 curated titles. Episodes are deliberately not fabricated here;
        // they are filled in by a real provider sync.
        try {
            ClassPathResource res = new ClassPathResource("static-data/offline-catalog.json");
            if (res.exists()) {
                ObjectMapper mapper = new ObjectMapper();
                List<Map<String, Object>> rows = mapper.readValue(
                        res.getInputStream(), new TypeReference<>() {});
                seedCatalog(rows);
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
     * Insert the titles the catalogue knows and the database does not, then top
     * up the detail fields of the rows an earlier seed left incomplete.
     */
    private void seedCatalog(List<Map<String, Object>> rows) {
        Set<Integer> present = new HashSet<>();
        Set<String> usedSlugs = new HashSet<>();
        Map<Integer, Anime> existingByMalId = new HashMap<>();
        for (Anime existing : animeRepository.findAll()) {
            present.add(existing.getMalId());
            existingByMalId.put(existing.getMalId(), existing);
            if (existing.getSlug() != null && !existing.getSlug().isBlank()) {
                usedSlugs.add(existing.getSlug());
            }
        }

        StudioIndex studios = new StudioIndex(studioRepository.findAll());
        List<Anime> catalog = new ArrayList<>();
        List<Anime> toppedUp = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            if (!(r.get("malId") instanceof Number n)) continue;
            int rowMalId = n.intValue();
            Anime anime = existingByMalId.get(rowMalId);
            if (anime == null) {
                if (present.contains(rowMalId)) continue;
                anime = new Anime();
                anime.setMalId(rowMalId);
                anime.setTitle((String) r.get("title"));
                anime.setSlug(uniqueSlug(anime.getTitle(), rowMalId, usedSlugs));
                Object syn = r.get("synonyms");
                if (syn instanceof List<?> l && !l.isEmpty()) {
                    anime.setTitleSynonyms(String.join("|", l.stream().map(String::valueOf).toList()));
                }
                if (r.get("score") instanceof Number s) anime.setScore(s.doubleValue());
                if (r.get("episodes") instanceof Number e) anime.setEpisodes(e.intValue());
                anime.setType((String) r.get("type"));
                anime.setStatus(AnimeStatus.normalize((String) r.get("status")));
                if (r.get("year") instanceof Number y) anime.setYear(y.intValue());
                anime.setSeason((String) r.get("season"));
                anime.setImageUrl((String) r.get("imageUrl"));
                applyDetailFields(anime, r, studios);
                catalog.add(anime);
                present.add(rowMalId);
            } else if (applyDetailFields(anime, r, studios)) {
                toppedUp.add(anime);
            }
        }

        if (!catalog.isEmpty()) {
            animeRepository.saveAll(catalog);
            System.out.println("Seeded offline catalog: " + catalog.size() + " anime.");
        }
        if (!toppedUp.isEmpty()) {
            animeRepository.saveAll(toppedUp);
            System.out.println("Offline catalog: filled missing detail fields on "
                    + toppedUp.size() + " existing anime.");
        }
    }

    /**
     * Copy the detail fields the catalogue ships onto a row, but only where the
     * row is still empty: an imported record always wins over the seed file.
     *
     * <p>"Empty" includes MyAnimeList's stand-in text. An earlier run of the
     * enricher stored values like a studio named "None found" or MAL's "No
     * synopsis information" boilerplate; because such text is not blank, a
     * naive top-up would keep it forever. Here it is treated as a gap, so the
     * catalogue value replaces it - and when the catalogue has nothing either,
     * the junk is cleared rather than left on the row.
     */
    private boolean applyDetailFields(Anime anime, Map<String, Object> row, StudioIndex studios) {
        boolean changed = false;

        changed |= applyText(anime.getSynopsis(), text(row, "synopsis"), anime::setSynopsis);
        changed |= applyText(anime.getDuration(), text(row, "duration"), anime::setDuration);
        changed |= applyText(anime.getSource(), text(row, "source"), anime::setSource);
        changed |= applyText(anime.getAired(), text(row, "aired"), anime::setAired);
        changed |= applyText(anime.getRating(), text(row, "rating"), anime::setRating);

        if (anime.getMembers() == null && row.get("members") instanceof Number n) {
            anime.setMembers(n.intValue());
            changed = true;
        }
        if (anime.getPopularity() == null && row.get("popularity") instanceof Number n) {
            anime.setPopularity(n.intValue());
            changed = true;
        }
        if (anime.getFavorites() == null && row.get("favorites") instanceof Number n) {
            anime.setFavorites(n.intValue());
            changed = true;
        }
        if (anime.getRank() == null && row.get("rank") instanceof Number n) {
            anime.setRank(n.intValue());
            changed = true;
        }

        List<AnimeStudio> existing = anime.getAnimeStudios() == null
            ? List.of() : new ArrayList<>(anime.getAnimeStudios());
        List<AnimeStudio> kept = new ArrayList<>();
        for (AnimeStudio studio : existing) {
            if (studio != null && !MalPlaceholders.isStudioPlaceholder(studio.getName())) {
                kept.add(studio);
            }
        }
        if (kept.size() != existing.size()) {
            // Dropping a studio only removes the join row; the shared studio
            // entity stays for the other anime that reference it.
            List<AnimeStudio> current = anime.getAnimeStudios();
            if (current != null) {
                current.clear();
                current.addAll(kept);
            }
            changed = true;
        }
        if (kept.isEmpty()) {
            List<AnimeStudio> resolved = resolveStudios(row.get("studios"), studios);
            if (!resolved.isEmpty()) {
                if (anime.getAnimeStudios() == null) anime.setAnimeStudios(new ArrayList<>());
                anime.getAnimeStudios().addAll(resolved);
                changed = true;
            }
        }
        return changed;
    }

    /** MAL stand-in text counts as missing, not as a stored value. */
    private static String safe(String value) {
        return MalPlaceholders.isPlaceholder(value)
            || (value != null && MalPlaceholders.isSynopsisPlaceholder(value))
            ? null : value;
    }

    /** A catalogue text field, or null when it is absent or stand-in text. */
    private static String text(Map<String, Object> row, String key) {
        return row.get(key) instanceof String s ? s : null;
    }

    /**
     * Point the setter at the catalogue value when the stored one is unusable,
     * or clear it when the catalogue has nothing better. A usable stored value
     * is never touched, so imported data always wins.
     */
    private static boolean applyText(String stored, String catalogue,
                                     java.util.function.Consumer<String> setter) {
        String usable = safe(stored);
        if (usable != null) return false;         // a real value is never touched
        String desired = safe(catalogue);
        if (desired == null) {
            if (stored == null) return false;     // already clear, nothing to do
            setter.accept(null);                  // drop the junk placeholder
            return true;
        }
        setter.accept(desired);
        return true;
    }

    /**
     * The catalogue stores studios as objects with their MAL id, but tolerates
     * a plain list of names from older catalog files.
     */
    private List<AnimeStudio> resolveStudios(Object raw, StudioIndex studios) {
        if (!(raw instanceof List<?> list)) return List.of();
        List<AnimeStudio> result = new ArrayList<>();
        for (Object item : list) {
            String name = null;
            Integer malId = null;
            if (item instanceof Map<?, ?> map) {
                if (map.get("name") instanceof String s) name = s;
                if (map.get("malId") instanceof Number n) malId = n.intValue();
            } else if (item instanceof String s) {
                name = s;
            }
            if (name == null || name.isBlank()) continue;
            result.add(studios.resolve(name.trim(), malId));
        }
        return result;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
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

    /**
     * Studios are shared rows, so a batch must not create the same studio once
     * per anime. Reuse what the database has and hand out stable synthetic ids
     * (negative, so they can never clash with a real MAL id) for new names.
     */
    private static final class StudioIndex {

        private final Map<String, AnimeStudio> byName = new HashMap<>();
        private final Set<Integer> usedIds = new HashSet<>();

        private StudioIndex(List<AnimeStudio> existing) {
            for (AnimeStudio studio : existing) {
                byName.put(key(studio.getName()), studio);
                if (studio.getMalId() != null) usedIds.add(studio.getMalId());
            }
        }

        private AnimeStudio resolve(String name, Integer malId) {
            AnimeStudio known = byName.get(key(name));
            if (known != null) return known;

            int id = malId != null && !usedIds.contains(malId) ? malId : syntheticId(name);
            while (!usedIds.add(id)) id--;
            AnimeStudio studio = new AnimeStudio(java.util.UUID.randomUUID(), id, name);
            byName.put(key(name), studio);
            return studio;
        }

        /** Same shape as AnimeMetadataEnricher.pseudoMalId, but overflow-safe. */
        private static int syntheticId(String name) {
            int hash = key(name).hashCode();
            return hash == Integer.MIN_VALUE ? -1 : -Math.abs(hash) - 1;
        }

        private static String key(String name) {
            return name == null ? "" : name.toLowerCase(Locale.ROOT);
        }
    }
}
