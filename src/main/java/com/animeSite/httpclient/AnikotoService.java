package com.animeSite.httpclient;

import com.animeSite.persist.Episode;
import com.animeSite.pipeline.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AnikotoService implements StreamProvider {

    private static final Logger log = LoggerFactory.getLogger(AnikotoService.class);
    private static final String API_BASE = "https://anikotoapi.site";
    // The catalog API has no search endpoint, but the public site does. Each
    // result card carries data-tip="<seriesId>" next to the display title, so
    // a title search is the only reliable way to resolve a MAL id.
    private static final String SITE_BASE = "https://anikototv.to";
    private static final int MAX_SCAN_PAGES = 5;
    private static final int MAX_ID_VERIFICATIONS = 4;
    private static final int PER_PAGE = 100;

    private static final Pattern DATA_TIP = Pattern.compile("data-tip=\"(\\d+)\"");
    private static final Pattern IMG_ALT = Pattern.compile("<img[^>]*alt=\"([^\"]*)\"");

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private final Map<Integer, String> seriesIdCache = new ConcurrentHashMap<>();
    private final Map<String, LanguagePair> languageCache = new ConcurrentHashMap<>();

    public AnikotoService(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public String getName() { return "AnimeSuge"; }

    @Override
    public List<Episode> fetchEpisodes(int malId, String title) {
        long start = System.currentTimeMillis();
        log.info("[ANIKOTO] FETCH EPISODES | malId={} title='{}'", malId, title);

        try {
            String seriesId = findSeriesId(malId, title);
            if (seriesId == null) {
                log.warn("[ANIKOTO] SERIES NOT FOUND | malId={}", malId);
                return List.of();
            }

            String json = fetchApi("/series/" + seriesId + "?per_page=1000");
            if (json == null) {
                log.warn("[ANIKOTO] SERIES DATA NULL | malId={} seriesId={}", malId, seriesId);
                return List.of();
            }

            JsonNode root = objectMapper.readTree(json);
            JsonNode episodesNode = root.path("data").path("episodes");
            if (episodesNode.isMissingNode() || !episodesNode.isArray()) {
                log.warn("[ANIKOTO] NO EPISODES IN RESPONSE | malId={} seriesId={}", malId, seriesId);
                return List.of();
            }

            List<Episode> episodes = new ArrayList<>();
            int subCount = 0;
            int dubCount = 0;

            for (JsonNode epNode : episodesNode) {
                int epNum = epNode.path("number").asInt(0);
                if (epNum <= 0) continue;

                JsonNode embedUrls = epNode.path("embed_url");
                String subUrl = embedUrls.has("sub") && !embedUrls.path("sub").isNull()
                    ? embedUrls.path("sub").asText() : null;
                String dubUrl = embedUrls.has("dub") && !embedUrls.path("dub").isNull()
                    ? embedUrls.path("dub").asText() : null;

                String primaryUrl = subUrl != null ? subUrl : dubUrl;
                if (primaryUrl == null) continue;

                if (subUrl != null) subCount++;
                if (dubUrl != null) dubCount++;

                languageCache.put(primaryUrl, new LanguagePair(subUrl, dubUrl));

                Episode ep = new Episode();
                ep.setAnimeMalId(malId);
                ep.setEpisodeNumber(epNum);
                ep.setTitle("Episode " + epNum);
                ep.setEmbedUrl(primaryUrl);
                episodes.add(ep);
            }

            episodes.sort(Comparator.comparingInt(Episode::getEpisodeNumber));

            long elapsed = System.currentTimeMillis() - start;
            log.info("[ANIKOTO] SUCCESS | malId={} count={} sub={} dub={} duration={}ms",
                malId, episodes.size(), subCount, dubCount, elapsed);
            return episodes;

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[ANIKOTO] FETCH FAILED | malId={} error='{}' duration={}ms",
                malId, e.getMessage(), elapsed);
            return List.of();
        }
    }

    @Override
    public StreamResult resolveStream(String episodePageUrl) {
        log.info("[ANIKOTO] RESOLVE STREAM | url={}", episodePageUrl);

        LanguagePair pair = languageCache.get(episodePageUrl);
        if (pair == null) {
            pair = deriveFromUrl(episodePageUrl);
        }

        List<StreamResult.ServerOption> servers = new ArrayList<>();
        if (pair != null) {
            if (pair.subUrl != null) {
                servers.add(new StreamResult.ServerOption(pair.subUrl, "MegaPlay-SUB", false));
            }
            if (pair.dubUrl != null) {
                servers.add(new StreamResult.ServerOption(pair.dubUrl, "MegaPlay-DUB", servers.isEmpty()));
            }
        } else {
            log.warn("[ANIKOTO] UNRECOGNIZED URL | url={} — not a megaplay URL, skipping", episodePageUrl);
            return StreamResult.failure(getName(), "Unrecognized URL format");
        }

        if (servers.isEmpty()) {
            return StreamResult.failure(getName(), "No stream URLs available");
        }

        log.info("[ANIKOTO] STREAM RESOLVED | servers={}", servers.size());
        return StreamResult.success(getName(), "iframe", servers);
    }

    @Override
    public boolean healthCheck() {
        try {
            String json = fetchApi("/recent-anime?page=1&per_page=1");
            if (json == null) return false;
            JsonNode root = objectMapper.readTree(json);
            JsonNode data = root.path("data");
            return root.path("ok").asBoolean(false) && data.isArray() && !data.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    private LanguagePair deriveFromUrl(String url) {
        if (url == null || !url.contains("megaplay.buzz/stream/")) return null;

        String subUrl = null;
        String dubUrl = null;

        if (url.endsWith("/sub")) {
            subUrl = url;
            // Only return DUB if the URL explicitly points to DUB
            // Deriving DUB from SUB may produce URLs that don't exist on megaplay
        } else if (url.endsWith("/dub")) {
            dubUrl = url;
            subUrl = url.substring(0, url.length() - 4) + "/sub";
        }

        if (subUrl != null || dubUrl != null) {
            return new LanguagePair(subUrl, dubUrl);
        }
        return null;
    }

    private String findSeriesId(int malId, String title) {
        String cached = seriesIdCache.get(malId);
        if (cached != null) {
            log.info("[ANIKOTO] SERIES CACHE HIT | malId={} seriesId={}", malId, cached);
            return cached;
        }

        String byTitle = findByTitle(malId, title);
        if (byTitle != null) {
            seriesIdCache.put(malId, byTitle);
            return byTitle;
        }

        String byScan = scanCatalog(malId);
        if (byScan != null) {
            seriesIdCache.put(malId, byScan);
            return byScan;
        }

        log.warn("[ANIKOTO] SERIES NOT FOUND | malId={} title='{}'", malId, title);
        return null;
    }

    /**
     * Search the public site by title, then confirm each candidate against the
     * catalog API's {@code data.anime.mal_id}. The confirmation step is what
     * makes this safe: a fuzzy title match alone can pick a movie or a special.
     */
    private String findByTitle(int malId, String title) {
        if (title == null || title.isBlank()) return null;

        List<Map.Entry<String, String>> candidates;
        try {
            String url = SITE_BASE + "/search?keyword=" + URLEncoder.encode(title, StandardCharsets.UTF_8);
            candidates = parseSearchCards(fetchHtml(url));
        } catch (Exception e) {
            log.warn("[ANIKOTO] TITLE SEARCH FAILED | title='{}' error='{}'", title, e.getMessage());
            return null;
        }

        if (candidates.isEmpty()) {
            log.warn("[ANIKOTO] TITLE SEARCH EMPTY | title='{}'", title);
            return null;
        }

        candidates.sort((a, b) -> Double.compare(
            AnimeMatcher.computeTitleSimilarity(title, b.getValue()),
            AnimeMatcher.computeTitleSimilarity(title, a.getValue())));

        int verified = 0;
        for (Map.Entry<String, String> candidate : candidates) {
            if (verified++ >= MAX_ID_VERIFICATIONS) break;
            Integer candidateMalId = fetchSeriesMalId(candidate.getKey());
            if (candidateMalId != null && candidateMalId == malId) {
                log.info("[ANIKOTO] SERIES FOUND BY TITLE | malId={} seriesId={} title='{}'",
                    malId, candidate.getKey(), candidate.getValue());
                return candidate.getKey();
            }
        }

        log.warn("[ANIKOTO] TITLE SEARCH NO MAL_ID MATCH | malId={} checked={} candidates={}",
            malId, Math.min(verified, MAX_ID_VERIFICATIONS), candidates.size());
        return null;
    }

    /** Extracts (seriesId, displayTitle) pairs from a site search page. */
    static List<Map.Entry<String, String>> parseSearchCards(String html) {
        List<Map.Entry<String, String>> cards = new ArrayList<>();
        if (html == null || html.isBlank()) return cards;

        String[] chunks = html.split("<div class=\"item");
        for (int i = 1; i < chunks.length; i++) {
            Matcher id = DATA_TIP.matcher(chunks[i]);
            Matcher alt = IMG_ALT.matcher(chunks[i]);
            if (id.find() && alt.find()) {
                cards.add(new AbstractMap.SimpleEntry<>(id.group(1), alt.group(1)));
            }
        }
        return cards;
    }

    private Integer fetchSeriesMalId(String seriesId) {
        try {
            String json = fetchApi("/series/" + seriesId + "?per_page=1");
            if (json == null) return null;
            JsonNode node = objectMapper.readTree(json).path("data").path("anime").path("mal_id");
            return node.isMissingNode() || node.isNull() ? null : node.asInt();
        } catch (Exception e) {
            log.warn("[ANIKOTO] SERIES LOOKUP FAILED | seriesId={} error='{}'", seriesId, e.getMessage());
            return null;
        }
    }

    /**
     * Fallback: walk the catalog until the MAL id shows up. Bounded because the
     * catalog has ~91 pages and the API rate-limits at 60 requests per 2 min.
     */
    private String scanCatalog(int malId) {
        for (int page = 1; page <= MAX_SCAN_PAGES; page++) {
            try {
                String json = fetchApi("/recent-anime?page=" + page + "&per_page=" + PER_PAGE);
                if (json == null) break;

                JsonNode root = objectMapper.readTree(json);
                JsonNode data = root.path("data");
                if (!data.isArray() || data.isEmpty()) break;

                for (JsonNode item : data) {
                    int apiMalId = item.path("mal_id").asInt(0);
                    String apiSeriesId = item.path("id").asText(null);
                    if (apiMalId <= 0 || apiSeriesId == null || apiSeriesId.isEmpty()) continue;

                    seriesIdCache.putIfAbsent(apiMalId, apiSeriesId);
                    if (apiMalId == malId) {
                        log.info("[ANIKOTO] SERIES FOUND BY CATALOG SCAN | malId={} seriesId={} page={}",
                            malId, apiSeriesId, page);
                        return apiSeriesId;
                    }
                }

                // The API nests paging under "pagination", not "meta".
                int totalPages = root.path("pagination").path("total_pages").asInt(1);
                if (page >= totalPages) break;

            } catch (Exception e) {
                log.warn("[ANIKOTO] CATALOG SCAN PAGE FAILED | page={} error='{}'", page, e.getMessage());
                break;
            }
        }
        return null;
    }

    private String fetchHtml(String url) {
        return restTemplate.getForObject(URI.create(url), String.class);
    }

    private String fetchApi(String path) {
        String url = API_BASE + path;
        try {
            return restTemplate.getForObject(URI.create(url), String.class);
        } catch (Exception e) {
            log.warn("[ANIKOTO] API FAILED | url={} error='{}'", url, e.getMessage());
            return null;
        }
    }

    private static class LanguagePair {
        final String subUrl;
        final String dubUrl;

        LanguagePair(String subUrl, String dubUrl) {
            this.subUrl = subUrl;
            this.dubUrl = dubUrl;
        }
    }
}
