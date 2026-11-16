# Nieuw logopakket geïntegreerd — 3 november 2026

## Status

Na het uitstel is op expliciet verzoek de nieuwe APK gebouwd: `artifacts/android-tv/Natje-IPTV-AndroidTV-0.1.10-tv-debug.apk`. De build, ondertekening, native brandingresources en bytevergelijking van alle 26 rendererbestanden zijn gecontroleerd. Er is niets automatisch geïnstalleerd. De fysieke apparaatcontrole blijft open.

## Bron en behoud

- Aangeleverd pakket: `C:/Users/nadal/Downloads/Natje_IPTV_Logopakket.zip`.
- Alle 19 bestanden zijn ongewijzigd bewaard onder `src/renderer/public/branding/natje-2026/`.
- Controle: bronbestanden byte-voor-byte gelijk aan de ZIP.
- Alle 45 overige oorspronkelijke assets uit de baseline zijn ongewijzigd; geen oude assets verwijderd. Het bestaande `styles.xml` verwijst nu naar nieuwe brandingresources.
- Extra herstelkopie vóór brandingwijzigingen: `C:/Users/nadal/Downloads/Player-branding-backup-2026-11-03-210139`.
- Zenderlogo's blijven uitsluitend afkomstig van `channel.logo` uit de bestaande API-/playlistmapping. De brandingcomponent wordt alleen voor de appidentiteit gebruikt.

## Toepassing

| Locatie | Nieuwe bron |
|---|---|
| TV-keuzescherm | Horizontaal Natje IPTV-logo, responsive PNG-varianten |
| Login | Vierkante jointbadge naast bestaande applicatietitel |
| TV-toolbar | Vierkante badge |
| Windows-interface | Vierkante badge; bestaande bediening blijft behouden |
| Windows-venster en toekomstige installer | Nieuw `public/icons/natje-app.ico` met 7 formaten |
| Android-launcher | Nieuwe `natje_launcher`-resources voor 5 densities en adaptive-iconvariant |
| Android TV-banner | Aangeleverde `natje-tv-banner-320x180.png` |
| Android-opstartweergave | Nieuwe badge op donkere achtergrond |
| Browserfavicon | Aangeleverde 48px-badge |

De originele PNG's zijn niet hertekend of opnieuw gegenereerd. Alleen de ontbrekende Androidmaat 144px en Windows-ICO-formaten zijn technisch uit de aangeleverde badge afgeleid. Native adaptive-iconpadding beschermt het beeld tegen launchermaskers; de uiteindelijke weergave moet op hardware worden gecontroleerd.

## Relevante bestanden

- `src/renderer/components/BrandImage.tsx`
- `src/renderer/components/StartScreen.tsx`
- `src/renderer/components/SectionHub.tsx`
- `src/renderer/components/TvLayout.tsx`
- `src/renderer/components/AppLayout.tsx`
- `src/renderer/styles/app.css`
- `src/renderer/styles/tv.css`
- `src/renderer/public/branding/natje-2026/*`
- `src/main/index.ts`
- `index.html`
- `package.json`
- `public/icons/natje-app.ico`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/values/styles.xml`
- `android/app/src/main/res/values/natje_brand.xml`
- `android/app/src/main/res/drawable/natje_adaptive_foreground.xml`
- `android/app/src/main/res/drawable/natje_launch_background.xml`
- `android/app/src/main/res/drawable-nodpi/natje_joint_mark.png`
- `android/app/src/main/res/drawable-nodpi/natje_tv_banner.png`
- `android/app/src/main/res/mipmap-anydpi-v26/natje_launcher.xml`
- `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/natje_launcher.png`
- `scripts/prepare-branding.py`
- `scripts/test-branding.py`
- `scripts/test-branding-browser.mjs`

## Uitgevoerde controles zonder build

- `npm run typecheck`: geslaagd.
- `scripts/test-branding.py`: 19 bronbestanden intact, 5 Androidformaten, 7 ICO-formaten, TV-bannerafmetingen, XML-syntax, behoud oorspronkelijke assets: geslaagd.
- `node scripts/test-branding-browser.mjs`: loginbadge en horizontaal hublogo laden correct.
- `node scripts/test-tv-browser.mjs`: 23 controles geslaagd na integratie, inclusief vier viewportmaten, focus, logo-containment en beschrijvingsmodal.
- `node scripts/test-tv-matrix.mjs`: 14 controles geslaagd na integratie, inclusief 50/478/600 categorieën, vasthouden/versnellen, M3U, series en Windows HLS/EPG/bediening met testdata.
- Visuele inspectie van hub- en Live TV-screenshots uitgevoerd.

De screenshots gebruiken gesimuleerde account-/zendergegevens en een gesimuleerde native bridge. Geen echte IPTV-credentials gebruikt. De zwarte preview in deze screenshots is geen native playbacktest.

## Previews

- `artifacts/android-tv/verification/hub-960.png`
- `artifacts/android-tv/verification/live-960.png`
- `artifacts/android-tv/verification/login-new-branding-960.png`

## Openstaand

- [x] Nieuwe APK bouwen nadat het uitstel is opgeheven.
- [x] Controleren dat die APK alle nieuwe renderer- en native brandingassets bevat.
- [ ] Android-launcher, splash en TV-banner controleren op het fysieke apparaat.
- [ ] Echte native playback, fullscreen en fysieke D-pad-repeat op de TV-stick controleren.
