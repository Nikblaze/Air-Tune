// Right-side settings drawer (SPEC §10.6, v1 subset). An overlay on PLAYING, not an app state.
import { config, INTENSITIES, type Intensity } from "../config";
import { INSTRUMENTS, type InstrumentId } from "../core/karplus";
import { SCALES, type ScaleId } from "../core/music";
import { listCameras } from "../tracking/camera";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const OCTAVES = [2, 3, 4];

const options = (items: [string | number, string][]) => items.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");

/**
 * Edits go straight into `config` (read live by music/audio/render); onChange is for persistence + HUD.
 * onCamera fires only when the camera select changes (main restarts the stream).
 */
export function createSettingsDrawer({ onChange, onCamera }: { onChange: () => void; onCamera: () => void }) {
  const el = document.createElement("aside");
  el.id = "settings";
  el.setAttribute("aria-label", "Settings");
  el.inert = true; // keeps closed-drawer controls out of the tab order
  el.innerHTML = `
    <header><h2>Settings</h2><button type="button" data-close aria-label="Close settings">×</button></header>
    <label>Scale <select data-k="scale">${options(Object.entries(SCALES).map(([id, s]) => [id, s.name]))}</select></label>
    <label>Root note <span class="row">
      <select data-k="note" aria-label="Note">${options(NOTES.map((n, i) => [i, n]))}</select>
      <select data-k="octave" aria-label="Octave">${options(OCTAVES.map((o) => [o, String(o)]))}</select></span></label>
    <label>Pitch mode <select data-k="pitchMode">${options([["scale", "Scale (snapped)"], ["free", "Free (continuous)"]])}</select></label>
    <label>Instrument <select data-k="instrument">${options(Object.keys(INSTRUMENTS).map((i) => [i, i[0].toUpperCase() + i.slice(1)]))}</select></label>
    <label>Volume <input type="range" data-k="volume" min="0" max="1" step="0.01" /></label>
    <label>Reverb <input type="range" data-k="reverb" min="0" max="1" step="0.01" /></label>
    <label>Effect intensity <select data-k="intensity">${options(INTENSITIES.map((i) => [i, i[0].toUpperCase() + i.slice(1)]))}</select></label>
    <label class="check"><input type="checkbox" data-k="skeleton" /> Hand skeleton</label>
    <label class="check"><input type="checkbox" data-k="mirror" /> Mirror view</label>
    <label>Camera <select data-k="camera"></select></label>
    <p class="caption">Existing strings keep their notes; only new strings use the new scale and root.</p>`;
  document.body.append(el);
  const f = <T extends HTMLElement>(k: string) => el.querySelector<T>(`[data-k="${k}"]`)!;
  const scale = f<HTMLSelectElement>("scale"), note = f<HTMLSelectElement>("note"), octave = f<HTMLSelectElement>("octave");
  const volume = f<HTMLInputElement>("volume"), skeleton = f<HTMLInputElement>("skeleton");
  const intensity = f<HTMLSelectElement>("intensity"), instrument = f<HTMLSelectElement>("instrument");
  const pitchMode = f<HTMLSelectElement>("pitchMode"), reverb = f<HTMLInputElement>("reverb");
  const mirror = f<HTMLInputElement>("mirror"), camera = f<HTMLSelectElement>("camera");

  // Called after permission is granted (labels are empty before) and on plug/unplug.
  const refreshCameras = async () => {
    const cams = await listCameras();
    camera.innerHTML = options([["", "Default"], ...cams.map((c, i): [string, string] => [c.deviceId, c.label || `Camera ${i + 1}`])]);
    camera.value = config.cameraId;
    if (camera.value !== config.cameraId) camera.value = ""; // saved device is gone: show Default
  };
  void refreshCameras().catch(() => {});
  navigator.mediaDevices.addEventListener("devicechange", () => void refreshCameras().catch(() => {}));

  const sync = () => {
    scale.value = config.music.scale;
    note.value = String(((config.music.rootMidi % 12) + 12) % 12);
    octave.value = String(Math.floor(config.music.rootMidi / 12) - 1);
    volume.value = String(config.audio.volume);
    skeleton.checked = config.debug.showSkeleton;
    intensity.value = config.visuals.intensity;
    instrument.value = config.audio.instrument;
    pitchMode.value = config.music.pitchMode;
    reverb.value = String(config.audio.reverb);
    mirror.checked = config.mirror;
  };

  const open = () => {
    sync();
    el.inert = false;
    el.classList.add("open");
  };
  const close = () => {
    el.inert = true;
    el.classList.remove("open");
  };

  el.addEventListener("input", (e) => {
    config.music.scale = scale.value as ScaleId;
    config.music.rootMidi = 12 * (Number(octave.value) + 1) + Number(note.value);
    config.audio.volume = Number(volume.value);
    config.debug.showSkeleton = skeleton.checked;
    config.visuals.intensity = intensity.value as Intensity;
    config.audio.instrument = instrument.value as InstrumentId;
    config.music.pitchMode = pitchMode.value as "scale" | "free";
    config.audio.reverb = Number(reverb.value);
    config.mirror = mirror.checked;
    if (e.target === camera) {
      config.cameraId = camera.value;
      onCamera();
    }
    onChange();
  });
  el.querySelector("[data-close]")!.addEventListener("click", close);
  // Click outside. The gear button's own click bubbles here too, hence the ignore on [data-act=settings].
  document.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    if (el.classList.contains("open") && !t.closest("#settings, [data-act='settings']")) close();
  });

  return { open, close, isOpen: () => el.classList.contains("open") };
}
