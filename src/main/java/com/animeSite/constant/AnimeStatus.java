package com.animeSite.constant;

/**
 * Canonical anime status vocabulary.
 *
 * The database used to mix three vocabularies: the offline catalogue stores
 * FINISHED / UPCOMING / ONGOING, Jikan returns "Finished Airing" / "Currently
 * Airing" / "Not yet aired", and the UI filters with airing / complete /
 * upcoming. Everything is normalized to the lowercase values below so that
 * storage, filters and the API agree.
 */
public final class AnimeStatus {

    public static final String AIRING = "airing";
    public static final String FINISHED = "finished";
    public static final String UPCOMING = "upcoming";

    private AnimeStatus() {
    }

    /**
     * Maps any known vocabulary to a canonical value. Unknown values are
     * returned trimmed but otherwise untouched so no data is lost.
     */
    public static String normalize(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('_', ' ').replace('-', ' ');
        if (s.isEmpty()) return raw;
        // Order matters: "Finished Airing" contains "airing".
        if (s.contains("not yet") || s.contains("upcoming")) return UPCOMING;
        if (s.contains("finished") || s.contains("complete")) return FINISHED;
        if (s.contains("airing") || s.contains("ongoing")) return AIRING;
        return raw.trim();
    }

    /**
     * Returns the canonical value when the input is recognizable, otherwise
     * null. Used by the one-off repair migration.
     */
    public static String canonicalOrNull(String raw) {
        String normalized = normalize(raw);
        if (AIRING.equals(normalized) || FINISHED.equals(normalized) || UPCOMING.equals(normalized)) {
            return normalized;
        }
        return null;
    }

    public static boolean isValid(String raw) {
        return canonicalOrNull(raw) != null;
    }

    /** Jikan's filter endpoint still uses "complete" instead of "finished". */
    public static String toJikanFilterValue(String raw) {
        String canonical = canonicalOrNull(raw);
        if (canonical == null) return raw;
        return FINISHED.equals(canonical) ? "complete" : canonical;
    }
}
