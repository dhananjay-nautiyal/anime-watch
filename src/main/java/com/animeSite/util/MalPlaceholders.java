package com.animeSite.util;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * MyAnimeList renders stand-in text where a field has no value: the Studios
 * row reads "None found, add some", unrated titles show Rating "None", and
 * pages without a description carry a "No synopsis information has been
 * added..." paragraph.
 *
 * <p>That text is not empty, so a naive "fill only the blanks" pass treats it
 * as real data and it ships to the UI as a studio name or a synopsis. Worse,
 * once stored it is never corrected, because the seeder and the enricher both
 * skip rows that already have a value. Treat these strings as missing so they
 * can be replaced (or cleared) like any other gap.
 */
public final class MalPlaceholders {

    private static final Set<String> VALUES = Set.of(
        "none found", "add some", "unknown", "not available", "not found",
        "none", "n/a", "na", "-", "?", "tba", "to be added", "nothing found");

    private static final Pattern SYNOPIS =
        Pattern.compile("no synopsis information has been added|help improve our database",
            Pattern.CASE_INSENSITIVE);

    private MalPlaceholders() {
    }

    /** True when the text is blank or is one of MAL's stand-in strings. */
    public static boolean isPlaceholder(String value) {
        if (value == null || value.isBlank()) return true;
        String[] parts = value.split(",");
        for (String part : parts) {
            String normalised = part.strip().toLowerCase(Locale.ROOT);
            while (normalised.endsWith(".")) {
                normalised = normalised.substring(0, normalised.length() - 1).strip();
            }
            if (!VALUES.contains(normalised)) return false;
        }
        return true;
    }

    /** True when the text is MAL's "no synopsis" boilerplate paragraph. */
    public static boolean isSynopsisPlaceholder(String value) {
        return value != null && SYNOPIS.matcher(value).find();
    }

    /** True when a studio name is stand-in text rather than a real studio. */
    public static boolean isStudioPlaceholder(String name) {
        return isPlaceholder(name);
    }
}
