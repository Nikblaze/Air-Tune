// [YOU WRITE] Pinch detection (SPEC §3.1). Pure: no DOM, no MediaPipe.
// Replace each `throw` with your implementation, then run `npm test`.
import type { Vec2 } from "./vec2";

/** MediaPipe hand landmark indices used by the app. */
export const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_TIP: 12,
} as const;

/** Hysteresis band: pinch turns ON below `on`, OFF above `off` (on < off). */
export interface PinchThresholds {
  on: number;
  off: number;
}

/**
 * Scale-invariant pinch measure: dist(thumbTip, indexTip) / dist(wrist, middleMCP).
 * Small = pinching. The divisor ("hand scale") makes the threshold work whether
 * the hand is close to or far from the camera.
 *
 * @param hand 21 landmarks in canvas pixels (NOT normalized: x and y are
 *   normalized against different axes, so distances there are distorted).
 * @returns the ratio, or `Infinity` if hand scale is 0 (degenerate hand never pinches).
 */
export function pinchRatio(hand: readonly Vec2[]): number {
  void hand;
  throw new Error("TODO: implement pinchRatio");
}

/**
 * Where the pinch "grabs": midpoint of thumb tip and index tip.
 * @param hand 21 landmarks in canvas pixels.
 */
export function pinchPoint(hand: readonly Vec2[]): Vec2 {
  void hand;
  throw new Error("TODO: implement pinchPoint");
}

/**
 * Hysteresis step. Strict comparisons:
 * - not pinching → pinching only when `ratio < th.on`
 * - pinching → released only when `ratio > th.off`
 * - anywhere in between keeps the previous state (this is what kills flicker).
 *
 * @param wasPinching state from the previous frame
 * @param ratio current `pinchRatio`
 * @returns new pinching state
 */
export function updatePinch(wasPinching: boolean, ratio: number, th: PinchThresholds): boolean {
  void wasPinching;
  void ratio;
  void th;
  throw new Error("TODO: implement updatePinch");
}
