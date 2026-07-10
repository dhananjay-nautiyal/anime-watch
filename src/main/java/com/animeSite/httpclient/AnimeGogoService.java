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
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;

@Service
public class AnimeGogoService {

    private static final Logger log = LoggerFactory.getLogger(AnimeGogoService.class);
    private static final String BASE_URL = "https://gogoanime.live";
    private static final String EPISODE_PATTERN_TEMPLATE = "/episode/%s-episode-(\\d+)";
    private static final String JIKAN_BASE = "https://api.jikan.moe/v4";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public AnimeGogoService(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate, ObjectMapper objectMapper) {
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

    private String fetchWithLogging(String url, String context) {
        long t = System.currentTimeMillis();
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(url, String.class);
            HttpStatusCode status = resp.getStatusCode();
            String body = resp.getBody();
            long elapsed = System.currentTimeMillis() - t;
            if (body != null) {
                log.info("[GOGO] {} | url={} status={} bodyLength={} preview='{}' duration={}ms",
                    context, url, status, body.length(),
                    body.substring(0, Math.min(300, body.length())).replace('\n', ' ').replace('\r', ' '),
                    elapsed);
            } else {
                log.warn("[GOGO] {} | url={} status={} body=null duration={}ms", context, url, status, elapsed);
            }
            return body;
        } catch (HttpClientErrorException e) {
            long elapsed = System.currentTimeMillis() - t;
            String respBody = e.getResponseBodyAsString();
            log.warn("[GOGO] {} FAILED | url={} status={} body='{}' duration={}ms",
                context, url, e.getStatusCode(),
                respBody != null ? respBody.substring(0, Math.min(200, respBody.length())).replace('\n', ' ').replace('\r', ' ') : "null",
                elapsed);
            return null;
        } catch (HttpServerErrorException e) {
            long elapsed = System.currentTimeMillis() - t;
            log.warn("[GOGO] {} FAILED | url={} status={} duration={}ms", context, url, e.getStatusCode(), elapsed);
            return null;
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - t;
            log.warn("[GOGO] {} FAILED | url={} error='{}' duration={}ms", context, url, e.getMessage(), elapsed);
            return null;
        }
    }

    public List<Episode> fetchEpisodes(int malId, String title) {
        long start = System.currentTimeMillis();
        log.info("[GOGO] FETCH EPISODES | title='{}' malId={}", title, malId);

        List<String> slugs = buildSlugs(title);
        log.info("[GOGO] SLUGS | '{}' → {}", title, slugs);

        for (String slug : slugs) {
            String url = BASE_URL + "/anime/" + slug;
            log.info("[GOGO] TRY SLUG | slug='{}' url={}", slug, url);

            String html = fetchWithLogging(url, "SLUG=" + slug);
            if (html == null) continue;

            List<Episode> episodes = new ArrayList<>();
            Set<Integer> seen = new LinkedHashSet<>();

            Pattern epPattern = Pattern.compile(String.format(EPISODE_PATTERN_TEMPLATE, Pattern.quote(slug)));
            Matcher matcher = epPattern.matcher(html);
            while (matcher.find()) {
                int epNum = Integer.parseInt(matcher.group(1));
                if (seen.add(epNum)) {
                    Episode ep = new Episode();
                    ep.setAnimeMalId(malId);
                    ep.setEpisodeNumber(epNum);
                    ep.setTitle("Episode " + epNum);
                    ep.setEmbedUrl(BASE_URL + "/episode/" + slug + "-episode-" + epNum);
                    episodes.add(ep);
                }
            }

            if (!episodes.isEmpty()) {
                episodes.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                long elapsed = System.currentTimeMillis() - start;
                log.info("[GOGO] SUCCESS | slug='{}' count={} duration={}ms", slug, episodes.size(), elapsed);
                return episodes;
            }

            long epMatchCount = Pattern.compile("/episode/[a-z0-9-]+-episode-\\d+").matcher(html).results().count();
            log.warn("[GOGO] EMPTY | slug='{}' matched no episodes (body had {} ep links)", slug, epMatchCount);
        }

        log.warn("[GOGO] ALL SLUGS FAILED | trying search-based slug discovery...");

        String searchSlug = findSlugBySearch(title);
        if (searchSlug != null) {
            log.info("[GOGO] SEARCH FOUND SLUG | '{}' → '{}'", title, searchSlug);
            List<Episode> searchResult = fetchEpisodesFromList(malId, List.of(searchSlug));
            if (!searchResult.isEmpty()) {
                long elapsed = System.currentTimeMillis() - start;
                log.info("[GOGO] SEARCH SLUG SUCCESS | count={} duration={}ms", searchResult.size(), elapsed);
                return searchResult;
            }
        }

        log.warn("[GOGO] ALL SLUGS FAILED | trying Jikan API for English title...");

        List<Episode> jikanResult = tryJikanEnglishTitle(malId, title);
        if (!jikanResult.isEmpty()) {
            long elapsed = System.currentTimeMillis() - start;
            log.info("[GOGO] JIKAN FALLBACK SUCCESS | count={} duration={}ms", jikanResult.size(), elapsed);
            return jikanResult;
        }

        long elapsed = System.currentTimeMillis() - start;
        log.warn("[GOGO] ALL ATTEMPTS FAILED | duration={}ms", elapsed);
        return List.of();
    }

    private List<Episode> tryJikanEnglishTitle(int malId, String title) {
        try {
            Thread.sleep(500);
            String url = JIKAN_BASE + "/anime/" + malId;
            String json = fetchWithLogging(url, "JIKAN_FALLBACK");
            if (json == null) return List.of();

            JsonNode root = objectMapper.readTree(json);
            JsonNode data = root.get("data");
            if (data == null) return List.of();

            if (data.has("title_english") && !data.get("title_english").isNull()) {
                String englishTitle = data.get("title_english").asText("");
                if (!englishTitle.isEmpty()) {
                    log.info("[GOGO] JIKAN ENGLISH TITLE | '{}' → '{}'", title, englishTitle);
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
                            log.info("[GOGO] JIKAN ENGLISH TITLE (from titles) | '{}' → '{}'", title, enTitle);
                            return fetchEpisodesFromList(malId, buildSlugs(enTitle));
                        }
                    }
                }
            }

            return List.of();
        } catch (Exception e) {
            log.warn("[GOGO] JIKAN FALLBACK FAILED | error='{}'", e.getMessage());
            return List.of();
        }
    }

    private List<Episode> fetchEpisodesFromList(int malId, List<String> slugs) {
        for (String slug : slugs) {
            String url = BASE_URL + "/anime/" + slug;
            String html = fetchWithLogging(url, "FALLBACK_SLUG=" + slug);
            if (html == null) continue;

            List<Episode> episodes = new ArrayList<>();
            Set<Integer> seen = new LinkedHashSet<>();
            Pattern epPattern = Pattern.compile(String.format(EPISODE_PATTERN_TEMPLATE, Pattern.quote(slug)));
            Matcher matcher = epPattern.matcher(html);
            while (matcher.find()) {
                int epNum = Integer.parseInt(matcher.group(1));
                if (seen.add(epNum)) {
                    Episode ep = new Episode();
                    ep.setAnimeMalId(malId);
                    ep.setEpisodeNumber(epNum);
                    ep.setTitle("Episode " + epNum);
                    ep.setEmbedUrl(BASE_URL + "/episode/" + slug + "-episode-" + epNum);
                    episodes.add(ep);
                }
            }
            if (!episodes.isEmpty()) {
                episodes.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                return episodes;
            }
        }
        return List.of();
    }

    private String findSlugBySearch(String title) {
        try {
            String keywords = title.toLowerCase().replaceAll("[^a-z0-9 ]", " ").trim().replaceAll("\\s+", "+");
            String searchUrl = BASE_URL + "/search?keyword=" + keywords + "&page=1";
            log.info("[GOGO] SEARCH | url={}", searchUrl);
            String html = fetchWithLogging(searchUrl, "SEARCH");
            if (html == null) return null;

            Set<String> candidates = new LinkedHashSet<>();
            Pattern linkPattern = Pattern.compile("/anime/([a-z0-9-]+)");
            Matcher matcher = linkPattern.matcher(html);

            String titleLower = title.toLowerCase();
            String slugPrefix = buildSlug(titleLower);

            while (matcher.find()) {
                String slug = matcher.group(1);
                if (slug.startsWith(slugPrefix) && !slug.equals(slugPrefix) && !slug.endsWith("-dub")) {
                    candidates.add(slug);
                }
            }

            if (candidates.isEmpty()) {
                matcher.reset();
                while (matcher.find()) {
                    String slug = matcher.group(1);
                    if (slug.startsWith(slugPrefix) && !slug.endsWith("-dub")) {
                        candidates.add(slug);
                    }
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

            log.info("[GOGO] SEARCH RESULT | candidates={}", candidates);
            return candidates.isEmpty() ? null : candidates.iterator().next();
        } catch (Exception e) {
            log.warn("[GOGO] SEARCH FAILED | error='{}'", e.getMessage());
            return null;
        }
    }

    public String fetchEmbedUrl(String episodePageUrl) {
        long start = System.currentTimeMillis();
        log.info("[GOGO] FETCH EMBED | url={}", episodePageUrl);

        try {
            String html = fetchWithLogging(episodePageUrl, "EMBED");
            if (html == null) {
                log.error("[GOGO] EMBED FAILED | null response after fetch");
                return null;
            }

            Pattern pattern = Pattern.compile("data-video=\"([^\"]+)\"");
            Matcher matcher = pattern.matcher(html);
            List<String> embeds = new ArrayList<>();
            while (matcher.find()) {
                String encoded = matcher.group(1);
                if (!embeds.contains(encoded)) {
                    embeds.add(encoded);
                }
            }

            if (embeds.isEmpty()) {
                log.warn("[GOGO] EMBED FAILED | no data-video found");
                return null;
            }

            String firstEncoded = embeds.get(0);
            String decodedUrl;
            try {
                decodedUrl = new String(Base64.getDecoder().decode(firstEncoded));
            } catch (Exception e) {
                log.warn("[GOGO] EMBED FAILED | base64 decode error: {}", e.getMessage());
                return null;
            }

            log.info("[GOGO] DECODED PLAYER URL | url={}", decodedUrl);

            String megaplayUrl = extractMegaplayIframeUrl(decodedUrl);
            if (megaplayUrl != null) {
                long elapsed = System.currentTimeMillis() - start;
                log.info("[GOGO] MEGAPLAY URL | url={} duration={}ms", megaplayUrl, elapsed);
                return megaplayUrl;
            }

            long elapsed = System.currentTimeMillis() - start;
            log.info("[GOGO] EMBED FALLBACK | returning newplayer url={} duration={}ms", decodedUrl, elapsed);
            return decodedUrl;

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[GOGO] EMBED FAILED | error='{}' duration={}ms", e.getMessage(), elapsed);
            return null;
        }
    }

    private String extractMegaplayIframeUrl(String playerPageUrl) {
        try {
            log.info("[GOGO] EXTRACT MEGAPLAY | url={}", playerPageUrl);
            String html = fetchWithLogging(playerPageUrl, "MEGAPLAY_IFRAME");
            if (html == null) return null;

            Pattern iframePattern = Pattern.compile("<iframe\\s+[^>]*src=\"([^\"]+megaplay[^\"]+)\"");
            Matcher matcher = iframePattern.matcher(html);
            if (matcher.find()) {
                String iframeUrl = matcher.group(1);
                log.info("[GOGO] MEGAPLAY IFRAME | url={}", iframeUrl);
                return iframeUrl;
            }

            log.warn("[GOGO] MEGAPLAY EXTRACT FAILED | no megaplay iframe found");
            return null;
        } catch (Exception e) {
            log.warn("[GOGO] MEGAPLAY EXTRACT ERROR | error='{}'", e.getMessage());
            return null;
        }
    }
}
