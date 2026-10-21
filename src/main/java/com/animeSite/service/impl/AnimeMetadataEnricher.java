package com.animeSite.service.impl;

import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeGenre;
import com.animeSite.persist.AnimeStudio;
import com.animeSite.repo.AnimeGenreRepository;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.AnimeStudioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fills the anime detail fields the offline catalog does not ship (duration,
 * aired dates, source, studios, genres, rank, popularity, members, favourites).
 *
 * <p>Jikan's API is not reachable from every network, but the MyAnimeList site
 * itself usually is, and the detail page carries exactly the values the UI
 * shows. Enrichment happens lazily on first detail view and is persisted, so a
 * given anime is fetched at most once per JVM.
 */
@Service
public class AnimeMetadataEnricher {

    private static final Logger log = LoggerFactory.getLogger(AnimeMetadataEnricher.class);

    private static final String MAL_URL = "https://myanimelist.net/anime/%d";
    private static final Pattern GENRE_LINK =
        Pattern.compile("<a href=\"/anime/genre/[^\"]*\"[^>]*>([^<]+)</a>");
    private static final Pattern FIRST_NUMBER = Pattern.compile("([\\d,.]+)");

    private final RestTemplate restTemplate;
    private final AnimeRepository animeRepository;
    private final AnimeGenreRepository genreRepository;
    private final AnimeStudioRepository studioRepository;

    private final Set<Integer> attempted = ConcurrentHashMap.newKeySet();

    public AnimeMetadataEnricher(@Qualifier("jikanRestTemplate") RestTemplate restTemplate,
                                 AnimeRepository animeRepository,
                                 AnimeGenreRepository genreRepository,
                                 AnimeStudioRepository studioRepository) {
        this.restTemplate = restTemplate;
        this.animeRepository = animeRepository;
        this.genreRepository = genreRepository;
        this.studioRepository = studioRepository;
    }

    public boolean needsEnrichment(Anime anime) {
        return anime != null
            && anime.getMalId() != null
            && (isBlank(anime.getDuration())
                || isBlank(anime.getAired())
                || isBlank(anime.getSource())
                || anime.getAnimeStudios() == null
                || anime.getAnimeStudios().isEmpty());
    }

    /**
     * Fetch MAL metadata for the anime and persist whatever is still missing.
     * Safe to call repeatedly: a no-op once the record is complete or after a
     * failed attempt.
     */
    @Transactional
    public void enrich(Anime anime) {
        if (anime == null || anime.getMalId() == null) return;
        if (!attempted.add(anime.getMalId())) return;

        try {
            String html = fetch(anime.getMalId());
            if (html == null || html.isBlank()) return;

            boolean changed = false;

            String type = infoValue(html, "Type");
            if (isBlank(anime.getType()) && type != null) { anime.setType(type); changed = true; }

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
            if (isBlank(anime.getAired()) && aired != null) { anime.setAired(aired); changed = true; }

            String duration = infoValue(html, "Duration");
            if (isBlank(anime.getDuration()) && duration != null) { anime.setDuration(duration); changed = true; }

            String source = infoValue(html, "Source");
            if (isBlank(anime.getSource()) && source != null) { anime.setSource(source); changed = true; }

            String rating = infoValue(html, "Rating");
            if (isBlank(anime.getRating()) && rating != null) { anime.setRating(rating); changed = true; }

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

            if (anime.getAnimeStudios() == null || anime.getAnimeStudios().isEmpty()) {
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

        if (text.isEmpty()) return null;
        String lower = text.toLowerCase();
        if (lower.startsWith("none found") || lower.equals("unknown")) return null;
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
