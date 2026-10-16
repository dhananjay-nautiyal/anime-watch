# Contributing to AnimeWatch

Thanks for your interest in contributing! AnimeWatch is a community project —
every fix, feature and doc improvement helps.

## Project layout

| Path | What it is |
|------|------------|
| `src/` (repo root) | Spring Boot backend (Java 21, REST API) |
| `frontend/` | Web app (Vite + React) |
| `mobile/` | Android/iOS app (Expo + expo-router) |
| `packages/` | Shared workspace packages (`@anime/api`, `@anime/auth`, …) |
| `consumet-bridge/` | Self-hosted Consumet REST wrapper for provider resolution |
| `scripts/` | API smoke tests |

## Getting started

```bash
git clone https://github.com/dhananjay-nautiyal/anime-watch.git
cd anime-watch
npm install                 # installs all workspaces
```

**Backend** (zero-config dev, H2 in-memory):

```bash
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run
```

API on `http://localhost:8080` · Swagger at `/swagger-ui.html`.

**Web:**

```bash
cd frontend && npm run dev     # proxies /api to :8080
```

**Mobile:**

```bash
cd mobile && npx expo start    # scan QR with Expo Go
```

You only need the stack you are changing — a frontend-only fix does not
require running the backend.

## Workflow

1. **Find or open an issue** — check existing issues first; for larger
   changes, open one to discuss the approach before coding.
2. **Branch off `main`:**
   ```bash
   git checkout -b fix/short-description
   ```
3. **Make your change**, following the existing code style.
4. **Test it yourself:**
   - backend: `mvn test`, or hit the API with `scripts/` smoke tests / `anime-api-test.http`
   - web: `cd frontend && npm run build` must pass
   - mobile: `npm run lint` inside `mobile/`
5. **Commit with [Conventional Commits](https://www.conventionalcommits.org/):**
   ```
   feat(web): add season filter to browse page
   fix(backend): return 404 for unknown anime slug
   docs: clarify APK install steps
   ```
   Scopes in use: `backend`, `web`, `mobile`, `bridge`, `api`, `auth`.
6. **Open a pull request** with the template filled in. Link the issue with
   `Closes #123`.

## Guidelines

- **No secrets** in the repo — use `.env` files (see `.env.example`); never
  commit real credentials, DSNs or API keys.
- **User-facing changes need screenshots** in the PR when practical.
- **Keep PRs focused** — one concern per PR; unrelated refactors go separately.
- **Be kind** in issues and reviews. Everyone here is a volunteer.

## Reporting bugs

Use the **Bug report** issue template and include reproduction steps, your
environment (app version / browser / OS), and any console or log output.
Crashes with a stack trace or screen recording are much easier to fix.

## Good first issues

Look for the [`good first issue`](https://github.com/dhananjay-nautiyal/anime-watch/labels/good%20first%20issue)
label — these are scoped, self-contained and a friendly way to start.
