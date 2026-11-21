// Right-side settings drawer (SPEC §10.6, v1 subset). An overlay on PLAYING, not an app state.
import { config, INTENSITIES, type Intensity } from "../config";
import { SCALES, type ScaleId } from "../core/music";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const OCTAVES = [2, 3, 4];

const options = (items: [string | number, string][]) => items.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");

/** Edits go straight into `config` (read live by music/audio/render); onChange is for persistence + HUD. */
export function createSettingsDrawer({ onChange }: { onChange: () => void }) {
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
    <label>Volume <input type="range" data-k="volume" min="0" max="1" step="0.01" /></label>
    <label>Effect intensity <select data-k="intensity">${options(INTENSITIES.map((i) => [i, i[0].toUpperCase() + i.slice(1)]))}</select></label>
    <label class="check"><input type="checkbox" data-k="skeleton" /> Hand skeleton</label>
    <p class="caption">Existing strings keep their notes; only new strings use the new scale and root.</p>`;
  document.body.append(el);
  const f = <T extends HTMLElement>(k: string) => el.querySelector<T>(`[data-k="${k}"]`)!;
  const scale = f<HTMLSelectElement>("scale"), note = f<HTMLSelectElement>("note"), octave = f<HTMLSelectElement>("octave");
  const volume = f<HTMLInputElement>("volume"), skeleton = f<HTMLInputElement>("skeleton");
  const intensity = f<HTMLSelectElement>("intensity");

  const sync = () => {
    scale.value = config.music.scale;
    note.value = String(((config.music.rootMidi % 12) + 12) % 12);
    octave.value = String(Math.floor(config.music.rootMidi / 12) - 1);
    volume.value = String(config.audio.volume);
    skeleton.checked = config.debug.showSkeleton;
    intensity.value = config.visuals.intensity;
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

  el.addEventListener("input", () => {
    config.music.scale = scale.value as ScaleId;
    config.music.rootMidi = 12 * (Number(octave.value) + 1) + Number(note.value);
    config.audio.volume = Number(volume.value);
    config.debug.showSkeleton = skeleton.checked;
    config.visuals.intensity = intensity.value as Intensity;
    onChange();
  });
  el.querySelector("[data-close]")!.addEventListener("click", close);
  window.addEventListener("keydown", (e) => e.key === "Escape" && close());
  // Click outside. The gear button's own click bubbles here too, hence the ignore on [data-act=settings].
  document.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    if (el.classList.contains("open") && !t.closest("#settings, [data-act='settings']")) close();
  });

  return { open, close };
}
