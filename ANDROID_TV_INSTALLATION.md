# Android TV Installation

## Requirements

- Node.js 22 LTS or newer.
- npm.
- JDK 17 or 21.
- Android SDK with:
  - Platform Tools
  - Command-line Tools
  - Android Emulator
  - Android SDK Platform 36
  - Build Tools
  - Google TV or Android TV system image

This implementation used:

- JDK: `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`
- SDK: `%LOCALAPPDATA%\Android\Sdk`

Recommended environment for the current shell:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:PATH"
```

## Build

```bash
npm install
npm run typecheck
npm run build
npx cap sync android
cd android
gradlew.bat assembleDebug
```

## APK Path

Primary Gradle output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Copied test APK:

```text
artifacts/android-tv/Natje-IPTV-AndroidTV-debug.apk
```

## Create Emulator

```powershell
sdkmanager.bat "platform-tools" "emulator" "platforms;android-36" "build-tools;36.0.0" "system-images;android-36;google-tv;x86_64"
avdmanager.bat create avd -n Natje_Google_TV_1080p -k "system-images;android-36;google-tv;x86_64"
```

If the host has limited RAM/pagefile, increase Windows virtual memory or close memory-heavy apps before booting the emulator.

## Start Emulator

```powershell
emulator.exe -avd Natje_Google_TV_1080p -no-snapshot -no-boot-anim -gpu swiftshader_indirect
adb wait-for-device
adb shell getprop sys.boot_completed
```

Wait until:

```text
1
```

## Install APK

```bash
adb install -r artifacts/android-tv/Natje-IPTV-AndroidTV-debug.apk
```

Resolve launch activity:

```bash
adb shell cmd package resolve-activity --brief nl.natje.iptvplayer
```

Start:

```bash
adb shell monkey -p nl.natje.iptvplayer 1
```

## DPAD Smoke Commands

```bash
adb shell input keyevent KEYCODE_DPAD_DOWN
adb shell input keyevent KEYCODE_DPAD_UP
adb shell input keyevent KEYCODE_DPAD_RIGHT
adb shell input keyevent KEYCODE_DPAD_LEFT
adb shell input keyevent KEYCODE_DPAD_CENTER
adb shell input keyevent KEYCODE_BACK
adb shell input keyevent KEYCODE_MEDIA_PLAY_PAUSE
```

## Screenshots

```bash
adb exec-out screencap -p > artifacts/android-tv/screenshots/startscreen.png
```

## Logcat

```bash
adb logcat AndroidRuntime:E Media3:D ExoPlayer:D Capacitor:D Chromium:D '*:S'
```

## Real Android TV Install

Enable developer options and ADB debugging on the TV. Pair/connect per the Android TV version.

Typical commands:

```bash
adb connect <TV-IP>:5555
adb install -r artifacts/android-tv/Natje-IPTV-AndroidTV-debug.apk
adb shell monkey -p nl.natje.iptvplayer 1
```

On newer Google TV versions, wireless debugging may require pairing:

```bash
adb pair <TV-IP>:<pairing-port>
adb connect <TV-IP>:<adb-port>
```


## Update 2026-07-11 — mini-player build

De APK bevat nu de compacte TV-interface met in-app mini-player (zie
`ANDROID_TV_MINI_PLAYER_IMPLEMENTATION.md`). Installatie ongewijzigd:

```powershell
adb install -r "C:\Users\nadal\Downloads\Player\artifacts\android-tv\Natje-IPTV-AndroidTV-debug.apk"
```

Installeren over de vorige versie heen kan; appdata en login blijven behouden.
Zonder adb kan de APK ook via Downloader, USB, cloudopslag of "Send Files to TV"
op de tv worden gezet.
