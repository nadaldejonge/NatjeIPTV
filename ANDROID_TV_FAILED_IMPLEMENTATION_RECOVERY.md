# Android TV Failed Implementation Recovery

Datum: 2026-07-12

## Resultaat

Nieuwe debug APK gebouwd:

`C:\Users\nadal\Downloads\Player\artifacts\android-tv\Natje-IPTV-AndroidTV-0.1.5-tvfix-debug.apk`

SHA-256:

`204B7FC481D50CFEB12385A7BF85C1CEA5C52707687406047D752163309C4FB8`

## Root cause oude interface

De Android source bevatte al een deel van de TV-implementatie, maar de build was niet betrouwbaar herkenbaar op de TV:

- `android/app/build.gradle` stond nog op `versionCode 1` en `versionName "1.0"`.
- Start- en hub-schermen gebruikten nog algemene desktopachtige schermen zonder Android-TV buildmarkering.
- Een tweede OK op dezelfde zender kon fullscreen openen vanuit de zenderlijst, waardoor het leek alsof de mini-playerflow niet klopte.
- Zonder zichtbare build-ID was niet te bewijzen of de geinstalleerde APK nieuw of oud was.

## Aangepast

- `versionCode` verhoogd naar `5`.
- `versionName` gezet op `0.1.5-tvfix`.
- Zichtbare badge toegevoegd: `Android TV build 2026-07-12.4`.
- Android-TV start/hub krijgen nu een herkenbare TV-styling en buildbadge.
- Zenderselectie houdt playback in mini-player; fullscreen opent alleen via mini-player.
- Media3 fullscreen controller timeout gezet op 4000 ms.

## Belangrijke bestanden

- `src/renderer/App.tsx`
- `src/renderer/components/StartScreen.tsx`
- `src/renderer/components/SectionHub.tsx`
- `src/renderer/components/TvLayout.tsx`
- `src/renderer/styles/app.css`
- `android/app/build.gradle`
- `android/app/src/main/java/nl/natje/iptvplayer/TvPlayerManager.java`

## Buildstappen

Uitgevoerd met polling via `Start-Sleep` en logs:

- `npm run typecheck`
- veilige cleanup van `dist/renderer`, `android/app/src/main/assets/public`, `android/app/build`
- `npm run build`
- `npx cap sync android`
- `gradlew.bat clean assembleDebug`

Logs:

- `C:\Users\nadal\Downloads\Player\logs\android-tv-recovery-build.log`
- `C:\Users\nadal\Downloads\Player\logs\android-tv-recovery-cap-sync.log`
- `C:\Users\nadal\Downloads\Player\logs\android-tv-recovery-gradle.log`

## APK-inspectie

Bevestigd in APK:

- `assets/public/assets/index-D5j0CHPj.js`
- `assets/public/assets/index-AVTltYtA.css`
- buildmarker `Android TV build 2026-07-12.4`
- `versionCode='5'`
- `versionName='0.1.5-tvfix'`
- `leanback-launchable-activity: nl.natje.iptvplayer.MainActivity`

## Runtime test

Niet uitgevoerd op TV/emulator.

`adb devices -l` gaf alleen:

`emulator-5554 offline`

Er was dus geen bruikbaar Android TV device of werkende emulator beschikbaar in deze sessie.

## Installatie

Upload deze APK:

`C:\Users\nadal\Downloads\Player\artifacts\android-tv\Natje-IPTV-AndroidTV-0.1.5-tvfix-debug.apk`

Na installatie moet je in de app zichtbaar zien:

`Android TV build 2026-07-12.4`

Zie je die badge niet, dan draait je TV nog een oude APK of een gecachte installatie.
