// Persisted user prefs (SPEC §10.6). Storage is injected so tests don't need a browser.
import { config, INTENSITIES, type Intensity } from "../config";
import { INSTRUMENTS, type InstrumentId } from "../core/karplus";
import { SCALES, type ScaleId } from "../core/music";

export interface Prefs {
  tutorialDone: boolean;
  scale: ScaleId;
  rootMidi: number;
  volume: number;
  showSkeleton: boolean;
  intensity: Intensity;
  instrument: InstrumentId;
  pitchMode: "scale" | "free";
  reverb: number;
  mirror: boolean;
  cameraId: string;
}

const KEY = "airStrings.prefs.v1";

// Captured at module load, before applyPrefs mutates config.
const DEFAULTS: Prefs = {
  tutorialDone: false,
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
};

// localStorage access itself can throw (blocked storage), so even the default is guarded.
const defaultStorage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Missing, old or wrongly-typed fields fall back to defaults one by one. */
export function loadPrefs(storage: Pick<Storage, "getItem"> | null = defaultStorage()): Prefs {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return { ...DEFAULTS };
    const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    return {
      tutorialDone: typeof raw.tutorialDone === "boolean" ? raw.tutorialDone : DEFAULTS.tutorialDone,
      scale: raw.scale in SCALES ? raw.scale : DEFAULTS.scale,
      rootMidi: Math.round(num(raw.rootMidi, DEFAULTS.rootMidi)),
      volume: Math.min(1, Math.max(0, num(raw.volume, DEFAULTS.volume))),
      showSkeleton: typeof raw.showSkeleton === "boolean" ? raw.showSkeleton : DEFAULTS.showSkeleton,
      intensity: INTENSITIES.includes(raw.intensity) ? raw.intensity : DEFAULTS.intensity,
      instrument: Object.hasOwn(INSTRUMENTS, raw.instrument) ? raw.instrument : DEFAULTS.instrument,
      pitchMode: raw.pitchMode === "scale" || raw.pitchMode === "free" ? raw.pitchMode : DEFAULTS.pitchMode,
      reverb: Math.min(1, Math.max(0, num(raw.reverb, DEFAULTS.reverb))),
      mirror: typeof raw.mirror === "boolean" ? raw.mirror : DEFAULTS.mirror,
      cameraId: typeof raw.cameraId === "string" ? raw.cameraId : DEFAULTS.cameraId,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p: Prefs, storage: Pick<Storage, "setItem"> | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    // private mode / quota: prefs just won't persist
  }
}

export function applyPrefs(p: Prefs): void {
  config.music.scale = p.scale;
  config.music.rootMidi = p.rootMidi;
  config.audio.volume = p.volume;
  config.debug.showSkeleton = p.showSkeleton;
  config.visuals.intensity = p.intensity;
  config.audio.instrument = p.instrument;
  config.music.pitchMode = p.pitchMode;
  config.audio.reverb = p.reverb;
  config.mirror = p.mirror;
  config.cameraId = p.cameraId;
}
