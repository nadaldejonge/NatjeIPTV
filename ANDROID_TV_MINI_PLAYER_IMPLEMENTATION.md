# Android TV Mini-Player Implementation

Datum: 2026-07-11

## Eén-playerarchitectuur

Er is precies één ExoPlayer-instantie en één PlayerView, beheerd door
`android/app/src/main/java/nl/natje/iptvplayer/TvPlayerManager.java` (singleton).
De oude aanpak — een aparte fullscreen `PlayerActivity` die per start een nieuwe
ExoPlayer aanmaakte — is volledig verwijderd (bestand en manifest-entry).

```text
MainActivity (BridgeActivity)
├─ Capacitor WebView (React UI)
└─ PlayerView-overlay (via addContentView, boven de WebView)
   └─ ExoPlayer (één instantie, wisselt alleen van MediaItem)
```

Moduswissel mini ↔ fullscreen verandert alleen de LayoutParams van dezelfde
PlayerView; player en positie blijven intact, dus geen rebuffer of restart en
nooit dubbele audio. Elke playeraanmaak logt `Player instance: N` (Logcat-tag
`TvPlayer`) zodat dubbele instanties direct opvallen.

## Surface-keuze: TextureView

`res/layout/tv_player_view.xml` gebruikt `app:surface_type="texture_view"`.
Een SurfaceView boven de Capacitor-WebView geeft bekende z-order/clipping-
problemen (hole punching). TextureView rendert in de normale view-hiërarchie en
werkt betrouwbaar als overlay. Kost iets meer GPU-compositiewerk; hardware-
decoding blijft actief.

## Boundsberekening React → native

`src/renderer/components/TvMiniPlayer.tsx` meet de 16:9-placeholder met
`getBoundingClientRect()` en stuurt `{x, y, width, height, devicePixelRatio}`
naar de plugin (`setMiniPlayerBounds`). Native vermenigvuldigt met de
devicePixelRatio naar fysieke pixels en zet ze als marges op de overlay.
Updates lopen via ResizeObserver + window-resize + een 1,2s-vangnetinterval,
gethrottled met `requestAnimationFrame` en gededuplicieerd (alleen versturen
bij gewijzigde rect). De WebView is fullscreen, dus CSS-px × dpr = viewport-px.

## Fullscreenovergang

- OK op de gefocuste mini-player (React) → `enterFullscreen()` → zelfde
  PlayerView wordt MATCH_PARENT, controller aan (`controllerShowTimeoutMs =
  5000`, autoShow), PlayerView krijgt native focus en toont de controls direct.
- Back in fullscreen (MainActivity.dispatchKeyEvent): eerst controller
  verbergen als die zichtbaar is, daarna terug naar mini-bounds. De stream
  wordt nooit gestopt door Back.
- Terug in mini: controller uit, PlayerView niet-focusable, WebView krijgt
  focus terug; React-placeholder blijft het DPAD-focusdoel.

## Playercontrols en instellingen

- Fullscreen gebruikt de standaard Media3-controller: 5000 ms timeout, OK
  toont hem opnieuw, elke DPAD-actie reset de timer (Media3-gedrag, geen eigen
  tweede timer). Menu's (instellingen/trackselectie) houden de controller open.
- Het Media3-instellingenmenu bevat werkende opties: afspeelsnelheid en
  audiotrackselectie; de CC-knop regelt ondertiteling. Previous/Next-knoppen
  zijn verborgen; vooruit-/terugspoelknoppen worden dynamisch verborgen wanneer
  `player.isCurrentMediaItemSeekable()` false is (live), bepaald via de Media3
  timeline en niet via het contenttype.
- Trackselectie vanuit React is nu echt geïmplementeerd
  (`TrackSelectionOverride`), inclusief `disableSubtitles` via
  `setTrackTypeDisabled(TRACK_TYPE_TEXT, true)`.

## Lifecycle

- `onPause` (Home/achtergrond): player pauzeert; instantie blijft bestaan.
- `onDestroy`: release. Geen release bij modals, zoeken, filteren of
  categoriewissel — alleen expliciete Stop, nieuwe playlist, uitloggen, of het
  verlaten van het playerscherm (Back naar de hub).
- Zenderwissel: `setMediaItem → prepare → play` op dezelfde instantie;
  fallback-URL's worden zonder release geprobeerd bij een playerfout.

## React/Kotlin(Java)-bridge

Nieuwe pluginmethoden op `AndroidTvBridge`: `playMini`, `setMiniPlayerBounds`,
`enterFullscreen`, `exitFullscreen`, `stopPlayback`. Bestaande methoden
(`play`, `pause`, `resume`, `stop`, `seekTo`, `getState`, `getTracks`,
trackselectie) sturen nu de manager aan. Events naar React via
`notifyListeners`: `playerStateChanged` (idle/buffering/playing/paused/ended/
error + isLive/isSeekable/mode), `playerError` (code, message, cause —
gesaniteerd, geen URL's met credentials), `playerModeChanged`, `tracksChanged`,
`videoSizeChanged`.

## DPAD

- Hoofdscherm: toolbar (Zoeken/Playlist/Landen/Favorieten/Verversen) →
  categorieën → zenderlijst → mini-player, via de bestaande geometrische
  spatial navigation. OK op zender = afspelen in mini; OK op dezelfde actieve
  zender of op de mini-player = fullscreen.
- Modals (`TvModal.tsx`): focus-trap, eerste control krijgt focus, pijltjes
  blijven binnen de modal, Back/Escape sluit, vorige focus wordt hersteld.
- Back-volgorde (App.tsx + native): foutpaneel → modal → fullscreen-controller
  → fullscreen→mini → playerscherm→hub → hub→start → app afsluiten.

## Systeem-PiP

Niet geïmplementeerd. Het manifest heeft geen
`android:supportsPictureInPicture`, dus er wordt ook nergens een PiP-knop
getoond (geen lege of nepknop). De in-app mini-player dekt de kernbehoefte;
systeem-PiP kan later als aparte feature met
`enterPictureInPictureMode` + manifest-vlag.

## Fallbackstrategie

De voorkeursimplementatie (native PlayerView-overlay boven de WebView in
dezelfde activity, Fallback B uit de opdracht avant la lettre) is direct
gebouwd; er is geen tweede HTML5-player, geen tweede ExoPlayer en geen
screenshot-preview. Mocht TextureView op een specifiek toestel problemen
geven, dan is de enige wijziging het `surface_type`-attribuut in
`tv_player_view.xml`.
