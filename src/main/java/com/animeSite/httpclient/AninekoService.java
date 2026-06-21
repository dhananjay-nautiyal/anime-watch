package com.animeSite.httpclient;

import com.animeSite.persist.Episode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AninekoService {

    private static final Logger log = LoggerFactory.getLogger(AninekoService.class);
    private static final String BASE_URL = "https://anineko.to";

    private static final String JIKAN_BASE = "https://api.jikan.moe/v4";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public AninekoService(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public String buildSlug(String title) {
        String slug = title.toLowerCase()
                .replaceAll("[^a-z0-9 .-]", "")
                .trim()
                .replaceAll("[. ]+", "-");
        slug = slug.replaceAll("-+", "-");
        slug = slug.replaceAll("^-|-$", "");
        return slug;
    }

    public List<String> buildSlugs(String title) {
        Set<String> slugs = new LinkedHashSet<>();

        String primary = buildSlug(title);
        slugs.add(primary);

        String hyphenated = title.replaceAll("[^a-zA-Z0-9 -]", "").toLowerCase().trim().replaceAll("\\s+", "-");
        hyphenated = hyphenated.replaceAll("-+", "-").replaceAll("^-|-$", "");
        if (!hyphenated.equals(primary)) slugs.add(hyphenated);

        for (String sep : new String[]{":", ";", " - "}) {
            int idx = title.indexOf(sep);
            if (idx > 0) {
                String before = buildSlug(title.substring(0, idx).trim());
                slugs.add(before);
                String after = title.substring(idx + sep.length()).trim();
                int spaceIdx = after.indexOf(' ');
                String firstWord = spaceIdx > 0 ? after.substring(0, spaceIdx) : after;
                slugs.add(before + "-" + buildSlug(firstWord));
            }
        }

        for (String sep : new String[]{":", ";", " - "}) {
            int idx = title.indexOf(sep);
            if (idx > 0) {
                String before = title.substring(0, idx).trim();
                String after = title.substring(idx + sep.length()).trim();
                String combined = buildSlug(before + " " + after);
                if (!combined.equals(primary) && !combined.equals(hyphenated)) slugs.add(combined);
            }
        }

        return new ArrayList<>(slugs);
    }

    public List<Episode> fetchEpisodes(int malId, String title) {
        long start = System.currentTimeMillis();
        log.info("[ANINEKO] FETCH EPISODES | title='{}' malId={}", title, malId);

        List<String> slugs = buildSlugs(title);
        log.info("[ANINEKO] SLUGS | '{}' → {}", title, slugs);

        for (String slug : slugs) {
            String url = BASE_URL + "/watch/" + slug;
            log.info("[ANINEKO] TRY SLUG | slug='{}' url={}", slug, url);

            try {
                String html = restTemplate.getForObject(url, String.class);
                if (html == null) continue;

                List<Episode> episodes = new ArrayList<>();
                Set<Integer> seen = new LinkedHashSet<>();

                Pattern epPattern = Pattern.compile("/watch/" + Pattern.quote(slug) + "/ep-(\\d+)");
                Matcher matcher = epPattern.matcher(html);
                while (matcher.find()) {
                    int epNum = Integer.parseInt(matcher.group(1));
                    if (seen.add(epNum)) {
                        Episode ep = new Episode();
                        ep.setAnimeMalId(malId);
                        ep.setEpisodeNumber(epNum);
                        ep.setTitle("Episode " + epNum);
                        ep.setEmbedUrl(BASE_URL + "/watch/" + slug + "/ep-" + epNum);
                        episodes.add(ep);
                    }
                }

                if (!episodes.isEmpty()) {
                    episodes.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                    long elapsed = System.currentTimeMillis() - start;
                    log.info("[ANINEKO] SUCCESS | slug='{}' count={} duration={}ms", slug, episodes.size(), elapsed);
                    return episodes;
                }

                log.warn("[ANINEKO] EMPTY | slug='{}' matched no episodes", slug);
            } catch (Exception e) {
                log.warn("[ANINEKO] FAILED | slug='{}' error='{}'", slug, e.getMessage());
            }
        }

        log.warn("[ANINEKO] ALL SLUGS FAILED | trying search-based slug discovery...");

        String searchSlug = findSlugBySearch(title);
        if (searchSlug != null) {
            log.info("[ANINEKO] SEARCH FOUND SLUG | '{}' → '{}'", title, searchSlug);
            List<Episode> searchResult = fetchEpisodesFromList(malId, List.of(searchSlug));
            if (!searchResult.isEmpty()) {
                long elapsed = System.currentTimeMillis() - start;
                log.info("[ANINEKO] SEARCH SLUG SUCCESS | count={} duration={}ms", searchResult.size(), elapsed);
                return searchResult;
            }
        }

        log.warn("[ANINEKO] ALL SLUGS FAILED | trying Jikan API for English title...");

        List<Episode> jikanResult = tryJikanEnglishTitle(malId, title);
        if (!jikanResult.isEmpty()) {
            long elapsed = System.currentTimeMillis() - start;
            log.info("[ANINEKO] JIKAN FALLBACK SUCCESS | count={} duration={}ms", jikanResult.size(), elapsed);
            return jikanResult;
        }

        long elapsed = System.currentTimeMillis() - start;
        log.warn("[ANINEKO] ALL ATTEMPTS FAILED | duration={}ms", elapsed);
        return List.of();
    }

    private List<Episode> tryJikanEnglishTitle(int malId, String title) {
        try {
            Thread.sleep(500);
            String url = JIKAN_BASE + "/anime/" + malId;
            String json = restTemplate.getForObject(url, String.class);
            if (json == null) return List.of();

            JsonNode root = objectMapper.readTree(json);
            JsonNode data = root.get("data");
            if (data == null) return List.of();

            if (data.has("title_english") && !data.get("title_english").isNull()) {
                String englishTitle = data.get("title_english").asText("");
                if (!englishTitle.isEmpty()) {
                    log.info("[ANINEKO] JIKAN ENGLISH TITLE | '{}' → '{}'", title, englishTitle);
                    return fetchEpisodesFromList(malId, buildSlugs(englishTitle));
                }
            }

            JsonNode titles = data.get("titles");
            if (titles != null && titles.isArray()) {
                for (JsonNode t : titles) {
                    String type = t.has("type") ? t.get("type").asText("") : "";
                    if ("English".equals(type)) {
                        String enTitle = t.get("title").asText("");
                        if (!enTitle.isEmpty()) {
                            log.info("[ANINEKO] JIKAN ENGLISH TITLE (from titles) | '{}' → '{}'", title, enTitle);
                            return fetchEpisodesFromList(malId, buildSlugs(enTitle));
                        }
                    }
                }
            }

            return List.of();
        } catch (Exception e) {
            log.warn("[ANINEKO] JIKAN FALLBACK FAILED | error='{}'", e.getMessage());
            return List.of();
        }
    }

    private List<Episode> fetchEpisodesFromList(int malId, List<String> slugs) {
        for (String slug : slugs) {
            String url = BASE_URL + "/watch/" + slug;
            try {
                String html = restTemplate.getForObject(url, String.class);
                if (html == null) continue;

                List<Episode> episodes = new ArrayList<>();
                Set<Integer> seen = new LinkedHashSet<>();
                Pattern epPattern = Pattern.compile("/watch/" + Pattern.quote(slug) + "/ep-(\\d+)");
                Matcher matcher = epPattern.matcher(html);
                while (matcher.find()) {
                    int epNum = Integer.parseInt(matcher.group(1));
                    if (seen.add(epNum)) {
                        Episode ep = new Episode();
                        ep.setAnimeMalId(malId);
                        ep.setEpisodeNumber(epNum);
                        ep.setTitle("Episode " + epNum);
                        ep.setEmbedUrl(BASE_URL + "/watch/" + slug + "/ep-" + epNum);
                        episodes.add(ep);
                    }
                }
                if (!episodes.isEmpty()) {
                    episodes.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                    return episodes;
                }
            } catch (Exception e) {
                log.warn("[ANINEKO] FALLBACK SLUG FAILED | slug='{}'", slug);
            }
        }
        return List.of();
    }

    private String findSlugBySearch(String title) {
        try {
            String keywords = title.toLowerCase().replaceAll("[^a-z0-9 ]", " ").trim().replaceAll("\\s+", "+");
            String searchUrl = BASE_URL + "/browse?keyword=" + keywords + "&page=1";
            String html = restTemplate.getForObject(searchUrl, String.class);
            if (html == null) return null;

            Set<String> candidates = new LinkedHashSet<>();
            Pattern linkPattern = Pattern.compile("/watch/([a-z0-9-]+)");
            Matcher matcher = linkPattern.matcher(html);

            String titleLower = title.toLowerCase();
            String slugPrefix = buildSlug(titleLower);

            while (matcher.find()) {
                String slug = matcher.group(1);
                if (slug.startsWith(slugPrefix) && !slug.equals(slugPrefix)) {
                    candidates.add(slug);
                }
            }

            if (candidates.isEmpty()) {
                matcher.reset();
                while (matcher.find()) {
                    String slug = matcher.group(1);
                    if (slug.startsWith(slugPrefix)) {
                        candidates.add(slug);
                    }
                }
            }

            return candidates.isEmpty() ? null : candidates.iterator().next();
        } catch (Exception e) {
            log.warn("[ANINEKO] SEARCH FAILED | error='{}'", e.getMessage());
            return null;
        }
    }

    public String fetchEmbedUrl(String episodePageUrl) {
        long start = System.currentTimeMillis();
        log.info("[ANINEKO] FETCH EMBED | url={}", episodePageUrl);

        try {
            String html = restTemplate.getForObject(episodePageUrl, String.class);
            if (html == null) {
                log.error("[ANINEKO] EMBED FAILED | null response");
                return null;
            }

            Pattern pattern = Pattern.compile("data-video=\"([^\"]+)\"");
            Matcher matcher = pattern.matcher(html);
            List<String> embeds = new ArrayList<>();
            while (matcher.find()) {
                String videoUrl = matcher.group(1);
                if (!embeds.contains(videoUrl)) {
                    embeds.add(videoUrl);
                }
            }

            if (embeds.isEmpty()) {
                log.warn("[ANINEKO] EMBED FAILED | no data-video found");
                return null;
            }

            String embedUrl = embeds.get(0);
            long elapsed = System.currentTimeMillis() - start;
            log.info("[ANINEKO] EMBED SUCCESS | url={} duration={}ms", embedUrl, elapsed);
            return embedUrl;

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[ANINEKO] EMBED FAILED | error='{}' duration={}ms", e.getMessage(), elapsed);
            return null;
        }
    }
}
