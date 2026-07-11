package com.animeSite.pipeline;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class OriginalAnimeFilter {

    private static final List<String> EXCLUDED_TYPES = List.of("music", "ona", "special");
    private static final List<String> EXCLUDED_STATUSES = List.of("not_yet_aired", "not_yet_published", "upcoming");

    public boolean isPlayable(String type, String status) {
        if (type != null && EXCLUDED_TYPES.contains(type.toLowerCase())) return false;
        if (status != null && EXCLUDED_STATUSES.contains(status.toLowerCase().replace(' ', '_'))) return false;
        return true;
    }

    public <T extends AnimeLike> List<T> filterPlayable(List<T> items) {
        return items.stream()
            .filter(a -> isPlayable(a.getType(), a.getStatus()))
            .collect(Collectors.toList());
    }

    public <T extends AnimeLike> List<T> filterOriginal(List<T> items) {
        return items.stream()
            .filter(a -> isOriginal(a.getSource()))
            .collect(Collectors.toList());
    }

    public <T extends AnimeLike> List<T> filterRecommendable(List<T> items, int excludeMalId) {
        return items.stream()
            .filter(a -> a.getMalId() != excludeMalId)
            .filter(a -> isPlayable(a.getType(), a.getStatus()))
            .distinct()
            .collect(Collectors.toList());
    }

    public boolean isOriginal(String source) {
        if (source == null) return false;
        String s = source.toLowerCase();
        return s.contains("original") || s.contains("manga") || s.contains("novel") || s.contains("game");
    }

    public interface AnimeLike {
        int getMalId();
        String getType();
        String getStatus();
        String getSource();
        String getTitle();
    }
}
