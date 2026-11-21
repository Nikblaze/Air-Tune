import { config } from "../config";
import type { createParticles } from "../core/particles";

/**
 * Additive spark streaks (the reel's look): each spark is a short line from its position back
 * along its velocity, so fast sparks are long and thin. Near-white with a hint of the string's hue.
 */
export function drawParticles(ctx: CanvasRenderingContext2D, p: ReturnType<typeof createParticles>): void {
  if (!p.count) return;
  const { radius, streak } = config.particles;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineWidth = radius * 0.6;
  let lastHue = -1;
  for (let i = 0; i < p.count; i++) {
    // Alpha is a number (no string alloc); strokeStyle only changes when the hue does.
    if (p.hue[i] !== lastHue) ctx.strokeStyle = `hsl(${(lastHue = p.hue[i])}, 100%, 85%)`;
    const life = p.life[i] / p.maxLife[i];
    ctx.globalAlpha = life;
    ctx.beginPath();
    ctx.moveTo(p.x[i], p.y[i]);
    // Tail shrinks with life so a dying spark becomes a dot instead of a hard-edged line.
    ctx.lineTo(p.x[i] - p.vx[i] * streak * life, p.y[i] - p.vy[i] * streak * life);
    ctx.stroke();
  }
  ctx.restore();
}
