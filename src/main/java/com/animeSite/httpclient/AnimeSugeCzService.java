package com.animeSite.httpclient;

import com.animeSite.persist.Episode;
import com.animeSite.pipeline.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AnimeSugeCzService implements StreamProvider {

    private static final Logger log = LoggerFactory.getLogger(AnimeSugeCzService.class);
    private static final String BASE_URL = "https://animesuge.cz";
    private static final String API_BASE = "https://anikotoapi.site";
    private static final int MAX_SEARCH_PAGES = 5;
    private static final int PER_PAGE = 50;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private final Map<Integer, String> seriesIdCache = new ConcurrentHashMap<>();

    public AnimeSugeCzService(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate,
                               ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public String getName() { return "AnimeSugeCZ"; }

    @Override
    public List<Episode> fetchEpisodes(int malId, String title) {
        long start = System.currentTimeMillis();
        log.info("[ANIMESUGECZ] FETCH EPISODES | malId={} title='{}'", malId, title);

        try {
            String seriesId = findSeriesId(malId);
            if (seriesId == null) {
                log.warn("[ANIMESUGECZ] SERIES NOT FOUND | malId={}", malId);
                return List.of();
            }

            String json = fetchAjax("/ajax/episode/list/" + seriesId);
            if (json == null) {
                log.warn("[ANIMESUGECZ] EPISODE LIST NULL | malId={} seriesId={}", malId, seriesId);
                return List.of();
            }

            JsonNode root = objectMapper.readTree(json);
            int status = root.path("status").asInt(0);
            if (status != 200) {
                log.warn("[ANIMESUGECZ] EPISODE LIST BAD STATUS | malId={} status={}", malId, status);
                return List.of();
            }

            String html = root.path("result").asText();
            List<Episode> episodes = parseEpisodes(html, malId);

            episodes.sort(Comparator.comparingInt(Episode::getEpisodeNumber));

            long elapsed = System.currentTimeMillis() - start;
            log.info("[ANIMESUGECZ] SUCCESS | malId={} count={} duration={}ms",
                malId, episodes.size(), elapsed);
            return episodes;

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[ANIMESUGECZ] FETCH FAILED | malId={} error='{}' duration={}ms",
                malId, e.getMessage(), elapsed);
            return List.of();
        }
    }

    @Override
    public StreamResult resolveStream(String episodePageUrl) {
        long start = System.currentTimeMillis();
        log.info("[ANIMESUGECZ] RESOLVE STREAM");

        try {
            String serverJson = fetchAjax("/ajax/server/list?servers=" + episodePageUrl);
            if (serverJson == null) {
                return StreamResult.failure(getName(), "Failed to fetch server list");
            }

            JsonNode root = objectMapper.readTree(serverJson);
            int status = root.path("status").asInt(0);
            if (status != 200) {
                return StreamResult.failure(getName(), "Server list bad status: " + status);
            }

            String html = root.path("result").asText();
            Document doc = Jsoup.parse(html);

            List<StreamResult.ServerOption> servers = new ArrayList<>();
            Elements serverTypes = doc.select("div.server-type");

            boolean subFound = false;
            boolean dubFound = false;

            for (Element serverType : serverTypes) {
                String langType = serverType.attr("data-type");
                boolean isSub = "sub".equalsIgnoreCase(langType) || "hsub".equalsIgnoreCase(langType);
                boolean isDub = "dub".equalsIgnoreCase(langType);

                if (isSub && subFound) continue;
                if (isDub && dubFound) continue;

                Elements serverItems = serverType.select("div.server");
                for (int i = 0; i < serverItems.size() && i < 2; i++) {
                    Element item = serverItems.get(i);
                    String linkId = item.attr("data-link-id");
                    if (linkId == null || linkId.isEmpty()) continue;

                    String name = item.select("span").text();
                    if (name == null || name.isEmpty()) name = "Server";

                    String label = isDub ? name + " (DUB)" : name + " (SUB)";

                    String resolvedUrl = resolveServerUrl(linkId);
                    if (resolvedUrl != null) {
                        servers.add(new StreamResult.ServerOption(resolvedUrl, label, false));
                    }
                }

                if (isSub) subFound = true;
                if (isDub) dubFound = true;
            }

            if (servers.isEmpty()) {
                return StreamResult.failure(getName(), "No working servers found");
            }

            long elapsed = System.currentTimeMillis() - start;
            log.info("[ANIMESUGECZ] STREAM RESOLVED | servers={} duration={}ms",
                servers.size(), elapsed);
            return StreamResult.success(getName(), "iframe", servers);

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[ANIMESUGECZ] RESOLVE STREAM FAILED | error='{}' duration={}ms",
                e.getMessage(), elapsed);
            return StreamResult.failure(getName(), "Resolve failed: " + e.getMessage());
        }
    }

    @Override
    public boolean healthCheck() {
        try {
            String json = fetchApi("/recent-anime?page=1&per_page=1");
            return json != null;
        } catch (Exception e) {
            return false;
        }
    }

    private String resolveServerUrl(String linkId) {
        try {
            String json = fetchAjax("/ajax/server?get=" + linkId);
            if (json == null) return null;

            JsonNode root = objectMapper.readTree(json);
            int s = root.path("status").asInt(0);
            if (s != 200) return null;

            return root.path("result").path("url").asText(null);
        } catch (Exception e) {
            log.warn("[ANIMESUGECZ] SERVER URL RESOLVE FAILED | linkId={} error='{}'",
                linkId, e.getMessage());
            return null;
        }
    }

    private List<Episode> parseEpisodes(String html, int malId) {
        List<Episode> episodes = new ArrayList<>();
        Document doc = Jsoup.parse(html);

        Elements rangeDivs = doc.select("div.range");
        for (Element range : rangeDivs) {
            Elements links = range.select("a[data-slug][data-ids]");
            for (Element link : links) {
                String slugStr = link.attr("data-slug");
                String ids = link.attr("data-ids");
                String numTitle = link.attr("data-num");

                if (slugStr == null || slugStr.isEmpty() || ids == null || ids.isEmpty()) continue;

                try {
                    int episodeNum = Integer.parseInt(slugStr);
                    String epTitle = (numTitle != null && !numTitle.isEmpty())
                        ? numTitle : "Episode " + episodeNum;

                    Episode ep = new Episode();
                    ep.setAnimeMalId(malId);
                    ep.setEpisodeNumber(episodeNum);
                    ep.setTitle(epTitle);
                    ep.setEmbedUrl(ids);
                    episodes.add(ep);
                } catch (NumberFormatException e) {
                    log.warn("[ANIMESUGECZ] BAD EPISODE NUMBER | slug='{}'", slugStr);
                }
            }
        }

        return episodes;
    }

    // ---- SERIES ID DISCOVERY (via AnikotoAPI) ----

    private String findSeriesId(int malId) {
        String cached = seriesIdCache.get(malId);
        if (cached != null) {
            return cached;
        }

        for (int page = 1; page <= MAX_SEARCH_PAGES; page++) {
            try {
                String json = fetchApi("/recent-anime?page=" + page + "&per_page=" + PER_PAGE);
                if (json == null) break;

                JsonNode root = objectMapper.readTree(json);
                JsonNode data = root.path("data");
                if (data.isMissingNode() || !data.isArray()) break;

                for (JsonNode item : data) {
                    int apiMalId = item.path("mal_id").asInt(0);
                    String apiSeriesId = item.path("id").asText(null);
                    if (apiMalId > 0 && apiSeriesId != null && !apiSeriesId.isEmpty()
                            && !seriesIdCache.containsKey(apiMalId)) {
                        seriesIdCache.put(apiMalId, apiSeriesId);
                    }
                    if (apiMalId == malId && apiSeriesId != null && !apiSeriesId.isEmpty()) {
                        return apiSeriesId;
                    }
                }

                int currentPage = root.path("meta").path("current_page").asInt(1);
                int lastPage = root.path("meta").path("last_page").asInt(1);
                if (currentPage >= lastPage || currentPage < page) break;

            } catch (Exception e) {
                log.warn("[ANIMESUGECZ] SEARCH PAGE FAILED | page={} error='{}'", page, e.getMessage());
            }
        }

        return null;
    }

    // ---- HTTP HELPERS ----

    private String fetchAjax(String path) {
        String url = BASE_URL + path;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("X-Requested-With", "XMLHttpRequest");
            headers.set("Referer", BASE_URL + "/");
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(
                URI.create(url), HttpMethod.GET, entity, String.class);
            return response.getBody();
        } catch (Exception e) {
            log.warn("[ANIMESUGECZ] AJAX FAILED | url={} error='{}'", url, e.getMessage());
            return null;
        }
    }

    private String fetchApi(String path) {
        String url = API_BASE + path;
        try {
            return restTemplate.getForObject(URI.create(url), String.class);
        } catch (Exception e) {
            log.warn("[ANIMESUGECZ] API FAILED | url={} error='{}'", url, e.getMessage());
            return null;
        }
    }
}
