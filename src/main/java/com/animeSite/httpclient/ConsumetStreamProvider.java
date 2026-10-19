package com.animeSite.httpclient;

import com.animeSite.model.ConsumetResolveResponse;
import com.animeSite.model.ConsumetWatchResponse;
import com.animeSite.persist.Episode;
import com.animeSite.pipeline.StreamProvider;
import com.animeSite.pipeline.StreamResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * HiAnime via the self-hosted Consumet bridge. Episode embed URLs use the
 * "consumet:" scheme so stream resolution routes back here.
 */
@Component
public class ConsumetStreamProvider implements StreamProvider {

    private static final Logger log = LoggerFactory.getLogger(ConsumetStreamProvider.class);
    private static final String PREFIX = "consumet:";

    private final ConsumetApiClient client;

    public ConsumetStreamProvider(ConsumetApiClient client) {
        this.client = client;
    }

    @Override
    public String getName() { return "Consumet"; }

    @Override
    public boolean healthCheck() {
        // A blank CONSUMET_BASE_URL means the bridge is intentionally off, not
        // broken — but it can serve no episodes either way.
        return client.isConfigured();
    }

    @Override
    public boolean validate(String episodeUrl) {
        return episodeUrl != null && !episodeUrl.isBlank();
    }

    @Override
    public List<Episode> fetchEpisodes(int malId, String title) {
        List<Episode> out = new ArrayList<>();
        try {
            if (!client.isConfigured()) return out;
            // One atomic bridge call: tries hianime -> animekai -> animepahe.
            ConsumetResolveResponse resolved = client.resolve(title);
            if (resolved == null || resolved.getEpisodes() == null || resolved.getEpisodes().isEmpty()) {
                log.info("[CONSUMET] NO_MATCH | malId={} title='{}'", malId, title);
                return out;
            }
            int n = 0;
            for (ConsumetResolveResponse.ConsumetEpisode e : resolved.getEpisodes()) {
                if (e.getId() == null || e.getId().isBlank()) continue;
                n++;
                Episode ep = new Episode();
                ep.setAnimeMalId(malId);
                ep.setEpisodeNumber(e.getNumber() > 0 ? e.getNumber() : n);
                ep.setTitle(e.getTitle() != null && !e.getTitle().isBlank()
                        ? e.getTitle() : "Episode " + ep.getEpisodeNumber());
                ep.setEmbedUrl(PREFIX + e.getId());
                out.add(ep);
            }
            log.info("[CONSUMET] EPISODES | malId={} provider={} count={}", malId, resolved.getProvider(), out.size());
        } catch (Exception e) {
            log.warn("[CONSUMET] FETCH_FAILED | malId={} error='{}'", malId, e.getMessage());
        }
        return out;
    }

    @Override
    public StreamResult resolveStream(String episodePageUrl) {
        if (episodePageUrl == null || !episodePageUrl.startsWith(PREFIX)) {
            return StreamResult.failure(getName(), "Not a Consumet URL");
        }
        String episodeId = episodePageUrl.substring(PREFIX.length());
        try {
            ConsumetWatchResponse watch = client.watch(episodeId, "", "sub");
            if (watch == null || watch.getSources() == null || watch.getSources().isEmpty()) {
                return StreamResult.failure(getName(), "No sources for episode");
            }
            String referer = watch.getHeaders() != null
                    ? watch.getHeaders().getOrDefault("Referer", watch.getHeaders().get("referer"))
                    : null;
            List<StreamResult.ServerOption> servers = new ArrayList<>();
            watch.getSources().stream()
                    .sorted(Comparator.comparing((ConsumetWatchResponse.ConsumetSource s) -> !s.isM3U8())
                            .thenComparing(s -> s.getQuality() == null ? "" : s.getQuality()))
                    .forEach(s -> servers.add(new StreamResult.ServerOption(
                            s.getUrl(),
                            (s.getQuality() != null ? s.getQuality() : "auto") + (s.isM3U8() ? " (hls)" : ""),
                            referer)));
            log.info("[CONSUMET] STREAM | ep='{}' servers={}", episodeId, servers.size());
            return StreamResult.success(getName(), "hls", servers);
        } catch (Exception e) {
            log.warn("[CONSUMET] STREAM_FAILED | ep='{}' error='{}'", episodeId, e.getMessage());
            return StreamResult.failure(getName(), "Consumet watch failed: " + e.getMessage());
        }
    }
}
