# Natje IPTV 0.1.12 — categoriebeheer, zoeken en appicoon

Opgeleverd op 16 november 2026. Het bestaande functieoverzicht staat in `ANDROID_TV_FEATURE_INVENTORY.md`. Vooraf is de broncode en Android-resourceboom bewaard in `C:/Users/nadal/Downloads/Player-category-backup-2026-11-16`. Deze versie bouwt voort op 0.1.11 en behoudt de bestaande instellingen, favorieten, recente zenders, loginopslag, afspeelfuncties, programmabeschrijvingen, logosources en bediening bij vasthouden.

## Bediening

Live TV, series en films hebben afzonderlijk opgeslagen categorievoorkeuren. Op TV opent de knop **Categorieën** het beheer; op Windows staat **Categorieën beheren** boven de categorieën. Het beheer ondersteunt meerdere categorieën selecteren, selectie verbergen/tonen, bovenaan/onderaan zetten en omhoog/omlaag verplaatsen. De volgorde blijft binnen en buiten de selectie stabiel. Nieuwe categorieën blijven beschikbaar en onbekende opgeslagen sleutels worden bij verplaatsen behouden.

**Alles uit** verbergt alle huidige categorieën van het onderdeel op basis van hun echte categorie-ID, ook zonder herkenbare landcode. Daarna opent de weergave Verborgen. Selecteer de gewenste categorieën, kies **Toon selectie** en **Opslaan**. Expliciet tonen kan één categorie uit een uitgezet land zichtbaar maken zonder de rest van dat land aan te zetten. Een volgende bediening van dat land verwijdert zulke uitzonderingen voor dat land; het landenfilter blijft daardoor functioneel. **Alles aan** zet alle huidige categorieën aan. **Herstel standaard** herstelt de standaardcategorievolgorde en verwijdert handmatige categorievoorkeuren; de bestaande landeninstellingen blijven bewaard. Annuleren verandert niets. Een opslagfout behoudt het concept in het venster voor een nieuwe poging.

De actiebalk staat links van de lijst, waardoor het grootste deel van de beschikbare hoogte voor categorieën wordt gebruikt. Met de testinhoud zijn 6 volledige regels zichtbaar bij 854×480, 8 bij 960×540 en 17 bij 1920×1080. De tekst schaalt mee; de lijst blijft scrollbaar. De afstandsbediening kan tussen acties en lijst bewegen, de lijst versneld doorlopen en terugkeren naar de vorige regel.

## Zoeken en films

- De al aanwezige film-API en filmmapping zijn aangesloten op een Films-keuze, categorieën, zoeken, favorieten en de bestaande native/Windows-speler.
- Zoeken controleert titels én categorieën door het hele zichtbare onderdeel. Accenten, leestekens, losse zoekwoorden en Arabische tekst worden ondersteund. Zoeken vanuit afleveringen zoekt opnieuw naar series en sluit de afleveringweergave af.
- Reeds beschikbare resultaten verschijnen direct, daarna volgen resultaten per verwerkte categorie/chunk met laadindicator en voortgang. Verouderde zoekacties mogen nieuwe resultaten niet overschrijven.
- Handmatig verborgen categorieën en via landen verborgen categorieën worden overgeslagen, zowel in resultaten als in categorieaanvragen. Als iets verborgen is, wordt geen brede aanvraag gedaan die ook verborgen categorieën zou ophalen. Een test met 25 zichtbare categorieën controleert dit expliciet.
- Zonder filters kan één brede aanvraag worden gebruikt. Mislukt die, dan doorzoekt de app de resterende categorieën afzonderlijk met begrensde gelijktijdigheid. Een tijdelijke cataloguscache bewaart ook de gecontroleerde categorie-ID's, zodat een nieuwe zoekterm geen volledige nieuwe download nodig heeft. Bij gedeeltelijke fouten vermeldt de app dat niet alles gecontroleerd kon worden. Verversen kan opnieuw ophalen.
- Categorie-ID's als getal/tekst worden consequent behandeld. Het openen van een gevonden serie werkt ook als de bijbehorende serie niet meer in de laatst geladen categorielijst staat. Afleveringen behouden de categoriegegevens van hun serie.
- De volledige M3U-lijst blijft afzonderlijk bewaard bij filters/favorieten, zodat categoriebeheer de playlist niet verkleint.

## Controle met de nieuwe provider

De door de gebruiker nieuw aangeleverde login is uitsluitend voor tijdelijke API-controles gebruikt. Login was actief. De provider leverde 921 live-, 388 serie- en 447 filmcategorieën. Per-categorieaanvragen voor elk onderdeel werkten. De twee brede serie-/filmaanvragen werden tijdens de controle na circa zeven seconden verbroken; dit ondersteunt de noodzaak van de categorie-terugval. Providercredentials zijn niet in bronbestanden, rapporten, fixtures of de APK opgenomen. Er is geen echte providerstream afgespeeld voor deze controle.

## Appicoon

Alleen Android-launchericoon en het Android TV-appoverzicht gebruiken de nieuwe NatjeTube-geïnspireerde zwart-witte N/play-badge met Natje IPTV-naamplaat. De oorspronkelijke in-app logo's, splashbranding, Windows-ICO en alle oorspronkelijke bestanden blijven behouden. De NatjeTube-repository is alleen gelezen.

Gegenereerd met de ingebouwde imagegen-tool, op basis van `C:/Users/nadal/Downloads/NatjeTube/NatjeTube/NatjeTube/branding/incoming/app_icon.png`. Projectbestand: `src/renderer/public/branding/launcher-2026-11/natje-iptv-launcher.png`. `scripts/prepare-launcher.py` maakt uitsluitend technische schaalvarianten voor vijf Android-dichtheden en een TV-overzichtsafbeelding.

Gebruikte prompt: “Create one finished Android TV app launcher icon for 'Natje IPTV'. Use the referenced NatjeTube app icon as the visual family reference: chunky tilted rounded square glossy graphite/black badge with a crisp bold white sculpted N monogram and a small play triangle. Adapt it to IPTV with a white/silver play triangle, white/silver rim (keep mostly monochrome black and white), and an integrated short lower nameplate reading exactly 'Natje IPTV' in bold italic clean sans serif lettering. Strong legibility, simple silhouette at small icon sizes, premium restrained polished 3D bevel, no cannabis, no smoking, no joint, no other text. The badge fills about 80% of a square canvas with centered safe padding. Transparent outside background. This is a sibling app identity, inspired by the reference, not a NatjeTube logo. Deliver one single icon, no presentation board, no mockup, no variations.”

## Verificatie

- TypeScript-controle geslaagd; 29 TV-unitcontroles en 26 Xtream-controles geslaagd.
- 23 bestaande browsercontroles, 14 TV/Windows-matrixcontroles en 5 herstelcontroles geslaagd. De matrix bevat echte synthetische HLS-weergave in Windows met Play/Pause/Stop/fullscreen, grote lijsten en versnellend navigeren.
- 10 nieuwe browserflows geslaagd: bulkbeheer, opslag/herstart, terughalen, annuleren/opslagfout, zoeken buiten de geopende seriecategorie, filmzoeken en VOD-selectie, onafhankelijke voorkeuren, venstermaten en afstandsbediening, geweigerde brede aanvraag met volledige categorieterugval/cache, Alles uit met expliciete uitzonderingen en uitsluiten van verborgen categorieaanvragen, Windows-beheer. Bewijs: `artifacts/android-tv/verification-categories/results.json` en de screenshots in dezelfde map.
- Android app-build en JVM-tests geslaagd. Twee native Android-instrumentatietests geslaagd op de geïsoleerde API 27-emulator met de echte Capacitor-plugin en Media3: gedecodeerde HLS-preview, fullscreen/terug met dezelfde speler/media, Stop en Activity-recreatie. Log: `logs/android-tv-0.1.12-native-runtime.log`. Deze test gebruikt lokale synthetische media, geen echte providerstream of fysieke TV-stick.
- Alle 19 aangeleverde oorspronkelijke brandingbestanden byte-identiek en alle 45 oorspronkelijke assets behouden. De vijf nieuwe launcherformaten en de nieuwe TV-overzichtsafbeelding zijn afzonderlijk gecontroleerd.
- Alle 27 rendererbestanden zijn byte-vergeleken met de APK. Testfixtures ontbreken. APK-signering is geldig en gelijk aan 0.1.11; app-ID is `nl.natje.iptvplayer`, versiecode 12.

## Afleverbestand

`artifacts/android-tv/Natje-IPTV-AndroidTV-0.1.12-categories-debug.apk` — 14.616.856 bytes.

SHA-256: `21dc37c429746e7e8e6ef688f560128636aca80812bbd4c2d06d09d799ec1350`.

Kan over 0.1.11 worden geïnstalleerd met behoud van appgegevens. Alleen de geïsoleerde testemulator is door deze taak gebruikt voor installatie. De fysieke TV en volledige providercompatibiliteit vragen een praktijktest.
