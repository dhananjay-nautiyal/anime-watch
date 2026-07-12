package com.animeSite.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class JikanCharactersResponse {

    private List<CharacterData> data;

    @Data
    public static class CharacterData {
        @JsonProperty("character")
        private CharacterInfo character;

        private String role;

        @JsonProperty("voice_actors")
        private List<VoiceActor> voiceActors;

        @Data
        public static class CharacterInfo {
            @JsonProperty("mal_id")
            private int malId;

            private String name;

            @JsonProperty("images")
            private JikanAnimeData.Images images;
        }

        @Data
        public static class VoiceActor {
            @JsonProperty("person")
            private PersonInfo person;

            private String language;

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
}
