import { describe, expect, it } from "vitest";
import { isOpenPalm, palmHold, palmHoldInitial } from "../src/core/palm";
import type { Vec2 } from "../src/core/vec2";

// Wrist at origin, hand pointing up (-y). Fingers at x = -30,-10,10,30; thumb/index tips far apart.
function hand({ curled = [] as number[], pinch = false, scale = 1 } = {}): Vec2[] {
  const h: Vec2[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  h[9] = { x: 0, y: -100 * scale }; // middle MCP: hand scale = 100
  [8, 12, 16, 20].forEach((tip, i) => {
    const x = (-30 + i * 20) * scale;
    h[tip - 2] = { x, y: -120 * scale }; // PIP
    h[tip] = { x, y: (curled.includes(i) ? -60 : -200) * scale };
  });
  h[4] = pinch ? { x: h[8].x + 5 * scale, y: h[8].y } : { x: -120 * scale, y: -60 * scale };
  return h;
}

describe("isOpenPalm", () => {
  it("open hand", () => expect(isOpenPalm(hand(), 1.15, 0.45)).toBe(true));
  it("any curled finger breaks it", () => {
    for (let i = 0; i < 4; i++) expect(isOpenPalm(hand({ curled: [i] }), 1.15, 0.45)).toBe(false);
  });
  it("thumb pinching the index breaks it", () => expect(isOpenPalm(hand({ pinch: true }), 1.15, 0.45)).toBe(false));
  it("scale invariant", () => expect(isOpenPalm(hand({ scale: 0.2 }), 1.15, 0.45)).toBe(true));
  it("rejects malformed input", () => expect(isOpenPalm([], 1.15, 0.45)).toBe(false));
});

describe("palmHold", () => {
  const step = (s: ReturnType<typeof palmHoldInitial>, now: number, openCount = 2, still = true) =>
    palmHold(s, { openCount, still, now }, 1000);

  it("progresses then fires once at holdMs", () => {
    let r = step(palmHoldInitial(), 0);
    expect(r.progress).toBe(0);
    r = step(r.state, 500);
    expect(r.progress).toBeCloseTo(0.5);
    expect(r.fire).toBe(false);
    r = step(r.state, 1000);
    expect(r.fire).toBe(true);
    expect(step(r.state, 1100).fire).toBe(false); // latched
    expect(step(r.state, 5000).fire).toBe(false);
  });
  it("moving resets the timer", () => {
    let r = step(palmHoldInitial(), 0);
    r = step(r.state, 600);
    r = step(r.state, 700, 2, false);
    expect(r.progress).toBe(0);
    r = step(r.state, 800); // restarts here
    r = step(r.state, 1700);
    expect(r.fire).toBe(false);
    expect(step(r.state, 1800).fire).toBe(true);
  });
  it("re-arms only after the hands stop being open", () => {
    let r = step(palmHoldInitial(), 0);
    r = step(r.state, 1000); // fires
    r = step(r.state, 1100, 2, false); // still open (moving): stays latched
    r = step(r.state, 1200);
    expect(r.fire).toBe(false);
    r = step(r.state, 1300, 1); // one hand closed: re-armed
    r = step(r.state, 1400);
    r = step(r.state, 2400);
    expect(r.fire).toBe(true);
  });
  it("one open hand never progresses", () => expect(step(palmHoldInitial(), 0, 1).progress).toBe(0));
});
