import { config } from "../config";
import { LM } from "../core/pinch";
import { dist, type Vec2 } from "../core/vec2";
import type { FingerMove } from "../scene/StringManager";
import type { Hand } from "./pipeline";

const TIPS = [LM.INDEX_TIP, LM.MIDDLE_TIP];

/**
 * Turns per-detection fingertip positions into p0→p1 moves for the swept pluck test.
 * Call once per NEW detection (not per render frame) so p0→p1 spans exactly one detection.
 */
export function createFingerTracker() {
  let prev = new Map<string, { p: Vec2; t: number }>();
  return {
    update(hands: readonly Hand[], now: number): FingerMove[] {
      const next = new Map<string, { p: Vec2; t: number }>();
      const moves: FingerMove[] = [];
      for (const h of hands) {
        // Held hands don't move, pinching hands are drawing: neither may pluck. Because they are
        // left out of `next`, the finger starts fresh (no segment) when the hand comes back.
        if (h.held || h.pinching) continue;
        for (const tip of TIPS) {
          const key = `${h.label}:${tip}`;
          const p = h.points[tip];
          next.set(key, { p, t: now });
          const old = prev.get(key);
          // No old = hand absent last detection. A huge jump = tracker glitch / hand re-acquired
          // elsewhere; a segment through every string would be a phantom strum (SPEC §9).
          if (!old || dist(old.p, p) > config.maxFingerJumpPx) continue;
          const dt = (now - old.t) / 1000;
          if (dt > 0) moves.push({ key, p0: old.p, p1: p, dt });
        }
      }
      prev = next;
      return moves;
    },
  };
}
