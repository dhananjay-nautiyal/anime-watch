package com.animeSite.service.impl;

import com.animeSite.persist.PushToken;
import com.animeSite.repo.PushTokenRepository;
import com.animeSite.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final PushTokenRepository pushTokenRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public NotificationServiceImpl(PushTokenRepository pushTokenRepository,
                                    RestTemplate restTemplate,
                                    ObjectMapper objectMapper) {
        this.pushTokenRepository = pushTokenRepository;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public PushToken registerToken(UUID userId, String expoPushToken, String platform) {
        pushTokenRepository.findByExpoPushTokenAndActiveTrue(expoPushToken)
                .ifPresent(t -> {
                    t.setActive(false);
                    pushTokenRepository.save(t);
                });

        PushToken token = new PushToken();
        token.setUserId(userId);
        token.setExpoPushToken(expoPushToken);
        token.setPlatform(platform);
        token.setActive(true);
        return pushTokenRepository.save(token);
    }

    @Override
    @Transactional
    public void unregisterToken(UUID userId, String expoPushToken) {
        pushTokenRepository.findByExpoPushTokenAndActiveTrue(expoPushToken)
                .ifPresent(t -> {
                    t.setActive(false);
                    pushTokenRepository.save(t);
                });
    }

    @Override
    @Transactional
    public void unregisterAllUserTokens(UUID userId) {
        pushTokenRepository.findByUserIdAndActiveTrue(userId)
                .forEach(t -> {
                    t.setActive(false);
                    pushTokenRepository.save(t);
                });
    }

    @Override
    public Map<String, Boolean> getPreferences(UUID userId) {
        // Default preferences; in production store these per-user
        Map<String, Boolean> prefs = new LinkedHashMap<>();
        prefs.put("new_episode", true);
        prefs.put("watch_reminder", true);
        prefs.put("continue_watching", true);
        prefs.put("announcement", true);
        prefs.put("promotion", false);
        // TODO: load from a per-user preferences table or JSON column
        return prefs;
    }

    @Override
    @Transactional
    public Map<String, Boolean> updatePreferences(UUID userId, Map<String, Boolean> prefs) {
        // TODO: persist to per-user preferences table
        Map<String, Boolean> current = getPreferences(userId);
        if (prefs != null) {
            current.putAll(prefs);
        }
        return current;
    }

    @Override
    @Async
    public void sendPushToUser(UUID userId, String title, String body, String type, Map<String, String> data) {
        List<PushToken> tokens = pushTokenRepository.findByUserIdAndActiveTrue(userId);
        if (tokens.isEmpty()) return;
        sendExpoPush(tokens, title, body, type, data);
    }

    @Override
    @Async
    public void sendPushToAll(String title, String body, String type, Map<String, String> data) {
        List<PushToken> tokens = pushTokenRepository.findByActiveTrue();
        if (tokens.isEmpty()) return;
        sendExpoPush(tokens, title, body, type, data);
    }

    private void sendExpoPush(List<PushToken> tokens, String title, String body, String type, Map<String, String> data) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        List<Map<String, Object>> messages = new ArrayList<>();
        for (PushToken token : tokens) {
            Map<String, Object> message = new LinkedHashMap<>();
            message.put("to", token.getExpoPushToken());
            message.put("title", title);
            message.put("body", body);
            message.put("priority", "high");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("type", type);
            if (data != null) {
                payload.putAll(data);
            }
            message.put("data", payload);

            messages.add(message);
        }

        try {
            HttpEntity<List<Map<String, Object>>> request = new HttpEntity<>(messages, headers);
            restTemplate.postForEntity(EXPO_PUSH_URL, request, String.class);
        } catch (Exception e) {
            // Log and swallow — Expo push is best-effort
            System.err.println("[PushNotification] Failed to send push: " + e.getMessage());
        }
    }
}
