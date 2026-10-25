package com.animeSite.service.impl;

import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeGenre;
import com.animeSite.persist.AnimeStudio;
import com.animeSite.repo.AnimeGenreRepository;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.AnimeStudioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * The offline catalogue ships no synopsis and, on an older seed, no sidebar
 * metadata either; the enricher is what puts those on the detail page. It must
 * read the synopsis (the field the UI renders as "No synopsis available.")
 * and must not give up on a title for the rest of the JVM after one failed
 * fetch.
 */
@ExtendWith(MockitoExtension.class)
class AnimeMetadataEnricherTest {

    private static final String DETAIL_HTML = """
        <div class="spaceit_pad"><span class="dark_text">Type:</span> TV</div>
        <div class="spaceit_pad"><span class="dark_text">Episodes:</span> 12</div>
        <div class="spaceit_pad"><span class="dark_text">Status:</span> Finished Airing</div>
        <div class="spaceit_pad"><span class="dark_text">Aired:</span> Oct 4, 2026 to Dec 20, 2026</div>
        <div class="spaceit_pad"><span class="dark_text">Duration:</span> 24 min. per ep.</div>
        <div class="spaceit_pad"><span class="dark_text">Source:</span> Manga</div>
        <div class="spaceit_pad"><span class="dark_text">Rating:</span> PG-13 - Teens 13 or older</div>
        <div class="spaceit_pad"><span class="dark_text">Studios:</span> <a href="/anime/producer/18/Toei_Animation">Toei Animation</a></div>
        <div class="spaceit_pad"><span class="dark_text">Members:</span> 1,234,567</div>
        <div class="spaceit_pad"><span class="dark_text">Popularity:</span> #17 of 23,000</div>
        <div class="spaceit_pad"><span class="dark_text">Favorites:</span> 9,876</div>
        <div class="spaceit_pad"><span class="dark_text">Ranked:</span> #62 of 23,000</div>
        <div class="spaceit_pad"><span class="dark_text">Score:</span> 8.73 (1,000 users)</div>
        <div><h2 id="synopsis">Synopsis</h2></div>
        <p itemprop="description">Luffy sets out to sea.<br />
<br />
He is not to be underestimated &amp; never gives up.</p>
        """;

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private AnimeRepository animeRepository;

    @Mock
    private AnimeGenreRepository genreRepository;

    @Mock
    private AnimeStudioRepository studioRepository;

    private ConcurrentMapCacheManager cacheManager;

    private AnimeMetadataEnricher enricher;

    @BeforeEach
    void setUp() {
        cacheManager = new ConcurrentMapCacheManager("anime");
        enricher = new AnimeMetadataEnricher(restTemplate, animeRepository,
                genreRepository, studioRepository, cacheManager);
    }

    private Anime seededAnime() {
        Anime anime = new Anime();
        anime.setMalId(21);
        anime.setTitle("One Piece");
        anime.setType("TV");
        anime.setScore(8.73);
        anime.setStatus("airing");
        anime.setYear(1999);
        anime.setSeason("fall");
        return anime;
    }

    @Test
    void fillsSynopsisAndSidebarMetadataFromTheDetailPage() {
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(DETAIL_HTML);
        when(studioRepository.findByNameIgnoreCase("Toei Animation")).thenReturn(Optional.empty());
        when(studioRepository.save(any(AnimeStudio.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(animeRepository.save(any(Anime.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Anime anime = seededAnime();
        assertTrue(enricher.needsEnrichment(anime), "a catalogue row without detail fields needs enriching");

        enricher.enrich(anime);

        assertEquals("Luffy sets out to sea.\n\nHe is not to be underestimated & never gives up.",
                anime.getSynopsis(), "the detail page synopsis must be stored, not left null");
        assertEquals("24 min. per ep.", anime.getDuration());
        assertEquals("Manga", anime.getSource());
        assertEquals("Oct 4, 2026 to Dec 20, 2026", anime.getAired());
        assertEquals("PG-13 - Teens 13 or older", anime.getRating());
        assertEquals(1_234_567, anime.getMembers());
        assertEquals(17, anime.getPopularity());
        assertEquals(9_876, anime.getFavorites());
        assertEquals(62, anime.getRank());
        assertEquals(12, anime.getEpisodes());
        assertEquals("finished", anime.getStatus(), "MAL status is stored in the canonical vocabulary");
        assertEquals(1, anime.getAnimeStudios().size());
        assertEquals("Toei Animation", anime.getAnimeStudios().get(0).getName());
        verify(animeRepository).save(anime);
    }

    @Test
    void stillNeedsEnrichmentWhenOnlyTheSynopsisIsMissing() {
        Anime anime = seededAnime();
        anime.setDuration("24 min.");
        anime.setAired("Oct 20, 1999 to ?");
        anime.setSource("Manga");
        anime.setMembers(1);
        anime.setPopularity(1);
        anime.setFavorites(1);
        anime.getAnimeStudios().add(new AnimeStudio(java.util.UUID.randomUUID(), 18, "Toei Animation"));
        anime.getAnimeGenres().add(new AnimeGenre(java.util.UUID.randomUUID(), 1, "Action", "anime"));
        anime.setSynopsis("Monkey D. Luffy sets off on an adventure.");

        assertFalse(enricher.needsEnrichment(anime), "a complete record must not be fetched again");

        anime.setSynopsis(null);
        assertTrue(enricher.needsEnrichment(anime), "a row without a synopsis must go back for one");

        anime.setSynopsis("Monkey D. Luffy sets off on an adventure.");
        anime.getAnimeGenres().clear();
        assertTrue(enricher.needsEnrichment(anime),
                "the catalogue ships no genres, so the detail view must keep backfilling them");
    }

    @Test
    void neverStoresMyAnimeListPlaceholderTextAsValues() {
        String html = """
            <div class="spaceit_pad"><span class="dark_text">Studios:</span> None found, add some</div>
            <div class="spaceit_pad"><span class="dark_text">Rating:</span> None</div>
            <div class="spaceit_pad"><span class="dark_text">Duration:</span> Unknown</div>
            <div><h2 id="synopsis">Synopsis</h2></div>
            <p itemprop="description">No synopsis information has been added to this title. \
            Help improve our database by adding synopsis information here.</p>
            """;
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(html);

        Anime anime = seededAnime();
        enricher.enrich(anime);

        assertNull(anime.getSynopsis(), "MAL's 'no synopsis' boilerplate is not a synopsis");
        assertNull(anime.getRating(), "'None' is MAL's stand-in for an unrated title");
        assertNull(anime.getDuration(), "'Unknown' is not a duration");
        assertTrue(anime.getAnimeStudios().isEmpty(),
                "'None found, add some' is one label, not two studio names");
        verify(animeRepository, never()).save(any(Anime.class));
    }

    @Test
    void retriesAFailedFetchInsteadOfGivingUpForTheRestOfTheJvm() {
        when(restTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("network down"));

        Anime anime = seededAnime();
        enricher.enrich(anime);
        assertNull(anime.getSynopsis());
        verify(restTemplate, times(1)).getForObject(anyString(), eq(String.class));

        // Within the retry window the title is not hammered.
        enricher.enrich(anime);
        verify(restTemplate, times(1)).getForObject(anyString(), eq(String.class));
        verify(animeRepository, never()).save(any(Anime.class));

        // Once the window has passed the attempt is made again, so a transient
        // outage does not leave the row blank for the rest of the process.
        @SuppressWarnings("unchecked")
        java.util.Map<Integer, Long> attempts =
                (java.util.Map<Integer, Long>) ReflectionTestUtils.getField(enricher, "lastAttempt");
        assertNotNull(attempts);
        attempts.clear();
        enricher.enrich(anime);
        verify(restTemplate, times(2)).getForObject(anyString(), eq(String.class));
    }

    @Test
    void evictsBothDetailCacheKeysAfterASuccessfulSave() {
        // The entry cached under the *other* key (id vs slug) would otherwise
        // keep serving the pre-enrichment row for up to an hour, since the
        // request that triggered this enrichment only refreshes its own key.
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(DETAIL_HTML);
        when(studioRepository.findByNameIgnoreCase("Toei Animation")).thenReturn(Optional.empty());
        when(studioRepository.save(any(AnimeStudio.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(animeRepository.save(any(Anime.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Anime anime = seededAnime();
        anime.setSlug("one-piece");
        cacheManager.getCache("anime").put("id-21", "pre-enrichment row");
        cacheManager.getCache("anime").put("slug-one-piece", "pre-enrichment row");

        enricher.enrich(anime);

        assertNull(cacheManager.getCache("anime").get("id-21"),
                "the id entry must not keep serving pre-enrichment data");
        assertNull(cacheManager.getCache("anime").get("slug-one-piece"),
                "the sibling slug entry must be evicted too");
    }

    @Test
    void leavesTheDetailCacheAloneWhenNothingChanged() {
        String html = """
            <div class="spaceit_pad"><span class="dark_text">Studios:</span> None found, add some</div>
            <div class="spaceit_pad"><span class="dark_text">Rating:</span> None</div>
            <div><h2 id="synopsis">Synopsis</h2></div>
            <p itemprop="description">No synopsis information has been added to this title. \
            Help improve our database by adding synopsis information here.</p>
            """;
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(html);

        Anime anime = seededAnime();
        anime.setSlug("one-piece");
        cacheManager.getCache("anime").put("id-21", "current row");
        cacheManager.getCache("anime").put("slug-one-piece", "current row");

        enricher.enrich(anime);

        assertNotNull(cacheManager.getCache("anime").get("id-21"),
                "an attempt that wrote nothing must not throw away a valid entry");
        assertNotNull(cacheManager.getCache("anime").get("slug-one-piece"));
        verify(animeRepository, never()).save(any(Anime.class));
    }
}
