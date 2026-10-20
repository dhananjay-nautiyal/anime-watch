package com.animeSite.constant;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AnimeStatusTest {

    @ParameterizedTest
    @CsvSource({
            "FINISHED, finished",
            "Finished Airing, finished",
            "complete, finished",
            "ONGOING, airing",
            "Currently Airing, airing",
            "airing, airing",
            "UPCOMING, upcoming",
            "Not yet aired, upcoming",
            "upcoming, upcoming"
    })
    void normalizesEveryVocabularyToTheCanonicalValue(String raw, String expected) {
        assertEquals(expected, AnimeStatus.normalize(raw));
    }

    @Test
    void preservesUnknownValuesInsteadOfGuessing() {
        assertEquals("hiatus", AnimeStatus.normalize("hiatus"));
        assertNull(AnimeStatus.canonicalOrNull("hiatus"));
        assertFalse(AnimeStatus.isValid("hiatus"));
    }

    @Test
    void translatesFinishedForJikanFilters() {
        assertEquals("complete", AnimeStatus.toJikanFilterValue("finished"));
        assertEquals("complete", AnimeStatus.toJikanFilterValue("Finished Airing"));
        assertEquals("airing", AnimeStatus.toJikanFilterValue("ONGOING"));
        assertEquals("upcoming", AnimeStatus.toJikanFilterValue("Not yet aired"));
    }
}
