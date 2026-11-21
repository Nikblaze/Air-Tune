import { config } from "../config";
import type { createParticles } from "../core/particles";

/** Additive sparks. Alpha fades with remaining life; colour is the string's hue lightened toward white. */
export function drawParticles(ctx: CanvasRenderingContext2D, p: ReturnType<typeof createParticles>): void {
  if (!p.count) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const r = config.particles.radius;
  let lastHue = -1;
  for (let i = 0; i < p.count; i++) {
    // Alpha is a number (no string alloc); fillStyle only changes when the hue does.
    if (p.hue[i] !== lastHue) ctx.fillStyle = `hsl(${(lastHue = p.hue[i])}, 100%, 75%)`;
    ctx.globalAlpha = p.life[i] / p.maxLife[i];
    ctx.fillRect(p.x[i] - r, p.y[i] - r, 2 * r, 2 * r);
  }
  ctx.restore();
}
