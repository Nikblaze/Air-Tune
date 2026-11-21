// Karplus-Strong plucked string (SPEC §6). Pure DSP: no Web Audio, no allocation after createVoice.
//
// Loop (one sample per tick):
//   s[n] = decay · ½ (x[n−N] + x[n−N−1])      averaging = lowpass: high harmonics die first
//   x[n] = allpass(s[n])                      fractional delay d for exact tuning
// Total loop delay = N + ½ (averager) + d (allpass) samples = sampleRate / hz.

export interface Instrument {
  decay: number; // loop gain per round trip; 1.0 = never dies (the averager still kills highs)
  brightness: number; // 0..1: how much of the burst's highs survive at full velocity
  position: number; // 0..1 pluck position along the string
  buzz?: number; // 0..1 jawari amount (sitar)
}

export const INSTRUMENTS = {
  harp: { decay: 0.996, brightness: 0.6, position: 0.5 },
  guitar: { decay: 0.994, brightness: 0.85, position: 0.2 }, // plucked near the bridge: brighter
  sitar: { decay: 0.998, brightness: 1.0, position: 0.1, buzz: 0.3 },
} satisfies Record<string, Instrument>;
export type InstrumentId = keyof typeof INSTRUMENTS;

export interface Voice {
  sampleRate: number;
  buf: Float32Array; // capacity; only the first n samples are the loop
  n: number; // integer delay-line length N
  i: number; // read/write index
  prev: number; // x[n−N−1]: the averager's second tap
  c: number; // allpass coefficient
  apX: number; // allpass state: previous input / output
  apY: number;
  decay: number;
  buzz: number;
  peak: number; // slow-release peak follower
  active: boolean;
}

/** Below this loop peak (≈ −80 dB) the voice is inaudible: the processor can skip it. */
const SILENT = 1e-4;
/** Peak follower release per sample: time constant ≈ 5000 samples, longer than a 30 Hz period. */
const PEAK_RELEASE = 0.9998;

export function createVoice(sampleRate: number, capacity: number): Voice {
  return { sampleRate, buf: new Float32Array(capacity), n: 1, i: 0, prev: 0, c: 0, apX: 0, apY: 0, decay: 0, buzz: 0, peak: 0, active: false };
}

/**
 * Loop length for a pitch. The averager adds ½ sample, so the rest must supply L = sr/hz − ½.
 * We split L = N + d with d in [0.1, 1.1) (borrowing a sample from N): the allpass
 * C = (1−d)/(1+d) then stays in (−0.05, 0.82], away from C → −1 (d → 2) where it goes unstable
 * and from C → 1 (d → 0) where the allpass is nearly a pure pole/zero cancellation and
 * its delay estimate is least accurate.
 */
export function delayFor(hz: number, sampleRate: number): { length: number; n: number; d: number; c: number } {
  const length = sampleRate / hz - 0.5;
  const n = Math.floor(length - 0.1);
  const d = length - n;
  return { length, n, d, c: (1 - d) / (1 + d) };
}

export interface Pluck extends Instrument {
  hz: number;
  velocity: number; // 0..1
}

/** Reset the voice and fill its loop with the pluck's noise burst. `rng` returns [0,1). */
export function excite(v: Voice, p: Pluck, rng: () => number): void {
  const { n, c } = delayFor(p.hz, v.sampleRate);
  if (n < 2 || n > v.buf.length) return; // outside the range this voice can hold
  const x = v.buf;
  // Burst amplitude ∝ velocity; soft plucks are also darker (one-pole lowpass, k = 1 means no filtering).
  const k = Math.min(1, Math.max(0.05, p.velocity * p.brightness));
  let lp = 0;
  for (let j = 0; j < n; j++) {
    lp += k * ((rng() * 2 - 1) * p.velocity - lp);
    x[j] = lp;
  }
  // Pluck-position comb x[j] − x[j−m], m = pN: a harmonic with a node at the pluck point is
  // cancelled (p = ½ removes the even ones). Same physics as stringModes.ts. Descending so
  // x[j−m] is still the original value.
  const m = Math.min(n - 1, Math.max(1, Math.round(p.position * n)));
  for (let j = n - 1; j >= m; j--) x[j] -= x[j - m];
  // A DC offset would never decay (the averager passes DC at gain 1) and would eat headroom.
  let mean = 0;
  for (let j = 0; j < n; j++) mean += x[j];
  mean /= n;
  let peak = 0;
  for (let j = 0; j < n; j++) peak = Math.max(peak, Math.abs((x[j] -= mean)));
  v.n = n;
  v.i = 0;
  v.prev = 0;
  v.c = c;
  v.apX = v.apY = 0;
  v.decay = p.decay;
  v.buzz = p.buzz ?? 0;
  v.peak = peak;
  v.active = true;
}

/**
 * Jawari approximation: the sitar's curved bridge lets the string graze it on one side only,
 * so positive excursions get soft-clipped (adds odd+even harmonics, a buzzing edge) while
 * negative ones pass. Slope is 1 at x = 0 so quiet tails stay clean.
 */
const buzzClip = (x: number, buzz: number) => (x > 0 ? Math.tanh((1 + buzz) * x) / (1 + buzz) : x);

/** One output sample. Call only while `v.active`. */
export function tick(v: Voice): number {
  const cur = v.buf[v.i];
  const s = v.decay * 0.5 * (cur + v.prev);
  v.prev = cur;
  // First-order allpass y[n] = C·s[n] + s[n−1] − C·y[n−1]: unit gain, low-frequency delay (1−C)/(1+C) = d.
  const y = v.c * s + v.apX - v.c * v.apY;
  v.apX = s;
  v.apY = y;
  const out = v.buzz > 0 ? buzzClip(y, v.buzz) : y;
  v.buf[v.i] = out;
  if (++v.i === v.n) v.i = 0;
  v.peak = Math.max(Math.abs(out), v.peak * PEAK_RELEASE);
  if (v.peak < SILENT) v.active = false;
  return out;
}
