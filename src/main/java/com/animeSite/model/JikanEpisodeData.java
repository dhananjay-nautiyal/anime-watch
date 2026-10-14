package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class JikanEpisodeData {

    private String title;

    @JsonProperty("title_japanese")
    private String titleJapanese;

    private String aired;

    private Double score;

    private boolean filler;

    private boolean recap;
}
