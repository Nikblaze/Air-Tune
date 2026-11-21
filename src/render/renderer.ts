import { config } from "../config";
import type { StringEntity } from "../scene/StringEntity";
import type { CoverTransform } from "../tracking/coords";
import type { Hand } from "../tracking/pipeline";
import type { Segment } from "../scene/gestureController";
import { drawHands } from "./drawHands";
import { drawPreview, drawString } from "./drawString";

export interface Frame {
  video: HTMLVideoElement;
  t: CoverTransform;
  W: number;
  H: number;
  strings: readonly StringEntity[];
  alphaOf: (s: StringEntity) => number;
  preview: Segment | null;
  hands: readonly Hand[];
}

/** One frame, back to front: video -> strings -> preview -> hands. */
export function render(ctx: CanvasRenderingContext2D, f: Frame): void {
  ctx.clearRect(0, 0, f.W, f.H);
  // Draw video onto the canvas (cover-crop + mirror) so recordings of the canvas include it.
  ctx.save();
  if (config.mirror) {
    ctx.translate(f.W, 0);
    ctx.scale(-1, 1);
  }
  // In mirrored space the flip is symmetric about the center, so the same offsets apply.
  ctx.drawImage(f.video, f.t.offsetX, f.t.offsetY, f.t.videoW * f.t.scale, f.t.videoH * f.t.scale);
  ctx.restore();
  for (const s of f.strings) drawString(ctx, s, f.alphaOf(s));
  if (f.preview) drawPreview(ctx, f.preview.a, f.preview.b);
  drawHands(ctx, f.hands);
}
