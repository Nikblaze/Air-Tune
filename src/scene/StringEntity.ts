import { dist, type Vec2 } from "../core/vec2";

export interface StringEntity {
  id: number;
  a: Vec2;
  b: Vec2;
  createdAt: number; // ms
  fadeStart: number | null; // ms; non-null = fading out, will be removed
  midi: number; // fixed at commit time
  hz: number;
  ticks: number[]; // gauge marks (fractions along a->b) fixed at commit, like the reel
  // at: ms; velocity 0..1; t: hit position 0..1 along a->b; direction: side the finger came from.
  lastPluck: { at: number; velocity: number; t: number; direction: 1 | -1 } | null;
  coeffs: Float64Array; // standing-wave amplitudes A_1..A_N, preallocated (stringModes.ts)
  omega1: number; // visual fundamental, rad/s
  e0: number; // energy(0) of the current excitation; energy/e0 = how much is left
}

export const length = (s: StringEntity): number => dist(s.a, s.b);
