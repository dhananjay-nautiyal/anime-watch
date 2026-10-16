# Vega Replica (Expo / React Native)

This project is a functional clone scaffold produced after reverse-engineering the installed `vega.app` (version 5.0.1) on the connected Android device.

## Analysis summary

- **Artifact:** Android APK pulled from device (`vega.app`, versionCode 197, SDK 24–36).
- **Runtime stack:** React Native + Expo SDK 57, Hermes bytecode (`index.android.bundle`, HBC v98), New Architecture, React Compiler.
- **Native surface:** single main Activity, media-session service, notifee foreground service, remote-delivery service, Google Cast, PiP, leanback/TV support.
- **Navigation:** bottom tabs — Home, Search, Library (Watch List), Downloads (conditional), Settings; native-stack drill-downs (Info, ScrollList, Webview, SearchResults, DownloadedDetails, Appearance, Preferences, Extensions, Subtitle Preferences).
- **Data:** TMDB for metadata/posters; proxy endpoint for provider/stream resolution; user-configurable TMDB key and extension sources.
- **Feature set implemented in this replica:** home hero/rails, search, details with trailers, library (watchlist persistence), downloads screen, settings, source-provider abstraction.
- **Intentionally excluded:** unofficial stream extraction / copyrighted-content sourcing. The provider interface remains pluggable; add only sources you are authorized to use.

## Run

```bash
cd /home/luffy/anime-watch/vega-clone
# uses the monorepo node_modules
npx expo start --android
```

Type-check:

```bash
npx tsc --noEmit
```