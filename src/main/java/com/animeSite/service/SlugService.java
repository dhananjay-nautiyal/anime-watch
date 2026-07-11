package com.animeSite.service;

import com.animeSite.repo.AnimeRepository;
import org.springframework.stereotype.Service;
import java.text.Normalizer;

@Service
public class SlugService {

    private final AnimeRepository animeRepository;

    public SlugService(AnimeRepository animeRepository) {
        this.animeRepository = animeRepository;
    }

    public String generateSlug(String title) {
        if (title == null || title.isBlank()) return "untitled";
        String normalized = Normalizer.normalize(title, Normalizer.Form.NFD)
            .replaceAll("[^\\p{ASCII}]", "")
            .toLowerCase()
            .replaceAll("[^a-z0-9\\s-]", "")
            .trim()
            .replaceAll("\\s+", "-")
            .replaceAll("-+", "-")
            .replaceAll("^-|-$", "");
        return normalized.isEmpty() ? "untitled" : normalized;
    }

    public String ensureUniqueSlug(String slug, Integer malId) {
        if (!animeRepository.existsBySlug(slug)) return slug;
        String candidate = slug + "-" + malId;
        if (!animeRepository.existsBySlug(candidate)) return candidate;
        int suffix = 1;
        while (animeRepository.existsBySlug(candidate + "-" + suffix)) {
            suffix++;
        }
        return candidate + "-" + suffix;
    }
}
