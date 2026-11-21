// All tunable numbers live here (no magic numbers in logic files).
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
  debug: { showSkeleton: true },
};
