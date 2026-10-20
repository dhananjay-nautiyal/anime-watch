package com.animeSite.persist;

import com.animeSite.repo.AnimeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The detail endpoints return the Anime entity, whose genre/studio
 * collections are @JsonIgnore'd. These projections are what /api/anime/{id}
 * and /api/anime/slug/{slug} actually expose, so assert the wire shape.
 */
@DataJpaTest
@ActiveProfiles("dev")
class AnimeRelationsSerializationTest {

    @Autowired
    private AnimeRepository animeRepository;

    @Test
    void detailJsonExposesGenresAndStudiosUnderTheExpectedKeys() throws Exception {
        AnimeGenre genre = new AnimeGenre(UUID.randomUUID(), 9001, "Test Action", "anime");
        AnimeStudio studio = new AnimeStudio(UUID.randomUUID(), 9002, "Test Studio");

        Anime anime = new Anime();
        anime.setMalId(9400);
        anime.setTitle("Relations Show");
        anime.setSlug("relations-show");
        anime.setAnimeGenres(List.of(genre));
        anime.setAnimeStudios(List.of(studio));
        animeRepository.saveAndFlush(anime);

        Anime loaded = animeRepository.findByMalId(9400).orElseThrow();
        // Mirrors AnimeServiceImpl.withRelations().
        loaded.getAnimeGenres().size();
        loaded.getAnimeStudios().size();

        JsonNode json = new ObjectMapper().findAndRegisterModules().valueToTree(loaded);

        assertTrue(json.has("genres"), "detail JSON must expose genres");
        assertEquals(1, json.get("genres").size());
        assertEquals("Test Action", json.get("genres").get(0).get("name").asText());
        assertEquals(9001, json.get("genres").get(0).get("malId").asInt());

        assertTrue(json.has("studios"), "detail JSON must expose studios");
        assertEquals(1, json.get("studios").size());
        assertEquals("Test Studio", json.get("studios").get(0).get("name").asText());
        assertEquals(9002, json.get("studios").get(0).get("malId").asInt());

        assertFalse(json.has("animeGenres"), "the raw lazy collection must stay hidden");
        assertFalse(json.has("animeStudios"), "the raw lazy collection must stay hidden");
    }

    @Test
    void omitsEmptyRelationsAsEmptyArraysRatherThanNull() {
        Anime anime = new Anime();
        anime.setMalId(9401);
        anime.setTitle("No Relations");
        anime.setSlug("no-relations");
        animeRepository.saveAndFlush(anime);

        Anime loaded = animeRepository.findByMalId(9401).orElseThrow();
        JsonNode json = new ObjectMapper().findAndRegisterModules().valueToTree(loaded);

        assertTrue(json.get("genres").isArray());
        assertEquals(0, json.get("genres").size());
        assertTrue(json.get("studios").isArray());
        assertEquals(0, json.get("studios").size());
    }
}
