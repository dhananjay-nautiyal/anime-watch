package com.animeSite.service.impl;

import com.animeSite.core.cache.CacheEvictions;
import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeGenre;
import com.animeSite.persist.AnimeStudio;
import com.animeSite.repo.AnimeGenreRepository;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.AnimeStudioRepository;
import com.animeSite.util.MalPlaceholders;
import org.jsoup.parser.Parser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fills the anime detail fields the offline catalog does not ship (synopsis,
 * duration, aired dates, source, studios, genres, rank, popularity, members,
 * favourites).
 *
 * <p>Jikan's API is not reachable from every network, but the MyAnimeList site
 * itself usually is, and the detail page carries exactly the values the UI
 * shows. Enrichment happens lazily on first detail view and is persisted, so a
 * given anime is fetched at most once per retry window instead of on every view.
 */
@Service
public class AnimeMetadataEnricher {

    private static final Logger log = LoggerFactory.getLogger(AnimeMetadataEnricher.class);

    private static final String MAL_URL = "https://myanimelist.net/anime/%d";
    private static final Pattern GENRE_LINK =
        Pattern.compile("<a href=\"/anime/genre/[^\"]*\"[^>]*>([^<]+)</a>");
    private static final Pattern FIRST_NUMBER = Pattern.compile("([\\d,.]+)");
    private static final Pattern SYNOPSIS =
        Pattern.compile("<p[^>]*itemprop=\"description\"[^>]*>(.*?)</p>", Pattern.DOTALL);
    private static final Pattern BR_TAG = Pattern.compile("(?i)<br\\s*/?>");

    /**
     * A failed fetch (offline network, MAL outage) used to be remembered for the
     * lifetime of the JVM, which left the row incomplete forever. Retry after
     * this gap instead, so a transient failure heals on a later visit without
     * hitting MAL on every single detail view.
     */
    private static final long RETRY_AFTER_MS = Duration.ofMinutes(10).toMillis();

    private final RestTemplate restTemplate;
    private final AnimeRepository animeRepository;
    private final AnimeGenreRepository genreRepository;
    private final AnimeStudioRepository studioRepository;
    private final CacheManager cacheManager;

    private final Map<Integer, Long> lastAttempt = new ConcurrentHashMap<>();

    public AnimeMetadataEnricher(@Qualifier("jikanRestTemplate") RestTemplate restTemplate,
                                 AnimeRepository animeRepository,
                                 AnimeGenreRepository genreRepository,
                                 AnimeStudioRepository studioRepository,
                                 CacheManager cacheManager) {
        this.restTemplate = restTemplate;
        this.animeRepository = animeRepository;
        this.genreRepository = genreRepository;
        this.studioRepository = studioRepository;
        this.cacheManager = cacheManager;
    }

    public boolean needsEnrichment(Anime anime) {
        return anime != null
            && anime.getMalId() != null
            && (needsText(anime.getSynopsis())
                || needsText(anime.getDuration())
                || needsText(anime.getAired())
                || needsText(anime.getSource())
                || anime.getMembers() == null
                || anime.getPopularity() == null
                || anime.getFavorites() == null
                || hasNoStudios(anime)
                // The catalogue ships no genres; without this the detail view
                // would stop being the one place that backfills them.
                || anime.getAnimeGenres() == null
                || anime.getAnimeGenres().isEmpty());
    }

    /** Blank, or MyAnimeList stand-in text that got stored as a value. */
    private static boolean needsText(String value) {
        return MalPlaceholders.isPlaceholder(value)
            || MalPlaceholders.isSynopsisPlaceholder(value);
    }

    /** True when the row has no usable studio, ignoring stored junk. */
    private static boolean hasNoStudios(Anime anime) {
        if (anime.getAnimeStudios() == null || anime.getAnimeStudios().isEmpty()) return true;
        for (AnimeStudio studio : anime.getAnimeStudios()) {
            if (studio != null && !MalPlaceholders.isStudioPlaceholder(studio.getName())) {
                return false;
            }
        }
        return true;
    }

    /**
     * Load the row and enrich it inside a single transaction. Detail views
     * trigger this from the background pool: the row must be loaded inside
     * the very session that resolves its studios and genres, because a row
     * detached from an earlier (closed) session cannot initialize those lazy
     * collections here - {@code enrich} would fail with a
     * LazyInitializationException on every run.
     */
    @Transactional
    public void enrichById(int malId) {
        animeRepository.findByMalId(malId).ifPresent(this::enrich);
    }

    /**
     * Fetch MAL metadata for the anime and persist whatever is still missing.
     * Safe to call repeatedly: a no-op once the record is complete, and a
     * failed attempt is retried only after {@link #RETRY_AFTER_MS}.
     * Callers outside this class must run inside a transaction (see
     * {@link #enrichById(int)}) so lazy relations resolve in one session.
     */
    @Transactional
    public void enrich(Anime anime) {
        if (anime == null || anime.getMalId() == null) return;
        long now = System.currentTimeMillis();
        // Claim the attempt atomically: detail views enqueue this on a
        // background pool, so two concurrent views of the same title must not
        // both pay for a fetch. merge() keeps the previous stamp when the
        // retry window has not passed, so only the winning caller proceeds.
        Long claimed = lastAttempt.merge(anime.getMalId(), now,
                (previous, ignored) -> now - previous < RETRY_AFTER_MS ? previous : now);
        if (claimed == null || claimed.longValue() != now) return;

        try {
            String html = fetch(anime.getMalId());
            if (html == null || html.isBlank()) return;

            boolean changed = false;

            String type = infoValue(html, "Type");
            if (needsText(anime.getType()) && type != null) { anime.setType(type); changed = true; }

            String episodes = infoValue(html, "Episodes");
            if (anime.getEpisodes() == null && episodes != null) {
                Integer parsed = firstInt(episodes);
                if (parsed != null) { anime.setEpisodes(parsed); changed = true; }
            }

            String status = infoValue(html, "Status");
            if (status != null) {
                String canonical = canonicalStatus(status);
                if (canonical != null && !canonical.equals(anime.getStatus())) {
                    anime.setStatus(canonical);
                    changed = true;
                }
            }

            String aired = infoValue(html, "Aired");
            if (needsText(anime.getAired()) && aired != null) { anime.setAired(aired); changed = true; }

            String duration = infoValue(html, "Duration");
            if (needsText(anime.getDuration()) && duration != null) { anime.setDuration(duration); changed = true; }

            String source = infoValue(html, "Source");
            if (needsText(anime.getSource()) && source != null) { anime.setSource(source); changed = true; }

            String rating = infoValue(html, "Rating");
            if (needsText(anime.getRating()) && rating != null) { anime.setRating(rating); changed = true; }

            String premiered = infoValue(html, "Premiered");
            if (premiered != null) {
                String[] parts = premiered.split("\\s+");
                if (parts.length == 2) {
                    if (isBlank(anime.getSeason())) { anime.setSeason(parts[0].toLowerCase()); changed = true; }
                    if (anime.getYear() == null) {
                        Integer year = firstInt(parts[1]);
                        if (year != null) { anime.setYear(year); changed = true; }
                    }
                }
            }

            // Sidebar stats: rank / popularity are MAL ranks, members and
            // favourites are absolute counts.
            Integer rank = firstInt(infoValue(html, "Ranked"));
            if (anime.getRank() == null && rank != null) { anime.setRank(rank); changed = true; }

            Integer popularity = firstInt(infoValue(html, "Popularity"));
            if (anime.getPopularity() == null && popularity != null) { anime.setPopularity(popularity); changed = true; }

            Integer members = firstInt(infoValue(html, "Members"));
            if (anime.getMembers() == null && members != null) { anime.setMembers(members); changed = true; }

            Integer favorites = firstInt(infoValue(html, "Favorites"));
            if (anime.getFavorites() == null && favorites != null) { anime.setFavorites(favorites); changed = true; }

            Double score = firstDouble(infoValue(html, "Score"));
            if (anime.getScore() == null && score != null) { anime.setScore(score); changed = true; }

            if (needsText(anime.getSynopsis())) {
                String syn = synopsis(html);
                if (syn != null) { anime.setSynopsis(syn); changed = true; }
            }

            if (hasNoStudios(anime)) {
                // Drop any stored junk ("None found" / "add some" left behind
                // by an older run) before attaching the real studios. Collect
                // first: mutating a lazy Hibernate bag while iterating it can
                // throw. Removing a studio only drops the join row.
                if (anime.getAnimeStudios() != null && !anime.getAnimeStudios().isEmpty()) {
                    List<AnimeStudio> junk = new ArrayList<>();
                    for (AnimeStudio studio : anime.getAnimeStudios()) {
                        if (studio == null || MalPlaceholders.isStudioPlaceholder(studio.getName())) {
                            junk.add(studio);
                        }
                    }
                    anime.getAnimeStudios().removeAll(junk);
                }
                for (String name : splitNames(infoValue(html, "Studios"))) {
                    anime.getAnimeStudios().add(resolveStudio(name));
                    changed = true;
                }
            }

            if (anime.getAnimeGenres() == null || anime.getAnimeGenres().isEmpty()) {
                for (String name : genres(html)) {
                    anime.getAnimeGenres().add(resolveGenre(name));
                    changed = true;
                }
            }

            if (changed) {
                animeRepository.save(anime);
                // This write bypasses @Cacheable: a detail entry cached before
                // the fetch (the sibling key of the request that triggered this
                // enrichment, or one put by a concurrent read) would otherwise
                // serve the old row for up to an hour. Evicting after the
                // transaction commits keeps an in-flight read from re-caching
                // the pre-save row; the enclosing @Cacheable put for the key
                // that triggered this call happens afterwards and stays fresh.
                CacheEvictions.evictKeysAfterCommit(cacheManager, "anime", detailKeys(anime));
                log.info("[ENRICH] SAVED | malId={} title='{}' aired='{}' duration='{}' studios={} genres={} members={} favorites={}",
                    anime.getMalId(), anime.getTitle(), anime.getAired(), anime.getDuration(),
                    anime.getAnimeStudios() != null ? anime.getAnimeStudios().size() : 0,
                    anime.getAnimeGenres() != null ? anime.getAnimeGenres().size() : 0,
                    anime.getMembers(), anime.getFavorites());
            }
        } catch (Exception e) {
            log.warn("[ENRICH] FAILED | malId={} error='{}'", anime.getMalId(), e.getMessage());
        }
    }

    /**
     * The keys {@code @Cacheable} puts in {@code AnimeServiceImpl} for this
     * anime: the id-based detail entry and the slug-based one. Both must go,
     * since the request that triggered this enrichment only refreshes one of
     * them.
     */
    private static String[] detailKeys(Anime anime) {
        List<String> keys = new ArrayList<>();
        if (anime.getMalId() != null) keys.add("id-" + anime.getMalId());
        if (anime.getSlug() != null && !anime.getSlug().isBlank()) keys.add("slug-" + anime.getSlug());
        return keys.toArray(new String[0]);
    }

    private String fetch(int malId) {
        try {
            return restTemplate.getForObject(String.format(MAL_URL, malId), String.class);
        } catch (Exception e) {
            log.debug("[ENRICH] FETCH_FAILED | malId={} error='{}'", malId, e.getMessage());
            return null;
        }
    }

    private static String infoValue(String html, String label) {
        Pattern pattern = Pattern.compile(
            "<span class=\"dark_text\">" + Pattern.quote(label) + ":</span>(.*?)</div>",
            Pattern.DOTALL);
        Matcher matcher = pattern.matcher(html);
        if (!matcher.find()) return null;

        String text = matcher.group(1)
            .replaceAll("<[^>]+>", " ")
            .replace("&amp;", "&")
            .replace("&nbsp;", " ")
            .replaceAll("\\s+", " ")
            .trim();

        // MAL renders "None found, add some" (studios), "None" (rating) and
        // friends in place of a value; storing those would put literal junk on
        // the row that no later pass can correct, since both the seeder and
        // this enricher skip fields that already have a value.
        if (MalPlaceholders.isPlaceholder(text)) return null;
        // Strip the rank footnote ("#2065 2 based on the top anime page...").
        if (label.equals("Ranked") || label.equals("Popularity")) {
            Matcher number = Pattern.compile("#?([\\d,]+)").matcher(text);
            if (number.find()) return number.group(1);
            return null;
        }
        if (label.equals("Score")) {
            Matcher number = FIRST_NUMBER.matcher(text);
            if (number.find()) return number.group(1);
            return null;
        }
        return text;
    }

    /**
     * The synopsis is the description paragraph under the "Synopsis" heading,
     * not one of the sidebar rows {@link #infoValue} reads.
     */
    private static String synopsis(String html) {
        Matcher matcher = SYNOPSIS.matcher(html);
        if (!matcher.find()) return null;

        String fragment = BR_TAG.matcher(matcher.group(1)).replaceAll("\n");
        String text = Parser.unescapeEntities(fragment.replaceAll("<[^>]+>", ""), false)
            .replace('\u00a0', ' ');

        List<String> lines = new ArrayList<>();
        for (String line : text.split("\n", -1)) {
            lines.add(line.replaceAll("[ \\t]+", " ").trim());
        }
        String cleaned = String.join("\n", lines).replaceAll("\n{3,}", "\n\n").trim();
        // Pages with no description carry MAL's own "No synopsis information
        // has been added..." paragraph; that is not a synopsis.
        if (cleaned.isEmpty() || MalPlaceholders.isSynopsisPlaceholder(cleaned)) return null;
        return cleaned;
    }

    private static List<String> genres(String html) {
        int start = html.indexOf("<span class=\"dark_text\">Genres:</span>");
        if (start < 0) return List.of();
        int end = html.indexOf("</div>", start);
        if (end < 0) end = Math.min(html.length(), start + 2000);

        List<String> names = new ArrayList<>();
        Matcher matcher = GENRE_LINK.matcher(html.substring(start, end));
        while (matcher.find()) {
            String name = matcher.group(1).trim();
            if (!name.isEmpty() && !names.contains(name)) names.add(name);
        }
        return names;
    }

    private static List<String> splitNames(String value) {
        if (value == null) return List.of();
        List<String> names = new ArrayList<>();
        for (String part : value.split(",")) {
            String name = part.trim();
            if (!name.isEmpty() && !names.contains(name)) names.add(name);
        }
        return names;
    }

    private AnimeStudio resolveStudio(String name) {
        return studioRepository.findByNameIgnoreCase(name)
            .orElseGet(() -> studioRepository.save(
                new AnimeStudio(UUID.randomUUID(), pseudoMalId(name), name)));
    }

    private AnimeGenre resolveGenre(String name) {
        return genreRepository.findByNameIgnoreCase(name)
            .orElseGet(() -> genreRepository.save(
                new AnimeGenre(UUID.randomUUID(), pseudoMalId(name), name, "anime")));
    }

    /** Deterministic negative id for entities MAL did not give us an id for. */
    private static int pseudoMalId(String name) {
        return -Math.abs(name.toLowerCase().hashCode()) - 1;
    }

    private static Integer firstInt(String value) {
        if (value == null) return null;
        Matcher matcher = Pattern.compile("([\\d,]+)").matcher(value);
        if (!matcher.find()) return null;
        try {
            return Integer.parseInt(matcher.group(1).replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Double firstDouble(String value) {
        if (value == null) return null;
        Matcher matcher = Pattern.compile("(\\d+(?:\\.\\d+)?)").matcher(value);
        if (!matcher.find()) return null;
        try {
            return Double.parseDouble(matcher.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String canonicalStatus(String malStatus) {
        String lower = malStatus.toLowerCase();
        if (lower.contains("finished")) return "finished";
        if (lower.contains("currently airing") || lower.equals("airing")) return "airing";
        if (lower.contains("not yet aired") || lower.contains("upcoming")) return "upcoming";
        if (lower.contains("hiatus")) return "hiatus";
        if (lower.contains("cancelled") || lower.contains("canceled")) return "cancelled";
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
