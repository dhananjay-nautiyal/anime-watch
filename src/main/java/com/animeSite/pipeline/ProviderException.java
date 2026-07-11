package com.animeSite.pipeline;

import java.util.LinkedHashMap;
import java.util.Map;

public class ProviderException extends RuntimeException {

    private final String provider;
    private final String errorCode;
    private final int httpStatus;
    private final ProviderDiagnostics diagnostics;
    private final String failureStage;
    private final boolean recoverable;

    public ProviderException(String provider, String errorCode, String message, int httpStatus,
                             ProviderDiagnostics diagnostics, String failureStage, boolean recoverable) {
        super(message);
        this.provider = provider;
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
        this.diagnostics = diagnostics;
        this.failureStage = failureStage;
        this.recoverable = recoverable;
    }

    public ProviderException(String provider, String errorCode, String message, int httpStatus,
                             ProviderDiagnostics diagnostics, String failureStage) {
        this(provider, errorCode, message, httpStatus, diagnostics, failureStage, isRecoverable(errorCode, httpStatus));
    }

    private static boolean isRecoverable(String errorCode, int httpStatus) {
        if (httpStatus == 400) {
            return !"INVALID_TOKEN".equals(errorCode) && !"FORBIDDEN".equals(errorCode);
        }
        return httpStatus == 429 || httpStatus >= 500 || httpStatus == 301 || httpStatus == 302 || httpStatus == 404;
    }

    public String getProvider() { return provider; }
    public String getErrorCode() { return errorCode; }
    public int getHttpStatus() { return httpStatus; }
    public ProviderDiagnostics getDiagnostics() { return diagnostics; }
    public String getFailureStage() { return failureStage; }
    public boolean isRecoverable() { return recoverable; }

    public Map<String, Object> toErrorReport() {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("failureStage", failureStage);
        report.put("provider", provider);
        report.put("httpStatus", httpStatus);
        report.put("errorCode", errorCode);
        report.put("message", getMessage());
        report.put("recoverable", recoverable);
        if (diagnostics != null) {
            report.put("diagnostics", diagnostics.toReport());
        }
        return report;
    }
}
