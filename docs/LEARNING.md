# Air Strings — Learning Guide

What you'll actually learn, mapped to each phase. Do the "check" questions without looking anything up; if you can't answer one, ask Claude Code to re-explain before moving on.

## Phase 0–1 · Computer vision input
**Concepts**
- MediaPipe Hand Landmarker: a palm detector finds hands, then a landmark model outputs 21 (x, y, z) points per hand, normalized to [0,1].
- Coordinate spaces: normalized → video pixels → canvas pixels (mirroring + cover-crop).
- Noise and jitter: why raw landmarks shake, and the **One Euro filter** (smooths heavily when slow, lightly when fast → low jitter *and* low lag).
- Scale-invariant thresholds: divide distances by hand size.
- **Hysteresis**: two thresholds instead of one so a state doesn't flicker at the boundary (same idea as a thermostat).

**Check**
1. Why does a single pinch threshold of 0.35 cause flicker, and how do two thresholds fix it?
2. Why divide by `dist(wrist, middleMCP)` instead of using a fixed pixel threshold?
3. What does One Euro trade off, and which parameter controls it?

## Phase 2 · State machines & scene management
**Concepts**
- Gesture as a finite state machine (IDLE / DRAWING / COMMIT).
- Entities with lifecycle, FIFO caps, undo stack.
- Event bus decoupling: the scene doesn't know audio exists.

**Check**
1. What should happen if one hand disappears mid-draw for 2 frames? For 2 seconds?
2. Why emit `stringCreated` as an event instead of calling the renderer directly?

## Phase 3 · Geometry & first sound
**Concepts**
- 2D cross product and "which side of a line is this point on".
- Segment–segment intersection and the parameter `t`.
- **Swept / continuous collision detection** vs point-in-radius (tunnelling problem — same as bullets passing through walls in games).
- Equal temperament: `f = 440 · 2^((m−69)/12)`; octave = ×2 frequency = half the string length.
- Scales as semitone sets; quantization (snapping).
- Web Audio graph: nodes, `AudioParam` automation, envelopes.

**Check**
1. At 30 fps a finger moves 150 px per frame across a string. Why does a "distance < 20px" test miss it?
2. A string is 300 px and plays A3. What length plays A4? A2?
3. Why does the major pentatonic (Raag Bhupali) sound good no matter which strings you hit?

## Phase 4 · Physics-based visuals
**Concepts**
- Standing waves on a fixed-end string; modes `sin(nπx)`; harmonics at n·f.
- Fourier coefficients of a triangular pluck: why plucking at the middle removes even harmonics.
- Damping and why higher modes die faster.
- Additive blending for light/glow; object pools to avoid GC stutters.
- Frame-rate independence with real `dt`.

**Check**
1. Pluck exactly at p = 0.5. Which harmonics vanish and why (look at `sin(nπp)`)?
2. Why not allocate a new particle object per spark?

## Phase 5 · Audio synthesis (the big one)
**Concepts**
- **Karplus-Strong**: a delay line + averaging filter = a physical model of a string. Delay length sets pitch; the averaging (lowpass) makes high harmonics decay first, which is what makes it sound "plucked".
- AudioWorklet: custom DSP on the audio thread; 128-sample render quanta; why you never allocate inside `process()`.
- Integer delay → tuning error on high notes → fractional delay with an allpass filter.
- Same physics as Phase 4: pluck position = comb filter on the excitation.
- Latency budget: camera frame → detection → event → audio buffer. Where do the milliseconds go?

**Check**
1. At 48 kHz, what delay length gives 220 Hz? What's the pitch error if you round it?
2. What happens to the sound if the decay factor is 1.0? 0.9?
3. Why must DSP run in a worklet rather than in your rAF loop?

## Phase 6 · Product polish
- UX for gestures (feedback before commit, forgiving thresholds).
- Persisting state, deploying a static site over HTTPS.
- Profiling with Chrome Performance panel.

## Reading list
- MediaPipe Hand Landmarker for Web — ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js
- One Euro Filter — gery.casiez.net/1euro
- Karplus & Strong (1983), "Digital Synthesis of Plucked-String and Drum Timbres"; Jaffe & Smith (1983) extensions
- Julius O. Smith, *Physical Audio Signal Processing* (free online) — chapters on digital waveguides
- MDN: Web Audio API, AudioWorklet
- "The Nature of Code" by Daniel Shiffman — particles and forces
