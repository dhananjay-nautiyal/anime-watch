package com.animeSite.model;

import lombok.Data;
import java.util.List;

@Data
public class JikanExternalResponse {

    private List<ExternalData> data;

    @Data
    public static class ExternalData {
        private String name;
        private String url;
    }
}
