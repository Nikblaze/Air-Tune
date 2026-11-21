import { describe, expect, it } from "vitest";
import { LM, pinchPoint, pinchRatio, updatePinch } from "../src/core/pinch";
import type { Vec2 } from "../src/core/vec2";

/** 21 landmarks at the origin, with selected ones overridden. */
function hand(overrides: Partial<Record<number, Vec2>>): Vec2[] {
  return Array.from({ length: 21 }, (_, i) => overrides[i] ?? { x: 0, y: 0 });
}

// Hand scale 100 px (wrist→middle MCP), thumb–index gap 30 px → ratio 0.3.
const base = hand({
  [LM.WRIST]: { x: 0, y: 0 },
  [LM.MIDDLE_MCP]: { x: 0, y: 100 },
  [LM.THUMB_TIP]: { x: 10, y: 50 },
  [LM.INDEX_TIP]: { x: 40, y: 50 },
});

const th = { on: 0.3, off: 0.45 };

describe("pinchRatio", () => {
  it("divides thumb–index distance by hand scale", () => {
    expect(pinchRatio(base)).toBeCloseTo(0.3);
  });

  it("is scale invariant (same hand 3x closer to the camera)", () => {
    const big = base.map((p) => ({ x: p.x * 3 + 500, y: p.y * 3 - 20 }));
    expect(pinchRatio(big)).toBeCloseTo(0.3);
  });

  it("uses Euclidean distance, not just x", () => {
    const h = hand({
      [LM.MIDDLE_MCP]: { x: 0, y: 100 },
      [LM.THUMB_TIP]: { x: 0, y: 0 },
      [LM.INDEX_TIP]: { x: 30, y: 40 }, // 3-4-5 triangle → 50 px
    });
    expect(pinchRatio(h)).toBeCloseTo(0.5);
  });

  it("returns Infinity for a degenerate hand (scale 0)", () => {
    expect(pinchRatio(hand({ [LM.INDEX_TIP]: { x: 5, y: 0 } }))).toBe(Infinity);
  });
});

describe("pinchPoint", () => {
  it("is the midpoint of thumb tip and index tip", () => {
    expect(pinchPoint(base)).toEqual({ x: 25, y: 50 });
  });
});

describe("updatePinch (hysteresis)", () => {
  it("turns on below the ON threshold", () => {
    expect(updatePinch(false, 0.29, th)).toBe(true);
  });

  it("stays off inside the dead band", () => {
    expect(updatePinch(false, 0.35, th)).toBe(false);
  });

  it("stays on inside the dead band", () => {
    expect(updatePinch(true, 0.35, th)).toBe(true);
  });

  it("turns off above the OFF threshold", () => {
    expect(updatePinch(true, 0.46, th)).toBe(false);
  });

  it("uses strict comparisons at the exact thresholds", () => {
    expect(updatePinch(false, 0.3, th)).toBe(false);
    expect(updatePinch(true, 0.45, th)).toBe(true);
  });

  it("never pinches a degenerate hand", () => {
    expect(updatePinch(false, Infinity, th)).toBe(false);
    expect(updatePinch(true, Infinity, th)).toBe(false);
  });

  it("does not flicker on a noisy ratio hovering near one threshold", () => {
    const noisy = [0.28, 0.33, 0.29, 0.36, 0.31, 0.4, 0.3];
    let s = false;
    const states = noisy.map((r) => (s = updatePinch(s, r, th)));
    expect(states).toEqual([true, true, true, true, true, true, true]);
  });
});
