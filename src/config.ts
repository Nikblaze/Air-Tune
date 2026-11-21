// All tunable numbers live here (no magic numbers in logic files).
import type { ScaleId } from "./core/music";

export const config = {
  wasmBaseUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm",
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  numHands: 2,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  camera: { width: 1280, height: 720 },
  skeleton: { bones: "#00ff66", joints: "#ff3344", boneWidth: 3, jointRadius: 4 },
  fpsSmoothing: 0.9, // EMA weight on the old value
  mirror: true, // selfie view: flip x so the on-screen hand moves like a mirror
  // One Euro (Casiez 2012). beta is per px/s because we filter in canvas pixels.
  oneEuro: { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 },
  // Pinch ratio = thumb-index distance / hand scale. on < off gives hysteresis.
  pinch: { on: 0.3, off: 0.45, ringColor: "#00e5ff", fillColor: "#ffffff", radius: 12 },
  handHoldMs: 100, // keep a vanished hand this long (SPEC §9) so one missed frame doesn't break a pinch
  minStringLength: 80, // px; shorter pinches are discarded
  maxStrings: 12,
  stringFadeMs: 400,
  string: { color: "#ffffff", width: 3, anchorRadius: 6 },
  preview: { color: "#00e5ff", width: 2, anchorRadius: 8, dash: [10, 8] },
  music: {
    scale: "majorPentatonic" as ScaleId,
    rootMidi: 48, // C3
    pitchMode: "scale" as "scale" | "free",
    refLengthFrac: 0.6, // refLength = this x canvas width; a string that long plays the root
    minSemis: -12,
    maxSemis: 18, // 2.5 octaves
  },
  pluckCooldownMs: 120, // per (string, finger): one swipe = one pluck
  pluckFlashMs: 150, // brighter string after a pluck (Phase 4 replaces with real vibration)
  pluckMaxVelocity: 3000, // px/s that maps to velocity 1
  pluckMinVelocity: 0.15, // floor so gentle touches still sound
  maxFingerJumpPx: 400, // bigger per-detection jump = tracking glitch, not a strum (SPEC §9)
  audio: { volume: 0.8, reverb: 0.3, reverbSeconds: 2, voiceGain: 0.5, decaySeconds: 1.6 },
  hints: { noHandsMs: 3000, tooCloseFrac: 0.3, darkLuma: 45 },
  debug: { showSkeleton: true },
};
