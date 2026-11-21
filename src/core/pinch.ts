// Pinch detection (SPEC §3.1). Pure: no DOM, no MediaPipe.
// Learning exercise: the stub + failing-test version lives in git history
// ("exercise: Phase 1 pinch.ts contract").
import { dist, mid, type Vec2 } from "./vec2";

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
  const scale = dist(hand[LM.WRIST], hand[LM.MIDDLE_MCP]);
  if (scale === 0) return Infinity;
  return dist(hand[LM.THUMB_TIP], hand[LM.INDEX_TIP]) / scale;
}

/**
 * Where the pinch "grabs": midpoint of thumb tip and index tip.
 * @param hand 21 landmarks in canvas pixels.
 */
export function pinchPoint(hand: readonly Vec2[]): Vec2 {
  return mid(hand[LM.THUMB_TIP], hand[LM.INDEX_TIP]);
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
  // Infinity > off, so a degenerate hand always releases / never engages.
  return wasPinching ? !(ratio > th.off) : ratio < th.on;
}
