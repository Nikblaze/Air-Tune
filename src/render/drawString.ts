import { config } from "../config";
import { pitchHue } from "../core/music";
import { displacement, energy, envelope } from "../core/stringModes";
import { mid, type Vec2 } from "../core/vec2";
import type { StringEntity } from "../scene/StringEntity";

// Look (from the reel): at rest a thin white string with a faint pitch tint, tick marks and
// hollow anchors. When plucked it lights up in its pitch colour (neon glow) and blurs into a
// "lens" between ±envelope, the way a camera sees a fast-vibrating string.

function circle(ctx: CanvasRenderingContext2D, p: Vec2, r: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
}

function line(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** Short marks across a→b at `fractions` (0..1 from a). */
function ticks(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, fractions: readonly number[], half: number) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  ctx.beginPath();
  for (const f of fractions) {
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f;
    ctx.moveTo(x - nx * half, y - ny * half);
    ctx.lineTo(x + nx * half, y + ny * half);
  }
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

// Reused every frame (no per-frame allocation): x,y pairs for the current shape and the two envelope edges.
let cur = new Float32Array(0);
let lens = new Float32Array(0); // upper edge forward, then lower edge backward = one closed outline

function trace(ctx: CanvasRenderingContext2D, pts: Float32Array, n: number, close = false) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[2 * i], pts[2 * i + 1]);
  if (close) ctx.closePath();
}

export function drawString(ctx: CanvasRenderingContext2D, s: StringEntity, alpha: number, now: number, noteText: string): void {
  const { width, anchorRadius, tickLength, color: white } = config.string;
  const v = config.vibration;
  const lvl = config.visuals.levels[config.visuals.intensity];
  const glow = `hsl(${pitchHue(s.midi)}, 100%, 62%)`;
  const t = s.lastPluck ? (now - s.lastPluck.at) / 1000 : 0;
  // Fraction of the pluck energy left (1 right after the pluck, ->0 as it settles).
  const rel = s.lastPluck && s.e0 > 0 ? energy(t, s.coeffs, v.damping) / s.e0 : 0;
  const vibrating = rel >= v.restEnergy;
  const g = vibrating ? Math.sqrt(rel) : 0; // amplitude-like, fades gently

  ctx.save();
  ctx.globalCompositeOperation = "lighter"; // overlapping light adds up: that is the glow
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (!vibrating) {
    // Resting: no mode sum, no blur, so 12 idle strings stay cheap.
    ctx.strokeStyle = glow; // faint pitch tint around a white core
    ctx.lineWidth = width * 3;
    ctx.globalAlpha = alpha * 0.22;
    line(ctx, s.a, s.b);
    ctx.strokeStyle = white;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha * 0.9;
    line(ctx, s.a, s.b);
  } else {
    const n = v.samples;
    if (cur.length < 2 * n) (cur = new Float32Array(2 * n)), (lens = new Float32Array(4 * n));
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len; // unit normal; displacement is drawn along it
    const ny = dx / len;
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const bx = s.a.x + dx * x;
      const by = s.a.y + dy * x;
      const d = displacement(x, t, s.coeffs, s.omega1, v.damping);
      const e = envelope(x, t, s.coeffs, v.damping);
      cur[2 * i] = bx + nx * d;
      cur[2 * i + 1] = by + ny * d;
      lens[2 * i] = bx + nx * e; // upper edge, a→b
      lens[2 * i + 1] = by + ny * e;
      const j = 2 * n - 1 - i; // lower edge, stored b→a so the outline closes
      lens[2 * j] = bx - nx * e;
      lens[2 * j + 1] = by - ny * e;
    }

    // 1. Motion-blur lens: faint fill + glowing outline in the pitch colour.
    ctx.fillStyle = glow;
    ctx.globalAlpha = alpha * 0.1 * g;
    trace(ctx, lens, 2 * n, true);
    ctx.fill();
    if (lvl.passes > 1) {
      // shadowBlur is the expensive part: only vibrating strings, only these two passes.
      ctx.shadowColor = glow;
      ctx.shadowBlur = lvl.blur * g;
    }
    ctx.strokeStyle = glow;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha * 0.6 * g;
    ctx.stroke(); // the lens outline traced above

    // 2. Current shape: neon colour, then a white-hot core.
    ctx.lineWidth = width * 3;
    ctx.globalAlpha = alpha * (0.35 + 0.65 * g);
    trace(ctx, cur, n);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = white;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.stroke();
  }

  // Gauge ticks on the rest line (the reel keeps them after drawing).
  ctx.strokeStyle = white;
  ctx.lineWidth = 1;
  ctx.globalAlpha = alpha * 0.55;
  ticks(ctx, s.a, s.b, s.ticks, tickLength);

  // Hollow anchors; they pick up the glow colour while the string rings.
  ctx.strokeStyle = vibrating ? glow : white;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = alpha;
  for (const p of [s.a, s.b]) {
    circle(ctx, p, anchorRadius);
    ctx.stroke();
  }

  ctx.fillStyle = white;
  ctx.globalAlpha = alpha * 0.4;
  ctx.font = "12px system-ui, sans-serif";
  label(ctx, s.a, s.b, noteText, 14);
  ctx.restore();
}

/** White dashed gauge while drawing; `ticks` are fractions 0..1 along a→b where the note would change. */
export function drawPreview(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, noteText: string, tickFracs: readonly number[], noteColor: string): void {
  const { width, anchorRadius, dash, color } = config.preview;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  line(ctx, a, b);
  ctx.setLineDash([]); // ticks and hollow anchors are solid
  ctx.lineWidth = 1;
  ticks(ctx, a, b, tickFracs, 6);
  ctx.lineWidth = 1.5;
  for (const p of [a, b]) {
    circle(ctx, p, anchorRadius);
    ctx.stroke();
  }
  ctx.fillStyle = noteColor; // the live note shows its pitch colour
  ctx.font = "bold 22px system-ui, sans-serif";
  label(ctx, a, b, noteText, 24);
  ctx.restore();
}
