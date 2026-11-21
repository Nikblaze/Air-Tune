import { config } from "../config";
import type { Vec2 } from "../core/vec2";
import type { StringEntity } from "../scene/StringEntity";

function anchor(ctx: CanvasRenderingContext2D, p: Vec2, r: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
}

function line(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function drawString(ctx: CanvasRenderingContext2D, s: StringEntity, alpha: number): void {
  const { color, width, anchorRadius } = config.string;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  line(ctx, s.a, s.b);
  for (const p of [s.a, s.b]) {
    anchor(ctx, p, anchorRadius);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPreview(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2): void {
  const { color, width, anchorRadius, dash } = config.preview;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  line(ctx, a, b);
  ctx.setLineDash([]); // hollow anchors must be solid outlines
  for (const p of [a, b]) {
    anchor(ctx, p, anchorRadius);
    ctx.stroke();
  }
  ctx.restore();
}
