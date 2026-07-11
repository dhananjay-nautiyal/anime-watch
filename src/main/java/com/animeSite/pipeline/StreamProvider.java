package com.animeSite.pipeline;

import com.animeSite.persist.Episode;

import java.util.List;

public interface StreamProvider {
    String getName();
    List<Episode> fetchEpisodes(int malId, String title);
    StreamResult resolveStream(String episodePageUrl);
    default List<Episode> search(int malId, String title) {
        return fetchEpisodes(malId, title);
    }
    default boolean healthCheck() {
        return true;
    }
    default boolean validate(String episodeUrl) {
        return episodeUrl != null && !episodeUrl.isBlank() && episodeUrl.startsWith("http");
    }
}
