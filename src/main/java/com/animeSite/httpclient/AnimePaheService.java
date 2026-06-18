package com.animeSite.httpclient;

import com.animeSite.persist.Episode;
import com.animeSite.repo.EpisodeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@Service
public class AnimePaheService {

    private static final String BASE_URL = "https://animepahe.ru";

    private final EpisodeRepository episodeRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public AnimePaheService(EpisodeRepository episodeRepository, RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.episodeRepository = episodeRepository;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public Integer searchAnime(String title) {
        try {
            String searchUrl = BASE_URL + "/api?m=search&q=" + URLEncoder.encode(title, StandardCharsets.UTF_8);
            String json = restTemplate.getForObject(searchUrl, String.class);
            if (json == null) return null;

            JsonNode root = objectMapper.readTree(json);
            JsonNode data = root.get("data");
            if (data == null || !data.isArray() || data.isEmpty()) return null;

            String lowerTitle = title.toLowerCase();
            for (JsonNode node : data) {
                String nodeTitle = node.get("title").asText("");
                if (nodeTitle.toLowerCase().contains(lowerTitle) || lowerTitle.contains(nodeTitle.toLowerCase())) {
                    return node.get("id").asInt();
                }
            }

            return data.get(0).get("id").asInt();
        } catch (Exception e) {
            return null;
        }
    }

    public List<Episode> fetchEpisodes(Integer animePaheId, Integer animeMalId) {
        List<Episode> episodes = new ArrayList<>();
        try {
            int page = 1;
            boolean hasMore = true;

            while (hasMore) {
                String url = BASE_URL + "/api?m=episodes&id=" + animePaheId
                        + "&sort=ep_asc&page=" + page + "&per_page=100";
                String json = restTemplate.getForObject(url, String.class);
                if (json == null) break;

                JsonNode root = objectMapper.readTree(json);
                JsonNode data = root.get("data");
                if (data == null || !data.isArray() || data.isEmpty()) break;

                String sessionBase = animePaheId + "/";
                for (JsonNode node : data) {
                    int epNum = node.get("episode").asInt();
                    String session = node.get("session").asText();

                    Episode ep = new Episode();
                    ep.setAnimeMalId(animeMalId);
                    ep.setEpisodeNumber(epNum);
                    ep.setTitle(node.has("title") && !node.get("title").isNull()
                            ? node.get("title").asText() : "Episode " + epNum);
                    ep.setEmbedUrl(BASE_URL + "/play/" + sessionBase + session);
                    episodes.add(ep);
                }

                int lastPage = root.get("last_page").asInt();
                if (page >= lastPage) hasMore = false;
                page++;
            }
        } catch (Exception ignored) {}

        if (episodes.isEmpty()) {
            for (int i = 1; i <= 12; i++) {
                Episode ep = new Episode();
                ep.setAnimeMalId(animeMalId);
                ep.setEpisodeNumber(i);
                ep.setTitle("Episode " + i);
                ep.setEmbedUrl(BASE_URL + "/play/" + animePaheId + "/" + i);
                episodes.add(ep);
            }
        }

        return episodes;
    }

    public List<Episode> syncEpisodes(Integer animePaheId, Integer animeMalId) {
        episodeRepository.deleteByAnimeMalId(animeMalId);
        List<Episode> episodes = fetchEpisodes(animePaheId, animeMalId);
        return episodeRepository.saveAll(episodes);
    }

    public String fetchPlayPage(Integer animePaheId, String session) {
        try {
            String url = BASE_URL + "/play/" + animePaheId + "/" + session;
            return restTemplate.getForObject(url, String.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch play page: " + e.getMessage());
        }
    }

    public String fetchPage(String url) {
        try {
            return restTemplate.getForObject(url, String.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch page: " + e.getMessage());
        }
    }
}
