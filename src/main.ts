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
import { createHints } from "./ui/hints";
import { initHud } from "./ui/hud";
import { createSettingsDrawer } from "./ui/settingsDrawer";
import { startTutorial } from "./ui/tutorial";
import { createFingerTracker } from "./tracking/fingerTracker";
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
  TUTORIAL: "stage", // same canvas as PLAYING: drawing and plucking work during the tutorial
  PLAYING: "stage",
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
  app.send(prefs.tutorialDone ? "modelReadyReturning" : "modelReady");
  const finishTutorial = () => {
    tutorial = null;
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
  const hud = initHud({
    onUndo: () => manager.undo(performance.now()),
    onClear: () => manager.clear(performance.now()),
    onSettings: () => drawer.open(),
  });
  const drawer = createSettingsDrawer({
    onChange() {
      Object.assign(prefs, {
        scale: config.music.scale,
        rootMidi: config.music.rootMidi,
        volume: config.audio.volume,
        showSkeleton: config.debug.showSkeleton,
        intensity: config.visuals.intensity,
      });
      savePrefs(prefs);
    },
  });

  // Built per call so debug-panel edits and window resizes apply immediately.
  const musicOpts = (): MusicOpts => ({
    refLength: config.music.refLengthFrac * window.innerWidth,
    rootMidi: config.music.rootMidi,
    scale: config.music.pitchMode === "scale" ? SCALES[config.music.scale].steps : null,
    minSemis: config.music.minSemis,
    maxSemis: config.music.maxSemis,
  });

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

  const frame = (now: number) => {
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
