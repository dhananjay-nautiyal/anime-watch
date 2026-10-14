# anime-watch

Legal anime info, tracking and news platform. Monorepo with a Spring Boot
backend, a Vite + React web app, shared JS packages, and an Expo
React Native mobile app.

| App | Folder | Stack |
|-----|--------|-------|
| Backend | `src/` + `pom.xml` | Spring Boot 3.2, Java 21 |
| Web frontend | `frontend/` | Vite 4, React 18 |
| Mobile app | `luffy/` | Expo 57, React Native 0.86 |
| Shared web/mobile code | `packages/` (`api`, `auth`, `constants`, `hooks`, `types`, `utils`) | JS + TS types |

## Prerequisites

- Java 21 + Maven (backend)
- Node 20+ + npm (frontend, mobile)
- PostgreSQL 14+ (backend `prod`/default profile only; `dev` uses in-memory H2)
- For mobile releases: free Expo account + `eas-cli` (see Release options)

## Quick Start

### Backend (zero-config dev)

```bash
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run
```

Uses in-memory H2, a dev-only JWT key and no-op mail. API on
`http://localhost:8080`, Swagger UI at
`http://localhost:8080/swagger-ui.html`.

### Backend (PostgreSQL, like prod)

```bash
export DB_URL=jdbc:postgresql://localhost:5432/anime_db
export DB_USERNAME=... DB_PASSWORD=...
export JWT_SECRET=$(openssl rand -base64 32)
export APP_BASE_URL=http://localhost:8080 APP_FRONTEND_URL=http://localhost:5173
export MAIL_HOST=smtp.gmail.com MAIL_PORT=587 MAIL_USERNAME=... MAIL_PASSWORD=...
mvn spring-boot:run
```

`.env.example` lists every variable. `prod` additionally requires a
managed schema (`ddl-auto: validate` — no auto-migrations yet).

### Web frontend

```bash
npm install          # from repo root (workspaces)
cd frontend
npm run dev          # empty VITE_API_URL => Vite proxies /api to localhost:8080
```

Production build needs the backend URL:

```bash
VITE_API_URL=https://<backend-host> npm run build
```

### Mobile app (dev)

```bash
npm install          # from repo root (workspaces)
cd luffy
npx expo start       # scan QR with Expo Go (same Wi-Fi)
```

`EXPO_PUBLIC_API_URL` points the app at the backend (defaults to
`luffy/.env.development` LAN value; override per build).

## Features

### Anime
- Trending, seasonal, search and filter (Jikan API / MyAnimeList)
- Episode lists, stream/embed resolution, resume + continue-watching
- Ehcache 3 caching, Guava rate limiting

### Auth & Users
- JWT access + refresh flow, BCrypt, logout revocation
- Forgot / reset password (mail when SMTP configured)
- Roles USER / ADMIN; profile view/update, password change, delete account
- Email-verification tokens are persisted; verify/resend endpoints are planned

### Tracking & Community
- Watchlist (`WATCHING`, `COMPLETED`, `PLAN_TO_WATCH`), favorites
- Reviews with 1–5 stars, one per user per anime, ownership checks
- News articles (public read with pagination, admin CRUD)

### Admin & Ops
- User list/delete, review moderation, provider health + import endpoints
- 23-code `ErrorCode` + i18n bundle, `ApiResponse` envelope
- 16 REST controllers under `/api/**` (auth, anime, episodes, stream proxy,
  image proxy, reviews, watchlist, favorites, news, user, admin, import,
  notifications, provider-health, codes, home)

## API Documentation

Dev profile: [Swagger UI](http://localhost:8080/swagger-ui.html)
(docs path `/api-docs`). Disabled in `prod`.

## Release options

Pick what you want to ship. No Play Store / Apple account needed for A.

### A. Android APK for anyone (recommended first release)

Sideloadable `.apk` built in the cloud, installed from a QR/download link.
Full steps in [`luffy/INSTALL_MOBILE.md`](luffy/INSTALL_MOBILE.md).

```bash
cd luffy
EXPO_PUBLIC_API_URL=https://<backend-host> \
  eas build --platform android --profile preview
```

### B. Android production (Play Store)

`.aab` with production env (requires real `EXPO_PUBLIC_API_URL` —
the `YOUR_BACKEND_URL` placeholder in `eas.json` will not work):

```bash
cd luffy
EXPO_PUBLIC_API_URL=https://<backend-host> \
  eas build --platform android --profile production
```

### C. iOS

```bash
cd luffy
eas build --platform ios --profile preview   # needs Apple Developer account
```

### D. Backend Docker image

```bash
docker build -t anime-backend .
docker run -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DB_URL=jdbc:postgresql://<host>:5432/anime_db \
  -e DB_USERNAME=... -e DB_PASSWORD=... \
  -e JWT_SECRET=... \
  -e APP_BASE_URL=... -e APP_FRONTEND_URL=... \
  anime-backend
```

### E. Web frontend (static hosting)

```bash
cd frontend
VITE_API_URL=https://<backend-host> npm run build   # outputs frontend/dist/
```

Deploy `frontend/dist/` to Vercel/Netlify/any static host
(`frontend/vercel.json` already handles the SPA rewrite).

### OTA updates (mobile, no reinstall)

JS-only mobile changes ship over the air after any A–C install:

```bash
cd luffy
eas update --branch preview --message "..."
```

Native changes (permissions, `app.json` plugins, SDK upgrades) need a
fresh build from A–C.

## Project Structure

```
├── src/main/java/com/animeSite/
│   ├── controller/      # 16 REST controllers (Auth, Anime, Episode, Review,
│   │                      # Watchlist, Favorite, News, User, Admin, ImportAdmin,
│   │                      # StreamProxy, ImageProxy, Notification, ProviderHealth,
│   │                      # Code, Home)
│   ├── core/            # exception hierarchy, ApiResponse, audit, cache, spec, validation
│   ├── security/        # JwtTokenProvider, JwtAuthenticationFilter
│   ├── service/         # interfaces + impl (incl. EmailServiceImpl)
│   ├── persist/         # JPA entities (+ EmailVerificationToken, RefreshToken, ...)
│   ├── repo/            # Spring Data repositories
│   ├── httpclient/      # Jikan + provider clients
│   ├── pipeline/        # provider priority, diagnostics, recovery
│   └── config/          # SecurityConfig, AppConfig (RestTemplates), OpenApiConfig
├── src/main/resources/  # application.yml (+ -dev H2 / -prod Postgres), ehcache.xml
├── frontend/src/        # pages, components, api shims, storage, hooks
├── luffy/src/           # expo-router app, services, storage (SecureStore)
├── packages/            # @anime/api, auth, constants, hooks, types, utils
├── scripts/             # verify_playback.py (API smoke test)
├── Dockerfile           # backend prod image (Temurin 21, profile prod)
└── anime-api-test.http  # manual endpoint tests
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Spring Boot 3.2 |
| Language | Java 21 |
| Database | PostgreSQL 14+ (prod/default); H2 in-memory (dev) |
| ORM | JPA / Hibernate (`update` dev, `validate` prod) |
| Auth | JWT (jjwt 0.12) + Spring Security, BCrypt |
| API Docs | Springdoc OpenAPI 2.3 |
| Caching | Ehcache 3 (JCache) |
| External API | Jikan API v4 (MyAnimeList) + provider scrapers |
| Email | Spring Mail (SMTP, async, no-op when unconfigured) |
| Web | Vite 4 + React 18 + React Router 7 + TanStack Query |
| Mobile | Expo 57 + expo-router + SecureStore + SQLite |
| Builds | Maven (backend), npm workspaces (frontend/mobile), EAS (mobile binaries) |
| Container | Docker (Eclipse Temurin 21) |
