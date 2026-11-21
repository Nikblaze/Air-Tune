import { config } from "../config";
import { pitchHue } from "../core/music";
import { displacement, energy } from "../core/stringModes";
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

// Reused every frame: x,y pairs of the sampled polyline (no per-frame allocation).
let pts = new Float32Array(0);

function trace(ctx: CanvasRenderingContext2D, n: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[2 * i], pts[2 * i + 1]);
  ctx.stroke();
}

export function drawString(ctx: CanvasRenderingContext2D, s: StringEntity, alpha: number, now: number, noteText: string): void {
  const { width, anchorRadius, color: coreColor } = config.string;
  const v = config.vibration;
  const lvl = config.visuals.levels[config.visuals.intensity];
  const colour = `hsl(${pitchHue(s.midi)}, 100%, 65%)`;
  const t = s.lastPluck ? (now - s.lastPluck.at) / 1000 : 0;
  // Fraction of the pluck energy left (1 right after the pluck, ->0 as it settles).
  const rel = s.lastPluck && s.e0 > 0 ? energy(t, s.coeffs, v.damping) / s.e0 : 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter"; // overlapping light adds up: that is the glow
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (rel < v.restEnergy) {
    // Resting: skip the mode sum and blur entirely so 12 idle strings stay cheap.
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha * 0.7; // faint pitch tint
    line(ctx, s.a, s.b);
    ctx.globalAlpha = alpha;
  } else {
    // Glow ∝ sqrt(energy ratio): amplitude-like, so it fades gently rather than collapsing.
    const g = Math.sqrt(rel);
    const n = v.samples;
    if (pts.length < 2 * n) pts = new Float32Array(2 * n);
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len; // unit normal; displacement is drawn along it
    const ny = dx / len;
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const d = displacement(x, t, s.coeffs, s.omega1, v.damping);
      pts[2 * i] = s.a.x + dx * x + nx * d;
      pts[2 * i + 1] = s.a.y + dy * x + ny * d;
    }
    if (lvl.passes > 1) {
      // Wide soft halo. shadowBlur is the expensive part, so only this pass gets it.
      ctx.strokeStyle = colour;
      ctx.lineWidth = width * 5;
      ctx.globalAlpha = alpha * 0.25 * g;
      ctx.shadowColor = colour;
      ctx.shadowBlur = lvl.blur * g;
      trace(ctx, n);
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = width * 2;
    ctx.globalAlpha = alpha * (0.5 + 0.5 * g);
    trace(ctx, n);
    if (lvl.passes > 1) {
      ctx.strokeStyle = coreColor; // thin white core
      ctx.lineWidth = width * 0.8;
      ctx.globalAlpha = alpha;
      trace(ctx, n);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
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
export function drawPreview(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, noteText: string, ticks: readonly number[], color: string): void {
  const { width, anchorRadius, dash } = config.preview;
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
