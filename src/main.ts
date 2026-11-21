import { createAppState, type AppState } from "./app/appState";
import { config } from "./config";
import { drawHands } from "./render/drawHands";
import { coverTransform } from "./tracking/coords";
import { processResult, type Hand } from "./tracking/pipeline";
import { createDebugPanel } from "./ui/debugPanel";
import { classifyCameraError, startCamera } from "./tracking/camera";
import { detect, preloadHandTracker } from "./tracking/handTracker";

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
createDebugPanel(config);

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
  const ctx = canvas.getContext("2d")!;
  // Backing store is dpr-scaled; the transform lets all drawing code use CSS pixels.
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const a = config.fpsSmoothing;
  let last = performance.now();
  let renderFps = 0;
  let detectFps = 0;
  let lastDetect = last;
  let hands: Hand[] = [];

  const frame = (now: number) => {
    renderFps = a * renderFps + (1 - a) * (1000 / Math.max(now - last, 1));
    last = now;
    const r = detect(landmarker, video, now);
    const W = window.innerWidth;
    const H = window.innerHeight;
    // Recomputed every frame (cheap) so resizes just work; shared by video draw and landmarks.
    const t = coverTransform(video.videoWidth, video.videoHeight, W, H);
    if (r) {
      hands = processResult(r, t, W, now / 1000); // keep last hands between detections
      detectFps = a * detectFps + (1 - a) * (1000 / Math.max(now - lastDetect, 1));
      lastDetect = now;
    }
    ctx.clearRect(0, 0, W, H);
    // Draw video onto the canvas (cover-crop + mirror) so recordings of the canvas include it.
    ctx.save();
    if (config.mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    // In mirrored space the flip is symmetric about the center, so the same offsets apply.
    ctx.drawImage(video, t.offsetX, t.offsetY, t.videoW * t.scale, t.videoH * t.scale);
    ctx.restore();
    drawHands(ctx, hands);
    // MediaPipe labels assume a mirrored (selfie) input; our camera frame is unmirrored, so its
    // "Left" is the hand that ends up on the right side of the mirrored display. Swap for display.
    const display = (l: string) => (l.startsWith("Left") ? "R" : "L");
    const handLines = hands
      .map((h) => `${display(h.label)}  ratio ${h.ratio.toFixed(2)}  ${h.pinching ? "PINCH" : "open"}`)
      .join("\n");
    fpsEl.textContent =
      `render ${renderFps.toFixed(0)} fps\ndetect ${detectFps.toFixed(0)} fps\nhands ${hands.length}` +
      (handLines ? `\n${handLines}` : "");
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
