package com.animeSite.httpclient;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

public class TitleNormalizer {

    private static final Logger log = LoggerFactory.getLogger(TitleNormalizer.class);

    private static final Pattern SUFFIX_PATTERN = Pattern.compile(
        "(?i)\\s*(?:uncut|uncensored|director'?s?\\s*cut)\\s*$"
    );

    private static final Pattern YEAR_PAREN_PATTERN = Pattern.compile("\\((19[0-9]{2}|20[0-9]{2})\\)");
    private static final Pattern NON_YEAR_PAREN_PATTERN = Pattern.compile("\\([^)]*\\)");
    private static final Pattern BRACKET_PATTERN = Pattern.compile("\\[[^)]*\\]");
    private static final Pattern COLON_SUBTITLE_PATTERN = Pattern.compile("\\s*[:;]\\s+(?=\\S)");
    private static final Pattern ROMAN_NUMERAL_END = Pattern.compile("\\s+(I{1,3}|IV|VI{0,3})\\s*$");
    private static final Pattern MULTI_SPACE = Pattern.compile("\\s+");
    private static final Pattern PUNCTUATION = Pattern.compile("[^a-zA-Z0-9 ]");
    private static final Pattern LEADING_TRAILING_DASH = Pattern.compile("^-|-$");

    private static final Pattern YEAR_PATTERN = Pattern.compile("(19[0-9]{2}|20[0-9]{2})");

    public static String normalize(String title) {
        if (title == null || title.isBlank()) return "";
        String t = title.trim();
        // Preserve year in parentheses, strip other parenthesized content
        String yearPart = "";
        java.util.regex.Matcher yearMatcher = YEAR_PAREN_PATTERN.matcher(t);
        if (yearMatcher.find()) {
            yearPart = " " + yearMatcher.group(1);
        }
        t = NON_YEAR_PAREN_PATTERN.matcher(t).replaceAll(" ");
        t = BRACKET_PATTERN.matcher(t).replaceAll(" ");
        // Keep text after colon/semicolon (important for distinguishing subtitles)
        t = COLON_SUBTITLE_PATTERN.matcher(t).replaceAll(" - ");
        t = SUFFIX_PATTERN.matcher(t).replaceAll("");
        t = ROMAN_NUMERAL_END.matcher(t).replaceAll("");
        t = PUNCTUATION.matcher(t).replaceAll(" ");
        t = MULTI_SPACE.matcher(t).replaceAll(" ").trim();
        if (!yearPart.isEmpty() && !t.contains(yearPart.trim())) {
            t = t + yearPart;
        }
        return t.trim();
    }

    public static String extractPageTitle(String html) {
        if (html == null || html.isBlank()) return "";
        java.util.regex.Matcher m = Pattern.compile("<title>([^<]+)</title>", Pattern.CASE_INSENSITIVE).matcher(html);
        if (m.find()) {
            String title = m.group(1).trim();
            // Remove site name suffixes like " · Anineko", " - GoGoAnime", etc.
            title = title.replaceAll("(?i)\\s*[·\\-|]\\s*(?:Anineko|GoGoAnime|Watch|Online|Free|English Sub|Dub|Sub|Dubbed|Anime).*$", "").trim();
            return title;
        }
        return "";
    }

    public static String buildSlug(String title) {
        String slug = title.toLowerCase()
                .replaceAll("[^a-z0-9 .-]", "")
                .trim()
                .replaceAll("[. ]+", "-");
        slug = slug.replaceAll("-+", "-");
        slug = LEADING_TRAILING_DASH.matcher(slug).replaceAll("");
        return slug;
    }

    public static String buildSlugRaw(String title) {
        String slug = title.toLowerCase()
                .replaceAll("[^a-z0-9-]", "")
                .replaceAll("-+", "-");
        slug = LEADING_TRAILING_DASH.matcher(slug).replaceAll("");
        return slug;
    }

    public static List<String> buildSlugs(String title) {
        Set<String> slugs = new LinkedHashSet<>();
        String primary = buildSlug(title);
        if (!primary.isEmpty()) slugs.add(primary);

        String alphanumeric = title.replaceAll("[^a-zA-Z0-9 -]", "").trim();
        if (!alphanumeric.isEmpty()) {
            String hyphenated = alphanumeric.toLowerCase().replaceAll("\\s+", "-");
            hyphenated = hyphenated.replaceAll("-+", "-").replaceAll("^-|-$", "");
            if (!hyphenated.equals(primary) && !hyphenated.isEmpty()) slugs.add(hyphenated);
        }

        for (String sep : new String[]{":", ";", " - "}) {
            int idx = title.indexOf(sep);
            if (idx > 0) {
                String beforePart = title.substring(0, idx).trim();
                if (!beforePart.isEmpty()) {
                    String before = buildSlug(beforePart);
                    if (!before.isEmpty()) slugs.add(before);
                    String after = title.substring(idx + sep.length()).trim();
                    int spaceIdx = after.indexOf(' ');
                    String firstWord = spaceIdx > 0 ? after.substring(0, spaceIdx) : after;
                    String combined = before + "-" + buildSlug(firstWord);
                    combined = combined.replaceAll("-+", "-").replaceAll("^-|-$", "");
                    if (!combined.isEmpty()) slugs.add(combined);
                }
            }
        }

        return new ArrayList<>(slugs);
    }

    public static List<String> collectTitles(JsonNode jikanData) {
        Set<String> titles = new LinkedHashSet<>();
        if (jikanData == null) return new ArrayList<>(titles);

        if (jikanData.has("title") && !jikanData.get("title").isNull()) {
            String t = jikanData.get("title").asText("");
            if (!t.isEmpty()) { titles.add(t); titles.add(normalize(t)); }
        }
        if (jikanData.has("title_english") && !jikanData.get("title_english").isNull()) {
            String t = jikanData.get("title_english").asText("");
            if (!t.isEmpty()) { titles.add(t); titles.add(normalize(t)); }
        }
        if (jikanData.has("title_japanese") && !jikanData.get("title_japanese").isNull()) {
            String t = jikanData.get("title_japanese").asText("");
            if (!t.isEmpty()) { titles.add(t); titles.add(normalize(t)); }
        }

        JsonNode titlesArr = jikanData.get("titles");
        if (titlesArr != null && titlesArr.isArray()) {
            for (JsonNode t : titlesArr) {
                String type = t.has("type") ? t.get("type").asText("") : "";
                String title = t.has("title") ? t.get("title").asText("") : "";
                if (!title.isEmpty()) {
                    titles.add(title);
                    titles.add(normalize(title));
                }
            }
        }

        return new ArrayList<>(titles);
    }

    public static List<String> collectAllSlugs(JsonNode jikanData, String primaryTitle) {
        Set<String> allSlugs = new LinkedHashSet<>();

        List<String> titles = collectTitles(jikanData);
        if (primaryTitle != null && !primaryTitle.isEmpty()) {
            titles.add(0, primaryTitle);
            titles.add(0, normalize(primaryTitle));
        }

        for (String t : titles) {
            if (t == null || t.isBlank()) continue;
            if (!t.matches(".*[a-zA-Z].*")) continue;
            List<String> slugs = buildSlugs(t);
            allSlugs.addAll(slugs);
            // Also generate year-appended slugs for disambiguation
            if (jikanData != null) {
                String year = null;
                if (jikanData.has("year") && !jikanData.get("year").isNull()) {
                    year = jikanData.get("year").asText();
                }
                if (year != null) {
                    for (String slug : slugs) {
                        allSlugs.add(slug + "-" + year);
                    }
                }
            }
        }

        return new ArrayList<>(allSlugs);
    }
}
