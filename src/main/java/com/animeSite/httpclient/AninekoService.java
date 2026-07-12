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
public class AninekoService implements StreamProvider {

    private static final Logger log = LoggerFactory.getLogger(AninekoService.class);
    private static final String BASE_URL = "https://anineko.to";
    private static final String JIKAN_BASE = "https://api.jikan.moe/v4";
    private static final int MAX_RETRIES = 3;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final RetryEngine retryEngine;

    public AninekoService(@Qualifier("aninekoRestTemplate") RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.retryEngine = RetryEngine.builder()
            .maxRetries(MAX_RETRIES)
            .baseDelayMs(1000)
            .maxDelayMs(4000)
            .jitterMs(200)
            .circuitBreaker(new CircuitBreaker("Anineko", 5, java.time.Duration.ofSeconds(30)))
            .build();
    }

    @Override
    public String getName() { return "Anineko"; }

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
                log.info("[ANINEKO] {} | url={} status={} bodyLength={} preview='{}' duration={}ms",
                    context, url, status, body.length(),
                    body.substring(0, Math.min(200, body.length())).replace('\n', ' ').replace('\r', ' '),
                    elapsed);
            } else {
                log.warn("[ANINEKO] {} | url={} status={} body=null duration={}ms", context, url, status, elapsed);
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

            log.warn("[ANINEKO] {} FAILED | url={} status={} body='{}' duration={}ms",
                context, url, statusCode,
                respBody != null ? respBody.substring(0, Math.min(200, respBody.length())).replace('\n', ' ').replace('\r', ' ') : "null",
                elapsed);

            String rootCause = ProviderDiagnostics.detectRootCause(statusCode, respBody, url);
            diag.setRootCause(rootCause);

            if (statusCode == 400) {
                log.warn("[ANINEKO] HTTP 400 DETECTED | url={} cause={} body='{}'", url, rootCause,
                    respBody != null ? respBody.substring(0, Math.min(500, respBody.length())) : "null");
                throw new ProviderException(getName(), "HTTP_400_" + rootCause,
                    "HTTP 400 from Anineko: " + rootCause + " (" + (respBody != null ? respBody.substring(0, Math.min(100, respBody.length())) : "no body") + ")",
                    statusCode, diag, "FETCH");
            }

            if ((statusCode == 429 || statusCode >= 500) && retryCount < MAX_RETRIES) {
                long backoff = (long) Math.pow(2, retryCount) * 1000;
                log.info("[ANINEKO] RETRY {}/{} after {}ms", retryCount + 1, MAX_RETRIES, backoff);
                try { Thread.sleep(backoff); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                return fetchWithLogging(url, context, retryCount + 1);
            }

            if (statusCode == 429) {
                throw new ProviderException(getName(), "RATE_LIMIT", "Rate limited by Anineko", statusCode, diag, "FETCH");
            }

            return null;

        } catch (HttpServerErrorException e) {
            long elapsed = System.currentTimeMillis() - t;
            int statusCode = e.getStatusCode().value();
            diag.withStatus(statusCode, elapsed);
            diag.withError(e.getMessage());
            diag.setRootCause("SERVER_ERROR");

            log.warn("[ANINEKO] {} FAILED | url={} status={} duration={}ms", context, url, statusCode, elapsed);
            if (retryCount < MAX_RETRIES) {
                long backoff = (long) Math.pow(2, retryCount) * 1000;
                log.info("[ANINEKO] RETRY {}/{} after {}ms", retryCount + 1, MAX_RETRIES, backoff);
                try { Thread.sleep(backoff); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                return fetchWithLogging(url, context, retryCount + 1);
            }
            throw new ProviderException(getName(), "SERVER_ERROR", "Anineko server error: " + statusCode, statusCode, diag, "FETCH");

        } catch (ProviderException e) {
            throw e;

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - t;
            diag.withStatus(0, elapsed);
            diag.withError(e.getMessage());
            diag.setRootCause("NETWORK_ERROR");

            log.warn("[ANINEKO] {} FAILED | url={} error='{}' duration={}ms", context, url, e.getMessage(), elapsed);
            if (retryCount < MAX_RETRIES) {
                long backoff = (long) Math.pow(2, retryCount) * 1000;
                log.info("[ANINEKO] RETRY {}/{} after {}ms", retryCount + 1, MAX_RETRIES, backoff);
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
            log.warn("[ANINEKO] JIKAN FETCH FAILED | malId={} error='{}'", malId, e.getMessage());
            return null;
        }
    }

    @Override
    public List<Episode> fetchEpisodes(int malId, String title) {
        long start = System.currentTimeMillis();
        log.info("[ANINEKO] FETCH EPISODES | title='{}' malId={}", title, malId);

        JsonNode jikanData = fetchJikanData(malId);
        List<String> allSlugs = TitleNormalizer.collectAllSlugs(jikanData, title);

        log.info("[ANINEKO] GENERATED SLUGS | count={} slugs={}", allSlugs.size(), allSlugs);

        for (String slug : allSlugs) {
            if (slug == null || slug.isBlank() || slug.length() < 2) continue;
            String url = BASE_URL + "/watch/" + slug;
            log.info("[ANINEKO] TRY SLUG | slug='{}' url={}", slug, url);

            try {
                String html = fetchWithLogging(url, "SLUG=" + slug);
                if (html == null) continue;

                if (html.contains("data-video=") || html.contains("/ep-")) {
                    if (!verifyPageTitle(html, jikanData, title, slug)) {
                        log.warn("[ANINEKO] PAGE TITLE MISMATCH | slug='{}' — skipping, likely wrong anime", slug);
                        continue;
                    }
                    List<Episode> episodes = parseEpisodesFromHtml(html, slug, malId);
                    if (!episodes.isEmpty()) {
                        episodes.sort(Comparator.comparingInt(Episode::getEpisodeNumber));
                        long elapsed = System.currentTimeMillis() - start;
                        log.info("[ANINEKO] SUCCESS | slug='{}' count={} duration={}ms", slug, episodes.size(), elapsed);
                        return episodes;
                    }
                }
            } catch (ProviderException e) {
                log.warn("[ANINEKO] SLUG FAILED | slug='{}' errorCode={} message='{}'", slug, e.getErrorCode(), e.getMessage());
                if ("HTTP_400_INVALID_ID".equals(e.getErrorCode())) {
                    log.warn("[ANINEKO] INVALID ID FOR SLUG | slug='{}' — skipping remaining slugs, trying search", slug);
                    break;
                }
                continue;
            }
        }

        log.warn("[ANINEKO] ALL SLUGS FAILED | trying search...");
        List<Episode> searchResult = trySearch(malId, title, jikanData);
        if (!searchResult.isEmpty()) {
            long elapsed = System.currentTimeMillis() - start;
            log.info("[ANINEKO] SEARCH SUCCESS | count={} duration={}ms", searchResult.size(), elapsed);
            return searchResult;
        }

        long elapsed = System.currentTimeMillis() - start;
        log.warn("[ANINEKO] ALL ATTEMPTS FAILED | title='{}' malId={} duration={}ms", title, malId, elapsed);
        return List.of();
    }

    private boolean verifyPageTitle(String html, JsonNode jikanData, String primaryTitle, String slug) {
        if (html == null) return false;
        String pageTitle = TitleNormalizer.extractPageTitle(html);
        if (pageTitle.isEmpty()) {
            log.warn("[ANINEKO] PAGE TITLE EMPTY | slug='{}' — cannot verify", slug);
            // If slug is very specific (contains year), trust the slug
            return slug.matches(".*(?:19[0-9]{2}|20[0-9]{2}).*");
        }

        log.info("[ANINEKO] PAGE TITLE | slug='{}' pageTitle='{}'", slug, pageTitle);

        // Collect all known titles from Jikan data
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
            // Check if the known title appears in the page title
            if (pageLower.contains(known)) {
                return true;
            }
            // Also check normalized forms
            String normKnown = TitleNormalizer.normalize(known).toLowerCase();
            if (normKnown.length() > 3 && pageLower.contains(normKnown)) {
                return true;
            }
            // Check if page title contains any token from known title (for short/common names)
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
            if (matchCount >= Math.min(knownTokens.length, 3)) {
                return true;
            }
        }

        log.warn("[ANINEKO] PAGE TITLE VERIFICATION FAILED | slug='{}' pageTitle='{}' knownTitles={}", slug, pageTitle, knownTitles);
        return false;
    }

    private List<Episode> parseEpisodesFromHtml(String html, String slug, int malId) {
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
                    String url = BASE_URL + "/watch/" + foundSlug;
                    String html = fetchWithLogging(url, "SEARCH_HIT=" + foundSlug);
                    if (html != null) {
                        List<Episode> episodes = parseEpisodesFromHtml(html, foundSlug, malId);
                        if (!episodes.isEmpty()) return episodes;
                    }
                }
            } catch (ProviderException e) {
                log.warn("[ANINEKO] SEARCH TERM FAILED | term='{}' error='{}'", term, e.getMessage());
            }
        }
        return List.of();
    }

    private String searchSingle(String title) {
        try {
            String keywords = java.net.URLEncoder.encode(title, "UTF-8");
            String searchUrl = BASE_URL + "/browse?keyword=" + keywords + "&page=1";
            log.info("[ANINEKO] SEARCH | title='{}' url={}", title, searchUrl);
            String html = fetchWithLogging(searchUrl, "SEARCH");
            if (html == null) return null;

            Set<String> candidates = new LinkedHashSet<>();
            Pattern linkPattern = Pattern.compile("/watch/([a-z0-9-]+)");
            Matcher matcher = linkPattern.matcher(html);

            while (matcher.find()) {
                String slug = matcher.group(1);
                candidates.add(slug);
            }

            AnimeMatcher.ScoredMatch best = AnimeMatcher.findBestMatch(title, null, new ArrayList<>(candidates));
            if (best != null && best.confidence >= 0.8) {
                log.info("[ANINEKO] SEARCH BEST MATCH | slug='{}' confidence={}", best.slug, best.confidence);
                return best.slug;
            }

            log.warn("[ANINEKO] SEARCH NO MATCH | title='{}' bestConfidence={} candidates={}", title, best != null ? best.confidence : 0, candidates);
            return null;
        } catch (Exception e) {
            log.warn("[ANINEKO] SEARCH FAILED | error='{}'", e.getMessage());
            return null;
        }
    }

    @Override
    public StreamResult resolveStream(String episodePageUrl) {
        long start = System.currentTimeMillis();
        log.info("[ANINEKO] RESOLVE STREAM | url={}", episodePageUrl);

        if (episodePageUrl == null || !episodePageUrl.startsWith(BASE_URL)) {
            log.warn("[ANINEKO] SKIP — not an Anineko URL | url={}", episodePageUrl);
            return StreamResult.failure(getName(), "Not an Anineko URL");
        }

        try {
            String html = fetchWithLogging(episodePageUrl, "STREAM");
            if (html == null) {
                return StreamResult.failure(getName(), "null response after fetch");
            }

            List<StreamResult.ServerOption> servers = new ArrayList<>();
            List<String> embedUrls = new ArrayList<>();
            Pattern pattern = Pattern.compile("data-video=\"([^\"]+)\"");
            Matcher matcher = pattern.matcher(html);
            while (matcher.find()) {
                String vu = matcher.group(1);
                if (!embedUrls.contains(vu)) embedUrls.add(vu);
            }

            if (embedUrls.isEmpty()) {
                log.warn("[ANINEKO] STREAM FAILED | no data-video found");
                return StreamResult.failure(getName(), "No video sources found on episode page");
            }

            int hlsExtracted = 0;
            for (int i = 0; i < embedUrls.size(); i++) {
                String embedPageUrl = embedUrls.get(i);
                boolean isBackup = i > 0;
                log.info("[ANINEKO] TRY EMBED SERVER {} | url={} | backup={}", i + 1, embedPageUrl, isBackup);

                // Only try HLS extraction for first 3 embed servers to avoid timeout
                if (hlsExtracted < 3 && (embedPageUrl.contains("vivibebe.site") || embedPageUrl.contains("otakuhg.site") || embedPageUrl.contains("otakuvid.online"))) {
                    try {
                        String directVideo = extractDirectUrl(embedPageUrl);
                        if (directVideo != null) {
                            servers.add(new StreamResult.ServerOption(directVideo, "Server" + (i + 1) + "-HLS", isBackup));
                            hlsExtracted++;
                        }
                    } catch (ProviderException e) {
                        log.warn("[ANINEKO] EMBED SERVER {} FAILED | url={} error='{}'", i + 1, embedPageUrl, e.getMessage());
                    }
                }
                servers.add(new StreamResult.ServerOption(embedPageUrl, "Server" + (i + 1) + "-Embed", isBackup));
            }

            if (servers.isEmpty()) {
                return StreamResult.failure(getName(), "No stream servers found");
            }

            String streamType = servers.get(0).url.contains(".m3u8") ? "hls" : "iframe";
            log.info("[ANINEKO] STREAM RESOLVED | type={} servers={} duration={}ms",
                streamType, servers.size(), System.currentTimeMillis() - start);
            return StreamResult.success(getName(), streamType, servers);

        } catch (ProviderException e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[ANINEKO] STREAM FAILED | errorCode={} error='{}' duration={}ms", e.getErrorCode(), e.getMessage(), elapsed);
            return StreamResult.failure(getName(), e.getErrorCode() + ": " + e.getMessage());
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("[ANINEKO] STREAM FAILED | error='{}' duration={}ms", e.getMessage(), elapsed);
            return StreamResult.failure(getName(), e.getMessage());
        }
    }

    private String extractDirectUrl(String embedPageUrl) {
        try {
            log.info("[ANINEKO] EXTRACT HLS DIRECT | url={}", embedPageUrl);
            String html = fetchWithLogging(embedPageUrl, "HLS_EXTRACT");
            if (html == null) return null;

            Pattern srcPattern = Pattern.compile("const\\s+src\\s*=\\s*\"([^\"]+\\.m3u8[^\"]*)\"");
            Matcher matcher = srcPattern.matcher(html);
            if (matcher.find()) {
                String directUrl = matcher.group(1);
                log.info("[ANINEKO] HLS FOUND | url={}", directUrl);
                return directUrl;
            }

            log.warn("[ANINEKO] HLS NOT FOUND in embed page");
            return null;
        } catch (Exception e) {
            log.warn("[ANINEKO] HLS EXTRACT ERROR | error='{}'", e.getMessage());
            return null;
        }
    }
}
