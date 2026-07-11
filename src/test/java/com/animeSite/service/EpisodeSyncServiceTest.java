package com.animeSite.service;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.model.JikanAnimeData;
import com.animeSite.model.JikanSingleResponse;
import com.animeSite.persist.Anime;
import com.animeSite.persist.AnimeProviderCache;
import com.animeSite.persist.Episode;
import com.animeSite.pipeline.*;
import com.animeSite.repo.AnimeProviderCacheRepository;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.EpisodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EpisodeSyncServiceTest {

    @Mock(lenient = true) private StreamProvider aninekoProvider;
    @Mock(lenient = true) private StreamProvider gogoProvider;
    @Mock private ValidationService validationService;
    @Mock private AnimeRepository animeRepository;
    @Mock private EpisodeRepository episodeRepository;
    @Mock private AnimeProviderCacheRepository cacheRepository;
    @Mock private JikanApiClient jikanApiClient;
    @Mock private ProviderHealthMonitor healthMonitor;
    @Mock private ReleaseDetector releaseDetector;

    private EpisodeSyncService syncService;
    private List<StreamProvider> providers;
    private Anime testAnime;

    @BeforeEach
    void setUp() {
        providers = List.of(aninekoProvider, gogoProvider);
        when(aninekoProvider.getName()).thenReturn("Anineko");
        when(gogoProvider.getName()).thenReturn("GoGoAnime");

        syncService = new EpisodeSyncService(
            providers, validationService, animeRepository, episodeRepository,
            cacheRepository, jikanApiClient, healthMonitor, releaseDetector
        );

        testAnime = new Anime();
        testAnime.setMalId(21);
        testAnime.setTitle("One Piece");
    }

    // ========================================================================
    // SUCCESS PATH
    // ========================================================================

    @Test
    @DisplayName("Should return SUCCESS when first provider returns episodes")
    void syncEpisodes_successOnFirstProvider() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        List<Episode> episodes = createEpisodes(21, 10);
        when(aninekoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.provider()).isEqualTo("Anineko");
        assertThat(result.episodeCount()).isEqualTo(10);
    }

    // ========================================================================
    // PROVIDER 404 — should fall through to next provider
    // ========================================================================

    @Test
    @DisplayName("Should fallback to backup provider when primary returns 404")
    void syncEpisodes_provider404_fallbackToBackup() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "http://test.com", "GET");
        when(aninekoProvider.fetchEpisodes(21, "One Piece"))
            .thenThrow(new ProviderException("Anineko", "HTTP_404", "Not found", 404, diag, "FETCH"));

        List<Episode> episodes = createEpisodes(21, 5);
        when(gogoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.provider()).isEqualTo("GoGoAnime");
        assertThat(result.episodeCount()).isEqualTo(5);
    }

    // ========================================================================
    // PROVIDER 403 — should fall through
    // ========================================================================

    @Test
    @DisplayName("Should fallback to backup provider when primary returns 403")
    void syncEpisodes_provider403_fallback() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "http://test.com", "GET");
        when(aninekoProvider.fetchEpisodes(21, "One Piece"))
            .thenThrow(new ProviderException("Anineko", "HTTP_403", "Forbidden", 403, diag, "FETCH"));

        List<Episode> episodes = createEpisodes(21, 8);
        when(gogoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.provider()).isEqualTo("GoGoAnime");
        assertThat(result.episodeCount()).isEqualTo(8);
    }

    // ========================================================================
    // PROVIDER 429 — should fall through
    // ========================================================================

    @Test
    @DisplayName("Should fallback to backup provider when primary is rate-limited (429)")
    void syncEpisodes_provider429_fallback() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "http://test.com", "GET");
        when(aninekoProvider.fetchEpisodes(21, "One Piece"))
            .thenThrow(new ProviderException("Anineko", "RATE_LIMIT", "Too many requests", 429, diag, "FETCH"));

        List<Episode> episodes = createEpisodes(21, 3);
        when(gogoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.episodeCount()).isEqualTo(3);
    }

    // ========================================================================
    // PROVIDER TIMEOUT — should fall through
    // ========================================================================

    @Test
    @DisplayName("Should fallback to backup provider when primary times out")
    void syncEpisodes_providerTimeout_fallback() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        when(aninekoProvider.fetchEpisodes(21, "One Piece"))
            .thenThrow(new RuntimeException("Read timed out after 10 seconds"));

        List<Episode> episodes = createEpisodes(21, 6);
        when(gogoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.episodeCount()).isEqualTo(6);
    }

    // ========================================================================
    // PROVIDER RETURNS NULL — should fall through
    // ========================================================================

    @Test
    @DisplayName("Should fallback when provider returns null episodes")
    void syncEpisodes_nullResponse_fallback() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        when(aninekoProvider.fetchEpisodes(21, "One Piece")).thenReturn(null);

        List<Episode> episodes = createEpisodes(21, 4);
        when(gogoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.episodeCount()).isEqualTo(4);
    }

    // ========================================================================
    // PROVIDER RETURNS EMPTY LIST — should fall through
    // ========================================================================

    @Test
    @DisplayName("Should fallback when provider returns empty episode list")
    void syncEpisodes_emptyResponse_fallback() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        when(aninekoProvider.fetchEpisodes(21, "One Piece")).thenReturn(Collections.emptyList());

        List<Episode> episodes = createEpisodes(21, 7);
        when(gogoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.episodeCount()).isEqualTo(7);
    }

    // ========================================================================
    // PROVIDER RETURNS INVALID HTML — should fall through
    // ========================================================================

    @Test
    @DisplayName("Should fallback when provider returns unparseable response")
    void syncEpisodes_malformedResponse_fallback() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        when(aninekoProvider.fetchEpisodes(21, "One Piece"))
            .thenThrow(new RuntimeException("Could not parse provider HTML"));

        List<Episode> episodes = createEpisodes(21, 9);
        when(gogoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.episodeCount()).isEqualTo(9);
    }

    // ========================================================================
    // ALL PROVIDERS FAIL — should return UNAVAILABLE
    // ========================================================================

    @Test
    @DisplayName("Should return UNAVAILABLE when all providers fail")
    void syncEpisodes_allProvidersFail_returnsUnavailable() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        ProviderDiagnostics diag1 = ProviderDiagnostics.fromRequest("Anineko", "http://test.com", "GET");
        ProviderDiagnostics diag2 = ProviderDiagnostics.fromRequest("GoGoAnime", "http://test.com", "GET");
        when(aninekoProvider.fetchEpisodes(21, "One Piece"))
            .thenThrow(new ProviderException("Anineko", "HTTP_404", "Not found", 404, diag1, "FETCH"));
        when(gogoProvider.fetchEpisodes(21, "One Piece"))
            .thenThrow(new ProviderException("GoGoAnime", "SERVER_ERROR", "Server error", 503, diag2, "FETCH"));

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.isUnavailable()).isTrue();
        assertThat(result.providerFailures()).isNotNull();
        assertThat(result.providerFailures()).hasSize(2);
    }

    // ========================================================================
    // ALL PROVIDERS TIMEOUT — should return UNAVAILABLE
    // ========================================================================

    @Test
    @DisplayName("Should return UNAVAILABLE when all providers time out")
    void syncEpisodes_allTimeout_returnsUnavailable() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        when(aninekoProvider.fetchEpisodes(21, "One Piece"))
            .thenThrow(new RuntimeException("Read timed out"));
        when(gogoProvider.fetchEpisodes(21, "One Piece"))
            .thenThrow(new RuntimeException("Connection timed out"));

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.isUnavailable()).isTrue();
    }

    // ========================================================================
    // ANIME NOT FOUND — should return UNAVAILABLE gracefully
    // ========================================================================

    @Test
    @DisplayName("Should return UNAVAILABLE when anime is not in database")
    void syncEpisodes_animeNotFound_returnsUnavailable() {
        when(animeRepository.findByMalId(999)).thenReturn(Optional.empty());

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(999);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.isUnavailable()).isTrue();
        assertThat(result.message()).contains("No anime found");
    }

    // ========================================================================
    // COMING SOON — should not hit providers
    // ========================================================================

    @Test
    @DisplayName("Should return COMING_SOON when anime is not yet released")
    void syncEpisodes_comingSoon_returnsComingSoon() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(true);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isComingSoon()).isTrue();
        assertThat(result.status()).isEqualTo("COMING_SOON");
        assertThat(result.episodeCount()).isZero();

        verify(aninekoProvider, never()).fetchEpisodes(anyInt(), anyString());
        verify(gogoProvider, never()).fetchEpisodes(anyInt(), anyString());
    }

    // ========================================================================
    // DUPLICATE EPISODES — should deduplicate
    // ========================================================================

    @Test
    @DisplayName("Should deduplicate episodes with same episode number")
    void syncEpisodes_deduplicatesEpisodes() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        List<Episode> episodes = createEpisodes(21, 5);
        Episode dup = new Episode();
        dup.setAnimeMalId(21);
        dup.setEpisodeNumber(1);
        dup.setEmbedUrl("http://dup.com/ep-1");
        episodes.add(dup);

        when(aninekoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.episodeCount()).isEqualTo(5);
    }

    // ========================================================================
    // PROVIDER MISMATCH — episodes fail validation, fall through
    // ========================================================================

    @Test
    @DisplayName("Should fallback when provider returns episodes that fail validation")
    void syncEpisodes_validationFails_fallback() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        List<Episode> invalidEpisodes = createEpisodes(21, 100);
        when(aninekoProvider.fetchEpisodes(21, "One Piece")).thenReturn(invalidEpisodes);
        when(validationService.validateEpisodes(anyList(), contains("Anineko"))).thenReturn(Collections.emptyList());

        List<Episode> validEpisodes = createEpisodes(21, 12);
        when(gogoProvider.fetchEpisodes(21, "One Piece")).thenReturn(validEpisodes);
        when(validationService.validateEpisodes(anyList(), contains("GoGoAnime"))).thenReturn(validEpisodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.provider()).isEqualTo("GoGoAnime");
        assertThat(result.episodeCount()).isEqualTo(12);
    }

    // ========================================================================
    // NULL SAFETY — null anime id
    // ========================================================================

    @Test
    @DisplayName("Should handle non-existent MAL ID without crashing")
    void syncEpisodes_nullSafety() {
        when(animeRepository.findByMalId(0)).thenReturn(Optional.empty());

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(0);

        assertThat(result).isNotNull();
        assertThat(result.isUnavailable()).isTrue();
    }

    // ========================================================================
    // EPISODE COUNT MISMATCH — Jikan verification fails, fall through
    // ========================================================================

    @Test
    @DisplayName("Should fallback when Jikan episode count mismatches provider count")
    void syncEpisodes_episodeCountMismatch_fallback() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        JikanSingleResponse jikanResponse = new JikanSingleResponse();
        JikanAnimeData jikanData = new JikanAnimeData();
        jikanData.setEpisodes(100);
        jikanResponse.setData(jikanData);
        when(jikanApiClient.fetchAnimeById(21))
            .thenReturn(jikanResponse)          // first call (for Anineko count verify)
            .thenReturn(jikanResponse);         // second call (for GoGoAnime count verify)

        List<Episode> aninekoEpisodes = createEpisodes(21, 10);
        when(aninekoProvider.fetchEpisodes(21, "One Piece")).thenReturn(aninekoEpisodes);
        when(validationService.validateEpisodes(anyList(), contains("Anineko"))).thenReturn(aninekoEpisodes);

        List<Episode> gogoEpisodes = createEpisodes(21, 100);
        when(gogoProvider.fetchEpisodes(21, "One Piece")).thenReturn(gogoEpisodes);
        when(validationService.validateEpisodes(anyList(), contains("GoGoAnime"))).thenReturn(gogoEpisodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.provider()).isEqualTo("GoGoAnime");
        assertThat(result.episodeCount()).isEqualTo(100);
    }

    // ========================================================================
    // JIKAN UNAVAILABLE — falls back to episode number validation
    // ========================================================================

    @Test
    @DisplayName("Should accept provider episodes when Jikan is unavailable")
    void syncEpisodes_jikanUnavailable_acceptsProviderData() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        when(jikanApiClient.fetchAnimeById(21)).thenThrow(new RuntimeException("Jikan API timeout"));

        List<Episode> episodes = createEpisodes(21, 25);
        when(aninekoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.provider()).isEqualTo("Anineko");
        assertThat(result.episodeCount()).isEqualTo(25);
    }

    // ========================================================================
    // RELEASE CHECK FAILS — non-fatal, continues to providers
    // ========================================================================

    @Test
    @DisplayName("Should continue to providers when release check throws")
    void syncEpisodes_releaseCheckThrows_continuesToProviders() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenThrow(new RuntimeException("Jikan timeout"));

        List<Episode> episodes = createEpisodes(21, 15);
        when(aninekoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.provider()).isEqualTo("Anineko");
        assertThat(result.episodeCount()).isEqualTo(15);
    }

    // ========================================================================
    // SAVE FAILURE — should return TEMPORARY_FAILURE
    // ========================================================================

    @Test
    @DisplayName("Should return TEMPORARY_FAILURE when saving episodes fails")
    void syncEpisodes_saveFails_returnsTemporaryFailure() {
        when(animeRepository.findByMalId(21)).thenReturn(Optional.of(testAnime));
        when(releaseDetector.shouldSkipProviderLookup(21)).thenReturn(false);

        List<Episode> episodes = createEpisodes(21, 10);
        when(aninekoProvider.fetchEpisodes(21, "One Piece")).thenReturn(episodes);
        when(validationService.validateEpisodes(anyList(), anyString())).thenReturn(episodes);

        doThrow(new RuntimeException("Database connection lost"))
            .when(episodeRepository).deleteByAnimeMalId(21);

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.isTemporaryFailure()).isTrue();
        assertThat(result.message()).contains("Failed to save");
    }

    // ========================================================================
    // CATASTROPHIC EXCEPTION — top-level catch returns TEMPORARY_FAILURE
    // ========================================================================

    @Test
    @DisplayName("Should return TEMPORARY_FAILURE on unexpected catastrophic error")
    void syncEpisodes_catastrophicFailure_returnsTemporaryFailure() {
        when(animeRepository.findByMalId(21)).thenThrow(new RuntimeException("Unexpected DB failure"));

        EpisodeSyncService.SyncResult result = syncService.syncEpisodes(21);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.isTemporaryFailure()).isTrue();
        assertThat(result.message()).contains("Unexpected error");
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private List<Episode> createEpisodes(int malId, int count) {
        List<Episode> episodes = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            Episode ep = new Episode();
            ep.setAnimeMalId(malId);
            ep.setEpisodeNumber(i);
            ep.setTitle("Episode " + i);
            ep.setEmbedUrl("http://provider.com/ep-" + i);
            episodes.add(ep);
        }
        return episodes;
    }
}
