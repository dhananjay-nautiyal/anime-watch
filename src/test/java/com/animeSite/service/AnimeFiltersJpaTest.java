package com.animeSite.service;

import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeGenre;
import com.animeSite.repo.AnimeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Exercises the database half of /api/anime/filter against a real (H2)
 * schema, since production always takes this path when Jikan is unreachable.
 *
 * Values are deliberately unique (year 1901+, type "testtype", genres 9001+)
 * so the assertions hold whether or not the offline catalogue seeded in the
 * same context.
 */
@DataJpaTest
@ActiveProfiles("dev")
class AnimeFiltersJpaTest {

    private static final int ACTION_GENRE = 9001;
    private static final int COMEDY_GENRE = 9002;

    @Autowired
    private AnimeRepository animeRepository;

    @BeforeEach
    void setUp() {
        AnimeGenre action = new AnimeGenre(java.util.UUID.randomUUID(), ACTION_GENRE, "Test Action", "anime");
        AnimeGenre comedy = new AnimeGenre(java.util.UUID.randomUUID(), COMEDY_GENRE, "Test Comedy", "anime");

        Anime airing = anime(9100, "Airing Show", "testtype", "airing", 1901, 8.0);
        airing.setAnimeGenres(List.of(action));
        Anime finished = anime(9200, "Finished Show", "testmovie", "finished", 1902, 9.0);
        finished.setAnimeGenres(List.of(comedy));
        Anime upcoming = anime(9300, "Upcoming Show", "testtype", "upcoming", 1903, 7.0);

        animeRepository.saveAll(List.of(airing, finished, upcoming));
    }

    private Anime anime(int malId, String title, String type, String status, int year, double rating) {
        Anime anime = new Anime();
        anime.setMalId(malId);
        anime.setTitle(title);
        anime.setSlug("show-" + malId);
        anime.setType(type);
        anime.setStatus(status);
        anime.setYear(year);
        anime.setRating(String.valueOf(rating));
        anime.setScore(rating);
        return anime;
    }

    private List<Anime> find(List<Integer> include, List<Integer> exclude, String type, String status, Integer year) {
        return animeRepository.findAll(
                AnimeFilters.build(include, exclude, type, status, year),
                PageRequest.of(0, 100)).getContent();
    }

    private List<String> titles(List<Anime> anime) {
        return anime.stream().map(Anime::getTitle).toList();
    }

    @Test
    void filtersByCanonicalStatus() {
        assertEquals(List.of("Airing Show"), titles(find(null, null, null, "airing", 1901)));
        assertTrue(find(null, null, null, "finished", 1901).isEmpty());
        assertEquals(List.of("Upcoming Show"), titles(find(null, null, null, "upcoming", 1903)));
    }

    @Test
    void filtersByYear() {
        assertEquals(List.of("Finished Show"), titles(find(null, null, null, null, 1902)));
        assertTrue(find(null, null, null, null, 1902).stream()
                .allMatch(a -> a.getYear() == 1902));
    }

    @Test
    void filtersByTypeIgnoringCase() {
        assertEquals(List.of("Finished Show"), titles(find(null, null, "testmovie", null, null)));
    }

    @Test
    void combinesEveryFilter() {
        assertEquals(List.of("Airing Show"), titles(find(null, null, "testtype", "airing", 1901)));
        assertTrue(find(null, null, "testtype", "finished", 1901).isEmpty());
    }

    @Test
    void filtersByGenreId() {
        assertEquals(List.of("Airing Show"), titles(find(List.of(ACTION_GENRE), null, null, null, null)));
    }

    @Test
    void excludesByGenreId() {
        assertTrue(find(null, List.of(ACTION_GENRE), null, null, 1901).isEmpty(),
                "Airing Show has the excluded genre");
        assertEquals(List.of("Finished Show"),
                titles(find(null, List.of(ACTION_GENRE), null, null, 1902)));
        assertEquals(List.of("Upcoming Show"),
                titles(find(null, List.of(ACTION_GENRE), null, null, 1903)));
    }

    @Test
    void sortsByScoreDescendingByDefault() {
        List<Anime> result = animeRepository.findAll(
                AnimeFilters.build(null, null, null, null, null),
                PageRequest.of(0, 100, AnimeFilters.sort(null, null))).getContent();

        List<String> titles = titles(result);
        int finished = titles.indexOf("Finished Show");
        int airing = titles.indexOf("Airing Show");
        int upcoming = titles.indexOf("Upcoming Show");

        assertNotEquals(-1, finished, "test rows should be present in the result");
        assertTrue(finished < airing, "9.0 should sort before 8.0");
        assertTrue(airing < upcoming, "8.0 should sort before 7.0");
    }
}
