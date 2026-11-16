# Android TV Implementation

## Architecture

The project now supports the original Windows Electron target and a new Capacitor Android target side by side.

- Windows still uses Electron main/preload/renderer.
- Android uses Capacitor with `webDir: "dist/renderer"`.
- Renderer code calls a platform abstraction instead of importing preload types directly.
- Android playback is routed to a native Media3/ExoPlayer activity through a Capacitor plugin named `AndroidTvBridge`.

## Platform Layer

New shared/platform files:

- `src/shared/natjePlayerApi.ts`
  - Shared platform API contract.
  - Fixes renderer type dependency on preload.
- `src/shared/xtreamClient.ts`
  - Platform-neutral Xtream API functions.
- `src/shared/subtitleText.ts`
  - Platform-neutral subtitle loading and SRT-to-VTT conversion.
- `src/platform/index.ts`
  - Runtime selector.
- `src/platform/electronPlatform.ts`
  - Uses the existing Electron preload API.
- `src/platform/androidPlatform.ts`
  - Uses Capacitor Preferences, browser fetch for Xtream, and native `AndroidTvBridge`.

## Capacitor

Added:

- `capacitor.config.ts`
- Android project under `android/`
- npm scripts:
  - `android:sync`
  - `android:open`
  - `android:build:debug`
  - `android:install`
  - `android:test`

Capacitor packages installed:

- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`
- `@capacitor/preferences`

## Media3 Player

Native Android files:

- `android/app/src/main/java/nl/natje/iptvplayer/AndroidTvBridgePlugin.java`
- `android/app/src/main/java/nl/natje/iptvplayer/PlayerActivity.java`

Media3 dependencies:

- `androidx.media3:media3-exoplayer`
- `androidx.media3:media3-exoplayer-hls`
- `androidx.media3:media3-exoplayer-dash`
- `androidx.media3:media3-exoplayer-rtsp`
- `androidx.media3:media3-ui`
- `androidx.media3:media3-session`

Implemented native player features:

- HLS/MP4/RTSP-capable Media3 playback via inferred `MediaItem`.
- Native fullscreen player activity.
- Play/pause via OK/Enter/media key.
- Back closes the player through normal activity behavior.
- Left/right seek for VOD.
- Fallback URL attempt when Media3 reports a player error.
- Basic player state and track reporting bridge.

Limitations:

- Explicit Media3 track selection methods are scaffolded but require device testing before final UX hardening.
- Player event callbacks from native to React are not fully wired yet; polling methods exist.

## Storage

Android settings use Capacitor Preferences under key `natje-player-settings`.

Current limitation:

- Xtream credentials are stored inside this Preferences payload. Before production, move credentials to Android Keystore-backed secure storage.

## Network

Xtream API functions were moved to `src/shared/xtreamClient.ts` and run through `fetch` on Android.

Android manifest sets:

- `android:usesCleartextTraffic="true"`

Reason: IPTV/Xtream providers often use HTTP streams. This should be narrowed with `network_security_config` once target provider domains are known.

## File Picker

Android local playlist import is implemented in `AndroidTvBridgePlugin.openPlaylistFile()` using `ACTION_OPEN_DOCUMENT`.

It supports reading content URIs and returns:

- `filePath`
- `content`

## DPAD Navigation

Added:

- `src/renderer/lib/tvNavigation.ts`

The renderer installs a global spatial-navigation helper:

- Arrow keys move focus geometrically.
- Focusable elements auto-scroll into view.
- Initial focus is assigned after render.

CSS focus styling was added in `src/renderer/styles/app.css`:

- Strong outline.
- Glow.
- Scale effect.

## Windows Compatibility

Existing Windows Electron scripts remain.

Validated:

- `npm run typecheck`
- `npm run build`

The Windows MPV fallback files remain under `public/mpv/` and are not copied into the Android APK asset tree by Capacitor.

