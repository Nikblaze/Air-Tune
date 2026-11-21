import { dist, type Vec2 } from "../core/vec2";

export interface StringEntity {
  id: number;
  a: Vec2;
  b: Vec2;
  createdAt: number; // ms
  fadeStart: number | null; // ms; non-null = fading out, will be removed
  midi: number; // fixed at commit time
  hz: number;
  lastPluck: { at: number; velocity: number } | null; // ms, 0..1
}

export const length = (s: StringEntity): number => dist(s.a, s.b);
