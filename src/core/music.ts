// Length → pitch mapping (SPEC §4). Pure: no Web Audio.
export type ScaleId = "majorPentatonic" | "minorPentatonic" | "major" | "minor" | "yaman" | "hirajoshi";

export const SCALES: Record<ScaleId, { name: string; steps: number[] }> = {
  majorPentatonic: { name: "Major pentatonic / Bhupali", steps: [0, 2, 4, 7, 9] },
  minorPentatonic: { name: "Minor pentatonic", steps: [0, 3, 5, 7, 10] },
  major: { name: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: "Natural minor", steps: [0, 2, 3, 5, 7, 8, 10] },
  yaman: { name: "Raag Yaman", steps: [0, 2, 4, 6, 7, 9, 11] },
  hirajoshi: { name: "Hirajoshi", steps: [0, 2, 3, 7, 8] },
};

export interface MusicOpts {
  refLength: number; // px; a string this long plays the root
  rootMidi: number;
  scale: number[] | null; // semitone steps; null = free (continuous) mode
  minSemis: number;
  maxSemis: number;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** f ∝ 1/L, so semitones = 12·log2(f/f0) = −12·log2(L/Lref). Half length = +12 (12th fret). */
export const lengthToSemitones = (length: number, refLength: number): number => -12 * Math.log2(length / refLength);

/** Nearest in-scale semitone offset (any octave). Ties go to the lower note. */
export function snapToScale(semis: number, steps: readonly number[]): number {
  const oct = Math.floor(semis / 12);
  let best = Infinity;
  // Neighbouring octaves cover the wrap-around (e.g. 11.5 is closer to the next root at 12).
  // Ascending order + strict `<` makes the first (lower) candidate win ties.
  for (let k = oct - 1; k <= oct + 1; k++) {
    for (const s of steps) {
      const c = s + 12 * k;
      if (Math.abs(c - semis) < Math.abs(best - semis)) best = c;
    }
  }
  return best;
}

export function lengthToMidi(length: number, o: MusicOpts): number {
  const raw = lengthToSemitones(length, o.refLength);
  const semis = Math.min(o.maxSemis, Math.max(o.minSemis, raw));
  if (!o.scale) return o.rootMidi + semis;
  // Snapping a clamped value can step just past the range edge (e.g. 18 → 19 in
  // pentatonic); walk inward to the nearest scale note that is inside the range.
  const steps = o.scale;
  const inScale = (n: number) => steps.includes(mod12(n));
  let s = snapToScale(semis, steps);
  while (s > o.maxSemis) do s--; while (!inScale(s));
  while (s < o.minSemis) do s++; while (!inScale(s));
  return o.rootMidi + s;
}

export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function noteName(m: number): string {
  const r = Math.round(m);
  return `${NAMES[mod12(r)]}${Math.floor(r / 12) - 1}`;
}

/** Same pitch class → same hue in every octave (SPEC §4). */
export const pitchHue = (m: number): number => mod12(Math.round(m)) * 30;

/**
 * Gauge for the drawing preview: for each playable note, the string length that
 * would play it is L = ref·2^(−semis/12). Returned as L/length, i.e. the position
 * along the string (from endpoint a) where the note changes. Ascending, all in (0,1).
 */
export function tickFractions(length: number, o: MusicOpts): number[] {
  const out: number[] = [];
  for (let s = o.minSemis; s <= o.maxSemis; s++) {
    if (o.scale && !o.scale.includes(mod12(s))) continue;
    const f = (o.refLength * 2 ** (-s / 12)) / length;
    if (f > 0 && f < 1) out.push(f);
  }
  return out.sort((x, y) => x - y);
}
