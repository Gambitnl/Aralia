/**
 * @file riverFlowPhase.ts — the math of the two-phase flow map, on the CPU.
 *
 * The river's look (`riverWaterMaterial.ts`) moves its detail textures along
 * the flow with two copies per texture, each pushed along the flow for one
 * cycle and then reset. This file holds the same math as plain functions, so
 * tests can prove the three properties the look depends on:
 *
 *   1. The two weights always sum to 1, and each copy resets only where its
 *      own weight is 0 (so the reset never shows).
 *   2. The blend keeps the variance: (a w0 + b w1) / sqrt(w0^2 + w1^2) has
 *      the variance of a and b at every phase, so the surface never loses
 *      contrast halfway through a cycle (the "pulse" of a plain blend).
 *   3. A Gaussian texture thresholded at the Gaussian quantile of (1 - cover)
 *      covers exactly `cover` of the surface at every phase, so the foam's
 *      share does not breathe.
 *
 * It also holds `gaussianize`, the rank transform that makes a texture
 * channel Gaussian, and `normalQuantile`, the inverse normal distribution
 * function the shader repeats in GLSL.
 */

/** The two phases at time t (s) for a cycle of `cycleS` seconds and a phase offset. */
export function twoPhase(t: number, cycleS: number, offset = 0): { p0: number; p1: number; w0: number; w1: number; c0: number; c1: number } {
  const u = t / cycleS + offset;
  const p0 = u - Math.floor(u);
  const v = u + 0.5;
  const p1 = v - Math.floor(v);
  const w0 = 1 - Math.abs(2 * p0 - 1);
  return { p0, p1, w0, w1: 1 - w0, c0: Math.floor(u), c1: Math.floor(v) };
}

/** The variance-keeping blend of two zero-mean samples. */
export function blendKeepVariance(a: number, b: number, w0: number, w1: number): number {
  return (a * w0 + b * w1) / Math.sqrt(w0 * w0 + w1 * w1);
}

/**
 * The displacement of copy i along the flow at phase p, m: vel (m/s) times
 * (p - 0.5) times the cycle. Centered on the phase's middle, where the copy's
 * weight is largest, so the copy is least stretched when it counts most.
 */
export function phaseDisplacement(vel: number, p: number, cycleS: number): number {
  return vel * (p - 0.5) * cycleS;
}

/**
 * The apparent speed of a feature drawn with a phase offset field off(x): the
 * texture coordinate carries u T off(x), so a feature moves at
 * u / (1 - T u . grad off). The look uses no offset (see the material) because
 * of this: at 2.7 m/s an offset gradient of 0.09 per meter along the flow
 * reads 20 % slow.
 */
export function apparentSpeedWithOffset(u: number, cycleS: number, offsetGradAlongFlow: number): number {
  return u / (1 - cycleS * u * offsetGradAlongFlow);
}

/**
 * Inverse of the standard normal distribution function (Abramowitz and
 * Stegun 26.2.23; error under 4.5e-4). The shader has the same formula.
 */
export function normalQuantile(p: number): number {
  const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  const lo = q < 0.5 ? q : 1 - q;
  const t = Math.sqrt(-2 * Math.log(lo));
  const z = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
  return q < 0.5 ? -z : z;
}

/**
 * Rank-transform `v` to a Gaussian of mean 0.5 and spread `sigma`, in place.
 *
 * WHY: the two-phase blend keeps a texture's VARIANCE, not its distribution.
 * A channel with a uniform or skewed histogram changes shape through a cycle,
 * and a fixed threshold then covers a different share of the surface at each
 * phase: the foam would breathe. A sum of two independent Gaussians, weighted
 * w0 and w1 and divided by sqrt(w0^2 + w1^2), is the same Gaussian, so a
 * threshold at the Gaussian quantile of (1 - cover) covers exactly `cover` of
 * the surface at every phase.
 */
export function gaussianize(v: Float32Array, sigma: number): void {
  const n = v.length;
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => v[a] - v[b] || a - b);
  const out = new Float32Array(n);
  for (let r = 0; r < n; r += 1) {
    out[order[r]] = Math.min(1, Math.max(0, 0.5 + sigma * normalQuantile((r + 0.5) / n)));
  }
  v.set(out);
}

/** The share of a zero-mean Gaussian blend (in units of its sigma) over the quantile of (1 - cover). */
export function coverOverQuantile(samplesZ: ArrayLike<number>, cover: number): number {
  const zq = normalQuantile(1 - cover);
  let k = 0;
  for (let i = 0; i < samplesZ.length; i += 1) if (samplesZ[i] > zq) k += 1;
  return k / samplesZ.length;
}
