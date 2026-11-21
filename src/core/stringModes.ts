// Standing-wave model of a plucked string (SPEC §5.1). Pure: no DOM, no allocation per frame.
//
//   y(x,t) = Σ_n A_n · sin(nπx) · cos(ω_n t) · e^(−γ_n t),   x ∈ [0,1]
//   ω_n = n·ω_1   (harmonics: integer multiples of the fundamental)
//   γ_n = γ·n     (higher modes die faster, so the shape rounds off as it rings)

/** Keep p away from the ends: A_n has p(1−p) in the denominator and would blow up. */
const MIN_P = 0.02;
const MAX_P = 0.98;

/**
 * Fourier sine coefficients of a triangular pluck (peak height h at position p):
 *   A_n = 2h / (n²π² p(1−p)) · sin(nπp)
 * The 1/n² makes high modes weak; sin(nπp) is zero for modes with a node at p
 * (plucking at p=0.5 kills every even mode). Fills out[0..N-1] with modes 1..N.
 */
export function pluckCoefficients(p: number, h: number, N: number, out: Float64Array): void {
  const pc = Math.min(MAX_P, Math.max(MIN_P, p));
  const k = (2 * h) / (Math.PI * Math.PI * pc * (1 - pc));
  for (let n = 1; n <= N; n++) out[n - 1] = (k * Math.sin(n * Math.PI * pc)) / (n * n);
}

/** Sideways displacement (px, signed) at position x ∈ [0,1], tSec seconds after the pluck. */
export function displacement(x: number, tSec: number, coeffs: Float64Array, omega1: number, gamma: number): number {
  let y = 0;
  for (let i = 0; i < coeffs.length; i++) {
    const n = i + 1;
    y += coeffs[i] * Math.sin(n * Math.PI * x) * Math.cos(n * omega1 * tSec) * Math.exp(-gamma * n * tSec);
  }
  return y;
}

/** Relative vibration energy Σ A_n² e^(−2γ_n t): drives the glow. Compare against energy(0). */
export function energy(tSec: number, coeffs: Float64Array, gamma: number): number {
  let e = 0;
  for (let i = 0; i < coeffs.length; i++) {
    const n = i + 1;
    e += coeffs[i] * coeffs[i] * Math.exp(-2 * gamma * n * tSec);
  }
  return e;
}

/**
 * Swing envelope at x: the furthest the string can reach right now, Σ |A_n sin(nπx)| e^(−γ_n t).
 * A real camera sees a vibrating string as a blurred "lens" between ±envelope; drawing it
 * gives that look without rendering many sub-frames. Always ≥ |displacement(x, t)|.
 */
export function envelope(x: number, tSec: number, coeffs: Float64Array, gamma: number): number {
  let e = 0;
  for (let i = 0; i < coeffs.length; i++) {
    const n = i + 1;
    e += Math.abs(coeffs[i] * Math.sin(n * Math.PI * x)) * Math.exp(-gamma * n * tSec);
  }
  return e;
}
