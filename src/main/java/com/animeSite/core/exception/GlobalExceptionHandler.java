package com.animeSite.core.exception;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.pipeline.ProviderException;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.validation.ConstraintViolationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final MessageSource messageSource;

    // ========================================================================
    // Application Exceptions
    // ========================================================================

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthenticationException(AuthenticationException ex) {
        log.warn("Authentication failed: {}", ex.getErrorCode());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(ex.getErrorCode(), ex.getMessage()));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        String code = ex.getErrorCode();
        log.warn("Business rule violation: {}", code);

        HttpStatus status = switch (code) {
            case "ANIME-0001", "USER-0001" -> HttpStatus.NOT_FOUND;
            case "AUTH-0006" -> HttpStatus.TOO_MANY_REQUESTS;
            case "AUTH-0004" -> HttpStatus.FORBIDDEN;
            default -> HttpStatus.UNPROCESSABLE_ENTITY;
        };

        return ResponseEntity.status(status)
                .body(ApiResponse.error(code, ex.getMessage()));
    }

    @ExceptionHandler(TechnicalException.class)
    public ResponseEntity<ApiResponse<Void>> handleTechnicalException(TechnicalException ex) {
        log.error("Technical error: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(ex.getErrorCode(), ex.getMessage()));
    }

    // ========================================================================
    // Provider Exceptions — never propagate to HTTP 500
    // ========================================================================

    @ExceptionHandler(ProviderException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleProviderException(ProviderException ex) {
        log.warn("Provider error: {} {} | provider={} stage={} recoverable={}",
            ex.getErrorCode(), ex.getMessage(), ex.getProvider(), ex.getFailureStage(), ex.isRecoverable());

        String userMessage = friendlyProviderMessage(ex.getErrorCode(), ex.getHttpStatus());

        return ResponseEntity.ok()
                .body(ApiResponse.<Map<String, Object>>builder()
                    .success(false)
                    .message(userMessage)
                    .errorCode("PROVIDER_ERROR")
                    .data(Map.of(
                        "provider", ex.getProvider(),
                        "httpStatus", ex.getHttpStatus(),
                        "errorCode", ex.getErrorCode(),
                        "failureStage", ex.getFailureStage(),
                        "recoverable", ex.isRecoverable(),
                        "detail", ex.getMessage()
                    ))
                    .timestamp(Instant.now())
                    .build());
    }

    // ========================================================================
    // HTTP Client Exceptions — never propagate to HTTP 500
    // ========================================================================

    @ExceptionHandler(HttpClientErrorException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleHttpClientError(HttpClientErrorException e) {
        int status = e.getStatusCode().value();
        log.warn("[GLOBAL] HttpClientError | status={} message='{}'", status, e.getMessage());

        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message(friendlyHttpStatusMessage(status))
            .errorCode("HTTP_" + status)
            .data(Map.of("httpStatus", status, "detail", e.getResponseBodyAsString()))
            .timestamp(Instant.now())
            .build());
    }

    @ExceptionHandler(HttpServerErrorException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleHttpServerError(HttpServerErrorException e) {
        int status = e.getStatusCode().value();
        log.warn("[GLOBAL] HttpServerError | status={} message='{}'", status, e.getMessage());

        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message("A streaming provider is temporarily unavailable.")
            .errorCode("PROVIDER_DOWN")
            .data(Map.of("httpStatus", status, "detail", e.getResponseBodyAsString()))
            .timestamp(Instant.now())
            .build());
    }

    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleResourceAccess(ResourceAccessException e) {
        log.warn("[GLOBAL] ResourceAccess | message='{}'", e.getMessage());

        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message("A streaming provider did not respond in time.")
            .errorCode("PROVIDER_TIMEOUT")
            .data(Map.of("detail", e.getMessage()))
            .timestamp(Instant.now())
            .build());
    }

    // ========================================================================
    // Timeout — never propagate to HTTP 500
    // ========================================================================

    @ExceptionHandler(TimeoutException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleTimeout(TimeoutException e) {
        log.warn("[GLOBAL] Timeout | message='{}'", e.getMessage());

        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message("The request timed out. Please try again.")
            .errorCode("TIMEOUT")
            .data(Map.of("detail", e.getMessage()))
            .timestamp(Instant.now())
            .build());
    }

    // ========================================================================
    // JSON Processing — never propagate to HTTP 500
    // ========================================================================

    @ExceptionHandler(JsonProcessingException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleJsonProcessing(JsonProcessingException e) {
        log.warn("[GLOBAL] JsonProcessing | message='{}'", e.getMessage());

        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message("Failed to parse provider response.")
            .errorCode("PARSE_ERROR")
            .data(Map.of("detail", e.getMessage()))
            .timestamp(Instant.now())
            .build());
    }

    // ========================================================================
    // IOException — never propagate to HTTP 500
    // ========================================================================

    @ExceptionHandler(IOException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleIoException(IOException e) {
        log.warn("[GLOBAL] IOException | message='{}'", e.getMessage());

        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message("A network error occurred while contacting a streaming provider.")
            .errorCode("NETWORK_ERROR")
            .data(Map.of("detail", e.getMessage()))
            .timestamp(Instant.now())
            .build());
    }

    // ========================================================================
    // Validation Exceptions
    // ========================================================================

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("VALIDATION", msg));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleHandlerValidation(HandlerMethodValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("VALIDATION", "Invalid request parameters"));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("VALIDATION", ex.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleMessageNotReadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("INVALID_REQUEST", "Malformed request body"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Bad request: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("BAD_REQUEST", ex.getMessage()));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleMissingParam(MissingServletRequestParameterException e) {
        log.warn("[GLOBAL] MissingParam | param='{}'", e.getParameterName());

        return ResponseEntity.badRequest().body(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message("Missing required parameter: " + e.getParameterName())
            .errorCode("MISSING_PARAM")
            .data(Map.of("parameter", e.getParameterName()))
            .timestamp(Instant.now())
            .build());
    }

    // ========================================================================
    // IllegalState / NullPointer — never propagate to HTTP 500
    // ========================================================================

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleIllegalState(IllegalStateException e) {
        log.warn("[GLOBAL] IllegalState | message='{}'", e.getMessage());

        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message("An unexpected error occurred.")
            .errorCode("INTERNAL_ERROR")
            .data(Map.of("detail", e.getMessage()))
            .timestamp(Instant.now())
            .build());
    }

    @ExceptionHandler(NullPointerException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleNullPointer(NullPointerException e) {
        log.error("[GLOBAL] NullPointer | message='{}'", e.getMessage(), e);

        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message("An internal error occurred. Our team has been notified.")
            .errorCode("NULL_POINTER")
            .data(Map.of("detail", "A null value was encountered"))
            .timestamp(Instant.now())
            .build());
    }

    // ========================================================================
    // Catch-all — converts ANY exception into a structured JSON response
    // NEVER returns HTTP 500
    // ========================================================================

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleGeneral(Exception ex) {
        log.error("[GLOBAL] UnhandledException | type='{}' message='{}'", ex.getClass().getName(), ex.getMessage(), ex);

        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
            .success(false)
            .message("An unexpected error occurred. Please try again.")
            .errorCode("UNEXPECTED_ERROR")
            .data(        Map.of("type", ex.getClass().getSimpleName(), "detail", "An internal error occurred."))
            .timestamp(Instant.now())
            .build());
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private String friendlyProviderMessage(String errorCode, int httpStatus) {
        if (errorCode == null) return "A streaming provider encountered an error.";
        switch (errorCode) {
            case "HTTP_400_INVALID_ID":
                return "This anime was not found on the streaming provider.";
            case "HTTP_404":
                return "This title is not available on the streaming provider.";
            case "HTTP_429":
            case "RATE_LIMIT":
                return "The streaming provider is rate-limiting requests. Please wait and try again.";
            case "HTTP_403":
                return "Access denied by the streaming provider.";
            case "ANTI_BOT":
                return "The streaming provider is blocking automated requests.";
            case "NETWORK_ERROR":
                return "Could not connect to the streaming provider.";
            case "SERVER_ERROR":
                return "The streaming provider is experiencing server issues.";
            case "ALL_PROVIDERS_FAILED":
                return "No streaming provider could serve this title.";
            case "PROVIDER_UNAVAILABLE":
                return "All streaming providers are currently unavailable.";
            case "TIMEOUT":
                return "The streaming provider took too long to respond.";
            default:
                if (httpStatus == 404) return "This title is not available on the streaming provider.";
                if (httpStatus == 429) return "The streaming provider is busy. Please try again later.";
                if (httpStatus == 403) return "Access denied by the streaming provider.";
                if (httpStatus >= 500) return "The streaming provider is experiencing server issues.";
                return "A streaming provider encountered an error.";
        }
    }

    private String friendlyHttpStatusMessage(int status) {
        if (status == 404) return "This title is not available on the streaming provider.";
        if (status == 429) return "The streaming provider is busy. Please try again later.";
        if (status == 403) return "Access denied by the streaming provider.";
        if (status >= 500) return "The streaming provider is experiencing server issues.";
        return "A streaming provider encountered an error.";
    }
}
