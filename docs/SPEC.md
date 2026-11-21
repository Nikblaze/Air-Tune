# Air Strings — Spec

## 0. Product decisions
- **Standalone website**, separate repo. NOT part of Vanish (different product: an instrument you keep playing vs. a one-shot gesture that leaves a call; meeting audio processing hurts music; slower iteration inside Meet/Teams).
- Meeting use = share this tab in Meet/Teams with **"Also share tab audio"**. No integration code.
- Keep `src/core/` free of DOM/browser APIs so it can later power a single Vanish exit effect (e.g. "strum a chord and dissolve") without rewriting.
- Desktop/laptop first. Mobile works but is not optimized in v1.
- User flow: see §10.

## 1. What the reel shows (reverse-engineered)
| Frame | What's happening | How it works |
|---|---|---|
| Start | Both hands pinch (thumb + index). A **dashed line with tick marks** stretches between the two pinch points. | Two-hand pinch = "drawing" a string. Ticks = a length/note gauge. |
| Middle | Hands release. The line becomes a **solid white string** with circle anchors at both ends. Many strings stay on screen at different angles/lengths. | String committed to the scene; endpoints fixed in screen space. |
| End | One hand sweeps through the strings. They **bow outward, glow (cyan / green / pink), and spray sparks**. | Fingertip path crosses the string → pluck event → vibration physics + glow + particles + sound. |

Green bones + red dots = MediaPipe Hand Landmarker's 21 landmarks drawn as a debug overlay.

**Our extension:** each string plays a real musical note. Like a real string, **shorter = higher pitch**, snapped to a musical scale so anything you play sounds good.

## 2. Pipeline
```
Webcam (getUserMedia)
  → HandLandmarker.detectForVideo()      21 landmarks × 2 hands, ~30 fps
  → coords.ts: normalized → canvas px, mirrored
  → smoothing (One Euro filter per landmark)
  → gestures: pinch state machine (create) + swept fingertip crossing (pluck)
  → scene: strings[] with vibration state, particles[]
  → render (Canvas 2D, additive glow)      60 fps
  → audio (Web Audio)                       on pluck events
```

## 3. Interactions
### 3.1 Create a string (two-hand pinch)
- Hand landmarks: thumb tip `4`, index tip `8`, wrist `0`, middle MCP `9`.
- `handScale = dist(0, 9)` (makes thresholds work at any distance from camera).
- `pinchRatio = dist(4, 8) / handScale`.
- **Hysteresis**: pinch ON when `ratio < 0.30`, OFF when `ratio > 0.45`. Prevents flicker.
- Pinch point = midpoint of 4 and 8.
- State machine: `IDLE → (both hands pinch-ON) → DRAWING → (either hand pinch-OFF) → commit if length ≥ minLength (e.g. 80px) → IDLE`.
- While DRAWING: render dashed line + ticks + **live note label** at the midpoint (e.g. "A3") so you can "tune" before releasing.
- Cap at 12 strings; the oldest fades out (FIFO).

### 3.2 Pluck / strum
- Track fingertips `8` (index) and `12` (middle) of each hand that is **not** pinching.
- Each frame, the fingertip moves from `p0` (previous) to `p1` (current). Test the **segment p0→p1 against each string segment A→B** (swept test). Do NOT just check "is the fingertip near the line" — at 30fps a fast hand jumps 100+px per frame and would skip strings.
- Intersection via cross products: sides of `p0` and `p1` relative to AB differ, AND sides of A and B relative to p0p1 differ. Compute `t ∈ [0,1]` = where along the string it was hit.
- `velocity = |p1 − p0| / dt` → loudness and visual amplitude (clamped).
- Cooldown per (string, finger): 120 ms, so one swipe = one pluck.
- Emit `stringPlucked { stringId, t, velocity, direction }`.
- A sweep across several strings within ~150 ms naturally becomes a **strum** (chord). No special code needed.

### 3.3 Remove strings
- Keyboard: `Z` undo last, `C` clear all.
- Gesture (Phase 6): both palms open, held 1 s → clear all.

## 4. Music mapping
- **Physics:** for a real string, `f = (1 / 2L) · √(T / μ)` → frequency ∝ 1/length.
- Normalize length: `Ln = length / referenceLength` (referenceLength = 0.6 × canvas width).
- Continuous pitch: `semitones = −12 · log2(Ln)` relative to the root (half the length = one octave up, same as a real guitar at fret 12).
- **Scale mode (default):** snap to the nearest note of the chosen scale. **Free mode:** no snapping.
- MIDI → Hz: `f = 440 · 2^((m − 69) / 12)`.
- Scales (as semitone sets): Major pentatonic / Raag Bhupali `[0,2,4,7,9]`, Minor pentatonic `[0,3,5,7,10]`, Major `[0,2,4,5,7,9,11]`, Natural minor, Raag Yaman `[0,2,4,6,7,9,11]`, Hirajoshi `[0,2,3,7,8]`.
- Root note selectable (default C3 = MIDI 48). Range clamp: 2.5 octaves.
- **Tick marks** on a string = positions where the note would change if the string were that long (the gauge you see while drawing).
- **Colour = pitch class**: `hue = (midi % 12) × 30°`. Same note → same colour in every octave.

## 5. Visuals
### 5.1 String vibration (shared math with audio!)
Model the string's sideways displacement as a sum of standing-wave modes:
```
y(x, t) = Σ_{n=1..N}  A_n · sin(nπx) · cos(ω_n t) · e^(−γ_n t)
A_n (triangular pluck at position p, height h) = 2h / (n²π² p(1−p)) · sin(nπp)
```
- `x ∈ [0,1]` along the string, displacement drawn along the string's normal vector.
- Use N = 6 modes. Visual frequency is slowed down (real 220 Hz is invisible): `ω_1 = 2π · (6 + pitchFactor·10)` rad/s.
- Higher modes decay faster: `γ_n = γ · n`.
- Draw each string as a polyline of 48 sample points.
- Plucking near the middle (p=0.5) → kills even harmonics → rounder shape and sound. Plucking near the end → brighter. Same in the audio (§6).

### 5.2 Glow
- `ctx.globalCompositeOperation = "lighter"`.
- Draw each vibrating string 3 times: wide + low alpha + `shadowBlur`, medium, thin white core.
- Glow intensity ∝ current vibration energy, so it fades as the string settles.

### 5.3 Particles
- On pluck: spawn 20–40 sparks at the hit point, velocity along the string normal ± spread, slight gravity, life 0.4–0.9 s, additive blend.
- Use an object pool (preallocate 600) — no allocations in the frame loop.

### 5.4 Overlay
- Toggle-able hand skeleton (green bones / red dots like the reel), FPS, pinch ratios, active state.

## 6. Audio
- One `AudioContext({ latencyHint: "interactive" })`, created/resumed on a **Start** button click.
- Master chain: voices → `DynamicsCompressorNode` → dry + `ConvolverNode` (generated reverb impulse: decaying noise, 2 s) → destination.
- Per pluck: `StereoPannerNode` with pan = string midpoint x mapped to [−0.8, 0.8].
- **Phase 3 (quick):** triangle oscillator + fast attack / exponential decay envelope.
- **Phase 5 (real): Karplus-Strong in an AudioWorklet**
  - Delay line length `N = sampleRate / f`.
  - Fill with a noise burst on pluck. Shape it by pluck position: comb-filter the burst with a delay of `p·N` (same physics as §5.1).
  - Loop: `out = decay · 0.5 · (buf[i] + buf[i+1])` → averaging = lowpass → high harmonics die first, like a real string.
  - Velocity → burst amplitude and brightness (lowpass the burst for soft plucks).
  - Stretch: fractional delay (first-order allpass) for accurate tuning on high notes.
  - One worklet node, polyphonic: manage up to 16 voices inside the processor, messages via `port.postMessage`.

## 7. Project layout
```
air-strings/
├── CLAUDE.md
├── docs/
│   ├── SPEC.md
│   └── LEARNING.md
├── index.html
├── package.json / tsconfig.json / vite.config.ts
├── public/
│   └── models/hand_landmarker.task        (optional local copy of the model)
└── src/
    ├── main.ts                 app bootstrap + rAF loop
    ├── config.ts               all tunables
    ├── events.ts               typed event bus
    ├── app/
    │   ├── appState.ts         screen state machine (§10.1)
    │   └── prefs.ts            localStorage: tutorialDone, settings, layouts
    ├── ui/
    │   ├── landing.ts          hero, demo loop, Start button, background model preload
    │   ├── permission.ts       camera prompt, denied / no-camera / loading screens
    │   ├── tutorial.ts         4 detection-driven steps, skippable
    │   ├── hud.ts              auto-hiding icon bar + keyboard shortcuts
    │   ├── hints.ts            "Hands not visible" / "Too dark" / "Move back"
    │   ├── settingsDrawer.ts   scale, root, mode, instrument, volume, camera…
    │   ├── recorder.ts         MediaRecorder: canvas + audio → preview → download
    │   ├── help.ts             gestures, shortcuts, meeting tip
    │   └── debugPanel.ts       lil-gui bindings (dev only, `D` key)
    ├── tracking/
    │   ├── camera.ts           getUserMedia, video element
    │   ├── handTracker.ts      HandLandmarker init + detectForVideo
    │   ├── coords.ts           normalized → canvas px, mirroring, cover-crop
    │   └── oneEuroFilter.ts    landmark smoothing
    ├── core/                   PURE — fully unit tested
    │   ├── vec2.ts
    │   ├── pinch.ts            [YOU WRITE] pinch ratio + hysteresis state machine
    │   ├── intersect.ts        [YOU WRITE] swept segment–segment test, returns t
    │   ├── music.ts            [YOU WRITE] length → MIDI → Hz, scale snapping, note names
    │   ├── stringModes.ts      [YOU WRITE] modal displacement y(x,t), pluck coefficients
    │   └── particles.ts        pooled particle update
    ├── scene/
    │   ├── StringEntity.ts     endpoints, note, colour, vibration state
    │   ├── StringManager.ts    create/commit/remove, FIFO cap, pluck detection loop
    │   └── gestureController.ts  wires pinch states → string creation
    ├── render/
    │   ├── renderer.ts         layer order, clear, composite modes
    │   ├── drawString.ts       glow passes, ticks, anchors, note label
    │   ├── drawHands.ts        skeleton overlay
    │   └── drawParticles.ts
    └── audio/
        ├── engine.ts           context, master chain, reverb, pan
        ├── simpleVoice.ts      Phase 3 oscillator voice
        └── worklets/
            └── karplus.worklet.ts  [YOU WRITE] Karplus-Strong processor (Phase 5)
tests/
    ├── pinch.test.ts  intersect.test.ts  music.test.ts  stringModes.test.ts
```

## 8. Build phases (one sprint each, ship a visible result every time)
| # | Deliverable | You can show off |
|---|---|---|
| 0 | Vite + TS scaffold, `appState` machine, landing + permission screens (§10.2–10.3), model preload with progress, mirrored webcam, MediaPipe skeleton overlay, FPS counter | Green-and-red hand skeleton like the reel |
| 1 | `coords.ts`, One Euro smoothing, `pinch.ts` with hysteresis + tests, debug readout | Pinch indicator on each hand |
| 2 | Two-hand drawing → dashed preview with ticks → commit solid strings; undo/clear; FIFO cap | Draw a web of strings in the air |
| 3 | `intersect.ts` swept test + cooldown; pluck event; simple oscillator sound; `music.ts` scale snapping + live note label; HUD with undo/clear + shortcuts; hints | **First playable instrument** |
| 3.5 | Tutorial (§10.4), basic settings drawer (scale, root, volume, skeleton toggle) | Friends can try it with no explanation |
| 4 | Modal vibration, glow passes, pitch-class colours, particle sparks | Looks like the reel |
| 5 | Karplus-Strong AudioWorklet, pluck-position + velocity timbre, stereo pan, reverb | Sounds like a real harp/guitar |
| 6 | Full settings (instrument, Free vs Scale mode, camera picker), recorder (§10.7), pause/idle (§10.8), help + meeting tip, open-palm clear gesture, saved layouts, deploy to GitHub Pages | Shareable link + reel of your own |

### Stretch ideas
- **Loop recorder:** record pluck events with timestamps, replay in a loop, layer on top.
- **Web MIDI out:** send notes to a DAW / phone synth.
- **Tanpura drone** on the root note (fits Raag modes).
- **Chord strings:** one string plays a triad instead of one note.
- **Fret it:** pinch a point on an existing string with one hand to shorten the vibrating length (raise pitch) while plucking with the other — like a real guitar.
- **Vanish crossover:** reuse your gesture code / package the tracking layer as a shared module.

## 9. Gotchas to handle
- Camera only on `localhost` / HTTPS. AudioContext only after a click.
- MediaPipe `handedness` is reported for the **unmirrored** image; when you mirror, "Left" and "Right" swap.
- `detectForVideo` needs strictly increasing timestamps; skip the frame if `video.currentTime` hasn't changed.
- Hands can be lost for a frame: keep last-known positions ~100 ms before dropping (avoids phantom plucks and broken pinches).
- When a hand reappears far away, reset its previous fingertip position so the swept test doesn't draw a giant segment through every string.
- Run detection at camera rate (~30 fps) but render at 60 fps; physics uses real `dt`.

## 10. User flow

### 10.1 Screen state machine (`src/app/appState.ts`)
```
LANDING ──Start──▶ REQUESTING_CAMERA ──granted──▶ LOADING_MODEL ──ready──▶ TUTORIAL ─done/skip─▶ PLAYING
                        │                              (skipped if                 (skipped if          │ ▲
                        ├─denied──▶ CAMERA_DENIED ─Retry─┘  model already loaded)   tutorialDone)        │ │
                        └─no device▶ NO_CAMERA                                                          ▼ │
                                                                                   PAUSED ◀─tab hidden / idle 60s
                                                                                     └──Resume / tab visible──┘
PLAYING ⇄ RECORDING ─stop─▶ RECORD_PREVIEW ─download / re-record / close─▶ PLAYING
```
Settings drawer and Help are overlays on PLAYING, not separate states. Tracking keeps running under them.

### 10.2 Landing (camera OFF)
- Hero: short looping demo video of the effect, one line: "Draw strings in the air. Play them with your hands.", big **Start playing** button.
- Privacy line: "Video stays on your device. Nothing is uploaded."
- On page load, start downloading the MediaPipe WASM + `hand_landmarker.task` (~8 MB) in the background.
- Mobile / small screen: show "Best on a laptop" note, but still allow Start.

### 10.3 Permission & loading
- The Start click is the single user gesture that: calls `getUserMedia({ video })`, creates/resumes the `AudioContext`, and (optionally) requests fullscreen.
- **Denied** → friendly screen: how to re-enable camera in the browser address bar + **Retry**.
- **No camera** (`NotFoundError`) → clear message instead of a black screen.
- **Model still loading** → progress bar, then continue automatically.
- GPU delegate fails → retry on CPU silently; log it in debug.

### 10.4 Tutorial (first visit only, skippable)
Each step completes when the app **detects** it, never by a Next button. A **Skip** link is always visible. On finish set `prefs.tutorialDone = true`.
1. "Show both hands" → skeleton appears, tick.
2. "Pinch both hands and pull them apart" → dashed preview string + live note label, tick.
3. "Let go" → string commits, tick.
4. "Swipe a finger through the string" → note + sparks, "You're playing!", fade into PLAYING (the tutorial string stays).

A step that isn't completed in 10 s shows a small looping hint animation for that step.

### 10.5 Playing
- Full-screen mirrored webcam + strings, particles, optional skeleton.
- HUD (top-right icons): key/scale, instrument, undo, clear, record, settings, help. Auto-hides after 3 s without mouse movement; reappears on move.
- Keyboard: `Z` undo · `C` clear · `R` record start/stop · `H` hide HUD · `D` debug panel · `Esc` close overlays.
- Hints (`ui/hints.ts`), one at a time, non-blocking, auto-dismiss:
  - No hands for 3 s → "Hands not visible"
  - Low average landmark confidence / dark frame → "Too dark, add some light"
  - Hand scale too large → "Move back a little"
- Max 12 strings: the oldest fades out (no error message).

### 10.6 Settings drawer (persisted in `prefs`)
| Setting | Options | Default |
|---|---|---|
| Scale | Major pentatonic / Bhupali, Minor pentatonic, Major, Minor, Yaman, Hirajoshi | Major pentatonic |
| Root note | C–B, octave 2–4 | C3 |
| Pitch mode | Scale (snapped) / Free (continuous) | Scale |
| Instrument | Harp, Guitar, Sitar (Karplus-Strong variants, Phase 5+) | Harp |
| Volume / Reverb | sliders | 0.8 / 0.3 |
| Hand skeleton | on / off | on |
| Effect intensity | low / medium / high (particle count, glow passes) | medium |
| Camera | device list from `enumerateDevices()` | default |
| Mirror | on / off | on |

### 10.7 Record & share
- Record button / `R` → 3-2-1 countdown → red dot + timer (max 60 s).
- `MediaRecorder` on a combined stream: `canvas.captureStream(30)` video track + `MediaStreamAudioDestinationNode` audio track (same master bus the speakers get).
- Stop → preview modal with the clip, **Download** (`.webm`; `.mp4` where the browser supports it), **Re-record**, **Close**.
- The HUD and hints are drawn in DOM, not on the canvas, so they never appear in recordings.

### 10.8 Pause & leave
- `visibilitychange` → hidden: stop detection + audio, enter PAUSED. Visible again: resume.
- No hands detected for 60 s → stop the camera tracks (camera light turns off) and show **Resume**. Resume re-requests the stream (no new permission prompt).
- Strings, settings and the current layout survive pause.

### 10.9 Help overlay
- Gesture cheatsheet (pinch-draw, swipe-pluck, open-palm clear).
- Keyboard shortcuts.
- **Play in a meeting:** "In Google Meet or Teams, choose Present / Share → this tab → turn on *Also share tab audio*."

### 10.10 v1 scope
v1 = §10.1–10.5 + basic settings (scale, root, volume, skeleton). Recording, full settings, pause/idle and help ship in Phase 6.
