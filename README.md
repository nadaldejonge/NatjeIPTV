# NatjeIPTV

Natje's IPTV player for **Android TV and Windows**, built with React, TypeScript, Electron and Capacitor. Android TV playback uses Media3; Windows includes an MPV fallback.

## Download

[Download the latest Android TV APK](https://github.com/nadaldejonge/NatjeIPTV/releases/latest).

The current Android release is **0.1.16-branding**. It includes NatjeTube-matched launcher resource sizes and margins with glossy black/white IPTV artwork, the repeated-search fix, automatic Dutch subtitles and manual subtitle/audio selection. The downloadable APK is debug-signed. Install it over an existing compatible NatjeIPTV installation to retain app data.

## Features

- Xtream Codes login and M3U files/URLs; live TV, films and series.
- Category and country filters, bulk hide/show, per-section ordering and favourites/recent channels.
- TV remote navigation with accelerating scroll, progressive search results and loading feedback.
- Native mini/fullscreen playback, complete programme details and proportionally scaled channel logos.
- Films/episodes: automatic Dutch subtitles when available, CC language/off controls and audio selection in mini/fullscreen playback.
- Cached login with a startup loading screen; Android credentials use Keystore-backed encrypted storage.
- Windows playback controls, subtitles and MPV fallback remain available.

Availability of streams, programme information, subtitles and audio languages depends on the configured provider. No provider account, playlist or credentials are included.

## Get the source

Install Git LFS before cloning; the bundled Windows MPV binary is stored in LFS.

```bash
git lfs install
git clone https://github.com/nadaldejonge/NatjeIPTV.git
cd NatjeIPTV
npm ci
```

If you already cloned without downloading LFS files, run `git lfs pull`.

## Windows

Use Node.js 22 or newer.

```bash
npm run dev
npm run typecheck
npm run build:windows
npm run dist
```

The Windows build packages `public/mpv/mpv.exe`. If it is absent, in-app playback remains available and the interface reports that MPV is unavailable.

## Android TV

Use Node.js 22+, JDK 21 and Android SDK platform 36. Configure the local Android SDK path in `android/local.properties`; this machine-specific file is not committed.

```bash
npm run android:sync
```

Then run `android/gradlew.bat -p android :app:assembleDebug` on Windows, or `./android/gradlew -p android :app:assembleDebug` on Unix. Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

The repository excludes signing keys and local account/settings files. Locally built debug APKs use the builder's own signing key.

## Checks and documentation

```bash
npm run typecheck
npm run test:tv:unit
```

Browser tests use synthetic providers and a development-only platform fixture. Run `npm run dev:renderer` before the `scripts/test-tv-*.mjs` browser checks; Playwright/Chrome paths can be configured where supported by each script. Native instrumentation tests use locally generated synthetic media.

See `ANDROID_TV_FEATURE_INVENTORY.md` and the dated implementation/recovery reports for changes and the scope of verification. Historical reports retain their original local paths and build status.
