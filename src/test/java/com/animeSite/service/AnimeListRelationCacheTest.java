package com.animeSite.service;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.importpipeline.JikanMetadataProvider;
import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeGenre;
import com.animeSite.persist.AnimeStudio;
import com.animeSite.repo.AnimeGenreRepository;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.service.AnimeService.AnimePage;
import com.animeSite.service.impl.AnimeServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Regression for /api/anime/home returning HttpMessageNotWritableException.
 *
 * The home endpoint builds its sections on CompletableFuture threads, where
 * Open Session in View does not apply, and caches the resulting pages. If a
 * page still holds lazy genre/studio proxies when the transaction closes,
 * serializing it from the cache fails with LazyInitializationException.
 *
 * The test deliberately runs without a surrounding transaction, so a page
 * that only serializes while the session is open will fail here.
 */
@DataJpaTest
@ActiveProfiles("dev")
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AnimeListRelationCacheTest {

    @Autowired
    private AnimeRepository animeRepository;

    @Autowired
    private AnimeGenreRepository animeGenreRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void databasePagesSerializeRelationsAfterTheTransactionCloses() throws Exception {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            AnimeGenre genre = new AnimeGenre(UUID.randomUUID(), 9501, "Cached Action", "anime");
            AnimeStudio studio = new AnimeStudio(UUID.randomUUID(), 9502, "Cached Studio");

            Anime anime = new Anime();
            anime.setMalId(9500);
            anime.setTitle("Cached Relations Show");
            anime.setSlug("cached-relations-show");
            anime.setRating("8.5");
            anime.setScore(8.5);
            anime.setAnimeGenres(List.of(genre));
            anime.setAnimeStudios(List.of(studio));
            animeRepository.saveAndFlush(anime);
        });

        JikanApiClient jikan = mock(JikanApiClient.class);
        when(jikan.fetchTopAnime(anyInt(), anyInt())).thenThrow(new RuntimeException("offline"));

        AnimeServiceImpl service = new AnimeServiceImpl(jikan, animeRepository, animeGenreRepository,
                mock(SlugService.class), mock(JikanMetadataProvider.class), transactionManager);

        AnimePage page = service.getTrending(0, 10);

        assertTrue(page.animeList().stream().anyMatch(a -> a.getMalId() == 9500));

        JsonNode json = new ObjectMapper().findAndRegisterModules().valueToTree(page);
        JsonNode entry = json.get("animeList").get(0);
        assertEquals(1, entry.get("genres").size());
        assertEquals("Cached Action", entry.get("genres").get(0).get("name").asText());
        assertEquals(1, entry.get("studios").size());
        assertEquals("Cached Studio", entry.get("studios").get(0).get("name").asText());
    }
}
