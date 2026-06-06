# AI Tour Guide — Frontend (Puabi)

**Puabi** is an on-screen 2D guide character (right-middle of the screen) who introduces sites,
reacts to the timeline, and talks with the visitor by voice and text. She persists across the world
map and the site scenes.

## What was added
- **`scripts/ui/components/ai-guide.ts`** — the guide component:
  - Animated character with per-state poses (`public/assets/aoi/{idle,talk1,talk2,thinking,listening}.png`),
    a soft talk gesture cycle, and CSS motion (bob / talk / tilt / glow).
  - **Voice out:** cloned voice (XTTS) if available, else the best browser voice (auto fallback).
  - **Voice in:** continuous, hands-free `SpeechRecognition` (Chrome/Edge).
  - Speech-bubble captions + an "AI may be imprecise" disclaimer.
  - Optional **Rive** rig: if `public/assets/aoi/aoi.riv` exists it plays that instead (see
    `aoi-rig-source/AOI_RIG_SPEC.md`); otherwise the PNG poses are used.
- **`scripts/main.ts`** — mounts Puabi and triggers her:
  - world map: click a site → she talks about it; change the timeline era → she introduces it.
  - inside a site: she travels in and greets; keys `E` (re-introduce) / `V` (mute).
- **Per-marker transform** (`markerScale`, `markerRotation` in `scripts/types.ts`) + auto bounding-box
  normalization so every site marker renders at a consistent on-screen size.

## Environment (`.env`)
```bash
VITE_APP_TITLE="Heritage World"
VITE_SERVER_URL="wss://your-domain.com"     # the game/guide server (ws:// or wss://)
# Optional cloned-voice service (see heritage-tts/). Omit to use the browser voice:
# VITE_TTS_API_URL="https://tts.your-domain.com"
```
- The guide derives the **HTTP API base** from `VITE_SERVER_URL` (`ws→http`, `wss→https`) and calls
  `<base>/api/guide`. So pointing `VITE_SERVER_URL` at the backend is enough.

## Production build & deploy
```bash
npm ci
npm run build          # -> dist/  (static files)
```
Serve `dist/` from any static host / nginx (see the main `README.md` for a full nginx example). SPA
fallback to `index.html`.

### ⚠️ Voice input requires HTTPS
Browsers only allow the microphone (`SpeechRecognition` / `getUserMedia`) in a **secure context**.
In production the frontend **must be served over HTTPS** (localhost is exempt in dev) or voice-in
won't work. Voice-out and text still work without it.

### Browser support
- **Voice in:** Chrome / Edge (Web Speech API). Firefox/Safari fall back to text only.
- **Voice out:** all modern browsers (SpeechSynthesis), upgraded to the cloned voice when the TTS
  service is configured and running.
- First interaction triggers a one-time **mic permission** prompt.

## How voice is chosen (priority)
1. **Cloned voice** — if `VITE_TTS_API_URL` (or `localhost:5050`) answers `/health`, lines are fetched
   from `<tts>/tts` and played. (Requires the `heritage-tts` service running — see its README.)
2. **Browser voice** — automatic fallback; picks the most natural installed English voice.

## Swapping the character art
Pose images live in `public/assets/aoi/`. Replace `idle/talk1/talk2/thinking/listening.png`
(transparent PNGs) to restyle her — no code change. For a fully rigged character, drop a Rive file at
`public/assets/aoi/aoi.riv` (contract in `aoi-rig-source/AOI_RIG_SPEC.md`).

See `heritage-world-server/AI_TOUR_GUIDE.md` for the backend, and `heritage-tts/README.md` for the
optional cloned voice.
