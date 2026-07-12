package com.animeSite.httpclient;

import com.animeSite.persist.Episode;
import com.animeSite.pipeline.*;
import com.animeSite.model.JikanAnimeData;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AnimeGogoService implements StreamProvider {

    private static final Logger log = LoggerFactory.getLogger(AnimeGogoService.class);
    private static final String BASE_URL = "https://gogoanime.live";
    private static final String JIKAN_BASE = "https://api.jikan.moe/v4";
    private static final int MAX_RETRIES = 3;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final RetryEngine retryEngine;

    public AnimeGogoService(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.retryEngine = RetryEngine.builder()
            .maxRetries(MAX_RETRIES)
            .baseDelayMs(1000)
            .maxDelayMs(4000)
            .jitterMs(200)
            .circuitBreaker(new CircuitBreaker("GoGoAnime", 5, java.time.Duration.ofSeconds(30)))
            .build();
    }

    @Override
    public String getName() { return "GoGoAnime"; }

    private String fetchWithLogging(String url, String context) {
        return fetchWithLogging(url, context, 0);
    }

    private String fetchWithLogging(String url, String context, int retryCount) {
        long t = System.currentTimeMillis();
        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest(getName(), url, "GET");
        diag.addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        diag.addHeader("Referer", BASE_URL + "/");

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            headers.set("Referer", BASE_URL + "/");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> resp = restTemplate.exchange(URI.create(url), HttpMethod.GET, entity, String.class);
            HttpStatusCode status = resp.getStatusCode();
            String body = resp.getBody();
            long elapsed = System.currentTimeMillis() - t;

            diag.withStatus(status.value(), elapsed);
            if (body != null) {
                diag.withResponseBody(body);
                log.info("[GOGO] {} | url={} status={} bodyLength={} preview='{}' duration={}ms",
                    context, url, status, body.length(),
                    body.substring(0, Math.min(200, body.length())).replace('\n', ' ').replace('\r', ' '),
                    elapsed);
            } else {
                log.warn("[GOGO] {} | url={} status={} body=null duration={}ms", context, url, status, elapsed);
            }

            if (body != null && (body.contains("Cloudflare") || body.contains("cf-browser-verification"))) {
                diag.setRootCause("ANTI_BOT");
                throw new ProviderException(getName(), "ANTI_BOT", "Cloudflare challenge detected", 403, diag, "FETCH");
            }

            return body;

        } catch (HttpClientErrorException e) {
            long elapsed = System.currentTimeMillis() - t;
            String respBody = e.getResponseBodyAsString();
            int statusCode = e.getStatusCode().value();
            diag.withStatus(statusCode, elapsed);
            diag.withResponseBody(respBody);
            diag.withError(e.getMessage());

            log.warn("[GOGO] {} FAILED | url={} status={} body='{}' duration={}ms",
                context, url, statusCode,
                respBody != null ? respBody.substring(0, Math.min(200, respBody.length())).replace('\n', ' ').replace('\r', ' ') : "null",
                elapsed);

            String rootCause = ProviderDiagnostics.detectRootCause(statusCode, respBody, url);
            diag.setRootCause(rootCause);

            if (statusCode == 400) {
                log.warn("[GOGO] HTTP 400 DETECTED | url={} cause={} body='{}'", url, rootCause,
                    respBody != null ? respBody.substring(0, Math.min(500, respBody.length())) : "null");
                throw new ProviderException(getName(), "HTTP_400_" + rootCause,
                    "HTTP 400 from GoGoAnime: " + rootCause + " (" + (respBody != null ? respBody.substring(0, Math.min(100, respBody.length())) : "no body") + ")",
                    statusCode, diag, "FETCH");
            }

            if ((statusCode == 429 || statusCode >= 500) && retryCount < MAX_RETRIES) {
                long backoff = (long) Math.pow(2, retryCount) * 1000;
                log.info("[GOGO] RETRY {}/{} after {}ms", retryCount + 1, MAX_RETRIES, backoff);
                try { Thread.sleep(backoff); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                return fetchWithLogging(url, context, retryCount + 1);
            }

            if (statusCode == 429) {
                throw new ProviderException(getName(), "RATE_LIMIT", "Rate limited by GoGoAnime", statusCode, diag, "FETCH");
            }

            return null;

        } catch (HttpServerErrorException e) {
            long elapsed = System.currentTimeMillis() - t;
            int statusCode = e.getStatusCode().value();
            diag.withStatus(statusCode, elapsed);
            diag.withError(e.getMessage());
            diag.setRootCause("SERVER_ERROR");

            log.warn("[GOGO] {} FAILED | url={} status={} duration={}ms", context, url, statusCode, elapsed);
            if (retryCount < MAX_RETRIES) {
                long backoff = (long) Math.pow(2, retryCount) * 1000;
                log.info("[GOGO] RETRY {}/{} after {}ms", retryCount + 1, MAX_RETRIES, backoff);
                try { Thread.sleep(backoff); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                return fetchWithLogging(url, context, retryCount + 1);
            }
            throw new ProviderException(getName(), "SERVER_ERROR", "GoGoAnime server error: " + statusCode, statusCode, diag, "FETCH");

        } catch (ProviderException e) {
            throw e;

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - t;
            diag.withStatus(0, elapsed);
            diag.withError(e.getMessage());
            diag.setRootCause("NETWORK_ERROR");

            log.warn("[GOGO] {} FAILED | url={} error='{}' duration={}ms", context, url, e.getMessage(), elapsed);
            if (retryCount < MAX_RETRIES) {
                long backoff = (long) Math.pow(2, retryCount) * 1000;
                log.info("[GOGO] RETRY {}/{} after {}ms", retryCount + 1, MAX_RETRIES, backoff);
                try { Thread.sleep(backoff); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                return fetchWithLogging(url, context, retryCount + 1);
            }
            return null;
        }
    }

    private JsonNode fetchJikanData(int malId) {
        try {
            Thread.sleep(400);
            String url = JIKAN_BASE + "/anime/" + malId;
            String json = fetchWithLogging(url, "JIKAN_LOOKUP");
            if (json == null) return null;
            return objectMapper.readTree(json).get("data");
        } catch (Exception e) {
            log.warn("[GOGO] JIKAN FETCH FAILED | malId={} error='{}'", malId, e.getMessage());
            return null;
        }
    }

    @Override
    public List<Episode> fetchEpisodes(int malId, String title) {
        long start = System.currentTimeMillis();
        log.info("[GOGO] FETCH EPISODES | title='{}' malId={}", title, malId);

        JsonNode jikanData = fetchJikanData(malId);
        List<String> allSlugs = TitleNormalizer.collectAllSlugs(jikanData, title);

        log.info("[GOGO] GENERATED SLUGS | count={} slugs={}", allSlugs.size(), allSlugs);

        for (String slug : allSlugs) {
            if (slug == null || slug.isBlank() || slug.length() < 2) continue;
            String url = BASE_URL + "/" + slug;
            log.info("[GOGO] TRY SLUG | slug='{}' url={}", slug, url);

            try {
                String html = fetchWithLogging(url, "SLUG=" + slug);
                if (html == null) continue;

                if (html.contains("anime-info")) {
                    if (!verifyPageTitle(html, jikanData, title, slug)) {
                        log.warn("[GOGO] PAGE TITLE MISMATCH | slug='{}' — skipping, likely wrong anime", slug);
                        continue;
                    }
                    List<Episode> episodes = parseEpisodesFromHtml(html, slug, malId);
                    if (!episodes.isEmpty()) {
                        episodes.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                        long elapsed = System.currentTimeMillis() - start;
                        log.info("[GOGO] SUCCESS | slug='{}' count={} duration={}ms", slug, episodes.size(), elapsed);
                        return episodes;
                    }
                }
            } catch (ProviderException e) {
                log.warn("[GOGO] SLUG FAILED | slug='{}' errorCode={} message='{}'", slug, e.getErrorCode(), e.getMessage());
                if ("HTTP_400_INVALID_ID".equals(e.getErrorCode())) {
                    log.warn("[GOGO] INVALID ID FOR SLUG | slug='{}' — skipping remaining slugs, trying search", slug);
                    break;
                }
                continue;
            }
        }

        log.warn("[GOGO] ALL SLUGS FAILED | trying search...");
        List<Episode> searchResult = trySearch(malId, title, jikanData);
        if (!searchResult.isEmpty()) {
            long elapsed = System.currentTimeMillis() - start;
            log.info("[GOGO] SEARCH SUCCESS | count={} duration={}ms", searchResult.size(), elapsed);
            return searchResult;
        }

        long elapsed = System.currentTimeMillis() - start;
        log.warn("[GOGO] ALL ATTEMPTS FAILED | title='{}' malId={} duration={}ms", title, malId, elapsed);
        return List.of();
    }

    private boolean verifyPageTitle(String html, JsonNode jikanData, String primaryTitle, String slug) {
        if (html == null) return false;
        String pageTitle = TitleNormalizer.extractPageTitle(html);
        if (pageTitle.isEmpty()) {
            log.warn("[GOGO] PAGE TITLE EMPTY | slug='{}' — cannot verify", slug);
            return slug.matches(".*(?:19[0-9]{2}|20[0-9]{2}).*");
        }

        log.info("[GOGO] PAGE TITLE | slug='{}' pageTitle='{}'", slug, pageTitle);

        Set<String> knownTitles = new LinkedHashSet<>();
        if (primaryTitle != null) knownTitles.add(primaryTitle.toLowerCase());
        if (jikanData != null) {
            for (String key : new String[]{"title", "title_english", "title_japanese"}) {
                if (jikanData.has(key) && !jikanData.get(key).isNull()) {
                    String t = jikanData.get(key).asText().toLowerCase();
                    if (!t.isEmpty()) knownTitles.add(t);
                }
            }
            JsonNode titlesArr = jikanData.get("titles");
            if (titlesArr != null) {
                for (JsonNode t : titlesArr) {
                    String val = t.has("title") ? t.get("title").asText("").toLowerCase() : "";
                    if (!val.isEmpty()) knownTitles.add(val);
                }
            }
        }

        String pageLower = pageTitle.toLowerCase();
        for (String known : knownTitles) {
            if (known.isEmpty()) continue;
            if (pageLower.contains(known)) return true;
            String normKnown = TitleNormalizer.normalize(known).toLowerCase();
            if (normKnown.length() > 3 && pageLower.contains(normKnown)) return true;
            String[] knownTokens = known.split("\\s+");
            String[] pageTokens = pageLower.split("\\s+");
            int matchCount = 0;
            for (String kt : knownTokens) {
                if (kt.length() < 3) continue;
                for (String pt : pageTokens) {
                    if (pt.equals(kt) || pt.startsWith(kt) || kt.startsWith(pt)) {
                        matchCount++;
                        break;
                    }
                }
            }
            if (matchCount >= Math.min(knownTokens.length, 3)) return true;
        }

        log.warn("[GOGO] PAGE TITLE VERIFICATION FAILED | slug='{}' pageTitle='{}' knownTitles={}", slug, pageTitle, knownTitles);
        return false;
    }

    private List<Episode> parseEpisodesFromHtml(String html, String slug, int malId) {
        List<Episode> episodes = new ArrayList<>();
        Set<Integer> seen = new LinkedHashSet<>();
        String slugLower = slug.toLowerCase();
        Pattern epPattern = Pattern.compile("/" + Pattern.quote(slugLower) + "-episode-(\\d+)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = epPattern.matcher(html);
        while (matcher.find()) {
            int epNum = Integer.parseInt(matcher.group(1));
            if (seen.add(epNum)) {
                Episode ep = new Episode();
                ep.setAnimeMalId(malId);
                ep.setEpisodeNumber(epNum);
                ep.setTitle("Episode " + epNum);
                ep.setEmbedUrl(BASE_URL + "/" + slugLower + "-episode-" + epNum);
                episodes.add(ep);
            }
        }
        return episodes;
    }

    private List<Episode> trySearch(int malId, String originalTitle, JsonNode jikanData) {
        List<String> searchTerms = new ArrayList<>();
        if (jikanData != null) {
            for (String key : new String[]{"title", "title_english", "title_japanese"}) {
                if (jikanData.has(key) && !jikanData.get(key).isNull()) {
                    searchTerms.add(jikanData.get(key).asText());
                }
            }
            JsonNode titles = jikanData.get("titles");
            if (titles != null) {
                for (JsonNode t : titles) {
                    String ti = t.has("title") ? t.get("title").asText("") : "";
                    if (!ti.isEmpty()) searchTerms.add(ti);
                }
            }
        }
        searchTerms.add(originalTitle);
        searchTerms.add(TitleNormalizer.normalize(originalTitle));

        Set<String> tried = new LinkedHashSet<>();
        for (String term : searchTerms) {
            if (term == null || term.isBlank() || !tried.add(term.toLowerCase())) continue;
            try {
                String foundSlug = searchSingle(term);
                if (foundSlug != null) {
                    String url = BASE_URL + "/" + foundSlug;
                    String html = fetchWithLogging(url, "SEARCH_HIT=" + foundSlug);
                    if (html != null) {
                        List<Episode> episodes = parseEpisodesFromHtml(html, foundSlug, malId);
                        if (!episodes.isEmpty()) return episodes;
                    }
                }
            } catch (ProviderException e) {
                log.warn("[GOGO] SEARCH TERM FAILED | term='{}' error='{}'", term, e.getMessage());
            }
        }
        return List.of();
    }

    private String searchSingle(String title) {
        try {
            String keywords = java.net.URLEncoder.encode(title, "UTF-8");
            String searchUrl = BASE_URL + "/search.html?keyword=" + keywords;
            log.info("[GOGO] SEARCH | title='{}' url={}", title, searchUrl);
            String html = fetchWithLogging(searchUrl, "SEARCH");
            if (html == null) return null;

            Set<String> candidates = new LinkedHashSet<>();
            Pattern linkPattern = Pattern.compile("/category/([a-z0-9-]+)");
            Matcher matcher = linkPattern.matcher(html);

            while (matcher.find()) {
                String slug = matcher.group(1);
                candidates.add(slug);
            }

            AnimeMatcher.ScoredMatch best = AnimeMatcher.findBestMatch(title, null, new ArrayList<>(candidates));
            if (best != null && best.confidence >= 0.8) {
                log.info("[GOGO] SEARCH BEST MATCH | slug='{}' confidence={}", best.slug, best.confidence);
                return best.slug;
            }

            log.warn("[GOGO] SEARCH NO MATCH | title='{}' bestConfidence={} candidates={}", title, best != null ? best.confidence : 0, candidates);
            return null;
        } catch (Exception e) {
            log.warn("[GOGO] SEARCH FAILED | error='{}'", e.getMessage());
            return null;
        }
    }

    @Override
    public StreamResult resolveStream(String episodePageUrl) {
        long start = System.currentTimeMillis();
        log.info("[GOGO] RESOLVE STREAM | url={}", episodePageUrl);

        if (episodePageUrl == null || !episodePageUrl.startsWith(BASE_URL)) {
            log.warn("[GOGO] SKIP — not a GoGoAnime URL | url={}", episodePageUrl);
            return StreamResult.failure(getName(), "Not a GoGoAnime URL");
        }

        try {
            String html = fetchWithLogging(episodePageUrl, "GOGO_STREAM");
            if (html == null) {
                return StreamResult.failure(getName(), "null response after fetch");
            }

            List<StreamResult.ServerOption> servers = new ArrayList<>();
            Pattern pattern = Pattern.compile("data-video=\"([^\"&]+)\"");
            Matcher matcher = pattern.matcher(html);
            while (matcher.find()) {
                String videoUrl = new String(Base64.getDecoder().decode(matcher.group(1)));
                if (videoUrl.contains("newplayer.php")) {
                    String megaplayUrl = followNewPlayer(videoUrl);
                    if (megaplayUrl != null) {
                        servers.add(new StreamResult.ServerOption(megaplayUrl, "GoGo-Megaplay", false));
                    } else {
                        servers.add(new StreamResult.ServerOption(videoUrl, "GoGo-NewPlayer", false));
                    }
                } else {
                    servers.add(new StreamResult.ServerOption(videoUrl, "GoGo-Direct", false));
                }
            }

            if (servers.isEmpty()) {
                log.warn("[GOGO] STREAM FAILED | no data-video found");
                return StreamResult.failure(getName(), "No video sources found on episode page");
            }

            log.info("[GOGO] STREAM RESOLVED | servers={} duration={}ms",
                servers.size(), System.currentTimeMillis() - start);
            return StreamResult.success(getName(), "iframe", servers);

        } catch (ProviderException e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[GOGO] STREAM FAILED | errorCode={} error='{}' duration={}ms", e.getErrorCode(), e.getMessage(), elapsed);
            return StreamResult.failure(getName(), e.getErrorCode() + ": " + e.getMessage());
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[GOGO] STREAM FAILED | error='{}' duration={}ms", e.getMessage(), elapsed);
            return StreamResult.failure(getName(), e.getMessage());
        }
    }

    private String followNewPlayer(String newPlayerUrl) {
        try {
            String html = fetchWithLogging(newPlayerUrl, "NEWPLAYER");
            if (html == null) return null;

            Pattern megaplayPattern = Pattern.compile("src=\"([^\"]*megaplay\\.buzz[^\"]*)\"");
            Matcher matcher = megaplayPattern.matcher(html);
            if (matcher.find()) {
                String megaplayUrl = matcher.group(1);
                log.info("[GOGO] MEGAPLAY IFRAME | url={}", megaplayUrl);
                return megaplayUrl;
            }

            log.warn("[GOGO] MEGAPLAY NOT FOUND in newplayer HTML");
            return null;
        } catch (Exception e) {
            log.warn("[GOGO] NEWPLAYER FOLLOW FAILED | error='{}'", e.getMessage());
            return null;
        }
    }
}
