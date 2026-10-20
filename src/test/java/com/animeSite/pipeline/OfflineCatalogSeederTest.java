package com.animeSite.pipeline;

import com.animeSite.persist.Anime;
import com.animeSite.repo.AnimeRepository;
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

    private OfflineCatalogSeeder seeder;

    @BeforeEach
    void setUp() {
        SlugService slugService = new SlugService(animeRepository);
        seeder = new OfflineCatalogSeeder(animeRepository, slugService);
    }

    @Test
    void seedsEveryCatalogTitleWithAUniqueNonNullSlug() {
        when(animeRepository.count()).thenReturn(0L);
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
    void resolvesDuplicateTitlesWithinTheSameUnsavedBatch() {
        when(animeRepository.count()).thenReturn(0L);
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
}
