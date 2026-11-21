import type { Vec2 } from "../core/vec2";

export interface OneEuroParams {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

/** Low-pass smoothing factor for a given cutoff (Hz) and timestep (s). */
const alpha = (cutoff: number, dt: number): number => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/**
 * One Euro filter (Casiez 2012), scalar. Adaptive low-pass:
 * - minCutoff: lower = less jitter when the signal is slow, but more lag.
 * - beta: higher = cutoff rises with speed, so fast motion lags less (at the cost of some jitter).
 * Params are read through a getter so GUI edits apply live.
 */
export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private t = 0;

  constructor(private readonly params: () => OneEuroParams) {}

  filter(x: number, tSeconds: number): number {
    if (this.x === null) {
      this.x = x;
      this.t = tSeconds;
      return x;
    }
    const dt = tSeconds - this.t;
    if (dt <= 0) return this.x;
    const { minCutoff, beta, dCutoff } = this.params();
    // Smoothed speed; its magnitude drives the adaptive cutoff.
    const dxRaw = (x - this.x) / dt;
    this.dx += alpha(dCutoff, dt) * (dxRaw - this.dx);
    const cutoff = minCutoff + beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (x - this.x);
    this.t = tSeconds;
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
  }
}

const LANDMARKS = 21;

/** 21 landmarks x (x, y) filters for one hand. */
export class HandFilter {
  private fs: OneEuroFilter[][];

  constructor(params: () => OneEuroParams) {
    this.fs = Array.from({ length: LANDMARKS }, () => [new OneEuroFilter(params), new OneEuroFilter(params)]);
  }

  filter(points: readonly Vec2[], tSeconds: number): Vec2[] {
    return points.map((p, i) => ({ x: this.fs[i][0].filter(p.x, tSeconds), y: this.fs[i][1].filter(p.y, tSeconds) }));
  }
}

/**
 * One HandFilter per hand, keyed by MediaPipe handedness label. The label is for the
 * unmirrored image; here it is only a stable key (result order can swap between frames).
 * Labels missing from a result are dropped so a reappearing hand doesn't smooth from a stale position.
 */
export class HandFilters {
  private byLabel = new Map<string, HandFilter>();

  constructor(private readonly params: () => OneEuroParams) {}

  filter(label: string, points: readonly Vec2[], tSeconds: number): Vec2[] {
    let f = this.byLabel.get(label);
    if (!f) this.byLabel.set(label, (f = new HandFilter(this.params)));
    return f.filter(points, tSeconds);
  }

  /** Call once per result with the labels present. */
  keepOnly(labels: ReadonlySet<string>): void {
    for (const k of this.byLabel.keys()) if (!labels.has(k)) this.byLabel.delete(k);
  }
}
