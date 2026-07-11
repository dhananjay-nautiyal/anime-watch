package com.animeSite.pipeline;

import com.animeSite.httpclient.TitleNormalizer;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.stream.Collectors;

public class AnimeMatcher {

    private static final Logger log = LoggerFactory.getLogger(AnimeMatcher.class);

    public static ScoredMatch findBestMatch(String title, JsonNode jikanData, List<String> candidateSlugs) {
        if (candidateSlugs.isEmpty()) return null;

        String normalized = TitleNormalizer.normalize(title).toLowerCase();
        String slugPrefix = TitleNormalizer.buildSlug(title);

        List<String> searchTitles = TitleNormalizer.collectTitles(jikanData);

        List<ScoredMatch> scored = new ArrayList<>();
        for (String slug : candidateSlugs) {
            double score = 0;
            String slugLower = slug.toLowerCase();

            if (slugLower.equals(slugPrefix)) score = 1.0;
            else if (slugLower.startsWith(slugPrefix)) score = 0.9;
            else if (slugPrefix.startsWith(slugLower)) score = 0.85;

            for (String t : searchTitles) {
                String tSlug = TitleNormalizer.buildSlug(t);
                String tNorm = TitleNormalizer.normalize(t).toLowerCase();
                String tSlugNorm = TitleNormalizer.buildSlug(tNorm);

                if (slugLower.equals(tSlug) || slugLower.equals(tSlugNorm)) {
                    score = Math.max(score, 0.95);
                }
                if (slugLower.startsWith(tSlug) || tSlug.startsWith(slugLower)) {
                    score = Math.max(score, 0.85);
                }
            }

            double wordOverlap = computeWordOverlap(slugLower, normalized);
            score = Math.max(score, wordOverlap * 0.8);

            scored.add(new ScoredMatch(slug, score, slug));
        }

        scored.sort((a, b) -> Double.compare(b.confidence, a.confidence));
        return scored.isEmpty() ? null : scored.get(0);
    }

    public static double computeTitleSimilarity(String a, String b) {
        if (a == null || b == null) return 0;
        String s1 = TitleNormalizer.normalize(a).toLowerCase();
        String s2 = TitleNormalizer.normalize(b).toLowerCase();
        if (s1.equals(s2)) return 1.0;
        double overlap = computeWordOverlap(s1, s2);
        double lev = 1.0 - (double) levenshtein(s1, s2) / Math.max(s1.length(), s2.length());
        return Math.max(overlap * 0.6 + lev * 0.4, overlap);
    }

    private static double computeWordOverlap(String a, String b) {
        Set<String> wordsA = new HashSet<>(Arrays.asList(a.split("[^a-z0-9]+")));
        Set<String> wordsB = new HashSet<>(Arrays.asList(b.split("[^a-z0-9]+")));
        wordsA.remove("");
        wordsB.remove("");
        if (wordsA.isEmpty() || wordsB.isEmpty()) return 0;
        Set<String> intersection = new HashSet<>(wordsA);
        intersection.retainAll(wordsB);
        return (double) intersection.size() / Math.min(wordsA.size(), wordsB.size());
    }

    private static int levenshtein(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + cost);
            }
        }
        return dp[a.length()][b.length()];
    }

    public static class ScoredMatch {
        public final String slug;
        public final double confidence;
        public final String label;

        ScoredMatch(String slug, double confidence, String label) {
            this.slug = slug;
            this.confidence = confidence;
            this.label = label;
        }
    }
}
