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
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AnikotoService implements StreamProvider {

    private static final Logger log = LoggerFactory.getLogger(AnikotoService.class);
    private static final String API_BASE = "https://anikotoapi.site";
    private static final int MAX_SEARCH_PAGES = 5;
    private static final int PER_PAGE = 50;

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
            String seriesId = findSeriesId(malId);
            if (seriesId == null) {
                log.warn("[ANIKOTO] SERIES NOT FOUND | malId={}", malId);
                return List.of();
            }

            String json = fetchApi("/series/" + seriesId + "?per_page=2000");
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
            return json != null;
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

    private String findSeriesId(int malId) {
        String cached = seriesIdCache.get(malId);
        if (cached != null) {
            log.info("[ANIKOTO] SERIES CACHE HIT | malId={} seriesId={}", malId, cached);
            return cached;
        }

        for (int page = 1; page <= MAX_SEARCH_PAGES; page++) {
            try {
                String json = fetchApi("/recent-anime?page=" + page + "&per_page=" + PER_PAGE);
                if (json == null) break;

                JsonNode root = objectMapper.readTree(json);
                JsonNode data = root.path("data");
                if (data.isMissingNode() || !data.isArray()) break;

                // Cache all IDs found for future lookups
                for (JsonNode item : data) {
                    int apiMalId = item.path("mal_id").asInt(0);
                    String apiSeriesId = item.path("id").asText(null);
                    if (apiMalId > 0 && apiSeriesId != null && !apiSeriesId.isEmpty()
                            && !seriesIdCache.containsKey(apiMalId)) {
                        seriesIdCache.put(apiMalId, apiSeriesId);
                    }
                    if (apiMalId == malId && apiSeriesId != null && !apiSeriesId.isEmpty()) {
                        log.info("[ANIKOTO] SERIES FOUND | malId={} seriesId={} page={}",
                            malId, apiSeriesId, page);
                        return apiSeriesId;
                    }
                }

                int currentPage = root.path("meta").path("current_page").asInt(1);
                int lastPage = root.path("meta").path("last_page").asInt(1);
                if (currentPage >= lastPage || currentPage < page) break;

            } catch (Exception e) {
                log.warn("[ANIKOTO] SEARCH PAGE FAILED | page={} error='{}'", page, e.getMessage());
            }
        }

        log.warn("[ANIKOTO] SERIES NOT FOUND IN SEARCH | malId={} searched={} pages",
            malId, MAX_SEARCH_PAGES);
        return null;
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
