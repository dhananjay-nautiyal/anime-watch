package com.animeSite.pipeline;

import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeStudio;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.AnimeStudioRepository;
import com.animeSite.service.SlugService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OfflineCatalogSeederTest {

    @Mock
    private AnimeRepository animeRepository;

    @Mock
    private AnimeStudioRepository studioRepository;

    private OfflineCatalogSeeder seeder;

    @BeforeEach
    void setUp() {
        SlugService slugService = new SlugService(animeRepository);
        seeder = new OfflineCatalogSeeder(animeRepository, slugService, studioRepository);
    }

    @Test
    void seedsEveryCatalogTitleWithAUniqueNonNullSlug() {
        when(animeRepository.findAll()).thenReturn(List.of());
        when(animeRepository.existsBySlug(anyString())).thenReturn(false);
        when(animeRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        seeder.run();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Anime>> captor = ArgumentCaptor.forClass(List.class);
        verify(animeRepository).saveAll(captor.capture());
        List<Anime> saved = captor.getValue();

        assertEquals(1500, saved.size());
        assertTrue(saved.stream().allMatch(a -> a.getSlug() != null && !a.getSlug().isBlank()),
                "every seeded title must have a slug on the first boot");
        assertEquals(saved.size(), saved.stream().map(Anime::getSlug).distinct().count(),
                "seeded slugs must be unique even though the catalogue repeats titles");
    }

    @Test
    void seedsTheDetailFieldsTheCatalogueShips() {
        when(animeRepository.findAll()).thenReturn(List.of());
        when(animeRepository.existsBySlug(anyString())).thenReturn(false);
        when(animeRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        seeder.run();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Anime>> captor = ArgumentCaptor.forClass(List.class);
        verify(animeRepository).saveAll(captor.capture());

        Anime onePiece = captor.getValue().stream()
                .filter(a -> a.getMalId() != null && a.getMalId() == 21)
                .findFirst()
                .orElseThrow(() -> new AssertionError("One Piece missing from the catalog seed"));

        assertNotNull(onePiece.getSynopsis(), "seeded synopsis must reach the detail page");
        assertNotNull(onePiece.getDuration(), "duration must not render as N/A");
        assertNotNull(onePiece.getSource());
        assertNotNull(onePiece.getMembers());
        assertNotNull(onePiece.getPopularity());
        assertNotNull(onePiece.getFavorites());
        assertFalse(onePiece.getAnimeStudios().isEmpty(), "studios must not render as N/A");
        assertTrue(onePiece.getAnimeStudios().stream().allMatch(s -> s.getName() != null && !s.getName().isBlank()));
    }

    @Test
    void fillsMissingDetailFieldsOnExistingRowsWithoutInsertingDuplicates() {
        Anime existing = new Anime();
        existing.setMalId(21);
        existing.setTitle("One Piece");
        existing.setSlug("one-piece");
        existing.setMembers(42); // already imported: the seed must not overwrite it

        when(animeRepository.findAll()).thenReturn(List.of(existing));
        when(animeRepository.existsBySlug(anyString())).thenReturn(false);
        when(animeRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        seeder.run();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Anime>> captor = ArgumentCaptor.forClass(List.class);
        verify(animeRepository, times(2)).saveAll(captor.capture());
        List<Anime> inserted = captor.getAllValues().get(0);
        List<Anime> toppedUp = captor.getAllValues().get(1);

        assertTrue(inserted.stream().noneMatch(a -> a.getMalId() != null && a.getMalId() == 21),
                "an anime the database already has must not be seeded again");
        assertEquals(1, toppedUp.size());
        Anime healed = toppedUp.get(0);
        assertEquals(21, healed.getMalId());
        assertNotNull(healed.getSynopsis(), "rows from an older seed must be healed on boot");
        assertNotNull(healed.getDuration());
        assertNotNull(healed.getPopularity());
        assertFalse(healed.getAnimeStudios().isEmpty());
        assertEquals(42, healed.getMembers(), "values already in the database win over the seed file");
    }

    @Test
    void resolvesDuplicateTitlesWithinTheSameUnsavedBatch() {
        when(animeRepository.findAll()).thenReturn(List.of());
        when(animeRepository.existsBySlug(anyString())).thenReturn(false);
        when(animeRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        seeder.run();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Anime>> captor = ArgumentCaptor.forClass(List.class);
        verify(animeRepository).saveAll(captor.capture());

        List<String> gintamaSlugs = captor.getValue().stream()
                .filter(a -> a.getTitle().startsWith("Gintama"))
                .map(Anime::getSlug)
                .toList();

        assertTrue(gintamaSlugs.size() > 1, "catalogue is expected to contain several Gintama entries");
        assertEquals(gintamaSlugs.size(), gintamaSlugs.stream().distinct().count());
    }

    @Test
    void reusesStudiosTheDatabaseAlreadyKnows() {
        AnimeStudio toei = new AnimeStudio(java.util.UUID.randomUUID(), 18, "Toei Animation");
        when(studioRepository.findAll()).thenReturn(List.of(toei));
        when(animeRepository.findAll()).thenReturn(List.of());
        when(animeRepository.existsBySlug(anyString())).thenReturn(false);
        when(animeRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        seeder.run();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Anime>> captor = ArgumentCaptor.forClass(List.class);
        verify(animeRepository).saveAll(captor.capture());

        List<AnimeStudio> seeded = captor.getValue().stream()
                .filter(a -> a.getMalId() != null && a.getMalId() == 21)
                .map(Anime::getAnimeStudios)
                .findFirst()
                .orElseThrow();

        assertEquals(1, seeded.size());
        assertSame(toei, seeded.get(0), "a studio the database has must be linked, not recreated");
    }
}
