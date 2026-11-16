# Android TV Compact UI Fix

Datum: 2026-07-12

## Oude layout (referentiefoto)

De desktopinterface stond vrijwel 1:1 op de tv: permanente account-/serverregel,
URL- en Bestand-knoppen, groot playlist-URL-veld, grote zoekbalk en de
landenknop namen samen bijna de helft van de schermhoogte in. Categorieën en
zenders werden onderaan afgesneden en de knoppen bij de mini-player waren met
DPAD niet praktisch bereikbaar.

## Nieuwe layout

De TV-interface (`TvLayout.tsx`, alleen actief op Android) bestaat uit:

```text
[icoon] Live TV · provider.example:8080   [Zoeken][Playlist][Landen][Favorieten][Verversen]
categorieën | zenders | mini-player (16:9)
            |         | zendernaam + EPG
            |         | [Fullscreen][Stop]
statusregel
```

- Header + toolbar: één compacte rij (~6% van 1080p), accountregel toont
  alleen sectie + serverhost, **nooit** username of wachtwoord.
- Geen permanente invoervelden meer in het hoofdscherm; Zoeken, Playlist en
  Landen openen elk een DPAD-modal (focus-trap, Back sluit, focus keert terug
  naar de aanroepende knop).
- Zoekmodal bevat het zoekveld, Zoeken/Wissen/Sluiten en een scrollbare
  resultatenlijst (max 50 zichtbaar); OK op een resultaat speelt de zender en
  sluit de modal. De video speelt door.
- Playlistmodal: URL-veld (TvTextInput), Bestand via SAF, Sluiten. De huidige
  stream blijft actief tot een nieuwe playlist echt geladen is.
- Landenmodal: scrollbare landenlijst met aan/uit, Toepassen/Reset/Sluiten;
  filtering raakt de player niet.

## Scrollcontainers

`.tv-workspace` is `grid-template-rows: auto minmax(0, 1fr) auto` met
`height: 100vh`; het contentgrid en alle drie kolommen hebben `min-height: 0`
met `overflow-y: auto` per lijst. Focus scrollt automatisch in beeld via het
bestaande `scrollIntoView({ block: "nearest" })` in tvNavigation. Alleen de
lijsten scrollen; de pagina zelf nooit. Overscanmarge: 18–28px padding.

## Mini-player en actierij

De mini-player is één groot focusdoel (OK = fullscreen) met daaronder een
altijd bereikbare actierij: **[Fullscreen] [Stop]**, en bij een fout
**[Opnieuw] [Details]**. RIGHT vanuit de zenderlijst → mini-player, DOWN →
actierij. Er is geen PiP-knop: systeem-PiP is niet geïmplementeerd, dus er
wordt conform de eis geen nutteloze knop getoond. De native PlayerView is in
mini-modus niet focusable/clickable; React beheert focus en acties.

## Focusmodel

```text
toolbar ↔ categorieën ↔ zenders ↔ mini-player → actierij
modals: focus-trap, eerste control gefocust, Back sluit, focus hersteld
fullscreen: native Media3-controller, Back → mini
```

## Resterende beperkingen

- Emulator was offline; screenshots en DPAD-verificatie moeten op de echte
  TCL gebeuren (zie ANDROID_TV_UI_TEST_REPORT.md).
- De zoekmodal toont maximaal 50 resultaten; de volledige lijst staat na
  sluiten in het hoofdscherm.
