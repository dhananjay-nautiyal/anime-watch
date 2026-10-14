package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConsumetSearchResponse {
    private List<ConsumetSearchResult> results;
    private int currentPage;
    private boolean hasNextPage;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConsumetSearchResult {
        private String id;
        private String title;
        private String url;
        private String image;
    }
}
