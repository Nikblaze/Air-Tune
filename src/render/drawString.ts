import { config } from "../config";
import { mid, type Vec2 } from "../core/vec2";
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

/** Text beside the string's midpoint, pushed `offset` px along the normal so it doesn't sit on the line. */
function label(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, text: string, offset: number) {
  const m = mid(a, b);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  // Normal (-dy, dx); flip so the label is always above the line rather than upside-down below it.
  let nx = -(b.y - a.y) / len;
  let ny = (b.x - a.x) / len;
  if (ny > 0) (nx = -nx), (ny = -ny);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, m.x + nx * offset, m.y + ny * offset);
}

export function drawString(ctx: CanvasRenderingContext2D, s: StringEntity, alpha: number, now: number, noteText: string): void {
  const { color, width, anchorRadius } = config.string;
  // Flash decays linearly from the pluck; k in 0..1 scaled by how hard it was plucked.
  const age = s.lastPluck ? now - s.lastPluck.at : Infinity;
  const k = age < config.pluckFlashMs ? (1 - age / config.pluckFlashMs) * s.lastPluck!.velocity : 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width * (1 + 2 * k);
  if (k > 0) {
    ctx.shadowColor = config.preview.color;
    ctx.shadowBlur = 24 * k;
  }
  line(ctx, s.a, s.b);
  ctx.shadowBlur = 0;
  for (const p of [s.a, s.b]) {
    anchor(ctx, p, anchorRadius);
    ctx.fill();
  }
  ctx.globalAlpha = alpha * 0.45;
  ctx.font = "14px system-ui, sans-serif";
  label(ctx, s.a, s.b, noteText, 16);
  ctx.restore();
}

/** `ticks` are fractions 0..1 along a→b where the note would change (core/music tickFractions). */
export function drawPreview(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, noteText: string, ticks: readonly number[]): void {
  const { color, width, anchorRadius, dash } = config.preview;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  line(ctx, a, b);
  ctx.setLineDash([]); // hollow anchors must be solid outlines
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  ctx.beginPath();
  for (const f of ticks) {
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f;
    ctx.moveTo(x - nx * 6, y - ny * 6);
    ctx.lineTo(x + nx * 6, y + ny * 6);
  }
  ctx.stroke();
  for (const p of [a, b]) {
    anchor(ctx, p, anchorRadius);
    ctx.stroke();
  }
  ctx.font = "bold 22px system-ui, sans-serif";
  label(ctx, a, b, noteText, 24);
  ctx.restore();
}
