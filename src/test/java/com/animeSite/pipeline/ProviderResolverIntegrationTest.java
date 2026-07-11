package com.animeSite.pipeline;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.persist.AnimeProviderCache;
import com.animeSite.persist.Episode;
import com.animeSite.repo.AnimeProviderCacheRepository;
import com.animeSite.repo.AnimeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProviderResolverIntegrationTest {

    @Mock(lenient = true)
    private StreamProvider aninekoProvider;
    @Mock(lenient = true)
    private StreamProvider gogoProvider;
    @Mock(lenient = true)
    private ValidationService validationService;
    @Mock(lenient = true)
    private ProviderHealthMonitor healthMonitor;
    @Mock(lenient = true)
    private AnimeProviderCacheRepository cacheRepository;
    @Mock(lenient = true)
    private AnimeRepository animeRepository;
    @Mock(lenient = true)
    private JikanApiClient jikanApiClient;

    @Captor
    private ArgumentCaptor<AnimeProviderCache> cacheCaptor;

    private ProviderResolver resolver;
    private List<StreamProvider> providers;

    @BeforeEach
    void setUp() {
        lenient().when(aninekoProvider.getName()).thenReturn("Anineko");
        lenient().when(gogoProvider.getName()).thenReturn("GoGoAnime");
        providers = List.of(aninekoProvider, gogoProvider);

        RecoveryEngine recoveryEngine = new RecoveryEngine(
            providers, cacheRepository, validationService, animeRepository);

        resolver = new ProviderResolver(
            providers, validationService, healthMonitor, cacheRepository, recoveryEngine, jikanApiClient);
    }

    private Episode createEpisode(int num, String url, int malId) {
        Episode ep = new Episode();
        ep.setEpisodeNumber(num);
        ep.setEmbedUrl(url);
        ep.setAnimeMalId(malId);
        return ep;
    }

    @Test
    void testCacheHit_returnsEpisodesFromDb() {
        AnimeProviderCache cached = AnimeProviderCache.success(123, "Anineko", 12);
        when(cacheRepository.findByMalId(123)).thenReturn(Optional.of(cached));

        List<Episode> dbEpisodes = new ArrayList<>();
        for (int i = 1; i <= 12; i++) {
            dbEpisodes.add(createEpisode(i, "http://example.com/ep-" + i, 123));
        }
        when(validationService.findEpisodesByMalId(123)).thenReturn(dbEpisodes);

        var result = resolver.resolveEpisodes(123, "Test Anime");

        assertTrue(result.success);
        assertEquals(12, result.data.size());
        assertEquals("Anineko", result.provider);
        verify(cacheRepository, never()).deleteByMalId(123);
        verify(cacheRepository, never()).save(any());
    }

    @Test
    void testCacheHit_expiredCache_reFetches() {
        AnimeProviderCache expired = AnimeProviderCache.success(123, "Anineko", 12);
        expired.setExpiresAt(Instant.now().minusSeconds(3600));
        when(cacheRepository.findByMalId(123)).thenReturn(Optional.of(expired));

        List<Episode> episodes = List.of(createEpisode(1, "http://example.com/ep-1", 123));
        when(aninekoProvider.fetchEpisodes(anyInt(), anyString())).thenReturn(new ArrayList<>(episodes));
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(new ArrayList<>(episodes));

        var result = resolver.resolveEpisodes(123, "Test Anime");

        assertTrue(result.success);
        assertEquals(1, result.data.size());
        assertEquals("Anineko", result.provider);
        verify(cacheRepository, atLeastOnce()).deleteByMalId(123);
    }

    @Test
    void testCacheHit_failureMarker_clearsAndReFetches() {
        AnimeProviderCache failure = AnimeProviderCache.failure(123);
        when(cacheRepository.findByMalId(123)).thenReturn(Optional.of(failure));

        List<Episode> episodes = List.of(createEpisode(1, "http://example.com/ep-1", 123));
        when(aninekoProvider.fetchEpisodes(anyInt(), anyString())).thenReturn(new ArrayList<>(episodes));
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(new ArrayList<>(episodes));

        var result = resolver.resolveEpisodes(123, "Test Anime");

        assertTrue(result.success);
        verify(cacheRepository, atLeastOnce()).deleteByMalId(123);
    }

    @Test
    void testCacheMiss_priorityProviderSucceeds() {
        when(cacheRepository.findByMalId(123)).thenReturn(Optional.empty());

        List<Episode> episodes = List.of(
            createEpisode(1, "http://example.com/ep-1", 123),
            createEpisode(2, "http://example.com/ep-2", 123)
        );
        when(aninekoProvider.fetchEpisodes(anyInt(), anyString())).thenReturn(new ArrayList<>(episodes));
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(new ArrayList<>(episodes));

        var result = resolver.resolveEpisodes(123, "Test Anime");

        assertTrue(result.success);
        assertEquals(2, result.data.size());
        assertEquals("Anineko", result.provider);
        verify(cacheRepository).save(cacheCaptor.capture());
        assertEquals("Anineko", cacheCaptor.getValue().getProvider());
        assertTrue(cacheCaptor.getValue().isStreamable());
    }

    @Test
    void testPriorityProviderFails_fallsBackToNextProvider() {
        when(cacheRepository.findByMalId(123)).thenReturn(Optional.empty());

        when(aninekoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new ProviderException("Anineko", "HTTP_400", "bad request", 400, null, "FETCH"));
        List<Episode> gogoEpisodes = List.of(createEpisode(1, "http://gogoanime.live/ep-1", 123));
        when(gogoProvider.fetchEpisodes(anyInt(), anyString())).thenReturn(new ArrayList<>(gogoEpisodes));
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(new ArrayList<>(gogoEpisodes));

        var result = resolver.resolveEpisodes(123, "Test Anime");

        assertTrue(result.success);
        assertEquals("GoGoAnime", result.provider);
        assertEquals(1, result.data.size());
    }

    @Test
    void testAllProvidersFail_savesFailureCache() {
        when(cacheRepository.findByMalId(123)).thenReturn(Optional.empty());

        when(aninekoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new ProviderException("Anineko", "HTTP_400", "bad request", 400, null, "FETCH"));
        when(gogoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new ProviderException("GoGoAnime", "HTTP_400", "bad request too", 400, null, "FETCH"));

        var result = resolver.resolveEpisodes(123, "Test Anime");

        assertFalse(result.success);
        assertEquals("ALL_PROVIDERS_FAILED", result.errorCode);
        verify(cacheRepository).save(cacheCaptor.capture());
        assertFalse(cacheCaptor.getValue().isStreamable());
    }

    @Test
    void testRecoveryEngine_invalidatesCacheOnHttp400AndRetriesWithTitleVariants() {
        when(cacheRepository.findByMalId(123)).thenReturn(Optional.empty());

        when(aninekoProvider.fetchEpisodes(eq(123), anyString()))
            .thenThrow(new ProviderException("Anineko", "HTTP_400", "bad request", 400, null, "FETCH"));
        List<Episode> gogoEpisodes = List.of(createEpisode(1, "http://gogoanime.live/ep-1", 123));
        when(gogoProvider.fetchEpisodes(eq(123), anyString())).thenReturn(new ArrayList<>(gogoEpisodes));
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(new ArrayList<>(gogoEpisodes));

        var result = resolver.resolveEpisodes(123, "Test Anime");

        assertTrue(result.success);
        assertEquals("GoGoAnime", result.provider);
        verify(cacheRepository, atLeastOnce()).deleteByMalId(123);
    }

    @Test
    void testStreamResolution_primaryProviderSucceeds() {
        StreamResult sr = StreamResult.success("Anineko", "hls", List.of(
            new StreamResult.ServerOption("https://anineko.to/stream/123.m3u8", "Server A", false),
            new StreamResult.ServerOption("https://anineko.to/stream/123-backup.m3u8", "Backup", true)
        ));

        when(aninekoProvider.resolveStream(anyString())).thenReturn(sr);

        var result = resolver.resolveStream(123, "http://anineko.to/ep-1");

        assertTrue(result.success);
        assertNotNull(result.data);
        assertEquals("Anineko", result.provider);
        assertEquals("https://anineko.to/stream/123.m3u8", result.data.getPrimaryUrl());
    }

    @Test
    void testStreamResolution_failsOverToNextProvider() {
        when(aninekoProvider.resolveStream(anyString()))
            .thenThrow(new ProviderException("Anineko", "STREAM_FAILED", "no stream", 500, null, "RESOLVE"));

        StreamResult sr = StreamResult.success("GoGoAnime", "hls", List.of(
            new StreamResult.ServerOption("https://gogoanime.live/stream/123.m3u8", "Server A", false)
        ));
        when(gogoProvider.resolveStream(anyString())).thenReturn(sr);

        var result = resolver.resolveStream(123, "http://anineko.to/ep-1");

        assertTrue(result.success);
        assertEquals("GoGoAnime", result.provider);
    }

    @Test
    void testGetValidatedCache_episodeCountZero_clearsCache() {
        AnimeProviderCache cached = AnimeProviderCache.success(123, "Anineko", 0);
        when(cacheRepository.findByMalId(123)).thenReturn(Optional.of(cached));

        List<Episode> episodes = List.of(createEpisode(1, "http://example.com/ep-1", 123));
        when(aninekoProvider.fetchEpisodes(anyInt(), anyString())).thenReturn(new ArrayList<>(episodes));
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(new ArrayList<>(episodes));

        var result = resolver.resolveEpisodes(123, "Test Anime");
        assertTrue(result.success);
        verify(cacheRepository, atLeastOnce()).deleteByMalId(123);
    }

    @Test
    void testIsStreamable_uncachedAnime_returnsFalse() {
        when(cacheRepository.findByMalId(999)).thenReturn(Optional.empty());
        assertFalse(resolver.isStreamable(999));
    }

    @Test
    void testIsStreamable_cachedStreamable_returnsTrue() {
        AnimeProviderCache cached = AnimeProviderCache.success(999, "Anineko", 12);
        when(cacheRepository.findByMalId(999)).thenReturn(Optional.of(cached));
        assertTrue(resolver.isStreamable(999));
    }

    @Test
    void testIsStreamable_failureCache_returnsFalse() {
        AnimeProviderCache cached = AnimeProviderCache.failure(999);
        when(cacheRepository.findByMalId(999)).thenReturn(Optional.of(cached));
        assertFalse(resolver.isStreamable(999));
    }

    @Test
    void testInvalidateCache() {
        resolver.invalidateCache(123);
        verify(cacheRepository).deleteByMalId(123);
    }

    @Test
    void testTitleVariantsAreGeneratedForRecovery() {
        Episode ep = createEpisode(1, "http://gogoanime.live/ep-1", 123);
        List<Episode> gogoEpisodes = List.of(ep);

        when(aninekoProvider.fetchEpisodes(anyInt(), anyString()))
            .thenThrow(new ProviderException("Anineko", "HTTP_400", "bad request", 400, null, "FETCH"));
        when(gogoProvider.fetchEpisodes(anyInt(), anyString())).thenReturn(new ArrayList<>(gogoEpisodes));
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(new ArrayList<>(gogoEpisodes));
        when(cacheRepository.findByMalId(123)).thenReturn(Optional.empty());

        ProviderException trigger = new ProviderException("Anineko", "HTTP_400", "bad request", 400, null, "FETCH");
        var result = resolver.resolveEpisodes(123, "Attack on Titan Season 2 (Part 2)");

        assertTrue(result.success, "Resolver should recover via title variants");
        assertEquals("GoGoAnime", result.provider);
        assertNotNull(result.data);
        assertEquals(1, result.data.size());
    }
}
