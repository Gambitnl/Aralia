import { describe, expect, it } from 'vitest';
import {
  apparentSpeedWithOffset, blendKeepVariance, coverOverQuantile, gaussianize, normalQuantile, twoPhase,
} from '../riverFlowPhase';
import { mulberry32 } from '../riverReach';

/** Standard normal samples from a seeded generator (Box-Muller). */
function gauss(n: number, seed: number): Float64Array {
  const r = mulberry32(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = Math.max(1e-12, r());
    const v = r();
    const m = Math.sqrt(-2 * Math.log(u));
    out[i] = m * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) out[i + 1] = m * Math.sin(2 * Math.PI * v);
  }
  return out;
}

describe('riverFlowPhase: the two-phase flow map', () => {
  it('keeps the weights summing to 1, and resets a copy only where its weight is 0', () => {
    for (let t = 0; t < 3; t += 0.013) {
      const p = twoPhase(t, 1.0);
      expect(p.w0 + p.w1).toBeCloseTo(1, 12);
      // A copy resets when its phase wraps; just before and after, its weight is ~0.
      const a = twoPhase(t, 1.0);
      const b = twoPhase(t + 1e-4, 1.0);
      if (b.c0 !== a.c0) expect(Math.max(a.w0, b.w0)).toBeLessThan(1e-3);
      if (b.c1 !== a.c1) expect(Math.max(a.w1, b.w1)).toBeLessThan(1e-3);
    }
  });

  it('keeps the variance of the blend at every phase (no contrast pulse)', () => {
    const a = gauss(40000, 1);
    const b = gauss(40000, 2);
    for (const w0 of [1, 0.9, 0.7, 0.5, 0.3, 0.1]) {
      let s = 0;
      let s2 = 0;
      for (let i = 0; i < a.length; i += 1) {
        const x = blendKeepVariance(a[i], b[i], w0, 1 - w0);
        s += x;
        s2 += x * x;
      }
      const v = s2 / a.length - (s / a.length) ** 2;
      expect(v).toBeGreaterThan(0.97);
      expect(v).toBeLessThan(1.03);
    }
  });

  it('a plain linear blend loses half its variance at mid-cycle (the pulse the look removes)', () => {
    const a = gauss(40000, 3);
    const b = gauss(40000, 4);
    let s2 = 0;
    for (let i = 0; i < a.length; i += 1) s2 += (0.5 * a[i] + 0.5 * b[i]) ** 2;
    expect(s2 / a.length).toBeCloseTo(0.5, 1);
  });

  it('covers exactly the asked share over the Gaussian quantile, at every phase', () => {
    const a = gauss(60000, 5);
    const b = gauss(60000, 6);
    for (const cover of [0.05, 0.2, 0.5, 0.8]) {
      for (const w0 of [1, 0.75, 0.5, 0.2]) {
        const z = Float64Array.from(a, (x, i) => blendKeepVariance(x, b[i], w0, 1 - w0));
        expect(Math.abs(coverOverQuantile(z, cover) - cover)).toBeLessThan(0.01);
      }
    }
  });

  it('inverts the normal distribution to 1e-3', () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 3);
    expect(normalQuantile(0.9)).toBeCloseTo(1.2816, 2);
    expect(normalQuantile(0.95)).toBeCloseTo(1.6449, 2);
    expect(normalQuantile(0.025)).toBeCloseTo(-1.96, 2);
  });

  it('gaussianizes a channel: keeps the order, mean 0.5, the asked spread', () => {
    const r = mulberry32(9);
    const v = Float32Array.from({ length: 10000 }, () => r() ** 3);
    const before = Array.from(v);
    gaussianize(v, 0.16);
    let s = 0;
    let s2 = 0;
    for (const x of v) { s += x; s2 += x * x; }
    const mean = s / v.length;
    expect(mean).toBeCloseTo(0.5, 2);
    expect(Math.sqrt(s2 / v.length - mean * mean)).toBeCloseTo(0.16, 2);
    for (let i = 1; i < 200; i += 1) {
      if (before[i] > before[i - 1]) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
    }
  });

  it('records why the look has no phase offset: an offset gradient changes the drawn speed', () => {
    // 2.74 m/s, a 1 s cycle, an offset gradient of -0.09 per meter along the
    // flow: the texture reads 20 % slow, as measured in the riffle (round 7).
    expect(apparentSpeedWithOffset(2.74, 1, -0.09) / 2.74).toBeCloseTo(0.8, 1);
    expect(apparentSpeedWithOffset(2.74, 1, 0)).toBe(2.74);
  });
});
