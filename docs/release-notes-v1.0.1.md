# v1.0.1 — guest browsing + live backend

Mobile-only release. Backend is unchanged since v1.0.0 (same JAR).

## Included

- `animewatch-1.0.1.apk` — Android app, installable over v1.0.0.
  - Opens straight to home: **no forced login**. Browse, search,
    watch trailers/episodes as a guest.
  - Sign-in is asked only when it matters: favorites, watchlist,
    downloads, reviews (prompt with Later / Sign In).
  - Talks to the live backend at `https://anime-watch-6h6z.onrender.com`
    — registration and login work.
  - Fixes the v1.0.0 launch crash (removed `sentry-expo`, whose stale
    nested SDK killed startup in ~1s).

## Upgrade

Download the APK, tap to install (replaces v1.0.0, data kept).
