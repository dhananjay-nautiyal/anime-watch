<p align="center">
  <img src="luffy/assets/images/icon.png" width="120" alt="AnimeWatch app icon" />
</p>

<h1 align="center">AnimeWatch</h1>

<p align="center"><b>Track, watch and never miss an anime</b></p>

<p align="center">

[![Latest release](https://img.shields.io/github/v/release/dhani748/anime-watch?style=for-the-badge&labelColor=0d1117)](https://github.com/dhani748/anime-watch/releases)
[![Downloads](https://img.shields.io/github/downloads/dhani748/anime-watch/total?style=for-the-badge&labelColor=0d1117)](https://github.com/dhani748/anime-watch/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=for-the-badge&labelColor=0d1117)](LICENSE)

</p>

<p align="center">

[**Download**](#download) · [**Features**](#features) · [**Quick Start**](#quick-start) · [**Releases**](https://github.com/dhani748/anime-watch/releases) · [**Disclaimer**](#disclaimer)

</p>

> [!IMPORTANT]
> AnimeWatch is an independent community project. It is not affiliated with,
> endorsed by, or connected to MyAnimeList, AniList, Jikan, or any anime
> licensor. Streams resolve via third-party providers — availability varies.

<!--
## Screenshots

Drop images into `docs/screenshots/` and remove these comment tags.

| Mobile app | Web app |
| --- | --- |
| ![Mobile home](docs/screenshots/mobile-home.png) | ![Web home](docs/screenshots/web-home.png) |
| ![Player](docs/screenshots/mobile-player.png) | ![Watchlist](docs/screenshots/web-watchlist.png) |
-->

---

# Features

| #### Watch & Tracking | #### Experience & Platform |
| --- | --- |
| **Search, browse & watch** trending, seasonal and filtered anime. | **Mobile app** (Expo, Material 3, SecureStore auth, SQLite cache, push). |
| **Episode streams & embeds** with resume and continue-watching. | **Web app** (Vite + React, Tailwind, query-cached API layer). |
| **Offline downloads** on mobile with a local library. | **Shared packages** — one `@anime/api` + `@anime/auth` core for web and mobile. |
| **Watchlist** (`WATCHING`, `COMPLETED`, `PLAN_TO_WATCH`) and favorites. | **JWT auth** (access + refresh), BCrypt, `USER` / `ADMIN` roles. |
| **Reviews** with 1–5 stars, one per user per anime, ownership checks. | **Fast API** — Ehcache 3, Guava rate limits, Postgres + H2 dev mode. |
| **News feed** with admin publishing and public paginated reads. | **OTA updates** — ship mobile JS fixes without a reinstall. |

---

# Download

<p>

[![Download for Android](https://img.shields.io/badge/Download_for_Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/dhani748/anime-watch/releases/latest)
[![Backend & Web](https://img.shields.io/badge/Backend_%26_Web-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/dhani748/anime-watch/releases/latest)

</p>

Grab the latest signed APK from the
[**Releases**](https://github.com/dhani748/anime-watch/releases/latest) page.
Sideloading needs **Install unknown apps** allowed for the browser you
download with. Each release also ships the backend JAR and the web `dist`
bundle as attached assets.

| Artifact | File | Install |
|----------|------|---------|
| Android app | `animewatch-<version>.apk` | Download → tap → install |
| Backend | `anime-backend-<version>.jar` | `java -jar` with env (see Quick Start) |
| Web frontend | `animewatch-web-<version>.zip` | Unzip to any static host |

No release published yet? Build your own APK in one command
([details](luffy/INSTALL_MOBILE.md)):

```bash
cd luffy
EXPO_PUBLIC_API_URL=https://<backend-host> \
  eas build --platform android --profile preview
```

## Publishing a release (maintainer)

```bash
# 1. Build the APK (see command above), download it from the EAS link
# 2. Build backend + web
mvn clean package -DskipTests
cd frontend && VITE_API_URL=https://<backend-host> npm run build && cd ..
# 3. Publish everything to GitHub Releases
gh release create v1.0.0 \
  path/to/animewatch-1.0.0.apk \
  target/anime-backend-*.jar \
  --title "v1.0.0" --notes "See README for install steps"
```

---

# Quick Start

## Backend (zero-config dev, H2 in-memory)

```bash
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run
```

API on `http://localhost:8080` ·
Swagger at `http://localhost:8080/swagger-ui.html`.

## Backend (PostgreSQL, like prod)

```bash
export DB_URL=jdbc:postgresql://localhost:5432/anime_db
export DB_USERNAME=... DB_PASSWORD=...
export JWT_SECRET=$(openssl rand -base64 32)
export APP_BASE_URL=http://localhost:8080 APP_FRONTEND_URL=http://localhost:5173
export MAIL_HOST=smtp.gmail.com MAIL_PORT=587 MAIL_USERNAME=... MAIL_PASSWORD=...
mvn spring-boot:run
```

Full variable list in `.env.example`. `prod` uses `ddl-auto: validate`.

## Web frontend

```bash
npm install          # repo root (workspaces)
cd frontend && npm run dev     # empty VITE_API_URL => proxies /api to :8080
VITE_API_URL=https://<backend-host> npm run build   # production
```

## Mobile app

```bash
npm install          # repo root (workspaces)
cd luffy && npx expo start     # scan QR with Expo Go
```

## Backend Docker

```bash
docker build -t anime-backend .
docker run -p 8080:8080 -e SPRING_PROFILES_ACTIVE=prod \
  -e DB_URL=... -e DB_USERNAME=... -e DB_PASSWORD=... -e JWT_SECRET=... \
  -e APP_BASE_URL=... -e APP_FRONTEND_URL=... anime-backend
```

---

# Project Structure

```
├── src/main/java/com/animeSite/
│   ├── controller/      # 16 REST controllers (auth, anime, episodes, stream,
│   │                      # image-proxy, reviews, watchlist, favorites, news,
│   │                      # user, admin, import, notifications, health, codes, home)
│   ├── core/            # exceptions, ApiResponse envelope, audit, cache, specs
│   ├── security/        # JWT provider + filter
│   ├── service/         # business logic (auth, anime, reviews, mail, ...)
│   ├── persist/ + repo/ # JPA entities + repositories
│   ├── httpclient/      # Jikan + provider clients
│   └── pipeline/        # provider priority, diagnostics, recovery
├── frontend/src/        # pages, components, api shims, storage
├── luffy/src/           # expo-router app, services, SecureStore storage
├── packages/            # @anime/api, auth, constants, hooks, types, utils
└── scripts/             # API smoke test
```

| Component | Technology |
|-----------|-----------|
| Backend | Spring Boot 3.2, Java 21, PostgreSQL 14+ (H2 in dev) |
| Web | Vite 4, React 18, React Router 7, TanStack Query |
| Mobile | Expo 57, React Native 0.86, expo-router |
| Auth | JWT (jjwt 0.12) + Spring Security, BCrypt |

---

# Disclaimer

AnimeWatch is a community client for browsing public anime metadata (via
Jikan / MyAnimeList) and user-curated tracking. It hosts no media itself.
You are responsible for complying with your local laws and each provider's
terms of use.

---

# License

Released under the [MIT License](LICENSE).
