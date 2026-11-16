# Android TV Xtream Debug Report

Datum: 2026-07-11

## 1. Symptoom

Na het invoeren van geldige Xtream-gegevens op de Android TV-app (TCL QLED 2025, Google TV) verscheen onderin uitsluitend de melding `Failed to fetch`. Dezelfde login werkte in de Windows Electron-versie. Er was geen verdere foutdiagnostiek zichtbaar.

## 2. Onderzochte loginflow

```text
Login button (StartScreen.tsx)
→ App.loginXtream() (src/renderer/App.tsx)
→ getPlatform() → androidPlatform (src/platform/androidPlatform.ts)
→ loadXtreamPortal() (src/shared/xtreamClient.ts)
→ [OUD] browser fetch() in de Capacitor WebView
→ Chromium blokkeert de request (CORS/mixed content)
→ fetch werpt TypeError: "Failed to fetch"
→ App.loginXtream() catch: setStatus(error.message)
→ statusbalk toont letterlijk "Failed to fetch"
```

De string `Failed to fetch` werd nergens in de eigen code gemaakt; het is de standaard `TypeError`-message van Chromium's `fetch()` die ongewijzigd in `setStatus()` belandde via `error.message`.

Alle Xtream-calls liepen via dezelfde `requestJson()` in `src/shared/xtreamClient.ts`: `player_api.php` (login), `get_live_categories`, `get_series_categories`, `get_vod_categories`, `get_live_streams`, `get_series`, `get_vod_streams`, `get_series_info`, `get_short_epg`. Ze faalden dus allemaal op dezelfde manier; de eerste (login) faalde direct.

## 3. Verschillen Windows versus Android

| Aspect | Windows (Electron) | Android (oud) | Android (nieuw) |
| --- | --- | --- | --- |
| Uitvoerende laag | Electron-mainproces (Node fetch via IPC `xtream:loadPortal`) | WebView `fetch()` vanuit origin `https://localhost` | Native laag via CapacitorHttp (HttpURLConnection) |
| CORS van toepassing | Nee | **Ja** | Nee |
| Mixed content (https-origin → http-server) | n.v.t. | **Geblokkeerd/beperkt** | n.v.t. |
| User-Agent | `Natjes-IPTV-player/0.1` | WebView-UA (fetch mag User-Agent vaak niet zetten) | `Natjes-IPTV-player/0.1` |
| Foutinformatie | Node-fout met `cause.code` | Alleen `TypeError: Failed to fetch` | Geclassificeerde `NetworkFailure` (dns/timeout/tls/…) |

Beide platforms gebruiken exact dezelfde gedeelde client (`src/main/xtreamClient.ts` re-exporteert `src/shared/xtreamClient.ts`), dus URL-opbouw, endpoints, parameters en parsing waren al identiek. Alleen de transportlaag verschilde.

## 4. Vastgestelde oorzaak

**Bewezen oorzaak (categorie): de Android-app deed Xtream-requests via browser `fetch()` in de Capacitor WebView.** Daar gelden twee blokkades die op Windows niet bestaan:

1. **CORS** — Xtream-panels sturen geen `Access-Control-Allow-Origin`-header; elke cross-origin `fetch` vanuit `https://localhost` wordt door Chromium geweigerd.
2. **Mixed content** — de WebView-origin is `https://localhost` (capacitor.config: `androidScheme: "https"`), terwijl Xtream-providers vrijwel altijd plain `http://` gebruiken. `fetch` naar http vanuit een https-context wordt geblokkeerd.

Beide manifesteren zich als hetzelfde generieke `TypeError: Failed to fetch` — Chromium geeft bewust geen detail. Welke van de twee op de TCL als eerste toesloeg is daarom niet uit de string af te leiden; beide zijn met de nieuwe transportlaag structureel weggenomen.

Uitgesloten oorzaken:

- INTERNET-permission: aanwezig in bron- én gemergde manifest (gecontroleerd in `app/build/intermediates/merged_manifests/debug/.../AndroidManifest.xml`).
- Cleartext op native niveau: `android:usesCleartextTraffic="true"` staat in het manifest en geldt ook voor de native HTTP-laag.
- URL-normalisatie: identiek op beide platforms (gedeelde code); via unit-tests bevestigd.
- Credentials/encoding: identiek op beide platforms; via unit-tests bevestigd.
- Pluginregistratie: `AndroidTvBridge` staat los van dit pad; login gebruikte de plugin niet.
- Provider/credentials zelf: login via de gedeelde client op de Node-transportlaag (zelfde pad als Windows) slaagde tijdens de test tegen de echte provider (471 live-, 142 series-, 224 VOD-categorieën).

## 5. Toegepaste fix

Structurele oplossing volgens het transport-interfacemodel:

```text
React UI
→ platformneutrale Xtream service (src/shared/xtreamClient.ts)
→ HttpTransport-interface (src/shared/httpTransport.ts)
   ├─ fetchTransport        → Electron-mainproces (Windows, ongewijzigd gedrag) en web-dev
   └─ capacitor-http        → Android native (src/platform/androidHttp.ts)
```

- `src/shared/httpTransport.ts` (nieuw): `HttpTransport`-interface, `TransportError` met `NetworkFailureKind`-classificatie (`dns | timeout | connection-refused | cleartext-blocked | tls | http | cors | parse | unknown`), `XtreamRequestError` met volledige gesaniteerde diagnostiek, URL/header-sanitisatie, en een fetch-fallbacktransport met timeout (20 s) en Node-`cause.code`-classificatie.
- `src/platform/androidHttp.ts` (nieuw): native transport via `CapacitorHttp` (onderdeel van `@capacitor/core`, geen extra plugin nodig). Vertaalt Java-exceptionteksten (`UnknownHostException`, `SocketTimeoutException`, `Connection refused`, `CLEARTEXT`, `SSL/trust anchor`, …) naar de bovengenoemde classificatie. Ondersteunt GET, queryparameters, redirects (native gevolgd), connect/read-timeouts, JSON- en tekstresponses, statuscodes, foutbody en headers.
- `src/platform/androidPlatform.ts`: installeert het native transport zodra het platform Android is.
- `src/shared/xtreamClient.ts`: elke call heeft nu een `step`-naam (bijv. `player_api login`, `live categories`), zodat zichtbaar is welke request in de keten faalde. HTTP-statusfouten, parse-fouten (incl. HTML-foutpagina-detectie) en transportfouten worden als `XtreamRequestError` met diagnostiek gegooid. Gesaniteerde diagnostiekregels gaan via `console.warn("[XtreamDiag] …")` naar Logcat (Chromium).
- `src/shared/subtitleText.ts` en de M3U-URL-import in `App.tsx` lopen nu ook via het transport (hadden op Android hetzelfde CORS-probleem).
- User-Agent `Natjes-IPTV-player/0.1` en `Accept: application/json` worden op Android nu daadwerkelijk native meegestuurd, gelijk aan Windows.

## 6. Netwerkconfiguratie

- `AndroidManifest.xml`: ongewijzigd. `INTERNET`-permission aanwezig; `android:usesCleartextTraffic="true"` blijft nodig omdat provider-URL's dynamisch door de gebruiker worden ingevoerd en vrijwel altijd plain http zijn — een domeinspecifieke `network_security_config` is daardoor functioneel niet mogelijk.
- TLS-certificaatvalidatie is nergens uitgeschakeld; certificaatfouten worden nu als `tls`-fout met detail aan de gebruiker getoond.
- Geen proxy of externe omweg toegevoegd.
- Nieuwe dependency: `@capacitor/app@8.1.0` (alleen voor correcte Back-knopafhandeling van het foutpaneel).

## 7. Foutdiagnostiek in UI

Nieuw component `src/renderer/components/ErrorPanel.tsx`, getoond bij elke Xtream-fout (login, categorie laden, zoeken, afleveringen). Toont: titel, stap, fouttype (menselijke classificatie), melding, server (alleen protocol+host+poort), HTTP-status, veilige responsepreview (max 300 tekens), transportlaag, lokale tijd, plus een sectie "Technische details" met endpoint, gesaniteerde URL, duur, foutcode, native oorzaak en responseheaders (secrets gemaskeerd).

DPAD-gedrag: paneel vangt alle pijltjestoetsen af (focus blijft in het paneel), omhoog/omlaag scrollt de detailweergave, Retry en Sluiten zijn focusbaar, Back/Escape sluit eerst het paneel (via `@capacitor/app` backButton-listener; buiten het paneel sluit Back de app zoals voorheen). Het paneel blijft staan tot de gebruiker het sluit. Credentials komen nergens in beeld: username/password worden in URL's en headers vervangen door `***` (querystring én `/live/{user}/{pass}/`-paden).

## 8. Uitgevoerde tests

- `scripts/test-xtream.mjs` (nieuw, `node scripts/test-xtream.mjs` na build): 26 tests, allemaal geslaagd — URL-opbouw (trailing slash, poort, encoding van speciale tekens, host zonder protocol), HTTP 401/403/404/500, lege response, HTML-foutpagina, ongeldige JSON, DNS/timeout/refused/cleartext/TLS-classificatie, step-onderscheid (login slaagt, vervolgcall faalt), onafgehandelde redirect, en sanitisatie (geen credentials in diagnostiek).
- Echte providerlogin via de gedeelde client op de Node-transportlaag (zelfde codepad als Windows): geslaagd.
- `npm run typecheck`: geslaagd (renderer, main, preload).
- `npm run build`: geslaagd.
- `npx cap sync android`: geslaagd (plugins: `@capacitor/app`, `@capacitor/preferences`).
- `gradlew assembleDebug`: BUILD SUCCESSFUL.
- Gemergde manifest gecontroleerd: `INTERNET` en `usesCleartextTraffic` aanwezig.
- APK-inhoud gecontroleerd: geen mpv/Windows-binaries (0 `.exe/.dll/.bat/.com`-entries).

## 9. Niet lokaal testbare onderdelen

- Het gedrag op de echte TCL Google TV (WebView-versie, DNS/netwerk van de tv zelf).
- Providers met certificaatproblemen of redirects naar andere hosts (alleen gesimuleerd getest).
- Emulator-UI-test: beperkt uitgevoerd (zie testinstructie hieronder voor de tv).

## 10. APK-locatie

- Build: `android/app/build/outputs/apk/debug/app-debug.apk`
- Oplevering: `artifacts/android-tv/Natje-IPTV-AndroidTV-debug.apk`
- SHA-256: `B442C447FA4B96F6069546C96434EB49A42BF3DA650233FF1A5D5B5AD8E3840A`
- Grootte: 8.939.972 bytes (~8,5 MB)
- Package: `nl.natje.iptvplayer`, versionCode 1, versionName 1.0

## 11. Instructie voor test op TCL Google TV

1. Verwijder eventueel de oude app (of installeer eroverheen): `adb install -r Natje-IPTV-AndroidTV-debug.apk`.
2. Start de app en log in met de Xtream-gegevens.
3. Verwacht resultaat: login slaagt en de hub met Live/Series verschijnt.
4. Als de login tóch faalt: er verschijnt nu een volledig foutpaneel in plaats van `Failed to fetch`. Geef dan door wat er staat bij **Stap**, **Fouttype**, **Melding**, **HTTP-status**, **Transport** en de tekst onder **Technische details** (bevat geen wachtwoorden). Daarmee is de resterende oorzaak direct aanwijsbaar.
5. Extra diagnose (optioneel, via adb): `adb logcat -s chromium:* | grep XtreamDiag` toont dezelfde gesaniteerde diagnostiekregels.

### Onderscheid in zekerheid

- **Bewezen**: de foutstring kwam van WebView-`fetch`; die laag blokkeert dit verkeer per ontwerp (CORS/mixed content); de nieuwe native transportlaag omzeilt beide en de volledige clientlogica werkt aantoonbaar tegen de echte provider.
- **Waarschijnlijk**: op de TCL was mixed content (https-origin → http-provider) de eerste blokkade, vóór CORS.
- **Niet reproduceerbaar/alleen op tv te testen**: exacte WebView-foutvolgorde op het TCL-toestel zelf.
