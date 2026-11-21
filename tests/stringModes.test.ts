import { describe, expect, it } from "vitest";
import { displacement, energy, envelope, pluckCoefficients } from "../src/core/stringModes";

const coeffs = (p: number, h: number, N: number) => {
  const c = new Float64Array(N);
  pluckCoefficients(p, h, N, c);
  return c;
};

describe("stringModes", () => {
  it("at t=0 the modes sum to the triangular pluck: peak h at p, fixed ends", () => {
    const c = coeffs(0.3, 20, 200);
    expect(displacement(0.3, 0, c, 10, 2.5)).toBeCloseTo(20, 0);
    // Triangle: linear up to p, so y(p/2) = h/2.
    expect(displacement(0.15, 0, c, 10, 2.5)).toBeCloseTo(10, 0);
    expect(displacement(0, 0, c, 10, 2.5)).toBeCloseTo(0, 9);
    expect(displacement(1, 0, c, 10, 2.5)).toBeCloseTo(0, 9);
  });

  it("plucking at the middle kills even modes", () => {
    const c = coeffs(0.5, 10, 6);
    for (const i of [1, 3, 5]) expect(Math.abs(c[i])).toBeLessThan(1e-9);
    expect(c[0]).toBeGreaterThan(0);
  });

  it("clamps p so the ends do not blow up", () => {
    const c = coeffs(0, 10, 6);
    expect(c.every(Number.isFinite)).toBe(true);
    expect(Array.from(c)).toEqual(Array.from(coeffs(0.02, 10, 6)));
  });

  it("energy decreases monotonically", () => {
    const c = coeffs(0.3, 10, 6);
    let prev = energy(0, c, 2.5);
    for (let t = 0.1; t < 3; t += 0.1) {
      const e = energy(t, c, 2.5);
      expect(e).toBeLessThan(prev);
      prev = e;
    }
  });

  it("higher modes decay faster than the fundamental", () => {
    const only = (n: number) => {
      const c = new Float64Array(6);
      c[n - 1] = 1;
      return c;
    };
    const t = 0.5;
    expect(energy(t, only(4), 2.5)).toBeLessThan(energy(t, only(1), 2.5));
  });
});

describe("envelope", () => {
  it("bounds |displacement| everywhere and is 0 at the fixed ends", () => {
    const c = new Float64Array(6);
    pluckCoefficients(0.3, 20, 6, c);
    for (const t of [0, 0.05, 0.3]) {
      for (let i = 0; i <= 20; i++) {
        const x = i / 20;
        expect(envelope(x, t, c, 2.5)).toBeGreaterThanOrEqual(Math.abs(displacement(x, t, c, 40, 2.5)) - 1e-9);
      }
      expect(envelope(0, t, c, 2.5)).toBeCloseTo(0);
      expect(envelope(1, t, c, 2.5)).toBeCloseTo(0);
    }
  });
});
