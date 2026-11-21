import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { config } from "../config";
import { pinchPoint, pinchRatio, updatePinch } from "../core/pinch";
import type { Vec2 } from "../core/vec2";
import { toCanvas, type CoverTransform } from "./coords";
import { HandFilters } from "./oneEuroFilter";

export interface Hand {
  label: string;
  points: Vec2[]; // canvas px, smoothed
  pinching: boolean;
  ratio: number; // NaN until pinch.ts is implemented
  pinchPoint: Vec2 | null;
}

// Read config on every call so debug-panel edits apply live.
const filters = new HandFilters(() => config.oneEuro);
const wasPinching = new Map<string, boolean>();

/** normalized landmarks -> canvas px -> One Euro -> pinch state. */
export function processResult(
  result: HandLandmarkerResult,
  t: CoverTransform,
  canvasW: number,
  tSeconds: number,
): Hand[] {
  const seen = new Set<string>();
  const hands: Hand[] = result.landmarks.map((lms, i) => {
    // MediaPipe occasionally labels both hands the same ("Right","Right"); without a
    // unique key both would share one filter and their points would be averaged together.
    let label = result.handedness[i][0].categoryName;
    if (seen.has(label)) label = `${label}#${i}`;
    seen.add(label);
    const raw = lms.map((p) => toCanvas(p.x, p.y, t, canvasW, config.mirror));
    const points = filters.filter(label, raw, tSeconds);
    let ratio = NaN;
    let pinching = false;
    let point: Vec2 | null = null;
    try {
      // TODO(remove): guard until core/pinch.ts is implemented
      ratio = pinchRatio(points);
      pinching = updatePinch(wasPinching.get(label) ?? false, ratio, config.pinch);
      point = pinchPoint(points);
    } catch {
      ratio = NaN;
      pinching = false;
      point = null;
    }
    wasPinching.set(label, pinching);
    return { label, points, pinching, ratio, pinchPoint: Number.isFinite(ratio) ? point : null };
  });
  const present = new Set(hands.map((h) => h.label));
  filters.keepOnly(present);
  for (const k of wasPinching.keys()) if (!present.has(k)) wasPinching.delete(k);
  return hands;
}
