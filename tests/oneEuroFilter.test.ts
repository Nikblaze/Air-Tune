import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "../src/tracking/oneEuroFilter";

const P = { minCutoff: 1, beta: 0.007, dCutoff: 1 };
const dt = 1 / 30;
// Deterministic pseudo-noise in [-1, 1].
const noise = (i: number) => Math.sin(i * 78.233 + Math.cos(i * 3.1));
const variance = (a: number[]) => {
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length;
};

describe("OneEuroFilter", () => {
  it("first sample passes through", () => {
    expect(new OneEuroFilter(() => P).filter(42, 0)).toBe(42);
  });
  it("constant input stays constant", () => {
    const f = new OneEuroFilter(() => P);
    for (let i = 0; i < 50; i++) expect(f.filter(5, i * dt)).toBeCloseTo(5, 10);
  });
  it("returns previous value when dt <= 0", () => {
    const f = new OneEuroFilter(() => P);
    f.filter(1, 1);
    expect(f.filter(100, 1)).toBe(1);
  });
  it("noisy constant: stays in range and has lower variance", () => {
    const f = new OneEuroFilter(() => P);
    const input: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 200; i++) {
      const x = 100 + 5 * noise(i);
      input.push(x);
      out.push(f.filter(x, i * dt));
    }
    expect(Math.min(...out)).toBeGreaterThanOrEqual(Math.min(...input));
    expect(Math.max(...out)).toBeLessThanOrEqual(Math.max(...input));
    expect(variance(out)).toBeLessThan(variance(input));
  });
  it("larger beta lags less on a fast ramp", () => {
    const lag = (beta: number) => {
      const f = new OneEuroFilter(() => ({ ...P, beta }));
      let y = 0;
      let x = 0;
      for (let i = 0; i < 60; i++) {
        x = i * 20; // 600 px/s
        y = f.filter(x, i * dt);
      }
      return x - y;
    };
    expect(lag(0.05)).toBeLessThan(lag(0));
  });
});
