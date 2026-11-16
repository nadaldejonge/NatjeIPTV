# Android TV Keyboard & Focus Fix

Datum: 2026-07-12

## Probleem

Op de TCL Google TV opende het schermtoetsenbord zodra DPAD-focus alleen maar
langs een tekstveld bewoog. Focus en tekstbewerking waren één toestand.

## Oplossing: gescheiden FOCUSED en EDITING

Nieuw component `src/renderer/components/TvTextInput.tsx`, gebruikt op alle
TV-tekstvelden (Xtream server/username/password op het loginscherm, playlist-
URL, zoekveld):

- De DPAD focust een wrapper-`div` (tabIndex 0); het echte `<input>` is
  `readOnly` en heeft `tabIndex={-1}`, dus het toetsenbord opent **niet** bij
  focus. Een potloodicoon en focusring tonen de FOCUSED-toestand.
- **OK/Enter** start EDITING: het veld wordt bewerkbaar, krijgt focus (pas dan
  opent het Android TV-toetsenbord) en de cursor gaat naar het einde.
- **Back/Escape tijdens editing** sluit alleen het toetsenbord/editing en zet
  de focus terug op de wrapper; de omliggende modal blijft open. Een volgende
  Back sluit pas de modal (TvModal slaat Back over zolang een bewerkbaar veld
  actief is).
- **Enter tijdens editing** bevestigt (bijv. zoeken/URL laden) en verlaat
  editing.

De focus-selectors in `tvNavigation.ts` en `TvModal.tsx` slaan inputs met
`tabindex="-1"` over, zodat spatial navigation alleen de wrappers ziet.

## Native configuratie

`AndroidManifest.xml` (MainActivity):

```xml
android:windowSoftInputMode="stateAlwaysHidden|adjustResize"
```

Het toetsenbord verschijnt dus nooit automatisch bij het openen van de
activity, en resize herstelt zich na sluiten. De mini-playerbounds worden na
elke layoutwijziging opnieuw gemeten (ResizeObserver + resize-listener +
1,2s-vangnet in `TvMiniPlayer.tsx`), dus ook na toetsenbord open/dicht.
Er zijn geen `showSoftInput`/InputMethodManager-calls in de eigen native code.

## Windows

Windows gebruikt de gewone `<input>`-velden (StartScreen `tvMode={false}`,
AppLayout ongewijzigd); daar verandert niets aan het gedrag.

## Testinstructie (op de tv)

1. Navigeer met DPAD langs server/username/password → alleen focusring, geen
   toetsenbord (ook na 2+ seconden).
2. OK op een veld → toetsenbord opent, tekst invoeren werkt.
3. Back → toetsenbord sluit, modal/scherm blijft; focus staat op het veld.
4. Nogmaals Back → modal sluit (of app-navigatie op het loginscherm).
