package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@Tag(name = "Home", description = "Application info endpoints")
public class HomeController {

    @Value("${spring.application.name}")
    private String appName;

    @GetMapping("/")
    @Operation(summary = "Application info", description = "Returns basic application information.")
    public ResponseEntity<ApiResponse<Map<String, Object>>> home() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "application", appName,
                "version", "1.1.0",
                "status", "running"
        )));
    }

    @GetMapping("/api/app/version")
    @Operation(summary = "Deployed build info", description = "Returns the exact git commit baked into this image, so deploys are verifiable without guessing.")
    public ResponseEntity<ApiResponse<Map<String, Object>>> version() {
        String commit = System.getenv().getOrDefault("RENDER_GIT_COMMIT", "local");
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "application", appName,
                "version", "1.1.0",
                "commit", commit,
                "status", "running"
        )));
    }
}
