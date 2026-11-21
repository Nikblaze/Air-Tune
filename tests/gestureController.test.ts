import { describe, expect, it } from "vitest";
import { config } from "../src/config";
import { createGestureController, type GestureHand } from "../src/scene/gestureController";

const H = (label: string, x: number, pinching = true): GestureHand => ({ label, pinching, pinchPoint: { x, y: 0 } });

describe("gestureController", () => {
  it("needs both hands pinching to start", () => {
    const g = createGestureController();
    expect(g.update([H("L", 0)], 0).state).toBe("IDLE");
    expect(g.update([H("L", 0), H("R", 500, false)], 1).state).toBe("IDLE");
  });

  it("same label twice counts once", () => {
    const g = createGestureController();
    expect(g.update([H("L", 0), H("L", 500)], 0).state).toBe("IDLE");
  });

  it("starts drawing and the preview follows the hands", () => {
    const g = createGestureController();
    expect(g.update([H("L", 0), H("R", 300)], 0).preview).toEqual({ a: { x: 0, y: 0 }, b: { x: 300, y: 0 } });
    const o = g.update([H("L", 10), H("R", 400)], 1);
    expect(o.state).toBe("DRAWING");
    expect(o.preview!.b.x).toBe(400);
  });

  it("keeps endpoints by label even if the hand order flips", () => {
    const g = createGestureController();
    g.update([H("L", 0), H("R", 300)], 0);
    const o = g.update([H("R", 310), H("L", 5)], 1);
    expect(o.preview).toEqual({ a: { x: 5, y: 0 }, b: { x: 310, y: 0 } });
  });

  it("commits the LAST preview on release, not the post-release positions", () => {
    const g = createGestureController();
    g.update([H("L", 0), H("R", 300)], 0);
    const o = g.update([H("L", 0), H("R", 999, false)], config.minDrawMs);
    expect(o.state).toBe("IDLE");
    expect(o.commit).toEqual({ a: { x: 0, y: 0 }, b: { x: 300, y: 0 } });
    expect(o.preview).toBeNull();
    expect(g.update([], 2).commit).toBeNull(); // commit fires once
  });

  it("discards a too-short string", () => {
    const g = createGestureController();
    g.update([H("L", 0), H("R", config.minStringLength - 1)], 0);
    const o = g.update([], 1);
    expect(o.state).toBe("IDLE");
    expect(o.commit).toBeNull();
  });

  it("a drawing hand that vanishes cancels (no phantom string when hands leave the frame)", () => {
    const g = createGestureController();
    g.update([H("L", 0), H("R", 300)], 0);
    const o = g.update([H("L", 0)], config.minDrawMs + 100);
    expect(o.state).toBe("IDLE");
    expect(o.commit).toBeNull();
  });

  it("a pinch released before minDrawMs is noise, not a string", () => {
    const g = createGestureController();
    g.update([H("L", 0), H("R", 300)], 0);
    const o = g.update([H("L", 0), H("R", 300, false)], config.minDrawMs - 1);
    expect(o.state).toBe("IDLE");
    expect(o.commit).toBeNull();
  });
});
