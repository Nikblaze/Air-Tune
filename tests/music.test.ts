import { describe, expect, it } from "vitest";
import {
  SCALES, lengthToMidi, lengthToSemitones, midiToHz, noteName, pitchHue, snapToScale, tickFractions,
} from "../src/core/music";

const pent = SCALES.majorPentatonic.steps;
const opts = { refLength: 300, rootMidi: 57, scale: pent, minSemis: -12, maxSemis: 18 };

describe("length mapping", () => {
  it("half length is +12 semitones, double is -12", () => {
    expect(lengthToSemitones(150, 300)).toBeCloseTo(12);
    expect(lengthToSemitones(600, 300)).toBeCloseTo(-12);
  });
  it("A3 at ref, A4 at half, A2 at double", () => {
    expect(lengthToMidi(300, opts)).toBe(57);
    expect(lengthToMidi(150, opts)).toBe(69);
    expect(lengthToMidi(600, opts)).toBe(45);
  });
  it("clamps to the range", () => {
    expect(lengthToMidi(1, opts)).toBe(57 + 16); // clamped to +18, snap overshoots to 19, walked back to 16 (in scale, in range)
    expect(lengthToMidi(1e6, opts)).toBe(57 - 12);
  });
  it("free mode keeps fractions", () => {
    const m = lengthToMidi(300 * 2 ** (-0.5 / 12), { ...opts, scale: null });
    expect(m).toBeCloseTo(57.5);
  });
});

describe("snapToScale", () => {
  it("snaps to the nearest note", () => {
    expect(snapToScale(2.9, pent)).toBe(2);
    expect(snapToScale(3.1, pent)).toBe(4);
    expect(snapToScale(11.5, pent)).toBe(12);
  });
  it("ties go lower", () => {
    expect(snapToScale(1, pent)).toBe(0);
    expect(snapToScale(5.5, pent)).toBe(4); // 4 and 7 are 1.5 and 1.5 away
  });
  it("handles negatives", () => {
    expect(snapToScale(-1, pent)).toBe(0);
    expect(snapToScale(-2, pent)).toBe(-3);
    expect(snapToScale(-12, pent)).toBe(-12);
  });
});

describe("pitch helpers", () => {
  it("midiToHz", () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(57)).toBeCloseTo(220);
  });
  it("noteName", () => {
    expect(noteName(57)).toBe("A3");
    expect(noteName(60)).toBe("C4");
    expect(noteName(61)).toBe("C#4");
    expect(noteName(48)).toBe("C3");
  });
  it("pitchHue is the same across octaves", () => {
    expect(pitchHue(57)).toBe(pitchHue(69));
    expect(pitchHue(60)).toBe(0);
    expect(pitchHue(61)).toBe(30);
  });
});

describe("tickFractions", () => {
  it("is ascending and strictly inside (0,1)", () => {
    const f = tickFractions(400, opts);
    expect(f.length).toBeGreaterThan(0);
    for (let i = 0; i < f.length; i++) {
      expect(f[i]).toBeGreaterThan(0);
      expect(f[i]).toBeLessThan(1);
      if (i) expect(f[i]).toBeGreaterThan(f[i - 1]);
    }
  });
  it("free mode has a tick per semitone, including the root position", () => {
    const f = tickFractions(400, { ...opts, scale: null });
    expect(f).toHaveLength(23); // semis -4..18
    expect(f.some((x) => Math.abs(x - 0.75) < 1e-9)).toBe(true);
  });
  it("scale mode has fewer ticks than free", () => {
    expect(tickFractions(400, opts).length).toBeLessThan(23);
  });
});
