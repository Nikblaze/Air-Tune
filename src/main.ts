import { createLayoutSaver, denormalizeLayout, loadLayout } from "./app/layouts";
import { applyPrefs, loadPrefs, savePrefs } from "./app/prefs";
import { createAppState, type AppState } from "./app/appState";
import { config } from "./config";
import { getAudio } from "./audio/engine";
import { lengthToMidi, midiToHz, noteName, pitchHue, SCALES, tickFractions, type MusicOpts } from "./core/music";
import { createParticles } from "./core/particles";
import { dist } from "./core/vec2";
import { bus } from "./events";
import { render } from "./render/renderer";
import { createGestureController } from "./scene/gestureController";
import { StringManager } from "./scene/StringManager";
import { createHelp } from "./ui/help";
import { createHints } from "./ui/hints";
import { initHud } from "./ui/hud";
import { createRecorder, recorderSupported } from "./ui/recorder";
import { createSettingsDrawer } from "./ui/settingsDrawer";
import { startTutorial } from "./ui/tutorial";
import { createFingerTracker } from "./tracking/fingerTracker";
import { coverTransform } from "./tracking/coords";
import { processResult, type Hand } from "./tracking/pipeline";
import { createDebugPanel } from "./ui/debugPanel";
import { classifyCameraError, startCamera, stopCamera } from "./tracking/camera";
import { detect, preloadHandTracker } from "./tracking/handTracker";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const sectionFor: Record<AppState, string> = {
  LANDING: "landing",
  REQUESTING_CAMERA: "requesting",
  CAMERA_DENIED: "denied",
  NO_CAMERA: "no-camera",
  LOADING_MODEL: "loading",
  TUTORIAL: "stage", // same canvas as PLAYING: drawing and plucking work during the tutorial
  PLAYING: "stage",
  RECORDING: "stage",
  RECORD_PREVIEW: "stage",
  PAUSED: "stage", // canvas stays as the backdrop; the Resume overlay (idle case) sits on top
};

const prefs = loadPrefs();
applyPrefs(prefs);

const app = createAppState((state) => {
  document.body.dataset.state = state; // CSS shows the HUD / settings only in PLAYING
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

let stream: MediaStream | null = null;
let recorder: ReturnType<typeof createRecorder> | null = null;
let pauseReason: "hidden" | "idle" | null = null;
const resumeEl = $("#resume");
const resumeText = $("#resume-text");
const resumeBtn = $<HTMLButtonElement>("#resume-btn");

// PAUSED: the rAF loop keeps ticking but skips all work; strings, particles and prefs live on untouched.
function pause(reason: "hidden" | "idle") {
  // Simple rule: a hidden tab while recording ends the recording (-> preview) instead of pausing,
  // since the browser throttles the canvas and the clip would be garbage anyway.
  recorder?.cancelCountdown();
  if (app.get() === "RECORDING") return recorder?.stop();
  const before = app.get();
  app.send("pause");
  if (app.get() === before) return;
  pauseReason = reason;
  void getAudio().suspend();
  if (reason === "idle") {
    stopCamera(stream); // camera light off
    stream = null;
    video.srcObject = null;
    resumeText.textContent = "Paused — camera off to save power";
    resumeEl.hidden = false;
  }
}

// Visibility pause only applies in PLAYING (the tutorial is short and needs the camera to stay on).
// Auto-resume only for "hidden": an idle pause waits for the Resume click because the camera is off.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause("hidden");
  else if (app.get() === "PAUSED" && pauseReason === "hidden") {
    pauseReason = null;
    app.send("resume");
    void getAudio().resume();
  }
});

resumeBtn.addEventListener("click", async () => {
  void getAudio().resume(); // synchronous inside the click (autoplay rules)
  resumeBtn.disabled = true;
  try {
    stream = await startCamera(video, config.cameraId); // permission already granted: no prompt
  } catch (err) {
    console.warn("Camera restart failed", err);
    resumeText.textContent = "Could not restart the camera. Check it is connected, then try again.";
    return;
  } finally {
    resumeBtn.disabled = false;
  }
  resumeEl.hidden = true;
  pauseReason = null;
  app.send("resume");
});

async function switchCamera() {
  stopCamera(stream); // old tracks first, or some browsers refuse to open a second camera
  try {
    stream = await startCamera(video, config.cameraId);
  } catch (err) {
    console.warn("Camera switch failed", err);
  }
}

async function requestCamera() {
  try {
    stream = await startCamera(video, config.cameraId);
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
  app.send(prefs.tutorialDone ? "modelReadyReturning" : "modelReady");
  const finishTutorial = () => {
    tutorial = null;
    if (manager.strings.length === 0) restore(); // the tutorial's own string wins over a saved layout
    prefs.tutorialDone = true;
    savePrefs(prefs);
    app.send("tutorialDone");
  };
  let tutorial = app.get() === "TUTORIAL" ? startTutorial({ bus, onDone: finishTutorial }) : null;
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
  const particles = createParticles(config.particles.pool, config.particles);
  const gesture = createGestureController();
  const manager = new StringManager(bus);
  const fingers = createFingerTracker();
  const hints = createHints();
  const layout = createLayoutSaver(() => ({
    strings: manager.strings.filter((s) => s.fadeStart === null), // fading strings are already gone
    W: window.innerWidth,
    H: window.innerHeight,
  }));
  bus.on("stringCreated", layout.schedule);
  bus.on("stringRemoved", layout.schedule);
  window.addEventListener("pagehide", layout.flush); // a reload right after Clear must not bring the strings back
  const undo = () => {
    manager.undo(performance.now());
    layout.schedule();
  };
  const clearAll = () => {
    manager.clear(performance.now());
    layout.schedule();
  };
  recorder = createRecorder({ canvas, app, audioStream: () => getAudio().recordStream() });
  const hud = initHud({
    onUndo: undo,
    onClear: clearAll,
    onRecord: () => recorderSupported() && recorder!.toggle(), // the R key calls this too
    canRecord: recorderSupported(),
    onSettings: () => drawer.open(),
    onHelp: () => app.get() === "PLAYING" && help.toggle(),
  });
  const help = createHelp();
  // One Esc handler: close the topmost overlay (help sits above the drawer).
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") help.isOpen() ? help.close() : drawer.close();
  });
  const drawer = createSettingsDrawer({
    onChange() {
      Object.assign(prefs, {
        scale: config.music.scale,
        rootMidi: config.music.rootMidi,
        volume: config.audio.volume,
        showSkeleton: config.debug.showSkeleton,
        intensity: config.visuals.intensity,
        instrument: config.audio.instrument,
        pitchMode: config.music.pitchMode,
        reverb: config.audio.reverb,
        mirror: config.mirror,
        cameraId: config.cameraId,
      });
      savePrefs(prefs);
    },
    onCamera: () => void switchCamera(),
  });

  // Built per call so debug-panel edits and window resizes apply immediately.
  const musicOpts = (): MusicOpts => ({
    refLength: config.music.refLengthFrac * window.innerWidth,
    rootMidi: config.music.rootMidi,
    scale: config.music.pitchMode === "scale" ? SCALES[config.music.scale].steps : null,
    minSemis: config.music.minSemis,
    maxSemis: config.music.maxSemis,
  });

  // Restore the saved layout once on entering PLAYING. Normalized endpoints are scaled to the CURRENT
  // window (string lengths, hence pitches, change with screen size: fine) and pitch is recomputed
  // from the current music settings.
  const saved = loadLayout();
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    const now = performance.now();
    const opts = musicOpts();
    for (const s of denormalizeLayout(saved, window.innerWidth, window.innerHeight)) {
      const midi = lengthToMidi(dist(s.a, s.b), opts);
      manager.add(s.a, s.b, now, { midi, hz: midiToHz(midi) });
    }
  };
  if (app.get() === "PLAYING") restore();

  // Audio is event-driven: the pluck event carries everything the voice needs.
  bus.on("stringPlucked", (e) => {
    const s = manager.strings.find((x) => x.id === e.stringId);
    if (!s) return;
    const W = window.innerWidth;
    const pan = ((s.a.x + s.b.x) / 2 / W) * 1.6 - 0.8; // [0,W] -> [-0.8,0.8]
    getAudio().pluck({ hz: s.hz, velocity: e.velocity, pan });
    // Sparks fly the way the finger was moving: away from the side it came from (-direction).
    const len = dist(s.a, s.b) || 1;
    const k = -e.direction / len;
    const cfg = config.particles;
    const count = Math.round((cfg.minCount + (cfg.maxCount - cfg.minCount) * e.velocity) * config.visuals.levels[config.visuals.intensity].particles);
    particles.spawn(
      s.a.x + (s.b.x - s.a.x) * e.t,
      s.a.y + (s.b.y - s.a.y) * e.t,
      -(s.b.y - s.a.y) * k,
      (s.b.x - s.a.x) * k,
      pitchHue(s.midi),
      count,
      cfg.speed * (0.4 + 0.6 * e.velocity),
    );
  });

  let noHandsSince: number | null = null;
  const frame = (now: number) => {
    if (app.get() === "PAUSED") {
      last = now; // no huge dt on resume
      hands = []; // stale hands would fake a pinch/pluck on the first frame back
      noHandsSince = null;
      requestAnimationFrame(frame);
      return;
    }
    renderFps = a * renderFps + (1 - a) * (1000 / Math.max(now - last, 1));
    const dt = Math.min(config.visuals.maxDtSec, (now - last) / 1000);
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
      // Once per NEW detection: p0->p1 must span exactly one detection, not one render frame.
      manager.detectPlucks(fingers.update(hands, now), now);
    }
    const g = gesture.update(hands, now);
    const opts = musicOpts();
    if (g.commit) {
      const midi = lengthToMidi(dist(g.commit.a, g.commit.b), opts);
      manager.add(g.commit.a, g.commit.b, now, { midi, hz: midiToHz(midi) });
    }
    // Idle: no live hands for a long time while PLAYING -> free the camera.
    if (app.get() === "PLAYING" && hands.every((h) => h.held)) {
      noHandsSince ??= now;
      if (now - noHandsSince >= config.idle.noHandsMs) pause("idle");
    } else noHandsSince = null;
    manager.update(now);
    particles.update(dt);
    tutorial?.update(hands, g.state, now); // after manager.add so a commit's stringCreated is seen this frame
    const len = g.preview ? dist(g.preview.a, g.preview.b) : 0;
    const previewMidi = g.preview ? lengthToMidi(len, opts) : 0;
    const preview = g.preview && {
      ...g.preview,
      label: noteName(previewMidi),
      color: `hsl(${pitchHue(previewMidi)}, 100%, 65%)`,
      ticks: tickFractions(len, opts),
    };
    render(ctx, { video, t, W, H, strings: manager.strings, alphaOf: (s) => manager.alpha(s, now), now, preview, hands, particles });
    hints.update({ hands, now, video });
    hud.setLabel(
      config.music.pitchMode === "free" ? "Free pitch" : `${noteName(config.music.rootMidi)} \u00b7 ${SCALES[config.music.scale].name}`,
    );
    // MediaPipe labels assume a mirrored (selfie) input; our camera frame is unmirrored, so its
    // "Left" is the hand that ends up on the right side of the mirrored display. Swap for display.
    const display = (l: string) => (l.startsWith("Left") ? "R" : "L");
    const handLines = hands
      .map((h) => `${display(h.label)}  ratio ${h.ratio.toFixed(2)}  ${h.pinching ? "PINCH" : "open"}`)
      .join("\n");
    fpsEl.textContent =
      `render ${renderFps.toFixed(0)} fps\ndetect ${detectFps.toFixed(0)} fps\nhands ${hands.length}\nstate ${g.state}\nstrings ${manager.strings.length}` +
      (handLines ? `\n${handLines}` : "");
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Only act when the click actually moved the state machine: a double-click
// would otherwise start two camera requests and two rAF loops.
const go = (event: "start" | "retry") => () => {
  // Must run synchronously inside the click, before any await (autoplay rules). Idempotent.
  void getAudio().resume();
  const before = app.get();
  app.send(event);
  if (app.get() !== before) void requestCamera();
};
$("#start").addEventListener("click", go("start"));
document.querySelectorAll(".retry").forEach((b) => b.addEventListener("click", go("retry")));
