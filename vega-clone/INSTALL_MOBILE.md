# Install AnimeWatch on a phone (APK)

Anyone can install the Android app without source code, using an EAS
cloud build. The preview profile produces a plain `.apk` for sideloading
(no Play Store needed).

## What you need (builder only, once)

1. Node 20+ and an Expo account (`https://expo.dev/signup`).
2. `npm install --global eas-cli` then `eas login`.
3. A reachable backend. The app opens without one (offline banner), but
   login, anime lists and streaming need `EXPO_PUBLIC_API_URL` pointing
   at the Spring Boot backend, e.g. `https://anime-backend.onrender.com`.

## Build a shareable APK

```bash
cd luffy
# Replace the URL with your real backend:
EXPO_PUBLIC_API_URL=https://anime-backend.onrender.com \
  eas build --platform android --profile preview
```

When the build finishes, EAS prints a QR code + download link
(`https://expo.dev/accounts/.../builds/...`). Anyone who opens it on
Android downloads the `.apk`; tapping it installs the app
(allow "Install unknown apps" when prompted).

Notes:

- `eas.json` `preview` uses `"buildType": "apk"` + `"distribution":
  "internal"` exactly so the output is directly installable.
- The committed placeholder `https://YOUR_BACKEND_URL` in `eas.json`
  is intentional: never ship an APK baked with the author's LAN IP.
  Always pass the real `EXPO_PUBLIC_API_URL` at build time (or set it
  as an EAS dashboard secret / environment variable).
- `production` profile builds an `.aab` (Play Store upload); it also
  requires a real `EXPO_PUBLIC_API_URL` — the placeholder will not work.
- iOS: `eas build --platform ios --profile preview` needs an Apple
  Developer account; Android sideloading needs none.

## OTA updates (no reinstall)

`app.json` enables EAS Updates (`updates.url`). After the APK is
installed, JS-only changes ship with:

```bash
cd luffy
eas update --branch preview --message "fix: ..."
```

Native changes (permissions, `app.json` plugins, SDK upgrades) still need
a fresh APK build.
