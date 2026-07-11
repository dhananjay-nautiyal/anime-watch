package com.animeSite.pipeline;

import com.animeSite.persist.Episode;
import com.animeSite.persist.AnimeProviderCache;
import com.animeSite.repo.AnimeProviderCacheRepository;
import com.animeSite.repo.AnimeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecoveryEngineTest {

    @Mock(lenient = true)
    private StreamProvider aninekoProvider;
    @Mock(lenient = true)
    private StreamProvider gogoProvider;
    @Mock(lenient = true)
    private AnimeProviderCacheRepository cacheRepository;
    @Mock(lenient = true)
    private ValidationService validationService;
    @Mock(lenient = true)
    private AnimeRepository animeRepository;

    private RecoveryEngine recoveryEngine;
    private ProviderDiagnostics diag;

    @BeforeEach
    void setUp() {
        lenient().when(aninekoProvider.getName()).thenReturn("Anineko");
        lenient().when(gogoProvider.getName()).thenReturn("GoGoAnime");

        recoveryEngine = new RecoveryEngine(
            List.of(aninekoProvider, gogoProvider),
            cacheRepository,
            validationService,
            animeRepository
        );

        diag = ProviderDiagnostics.fromRequest("Anineko", "/watch/test", "GET")
            .withStatus(400, 100);
        diag.setRootCause("INVALID_ID");
    }

    @Test
    void testRetrySameRequest_success() {
        Episode ep = createEpisode(1, "http://example.com/ep-1", 123);

        lenient().when(aninekoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenReturn(List.of(ep));
        when(validationService.validateEpisodes(anyList(), anyString()))
            .thenReturn(List.of(ep));

        ProviderException ex = new ProviderException("Anineko", "HTTP_400_INVALID_ID",
            "test", 400, diag, "FETCH");
        RecoveryEngine.RecoveryResult result = recoveryEngine.attemptRecovery(123, "Test Anime", ex);

        assertTrue(result.success);
        assertNotNull(result.episodes);
        assertEquals(1, result.episodes.size());
        assertEquals("Anineko", result.provider);
    }

    @Test
    void testRetrySameRequest_failureThenRefreshSearch_success() {
        Episode ep = createEpisode(1, "http://example.com/ep-1", 123);

        when(aninekoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new RuntimeException("still failing"))
            .thenReturn(List.of(ep));
        when(validationService.validateEpisodes(anyList(), anyString()))
            .thenReturn(List.of(ep));

        ProviderException ex = new ProviderException("Anineko", "HTTP_400_INVALID_ID",
            "test", 400, diag, "FETCH");
        RecoveryEngine.RecoveryResult result = recoveryEngine.attemptRecovery(123, "Test Anime", ex);

        assertTrue(result.success);
    }

    @Test
    void testAllRecoveryStagesFail() {
        when(aninekoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new RuntimeException("persistent failure"));
        when(gogoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new RuntimeException("persistent failure"));
        when(cacheRepository.findByMalId(anyInt())).thenReturn(Optional.empty());

        ProviderException ex = new ProviderException("Anineko", "HTTP_400_INVALID_ID",
            "test", 400, diag, "FETCH");
        RecoveryEngine.RecoveryResult result = recoveryEngine.attemptRecovery(123, "Test Anime", ex);

        assertFalse(result.success);
        assertEquals(5, result.attempts);
    }

    @Test
    void testSwitchProvider_success() {
        Episode ep = createEpisode(1, "http://gogoanime.live/naruto-episode-1", 123);

        when(aninekoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new RuntimeException("persistent failure"));
        when(gogoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenReturn(List.of(ep));
        when(validationService.validateEpisodes(anyList(), anyString()))
            .thenReturn(List.of(ep));

        ProviderException ex = new ProviderException("Anineko", "HTTP_400_INVALID_ID",
            "test", 400, diag, "FETCH");
        RecoveryEngine.RecoveryResult result = recoveryEngine.attemptRecovery(123, "Test Anime", ex);

        assertTrue(result.success);
        assertEquals("GoGoAnime", result.provider);
    }

    @Test
    void testHttp400InvalidId_triggersCacheInvalidationOnRefreshStage() {
        Episode ep = createEpisode(1, "http://example.com/ep-1", 123);

        when(aninekoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new RuntimeException("still failing"));
        when(cacheRepository.findByMalId(anyInt())).thenReturn(Optional.empty());

        ProviderException ex = new ProviderException("Anineko", "HTTP_400_INVALID_ID",
            "test", 400, diag, "FETCH");
        RecoveryEngine.RecoveryResult result = recoveryEngine.attemptRecovery(123, "Test Anime", ex);

        assertFalse(result.success);
        verify(cacheRepository, atLeast(2)).deleteByMalId(123);
    }

    @Test
    void testHttp400WrongProviderMapping_switchesProvider() {
        Episode ep = createEpisode(1, "http://gogoanime.live/naruto-episode-1", 123);

        when(aninekoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new RuntimeException("Anineko fails"));
        when(gogoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenReturn(List.of(ep));
        when(validationService.validateEpisodes(anyList(), anyString()))
            .thenReturn(List.of(ep));

        ProviderException ex = new ProviderException("Anineko", "HTTP_400_INVALID_ID",
            "test", 400, diag, "FETCH");
        RecoveryEngine.RecoveryResult result = recoveryEngine.attemptRecovery(123, "Test Anime", ex);

        assertTrue(result.success);
        assertEquals("GoGoAnime", result.provider);
    }

    private Episode createEpisode(int num, String url, int malId) {
        Episode ep = new Episode();
        ep.setEpisodeNumber(num);
        ep.setEmbedUrl(url);
        ep.setAnimeMalId(malId);
        return ep;
    }
}
