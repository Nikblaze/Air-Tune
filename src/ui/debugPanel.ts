import GUI from "lil-gui";
import { INTENSITIES, type config as Config } from "../config";
import { SCALES } from "../core/music";

/** Live tuning panel. Hidden by default; press D to toggle. */
export function createDebugPanel(config: typeof Config): GUI {
  const gui = new GUI({ title: "Debug (D)" });
  gui.hide();
  let visible = false;
  const pinch = gui.addFolder("Pinch");
  pinch.add(config.pinch, "on", 0.1, 0.6, 0.01);
  pinch.add(config.pinch, "off", 0.1, 0.8, 0.01);
  const euro = gui.addFolder("One Euro");
  euro.add(config.oneEuro, "minCutoff", 0.01, 5, 0.01);
  euro.add(config.oneEuro, "beta", 0, 0.05, 0.0005);
  euro.add(config.oneEuro, "dCutoff", 0.1, 5, 0.1);
  const strings = gui.addFolder("Strings");
  strings.add(config, "minStringLength", 20, 300, 1);
  strings.add(config, "maxStrings", 1, 24, 1);
  strings.add(config, "stringFadeMs", 0, 2000, 50);
  strings.add(config, "handHoldMs", 0, 500, 10);
  const music = gui.addFolder("Music");
  music.add(config.music, "scale", Object.keys(SCALES));
  music.add(config.music, "rootMidi", 24, 72, 1);
  music.add(config.music, "pitchMode", ["scale", "free"]);
  music.add(config.music, "refLengthFrac", 0.2, 1.2, 0.01);
  const audio = gui.addFolder("Audio");
  audio.add(config.audio, "volume", 0, 1, 0.01);
  audio.add(config.audio, "reverb", 0, 1, 0.01);
  const pluck = gui.addFolder("Pluck");
  pluck.add(config, "pluckCooldownMs", 0, 500, 10);
  pluck.add(config, "pluckMaxVelocity", 500, 6000, 100);
  pluck.add(config, "maxFingerJumpPx", 100, 1000, 10);
  const visuals = gui.addFolder("Visuals");
  visuals.add(config.visuals, "intensity", [...INTENSITIES]);
  visuals.add(config.vibration, "damping", 0.5, 8, 0.1);
  visuals.add(config.vibration, "maxAmplitudePx", 5, 80, 1);
  visuals.add(config.vibration, "freqBase", 1, 20, 0.5);
  visuals.add(config.vibration, "freqRange", 0, 30, 0.5);
  visuals.add(config.vibration, "restEnergy", 0.0001, 0.05, 0.0001);
  visuals.add(config.particles, "gravity", 0, 1500, 10);
  visuals.add(config.particles, "speed", 100, 1500, 10);
  visuals.add(config.particles, "spread", 0, 1.5, 0.05);
  const debug = gui.addFolder("Debug");
  debug.add(config.debug, "showSkeleton");
  debug.add(config, "mirror");

  window.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement;
    if (el.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key.toLowerCase() === "d") gui.show((visible = !visible));
  });
  return gui;
}
