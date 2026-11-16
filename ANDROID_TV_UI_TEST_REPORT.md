# Android TV UI Test Report (mini-player + compacte interface)

Datum: 2026-07-11

## Omgeving

- Windows 11, Android Gradle build via Android Studio JBR (Java 21)
- Media3/ExoPlayer 1.8.0, Capacitor 8.4.x, compile tegen bestaande SDK-config
- AVD "Natje_Google_TV_1080p" was tijdens deze sessie **offline/niet responsief**
  (adb install en shell-commando's hingen); emulator-UI-tests konden daardoor
  niet worden uitgevoerd en er zijn geen screenshots gemaakt.

## Uitgevoerde tests (lokaal)

| Test | Resultaat |
| --- | --- |
| `npm run typecheck` (renderer/main/preload) | Geslaagd |
| `npm run build` (Vite + tsc) | Geslaagd |
| `npx cap sync android` | Geslaagd (@capacitor/app, @capacitor/preferences) |
| `gradlew assembleDebug` | BUILD SUCCESSFUL |
| `node scripts/test-xtream.mjs` (26 tests netwerklaag) | 26/26 geslaagd |
| APK-inhoud: geen mpv/.exe/.dll/.bat/.com | Bevestigd (0 entries) |
| APK bevat `tv_player_view` layout | Bevestigd |
| Windows-regressie (typecheck + build na alle wijzigingen) | Geslaagd |

## Door code geborgd (ontwerpgaranties)

- Eén ExoPlayer: aanmaak alleen in `TvPlayerManager.ensurePlayer()`; mini↔
  fullscreen wijzigt alleen LayoutParams. Instance-ID wordt gelogd.
- Controls-timeout: `setControllerShowTimeoutMs(5000)` + Media3-standaard
  timerreset bij elke key-interactie; menu's houden de controller open.
- Playback loopt door bij zoeken/filteren/modals: die flows raken de plugin
  niet aan; stop gebeurt alleen in `stopTvPlayback()` (expliciete Stop, nieuwe
  playlist, uitloggen, Back naar hub) en in `onDestroy`.
- Live zonder seekcontrols: FF/REW-knoppen volgen
  `player.isCurrentMediaItemSeekable()` (timeline, niet contenttype).

## Nog te testen op echte TCL Google TV

1. Mini-playertest: zender kiezen → video in mini-vlak, audio éénmaal,
   navigeren/zoeken/landenfilter terwijl video doorspeelt.
2. OK op mini-player → fullscreen zonder rebuffer; Back → terug naar mini.
3. Controls verdwijnen na ±5 s; OK toont ze opnieuw.
4. Instellingenmenu (snelheid/audio) en CC-knop in fullscreen.
5. Positionering van het native videovlak exact op de placeholder (1080p/4K,
   overscan) — bij afwijking is de boundsberekening de eerste verdachte
   (`TvMiniPlayer.tsx` ↔ `setMiniPlayerBounds`).
6. Zenderwissel: zelfde playerinstantie (Logcat `TvPlayer`: "Player instance"
   mag niet oplopen).
7. Stop-knop, lege staat, foutstaat met Opnieuw/Details.
8. Home en terug: hervatten zonder dubbele audio of zwart vlak.

## Bekende beperkingen

- Emulator-verificatie en screenshots ontbreken (emulator offline); de flows
  hierboven zijn alleen door codeconstructie en compilatie geborgd.
- Media3's instellingenmenu toont afspeelsnelheid ook bij live streams
  (standaardgedrag van de Media3-controller).
- Systeem-PiP is bewust niet geïmplementeerd (geen manifest-vlag, geen knop).
- De Windows-interface is ongewijzigd; de compacte TV-layout is Android-only
  (`TvLayout.tsx` wordt alleen gebruikt wanneer runtime "android" is).

---

## Update 2026-07-12 — compacte UI, keyboardmodel, login-persistentie

Nieuwe wijzigingen: focused/editing-toetsenbordmodel (TvTextInput), secure
loginopslag + automatische login, compacte accountregel, zoekresultaten in de
zoekmodal, Fullscreen/Stop-actierij, windowSoftInputMode stateAlwaysHidden.

Lokale resultaten:

| Test | Resultaat |
| --- | --- |
| npm run typecheck | Geslaagd |
| npm run build | Geslaagd |
| npx cap sync android | Geslaagd |
| gradlew assembleDebug (incl. security-crypto) | BUILD SUCCESSFUL |
| node scripts/test-xtream.mjs | 26/26 geslaagd |
| APK zonder Windows/MPV-binaries | Bevestigd |
| Windows-regressie (typecheck+build) | Geslaagd |

Emulator opnieuw offline; keyboard- en persistentietests (hoofdstukken 18/19
uit de opdracht) moeten op de echte TCL worden uitgevoerd. Belangrijkste
checks daar: (1) focus op veld opent géén toetsenbord, OK wel; (2) Back sluit
eerst het toetsenbord, daarna pas de modal; (3) na herstart logt de app
automatisch in en opent de hub; (4) Logout + herstart → géén automatische
login; (5) wachtwoord nergens zichtbaar.
