import { createAppState, type AppState } from "./app/appState";
import { config } from "./config";
import { drawHands } from "./render/drawHands";
import { classifyCameraError, startCamera } from "./tracking/camera";
import { detect, preloadHandTracker } from "./tracking/handTracker";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const sectionFor: Record<AppState, string> = {
  LANDING: "landing",
  REQUESTING_CAMERA: "requesting",
  CAMERA_DENIED: "denied",
  NO_CAMERA: "no-camera",
  LOADING_MODEL: "loading",
  PLAYING: "stage",
};

const app = createAppState((state) => {
  document.querySelectorAll("section").forEach((s) => (s.hidden = s.id !== sectionFor[state]));
});

const video = $<HTMLVideoElement>("video");
const canvas = $<HTMLCanvasElement>("canvas");
const fpsEl = $("#fps");
const progress = $<HTMLProgressElement>("#progress");

// Start the model download immediately; by the time the user clicks it is often done.
const landmarkerPromise = preloadHandTracker((f) => {
  if (Number.isNaN(f)) progress.removeAttribute("value"); // indeterminate
  else progress.value = f;
});
landmarkerPromise.catch((err) => {
  console.error(err);
  $("#loading-text").textContent = "Could not load hand tracking. Check your connection and reload.";
  progress.hidden = true;
});

async function requestCamera() {
  try {
    await startCamera(video);
  } catch (err) {
    app.send(classifyCameraError(err));
    return;
  }
  app.send("granted");
  let landmarker;
  try {
    landmarker = await landmarkerPromise; // passes straight through if already loaded
  } catch {
    return; // error text already shown in #loading
  }
  app.send("modelReady");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;

  const a = config.fpsSmoothing;
  let last = performance.now();
  let renderFps = 0;
  let detectFps = 0;
  let lastDetect = last;
  let result: HandLandmarkerResult | null = null;

  const frame = (now: number) => {
    renderFps = a * renderFps + (1 - a) * (1000 / Math.max(now - last, 1));
    last = now;
    const r = detect(landmarker, video, now);
    if (r) {
      result = r; // keep last result between detections
      detectFps = a * detectFps + (1 - a) * (1000 / Math.max(now - lastDetect, 1));
      lastDetect = now;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (result) drawHands(ctx, result, canvas.width, canvas.height);
    fpsEl.textContent =
      `render ${renderFps.toFixed(0)} fps\ndetect ${detectFps.toFixed(0)} fps\nhands ${result?.landmarks.length ?? 0}`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Only act when the click actually moved the state machine: a double-click
// would otherwise start two camera requests and two rAF loops.
const go = (event: "start" | "retry") => () => {
  const before = app.get();
  app.send(event);
  if (app.get() !== before) void requestCamera();
};
$("#start").addEventListener("click", go("start"));
document.querySelectorAll(".retry").forEach((b) => b.addEventListener("click", go("retry")));
