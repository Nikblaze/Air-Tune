import { dist, type Vec2 } from "../core/vec2";

export interface StringEntity {
  id: number;
  a: Vec2;
  b: Vec2;
  createdAt: number; // ms
  fadeStart: number | null; // ms; non-null = fading out, will be removed
}

export const length = (s: StringEntity): number => dist(s.a, s.b);
