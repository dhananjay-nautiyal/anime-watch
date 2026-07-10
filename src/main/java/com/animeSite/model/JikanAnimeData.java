package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class JikanAnimeData {

    @JsonProperty("mal_id")
    private int malId;

    private String title;

    @JsonProperty("title_english")
    private String titleEnglish;

    private String type;
    private String status;
    private Integer year;
    private String duration;
    private Aired aired;
    private String synopsis;
    private Double score;
    private Integer episodes;

    private Trailer trailer;
    private Images images;
    private List<Genre> genres;
    private List<Studio> studios;

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
        private Webp webp;
    }

    @Data
    public static class Jpg {
        @JsonProperty("image_url")
        private String imageUrl;

        @JsonProperty("large_image_url")
        private String largeImageUrl;
    }

    @Data
    public static class Webp {
        @JsonProperty("image_url")
        private String imageUrl;

        @JsonProperty("large_image_url")
        private String largeImageUrl;
    }

    @Data
    public static class Genre {
        @JsonProperty("mal_id")
        private int malId;
        private String name;
        private String type;
        private String url;
    }

    @Data
    public static class Studio {
        @JsonProperty("mal_id")
        private int malId;
        private String name;
        private String type;
        private String url;
    }

    @Data
    public static class Aired {
        private String from;
        private String to;

        @JsonProperty("string")
        private String airedString;
    }
}
