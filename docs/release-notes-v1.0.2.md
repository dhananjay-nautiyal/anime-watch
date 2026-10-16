# v1.0.2 — guest browsing, crash fix, content pipeline

Mobile release. Backend unchanged since v1.0.0 (same JAR); requires the
live backend at `https://anime-watch-6h6z.onrender.com`.

## Included

- `animewatch-1.0.2.apk` — Android app, installable over v1.0.1.
  - Opens straight to home: **no forced login**. Sign-in is asked only
    for favorites, watchlist, downloads, reviews.
  - **Player crash fixed**: episode screen read a query before its
    declaration (`isLoading of undefined`); declarations reordered.
  - **Search works**: debounced results grid with loading/empty/error
    states (the old screen never called the API).
  - **Tab icons render** (icon map is now actually wired to the tab bar;
    icon font preloaded).
  - **Auto-sync**: episode lists fill on first open ("Finding
    episodes…"); player and download button report honest states
    instead of spinning forever.
  - **In-app update prompt**: Update/Later on launch when a newer
    release exists; reappears each launch until updated.
  - **About section** in Settings (app + backend versions).
  - **External player** button (VLC/MX via ACTION_VIEW).
  - **Renamed to Vega** (launcher label; project slug unchanged).
  - OTA channels configured (`preview`/`production`) so later JS-only
    fixes ship over-the-air.

## Known limits

- Playback/downloads need a reachable stream source; all scraper and
  Consumet sources are currently blocked from cloud IPs, so the player
  says so plainly instead of spinning. Episode lists, search, tracking
  and reviews work fully offline-first.
- No maintained Hindi anime API exists; a Hindi source needs a
  site-specific scraper (pending a site to target).
