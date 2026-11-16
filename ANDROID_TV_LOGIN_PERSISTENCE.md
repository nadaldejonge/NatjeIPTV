# Android TV Login Persistence

Datum: 2026-07-12

## Probleem

Na afsluiten en heropenen van de tv-app moest opnieuw worden ingelogd. Oorzaak:
op Windows bewaart het Electron-**mainproces** de credentials in de IPC-handler
(`xtream:loadPortal` → `updateSettings({ xtream })`), maar het Android-pad
riep de gedeelde client direct aan en sloeg nooit iets op.

## Opslagmodel

```text
Keystore-backed secure storage (EncryptedSharedPreferences, AES256-GCM):
- username
- password

Gewone Capacitor Preferences (natje-player-settings):
- server URL
- rememberLogin
- laatste sectie / groep / zender
- favorieten, recent bekeken, landenfilter
```

Native: `secureSetCredentials` / `secureGetCredentials` /
`secureClearCredentials` in `AndroidTvBridgePlugin.java`, op basis van
`androidx.security:security-crypto` (MasterKey AES256_GCM, prefs-bestand
`natje_secure_credentials`).

Platformlaag (`src/platform/androidPlatform.ts`):

- `updateSettings` met een `xtream`-patch schrijft username/password naar
  secure storage en bewaart in Preferences **alleen de serverUrl** (username en
  password worden leeg weggeschreven — nooit meer platte tekst; ook een oude
  plaintext-payload wordt bij de eerstvolgende schrijf overschreven).
- `readSettings` merge't de secure credentials er transparant weer in, zodat
  App.tsx platformneutraal blijft.
- Een lege/ontbrekende `xtream`-patch wist de secure storage.

## Automatische login

Bij appstart (alleen op Android): als `rememberLogin !== false` en er complete
credentials zijn → status "Automatisch inloggen..." en de portal wordt direct
geladen. Bij succes opent de hub. Bij een netwerkfout verschijnt het bestaande
foutpaneel met **Opnieuw proberen**; de credentials worden dan **niet**
verwijderd. Bij door de provider geweigerde login blijft het loginscherm staan
met de concrete melding; credentials worden alleen gewist via Logout.

Video start nooit automatisch bij appstart; afspelen begint pas na OK op een
zender.

## Remember login

Het loginscherm heeft op TV een DPAD-bedienbare toggle "Login onthouden"
(standaard aan). Uitgeschakeld: credentials gelden alleen voor de sessie en
eerder opgeslagen credentials worden bij de login gewist
(`xtream: undefined`-patch → secure clear).

## Logout

Logout op TV: stopt de player, wist secure storage én de accountsessie in
Preferences, toont het loginscherm en blokkeert automatische login tot een
nieuwe expliciete login.

## Veiligheid

- Wachtwoord staat niet in localStorage, gewone Preferences, platte JSON of
  logs; de Xtream-diagnostiek maskeerde credentials al (`username=***`).
- Windows-gedrag is ongewijzigd (settings.json via het mainproces, zoals het
  al was).
