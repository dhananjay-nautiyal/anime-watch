package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class JikanFullAnimeData {

    @JsonProperty("mal_id")
    private int malId;

    private String title;

    @JsonProperty("title_english")
    private String titleEnglish;

    @JsonProperty("title_japanese")
    private String titleJapanese;

    @JsonProperty("title_synonyms")
    private List<String> titleSynonyms;

    private String type;
    private String status;
    private Integer year;

    @JsonProperty("season")
    private String season;

    private String duration;
    private String source;
    private String rating;
    private Double score;

    @JsonProperty("scored_by")
    private Integer scoredBy;

    @JsonProperty("rank")
    private Integer rank;

    @JsonProperty("popularity")
    private Integer popularity;

    @JsonProperty("members")
    private Integer members;

    @JsonProperty("favorites")
    private Integer favorites;

    private String synopsis;
    private String background;

    @JsonProperty("episodes")
    private Integer episodes;

    private JikanAnimeData.Aired aired;
    private JikanAnimeData.Trailer trailer;
    private JikanAnimeData.Images images;

    private String url;

    @JsonProperty("banner")
    private String banner;

    private List<JikanAnimeData.Genre> genres;
    private List<JikanAnimeData.Studio> studios;
    private List<JikanAnimeData.Producer> producers;
    private List<JikanAnimeData.Licensor> licensors;
    private List<Tag> tags;
    private List<Theme> themes;
    private List<External> external;
    private List<Streaming> streaming;
    private List<Relation> relations;

    @Data
    public static class Tag {
        private String name;
        private Integer weight;
    }

    @Data
    public static class Theme {
        private String type;
        private String text;
    }

    @Data
    public static class External {
        private String name;
        private String url;
    }

    @Data
    public static class Streaming {
        private String name;
        private String url;
    }

    @Data
    public static class Relation {
        private String relation;

        @JsonProperty("entry")
        private List<RelationEntry> entry;
    }

    @Data
    public static class RelationEntry {
        @JsonProperty("mal_id")
        private int malId;

        private String type;
        private String name;
        private String url;
    }
}
