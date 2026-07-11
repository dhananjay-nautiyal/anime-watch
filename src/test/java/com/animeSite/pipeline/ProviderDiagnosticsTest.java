package com.animeSite.pipeline;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ProviderDiagnosticsTest {

    @Test
    void testDetectRootCause_invalidId() {
        String cause = ProviderDiagnostics.detectRootCause(400, "Not found: anime doesn't exist", "/watch/naruto");
        assertEquals("INVALID_ID", cause);
    }

    @Test
    void testDetectRootCause_wrongParameter() {
        String cause = ProviderDiagnostics.detectRootCause(400, "invalid parameter 'page'", "/browse");
        assertEquals("WRONG_PARAMETER", cause);
    }

    @Test
    void testDetectRootCause_missingParameter() {
        String cause = ProviderDiagnostics.detectRootCause(400, "missing required field", "/api");
        assertEquals("MISSING_PARAMETER", cause);
    }

    @Test
    void testDetectRootCause_antiBot() {
        String cause = ProviderDiagnostics.detectRootCause(400, "Cloudflare captcha required", "https://anineko.to/watch/test");
        assertEquals("ANTI_BOT", cause);
    }

    @Test
    void testDetectRootCause_rateLimit() {
        String cause = ProviderDiagnostics.detectRootCause(400, "rate limit exceeded", "/api");
        assertEquals("RATE_LIMIT", cause);
    }

    @Test
    void testDetectRootCause_forbidden() {
        String cause = ProviderDiagnostics.detectRootCause(400, "forbidden access blocked", "/api");
        assertEquals("FORBIDDEN", cause);
    }

    @Test
    void testDetectRootCause_invalidToken() {
        String cause = ProviderDiagnostics.detectRootCause(400, "invalid token provided", "/api");
        assertEquals("INVALID_TOKEN", cause);
    }

    @Test
    void testDetectRootCause_endpointChangedVia404() {
        String cause = ProviderDiagnostics.detectRootCause(404, null, "https://gogoanime.live/naruto");
        assertEquals("ENDPOINT_NOT_FOUND", cause);
    }

    @Test
    void testDetectRootCause_defaultBadRequest() {
        String cause = ProviderDiagnostics.detectRootCause(400, "some error", "/api");
        assertEquals("BAD_REQUEST", cause);
    }

    @Test
    void testDetectRootCause_429() {
        String cause = ProviderDiagnostics.detectRootCause(429, null, "/api");
        assertEquals("RATE_LIMIT", cause);
    }

    @Test
    void testDetectRootCause_404() {
        String cause = ProviderDiagnostics.detectRootCause(404, null, "/api");
        assertEquals("ENDPOINT_NOT_FOUND", cause);
    }

    @Test
    void testDetectRootCause_500() {
        String cause = ProviderDiagnostics.detectRootCause(500, null, "/api");
        assertEquals("SERVER_ERROR", cause);
    }

    @Test
    void testDetectRootCause_301() {
        String cause = ProviderDiagnostics.detectRootCause(301, null, "/api");
        assertEquals("REDIRECT", cause);
    }

    @Test
    void testDiagnosticsBuilder() {
        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "/watch/naruto", "GET")
            .addHeader("User-Agent", "Mozilla/5.0")
            .addParameter("page", "1")
            .withResponseBody("test response")
            .withError("something went wrong");

        diag.setAnimeId(123);
        diag.setEpisodeNumber(1);
        diag.setServer("server1");
        diag.setRootCause("INVALID_ID");
        diag.setRecoveryAttempt(2);

        Map<String, Object> report = diag.toReport();
        assertEquals("Anineko", report.get("provider"));
        assertEquals("/watch/naruto", report.get("endpoint"));
        assertEquals("GET", report.get("method"));
        assertEquals(123, report.get("animeId"));
        assertEquals(1, report.get("episodeNumber"));
        assertEquals("server1", report.get("server"));
        assertEquals("INVALID_ID", report.get("rootCause"));
        assertEquals(2, report.get("recoveryAttempt"));
    }
}
