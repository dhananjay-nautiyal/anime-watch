package com.animeSite.service.impl;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.importpipeline.JikanMetadataProvider;
import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeGenre;
import com.animeSite.persist.AnimeStudio;
import com.animeSite.repo.AnimeGenreRepository;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.service.SlugService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

/**
 * The offline catalogue ships every sidebar field but genres, so a detail
 * view used to stall on a live MyAnimeList fetch (2500 ms connect + 6000 ms
 * read - usually the full timeout, since MAL is unreachable from datacenter
 * IPs). The fetch must leave the request thread: the response is served from
 * the catalogue, and the enrichment is delegated to the enricher's
 * enrichById, which reloads the row inside its own transaction - so the
 * entity being serialized into the response is never mutated by another
 * thread, and the lazy studios/genres resolve in one session.
 */
@ExtendWith(MockitoExtension.class)
class AnimeServiceImplEnrichmentTest {

    @Mock
    private JikanApiClient jikanApiClient;

    @Mock
    private AnimeRepository animeRepository;

    @Mock
    private AnimeGenreRepository animeGenreRepository;

    @Mock
    private SlugService slugService;

    @Mock
    private JikanMetadataProvider jikanMetadataProvider;

    @Mock
    private AnimeMetadataEnricher metadataEnricher;

    @Mock
    private PlatformTransactionManager transactionManager;

    private final List<Runnable> queued = new ArrayList<>();
    private final Executor recordingExecutor = queued::add;

    private AnimeServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AnimeServiceImpl(jikanApiClient, animeRepository, animeGenreRepository,
                slugService, jikanMetadataProvider, metadataEnricher, recordingExecutor,
                transactionManager);
    }

    private Anime row() {
        Anime anime = new Anime();
        anime.setMalId(21);
        anime.setTitle("One Piece");
        anime.setSlug("one-piece");
        anime.setAnimeGenres(List.of(new AnimeGenre(UUID.randomUUID(), 1, "Action", "anime")));
        anime.setAnimeStudios(List.of(new AnimeStudio(UUID.randomUUID(), 18, "Toei Animation")));
        return anime;
    }

    @Test
    void detailViewAnswersFromTheCatalogAndQueuesTheMyAnimeListFetch() {
        Anime requestRow = row();
        // Existence check + relation load, both on the request thread.
        when(animeRepository.findByMalId(21))
                .thenReturn(Optional.of(requestRow), Optional.of(requestRow));
        when(metadataEnricher.needsEnrichment(requestRow)).thenReturn(true);

        Anime result = service.getAnimeById(21);

        assertSame(requestRow, result, "the caller gets its row immediately");
        verify(metadataEnricher, never()).enrichById(anyInt());
        verify(metadataEnricher, never()).enrich(any(Anime.class));
        assertEquals(1, queued.size(), "exactly one background enrichment task is queued");

        queued.get(0).run();

        // enrichById reloads the row inside its own transaction; the request's
        // entity is never handed to another thread.
        verify(metadataEnricher).enrichById(21);
        verify(metadataEnricher, never()).enrich(any(Anime.class));
    }

    @Test
    void aSaturatedPoolNeverFailsTheDetailRequest() {
        service = new AnimeServiceImpl(jikanApiClient, animeRepository, animeGenreRepository,
                slugService, jikanMetadataProvider, metadataEnricher,
                task -> {
                    throw new RejectedExecutionException("enrichment pool full");
                },
                transactionManager);

        Anime requestRow = row();
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(requestRow));
        when(metadataEnricher.needsEnrichment(requestRow)).thenReturn(true);

        Anime result = assertDoesNotThrow(() -> service.getAnimeById(21));

        assertSame(requestRow, result, "a busy enrichment pool must not fail the detail view");
        verify(metadataEnricher, never()).enrichById(anyInt());
        verify(metadataEnricher, never()).enrich(any(Anime.class));
    }
}
