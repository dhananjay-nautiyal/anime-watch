package com.animeSite.pipeline;

import com.animeSite.persist.Episode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class EpisodeValidator {

    private static final Logger log = LoggerFactory.getLogger(EpisodeValidator.class);

    private static final int MAX_EPISODE_NUMBER = 9999;
    private static final int MAX_TITLE_LENGTH = 500;
    private static final int MAX_EMBED_URL_LENGTH = 2000;

    public ValidationResult validate(List<Episode> episodes, String context) {
        if (episodes == null || episodes.isEmpty()) {
            return ValidationResult.invalid("EMPTY_LIST", "Episode list is empty");
        }

        List<Episode> valid = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<Integer> seenNumbers = new HashSet<>();
        int duplicates = 0;

        for (int i = 0; i < episodes.size(); i++) {
            Episode ep = episodes.get(i);
            List<String> epErrors = validateEpisode(ep);

            if (!epErrors.isEmpty()) {
                log.warn("[EPISODE_VALIDATOR] Invalid episode #{} in {}: {}", i, context, String.join(", ", epErrors));
                errors.add("episode[" + i + "]: " + String.join(", ", epErrors));
                continue;
            }

            if (ep.getEpisodeNumber() != null) {
                if (!seenNumbers.add(ep.getEpisodeNumber())) {
                    duplicates++;
                    continue;
                }
            }

            valid.add(ep);
        }

        return new ValidationResult(
            !valid.isEmpty(),
            valid,
            errors,
            duplicates,
            episodes.size() - valid.size() - duplicates
        );
    }

    public boolean isValidEmbedUrl(String url) {
        if (url == null || url.isBlank()) return false;
        if (url.length() > MAX_EMBED_URL_LENGTH) return false;
        if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/api/")) return false;
        return true;
    }

    private List<String> validateEpisode(Episode ep) {
        List<String> errors = new ArrayList<>();

        if (ep.getEpisodeNumber() == null) {
            errors.add("Missing episode number");
        } else if (ep.getEpisodeNumber() < 0 || ep.getEpisodeNumber() > MAX_EPISODE_NUMBER) {
            errors.add("Invalid episode number: " + ep.getEpisodeNumber());
        }

        if (ep.getEmbedUrl() != null && !ep.getEmbedUrl().isBlank()) {
            if (!isValidEmbedUrl(ep.getEmbedUrl())) {
                errors.add("Invalid embed URL");
            }
        }

        if (ep.getTitle() != null && ep.getTitle().length() > MAX_TITLE_LENGTH) {
            errors.add("Title too long: " + ep.getTitle().length());
        }

        return errors;
    }

    public record ValidationResult(
        boolean valid,
        List<Episode> validEpisodes,
        List<String> errors,
        int duplicatesRemoved,
        int invalidRemoved
    ) {
        public static ValidationResult invalid(String code, String message) {
            return new ValidationResult(false, Collections.emptyList(), List.of(code + ": " + message), 0, 0);
        }
    }
}
