package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConsumetInfoResponse {
    private String id;
    private String title;
    private String image;
    private int totalEpisodes;
    private List<ConsumetEpisode> episodes;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConsumetEpisode {
        private String id;
        private int number;
        private String title;
        private String url;
    }
}
