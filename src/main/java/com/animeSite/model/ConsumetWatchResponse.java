package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConsumetWatchResponse {
    private Map<String, String> headers;
    private List<ConsumetSource> sources;
    private String download;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConsumetSource {
        private String url;
        private String quality;
        private boolean isM3U8;
    }
}
