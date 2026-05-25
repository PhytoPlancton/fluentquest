# Desktop packaging — FluentQuest (Mac + Win)

## État actuel (M13 = doc seulement)

Le code Electron compile et `electron .` ouvre une fenêtre, MAIS :

1. **Audio capture** = stub. Implémenter ScreenCaptureKit (Mac) ou WASAPI loopback (Win)
   nécessite du code natif (Swift addon ou Node N-API). Voir TODOs dans :
   - `apps/desktop/src/audio/capture-mac.ts`
   - `apps/desktop/src/audio/capture-win.ts`

2. **Whisper.cpp** = subprocess prêt mais nécessite :
   - Binaire `whisper-cli` bundlé par plateforme (~5MB chacun, à compiler depuis ggerganov/whisper.cpp)
   - Modèle GGUF (large-v3 = ~3GB, medium = ~1.5GB) — télécharger au premier run depuis huggingface
   - Stocker dans `app.getPath('userData')/whisper-models/`

3. **pyannote** = subprocess Python ou ONNX. Voir TODO dans `apps/desktop/src/diarization/pyannote.ts`.

## Mac : signature + notarization

Prérequis :
- Compte Apple Developer (99 €/an)
- Certificate "Developer ID Application" installé dans Keychain
- App-specific password généré sur appleid.apple.com

Setup electron-builder (dans `apps/desktop/package.json` "build" déjà partiellement configuré) :

```json
{
  "build": {
    "mac": {
      "category": "public.app-category.education",
      "target": ["dmg"],
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "notarize": {
        "teamId": "<YOUR_TEAM_ID>"
      }
    }
  }
}
```

Entitlements nécessaires (audio capture) :
- `com.apple.security.device.audio-input`
- `com.apple.security.device.microphone`
- + `NSScreenCaptureUsageDescription` dans `Info.plist`

Env vars pour build :
```
APPLE_ID=<email>
APPLE_APP_SPECIFIC_PASSWORD=<from appleid.apple.com>
APPLE_TEAM_ID=<10-char team id>
```

Build : `cd apps/desktop && npm run dist`

## Windows : code signing

Prérequis :
- Certificat code signing (Sectigo / DigiCert ~ 200-400 €/an, ou EV ~ 600 €/an)
- Stocké en .pfx avec password

Setup `apps/desktop/package.json` :
```json
{
  "build": {
    "win": {
      "target": ["nsis"],
      "certificateFile": "build/cert.pfx",
      "certificatePassword": "..."
    }
  }
}
```

Env vars build :
```
CSC_LINK=<path to cert.pfx or base64 content>
CSC_KEY_PASSWORD=<cert password>
```

Build : `cd apps/desktop && npm run dist`

## Auto-update

`electron-updater` déjà ajouté en deps. Setup :
1. Héberger les artefacts sur GitHub Releases (déjà géré par `release.yml`) OU sur un site edj-labs
2. Configurer dans `package.json` :
   ```json
   {
     "build": {
       "publish": {
         "provider": "github",
         "owner": "PhytoPlancton",
         "repo": "fluentquest"
       }
     }
   }
   ```
3. Dans main.ts : `import { autoUpdater } from 'electron-updater'; autoUpdater.checkForUpdatesAndNotify()`

## Distribution

Une fois signés/notarisés, les `.dmg` et `.exe` peuvent être :
- Uploadés sur GitHub Releases (auto via workflow)
- Hébergés sur le site `fluentquest.nmt.ovh/download` (ajouter le lien dans la web app)

## Coût total annuel pour packaging propre

| Item | Coût |
|---|---|
| Apple Developer Program | 99 € |
| Windows code signing (Sectigo OV) | ~ 200 € |
| **Total** | **~ 300 €/an** |

Si MVP non distribué publiquement, on peut skipper signing (les users devront accepter "app from unknown developer" — friction mais OK pour vous deux et quelques beta testers).

## Roadmap d'intégration réelle

1. **Phase A — audio capture qui marche localement** (1-2 sem)
   - Implémenter Mac via `node-mac-recorder` ou un Swift addon perso
   - Implémenter Win via `node-wasapi-loopback` ou ffmpeg subprocess
   - Tester sur 1 vraie session minecraft + TeamSpeak

2. **Phase B — Whisper local end-to-end** (1 sem)
   - Compiler whisper.cpp pour chaque plateforme dans `resources/`
   - First-run downloader pour le modèle large-v3
   - Verbatim mode validé sur "he act yesterday" → reste "he act"

3. **Phase C — pyannote diarization** (1 sem)
   - Modèle ONNX téléchargé en background
   - Intégration avec Whisper segments via timestamps

4. **Phase D — signing + notarization** (1 jour de setup une fois les certs achetés)

5. **Phase E — auto-update** (½ journée)
