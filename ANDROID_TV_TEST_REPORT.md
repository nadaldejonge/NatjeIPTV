# Android TV Test Report

## Test Date

2026-07-11

## Environment

- OS: Windows
- Node: `v24.16.0`
- npm: `11.13.0`
- JDK installed: Eclipse Temurin JDK 21.0.11
- Android Studio installed via `winget`
- Android SDK installed under `%LOCALAPPDATA%\Android\Sdk`
- Android SDK command-line tools: `20.0`
- Android Platform Tools: `37.0.0`
- Android Emulator: `36.6.11.0`
- Android platform: API 36
- Android TV image installed: `system-images;android-36;google-tv;x86_64`
- AVD created: `Natje_Google_TV_1080p`

## Build Results

Passed:

- `npm install`
- `npm run typecheck`
- `npm run build`
- `npx cap sync android`
- `android/gradlew.bat assembleDebug`

Generated APK:

- `android/app/build/outputs/apk/debug/app-debug.apk`
- `artifacts/android-tv/Natje-IPTV-AndroidTV-debug.apk`

APK size observed after build:

- `8,649,569` bytes

## Baseline Findings

Before migration:

- `npm install` passed.
- `npm run build` passed.
- `npm run typecheck` failed due to:
  - React 19 JSX namespace return types.
  - Renderer importing preload types outside `tsconfig.renderer.json`.

After migration:

- `npm run typecheck` passed.
- `npm run build` passed.

## Emulator Result

AVD creation passed.

Emulator boot/install smoke test is blocked.

Observed blocker:

- Starting the Google TV emulator caused Windows to report pagefile/low-memory failures.
- PowerShell host failed to initialize with assembly-loading errors such as:
  - `Het wisselbestand is te klein voor het voltooien van deze bewerking.`
  - HRESULT `0x800705AF`

Because of this, ADB install, launcher verification, screenshots, DPAD smoke tests, logcat capture and player runtime tests could not be completed in this session.

No false emulator pass is claimed.

## DPAD Tests

Static implementation completed:

- Spatial navigation helper added.
- Strong focus-visible styling added.
- Buttons, inputs, selects and summaries participate in focus movement.

Runtime DPAD tests on emulator: blocked by Windows pagefile/memory failure during emulator boot.

## Player Tests

Static/native build validation completed:

- Media3 dependencies compile.
- `PlayerActivity` compiles.
- Capacitor bridge compiles.
- Debug APK builds.

Runtime player tests on emulator: blocked by Windows pagefile/memory failure during emulator boot.

Streams still requiring real hardware tests:

- HLS `.m3u8`
- MP4
- MPEG-TS
- RTSP
- HEVC/H.265
- AC3/EAC3
- DTS
- MPEG-2
- 4K/HDR/interlaced streams

## Logs

Logs are under:

- `artifacts/android-tv/logs/`

Important logs:

- `tooling-setup.log`
- `gradle-assemble-debug.out.log`
- `gradle-assemble-debug.err.log`
- `gradle-assemble-debug-2.out.log`
- `gradle-assemble-debug-2.err.log`
- `emulator-boot.log`
- `emulator.err.log`

## Remaining Limitations

- Emulator install/start test not completed due to host memory/pagefile failure.
- Native player event stream to React is scaffolded through methods, not fully event-driven yet.
- Media3 track selection bridge reports tracks, but explicit selection methods require device validation.
- Secure credential storage still needs Android Keystore-backed implementation before production.
- Cleartext HTTP is globally enabled for compatibility and should be narrowed once provider domains are known.

