# v1.0.0 — first release

First installable cut of AnimeWatch (backend + docs; mobile/web binaries follow).

## Included

- `anime-backend-1.0.0.jar` — Spring Boot 3.2 / Java 21 API server.
  Run with `java -jar` (needs Postgres + env, see README Quick Start).
  Dev alternative needs nothing: `SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run`.

## Not in this release (coming next)

- **Android APK** — needs one EAS cloud build with your backend URL
  (we can't run `eas login` for you):
  `cd luffy && EXPO_PUBLIC_API_URL=https://<backend-host> eas build -p android --profile preview`,
  then `gh release upload v1.0.0 app.apk`. See `luffy/INSTALL_MOBILE.md`.
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

Full history: `git log v1.0.0 --oneline` after tagging.
