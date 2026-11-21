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
} as const;
