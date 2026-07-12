package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class JikanStaffResponse {

    private List<StaffData> data;

    @Data
    public static class StaffData {
        @JsonProperty("person")
        private PersonInfo person;

        private List<String> positions;

        @Data
        public static class PersonInfo {
            @JsonProperty("mal_id")
            private int malId;

            private String name;

            @JsonProperty("images")
            private JikanAnimeData.Images images;
        }
    }
}
