// Swept segment-segment test for plucking (SPEC §3.2). Pure: no DOM.
import type { Vec2 } from "./vec2";

/** 2D cross product (a−o)×(b−o). Sign = which side of line o→a the point b is on. */
export const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

export interface Hit {
  /** Position along the string, 0 at `a` .. 1 at `b`. */
  t: number;
  /** Which side of the string the finger came from: sign of cross(a, b, p0). */
  direction: 1 | -1;
}

/**
 * Fingertip moved p0→p1 this frame; did it cross string a→b?
 * Testing the whole motion segment (not "is the point near the line") means a fast
 * 150px jump can't skip a string between frames.
 */
export function segmentIntersect(p0: Vec2, p1: Vec2, a: Vec2, b: Vec2): Hit | null {
  const d1 = cross(a, b, p0);
  const d2 = cross(a, b, p1);
  // Strict: p0/p1 must be on opposite sides. A finger resting exactly on the line
  // (d = 0) must not retrigger every frame.
  if (!(d1 * d2 < 0)) return null;
  const d3 = cross(p0, p1, a);
  const d4 = cross(p0, p1, b);
  // Non-strict: a string end exactly on the finger path still counts.
  if (d3 * d4 > 0) return null;
  // cross(p0,p1,·) is linear along a→b, so it hits zero at t = d3 / (d3 − d4).
  // d3 === d4 would mean parallel, which d1*d2 < 0 already excluded.
  return { t: d3 / (d3 - d4), direction: d1 > 0 ? 1 : -1 };
}
