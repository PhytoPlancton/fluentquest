# Desktop — how to run

## TL;DR

```bash
cd apps/desktop
npm run dev        # builds main + renderer, then launches electron
```

The window opens. First run shows a setup screen — paste your **API URL**, **session token**, **workspace ID**. Then click **Start recording**.

## What's inside

```
apps/desktop/
├── src/                     # main process (Node, CommonJS)
│   ├── main.ts              # window, IPC handlers, electron-store
│   ├── preload.ts           # contextBridge → exposes `window.fluentquest`
│   ├── transcribe.ts        # Whisper via @huggingface/transformers (ONNX)
│   └── api-client.ts        # POST /v1/sessions + segments + /analyze
├── renderer/                # renderer process (React + Vite)
│   ├── index.html
│   ├── main.tsx
│   ├── App.tsx              # UI : settings panel + Start/Stop + status + done
│   └── audio-capture.ts     # getDisplayMedia + getUserMedia → Float32Array PCM
├── build/
│   └── entitlements.mac.plist   # Mac audio + microphone permissions
└── package.json             # electron-builder config (Mac dmg + Win nsis)
```

## How a recording works

1. Click **Start recording** in the desktop app
2. macOS shows the **screen-picker prompt** — pick the window or screen that has your VoIP call (TeamSpeak / Discord / etc). Audio comes from that source via ScreenCaptureKit (Mac 13+) or WASAPI loopback (Win 10+)
3. Your microphone is also captured and mixed with the system audio
4. Click **Stop and transcribe**
5. Audio (Float32 16kHz mono PCM) is sent over IPC to the main process
6. Main calls `@huggingface/transformers` whisper-base (~150MB, downloads to `~/Library/Application Support/FluentQuest/models/` on first run)
7. Segments + timestamps are returned to the renderer
8. Renderer POSTs to your FluentQuest API : create session → bulk segments → end → trigger analyze
9. Success screen shows a link to **open the session in your browser**
10. The browser web app shows the corrections + auto-generates exercises

## Getting your token + workspace ID

For now, after signup/login on the web :

```bash
# Login via curl, capture the cookie
curl -s -c /tmp/cookies.txt -X POST http://localhost:3030/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpw"}' | python3 -m json.tool

# The `token` field in the response is what you paste in the desktop app.
# Your workspaceId is in the `workspaces` array returned by /v1/auth/me
curl -s -b /tmp/cookies.txt http://localhost:3030/v1/auth/me | python3 -m json.tool
```

A nicer flow (token paste auto via deep link `fluentquest://auth?token=…&workspace=…`) is left as future work.

## First-run model download

The first time you transcribe, `@huggingface/transformers` downloads the Whisper model (~150MB for `whisper-base`). Progress is shown in the UI. After that it's cached and reuse is instant.

Models stored at : `~/Library/Application Support/FluentQuest/models/Xenova/`

## Packaging signed builds

### macOS (notarization)

Requires : Apple Developer Program ($99/yr) + `Developer ID Application` certificate.

```bash
export APPLE_ID=your.email@icloud.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx  # from appleid.apple.com
export APPLE_TEAM_ID=ABCDE12345                          # 10 chars
cd apps/desktop
npm run dist:mac
```

Output : `release/FluentQuest-0.0.0-arm64.dmg` and `…-x64.dmg`. Signed + notarized.

### Windows (code signing)

Requires : code signing cert (Sectigo OV ~ $200/yr, or EV ~ $600/yr).

```bash
export CSC_LINK=/path/to/cert.pfx
export CSC_KEY_PASSWORD=yourpfxpassword
cd apps/desktop
npm run dist:win
```

Output : `release/FluentQuest Setup 0.0.0.exe`.

### Unsigned dev build

```bash
npm run package    # produces release/mac/FluentQuest.app  (no notarization)
```

You can run the unsigned app but users will see "App from unknown developer" on first launch (right-click → Open to bypass).

## Known limits (MVP)

- **Single speaker assumption** — pyannote diarization removed for MVP. All segments get `SPEAKER_00`. You can manually retag in the web app after analysis.
- **Whisper-base default** — multilingual, good quality, but English-only `whisper-base.en` is faster and more accurate for EN-only sessions. Change in Settings → "Whisper model".
- **macOS 13+ required** for system audio capture (ScreenCaptureKit). On older macOS, install **BlackHole** virtual audio device and select it in the screen picker.
- **No auto-update yet** — config is in `package.json` build.publish but the actual `electron-updater` integration ships next.

## Future work

- Per-speaker diarization via `@huggingface/transformers` speaker-diarization-3.1 (when ONNX port lands)
- Deep-link auth (`fluentquest://auth?token=…`) so users don't paste tokens
- Floating menu-bar icon with global hotkey to Start/Stop without focusing the window
- Auto-uploader for long sessions (chunk every 30s instead of waiting for Stop)
- Custom Whisper.cpp build for Apple Silicon (faster than ONNX on M1+)
