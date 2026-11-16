# Natje's IPTV-player — implementatie en APK-oplevering

Datum: 3 november 2026. Project: `C:/Users/nadal/Downloads/Player`.

## A. Samenvatting

Android TV is binnen de bestaande React/Capacitor/Media3-architectuur verbeterd. De zwart-witte uitstraling is behouden en het aangeleverde nieuwe logopakket is geïntegreerd. Geen framework-/playervervanging of nieuwe runtime-dependencies. De nieuwe debug-APK is succesvol gebouwd en gecontroleerd; niets is automatisch op een apparaat geïnstalleerd.

De oorspronkelijke functionaliteitsinventaris staat in `ANDROID_TV_FEATURE_INVENTORY.md`. De oorspronkelijke broncodebackup staat in `C:/Users/nadal/Downloads/Player-backup-2026-11-03-202903`; de extra brandingbackup in `C:/Users/nadal/Downloads/Player-branding-backup-2026-11-03-210139`.

## B. Gewijzigde en nieuwe bestanden

### Bestaande bronbestanden

- `src/platform/androidPlatform.ts`: instellingenupdates serialiseren.
- `src/platform/index.ts`: ontwikkeltestinjectie; ontbreekt aantoonbaar in productie-JavaScript.
- `src/renderer/App.tsx`: stabiele callbacks, gescheiden playbackcontext, requestgeneraties, caches, EPG-lifecycle en native eventcontrole.
- `src/renderer/components/ChannelList.tsx`: logische lijstcontext, scroll-/renderlimietbehoud, automatische renderchunks, loading/fouttoestanden, logo-fallback en versnellende navigatie.
- `src/renderer/components/GroupSidebar.tsx`: memoization, gecontroleerd scrollen, focusovergangen en versnellende navigatie.
- `src/renderer/components/TvLayout.tsx`: TV-panelen, paneelkoppen, focuszones, programma-detailmodal, platformgeschikte statusbalk en branding.
- `src/renderer/components/TvMiniPlayer.tsx`: volledige EPG-presentatie met detailsactie, proportionele preview, boundsupdates en actie-identifiers.
- `src/renderer/components/TvModal.tsx` en `ErrorPanel.tsx`: stabiele effecten en focusherstel.
- `src/renderer/components/SectionHub.tsx`: expliciete TV-variant en nieuw horizontaal logo.
- `src/renderer/components/StartScreen.tsx` en `AppLayout.tsx`: nieuwe appbadge.
- `src/renderer/components/PlayerPanel.tsx`: gedeelde veilige UTF-8/base64-decoder; bestaande Windows-controls en player blijven behouden.
- `src/renderer/lib/tvNavigation.ts`: expliciete zoneovergangen en repeat-reset.
- `src/renderer/main.tsx`: TV-stylesheet laden.
- `src/renderer/styles/app.css`: badgepresentatie zonder extra frame.
- `src/shared/natjePlayerApi.ts`: optionele playbackrequest-ID.
- `src/main/index.ts`: nieuw Windows-icoon.
- `android/app/src/main/java/nl/natje/iptvplayer/AndroidTvBridgePlugin.java`: request-ID doorgeven.
- `android/app/src/main/java/nl/natje/iptvplayer/TvPlayerManager.java`: behoud DOM-focus, native request-ID en correctie WebView-/overlay-oorsprong.
- `android/app/src/main/AndroidManifest.xml`: nieuwe iconen/banner, dezelfde app-ID.
- `android/app/src/main/res/values/styles.xml`: nieuwe opstartbranding.
- `android/app/build.gradle`: versionCode 10, versionName `0.1.10-tv`.
- `index.html`: nieuw favicon.
- `package.json`: aanvullende testscripts en nieuw Windows-icoon; dependencies behouden.

### Nieuwe modules, tests en assets

- `src/renderer/components/BrandImage.tsx`.
- `src/renderer/lib/useEvent.ts`, `requestContext.ts`, `tvFocus.ts`, `tvKeyRepeat.ts`.
- `src/shared/epg.ts`.
- `src/renderer/styles/tv.css`.
- `scripts/test-tv-unit.mjs`, `test-tv-browser.mjs`, `test-tv-matrix.mjs`, `fixtures/tv-platform.mjs`.
- `scripts/prepare-branding.py`, `test-branding.py`, `test-branding-browser.mjs`.
- Alle 19 aangeleverde bestanden onder `src/renderer/public/branding/natje-2026/`.
- `public/icons/natje-app.ico`.
- Nieuwe native resources `natje_launcher`, `natje_joint_mark`, `natje_tv_banner`, `natje_adaptive_foreground`, `natje_launch_background`, `natje_brand` in de bijbehorende drawable-, mipmap- en valuesmappen; volledig overzicht in `ANDROID_TV_BRANDING_2026-11-03.md`.

De bestaande workflows vernieuwden daarnaast `dist`, de gekopieerde Android-webassets, compilerstatusbestanden, gegenereerde Capacitor-/Gradle-output en buildlogs. Bestaande versie-APK's en oude logo-/afbeeldingsbestanden zijn behouden.

## C. Technische oplossingen

| Probleem | Uitgevoerde oplossing |
|---|---|
| Home-scaling | Eigen TV-hubregels houden de twee secties naast elkaar; hoogte en veilige marges passen in de viewport. |
| Paneelverhouding | Flexibele 21:39:40-verhouding over de beschikbare inhoudsbreedte; geen vaste 230/400px-buitenpanelen. |
| Zendernamen | Compactere logoruimte, favoriet en nummer; naam maximaal twee regels. Provider-/playlistlogo blijft de bron; `contain` met binnenruimte voorkomt afsnijden. |
| Focus na selectie | Lijstidentiteit is een logische context, geen arrayreferentie. Playback-/EPG-updates resetten de lijst niet. Focusgeheugen gebruikt identifiers; native boundsupdates vragen niet steeds opnieuw WebView-focus. |
| Previewknoppen | Expliciete focuszones voor categorieën, zenders, preview, acties en toolbar. Links vanuit preview herstelt de laatste zender, ook boven index 90. |
| Categorieperformance | Memoization, stabiele callbacks en één gecontroleerde scrollactie. Geen nieuwe virtualisatielaag: de lokale browsermetingen gaven daar geen noodzaak voor; hardware blijft apart te meten. |
| Renderpaginering | Automatisch stappen van 90 toevoegen tijdens scrollen of navigeren. Geen extra TV-laadknop of nul-teller. De desktoplaadknop blijft bestaan. |
| Loading | Paneellokale spinner na 140ms, zonder resultaten kunstmatig te vertragen; afzonderlijke loading-, lege en foutpresentatie. |
| Oude responses | Contentgeneraties beschermen success, error en finally. Account-/bron-/sectiewissels trekken oude toestemming tot statewijziging in. |
| EPG | Bestaande Xtream-service behouden; UTF-8/base64-normalisatie, seconden/milliseconden, betrouwbare tijdgrenzen, expliciete onbekende-tijdfallback. Beschrijving staat in de preview en volledig scrollbaar in Details. |
| Playbackcontext | De afgespeelde zender is onafhankelijk van de bekeken categorie, zoekterm en zichtbare lijst. Stop en Fullscreen blijven aanwezig bij doorgaande playback. |
| Previewbounds | Via requestAnimationFrame samengevoegde resize-/scroll-/visualViewportupdates, DPR/scale en native oorsprongcorrectie. Gelijke bounds worden niet telkens opnieuw verstuurd. |
| Native fouten | Afgewezen play-Promises worden afgehandeld; request-ID's beschermen de React-eventafhandeling tegen oude aanvragen. |
| MPV-status | Alleen de misleidende Android-MPV-melding vervangen; Windows-MPV-functionaliteit behouden. |

Categoriecache: maximaal 12 items, 120 seconden. EPG-cache: maximaal 20 items, 90 seconden. Beide caches zijn sessiegebonden en worden bij bron-/loginwisseling gewist. EPG wordt aan een relevante programmatijdgrens opnieuw bekeken/opgehaald, met begrensde achtergrondherhaling voor ontbrekende data.

Vasthouden gebruikt een geleidelijke versnelling: `1 + heldSeconds^1.6` rijen per herhaalevent, maximaal 12. Fracties worden meegenomen voor een geleidelijke opbouw. Geen achtergrondscrolltimer; keyup/blur resetten de versnelling. Losse drukken blijven één stap. Dit werkt voor categorieën en zenders. De daadwerkelijke herhaalfrequentie van de fysieke afstandsbediening bepaalt mede de uiteindelijke snelheid.

## D. Visuele uitwerking

TV-kleuren zijn donker en grotendeels zwart-wit: achtergrond `#08090b`, panelen `#111315`, tekst `#f3f3f3`, neutrale randen `#303338`. Focus gebruikt een dunne 1px-rand `#c7ccd3`, zonder blauwe previewglow of grote schaaltransformaties. Hoverovergangen duren ongeveer 110–120ms. Typografie, spacing en maten gebruiken begrensde responsieve tokens. Belangrijke inhoud heeft ongeveer 5% schermmarge.

De nieuwe appbadge en het horizontale logo worden alleen voor appbranding gebruikt. Zenderafbeeldingen blijven hun oorspronkelijke koppeling houden. Alle 19 aangeleverde bestanden zijn bytegelijk bewaard; 45 overige bestaande assets zijn onveranderd en geen oude assets zijn verwijderd.

Screenshots met testdata: `artifacts/android-tv/verification/hub-960.png`, `live-960.png`, `preview-focus-960.png`, `programme-details-960.png`, `login-new-branding-960.png`, `windows-regression.png`. Ook hub-/Live-screenshots op 854×480, 1280×720 en 1920×1080 zijn aanwezig. De zwarte TV-preview in tests is een gesimuleerde native bridge, geen echte videoweergave.

## E. Tests en build

| Controle | Resultaat |
|---|---|
| `npm run typecheck` | Geslaagd, inclusief renderer/main/preload |
| `npm run test:tv:unit` | 21 geslaagd |
| `node scripts/test-xtream.mjs` | 26 geslaagd tegen vernieuwde buildoutput |
| `node scripts/test-tv-browser.mjs` | 23 geslaagd na nieuwe branding |
| `node scripts/test-tv-matrix.mjs` | 14 geslaagd na nieuwe branding |
| `scripts/test-branding.py` | Bronbestanden, maten, ICO, XML en behoud assets geslaagd |
| `node scripts/test-branding-browser.mjs` | Loginbadge en hublogo laden correct |
| `android/gradlew.bat -p android testDebugUnitTest --console=plain` | Geslaagd; de bestaande Android-test is slechts een voorbeeldtest |
| `npm run android:build:debug` | Geslaagd; renderer, Capacitor-sync en Gradle-APK |
| APK-ondertekening | Geldig; hetzelfde certificaat als de lokale 0.1.9-debug-APK |
| APK-inhoud | Alle 26 rendererbestanden bytegelijk aan de nieuwe output; 19 logo-packagebestanden en nieuwe native resources aanwezig |
| Productietestinjectie | `__NATJE_TEST_PLATFORM__` en `__fixture` ontbreken in de gebundelde JavaScript |

De browsermatrix controleert onder meer 50/478/600 categorieën, 40/90/120/240 zenders, zender 7→8, index 125, focusherstel bij terugkeer naar een categorie, versnelling/reset, oude categorie- en EPG-success/fouten, native afwijzingen, modals, M3U, series/fallbacks en Windows-EPG. Windows-HLS is met een lokaal gegenereerde H.264/AAC-HLS-fixture daadwerkelijk afgespeeld in desktop Chrome; Play/Pauze/Stop en browserfullscreen zijn gecontroleerd. Dit is geen volledige native Electron-/MPV-hardwaretest.

Er zijn geen resterende typecheck- of buildfouten. De build meldt een bestaande bundelgroottewaarschuwing (>500kB) en Gradle-flatDir-waarschuwingen. Er zijn geen dependencies bijgewerkt om die meldingen te verbergen.

## F. Performance

De laatste browsermatrix meet bij 40 samples per categoriegrootte een p95 van ongeveer 1,6ms voor synthetische keydown→DOM-focus-handleruitvoering bij 50, 478 en 600 categorieën. Dit sluit paint en native videoplayback uit. Er is geen vergelijkbare vóórmeting en geen meting op de fysieke stick; er wordt dus geen hardwareversnelling of 60fps-garantie geclaimd.

Meetdata: `artifacts/android-tv/verification/matrix-results.json`.

## G. APK

Bestand: `C:/Users/nadal/Downloads/Player/artifacts/android-tv/Natje-IPTV-AndroidTV-0.1.10-tv-debug.apk`.

- App-ID: `nl.natje.iptvplayer` — behouden.
- Versie: `0.1.10-tv`, versionCode 10.
- Renderer: `2026-11-03.10`.
- MinSDK 24, targetSDK 36.
- Grootte: 13.084.831 bytes.
- SHA-256: `93681db62fa35508acb4a241cb88ba7b08e756aca958effbe418c06fd2e39765`.
- Controlemanifest: `artifacts/android-tv/build-info-0.1.10.json`.
- Buildlog: `logs/android-tv-0.1.10-delivery-build.log`.

## H. Beperkingen

Geen fysiek Android TV-apparaat verbonden tijdens het onderzoek. Geen echte IPTV-credentials gebruikt en niets automatisch geïnstalleerd. Native resourcecompilatie en ondertekening zijn gecontroleerd; echte decoding, WebView-/native focusoverdracht, afstandsbedieningsrepeat, overscan en launcher-/splashweergave moeten nog op de stick worden bevestigd. Bestaande gebruikersgegevens zijn niet gemigreerd of gewist; het opslagformaat is behouden.

## I. Handmatige eindcontrole op de televisie

- [ ] Controleer nieuw appicoon, TV-banner, opstartweergave en login/hublogo.
- [ ] Open Live TV; controleer zenderafbeeldingen, tekst en paneelranden.
- [ ] Kies zender 7 en druk omlaag: direct zender 8.
- [ ] Herhaal dit bij een zender voorbij 90 en rond 125.
- [ ] Houd omhoog/omlaag ingedrukt: geleidelijk sneller; loslaten stopt direct.
- [ ] Open andere categorieën terwijl video doorloopt; Stop en Fullscreen blijven bereikbaar.
- [ ] Navigeer naar preview, actierij en terug naar de laatste zender.
- [ ] Open Fullscreen; Back brengt je terug zonder nieuwe streamstart.
- [ ] Open Details en lees/scroll de volledige programmabeschrijving; sluit en controleer focus.
- [ ] Controleer Favorieten, Recent bekeken, Zoeken, Landen, Series en een M3U-bron.
- [ ] Controleer login onthouden na opnieuw openen.
