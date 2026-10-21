# Changelog

All notable changes to AnimeWatch are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

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
