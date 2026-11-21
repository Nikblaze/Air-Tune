import { describe, expect, it } from "vitest";
import { coverTransform, toCanvas } from "../src/tracking/coords";

describe("coverTransform", () => {
  it("16:9 into 4:3 crops left/right", () => {
    const t = coverTransform(1280, 720, 800, 600);
    expect(t.scale).toBeCloseTo(600 / 720);
    expect(t.offsetY).toBeCloseTo(0);
    expect(t.offsetX).toBeLessThan(0);
    expect(t.offsetX).toBeCloseTo((800 - 1280 * t.scale) / 2);
  });
  it("16:9 into 21:9 crops top/bottom", () => {
    const t = coverTransform(1280, 720, 2100, 900);
    expect(t.scale).toBeCloseTo(2100 / 1280);
    expect(t.offsetX).toBeCloseTo(0);
    expect(t.offsetY).toBeLessThan(0);
  });
});

describe("toCanvas", () => {
  const t = coverTransform(1280, 720, 800, 600);
  it("center maps to canvas center", () => {
    const p = toCanvas(0.5, 0.5, t, 800, false);
    expect(p.x).toBeCloseTo(400);
    expect(p.y).toBeCloseTo(300);
  });
  it("mirror flips x only", () => {
    const a = toCanvas(0.25, 0.3, t, 800, false);
    const b = toCanvas(0.25, 0.3, t, 800, true);
    expect(b.x).toBeCloseTo(800 - a.x);
    expect(b.y).toBeCloseTo(a.y);
  });
  it("corners land on the crop edges", () => {
    const tl = toCanvas(0, 0, t, 800, false);
    const br = toCanvas(1, 1, t, 800, false);
    expect(tl.x).toBeCloseTo(t.offsetX);
    expect(tl.y).toBeCloseTo(0);
    expect(br.x).toBeCloseTo(800 - t.offsetX);
    expect(br.y).toBeCloseTo(600);
  });
});
