// All tunable numbers live here (no magic numbers in logic files).
import type { InstrumentId } from "./core/karplus";
import type { ScaleId } from "./core/music";

export const INTENSITIES = ["low", "medium", "high"] as const;
export type Intensity = (typeof INTENSITIES)[number];

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
  cameraId: "", // saved deviceId; "" = browser default
  mirror: true, // selfie view: flip x so the on-screen hand moves like a mirror
  // One Euro (Casiez 2012). beta is per px/s because we filter in canvas pixels.
  oneEuro: { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 },
  // Pinch ratio = thumb-index distance / hand scale. on < off gives hysteresis.
  pinch: { on: 0.3, off: 0.45, ringColor: "#00e5ff", fillColor: "#ffffff", radius: 12 },
  handHoldMs: 100, // keep a vanished hand this long (SPEC §9) so one missed frame doesn't break a pinch
  minStringLength: 80, // px; shorter pinches are discarded
  minDrawMs: 200, // a two-hand pinch held shorter than this is tracking noise, not a draw
  maxStrings: 12,
  stringFadeMs: 400,
  string: { color: "#ffffff", width: 4, anchorRadius: 7 },
  preview: { color: "#00e5ff", width: 2, anchorRadius: 8, dash: [10, 8] },
  music: {
    scale: "majorPentatonic" as ScaleId,
    rootMidi: 48, // C3
    pitchMode: "scale" as "scale" | "free",
    refLengthFrac: 0.6, // refLength = this x canvas width; a string that long plays the root
    minSemis: -12,
    maxSemis: 18, // 2.5 octaves
  },
  // Pluck vibration (SPEC §5.1). Real pitch (hundreds of Hz) is invisible, so ω1 is slowed to
  // 2π·(freqBase + pitchFactor·freqRange) rad/s: higher notes visibly shimmer faster.
  vibration: { modes: 6, samples: 48, damping: 2.5, maxAmplitudePx: 26, freqBase: 6, freqRange: 10, restEnergy: 0.002 },
  // Effect intensity (SPEC §10.6): glow passes, blur on the wide pass (px), particle count multiplier.
  visuals: {
    // Additive glow on a bright (daylight) video saturates to white and the hues vanish:
    // dim the video a little and put a dark underlay beneath each string for contrast.
    videoDim: 0.35, // 0..1 black overlay on the camera image
    underlay: 0.55, // 0..1 alpha of the dark line drawn under each string
    intensity: "medium" as Intensity,
    levels: {
      low: { passes: 1, blur: 0, particles: 0.4 },
      medium: { passes: 3, blur: 14, particles: 1 },
      high: { passes: 3, blur: 28, particles: 1.6 },
    } satisfies Record<Intensity, { passes: number; blur: number; particles: number }>,
    maxDtSec: 0.05, // clamp physics dt so a tab switch doesn't explode particles
  },
  particles: { pool: 1200, minCount: 40, maxCount: 80, speed: 700, spread: 0.7, gravity: 400, lifeMin: 0.5, lifeMax: 1.1, radius: 3.5 },
  pluckCooldownMs: 120, // per (string, finger): one swipe = one pluck
  pluckMaxVelocity: 3000, // px/s that maps to velocity 1
  pluckMinVelocity: 0.15, // floor so gentle touches still sound
  maxFingerJumpPx: 400, // bigger per-detection jump = tracking glitch, not a strum (SPEC §9)
  maxFingerGapMs: 200, // older previous fingertip = no swept segment (3+ missed detections)
  audio: {
    volume: 0.8,
    reverb: 0.3,
    reverbSeconds: 2,
    voiceGain: 0.5, // Phase 3 fallback voice
    decaySeconds: 1.6, // Phase 3 fallback voice
    instrument: "harp" as InstrumentId,
    karplusGain: 0.35, // worklet voices peak near 1 and sum; leave headroom for the compressor
  },
  hints: { noHandsMs: 3000, tooCloseFrac: 0.3, darkLuma: 45 },
  idle: { noHandsMs: 60000 }, // no hands this long while PLAYING -> camera off + Resume overlay (SPEC §10.8)
  // Record & share (SPEC §10.7). Order = preference: mp4 where the browser can, else webm.
  recorder: {
    maxSeconds: 60,
    fps: 30,
    countdownFrom: 3,
    timesliceMs: 1000,
    mimeTypes: ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"],
  },
  layout: { saveDebounceMs: 500 },
  tutorial: { hintAfterMs: 10000, doneShowMs: 1200 },
  debug: { showSkeleton: true },
};
