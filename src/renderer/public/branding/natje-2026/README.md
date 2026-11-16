# Natje IPTV logopakket

Gebaseerd op het goedgekeurde zwart-witte logo. De joint is rechtstreeks uit het ontwerp geknipt, dus niet opnieuw gegenereerd. Alle PNG-bestanden zijn rasterafbeeldingen (geen vectorbestanden).

## Volledig logo met tekst
- `natje-iptv-logo-master.png`: origineel transparant, strak uitgesneden.
- `natje-iptv-logo-400w.png`, `800w`, `1200w`, `1600w`: horizontaal, transparant.

## Alleen joint met zwart-wit badge
- `natje-joint-icon-master.png`: transparant, vierkant.
- `natje-joint-icon-48.png`, `72`, `96`, `128`, `192`, `256`, `384`, `512`, `1024`: vierkante uitvoerformaten.
- Behoud proporties; gebruik CSS `object-fit: contain`.
- Voor het startscherm / app-header kan je de icoonversie gebruiken zonder tekst.

## Android TV banners
- `natje-tv-banner-320x180.png`: launcher bannerformaat.
- `natje-tv-banner-640x360.png`: 2x schaal.
- `natje-tv-banner-1280x720.png`: 4x schaal.
- Controleer in het Android-project of `android:banner` al bestaat en waar de juiste `drawable` of `mipmap` resources thuishoren.

## Opmerking
Een PNG van 1024px is alleen een grotere rasterversie van dezelfde bron. Dit maakt hem niet een echt vectorlogo; voor werkelijk onbeperkt schalen zou een handmatig nagetekende SVG nodig zijn. Deze bestanden zijn wel scherp bij normaal gebruik op een 65-inch TV zolang ze op passende afbeeldingsgroottes worden getoond.
