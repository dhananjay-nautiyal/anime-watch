package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.model.RegisterPushTokenRequest;
import com.animeSite.model.UpdateNotificationPrefsRequest;
import com.animeSite.persist.PushToken;
import com.animeSite.persist.User;
import com.animeSite.repo.UserRepository;
import com.animeSite.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Notifications", description = "Push notification management endpoints")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public NotificationController(NotificationService notificationService, UserRepository userRepository) {
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    @PostMapping("/register")
    @Operation(summary = "Register push token", description = "Registers an Expo push token for the authenticated user.")
    public ResponseEntity<ApiResponse<PushToken>> registerToken(
            @Valid @RequestBody RegisterPushTokenRequest request,
            Authentication authentication) {
        UUID userId = getUserId(authentication);
        PushToken token = notificationService.registerToken(userId, request.getExpoPushToken(), request.getPlatform());
        return ResponseEntity.ok(ApiResponse.success(token));
    }

    @DeleteMapping("/unregister")
    @Operation(summary = "Unregister push token", description = "Unregisters an Expo push token.")
    public ResponseEntity<ApiResponse<String>> unregisterToken(
            @RequestParam String expoPushToken,
            Authentication authentication) {
        UUID userId = getUserId(authentication);
        notificationService.unregisterToken(userId, expoPushToken);
        return ResponseEntity.ok(ApiResponse.success("Token unregistered"));
    }

    @GetMapping("/preferences")
    @Operation(summary = "Get notification preferences", description = "Returns the authenticated user's notification preferences.")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> getPreferences(Authentication authentication) {
        UUID userId = getUserId(authentication);
        Map<String, Boolean> prefs = notificationService.getPreferences(userId);
        return ResponseEntity.ok(ApiResponse.success(prefs));
    }

    @PutMapping("/preferences")
    @Operation(summary = "Update notification preferences", description = "Updates the authenticated user's notification preferences.")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> updatePreferences(
            @Valid @RequestBody UpdateNotificationPrefsRequest request,
            Authentication authentication) {
        UUID userId = getUserId(authentication);
        Map<String, Boolean> prefs = notificationService.updatePreferences(userId, request.getPreferences());
        return ResponseEntity.ok(ApiResponse.success(prefs));
    }

    @PostMapping("/send-test")
    @Operation(summary = "Send test notification", description = "Sends a test push notification to the authenticated user.")
    public ResponseEntity<ApiResponse<String>> sendTest(Authentication authentication) {
        UUID userId = getUserId(authentication);
        notificationService.sendPushToUser(userId, "Test Notification",
                "If you receive this, push notifications are working!", "test", null);
        return ResponseEntity.ok(ApiResponse.success("Test notification sent"));
    }

    @PostMapping("/broadcast")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Broadcast notification", description = "Sends a push notification to all users (admin only).")
    public ResponseEntity<ApiResponse<String>> broadcast(
            @RequestParam String title,
            @RequestParam String body,
            @RequestParam(defaultValue = "announcement") String type) {
        notificationService.sendPushToAll(title, body, type, null);
        return ResponseEntity.ok(ApiResponse.success("Broadcast sent"));
    }

    private UUID getUserId(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
