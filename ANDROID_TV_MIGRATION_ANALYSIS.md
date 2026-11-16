# Android TV Migration Analysis

## 1. Executive summary

Deze repository bevat een Windows-only Electron desktopapp voor IPTV/M3U/Xtream playback. De huidige runtime bestaat uit een Electron main process (`src/main/*`), preload bridge (`src/preload/index.ts`) en React renderer (`src/renderer/*`). Playback gebeurt primair in de renderer via HTML5 `<video>` en `hls.js`; daarnaast is er een `PLATFORM-SPECIFIC` MPV fallback via `public/mpv/mpv.exe`, gestart met Node `child_process.spawn` vanuit `src/main/mpvController.ts`.

Belangrijkste conclusie: de UI, TypeScript models, M3U parsing, Xtream mapping en delen van de React state zijn `REUSABLE` of grotendeels herbruikbaar. De Electron shell, IPC/preload, lokale bestandsdialoog, JSON-opslag via Electron `app.getPath("userData")`, MPV fallback, Windows installer en Windows binaries moeten worden vervangen. Voor Android TV is Route B, Capacitor/WebView met native Media3/ExoPlayer bridge, voorlopig het meest realistisch. Route A met alleen HTML5 video is technisch eenvoudiger maar heeft een groot codec/TS-stream risico.

Belangrijkste blokkades:

- `BLOCKER`: `public/mpv/mpv.exe` is een Windows `.exe` en kan niet op Android draaien.
- `BLOCKER`: Electron main/preload/IPC bestaat niet in Android WebView/Capacitor.
- `HIGH RISK`: codecdekking is afhankelijk van Chromium/Electron, Windows/Electron `ffmpeg.dll` en MPV; Android TV-apparaten verschillen sterk per codec.
- `REQUIRES STREAM TEST`: echte providerstreams ontbreken; daardoor zijn HEVC, AC3/EAC3, MPEG-TS, redirects, headers en live-edge gedrag niet zeker te beoordelen.

## 2. Repository overview

Relevante structuur, buildoutput en caches grotendeels samengevat:

```text
.
├─ package.json
├─ package-lock.json
├─ pnpm-workspace.yaml
├─ vite.config.ts
├─ tsconfig.json
├─ tsconfig.base.json
├─ tsconfig.main.json
├─ tsconfig.preload.json
├─ tsconfig.renderer.json
├─ index.html
├─ README.md
├─ .env
├─ .gitignore
├─ public/
│  ├─ icons/app.ico
│  └─ mpv/
│     ├─ mpv.exe
│     ├─ mpv.com
│     ├─ mpv-register.bat
│     ├─ mpv-unregister.bat
│     └─ updater.bat
├─ samples/demo-playlist.m3u
├─ scripts/clean-renderer.mjs
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ mpvController.ts
│  │  ├─ playlistFile.ts
│  │  ├─ storage.ts
│  │  ├─ subtitleLoader.ts
│  │  └─ xtreamClient.ts
│  ├─ preload/index.ts
│  ├─ shared/
│  │  ├─ settings.ts
│  │  └─ xtream.ts
│  └─ renderer/
│     ├─ App.tsx
│     ├─ main.tsx
│     ├─ components/
│     ├─ lib/
│     ├─ public/
│     ├─ styles/app.css
│     └─ types/
└─ tools/epg-search-lab/
   ├─ server.mjs
   ├─ app.js
   ├─ index.html
   └─ styles.css
```

Buildoutput aanwezig maar niet bron van de app:

- `dist/`: gecompileerde main/preload/shared code en Vite renderer bundle.
- `release/`: Electron Builder Windows output, waaronder installer, `win-unpacked`, Electron `ffmpeg.dll`, Chromium DLLs en app executable.
- `.cache/`: EPG Search Lab cache volgens `tools/epg-search-lab/server.mjs`.
- `node_modules/`: geïnstalleerde packages; niet handmatig onderzocht als bron, behalve dat package-lock exact versies bevat.

Mapdoelen:

- `src/main`: Electron main process, IPC handlers, opslag, Xtream API, file-read, subtitle loader, MPV process control.
- `src/preload`: exposed `window.natjePlayer` bridge naar renderer.
- `src/renderer`: React UI, appstate, M3U parsing, HLS/HTML5 video adapter.
- `src/shared`: TypeScript types voor settings en Xtream.
- `public/mpv`: meegeleverde Windows MPV binary en batch helpers.
- `tools/epg-search-lab`: losse Node HTTP/SSE tool voor EPG zoeken, gebruikt `.env` en `.cache`; geen onderdeel van Electron app runtime.

## 3. Technology stack

Feiten uit `package.json`, `package-lock.json`, lokale runtime en configuratie:

| Onderdeel | Vastgesteld |
| --- | --- |
| Electron | spec `^36.0.0`, lock `36.9.5` |
| Node.js lokaal | `v24.16.0` tijdens analyse; geen `engines` veld in `package.json` |
| npm lokaal | `11.13.0`; lockfile `lockfileVersion: 3` |
| Package manager | npm lock aanwezig; `pnpm-workspace.yaml` bestaat maar dependencies staan in `package-lock.json` |
| TypeScript | spec `^5.8.0`, lock `5.9.3` |
| Frontend | React spec `^19.0.0`, lock `19.2.7`; React DOM `19.2.7` |
| Bundler | Vite spec `^7.0.0`, lock `7.3.5`; `@vitejs/plugin-react` `5.2.0` |
| UI library | `lucide-react` spec/lock `0.468.0` |
| State management | React `useState`, `useMemo`, `useEffect` in `src/renderer/App.tsx`; geen Redux/Zustand/router |
| Router | Geen router; schermstate `Screen = "start" | "hub" | "player"` |
| Database/opslag | JSON file via `src/main/storage.ts`; EPG lab cache via `.cache/*.json/xml` |
| HTTP-client | Native `fetch`; EPG lab gebruikt ook `undici.Agent` via Node import in `tools/epg-search-lab/server.mjs` |
| Playlistparser | Custom `parseM3u` in `src/renderer/lib/parseM3u.ts` |
| EPG-parser | Hoofdapp gebruikt Xtream `get_short_epg`; EPG lab parseert XMLTV met regex in `tools/epg-search-lab/server.mjs` |
| Videoplayer | HTML5 `<video>` + `hls.js`; MPV fallback via Windows binary |
| Codecimplementatie | Electron/Chromium media stack, Electron release `ffmpeg.dll`, Windows media/platform codecs, MPV binary |
| Native modules | Geen app-eigen `.node` modules gevonden buiten `node_modules`; native external binary `public/mpv/mpv.exe` |
| Testframework | Geen testframework gevonden |
| Packaging | `electron-builder` spec `^26.0.0`, lock `26.15.3`; NSIS Windows target |
| Updater | Geen Electron auto-updater code; MPV folder bevat `updater.bat`, maar geen `updater.ps1` in bron gevonden |
| Logging | `console.warn` in `storage.ts`, `console.error` in `mpvController.ts`, console logs in EPG lab |
| Monitoring | Geen foutmonitoring/crash reporting gevonden |

## 4. Current architecture

### Electron main process

Entry: `src/main/index.ts`.

- Maakt `BrowserWindow` met `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`.
- Laadt `VITE_DEV_SERVER_URL` in dev of `dist/renderer/index.html` in packaged mode.
- Registreert alle `ipcMain.handle(...)` handlers.
- Slaat vensterbounds op via `updateSettings` bij `mainWindow.on("close")`.
- Stopt MPV bij `before-quit` en `window-all-closed`.

### Preload process

Entry: `src/preload/index.ts`.

- Gebruikt `contextBridge.exposeInMainWorld("natjePlayer", api)`.
- Alle renderer-to-main calls gebruiken `ipcRenderer.invoke`.
- Exporteert `NatjePlayerApi = typeof api`.

### Renderer/frontend

Entry: `src/renderer/main.tsx`, root component `src/renderer/App.tsx`.

- `App.tsx` bevat centrale appstate: scherm, sectie, kanalen, series, episodes, favorieten, recent bekeken, credentials, portaldata, playlist URL, status, hiddenCountries, EPG info, MPV beschikbaarheid.
- Componenten: `StartScreen`, `SectionHub`, `AppLayout`, `PlaylistImport`, `SearchBar`, `GroupSidebar`, `ChannelList`, `PlayerPanel`, `StatusBar`.
- Videologic zit in `PlayerPanel.tsx` en `lib/hlsPlayer.ts`.

### Shared code

- `src/shared/settings.ts`: persistente settings/favorite types.
- `src/shared/xtream.ts`: Xtream API response types.

### Gegevensstromen

Xtream login:

```text
StartScreen login click
→ App.loginXtream()
→ electronApi.loadXtreamPortal(credentials)
→ preload ipcRenderer.invoke("xtream:loadPortal")
→ main ipcMain.handle("xtream:loadPortal")
→ xtreamClient.loadXtreamPortal()
→ fetch player_api.php + categories
→ settings.update xtream credentials
→ renderer state portal + hub screen
```

M3U file:

```text
PlaylistImport/StartScreen "Bestand"
→ App.openFile()
→ electronApi.openPlaylistFile()
→ ipc "playlist:openFile"
→ Electron dialog.showOpenDialog()
→ playlistFile.readPlaylistFile()
→ App.loadContent()
→ parseM3u()
→ normalizeChannel()
→ renderer channels state
```

Kanaal selecteren en afspelen:

```text
ChannelList button click
→ App.selectChannel(channel)
→ activeChannelId state
→ optional electronApi.loadXtreamShortEpg()
→ PlayerPanel receives active channel
→ attachStream(video, channel.url)
→ hls.js for .m3u8, otherwise video.src
→ HTML5 video decodes in Electron/Chromium
→ optional MPV button calls ipc "mpv:play"
→ main spawn(public/mpv/mpv.exe, args)
```

## 5. Functional inventory

| Functie | Aanwezig | Bestand(en) | Implementatie | Electron/Windows impact | Android TV impact |
| --- | --- | --- | --- | --- | --- |
| M3U/M3U8-import bestand | Ja | `src/main/index.ts`, `playlistFile.ts`, `parseM3u.ts` | Electron file dialog + Node fs read + custom parser | `PLATFORM-SPECIFIC` dialog/fs | Native picker/SAF of Web upload nodig |
| M3U/M3U8-import URL | Ja | `App.tsx`, `parseM3u.ts` | Renderer `fetch`, HTTP(S) URL validatie | Deels browsercompatibel | `REUSABLE`, CORS/provider tests nodig |
| Xtream Codes API | Ja | `xtreamClient.ts`, `xtreamMapper.ts`, `App.tsx` | `player_api.php`, live/series/VOD endpoints | Main-process fetch + IPC | Kan naar Capacitor HTTP/native of direct fetch; credentials veilig opslaan |
| Stalker Portal | Nee | Geen bewijs | Niet aanwezig | n.v.t. | Nieuwe implementatie nodig |
| Losse stream URL's | Deels | `PlaylistImport.tsx`, `parseM3u.ts` | Alleen via M3U URL/file; geen aparte single URL UI | n.v.t. | UI/logic toevoegen als vereist |
| Live televisie | Ja | `App.tsx`, `xtreamMapper.ts`, `PlayerPanel.tsx` | Xtream live categories/streams, M3U live list | Playback codecafhankelijk | Media3 aanbevolen |
| Films/VOD | Deels | `xtreamClient.ts`, `xtreamMapper.ts` | `loadXtreamVodStreams` en `mapXtreamMovies` bestaan, maar UI `Section` is alleen live/series | Geen actieve UI | UI/state uitbreiden |
| Series | Ja | `App.tsx`, `xtreamMapper.ts` | Categories, series list, episodes, fallback URL | Playback codecafhankelijk | Herbruikbare mapping, native player bridge |
| Catch-up/timeshift | Nee | Geen code gevonden | Niet aanwezig | n.v.t. | Nieuwe feature |
| EPG | Deels | `xtreamClient.ts`, `PlayerPanel.tsx`, `tools/epg-search-lab` | Hoofdapp korte Xtream EPG per live stream; lab-tool XMLTV/search | Lab is Node-only | Hoofdapp deels herbruikbaar; lab niet direct |
| Kanaalgroepen | Ja | `App.tsx`, `AppLayout.tsx`, `GroupSidebar.tsx` | Group state/filter | Browsercompatibel | DPAD focus verbeteren |
| Zoeken | Ja | `SearchBar.tsx`, `App.tsx` | Local filter en Xtream full-section search | Browsercompatibel | DPAD/input UX aanpassen |
| Favorieten | Ja | `App.tsx`, `settings.ts` | Persisted favorites in JSON settings | Electron storage | Capacitor Preferences/SQLite |
| Kijkgeschiedenis/recent bekeken | Ja | `App.tsx`, `settings.ts` | Laatste 10 live channels | Electron storage | Capacitor storage |
| Ouderlijk toezicht | Nee | Geen code gevonden | Niet aanwezig | n.v.t. | Nieuwe feature |
| Meerdere profielen | Nee | Geen code gevonden | Niet aanwezig | n.v.t. | Nieuwe feature |
| Login/accountbeheer | Deels | `StartScreen.tsx`, `App.tsx`, `xtreamClient.ts` | Xtream credentials opgeslagen | Wachtwoord plain JSON | Secure storage nodig |
| Playlistbeheer | Deels | `PlaylistImport.tsx`, settings last path/url | Laatste playlist URL/path | File path Windows-specifiek | Android URI/permissions |
| Export/import | Nee | Geen code gevonden | Niet aanwezig | n.v.t. | Nieuwe feature |
| Ondertitels | Ja/deels | `xtreamMapper.ts`, `subtitleLoader.ts`, `PlayerPanel.tsx` | VTT/SRT URL extract, SRT→VTT, `<track>` | Subtitle fetch via main | Media3 subtitle track support nodig |
| Audiotracks | Ja/deels | `hlsPlayer.ts`, `PlayerPanel.tsx` | hls.js audioTracks/native audioTracks | HTML5/hls.js | Media3 track selection nodig |
| Resolutiekeuze | Nee | Geen UI; hls.js level selection niet exposed | Niet aanwezig | n.v.t. | Native quality selector optioneel |
| Aspect ratio | Nee | Geen aspect ratio controls | Niet aanwezig | n.v.t. | Nieuwe player control |
| Hardware acceleration | Impliciet | Electron/Chromium defaults, release DLLs | Geen flags | Platformafhankelijk | Media3 hardware decode per device |
| Picture-in-picture | Ja | `PlayerPanel.tsx` | `document.pictureInPictureEnabled`, `requestPictureInPicture()` | Electron/Chromium API | Android TV niet gelijkwaardig; native overlay/PiP anders |
| Fullscreen | Ja | `PlayerPanel.tsx` | Fullscreen API + webkit/ms fallback | Browser API | Capacitor/native fullscreen handling |
| Multi-screen | Nee | Geen code gevonden | Niet aanwezig | n.v.t. | Nieuwe feature |
| Kanaal omhoog/omlaag | Nee | Geen dedicated handlers | Niet aanwezig | n.v.t. | DPAD/channel key support toevoegen |
| Nummerinvoer | Nee | Geen code gevonden | Niet aanwezig | n.v.t. | Toevoegen voor TV remote |
| Buffering-instellingen | Nee | Alleen hls.js defaults lowLatency/worker | Geen UI/config | Codec/player afhankelijk | Media3 LoadControl mogelijk |
| Reconnect | Deels | `PlayerPanel.retryPlayback()` | Max 2 retries voor non-live; fallback URL voor episodes | Browser timers | Native retry policy nodig |
| Proxy | Nee | Geen stream proxy in hoofdapp | Niet aanwezig | n.v.t. | Mogelijk nodig voor CORS/headers |
| Custom headers/cookies/referer | Nee | Alleen Xtream User-Agent in API fetch | Niet voor streams | Player mist headers | Media3 custom DataSource mogelijk vereist |
| DRM | Nee | Geen EME/DRM code | Niet aanwezig | n.v.t. | Nieuwe Media3 DRM implementatie als nodig |
| Lokale media | Nee/deels | M3U file kan lokale file niet parsen; `isProbablyUrl` accepteert alleen protocols | Geen lokale playback | n.v.t. | Nieuwe picker/player URI support |
| Opnemen/screenshots | Nee | Geen code gevonden | Niet aanwezig | n.v.t. | Nieuwe native features |
| Updates | Nee/deels | Electron auto updater niet gevonden; MPV updater.bat bestaat | Windows batch | Android update via Play/sideload |
| Logging/crash recovery | Minimaal | `console.*`, MPV exit handler | Geen persistent logs | Logging strategy nodig |

## 6. Video playback architecture

Playerengine:

- `src/renderer/components/PlayerPanel.tsx`: beheert `<video>`, playback state, controls, EPG display, subtitles, audio/subtitle selectors, PiP, fullscreen, retry.
- `src/renderer/lib/hlsPlayer.ts`: adapter die HLS via `hls.js` afhandelt of direct `video.src` zet.
- `src/main/mpvController.ts`: externe MPV fallback via Windows binary.

HLS-detectie:

```ts
const canPlayNative = video.canPlayType("application/vnd.apple.mpegurl") !== "";
const looksLikeHls = /\.m3u8($|\?)/i.test(url) || url.includes("m3u8");
```

Als HLS en `Hls.isSupported()`:

- `new Hls({ lowLatencyMode: true, enableWorker: true })`
- Events: `MANIFEST_PARSED`, `AUDIO_TRACKS_UPDATED`, `SUBTITLE_TRACKS_UPDATED`, `ERROR`
- `hls.loadSource(url)` en `hls.attachMedia(video)`

Als native of geen HLS:

- `video.src = url`
- Trackdetectie via `video.textTracks` en optioneel `audioTracks`
- Geen custom headers, cookies of stream proxy.

Playerstate:

- `playerState`, `hasError`, `isPaused`, `currentTime`, `duration`, `audioTracks`, `subtitleTracks`, `brightness`, `isFullscreen`.
- Video events: `waiting`, `playing`, `pause`, `loadedmetadata`, `timeupdate`, `stalled`, `error`.

Error/retry:

- Fatal hls.js error roept `options.onError("HLS fout: ...")`.
- `PlayerPanel` probeert bij fallback URL eerst volgende URL als `urlIndex < playbackUrls.length - 1`.
- Non-live retry: `retryPlayback()` maximaal twee keer, met resume rond `resumeTimeRef`.
- Live streams worden niet gereconnect via `retryPlayback` door `channel?.kind === "live"` guard.

MPV fallback:

- UI button in `PlayerPanel.tsx` roept `onPlayWithMpv(resumeTimeRef.current)`.
- `App.playWithMpv()` roept `electronApi.playWithMpv(activeChannel.url, startSeconds)`.
- IPC `mpv:play` komt in `src/main/index.ts` bij `playWithMpv`.
- `src/main/mpvController.ts` start:

```text
mpv.exe --force-window=yes --resume-playback=yes --save-position-on-quit=yes --keep-open=no [--start=N] URL
```

`PLATFORM-SPECIFIC`: MPV draait buiten de Electron window in een apart Windows proces (`windowsHide: false`).

## 7. Codec and native media analysis

### Aangetroffen binaries

| Bestand | Grootte | Doel | Platform |
| --- | ---: | --- | --- |
| `public/mpv/mpv.exe` | 118,310,400 bytes | MPV fallback player | Windows `.exe` |
| `public/mpv/mpv.com` | 3,584 bytes | MPV console launcher/helper | Windows |
| `public/mpv/*.bat` | klein | MPV register/unregister/updater | Windows shell |
| `release/win-unpacked/ffmpeg.dll` | buildoutput | Electron/Chromium media DLL | Windows |
| `release/win-unpacked/d3dcompiler_47.dll`, `libEGL.dll`, `libGLESv2.dll`, `vulkan-1.dll` | buildoutput | Electron graphics/runtime | Windows |

`public/mpv/mpv.exe` VersionInfo:

- Product/File version: `v0.41.0-753-gf88bcd25c`
- Company/FileDescription: `mpv`

### Codecbronnen

1. Electron/Chromium codecs: HTML5 `<video>` decodeert via Electron/Chromium; releaseoutput bevat `ffmpeg.dll`.
2. Windows/platform codecs: Electron/Chromium kan hardware/media stack van Windows gebruiken; geen expliciete flags gevonden.
3. Externe binary: MPV fallback via `public/mpv/mpv.exe`.
4. Native Node modules: geen app-eigen `.node` modules gevonden buiten `node_modules`.
5. Hardware decoding: niet expliciet geconfigureerd; afhankelijk van Electron/Chromium/MPV defaults en GPU.

Geen transcoding gevonden. De app decodeert streams; er is geen FFmpeg CLI, remux of transcode pipeline in broncode.

`BLOCKER`: `public/mpv/mpv.exe`, `.com` en `.bat` kunnen niet in Android APK als uitvoerbare playback backend worden hergebruikt.

## 8. Supported stream formats

Op basis van code:

| Type | Bewijs | Huidige verwerking |
| --- | --- | --- |
| HTTP/HTTPS | `parseM3u.isProbablyUrl`, `loadUrl`, Xtream URLs | Fetch/API en video URL |
| HLS/M3U8 | `hlsPlayer.ts`, demo playlist, Xtream live default `.m3u8` | `hls.js` of native HLS |
| MP4 | Demo playlist en Xtream series/movie default | Direct `video.src` |
| MPEG-TS `.ts` | `xtreamMapper` verandert live `ts` naar `m3u8`; `PlayerPanel` error noemt TS-stream MPV nodig | HTML5 mogelijk problematisch, MPV fallback |
| RTMP | `parseM3u.isProbablyUrl` accepteert `rtmp://` | Wordt geparsed maar HTML5 player ondersteunt dit niet aantoonbaar |
| RTSP | `parseM3u.isProbablyUrl` accepteert `rtsp://` | Wordt geparsed maar HTML5 player ondersteunt dit niet aantoonbaar |
| SRT/VTT subtitles | `subtitleLoader.ts`, `xtreamMapper.extractSubtitleLinks` | Subtitle URLs omgezet naar VTT blob `<track>` |
| Blob URLs | `PlayerPanel.tsx` maakt `URL.createObjectURL` voor subtitles | Alleen subtitles |

Niet gevonden: DASH/MPD, UDP, RTP, WebSocket streams, custom protocols, stream proxy, custom stream headers, Bearer auth, Basic auth helper, cookies, referer, CORS workaround, certificaatuitzonderingen.

`REQUIRES STREAM TEST`: providerstreams kunnen query credentials, redirects, unusual MIME-types, `.ts`, HEVC, AC3/EAC3 of geo/cert issues hebben die niet uit demo data blijken.

## 9. Electron dependencies

| Onderdeel | Bestand(en) | Huidig platform | Android-compatibel | Benodigde vervanging | Complexiteit |
| --------- | ----------- | --------------: | -----------------: | -------------------- | ------------ |
| `BrowserWindow` | `src/main/index.ts` | Electron desktop | Nee | Capacitor Activity/WebView | Hoog |
| `ipcMain`/`ipcRenderer` | `src/main/index.ts`, `src/preload/index.ts` | Electron | Nee | Capacitor plugin bridge | Hoog |
| `contextBridge` | `src/preload/index.ts` | Electron | Nee | `window.Capacitor`/custom plugin API | Middel |
| `dialog.showOpenDialog` | `src/main/index.ts` | Electron desktop | Nee | Android Storage Access Framework/file picker | Middel |
| `app.getPath("userData")` | `src/main/storage.ts` | Electron | Nee | Capacitor Preferences/DataStore/SQLite | Middel |
| `app.isPackaged`, `process.resourcesPath` | `index.ts`, `mpvController.ts` | Electron | Nee | Android resources/assets paths | Middel |
| `BrowserWindow` bounds persistence | `index.ts`, `settings.ts` | Desktop window | Niet relevant | Android layout/orientation config | Laag |
| `contextIsolation: true`, `nodeIntegration: false` | `src/main/index.ts` | Electron security | Niet direct | Android WebView security config | Middel |
| `sandbox: false` | `src/main/index.ts` | Electron | Niet direct | Niet overnemen; Android sandbox native | Laag |

## 10. Node.js dependencies

| Afhankelijkheid | Locatie | Functie | Android WebView | Mogelijke Android-vervanging | Complexiteit |
| --- | --- | --- | --- | --- | --- |
| `node:fs/promises` | `storage.ts`, `playlistFile.ts` | JSON settings en M3U file read | Nee | Capacitor Filesystem/Preferences/SAF | Middel |
| `node:fs` | `mpvController.ts`, `scripts/clean-renderer.mjs` | MPV availability, clean script | Nee runtime | Native asset check/build scripts | Middel |
| `node:path` | `index.ts`, `storage.ts`, `mpvController.ts`, `vite.config.ts` | Path building | Nee runtime | Capacitor path APIs/native paths | Laag-middel |
| `node:url` | `index.ts`, EPG lab | `fileURLToPath` | Nee runtime | Niet nodig in WebView | Laag |
| `node:child_process` | `mpvController.ts` | Start MPV | Nee | Native Media3/libVLC/MPV-Android integration | Hoog |
| `process.env` | `index.ts`, EPG lab | Dev server URL, EPG credentials | Deels build-time | Capacitor env/build config/secure storage | Middel |
| `Buffer` | EPG lab | Base64/XMLTV decode | Nee in browser zonder polyfill | Browser `atob`/TextDecoder/native | Laag |
| `node:http` | EPG lab | Local lab server/SSE | Nee | Niet onderdeel van app of native service | Middel |
| `undici.Agent` | EPG lab | Timeouts/dispatcher | Nee | Native HTTP client/Capacitor HTTP | Middel |

## 11. Windows-specific dependencies

- `public/mpv/mpv.exe`: `BLOCKER`, Windows executable.
- `public/mpv/mpv.com`: Windows console helper.
- `public/mpv/mpv-register.bat`, `mpv-unregister.bat`, `updater.bat`: Windows batch scripts; `updater.bat` calls `pwsh`/`powershell`.
- `package.json` build target: `electron-builder --win nsis`, `win.icon`, NSIS settings.
- `release/Natje's IPTV-player Setup 0.1.0.exe`: Windows installer output.
- `release/win-unpacked/*.dll`: Windows Electron runtime output.
- `settings.lastPlaylistPath`: stores desktop file paths from `dialog.showOpenDialog`; Android needs URI permissions instead.
- `BrowserWindow` width/height/x/y settings: desktop-only concept.

Geen Windows-register code in app source gevonden, behalve MPV register/unregister batch helpers die MPV zelf met `--register` aanroepen.

## 12. Storage and database

Hoofdapp:

- Geen database.
- `src/main/storage.ts` bewaart één JSON-bestand:
  - Pad: `path.join(app.getPath("userData"), "settings.json")`.
  - Lezen: `readSettings()`.
  - Schrijven: `writeSettings()` en `updateSettings(patch)`.

Schema uit `src/shared/settings.ts`:

- `lastPlaylistType`
- `lastPlaylistPath`
- `lastPlaylistUrl`
- `xtream` met `serverUrl`, `username`, `password`
- `favorites`
- `recentWatched`
- `hiddenCountries`
- `lastGroup`
- `lastChannelId`
- `lastSection`
- `windowBounds`

Security note: Xtream password wordt plain in JSON opgeslagen. Voor Android moet dit naar secure storage of minimaal versleutelde app-private storage.

EPG Search Lab:

- `.cache/epg-search-cache.json`
- `.cache/xmltv.xml`
- Credentials via `.env` of environment variables.
- Niet ingebouwd in Electron UI.

Renderer localStorage:

- Alleen EPG lab `tools/epg-search-lab/app.js` gebruikt `localStorage` key `natje-epg-hidden-countries`.
- Hoofdapp gebruikt geen localStorage/IndexedDB.

## 13. Network architecture

Hoofdapp:

- M3U URL import: renderer `fetch(url)` in `App.loadUrl()`.
- Xtream API: main-process `fetch` in `src/main/xtreamClient.ts`.
- Xtream API User-Agent: `"Natjes-IPTV-player/0.1"`.
- Subtitle URL fetch: main-process `fetch` in `src/main/subtitleLoader.ts`.
- Streams: direct URL naar HTML5 video/hls.js of MPV; geen main-process proxy.

Xtream endpoints:

- `player_api.php`
- `action=get_live_categories`
- `action=get_series_categories`
- `action=get_vod_categories`
- `action=get_live_streams`
- `action=get_series`
- `action=get_vod_streams`
- `action=get_series_info`
- `action=get_short_epg&limit=5`
- Stream URLs: `/live/{username}/{password}/{stream_id}.{ext}`, `/series/...`, `/movie/...`

Niet gevonden in hoofdapp:

- Custom DNS
- Proxy
- TLS overrides
- Insecure TLS/cert bypass
- Cookie management
- Request timeout/retry voor hoofdapp API calls
- Stream request headers
- Uploads

EPG lab:

- Local server on `127.0.0.1:${EPG_SEARCH_PORT || 8787}`.
- SSE endpoint `/api/search-stream`.
- Uses `undici.Agent` with connect/header/body timeouts.
- Reads `.env` credentials.

## 14. IPC and preload API

| Kanaal/API | Richting | Aanroeper | Handler | Functie | Android-vervanging |
| ---------- | -------- | --------- | ------- | ------- | ------------------ |
| `openPlaylistFile` / `playlist:openFile` | renderer→main | `App.openFile()` | `src/main/index.ts` | Open file dialog, read M3U, store last path | Native file picker/SAF plugin |
| `readSettings` / `settings:read` | renderer→main | `App.useEffect()` | `storage.readSettings()` | JSON settings lezen | Capacitor Preferences/SQLite |
| `updateSettings` / `settings:update` | renderer→main | Diverse `App` functions | `storage.updateSettings()` | Settings patchen | Capacitor Preferences/SQLite |
| `loadSubtitle` / `subtitle:load` | renderer→main | `PlayerPanel` | `subtitleLoader.loadSubtitle()` | Fetch VTT/SRT, normalize to VTT | Native/JS fetch; Media3 subtitle source |
| `loadXtreamPortal` / `xtream:loadPortal` | renderer→main | `App.loginXtream()` | `xtreamClient.loadXtreamPortal()` | Login/categories | Capacitor HTTP/native service |
| `loadXtreamSeriesInfo` / `xtream:loadSeriesInfo` | renderer→main | `App.openSeries()` | `xtreamClient.loadXtreamSeriesInfo()` | Episodes | Capacitor HTTP/native service |
| `loadXtreamLiveStreams` / `xtream:loadLiveStreams` | renderer→main | `App.selectGroup/searchCurrentSection()` | `xtreamClient.loadXtreamLiveStreams()` | Live streams | Capacitor HTTP/native service |
| `loadXtreamSeries` / `xtream:loadSeries` | renderer→main | `App.selectGroup/searchCurrentSection()` | `xtreamClient.loadXtreamSeries()` | Series list | Capacitor HTTP/native service |
| `loadXtreamShortEpg` / `xtream:loadShortEpg` | renderer→main | `App.selectChannel()` | `xtreamClient.loadXtreamShortEpg()` | Short EPG | Capacitor HTTP/native service |
| `loadXtreamVodStreams` / `xtream:loadVodStreams` | renderer→main | API exposed, no active UI found | `xtreamClient.loadXtreamVodStreams()` | VOD streams | Add UI + service |
| `buildXtreamLiveUrl` / `xtream:liveUrl` | renderer→main | API exposed, no active call found | `liveStreamUrl()` | Build live URL | Pure TS helper or native |
| `buildXtreamSeriesUrl` / `xtream:seriesUrl` | renderer→main | API exposed, no active call found | `seriesStreamUrl()` | Build series URL | Pure TS helper or native |
| `buildXtreamMovieUrl` / `xtream:movieUrl` | renderer→main | API exposed, no active call found | `movieStreamUrl()` | Build movie URL | Pure TS helper or native |
| `isMpvAvailable` / `mpv:isAvailable` | renderer→main | `App.useEffect()`, `playWithMpv()` | `mpvController.isMpvAvailable()` | Check `mpv.exe` exists | Native player availability check |
| `playWithMpv` / `mpv:play` | renderer→main | `App.playWithMpv()` | `mpvController.playWithMpv()` | Spawn external player | Native Media3/libVLC player |
| `stopMpv` / `mpv:stop` | renderer→main | API exposed, app quit handlers | `mpvController.stopMpv()` | Kill MPV process | Native player stop/release |

Geen dynamisch samengestelde IPC-kanalen of `ipcRenderer.on` eventlisteners gevonden.

## 15. UI and Android TV remote readiness

Huidige UI is desktop/muis/keyboard-first:

- Buttons zijn native focusable, maar CSS bevat vooral `:hover`; er zijn beperkt zichtbare `:focus` states (`input:focus`, `.search-box:focus-within`).
- `ChannelList` gebruikt buttons, dus basis Tab/Enter werkt waarschijnlijk.
- `SearchBar` en `PlaylistImport` hebben Enter handlers in inputs.
- `PlayerPanel` gebruikt click/double-click op video voor play/fullscreen en mousemove/mousedown voor fullscreen controls.
- Geen centrale keyboard handler voor ArrowUp/Down/Left/Right, Enter, Back, Escape, channel up/down of nummerinvoer.
- Geen `tabIndex`, focus trap, spatial navigation library of Android TV DPAD model gevonden.
- `details/summary` country filter kan lastig zijn met DPAD.
- `overflow: hidden` op `html, body, #root`; interne lijsten moeten scrollen via CSS. TV focus-scroll gedrag moet getest worden.
- Layout minWidth in Electron window is `1120`; Android TV 1080p/4K is waarschijnlijk voldoende, maar overscan/10-foot readability is niet getest.

Beoordeling:

- Startscreen: deels keyboardbedienbaar via inputs/buttons, maar geen TV-friendly credential input flow.
- Hub: twee buttons en logout; waarschijnlijk makkelijk DPAD-ready te maken.
- Player workspace: kanaallijst en groepen zijn buttons, maar focusvolgorde, zichtbare focus en DPAD navigatie ontbreken.
- Player controls: buttons/select/range zijn browser controls; TV remote UX moet herschreven of sterk aangepast worden.

## 16. Current build and release process

Scripts uit `package.json`:

- `npm run dev`: start Vite op `127.0.0.1`, wacht op poort 5173, start Electron met `VITE_DEV_SERVER_URL`.
- `npm run dev:renderer`: alleen Vite.
- `npm run dev:electron`: wacht op Vite, start Electron.
- `npm run build`: `node scripts/clean-renderer.mjs`, compile main/preload met TypeScript, `vite build`.
- `npm run dist`: build plus `electron-builder --win nsis`.
- `npm run epg:search`: start EPG lab server.
- `npm run typecheck`: renderer, main en preload typecheck.

Buildconfig:

- Vite publicDir: `src/renderer/public`.
- Vite outDir: `dist/renderer`, `emptyOutDir: false`.
- Main/preload TypeScript outDir: `dist`.
- Electron `main`: `dist/main/index.js`.
- Electron Builder:
  - `appId`: `nl.natje.iptvplayer`
  - `productName`: `Natje's IPTV-player`
  - output `release`
  - files: `dist/**/*`, `package.json`
  - extraResources: `public/mpv` → `resources/mpv`, `public/icons` → `resources/icons`
  - Windows target: NSIS

Geen signing config, updatefeed, CI/CD workflow of auto-updater code gevonden.

## 17. Security findings

- Goed: `nodeIntegration: false`.
- Goed: `contextIsolation: true`.
- Let op: `sandbox: false`; niet direct overdraagbaar naar Android, maar geen reden om WebView ruimer te maken.
- Preload exposed brede API `window.natjePlayer`; IPC handlers valideren beperkt.
- `settings:update` accepteert arbitrary `Partial<StoredSettings>` vanuit renderer zonder schema-validatie.
- Xtream credentials worden plain opgeslagen in `settings.json`.
- `.env` bevat Xtream credentials voor EPG lab; is in `.gitignore`.
- Geen CSP in `index.html`.
- Remote image URLs (`channel.logo`) worden direct in `<img src>`.
- Stream/playlist URLs kunnen remote content laden; geen navigation guards of CSP gevonden.
- Geen certificaatvalidatie overrides gevonden.
- Geen `shell.openExternal`, custom protocols of webSecurity disable gevonden.

Android waarschuwing: neem plain credential storage en brede bridge niet 1-op-1 over. Gebruik een smalle Capacitor plugin API en secure storage.

## 18. Dependency classification

| Package | Versie | Huidig gebruik | Classificatie | Android-vervanging/opmerking |
| ------- | -----: | -------------- | ------------- | ---------------------------- |
| `react` | 19.2.7 | Renderer UI | 1 rechtstreeks herbruikbaar | Bruikbaar in Capacitor WebView |
| `react-dom` | 19.2.7 | Renderer mount | 1 rechtstreeks herbruikbaar | Bruikbaar in Capacitor WebView |
| `hls.js` | 1.6.16 | HLS playback in HTML5 video | 2 waarschijnlijk herbruikbaar | Route A kan dit gebruiken; Route B vervangt playback met Media3 |
| `lucide-react` | 0.468.0 | Icons | 1 rechtstreeks herbruikbaar | Web UI herbruikbaar |
| `@vitejs/plugin-react` | 5.2.0 | Build tooling | 2 waarschijnlijk herbruikbaar | Bruikbaar met Capacitor web build |
| `vite` | 7.3.5 | Renderer bundler | 2 waarschijnlijk herbruikbaar | Capacitor kan Vite output gebruiken |
| `typescript` | 5.9.3 | TypeScript build | 1 rechtstreeks herbruikbaar | Build tooling |
| `@types/node` | 24.13.2 | Main/preload/tool types | 5 overbodig in Android runtime | Alleen nodig voor Node tooling |
| `@types/react` | 19.2.17 | React types | 1 rechtstreeks herbruikbaar | Build tooling |
| `@types/react-dom` | 19.2.3 | React DOM types | 1 rechtstreeks herbruikbaar | Build tooling |
| `electron` | 36.9.5 | Desktop shell/runtime | 3 alleen Electron/Node | Vervangen door Capacitor/Android |
| `electron-builder` | 26.15.3 | Windows installer | 5 overbodig Android | Gradle/Android build |
| `concurrently` | 9.2.1 | Dev script | 5 overbodig Android runtime | Dev tooling optioneel |
| `cross-env` | 10.1.0 | Dev env script | 5 overbodig Android runtime | Dev tooling optioneel |
| `wait-on` | 8.0.5 | Dev Electron wait | 5 overbodig Android runtime | Niet nodig |

## 19. Reusability assessment

| Onderdeel | Beoordeling | Toelichting |
| --- | --- | --- |
| TypeScript models | `REUSABLE` | `src/shared/settings.ts`, `src/shared/xtream.ts`, `src/renderer/types/channel.ts` zijn platformarm |
| Xtream API client | Gedeeltelijk herbruikbaar | URL building/types bruikbaar; main-process fetch/IPC vervangen |
| Playlist parsing | `REUSABLE` | `parseM3u.ts` en `normalizeChannel.ts` browsercompatibel |
| EPG hoofdapp | Grotendeels herbruikbaar | `loadXtreamShortEpg` logic bruikbaar; transport/storage vervangen |
| EPG lab | Gedeeltelijk/niet runtime | Node server, `.env`, `.cache`, SSE tool; niet Android app-ready |
| Business logic/state | Grotendeels herbruikbaar | `App.tsx` flows bruikbaar, maar storage/player bridge aanpassen |
| UI components | Gedeeltelijk herbruikbaar | React UI kan mee, maar DPAD/focus/10-foot UX vereist aanpassingen |
| Styling | Gedeeltelijk herbruikbaar | Dark layout bruikbaar; focus/overscan/responsive TV polish nodig |
| Router | Niet relevant | Geen router |
| Opslag | Opnieuw implementeren | Electron JSON via userData vervangen |
| Logging | Opnieuw ontwerpen | Alleen console logs |
| Player | Gedeeltelijk/opnieuw | UI controls herbruikbaar; engine best native Media3 |
| Codecs | Opnieuw beoordelen | MPV/Electron codecs niet herbruikbaar op Android |
| Downloads | Niet relevant | Geen download feature buiten EPG cache |
| Updater/installer | Niet relevant/opnieuw | NSIS vervangen door APK/AAB/Play/sideload |
| IPC/preload | Opnieuw implementeren | Capacitor plugin bridge |
| Electron main process | Opnieuw implementeren | Services naar web/native |
| Tests | Ontbreekt | Nieuwe tests nodig |

## 20. Migration route assessment

### Route A — Capacitor met bestaande webfrontend en HTML5-player

Haalbaarheid: middel. Veel React UI en parsing kan mee. `hls.js` kan in WebView mogelijk HLS afspelen, maar Android WebView codec/containerdekking is minder voorspelbaar dan MPV/Electron desktop.

Risico's:

- `HIGH RISK`: MPEG-TS, HEVC, AC3/EAC3 en provider-specifieke streams.
- `HIGH RISK`: Geen custom stream headers/cookies/proxy.
- TV remote bediening moet alsnog worden aangepakt.

Noodzakelijk:

- Electron API vervangen door web/native service layer.
- Storage vervangen.
- File picker vervangen.
- Player compatibility testen met echte streams.

### Route B — Capacitor met bestaande webfrontend en native Media3/ExoPlayer-plugin

Haalbaarheid: hoogst aanbevolen voorlopig. React UI en business logic blijven grotendeels bestaan; playback verhuist naar native Android.

Benodigde bridge:

- `play(url, metadata, startPosition?)`
- `pause`, `resume`, `stop`, `seekTo`
- `selectAudioTrack`, `selectSubtitleTrack`
- Player events terug: state, buffering, error, duration/currentTime, tracks, live/VOD metadata.
- Optioneel: custom headers/cookies/DataSource config.

Voordelen:

- Betere Android TV codec/hardware-decode integratie.
- Track selection en subtitles native mogelijk.
- Beter fullscreen/remote/media-session gedrag.

Risico's:

- Native Kotlin/Java plugin nodig.
- Providerstreams moeten getest worden.
- MPV fallback moet conceptueel verdwijnen of vervangen worden.

### Route C — volledige native Android TV-app

Haalbaarheid: technisch schoon, maar herschrijving groot.

Herbruikbaar:

- Types als referentie.
- Xtream endpointkennis.
- M3U parsinglogica conceptueel.

Voordelen:

- Beste TV remote/focus/player integratie.
- Leanback/Compose/Media3 native patronen.

Nadelen:

- Grootste herschrijving.
- React UI niet direct bruikbaar.

Wanneer noodzakelijk:

- Als WebView performance/focus/codec bridge te beperkt blijkt.
- Als Play Store TV UX of native-only integratie doorslaggevend is.

### Route D — Android libVLC of MPV-Android backend

Zinvol als echte streams buiten Media3 vallen, vooral exotische MPEG-TS/RTSP/codec combinaties. Deze route lijkt repository-gebonden relevant omdat Windows MPV fallback al bestaat voor niet-ondersteunde streams. Nadeel: APK-grootte, licenties, ABI packaging en native integratiecomplexiteit.

Voorlopige voorkeur: Route B met Media3/ExoPlayer, plus `REQUIRES STREAM TEST` om te bepalen of libVLC/MPV-Android fallback nodig blijft.

## 21. Media3/ExoPlayer compatibility assessment

Waarschijnlijk passend:

- HLS `.m3u8` live streams.
- MP4 VOD/series.
- VTT subtitles.
- Audio/subtitle track selection.
- Live playback, buffering state, retry policies.

Mogelijk extra nodig:

- Custom `DataSource.Factory` voor User-Agent, headers, cookies, redirects of auth als provider dat vereist.
- Subtitle handling voor SRT: Media3 ondersteunt niet alles zonder conversie; huidige SRT→VTT converter kan web/native service blijven.
- Track selector UI bridge.
- Live offset/low latency tuning.

Problematisch/onzeker:

- `.ts` live streams waar huidige app bewust naar `.m3u8` probeert te switchen.
- HEVC/H.265, AC3/EAC3, DTS, MPEG-2 afhankelijk van Android TV device.
- RTSP/RTMP uit M3U parser: huidige parser accepteert ze, maar huidige HTML5 player ondersteunt ze niet aantoonbaar; Media3 RTSP kan apart, RTMP niet standaard.
- DRM: niet aanwezig, maar als provider dit eist is nieuwe Media3 DRM code nodig.

Geen garantie zonder representatieve streams en doelapparaten.

## 22. Risks and blockers

| Prioriteit | Risico | Impact | Waarschijnlijkheid | Voorgestelde mitigatie |
| ---------- | ------ | ------ | ------------------ | ---------------------- |
| BLOCKER | MPV Windows `.exe` niet bruikbaar op Android | MPV fallback verdwijnt | Zeker | Media3/libVLC/MPV-Android evalueren |
| BLOCKER | Electron IPC/main/preload bestaan niet | App services werken niet | Zeker | Capacitor plugin/service abstraction |
| HIGH RISK | Codecverschillen desktop vs Android TV | Streams spelen niet af | Hoog | Testmatrix met echte streams/devices |
| HIGH RISK | Credentials plain opgeslagen | Security/privacy risico | Hoog | Android secure storage |
| HIGH RISK | Geen DPAD/spatial navigation | Slechte TV UX | Hoog | Focus model en remote handlers ontwerpen |
| HIGH RISK | Stream headers/cookies ontbreken | Sommige providers falen | Middel | Media3 custom DataSource/Capacitor HTTP |
| Middel | Geen automated tests | Regressierisico | Hoog | Parser/client/player bridge tests toevoegen |
| Middel | VOD movie UI deels onafgemaakt | Feature gap | Middel | Movies section implementeren of scope uitsluiten |

## 23. Missing information and required tests

Nodig vóór migratie:

- Representatieve live streams per provider: HLS, `.ts`, MP4, eventuele RTSP/RTMP.
- Werkelijke codecs per stream: H.264, HEVC, MPEG-2, AV1, AAC, MP3, AC3, EAC3, DTS.
- Doelapparaten: Android TV versie, Google TV, Fire TV, chipset/ABI.
- Minimale Android SDK en distributie: sideload APK of Play Store AAB.
- Vereiste ABIs: `arm64-v8a`, `armeabi-v7a`, `x86_64`.
- DRM ja/nee.
- Custom headers/referer/user-agent/cookies per provider.
- Certificaat/TLS eisen.
- Gewenste opslag/security voor credentials.
- Remote control eisen: DPAD, back, media keys, channel up/down, nummerinput.
- APK-grootte limiet en licentiebeleid rond Media3/libVLC/MPV.
- Privacyvereisten en loggingbeleid.

## 24. Relevant file index

- `package.json`
  - Scripts, Electron Builder config, dependencies.
  - Windows NSIS output en `public/mpv` extraResources.

- `package-lock.json`
  - Exact geïnstalleerde packageversies.

- `vite.config.ts`
  - Renderer build naar `dist/renderer`.
  - `src/renderer/public` als publicDir.

- `tsconfig*.json`
  - Gescheiden main/preload/renderer TypeScript projecten.

- `src/main/index.ts`
  - Electron entrypoint, `BrowserWindow`, IPC handlers.
  - `PLATFORM-SPECIFIC`.

- `src/main/mpvController.ts`
  - Start/stopt MPV via `child_process.spawn`.
  - `BLOCKER` voor Android.

- `src/main/storage.ts`
  - JSON settings via Electron `app.getPath("userData")`.
  - Moet naar Android storage.

- `src/main/playlistFile.ts`
  - Node file read voor M3U.
  - Android picker/URI read nodig.

- `src/main/subtitleLoader.ts`
  - HTTP subtitle fetch, SRT→VTT.
  - Grotendeels herbruikbare logica.

- `src/main/xtreamClient.ts`
  - Xtream API client, URL builder, User-Agent.
  - Transport/secure storage aanpassen.

- `src/preload/index.ts`
  - `window.natjePlayer` API.
  - Vervangen door Capacitor bridge.

- `src/shared/settings.ts`
  - Settings schema.

- `src/shared/xtream.ts`
  - Xtream response types.

- `src/renderer/App.tsx`
  - Centrale state en appflows.
  - Grotendeels herbruikbaar na API abstraction.

- `src/renderer/lib/parseM3u.ts`
  - M3U parser, accepteert HTTP/HTTPS/RTMP/RTSP.
  - `REUSABLE`.

- `src/renderer/lib/normalizeChannel.ts`
  - Stabiele channel IDs.
  - `REUSABLE`.

- `src/renderer/lib/xtreamMapper.ts`
  - Mapt live/series/movies/episodes naar `Channel`.
  - `REUSABLE`, maar movie UI ontbreekt.

- `src/renderer/lib/hlsPlayer.ts`
  - HTML5/hls.js adapter.
  - Route A herbruikbaar, Route B vervangen door native player bridge.

- `src/renderer/components/PlayerPanel.tsx`
  - Video element, playback controls, subtitles, audio, PiP, fullscreen, retries.
  - UI deels herbruikbaar; engine vervangen.

- `src/renderer/components/*`
  - Desktop React UI.
  - DPAD/focus aanpassing nodig.

- `src/renderer/styles/app.css`
  - Desktop dark UI; hover/focus styling.
  - TV focus/overscan polish nodig.

- `public/mpv/*`
  - Windows MPV binary/scripts.
  - Niet herbruikbaar in APK.

- `tools/epg-search-lab/server.mjs`
  - Losse Node EPG/search lab met SSE, XMLTV cache, `.env` credentials.
  - Niet direct app-runtime; concepten eventueel herbruikbaar.

- `.env`
  - Xtream credentials voor EPG lab; waarden gemaskeerd in analyse.

- `samples/demo-playlist.m3u`
  - Demo HLS/MP4 testdata.

- `release/`
  - Windows build artifacts; bewijst Electron runtime DLLs en installer output.

## 25. Recommended next analysis steps

1. Verzamel 10-20 representatieve streams met codec/container info en test ze op Android TV met Media3.
2. Maak een kleine playback spike: Capacitor WebView UI + native Media3 player plugin.
3. Definieer een platform API interface die `window.natjePlayer` vervangt zonder Electron termen.
4. Ontwerp Android storage: secure credentials, settings, favorites, recent watched.
5. Ontwerp DPAD navigation/focus model voordat UI wordt gemigreerd.
6. Beslis of VOD/movies onderdeel is van scope; code bevat mapper/API maar geen actieve section UI.
7. Voeg parser/API unit tests toe vóór migratie.
8. Onderzoek licenties en APK-grootte als libVLC of MPV-Android fallback nodig blijkt.

## Verplichte samenvattingstabellen

### Platformafhankelijkheden

| Onderdeel | Bestand(en) | Huidig platform | Android-compatibel | Benodigde vervanging | Complexiteit |
| --------- | ----------- | --------------: | -----------------: | -------------------- | ------------ |
| Electron shell | `src/main/index.ts` | Windows/Electron | Nee | Capacitor Android Activity/WebView | Hoog |
| IPC/preload | `src/preload/index.ts`, `src/main/index.ts` | Electron | Nee | Capacitor plugin bridge | Hoog |
| MPV fallback | `src/main/mpvController.ts`, `public/mpv/mpv.exe` | Windows | Nee | Media3/libVLC/MPV-Android | Hoog |
| File picker | `src/main/index.ts` | Electron desktop | Nee | Android SAF picker | Middel |
| Settings file | `src/main/storage.ts` | Electron userData FS | Nee | Preferences/SQLite/SecureStorage | Middel |
| Windows installer | `package.json`, `release/` | Windows NSIS | Nee | Gradle APK/AAB | Middel |
| EPG lab server | `tools/epg-search-lab/server.mjs` | Node desktop | Nee runtime | Native/web service or omit | Middel |

### Playerfuncties

| Functie | Huidige implementatie | Bestand(en) | Android-equivalent | Verwacht herbruikbaar |
| ------- | --------------------- | ----------- | ------------------ | --------------------- |
| HLS playback | `hls.js` + `<video>` | `hlsPlayer.ts` | Media3 HLS or WebView hls.js | Deels |
| MP4 playback | direct `video.src` | `hlsPlayer.ts` | Media3 ProgressiveMediaSource | Deels |
| MPV fallback | external process | `mpvController.ts` | Native Media3/libVLC/MPV-Android | Nee |
| Audio tracks | hls.js/native tracks | `hlsPlayer.ts`, `PlayerPanel.tsx` | Media3 TrackSelector | UI deels |
| Subtitles | SRT/VTT to `<track>` | `subtitleLoader.ts`, `PlayerPanel.tsx` | Media3 subtitle tracks | Logic deels |
| Fullscreen | Fullscreen API | `PlayerPanel.tsx` | Native fullscreen Activity/player view | UI deels |
| PiP | Browser PiP API | `PlayerPanel.tsx` | Android PiP, probably not TV priority | Nee/deels |
| Retry | JS timers/reloadKey | `PlayerPanel.tsx` | Media3 retry/load error policy | Concept |

### Codecs en streamtypen

| Codec/protocol/container | Bewijs in repository | Huidige decoder | Waarschijnlijke Android-ondersteuning | Test vereist |
| ------------------------ | -------------------- | --------------- | ------------------------------------- | ------------ |
| HLS `.m3u8` | `hlsPlayer.ts`, demo playlist, Xtream live default | hls.js/Electron video | Media3 goed waarschijnlijk | Ja |
| MP4 | demo playlist, Xtream series/movie default | Electron video/MPV | Media3 goed waarschijnlijk | Ja |
| MPEG-TS `.ts` | `xtreamMapper.ts`, TS error copy | MPV fallback of attempted HLS | Device/Media3 afhankelijk | Ja |
| RTSP | `parseM3u.ts` accepts `rtsp://` | Niet bewezen afspeelbaar | Media3 RTSP mogelijk | Ja |
| RTMP | `parseM3u.ts` accepts `rtmp://` | Niet bewezen afspeelbaar | Niet standaard Media3 | Ja |
| VTT/SRT subtitles | `subtitleLoader.ts` | Browser text tracks | Media3 subtitle support/conversion | Ja |
| HEVC/AC3/EAC3/DTS | Niet expliciet in code | Mogelijk MPV/Electron/device | Device afhankelijk | Ja |

### IPC-overzicht

Zie hoofdstuk 14 voor volledig overzicht. Alle huidige IPC-kanalen zijn Electron-specifiek en moeten via een Android bridge worden vervangen.

### Dependencies

Zie hoofdstuk 18 voor packageclassificatie.

### Migratierisico's

Zie hoofdstuk 22 voor risico-overzicht.

