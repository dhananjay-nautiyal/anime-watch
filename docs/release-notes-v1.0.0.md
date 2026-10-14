# v1.0.0 — first release

First installable cut of AnimeWatch (backend + docs; mobile/web binaries follow).

## Included

- `animewatch-1.0.0.apk` — Android app (EAS preview, sideloadable).
  Install from the link/QR below. Note: it bakes the
  `https://YOUR_BACKEND_URL` placeholder, so it installs and opens but
  needs a real backend (rebuild with `EXPO_PUBLIC_API_URL`) for data.
- `anime-backend-1.0.0.jar` — Spring Boot 3.2 / Java 21 API server.
  Run with `java -jar` (needs Postgres + env, see README Quick Start).
  Dev alternative needs nothing: `SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run`.

## Not in this release (coming next)

- **Web bundle** — baked per backend URL at build time:
  `cd frontend && VITE_API_URL=https://<backend-host> npm run build`,
  then attach `dist/` as `animewatch-web-1.0.0.zip`.

## Fixes in this release

- Untracked 47k committed `node_modules`/`dist` files (1.1 GB → sane clone)
- Mobile `@/*` alias resolves under Metro + Babel
- Hermes-safe shared API client (no `import.meta` crash, no placeholder hijack)
- EAS preview profile builds a sideloadable APK, no baked-in LAN IP
- Dev backend boots with zero config (H2, ~5 s)
- README rewritten (BitChord style) with Download-via-Releases section
- Removed sentry-expo (crashed every launch: its nested
  @sentry/react-native@5.5.0 extends a base gone in RN 0.86)

Full history: `git log v1.0.0 --oneline` after tagging.
