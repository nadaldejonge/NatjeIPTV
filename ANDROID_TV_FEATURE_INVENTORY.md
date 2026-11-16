# Functionaliteitsbaseline — 2026-11-03

Vastgelegd vóór broncodewijzigingen. Herstelkopie: `../Player-backup-2026-11-03-202903`.
Geen Git-checkout. Baseline: typecheck geslaagd; bestaande mock-netwerktests 26/26.

## Te behouden functies

| Gebied | Bestaande mogelijkheden | Primaire bron |
|---|---|---|
| Identiteit | Natje-logo, zwart-witte branding, alle icoonvarianten, Android launcher/banner/splash | public, src/renderer/public, android/app/src/main/res |
| Login | Xtream, velden server/user/password, foutdiagnostiek en retry, andere login | StartScreen, App |
| TV-login | Focus/editing-toetsenbord, onthouden, automatische login, encrypted credentials, logout | TvTextInput, androidPlatform, AndroidTvBridgePlugin |
| Playlists | Lokaal M3U/M3U8-bestand, URL, bronlabel, tvg-id, groepen, logo-URL, normalisatie | parseM3u, PlaylistImport, platformadapters |
| Secties | Live TV, Series, categorieaantallen; bestaande VOD/movie API's en modellen blijven beschikbaar | SectionHub, xtreamClient, xtreamMapper |
| Browsen | Alle categorieën, Favorieten, Recent bekeken (10), afleveringen/seizoenen, terug naar series/keuze | App, layouts |
| Zoeken | Geladen lijst filteren, hele Xtream-sectie zoeken, minimum 2 tekens, wissen, modalresultaten en volledige lijst | App, SearchBar, TvLayout |
| Landen | Aan/uit per land, verborgen landen onthouden; TV Alles uit, Reset, Toepassen en Sluiten | layouts, App |
| Favorieten | Logo, bron en volledige channelmetadata bewaren; toevoegen/verwijderen; favorietenlijst | ChannelList, App, settings |
| TV-playback | Native Media3, één instance, mini/fullscreen, tweede OK fullscreen, Stop, retry, foutdetails, URL-fallbacks | TvPlayerManager, TvMiniPlayer, App |
| Native mogelijkheden | Pause/resume, seek, audio/subtitletracks, controller, lifecycle, keep-screen-on | native manager/bridge, natjePlayerApi |
| Windows-playback | HLS.js/native video, Play/Pauze/Stop/Herlaad, MPV hervatten, PiP, fullscreen, click/doubleclick, tijd/progressie, helderheid, audio/ondertitels, externe subtitels | PlayerPanel, hlsPlayer, mpvController |
| EPG | Xtream short EPG, 5 listings, Windows titel/beschrijving/tijden, serie-/afleveringsplot | shared/xtreamClient, PlayerPanel |
| Opslag | Alle bestaande settingskeys, favorites/recent, hiddenCountries, login, laatste bron/groep/zender/sectie, Windows windowBounds | shared/settings, storage, androidPlatform |
| Diagnostiek | Netwerkclassificatie, gemaskeerde URL's, details, retry/sluiten, native foutinformatie | httpTransport, ErrorPanel |
| Hulpmiddelen | EPG Search Lab inclusief XMLTV/cache blijft afzonderlijk beschikbaar; bestaande scripts en releases behouden | tools, scripts, artifacts, release |

## Bescherming

- Asset-hashes zijn opgeslagen in de backup (`asset-manifest.json`). Logo's/assets worden niet vervangen.
- Geen migratie van settingskeys, geen credentials in testfixtures/logs, geen fysieke installatie.
- Android appId/signingconfig blijven behouden; alleen versionCode/versionName verhogen voor de nieuwe debugbuild.
- Nieuwe TV-presentatie mag geen bestaande actie verwijderen; renderpaginering wordt automatisch bereikbaar gemaakt.
- Visuele wijzigingen worden TV-specifiek gehouden. Gedeelde wijzigingen krijgen regressietests.

## Verificatie na uitvoering

Zie het implementatierapport en de geautomatiseerde testresultaten. Hardware-afhankelijke functies worden expliciet als niet getest gemarkeerd als geen fysieke TV beschikbaar is.
