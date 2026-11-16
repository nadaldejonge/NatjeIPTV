# Natje IPTV — herstelversie 0.1.11

Datum: 3 november 2026. APK: `artifacts/android-tv/Natje-IPTV-AndroidTV-0.1.11-recovery-debug.apk`.

## Hersteld gedrag

- Android TV-preview en fullscreen: de Capacitor-bridge leest numerieke request-ID's nu ongeacht de Java-numberwrapper. Capacitor `getLong()` accepteerde kleine JSON-integers niet en gaf daardoor request-ID 0 terug; de React-laag negeerde vervolgens de spelerstatus en fouten. De native manager wordt bovendien opnieuw aangemaakt wanneer de Activity/WebView verandert, zodat de video-overlay niet aan een vernietigd scherm blijft hangen. Native start/fullscreen worden op de UI-thread afgehandeld en fouten worden doorgegeven. De previewactie kan een mislukte stream opnieuw starten en gebruikt daarna fullscreen. Xtream live heeft een `.ts`-fallback bij een mislukte `.m3u8`-start.
- Landenfilters herkennen nu ook ASIA/Azië en EX-YU/EX-U/EXXIU. Dezelfde herkenning geldt voor categorieën, zoekresultaten en opgeslagen zenders. Bij oudere instellingen waarbij vrijwel alle landen verborgen waren worden deze twee regiogroepen eveneens verborgen. Daarna blijven expliciete keuzes van de gebruiker leidend via filterversie 2.
- Android TV toont tijdens het controleren van opgeslagen instellingen meteen een afgeschermd startscherm. Een geldige opgeslagen login gaat door zonder het inlogformulier te tonen. De grote spinner wisselt elke twee seconden tussen “Laden…”, “Heb je al gedraaid…?” en “Inladen van categorieën en zenders…”. De opstartfase duurt minimaal circa tien seconden; alleen de eerste zichtbare/laatstgebruikte categorie en maximaal twaalf logo's worden voorbereid. De handmatige login en foutafhandeling blijven beschikbaar.
- Zoeken toont onmiddellijk een laadindicator en beschikbare resultaten uit reeds geladen gegevens, caches, favorieten en recent bekeken. Nieuwe resultaten verschijnen in porties terwijl het zoeken doorgaat. Tot 24 zichtbare categorieën worden per categorie met maximaal drie gelijktijdige aanvragen doorzocht. Bij grotere lijsten kunnen maximaal twee extra categorieaanvragen al resultaten tonen terwijl de brede aanvraag loopt. Verouderde aanvragen mogen de nieuwe zoekopdracht niet overschrijven. Reeds getoonde resultaten blijven selecteerbaar.

## Behoud en afbakening

De oorspronkelijke inventaris staat in `ANDROID_TV_FEATURE_INVENTORY.md`. Voor deze herstelronde is een broncodebackup gemaakt in `C:/Users/nadal/Downloads/Player-recovery-backup-2026-11-03-213341`.

De werkende versnellende bediening bij vasthouden is behouden. Branding, originele assets, proportionele zenderafbeeldingen, volledige programmabeschrijving, favorieten, accountopslag, login, Windows-player en overige bestaande bediening blijven aanwezig. De herstelronde vervangt geen playerframework en voegt geen runtime-dependencies toe. Er zijn geen echte provideraccounts gebruikt voor de verificatie.

## Verificatie

- TypeScript-typecontrole geslaagd.
- TV-unitcontroles: 25 geslaagd; Xtream-controles: 26 geslaagd.
- Browserregressie: 23 controles geslaagd; aanvullende TV/Windows-matrix: 14 controles geslaagd, inclusief synthetische HLS-weergave in Windows, Play/Pause/Stop/fullscreen, series, M3U, favorieten, grote lijsten en versnellende navigatie.
- Herstelbrowserflows: 5 geslaagd. Opstartscherm tijdens vertraagd instellingenlezen, native-bridgeafhandeling, gedeeltelijke zoekresultaten vóór de laatste aanvraag, migratie/handmatige regiokeuzes en brede zoekopdracht gecontroleerd. Resultaat: `artifacts/android-tv/verification-recovery/recovery-results.json`.
- Brandingcontrole: alle 19 aangeleverde logobestanden byte-identiek, launcherformaten/ICO/banner/XML gecontroleerd en alle 45 oorspronkelijke assets behouden.
- Native JVM-tests voor numerieke bridgewaarden: 2 geslaagd.
- Echte Android-instrumentatie op een geïsoleerde Android 8.1/API 27 x86_64-emulator: 2 geslaagd. De echte Capacitor-plugin en Media3 spelen een lokale synthetische HLS-stream. De test controleert een gedecodeerd, niet-zwart TextureView-frame, behoud van dezelfde player/media bij fullscreen en terugschakelen, Stop en een nieuwe manager na Activity-recreatie. Log: `logs/android-tv-0.1.11-native-runtime.log`; werkelijk gedecodeerd frame: `artifacts/android-tv/verification-recovery/native-preview-frame.png`.
- App-scoped Gradle-build, app-unittests en instrumentatie-APK-build geslaagd. De algemene root-taak voor alle Android-testmodules stuitte op een bestaande Kotlin-dependencybotsing in de Cordova-librarytestmodule; de app-taken en bovenstaande daadwerkelijke runtime-tests slagen.
- APK-signering gecontroleerd; dezelfde signer als 0.1.10. Alle 26 productie-rendererbestanden in de APK byte-vergeleken met de build. Testfixtures en instrumentatieklassen ontbreken in de productie-APK. Versiecode 11, build-ID `2026-11-03.11`.

De emulatorcontrole is een echte native playbacktest met synthetische media; dit is geen verificatie op de fysieke TV-stick of met de eigen providerstream. De browsercontroles gebruiken een nagebootste provider/native bridge. Volledige compatibiliteit met iedere externe provider kan daarmee niet worden gegarandeerd.

## Artefact

- Bestandsgrootte: 13.378.183 bytes.
- SHA-256: `24a9c2a7906cd43ba86f1828b1305dff4aff478f0bd355ecc3ad09dc5ee06398`.
- Installatie over versie 0.1.10 is mogelijk met dezelfde app-ID en signer. Er is uitsluitend op de geïsoleerde testemulator geïnstalleerd.
