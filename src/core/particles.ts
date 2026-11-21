// Pooled spark particles (SPEC §5.3). Struct-of-arrays, allocated once: zero allocation per frame.
export interface ParticleOpts {
  spread: number; // rad, ± around the swipe normal
  gravity: number; // px/s², +y is down
  lifeMin: number; // s
  lifeMax: number;
}

/** Slowest spark as a fraction of `speed`, so a burst fans out instead of moving as one blob. */
const MIN_SPEED_FRAC = 0.4;

export function createParticles(capacity: number, opts: ParticleOpts) {
  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  const vx = new Float32Array(capacity);
  const vy = new Float32Array(capacity);
  const life = new Float32Array(capacity); // seconds left
  const maxLife = new Float32Array(capacity);
  const hue = new Float32Array(capacity);
  // Live particles are always packed in slots 0..count-1 (dead ones are swapped out).
  let count = 0;

  return {
    x, y, life, maxLife, hue,
    get count() {
      return count;
    },
    /** Burst of `count` sparks along (nx,ny), fanned by ±spread. Pool full → extras are dropped. */
    spawn(px: number, py: number, nx: number, ny: number, h: number, n: number, speed: number, rng: () => number = Math.random) {
      const base = Math.atan2(ny, nx);
      for (let k = 0; k < n && count < capacity; k++) {
        const i = count++;
        const a = base + (rng() * 2 - 1) * opts.spread;
        const s = speed * (MIN_SPEED_FRAC + (1 - MIN_SPEED_FRAC) * rng());
        x[i] = px;
        y[i] = py;
        vx[i] = Math.cos(a) * s;
        vy[i] = Math.sin(a) * s;
        life[i] = maxLife[i] = opts.lifeMin + (opts.lifeMax - opts.lifeMin) * rng();
        hue[i] = h;
      }
      // ponytail: drop-when-full instead of overwriting the oldest; 600 slots >> 40/pluck x 0.9s life.
    },
    update(dt: number) {
      for (let i = 0; i < count; ) {
        if ((life[i] -= dt) <= 0) {
          const j = --count; // swap-remove: move the last live particle into the hole, re-check slot i
          x[i] = x[j], y[i] = y[j], vx[i] = vx[j], vy[i] = vy[j];
          life[i] = life[j], maxLife[i] = maxLife[j], hue[i] = hue[j];
          continue;
        }
        vy[i] += opts.gravity * dt;
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        i++;
      }
    },
  };
}
