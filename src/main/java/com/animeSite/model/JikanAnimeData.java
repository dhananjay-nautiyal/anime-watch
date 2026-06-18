package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class JikanAnimeData {

    @JsonProperty("mal_id")
    private int malId;

    private String title;
    private String synopsis;
    private Double score;
    private Integer episodes;

    private Trailer trailer;
    private Images images;

    @Data
    public static class Trailer {
        private String url;

        @JsonProperty("youtube_id")
        private String youtubeId;

        @JsonProperty("embed_url")
        private String embedUrl;
    }

    @Data
    public static class Images {
        private Jpg jpg;
    }

    @Data
    public static class Jpg {
        @JsonProperty("image_url")
        private String imageUrl;

        @JsonProperty("large_image_url")
        private String largeImageUrl;
    }
}
