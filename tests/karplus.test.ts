import { describe, expect, it } from "vitest";
import { createVoice, delayFor, excite, INSTRUMENTS, tick } from "../src/core/karplus";

const SR = 48000;
const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function render(hz: number, opts: Partial<typeof INSTRUMENTS.harp> & { seconds?: number; seed?: number } = {}): Float32Array {
  const v = createVoice(SR, Math.ceil(SR / 30) + 8);
  excite(v, { ...INSTRUMENTS.harp, ...opts, hz, velocity: 1 }, mulberry(opts.seed ?? 1));
  const out = new Float32Array(Math.round(SR * (opts.seconds ?? 1)));
  for (let i = 0; i < out.length && v.active; i++) out[i] = tick(v);
  return out;
}
const rms = (x: Float32Array, a: number, b: number) => Math.sqrt(x.slice(a, b).reduce((s, v) => s + v * v, 0) / (b - a));

/** Autocorrelation peak near the expected lag, parabolic-interpolated to sub-sample precision. */
function pitch(x: Float32Array, expectHz: number): number {
  const seg = x.slice(Math.round(SR * 0.1), Math.round(SR * 0.4));
  const ac = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < seg.length; i++) s += seg[i] * seg[i + lag];
    return s;
  };
  const lo = Math.floor(SR / expectHz / 1.2), hi = Math.ceil((SR / expectHz) * 1.2);
  let best = lo;
  for (let l = lo; l <= hi; l++) if (ac(l) > ac(best)) best = l;
  const [a, b, c] = [ac(best - 1), ac(best), ac(best + 1)];
  return SR / (best + (0.5 * (a - c)) / (a - 2 * b + c));
}

/** Magnitude of the DFT bin at `hz` over the first `len` samples. */
function bin(x: Float32Array, hz: number, len: number): number {
  let re = 0, im = 0;
  for (let i = 0; i < len; i++) {
    re += x[i] * Math.cos((2 * Math.PI * hz * i) / SR);
    im += x[i] * Math.sin((2 * Math.PI * hz * i) / SR);
  }
  return Math.hypot(re, im);
}

describe("delayFor", () => {
  it("220 Hz at 48 kHz: L = 217.68, N + d = L, d in [0.1, 1.1)", () => {
    const r = delayFor(220, SR);
    expect(r.length).toBeCloseTo(217.6818, 3);
    expect(r.n + r.d).toBeCloseTo(r.length, 9);
    expect(r.n).toBe(217);
    expect(r.c).toBeCloseTo((1 - r.d) / (1 + r.d), 9);
  });
  it("keeps d in range and |C| < 1 over the whole pitch range", () => {
    for (let hz = 30; hz < 4000; hz += 7.3) {
      const { d, c } = delayFor(hz, SR);
      expect(d).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(d).toBeLessThan(1.1);
      expect(Math.abs(c)).toBeLessThan(0.9);
    }
  });
});

describe("karplus voice", () => {
  it.each([110, 220, 440, 880])("is in tune at %d Hz (within 1%%)", (hz) => {
    const f = pitch(render(hz), hz);
    expect(Math.abs(f / hz - 1)).toBeLessThan(0.01);
  });
  it("decays", () => {
    const x = render(220);
    expect(rms(x, SR - 4800, SR)).toBeLessThan(rms(x, 0, 4800));
  });
  it("higher decay sustains longer; 1.0 never fades to silence", () => {
    const tail = (decay: number) => rms(render(220, { decay, seconds: 3 }), SR * 2.5, SR * 3);
    expect(tail(0.999)).toBeGreaterThan(tail(0.99));
    expect(tail(1.0)).toBeGreaterThan(0.01);
  });
  it("goes inactive once silent", () => {
    const v = createVoice(SR, 2000);
    excite(v, { ...INSTRUMENTS.harp, hz: 440, velocity: 1 }, mulberry(3));
    for (let i = 0; i < SR * 10 && v.active; i++) tick(v);
    expect(v.active).toBe(false);
  });
  it("never produces NaN or runaway values, for every instrument", () => {
    for (const inst of Object.values(INSTRUMENTS))
      for (const hz of [35, 220, 2000]) {
        const x = render(hz, { ...inst, seconds: 0.5 });
        expect(x.every((s) => Number.isFinite(s) && Math.abs(s) < 4)).toBe(true);
      }
  });
  it("pluck at the middle has a weaker 2nd harmonic than near the end", () => {
    const hz = 220;
    const ratio = (position: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 5; seed++) {
        const x = render(hz, { position, seed, seconds: 0.1 });
        sum += bin(x, 2 * hz, 2400) / bin(x, hz, 2400);
      }
      return sum / 5;
    };
    expect(ratio(0.5)).toBeLessThan(ratio(0.1));
  });
});
