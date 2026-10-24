# Changelog

All notable changes to AnimeWatch are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **Anime detail pages showed no synopsis and N/A metadata** (#12). The offline
  catalog only shipped browse fields, so `synopsis`, `studios`, `duration`,
  `source`, `aired`, `rating`, `members`, `popularity`, `favorites` and `rank`
  were null for all 1500 seeded titles. The catalog now carries them
  (backfilled from MyAnimeList by `scripts/backfill_offline_catalog.py`), the
  seeder persists them and fills them into rows an older seed left blank, and
  the lazy enricher reads the synopsis too, retries a fetch instead of giving
  up on a title for the life of the JVM, and keeps backfilling genres. Detail
  and watch pages now render every field, fully offline for seeded titles.
- **MyAnimeList placeholder text shipped as real data**. Where a field is
  empty, MAL renders stand-in text — a Studios row reading `None found, add
  some`, a Rating of `None`, a "No synopsis information has been added…"
  paragraph. An earlier enricher stored those verbatim (splitting the studios
  line into two studio names), and because they are not blank no later pass
  would ever correct them. The backfill script and the enricher now reject
  them, the catalogue is scrubbed, and the seeder treats them as gaps on boot
  so existing rows are healed instead of kept.
- **The detail page stuck on “Anime not found”** in dev: React StrictMode
  aborts the first request, and the cancellation set an error state that the
  successful second request never cleared, so the page hid the metadata it had
  already loaded. The Retry button also passed the click event as an abort
  signal, so it could never recover.

## [1.1.1] — 2026-10-21

### Fixed
- **Deployed API was slow**: Jikan is unreachable from datacenter IPs, so every
  request paid the full connect timeout before falling back to the local
  database. A circuit breaker now skips the dead upstream for a minute, the
  home payload is cached for 5 minutes and `streamableIds` uses one batch
  query. Home page: 24s → 4.6s cold / 8ms warm; browse and search: ~6s → ~50ms.
- **Every episode was listed twice** (One Piece showed 2360 instead of 1180).
  Episode sync deleted and re-inserted the whole list, so two concurrent
  syncs stored two copies. Syncs are now serialised per title, merge into the
  existing rows and reuse a fresh result; a start-up job removes duplicates
  left by older builds.
- **Android app**: renamed from “Vega” to “AnimeWatch”, removed the haptics
  that fired on every touch and on every hero slide, replaced the invalid
  `useVideoPlayer` hook call that made the player fail with “Failed to
  initialize player”, and resolved the root-relative proxy URLs against the
  API base so playback works.

## [1.1.0] — 2026-10-21

### Added

- **Liquid glass theme across the whole web app.** Frosted, refracted surfaces
  (automatic for every card, panel, form and table), specular edge highlights,
  an animated aurora backdrop, glass navigation/footer, glass player menus and
  a refreshed violet → cyan → pink accent palette.
- **Provider captions.** MegaPlay's external WebVTT tracks are now surfaced
  through the play API (`servers[].subtitles`) and rendered as native
  `<track>` elements, so the Subtitle menu can actually switch captions
  **On/Off**.
- **Full quality tier list.** The quality menu always lists Auto, 1080p, 720p,
  480p and 360p; tiers the provider does not encode are shown as
  “not available” instead of being omitted.
- **Version metadata.** Web, API and OpenAPI versions now report `1.1.0`,
  and the footer shows the running web version.
- Changelog and release notes for the 1.1.0 feature set.

### Fixed

- **Player controls.** Settings, volume, mute, theater mode and keyboard
  shortcuts buttons were dead due to a state-updater bug in `st()`; they now
  accept both partial objects and updater functions.
- **Settings menu usability.** The menu stays open while in use, pauses the
  auto-hide timer, closes on background click, and uses a compact two-level
  layout (Quality / Subtitles / Speed + toggles) similar to AnimeSuge.
- **Skip Intro.** Raised above the controls overlay so it is clickable.
- **Browse search.** When Jikan is unreachable, the database fallback now
  searches title, English title, Japanese title and synonyms instead of the
  romaji title only. “demon slayer”, “attack on titan” and “one piece” return
  results again.
- **Stream start latency.** Large segments are streamed instead of buffered,
  verification samples one segment per rendition and reuses variant playlists,
  and the player recovers from network/media stalls before surfacing an error.
- **Disguised media segments.** `.html`-disguised MPEG-TS segments are served
  as `video/mp2t`, and `.vtt` captions as `text/vtt` so browsers accept both.
- **DUB playback / failover.** Sub/Dub server selection keeps working when a
  provider rejects a stream, with automatic failover to the next server.

### Changed

- Settings menu is now a two-level popover with checkmarks and back navigation.
- Dev proxy target is configurable via `VITE_API_PROXY` (default
  `http://localhost:8080`).
- Theme tokens (`body`, `surface`, `card`, `border`, shadows) are translucent
  by default, so future components inherit the glass look automatically.
- Backend, frontend and package metadata unified at version `1.1.0`.

## [1.0.0] — 2026-09-01

- Initial public baseline: Spring Boot API, React web client, Consumet bridge,
  catalog browsing, anime details, schedule, seasonal lists, watchlist,
  favorites, comments, news and admin tools.
