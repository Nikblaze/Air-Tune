# Air Strings — CLAUDE.md

A browser app where you **draw glowing "strings" in the air with a two-hand pinch**, and **pluck/strum them with your fingers** to play musical notes. Webcam → hand tracking → string physics → sound + glow.

Full design: `docs/SPEC.md`. Concepts and learning checkpoints: `docs/LEARNING.md`. Read both before starting a phase.

## Who you're working with
Axel is a senior developer (Rails/React/Angular, C++) who has already shipped a MediaPipe hand-gesture browser extension (Vanish). He knows hand tracking basics. **This project is for learning** the parts he hasn't done: string physics, swept collision detection, audio synthesis (Karplus-Strong), and music theory mapping.

## Teaching mode (important)
- Work **one phase at a time** from `docs/SPEC.md` §8. Never jump ahead.
- At the start of each phase: explain the concept in ≤10 lines, with the key formula, before writing code.
- For the files marked **[YOU WRITE]** in the spec, do NOT write the implementation. Create the file with the function signatures, types, JSDoc and failing Vitest tests, then let Axel implement. Review his code when he asks.
- End each phase with: what was built, how to verify it in the browser, and 2–3 "check your understanding" questions from `docs/LEARNING.md`.
- Prefer clear, readable code over clever code. Comment the *why*, especially for math.

## Stack (do not swap without asking)
- Vite + TypeScript (strict), no UI framework. Vanilla DOM for the small control panel.
- `@mediapipe/tasks-vision` → `HandLandmarker`, `runningMode: "VIDEO"`, `numHands: 2`, GPU delegate with CPU fallback. Check the current docs/npm version before installing; don't trust remembered APIs.
- Canvas 2D for rendering (additive blending for glow). WebGL/PixiJS only if profiling shows Canvas 2D can't hold 60fps.
- Web Audio API. Phase 3 uses simple oscillators; Phase 5 replaces them with a hand-written Karplus-Strong `AudioWorkletProcessor`. No Tone.js (the point is to learn synthesis).
- Vitest for pure logic (geometry, pinch detection, pitch mapping, physics step).
- `lil-gui` for a live tuning panel (thresholds, damping, scale, root note).

## Architecture rules
- `src/core/` is **pure functions only**: no DOM, no Web Audio, no MediaPipe imports. Everything there gets unit tests.
- One `requestAnimationFrame` loop in `src/main.ts`: `track → interpret gestures → update physics → render`. Audio is triggered by events, not polled.
- Work in **canvas pixel space** after a single conversion from MediaPipe's normalized coords (handle mirroring + `object-fit: cover` cropping in one function: `src/tracking/coords.ts`).
- All tunable numbers live in `src/config.ts` and are exposed in the lil-gui panel. No magic numbers in logic files.
- Events flow through a tiny typed event bus (`src/events.ts`): `stringCreated`, `stringPlucked`, `stringRemoved`.

## Commands
- `npm run dev` — dev server (camera needs `localhost` or HTTPS)
- `npm test` — Vitest
- `npm run build` — production build
- `npm run typecheck`

## Definition of done for any change
- `npm run typecheck` and `npm test` pass.
- Holds ~60fps render with 2 hands and 12 strings on a mid-range laptop (show FPS in the debug overlay).
- Audio starts only after a user click (browser autoplay rules).
