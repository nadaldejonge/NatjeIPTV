# Natje IPTV 0.1.13 — ondertiteling, audio en appicoon

Gebaseerd op 0.1.12. Backup vóór wijzigingen: `C:/Users/nadal/Downloads/Player-subtitles-backup-2026-11-16`. De bestaande functie-inventaris staat in `ANDROID_TV_FEATURE_INVENTORY.md`; bestaande categorievoorkeuren, favorieten, accounts, logosources en Windows-functionaliteit blijven behouden.

- Films/afleveringen selecteren automatisch een ondersteund Nederlands ondertitelspoor. Herkent nl/nld/dut en regiovarianten, met een label als aanvullende herkenning bij onbekende taal. Een volledig Nederlands spoor gaat vóór SDH/forced-only. Zonder Nederlands wordt niet automatisch een andere taal aangezet.
- CC onder de miniplayer: Automatisch Nederlands, Uit en alle ondersteunde ondertitelsporen. Handmatige keuze blijft behouden bij mini/fullscreen, audio- of snelheidswijziging en streamfallback. Bij een nieuw gestart videobestand begint automatisch Nederlands opnieuw.
- Audioknop onder de miniplayer: automatisch of een van de ondersteunde beschikbare audiotracks. Labels bevatten taal, variant en beschikbare technische aanduidingen.
- Fullscreen-instellingen behouden de zeven bestaande snelheden en Audio, en krijgen Ondertiteling erbij. Het fullscreen-CC-icoon opent dezelfde ondertitelkeuze. De bestaande speler en media blijven behouden bij de menukeuzes.
- Android-afleveringen proberen eerst de oorspronkelijke videoversie om ingebouwde ondertitels te behouden. De bestaande HLS-versie blijft fallback. Windows houdt zijn bestaande streamvolgorde.
- Fullscreen onder de miniplayer gebruikt alleen het icoon, dezelfde afmetingen als de favorietenknop. De bestaande bereikbaarheid, focusovergangen, Stop, Details en favorieten blijven behouden.
- Het Android-appicoon heeft een plattere uitvoering met dunne rand, zonder zware chromen omlijsting. Alleen launcher/TV-overzicht zijn aangepast; oorspronkelijke assets en in-app branding blijven bewaard.

## Verificatie

- TypeScript-controle; 29 TV-unitcontroles; 26 Xtream-controles geslaagd.
- 23 bestaande browsercontroles en 14 TV/Windows-matrixcontroles geslaagd, inclusief native-bridgeafhandeling, versnellende navigatie en synthetische HLS-weergave met Play/Pause/Stop/fullscreen in Windows.
- 3 nieuwe browserflows geslaagd: originele aflevering met HLS-fallback, CC/audio na de bestaande knoppen, focusherstel, bediening bij 480p/540p/1080p, filmkeuze en Stop.
- Twee nieuwe JVM-tests voor taalherkenning en prioriteit van volledige Nederlandse ondertitels geslaagd, plus de bestaande numerieke bridge-tests.
- Vier native instrumentatietests op de geïsoleerde API 27-emulator geslaagd: echte HLS/MKV-weergave, zichtbare Nederlandse cues, daadwerkelijke Engelse cues na selectie, cues wissen bij Uit, behoud bij fullscreen/terug, wisselen naar Nederlandse audio, snelheid wijzigen, automatische reset bij nieuwe video, geen automatisch Engels zonder Nederlands en Activity-recreatie. De tests gebruiken uitsluitend lokale synthetische media.
- Menu's visueel gecontroleerd via native screenshots in `artifacts/android-tv/verification-subtitles/`. Testlog: `logs/android-tv-0.1.13-native-runtime.log`.
- Alle 19 oorspronkelijke aangeleverde brandingbestanden en 45 oorspronkelijke assets zijn behouden. Nieuwe launcherformaten worden technisch geschaald door `scripts/prepare-launcher.py`.

Implementatie binnen Media3 1.8.0, zonder nieuwe runtime-dependencies. Geraadpleegde primaire bronnen: [trackselectie](https://developer.android.com/reference/androidx/media3/common/TrackSelectionParameters) en [bestaande controls/snelheden](https://github.com/androidx/media/blob/1.8.0/libraries/ui/src/main/java/androidx/media3/ui/PlayerControlView.java).

## Icoonbron

Ingebouwde imagegen-tool gebruikt; het vorige IPTV-icoon was het bewerkingsdoel en het oorspronkelijke NatjeTube-icoon de stijlreferentie. Opgeslagen resultaat: `src/renderer/public/branding/launcher-2026-11/natje-iptv-launcher-v2.png`. De vorige variant blijft beschikbaar.

Prompt: “Edit the first image, the Natje IPTV launcher icon, using the second NatjeTube icon as the precise visual-style reference. User dislikes the first icon's thick bright chrome border, puffed metallic 3D N, and huge pill nameplate. Rebuild the IPTV icon in the same restrained flat style and proportions as the NatjeTube reference: slim tilted near-square black badge, one thin pale-silver/white outer line, crisp simple bold white N with a small white play triangle, compact flat italic 'Natje IPTV' wordmark at bottom with a subtle thin underline just like the NatjeTube reference. Match the reference icon's visual weight and safe margins so these sibling apps look balanced side by side in a round launcher tile. Keep black and white with at most very subtle grey shading. No chrome, no extruded edges, no bevel, no glare, no pill frame around the wordmark, no thick outlines, no shadow halo, no red, no joint/cannabis. Render one complete square app icon with transparent outside background, no mockups, no extra text. Text must read exactly 'Natje IPTV'.”

APK: `artifacts/android-tv/Natje-IPTV-AndroidTV-0.1.13-subtitles-debug.apk`. Definitieve APK-controle en installatiebewijs staan in de JSON-bestanden naast de APK. Beschikbaarheid van talen blijft afhankelijk van de provider en de afspeelbare videoversie.
