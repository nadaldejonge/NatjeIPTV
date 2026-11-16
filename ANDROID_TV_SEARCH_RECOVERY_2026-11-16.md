# Natje IPTV 0.1.14 — herhaald zoeken

De TV-invoer kon bij een volgende zoekopdracht nog de vorige zoekterm doorgeven als de laatste tekstwijziging van het schermtoetsenbord nog niet in React-state stond. Dit is vóór de wijziging nagebootst: NPO in het veld leverde opnieuw RTL-resultaten op. Bewijs: `logs/android-tv-0.1.14-reproduce.log`.

De invoer wordt nu bij het afronden van IME-compositie, focusverlaten en Enter gesynchroniseerd. Enter geeft rechtstreeks de zichtbare tekst door; de zoekknop verstuurt het formulier met de actuele veldwaarde. Een directe queryreferentie voorkomt wachten op een React-render. Editing wordt afgesloten als focus bewust naar een ander bedieningselement gaat, terwijl tijdelijk focusverlies naar het Android-toetsenbord behouden blijft. Afgeronde resultaten vermelden de gebruikte zoekterm.

Een nieuwe zoekopdracht vervangt een lopende; oude resultaten en afronding verliezen via de bestaande requestgeneraties hun schrijfrecht. De Windows-zoekknop blijft tijdens een aanvraag beschikbaar om een nieuwe opdracht te starten. Bestaande filters, incrementele resultaten, categoriebeheer, ondertiteling/audio, logo's, favorieten en opslag blijven behouden.

## Controle

- Vijf gerichte browserflows geslaagd: tweede zoekknopactie met IME-tekst, wijzigen en Enter binnen dezelfde eventcyclus, vervangen van lopend zoeken, en herhaalde opdrachten via knop/Enter/sluiten/heropenen/Wissen bij series en films.
- 23 bestaande browsercontroles en 3 CC/audio-browserflows geslaagd. TypeScript-controle en Android-build geslaagd. Native playercode is niet gewijzigd.
- Alle 28 rendererbestanden zijn byte-vergeleken met de APK. Signering geldig en gelijk aan 0.1.13. Ontwikkelfixtures en providercredentials ontbreken in de productie-renderer.
- Broncodebackup vóór wijzigingen: `C:/Users/nadal/Downloads/Player-search-backup-2026-11-16`.

APK: `artifacts/android-tv/Natje-IPTV-AndroidTV-0.1.14-search-debug.apk`.

SHA-256: `45dbc6ec071aeeeccb256e357b9aeced88da37788bd3184eb8b56afebfd868cf`.

Het installatiebewijs op de Xiaomi staat na installatie in `artifacts/android-tv/installation-0.1.14-xiaomi.json`.
