import { config } from "../config";
import { noteName } from "../core/music";
import type { Vec2 } from "../core/vec2";
import type { StringEntity } from "../scene/StringEntity";
import type { CoverTransform } from "../tracking/coords";
import type { Hand } from "../tracking/pipeline";
import type { createParticles } from "../core/particles";
import { drawHands } from "./drawHands";
import { drawParticles } from "./drawParticles";
import { drawPreview, drawString } from "./drawString";

export interface Frame {
  video: HTMLVideoElement;
  t: CoverTransform;
  W: number;
  H: number;
  strings: readonly StringEntity[];
  alphaOf: (s: StringEntity) => number;
  now: number; // ms
  preview: { a: Vec2; b: Vec2; label: string; ticks: number[]; color: string } | null;
  particles: ReturnType<typeof createParticles>;
  hands: readonly Hand[];
}

/** One frame, back to front: video -> strings (lighter) -> preview -> particles (lighter) -> hands. */
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
  for (const s of f.strings) drawString(ctx, s, f.alphaOf(s), f.now, noteName(s.midi));
  if (f.preview) drawPreview(ctx, f.preview.a, f.preview.b, f.preview.label, f.preview.ticks, f.preview.color);
  drawParticles(ctx, f.particles);
  drawHands(ctx, f.hands);
}
