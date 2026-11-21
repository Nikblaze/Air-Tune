import { config } from "../config";
import { dist, type Vec2 } from "../core/vec2";

export type GestureState = "IDLE" | "DRAWING";

export interface GestureHand {
  label: string;
  pinching: boolean;
  pinchPoint: Vec2 | null;
}

export interface Segment {
  a: Vec2;
  b: Vec2;
}

export interface GestureOutput {
  state: GestureState;
  preview: Segment | null;
  /** Set for one frame on release; uses the LAST preview endpoints (releasing a pinch moves the fingertips). */
  commit: Segment | null;
}

/** Two-hand pinch drawing state machine (SPEC §3.1). */
export function createGestureController() {
  let state: GestureState = "IDLE";
  let labels: [string, string] | null = null; // the two drawing hands; fixed so endpoints can't swap
  let preview: Segment | null = null;
  let startedAt = 0;

  return {
    update(hands: readonly GestureHand[], now: number): GestureOutput {
      // Keyed by label so duplicate labels count once.
      const byLabel = new Map<string, Vec2>();
      for (const h of hands) if (h.pinching && h.pinchPoint && !byLabel.has(h.label)) byLabel.set(h.label, h.pinchPoint);

      if (state === "IDLE") {
        if (byLabel.size < 2) return { state, preview: null, commit: null };
        const [l0, l1] = [...byLabel.keys()].sort(); // sorted = deterministic pick if 3+ pinch
        labels = [l0, l1];
        state = "DRAWING";
        startedAt = now;
      }

      const a = byLabel.get(labels![0]);
      const b = byLabel.get(labels![1]);
      if (a && b) {
        preview = { a, b };
        return { state, preview, commit: null };
      }
      // Commit only on a deliberate RELEASE: both drawing hands still tracked, one opened its pinch.
      // A hand that VANISHED cancels instead: hands leaving the frame collapse their landmarks
      // (pinch ratio dips -> brief false DRAWING), which used to commit phantom strings.
      // A too-brief pinch is also noise (tracking flicker), not a gesture.
      const tracked = labels!.every((l) => hands.some((h) => h.label === l));
      const longEnough = now - startedAt >= config.minDrawMs;
      const commit =
        tracked && longEnough && preview && dist(preview.a, preview.b) >= config.minStringLength ? preview : null;
      state = "IDLE";
      labels = null;
      preview = null;
      return { state, preview: null, commit };
    },
  };
}
