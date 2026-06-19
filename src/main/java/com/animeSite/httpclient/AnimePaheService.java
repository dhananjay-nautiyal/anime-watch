package com.animeSite.httpclient;

import com.animeSite.persist.Episode;
import com.animeSite.repo.EpisodeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class AnimePaheService {

    private static final Logger log = LoggerFactory.getLogger(AnimePaheService.class);
    private static final String BASE_URL = "https://animepahe.ru";
    private static final String BASE_API = BASE_URL + "/api?m=";

    private final EpisodeRepository episodeRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public AnimePaheService(EpisodeRepository episodeRepository, RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.episodeRepository = episodeRepository;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public Integer searchAnime(String title) {
        long start = System.currentTimeMillis();
        log.info("[ANIME SEARCH] START | title='{}'", title);

        String encoded = URLEncoder.encode(title, StandardCharsets.UTF_8);
        String url = BASE_API + "search&q=" + encoded;
        log.info("[ANIME SEARCH] URL={}", url);

        try {
            log.info("[ANIME SEARCH] REQUEST START | timeout=connect:3000ms read:5000ms");
            String json = restTemplate.getForObject(url, String.class);
            long elapsed = System.currentTimeMillis() - start;
            log.info("[ANIME SEARCH] REQUEST SUCCESS | duration={}ms", elapsed);

            if (json == null) {
                log.error("[ANIME SEARCH] FAILED | null response | duration={}ms", elapsed);
                return null;
            }

            JsonNode root = objectMapper.readTree(json);
            JsonNode data = root.get("data");

            if (data == null || !data.isArray()) {
                log.warn("[ANIME SEARCH] FAILED | no data array in response | duration={}ms", elapsed);
                return null;
            }

            int count = data.size();
            log.info("[ANIME SEARCH] RESULTS | count={} | duration={}ms", count, elapsed);

            if (count == 0) {
                log.warn("[ANIME SEARCH] FAILED | empty results array | duration={}ms", elapsed);
                return null;
            }

            Integer result = matchByTitle(title, data);
            if (result != null) {
                log.info("[ANIME SEARCH] MATCH | title='{}' matched id={} | duration={}ms", title, result, elapsed);
                return result;
            }

            Integer altResult = matchByAlternative(title, data);
            if (altResult != null) {
                log.info("[ANIME SEARCH] MATCH (alt) | title='{}' matched id={} | duration={}ms", title, altResult, elapsed);
                return altResult;
            }

            int firstId = data.get(0).get("id").asInt();
            String firstTitle = data.get(0).get("title").asText("");
            log.info("[ANIME SEARCH] FALLBACK | using first result '{}' id={} | duration={}ms", firstTitle, firstId, elapsed);
            return firstId;

        } catch (ResourceAccessException e) {
            long elapsed = System.currentTimeMillis() - start;
            Throwable cause = e.getCause();
            String causeType = cause != null ? cause.getClass().getSimpleName() : "unknown";
            String causeMsg = cause != null ? cause.getMessage() : e.getMessage();

            if (cause instanceof SocketTimeoutException) {
                log.error("[ANIME SEARCH] FAILED | connection timed out | cause={} | duration={}ms", causeType, elapsed);
                log.error("[ANIME SEARCH] FAILED | The server cannot reach animepahe.ru:443. Firewall blocking outbound traffic.");
            } else if (cause instanceof ConnectException) {
                log.error("[ANIME SEARCH] FAILED | connection refused | cause={} | duration={}ms", causeType, elapsed);
            } else if (cause instanceof UnknownHostException) {
                log.error("[ANIME SEARCH] FAILED | DNS resolution failed | cause={} | duration={}ms", causeType, elapsed);
            } else {
                log.error("[ANIME SEARCH] FAILED | resource access error | type={} | msg={} | duration={}ms", causeType, causeMsg, elapsed);
            }
            return null;

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[ANIME SEARCH] FAILED | unexpected error | type={} | msg={} | duration={}ms",
                    e.getClass().getSimpleName(), e.getMessage(), elapsed);
            return null;
        }
    }

    private Integer matchByTitle(String title, JsonNode data) {
        String lowerTitle = title.toLowerCase().trim();
        for (JsonNode node : data) {
            String t = node.has("title") ? node.get("title").asText("") : "";
            String lt = t.toLowerCase().trim();
            if (lt.equals(lowerTitle)) return node.get("id").asInt();
        }
        for (JsonNode node : data) {
            String t = node.has("title") ? node.get("title").asText("") : "";
            String lt = t.toLowerCase().trim();
            if (lt.contains(lowerTitle) || lowerTitle.contains(lt)) return node.get("id").asInt();
        }
        String norm = lowerTitle.replaceAll("[^a-z0-9 ]", "").trim();
        for (JsonNode node : data) {
            String t = node.has("title") ? node.get("title").asText("") : "";
            String tn = t.toLowerCase().replaceAll("[^a-z0-9 ]", "").trim();
            if (tn.equals(norm) || tn.contains(norm) || norm.contains(tn)) return node.get("id").asInt();
        }
        return null;
    }

    private Integer matchByAlternative(String title, JsonNode data) {
        String clean = title.replaceAll("[^a-zA-Z0-9 ]", "").trim();
        int colon = clean.indexOf(':');
        String beforeColon = colon > 0 ? clean.substring(0, colon).trim() : null;
        int partIdx = clean.indexOf(" Part");
        String beforePart = partIdx > 0 ? clean.substring(0, partIdx).trim() : null;

        List<String> alts = new ArrayList<>();
        if (beforeColon != null) alts.add(beforeColon);
        if (beforePart != null) alts.add(beforePart);

        log.debug("[ANIME SEARCH] TITLE ALTS | title='{}' → {}", title, alts);

        for (String alt : alts) {
            if (alt.isEmpty()) continue;
            for (JsonNode node : data) {
                String t = node.has("title") ? node.get("title").asText("") : "";
                if (t.toLowerCase().contains(alt.toLowerCase())) {
                    return node.get("id").asInt();
                }
            }
        }
        return null;
    }

    public List<Episode> fetchEpisodes(Integer animePaheId, Integer animeMalId) {
        long start = System.currentTimeMillis();
        log.info("[EPISODE REQUEST] START | animePaheId={} malId={}", animePaheId, animeMalId);
        log.info("[SESSION LOOKUP] Looking up session for animePaheId={}", animePaheId);

        List<Episode> episodes = new ArrayList<>();

        try {
            int page = 1;
            boolean hasMore = true;
            int totalFetched = 0;

            while (hasMore) {
                String url = BASE_API + "episodes&id=" + animePaheId + "&sort=ep_asc&page=" + page + "&per_page=100";
                log.info("[EPISODE REQUEST] FETCH PAGE | page={} url={}", page, url);

                String json = restTemplate.getForObject(url, String.class);

                if (json == null) {
                    log.error("[EPISODE REQUEST] FAILED | null response page={}", page);
                    break;
                }

                JsonNode root = objectMapper.readTree(json);
                JsonNode data = root.get("data");

                if (data == null || !data.isArray() || data.isEmpty()) {
                    log.warn("[EPISODE REQUEST] FAILED | no data array on page={}", page);
                    break;
                }

                int pageCount = data.size();
                log.info("[EPISODE REQUEST] PAGE RESULTS | page={} count={}", page, pageCount);

                for (JsonNode node : data) {
                    int epNum = node.get("episode").asInt();
                    String session = node.get("session").asText();

                    if (session == null || session.isEmpty()) {
                        log.warn("[SESSION MISSING] episode={} no session string", epNum);
                    } else {
                        log.info("[SESSION FOUND] episode={} sessionId={}", epNum, session);
                    }

                    Episode ep = new Episode();
                    ep.setAnimeMalId(animeMalId);
                    ep.setEpisodeNumber(epNum);
                    ep.setTitle(node.has("title") && !node.get("title").isNull()
                            ? node.get("title").asText() : "Episode " + epNum);

                    if (session != null && !session.isEmpty()) {
                        String streamUrl = BASE_URL + "/play/" + animePaheId + "/" + session;
                        ep.setEmbedUrl(streamUrl);
                        log.debug("[STREAM URL] episode={} url={}", epNum, streamUrl);
                    } else {
                        ep.setEmbedUrl(null);
                    }
                    episodes.add(ep);
                    totalFetched++;
                }

                int lastPage = root.get("last_page").asInt();
                hasMore = page < lastPage;
                page++;
            }

            long elapsed = System.currentTimeMillis() - start;
            long withSession = episodes.stream().filter(e -> e.getEmbedUrl() != null).count();

            if (!episodes.isEmpty()) {
                log.info("[EPISODE REQUEST] SUCCESS | total={} withSession={} duration={}ms", totalFetched, withSession, elapsed);
                return episodes;
            }

            log.warn("[EPISODE REQUEST] FAILED | zero episodes fetched | duration={}ms", elapsed);

        } catch (ResourceAccessException e) {
            long elapsed = System.currentTimeMillis() - start;
            Throwable cause = e.getCause();
            String causeType = cause != null ? cause.getClass().getSimpleName() : "unknown";

            log.error("[EPISODE REQUEST] FAILED | connection error | type={} | duration={}ms", causeType, elapsed);

            if (e.getCause() instanceof SocketTimeoutException) {
                log.error("[EPISODE REQUEST] FAILED | socket timeout - server cannot reach animepahe.ru:443");
                log.error("[EPISODE REQUEST] FAILED | target IP: 49.44.79.236 | port: 443 | firewall may be blocking");
            }
            log.error("[ERROR] EXACT ERROR | class={} message={}", e.getClass().getName(), e.getMessage());

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[EPISODE REQUEST] FAILED | unexpected error | type={} msg={} duration={}ms",
                    e.getClass().getSimpleName(), e.getMessage(), elapsed);
            log.error("[ERROR] STACKTRACE", e);
        }

        long elapsed = System.currentTimeMillis() - start;
        log.warn("[EPISODE REQUEST] FALLBACK | generating 0 episodes (no provider access) | duration={}ms", elapsed);
        return new ArrayList<>();
    }

    public List<Episode> syncEpisodes(Integer animePaheId, Integer animeMalId) {
        long start = System.currentTimeMillis();
        log.info("[SYNC] START | animePaheId={} malId={}", animePaheId, animeMalId);

        log.info("[SYNC] DELETING | old episodes for malId={}", animeMalId);
        episodeRepository.deleteByAnimeMalId(animeMalId);

        List<Episode> episodes = fetchEpisodes(animePaheId, animeMalId);

        if (episodes.isEmpty()) {
            long elapsed = System.currentTimeMillis() - start;
            log.warn("[SYNC] COMPLETE | 0 episodes (provider unreachable) | duration={}ms", elapsed);
            return episodes;
        }

        log.info("[SYNC] SAVING | {} episodes for malId={}", episodes.size(), animeMalId);
        List<Episode> saved = episodeRepository.saveAll(episodes);

        long elapsed = System.currentTimeMillis() - start;
        log.info("[SYNC] COMPLETE | saved={} duration={}ms", saved.size(), elapsed);
        return saved;
    }

    public String fetchPlayPage(Integer animePaheId, String session) {
        String url = BASE_URL + "/play/" + animePaheId + "/" + session;
        long start = System.currentTimeMillis();
        log.info("[STREAM REQUEST] START | url={}", url);

        try {
            String html = restTemplate.getForObject(url, String.class);
            long elapsed = System.currentTimeMillis() - start;
            int size = html != null ? html.length() : 0;
            log.info("[STREAM REQUEST] SUCCESS | size={} bytes duration={}ms", size, elapsed);
            return html;
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[STREAM REQUEST] FAILED | type={} msg={} duration={}ms",
                    e.getClass().getSimpleName(), e.getMessage(), elapsed);
            throw new RuntimeException("Stream source is unavailable. Provider may be blocked or down.");
        }
    }

    public String fetchPage(String url) {
        long start = System.currentTimeMillis();
        log.debug("[FETCH PAGE] START | url={}", url);
        try {
            String html = restTemplate.getForObject(url, String.class);
            long elapsed = System.currentTimeMillis() - start;
            int size = html != null ? html.length() : 0;
            log.info("[FETCH PAGE] SUCCESS | size={} duration={}ms", size, elapsed);
            return html;
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[FETCH PAGE] FAILED | type={} msg={} duration={}ms",
                    e.getClass().getSimpleName(), e.getMessage(), elapsed);
            throw new RuntimeException("Failed to fetch page.");
        }
    }
}
