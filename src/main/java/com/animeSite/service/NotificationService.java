package com.animeSite.service;

import com.animeSite.persist.PushToken;

import java.util.Map;
import java.util.UUID;

public interface NotificationService {
    PushToken registerToken(UUID userId, String expoPushToken, String platform);
    void unregisterToken(UUID userId, String expoPushToken);
    void unregisterAllUserTokens(UUID userId);
    Map<String, Boolean> getPreferences(UUID userId);
    Map<String, Boolean> updatePreferences(UUID userId, Map<String, Boolean> prefs);
    void sendPushToUser(UUID userId, String title, String body, String type, Map<String, String> data);
    void sendPushToAll(String title, String body, String type, Map<String, String> data);
}
