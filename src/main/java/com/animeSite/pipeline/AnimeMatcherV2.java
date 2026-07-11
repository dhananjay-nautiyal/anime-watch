package com.animeSite.pipeline;

import com.animeSite.httpclient.TitleNormalizer;
import com.animeSite.model.JikanAnimeData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class AnimeMatcherV2 {

    private static final Logger log = LoggerFactory.getLogger(AnimeMatcherV2.class);

    private static final double CONFIDENCE_THRESHOLD = 0.90;

    private static final double WEIGHT_EXACT_TITLE = 0.40;
    private static final double WEIGHT_TOKEN_SORT = 0.20;
    private static final double WEIGHT_PARTIAL = 0.15;
    private static final double WEIGHT_YEAR = 0.10;
    private static final double WEIGHT_EPISODES = 0.05;
    private static final double WEIGHT_TYPE = 0.05;
    private static final double WEIGHT_STUDIO = 0.05;

    private static final Pattern YEAR_PATTERN = Pattern.compile("\\b(19[0-9]{2}|20[0-9]{2})\\b");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\b(\\d+)\\b");

    public static class MatchResult {
        public final int malId;
        public final String matchedTitle;
        public final double confidence;
        public final Map<String, Double> scores;
        public final boolean accepted;

        public MatchResult(int malId, String matchedTitle, double confidence, Map<String, Double> scores) {
            this.malId = malId;
            this.matchedTitle = matchedTitle;
            this.confidence = confidence;
            this.scores = Collections.unmodifiableMap(new LinkedHashMap<>(scores));
            this.accepted = confidence >= CONFIDENCE_THRESHOLD;
        }
    }

    public static MatchResult findBestMatch(String searchTitle, List<JikanAnimeData> candidates) {
        if (searchTitle == null || searchTitle.isBlank() || candidates == null || candidates.isEmpty()) {
            return new MatchResult(0, "", 0.0, Map.of());
        }

        MatchResult best = null;

        for (JikanAnimeData candidate : candidates) {
            Map<String, Double> scores = computeScores(searchTitle, candidate);
            double totalConfidence = 0.0;
            for (double s : scores.values()) {
                totalConfidence += s;
            }
            String matchedTitle = determineBestTitle(candidate);

            MatchResult result = new MatchResult(candidate.getMalId(), matchedTitle, totalConfidence, scores);
            if (best == null || totalConfidence > best.confidence) {
                best = result;
            }
        }

        return best != null ? best : new MatchResult(0, "", 0.0, Map.of());
    }

    private static Map<String, Double> computeScores(String searchTitle, JikanAnimeData candidate) {
        Map<String, Double> scores = new LinkedHashMap<>();

        String normalizedSearch = TitleNormalizer.normalize(searchTitle).toLowerCase();
        List<String> allTitles = collectAllTitles(candidate);

        scores.put("exact_title", computeExactTitleScore(normalizedSearch, allTitles) * WEIGHT_EXACT_TITLE);
        scores.put("token_sort_ratio", computeTokenSortRatio(normalizedSearch, allTitles) * WEIGHT_TOKEN_SORT);
        scores.put("partial_ratio", computePartialRatio(normalizedSearch, allTitles) * WEIGHT_PARTIAL);
        scores.put("year", computeYearScore(searchTitle, candidate) * WEIGHT_YEAR);
        scores.put("episodes", computeEpisodeScore(searchTitle, candidate) * WEIGHT_EPISODES);
        scores.put("type", computeTypeScore(searchTitle, candidate) * WEIGHT_TYPE);
        scores.put("studio", computeStudioScore(searchTitle, candidate) * WEIGHT_STUDIO);

        return scores;
    }

    private static List<String> collectAllTitles(JikanAnimeData data) {
        Set<String> titles = new LinkedHashSet<>();
        if (data.getTitle() != null && !data.getTitle().isBlank()) {
            titles.add(data.getTitle().toLowerCase());
            titles.add(TitleNormalizer.normalize(data.getTitle()).toLowerCase());
        }
        if (data.getTitleEnglish() != null && !data.getTitleEnglish().isBlank()) {
            titles.add(data.getTitleEnglish().toLowerCase());
            titles.add(TitleNormalizer.normalize(data.getTitleEnglish()).toLowerCase());
        }
        return new ArrayList<>(titles);
    }

    private static double computeExactTitleScore(String normalizedSearch, List<String> allTitles) {
        for (String t : allTitles) {
            if (t.equals(normalizedSearch)) {
                return 1.0;
            }
        }
        return 0.0;
    }

    private static double computeTokenSortRatio(String normalizedSearch, List<String> allTitles) {
        double best = 0.0;
        String searchSorted = sortTokens(normalizedSearch);
        for (String t : allTitles) {
            String normalT = TitleNormalizer.normalize(t).toLowerCase();
            String candidateSorted = sortTokens(normalT);
            double sim = levenshteinSimilarity(searchSorted, candidateSorted);
            best = Math.max(best, sim);
        }
        return best;
    }

    private static double computePartialRatio(String normalizedSearch, List<String> allTitles) {
        double best = 0.0;
        for (String t : allTitles) {
            String normalT = TitleNormalizer.normalize(t).toLowerCase();
            double sim = partialRatio(normalizedSearch, normalT);
            best = Math.max(best, sim);
        }
        return best;
    }

    private static double partialRatio(String a, String b) {
        if (a == null || b == null) return 0.0;
        if (a.isEmpty() && b.isEmpty()) return 1.0;
        if (a.isEmpty() || b.isEmpty()) return 0.0;
        String shorter = a.length() <= b.length() ? a : b;
        String longer = a.length() > b.length() ? a : b;
        double best = 0.0;
        int len = shorter.length();
        for (int i = 0; i + len <= longer.length(); i++) {
            String sub = longer.substring(i, i + len);
            double sim = levenshteinSimilarity(shorter, sub);
            best = Math.max(best, sim);
        }
        return best;
    }

    private static String sortTokens(String s) {
        if (s == null || s.isBlank()) return "";
        String[] tokens = s.split("\\s+");
        Arrays.sort(tokens);
        return String.join(" ", tokens);
    }

    public static double computeJaccardSimilarity(String a, String b) {
        if (a == null || b == null) return 0.0;
        Set<String> tokensA = tokenize(a);
        Set<String> tokensB = tokenize(b);
        if (tokensA.isEmpty() && tokensB.isEmpty()) return 1.0;
        if (tokensA.isEmpty() || tokensB.isEmpty()) return 0.0;
        Set<String> intersection = new HashSet<>(tokensA);
        intersection.retainAll(tokensB);
        Set<String> union = new HashSet<>(tokensA);
        union.addAll(tokensB);
        return (double) intersection.size() / union.size();
    }

    private static Set<String> tokenize(String s) {
        Set<String> tokens = new HashSet<>();
        String[] parts = s.toLowerCase().split("[^a-z0-9]+");
        for (String part : parts) {
            if (!part.isEmpty()) {
                tokens.add(part);
            }
        }
        return tokens;
    }

    private static double levenshteinSimilarity(String a, String b) {
        if (a == null || b == null) return 0.0;
        if (a.isEmpty() && b.isEmpty()) return 1.0;
        int maxLen = Math.max(a.length(), b.length());
        if (maxLen == 0) return 1.0;
        return 1.0 - (double) levenshtein(a, b) / maxLen;
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

    private static double computeYearScore(String searchTitle, JikanAnimeData candidate) {
        if (candidate.getYear() == null) return 0.0;
        Integer searchYear = extractYear(searchTitle);
        if (searchYear == null) return 0.0;
        return candidate.getYear().equals(searchYear) ? 1.0 : 0.0;
    }

    private static Integer extractYear(String s) {
        if (s == null) return null;
        Matcher m = YEAR_PATTERN.matcher(s);
        if (m.find()) {
            return Integer.parseInt(m.group());
        }
        return null;
    }

    private static double computeEpisodeScore(String searchTitle, JikanAnimeData candidate) {
        if (candidate.getEpisodes() == null) return 0.0;
        Integer searchEpisodes = extractNumber(searchTitle);
        if (searchEpisodes == null) return 0.0;
        return candidate.getEpisodes().equals(searchEpisodes) ? 1.0 : 0.0;
    }

    private static Integer extractNumber(String s) {
        if (s == null) return null;
        Matcher m = NUMBER_PATTERN.matcher(s);
        if (m.find()) {
            return Integer.parseInt(m.group());
        }
        return null;
    }

    private static double computeTypeScore(String searchTitle, JikanAnimeData candidate) {
        if (candidate.getType() == null || candidate.getType().isBlank()) return 0.0;
        String type = candidate.getType().toLowerCase();
        String searchLower = searchTitle.toLowerCase();
        if (searchLower.contains(type)) return 1.0;
        Map<String, List<String>> typeKeywords = Map.of(
            "tv", Arrays.asList("tv", "anime series", "tv series"),
            "movie", Arrays.asList("movie", "film"),
            "ova", Arrays.asList("ova", "oav"),
            "ona", Arrays.asList("ona"),
            "special", Arrays.asList("special")
        );
        List<String> keywords = typeKeywords.get(type);
        if (keywords != null) {
            for (String kw : keywords) {
                if (searchLower.contains(kw)) return 1.0;
            }
        }
        return 0.0;
    }

    private static double computeStudioScore(String searchTitle, JikanAnimeData candidate) {
        if (candidate.getStudios() == null || candidate.getStudios().isEmpty()) return 0.0;
        String searchLower = searchTitle.toLowerCase();
        for (JikanAnimeData.Studio studio : candidate.getStudios()) {
            if (studio.getName() == null) continue;
            String studioName = studio.getName().toLowerCase();
            if (searchLower.contains(studioName)) return 1.0;
            String searchTokens = sortTokens(TitleNormalizer.normalize(searchLower));
            String studioTokens = sortTokens(TitleNormalizer.normalize(studioName));
            if (levenshteinSimilarity(searchTokens, studioTokens) >= 0.8) return 1.0;
        }
        return 0.0;
    }

    private static String determineBestTitle(JikanAnimeData candidate) {
        if (candidate.getTitleEnglish() != null && !candidate.getTitleEnglish().isBlank()) {
            return candidate.getTitleEnglish();
        }
        if (candidate.getTitle() != null && !candidate.getTitle().isBlank()) {
            return candidate.getTitle();
        }
        return "Unknown";
    }
}
