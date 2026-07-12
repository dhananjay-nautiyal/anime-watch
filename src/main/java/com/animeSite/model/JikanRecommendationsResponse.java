package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class JikanRecommendationsResponse {

    private List<RecommendationData> data;

    @Data
    public static class RecommendationData {
        @JsonProperty("entry")
        private Entry entry;

        private String url;
        private Integer votes;

        @Data
        public static class Entry {
            @JsonProperty("mal_id")
            private int malId;

            private String title;
            private String type;
            private String url;

            @JsonProperty("images")
            private JikanAnimeData.Images images;
        }
    }
}
