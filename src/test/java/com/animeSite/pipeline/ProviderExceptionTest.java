package com.animeSite.pipeline;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ProviderExceptionTest {

    @Test
    void testProviderException_400_isRecoverable() {
        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "/watch/test", "GET")
            .withStatus(400, 100);
        ProviderException ex = new ProviderException("Anineko", "HTTP_400_INVALID_ID",
            "HTTP 400 from Anineko: INVALID_ID", 400, diag, "FETCH");
        assertTrue(ex.isRecoverable());
        assertEquals("Anineko", ex.getProvider());
        assertEquals("HTTP_400_INVALID_ID", ex.getErrorCode());
        assertEquals(400, ex.getHttpStatus());
        assertEquals("FETCH", ex.getFailureStage());
    }

    @Test
    void testProviderException_invalidToken_notRecoverable() {
        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "/watch/test", "GET")
            .withStatus(400, 100);
        ProviderException ex = new ProviderException("Anineko", "INVALID_TOKEN",
            "Invalid token", 400, diag, "FETCH", false);
        assertFalse(ex.isRecoverable());
    }

    @Test
    void testProviderException_toErrorReport() {
        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "/watch/test", "GET")
            .withStatus(400, 100);
        diag.setRootCause("INVALID_ID");
        ProviderException ex = new ProviderException("Anineko", "HTTP_400_INVALID_ID",
            "HTTP 400 from Anineko: INVALID_ID", 400, diag, "FETCH");
        Map<String, Object> report = ex.toErrorReport();
        assertEquals("FETCH", report.get("failureStage"));
        assertEquals("Anineko", report.get("provider"));
        assertEquals(400, report.get("httpStatus"));
        assertTrue((Boolean) report.get("recoverable"));
        assertNotNull(report.get("diagnostics"));
    }

    @Test
    void testProviderException_429_isRecoverable() {
        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "/api", "GET")
            .withStatus(429, 50);
        ProviderException ex = new ProviderException("Anineko", "RATE_LIMIT",
            "Rate limited", 429, diag, "FETCH");
        assertTrue(ex.isRecoverable());
    }

    @Test
    void testProviderException_500_isRecoverable() {
        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "/api", "GET")
            .withStatus(500, 100);
        ProviderException ex = new ProviderException("Anineko", "SERVER_ERROR",
            "Server error", 500, diag, "FETCH");
        assertTrue(ex.isRecoverable());
    }

    @Test
    void testProviderException_404_isRecoverable() {
        ProviderDiagnostics diag = ProviderDiagnostics.fromRequest("Anineko", "/api", "GET")
            .withStatus(404, 100);
        ProviderException ex = new ProviderException("Anineko", "ENDPOINT_NOT_FOUND",
            "Endpoint not found", 404, diag, "FETCH");
        assertTrue(ex.isRecoverable());
    }
}
