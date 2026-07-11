package com.animeSite.pipeline;

import java.util.LinkedHashMap;
import java.util.Map;

public class ProviderDiagnostics {

    private final String provider;
    private final String endpoint;
    private final String method;
    private final int httpStatus;
    private final long durationMs;
    private final Map<String, String> requestHeaders = new LinkedHashMap<>();
    private final Map<String, String> requestParameters = new LinkedHashMap<>();
    private String requestBody;
    private String responseBody;
    private String errorMessage;
    private String rootCause;
    private Integer animeId;
    private Integer episodeId;
    private Integer episodeNumber;
    private String server;
    private String language;
    private int recoveryAttempt;

    public ProviderDiagnostics(String provider, String endpoint, String method, int httpStatus, long durationMs) {
        this.provider = provider;
        this.endpoint = endpoint;
        this.method = method;
        this.httpStatus = httpStatus;
        this.durationMs = durationMs;
    }

    public static ProviderDiagnostics fromRequest(String provider, String endpoint, String method) {
        return new ProviderDiagnostics(provider, endpoint, method, 0, 0);
    }

    public ProviderDiagnostics withStatus(int status, long durationMs) {
        return new ProviderDiagnostics(provider, endpoint, method, status, durationMs);
    }

    public ProviderDiagnostics addHeader(String key, String value) {
        requestHeaders.put(key, value);
        return this;
    }

    public ProviderDiagnostics addParameter(String key, String value) {
        requestParameters.put(key, value);
        return this;
    }

    public ProviderDiagnostics withRequestBody(String body) {
        this.requestBody = body;
        return this;
    }

    public ProviderDiagnostics withResponseBody(String body) {
        this.responseBody = body != null && body.length() > 1000 ? body.substring(0, 1000) + "... [truncated]" : body;
        return this;
    }

    public ProviderDiagnostics withError(String error) {
        this.errorMessage = error;
        return this;
    }

    public void setRootCause(String rootCause) { this.rootCause = rootCause; }
    public void setAnimeId(Integer animeId) { this.animeId = animeId; }
    public void setEpisodeId(Integer episodeId) { this.episodeId = episodeId; }
    public void setEpisodeNumber(Integer episodeNumber) { this.episodeNumber = episodeNumber; }
    public void setServer(String server) { this.server = server; }
    public void setLanguage(String language) { this.language = language; }
    public void setRecoveryAttempt(int attempt) { this.recoveryAttempt = attempt; }

    public String getProvider() { return provider; }
    public String getEndpoint() { return endpoint; }
    public String getMethod() { return method; }
    public int getHttpStatus() { return httpStatus; }
    public long getDurationMs() { return durationMs; }
    public String getErrorMessage() { return errorMessage; }
    public String getRootCause() { return rootCause; }

    public Map<String, Object> toReport() {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("provider", provider);
        report.put("endpoint", endpoint);
        report.put("method", method);
        report.put("httpStatus", httpStatus);
        report.put("durationMs", durationMs);
        report.put("requestHeaders", requestHeaders);
        report.put("requestParameters", requestParameters);
        if (requestBody != null) report.put("requestBody", requestBody);
        if (responseBody != null) report.put("responseBodyPreview", responseBody);
        if (errorMessage != null) report.put("errorMessage", errorMessage);
        if (rootCause != null) report.put("rootCause", rootCause);
        if (animeId != null) report.put("animeId", animeId);
        if (episodeId != null) report.put("episodeId", episodeId);
        if (episodeNumber != null) report.put("episodeNumber", episodeNumber);
        if (server != null) report.put("server", server);
        if (language != null) report.put("language", language);
        report.put("recoveryAttempt", recoveryAttempt);
        return report;
    }

    @Override
    public String toString() {
        return "DIAGNOSTIC [" + provider + "] " + method + " " + endpoint + " → " + httpStatus + " (" + durationMs + "ms)" +
            (rootCause != null ? " cause=" + rootCause : "") +
            (errorMessage != null ? " error=" + errorMessage : "");
    }

    public static String detectRootCause(int status, String responseBody, String endpoint) {
        if (status == 400) {
            if (responseBody == null) return "EMPTY_RESPONSE";
            String body = responseBody.toLowerCase();
            if (body.contains("not found") || body.contains("doesn't exist")) return "INVALID_ID";
            if (body.contains("invalid") && body.contains("parameter")) return "WRONG_PARAMETER";
            if (body.contains("invalid") && body.contains("token")) return "INVALID_TOKEN";
            if (body.contains("rate limit") || body.contains("too many requests")) return "RATE_LIMIT";
            if (body.contains("missing")) return "MISSING_PARAMETER";
            if (body.contains("forbidden") || body.contains("blocked")) return "FORBIDDEN";
            if (endpoint != null && (endpoint.contains("gogoanime") || endpoint.contains("anineko"))) {
                if (body.contains("captcha") || body.contains("cloudflare")) return "ANTI_BOT";
                if (body.contains("not found") || body.contains("404")) return "ENDPOINT_CHANGED";
            }
            return "BAD_REQUEST";
        }
        if (status == 404) return "ENDPOINT_NOT_FOUND";
        if (status == 429) return "RATE_LIMIT";
        if (status == 301 || status == 302) return "REDIRECT";
        if (status >= 500) return "SERVER_ERROR";
        return "UNKNOWN";
    }
}
