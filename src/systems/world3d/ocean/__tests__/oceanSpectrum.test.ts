/**
 * @file oceanSpectrum.test.ts — the physics, checked against published
 * spectral identities.
 *
 * "It looks wavy" is not evidence. Every assertion here is a number the
 * literature fixes independently of this implementation:
 *
 *   - the JONSWAP peak sits where the peak-frequency formula puts it;
 *   - the integrated variance reproduces the fetch-limited growth law;
 *   - the spreading function integrates to exactly one;
 *   - the change of variables from frequency to wavevector conserves energy;
 *   - the TMA factor matches Kitaigorodskii's three branches;
 *   - the realized height field carries the variance the spectrum promised.
 */
import { describe, it, expect } from 'vitest';
import {
  jonswapAlpha,
  jonswapPeakOmega,
  jonswapS,
  tmaFactor,
  dispersionOmega,
  dispersionDerivative,
  spreadingPower,
  cosine2sSpread,
  cosine2sNormalization,
  logGamma,
  directionalSpectrum,
  buildCascadeSpectrum,
  significantWaveHeightM,
  empiricalFetchLimitedHsM,
  makeOceanRng,
  gaussianPair,
} from '../oceanSpectrum';
import { GRAVITY_MS2, DEFAULT_CASCADES, type CascadeParams } from '../oceanConfig';
import { realizeCascade } from '../oceanFieldReference';
import { ifft2d } from '../oceanFftReference';

const U = 11.5;
const F = 60_000;

/**
 * Cascades are looked up BY NAME, never by index.
 *
 * The sea gained a third cascade at the short end, which pushed every index
 * along by one. Tests that said `WIND_SEA` meaning "the wind sea"
 * silently started testing a 13 m ripple patch instead — one of them went NaN
 * because its 20 m band no longer existed, and the rest simply stopped
 * measuring what they claimed to.
 */
function cascade(name: string): CascadeParams {
  const c = DEFAULT_CASCADES.find((p) => p.name === name);
  if (!c) throw new Error(`no cascade named ${name}`);
  return c;
}
const RIPPLE = cascade('ripple');
const WIND_SEA = cascade('wind-sea');
const SWELL = cascade('swell');

describe('logGamma', () => {
  it('reproduces the factorials', () => {
    expect(Math.exp(logGamma(1))).toBeCloseTo(1, 9);
    expect(Math.exp(logGamma(5))).toBeCloseTo(24, 6);
    expect(Math.exp(logGamma(9))).toBeCloseTo(40320, 2);
  });
  it('reproduces Gamma(1/2) = sqrt(pi)', () => {
    expect(Math.exp(logGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 9);
  });
});

describe('JONSWAP', () => {
  it('places the spectral maximum at the predicted peak frequency', () => {
    // The strongest single check on the whole spectrum shape. Scan the
    // spectrum and confirm its argmax is the analytic peakOmega.
    const omegaP = jonswapPeakOmega(U, F);
    let bestOmega = 0;
    let best = -1;
    for (let w = 0.05; w < 6; w += 0.0005) {
      const s = jonswapS(w, U, F);
      if (s > best) {
        best = s;
        bestOmega = w;
      }
    }
    expect(bestOmega).toBeCloseTo(omegaP, 2);
  });

  it('gives a larger alpha for a shorter fetch — a younger, steeper sea', () => {
    expect(jonswapAlpha(U, 10_000)).toBeGreaterThan(jonswapAlpha(U, 500_000));
  });

  it('has a peak that moves down in frequency as the fetch grows', () => {
    expect(jonswapPeakOmega(U, 600_000)).toBeLessThan(jonswapPeakOmega(U, 60_000));
  });

  it('is sharper at the peak than Pierson-Moskowitz, by exactly gamma', () => {
    // At omega == omegaP the enhancement exponent r is 1, so the JONSWAP
    // value is gamma times the PM value.
    const omegaP = jonswapPeakOmega(U, F);
    const alpha = jonswapAlpha(U, F);
    const g2 = GRAVITY_MS2 * GRAVITY_MS2;
    const pm = ((alpha * g2) / Math.pow(omegaP, 5)) * Math.exp(-1.25);
    expect(jonswapS(omegaP, U, F) / pm).toBeCloseTo(3.3, 6);
  });

  it('integrates to the JONSWAP variance identity m0 = 0.305 alpha g^2 / wp^4', () => {
    // THE tight shape test. For gamma = 3.3 the JONSWAP spectrum has a fixed
    // ratio between its total variance and alpha g^2 / peakOmega^4. That
    // constant, ~0.305, depends only on the SHAPE of the spectrum, so it
    // catches a wrong gamma, a wrong sigma branch, a wrong exponent on
    // omega, or a wrong 1.25 in the Pierson-Moskowitz tail.
    for (const [u, f] of [[8, 40_000], [11.5, 60_000], [13, 600_000], [18, 200_000]]) {
      let m0 = 0;
      const dw = 0.0002;
      for (let w = dw; w < 20; w += dw) m0 += jonswapS(w, u, f) * dw;
      const omegaP = jonswapPeakOmega(u, f);
      const predicted = 0.305 * jonswapAlpha(u, f) * GRAVITY_MS2 * GRAVITY_MS2
        / Math.pow(omegaP, 4);
      expect(Math.abs(m0 - predicted) / predicted).toBeLessThan(0.02);
    }
  });

  it('lands on the fetch-limited growth law within the spread of the two fits', () => {
    // Hs from the integrated spectrum, against the INDEPENDENT total-energy
    // growth law eps = 1.6e-7 * dimensionlessFetch.
    //
    // These two fits do not agree exactly, and that is a fact about the 1973
    // JONSWAP paper rather than a fact about this code. Substituting the
    // alpha and peak-frequency fits into the variance identity above gives
    // eps = 9.9e-8 * fetch^1.10, so the alpha route runs high, and runs
    // higher the longer the fetch. Measured here: +19% at a 60 km fetch,
    // +32% at 600 km.
    //
    // The brief fixes alpha and peakOmega, so the alpha route is the one
    // implemented. The bound records the real disagreement instead of hiding
    // it, and it is still far tighter than the factor-of-2 and factor-of-4
    // errors that a wrong amplitude constant produces.
    for (const [u, f] of [[8, 40_000], [11.5, 60_000], [13, 600_000], [18, 200_000]]) {
      let m0 = 0;
      const dw = 0.0002;
      for (let w = dw; w < 20; w += dw) m0 += jonswapS(w, u, f) * dw;
      const ratio = significantWaveHeightM(m0) / empiricalFetchLimitedHsM(u, f);
      expect(ratio).toBeGreaterThan(1.0);
      expect(ratio).toBeLessThan(1.4);
    }
  });
});

describe('TMA depth correction', () => {
  it('matches the three branches of the Kitaigorodskii function', () => {
    const h = 10;
    const wOf = (oh: number) => oh / Math.sqrt(h / GRAVITY_MS2);
    expect(tmaFactor(wOf(0.5), h)).toBeCloseTo(0.125, 12);
    expect(tmaFactor(wOf(1), h)).toBeCloseTo(0.5, 12);
    expect(tmaFactor(wOf(1.5), h)).toBeCloseTo(0.875, 12);
    expect(tmaFactor(wOf(2), h)).toBeCloseTo(1, 12);
    expect(tmaFactor(wOf(5), h)).toBeCloseTo(1, 12);
  });

  it('is a no-op across the whole band in deep water', () => {
    // 1000 m depth. Every frequency the sea carries must pass untouched, or
    // the open ocean is paying for a coastal correction it does not need.
    for (let w = 0.2; w < 6; w += 0.05) {
      expect(tmaFactor(w, 1000)).toBeCloseTo(1, 12);
    }
  });

  it('strips low-frequency energy in shallow water', () => {
    expect(tmaFactor(0.3, 5)).toBeLessThan(0.5);
    expect(tmaFactor(0.3, 1000)).toBeCloseTo(1, 12);
  });
});

describe('dispersion', () => {
  it('collapses to the deep-water relation when kh is large', () => {
    const k = 0.5;
    expect(dispersionOmega(k, 1000)).toBeCloseTo(Math.sqrt(GRAVITY_MS2 * k), 9);
  });

  it('collapses to the shallow-water relation when kh is small', () => {
    const k = 0.001;
    const h = 5;
    expect(dispersionOmega(k, h)).toBeCloseTo(k * Math.sqrt(GRAVITY_MS2 * h), 6);
  });

  it('has a derivative that matches a numeric one', () => {
    for (const [k, h] of [[0.05, 1000], [0.5, 1000], [0.01, 20], [2, 50]]) {
      const eps = k * 1e-6;
      const numeric = (dispersionOmega(k + eps, h) - dispersionOmega(k - eps, h)) / (2 * eps);
      expect(dispersionDerivative(k, h)).toBeCloseTo(numeric, 6);
    }
  });

  it('makes long waves outrun short ones', () => {
    const cLong = dispersionOmega(0.01, 1000) / 0.01;
    const cShort = dispersionOmega(1.0, 1000) / 1.0;
    expect(cLong).toBeGreaterThan(cShort);
  });
});

describe('directional spreading', () => {
  it('integrates to exactly one over a full turn, for every s', () => {
    for (const s of [0.1, 0.5, 1, 3, 10, 25, 40]) {
      let total = 0;
      const steps = 20000;
      const dt = (2 * Math.PI) / steps;
      for (let i = 0; i < steps; i += 1) {
        total += cosine2sSpread(-Math.PI + i * dt, 0.4, s) * dt;
      }
      expect(total).toBeCloseTo(1, 4);
    }
  });

  it('peaks exactly on the mean direction and vanishes opposite it', () => {
    const mean = 0.9;
    const s = 6;
    expect(cosine2sSpread(mean, mean, s)).toBeCloseTo(cosine2sNormalization(s), 9);
    expect(cosine2sSpread(mean + Math.PI, mean, s)).toBeCloseTo(0, 12);
  });

  it('VARIES the spreading power with frequency — the anti-corduroy check', () => {
    // A constant s would make every wavelength arrive on the same fan of
    // headings, and the crests would line up into ridges. The Mitsuyasu form
    // must be sharply peaked AT the peak and broad on both sides of it.
    const omegaP = jonswapPeakOmega(U, F);
    const atPeak = spreadingPower(omegaP, omegaP, U);
    const below = spreadingPower(omegaP * 0.5, omegaP, U);
    const above = spreadingPower(omegaP * 2.5, omegaP, U);
    expect(atPeak).toBeGreaterThan(below);
    expect(atPeak).toBeGreaterThan(above);
    // And the variation must be large, not cosmetic.
    expect(atPeak / Math.max(below, above)).toBeGreaterThan(4);
  });

  it('stays inside the clamp that keeps cos^(2s) representable', () => {
    for (let w = 0.05; w < 20; w += 0.01) {
      const s = spreadingPower(w, 1.2, U);
      expect(s).toBeGreaterThanOrEqual(0.1);
      expect(s).toBeLessThanOrEqual(40);
    }
  });
});

describe('the change of variables from frequency to wavevector', () => {
  it('conserves energy: the 2-D k integral equals the 1-D omega integral', () => {
    // THE test for the Jacobian. Psi(k) = S(w) D(theta) (dw/dk) / k. If the
    // /k or the dw/dk is missing, the sea still looks wavy and carries the
    // wrong energy by a factor that varies with wavelength.
    const p: CascadeParams = {
      name: 't',
      patchM: 1,
      windSpeedMs: U,
      fetchM: F,
      windDirRad: 0.3,
      depthM: 1000,
      cutoffLowM: 0,
      cutoffHighM: Infinity,
      choppiness: 1,
      // Not exercised here: this test integrates the spectrum analytically and
      // never renders. The values are the neutral ones.
      dispLod: { startM: 0, endM: 1, floor: 1 },
      normalLod: { startM: 0, endM: 1, floor: 1 },
      drivesFoam: false,
    };

    // Polar integral of Psi over the whole plane: int Psi k dk dtheta.
    let twoD = 0;
    const nK = 900;
    const nT = 240;
    const dTheta = (2 * Math.PI) / nT;
    // Log-spaced k so the peak and the tail are both resolved.
    const kMin = 1e-4;
    const kMax = 30;
    const ratio = Math.pow(kMax / kMin, 1 / nK);
    for (let i = 0; i < nK; i += 1) {
      const k0 = kMin * Math.pow(ratio, i);
      const k1 = k0 * ratio;
      const k = Math.sqrt(k0 * k1);
      const dk = k1 - k0;
      for (let j = 0; j < nT; j += 1) {
        const th = -Math.PI + (j + 0.5) * dTheta;
        twoD += directionalSpectrum(k * Math.cos(th), k * Math.sin(th), p)
          * k * dk * dTheta;
      }
    }

    let oneD = 0;
    const dw = 0.0005;
    for (let w = dw; w < 20; w += dw) oneD += jonswapS(w, U, F) * dw;

    expect(Math.abs(twoD - oneD) / oneD).toBeLessThan(0.02);
  });
});

describe('the seeded draw', () => {
  it('is reproducible for the same seed', () => {
    const a = makeOceanRng(4242);
    const b = makeOceanRng(4242);
    for (let i = 0; i < 200; i += 1) expect(a()).toBe(b());
  });

  it('differs for a different seed', () => {
    const a = makeOceanRng(1);
    const b = makeOceanRng(2);
    let same = 0;
    for (let i = 0; i < 200; i += 1) if (a() === b()) same += 1;
    expect(same).toBe(0);
  });

  it('produces unit-variance normals', () => {
    const rng = makeOceanRng(99);
    let sum = 0;
    let sq = 0;
    const n = 200_000;
    for (let i = 0; i < n / 2; i += 1) {
      const [x, y] = gaussianPair(rng(), rng());
      sum += x + y;
      sq += x * x + y * y;
    }
    expect(sum / n).toBeCloseTo(0, 2);
    expect(sq / n).toBeCloseTo(1, 2);
  });
});

describe('the realized field carries the variance the spectrum promised', () => {
  // THE end-to-end gate. It ties the spectrum, the amplitude constant, the
  // packing and the transform together with one number. A wrong factor
  // anywhere in that chain fails here, and every wrong factor still renders
  // a plausible-looking sea.
  it('matches m0 within sampling error', () => {
    const p: CascadeParams = { ...WIND_SEA, patchM: 167 };
    const n = 64;
    const spec = buildCascadeSpectrum(p, n, 20260814);
    const f = realizeCascade(spec, 0);

    let mean = 0;
    for (let i = 0; i < f.height.length; i += 1) mean += f.height[i];
    mean /= f.height.length;
    let variance = 0;
    for (let i = 0; i < f.height.length; i += 1) {
      const d = f.height[i] - mean;
      variance += d * d;
    }
    variance /= f.height.length;

    // The realized variance is a chi-square sample of m0, so it scatters.
    // 25% is loose enough for one seed and far tighter than any wrong
    // constant (the classic errors are factors of 2 and 4).
    expect(variance).toBeGreaterThan(spec.m0 * 0.75);
    expect(variance).toBeLessThan(spec.m0 * 1.25);
  });

  it('produces a height field that is real, finite and zero-mean', () => {
    const spec = buildCascadeSpectrum(WIND_SEA, 32, 7);
    const f = realizeCascade(spec, 3.5);
    let mean = 0;
    for (let i = 0; i < f.height.length; i += 1) {
      expect(Number.isFinite(f.height[i])).toBe(true);
      mean += f.height[i];
    }
    // k = 0 carries no energy, so the mean is exactly the DC term: zero.
    expect(Math.abs(mean / f.height.length)).toBeLessThan(1e-9);
  });

  it('builds a Hermitian evolved spectrum, so the packed pairs cannot leak', () => {
    // THE test that catches the conjugate-half bug.
    //
    // The pipeline puts TWO real fields in one complex transform and reads
    // them back as the real and imaginary parts. That only works if each
    // field's spectrum is Hermitian. Draw the conjugate half from fresh
    // randoms instead of from the mirrored cell and the surface still looks
    // like waves, still has the right variance, and still has zero mean —
    // while every field quietly leaks into its partner.
    //
    // So check Hermitian symmetry directly on the evolved spectrum.
    const n = 32;
    const spec = buildCascadeSpectrum(WIND_SEA, n, 4711);
    const t = 6.5;

    const hhat = (x: number, z: number): [number, number] => {
      const b = (z * n + x) * 4;
      const w = spec.wave[b];
      const c = Math.cos(w * t);
      const s = Math.sin(w * t);
      const [ar, ai, cr, ci] = [spec.h0[b], spec.h0[b + 1], spec.h0[b + 2], spec.h0[b + 3]];
      return [ar * c - ai * s + (cr * c + ci * s), ar * s + ai * c + (ci * c - cr * s)];
    };

    let worst = 0;
    let scale = 0;
    for (let z = 0; z < n; z += 1) {
      for (let x = 0; x < n; x += 1) {
        const [ar, ai] = hhat(x, z);
        const [br, bi] = hhat((n - x) % n, (n - z) % n);
        // hhat(-k) must equal conj(hhat(k)).
        worst = Math.max(worst, Math.abs(ar - br), Math.abs(ai + bi));
        scale = Math.max(scale, Math.hypot(ar, ai));
      }
    }
    expect(worst / scale).toBeLessThan(1e-5);
  });

  it('produces a height field with no imaginary residue', () => {
    // The same failure, seen from the other end: a non-Hermitian spectrum
    // leaves an imaginary part after the transform, and that residue IS the
    // partner field bleeding through.
    const n = 32;
    const spec = buildCascadeSpectrum(WIND_SEA, n, 4711);
    const t = 6.5;

    const packed = new Float64Array(n * n * 2);
    for (let i = 0; i < n * n; i += 1) {
      const b = i * 4;
      const w = spec.wave[b];
      const c = Math.cos(w * t);
      const s = Math.sin(w * t);
      packed[2 * i] = spec.h0[b] * c - spec.h0[b + 1] * s
        + (spec.h0[b + 2] * c + spec.h0[b + 3] * s);
      packed[2 * i + 1] = spec.h0[b] * s + spec.h0[b + 1] * c
        + (spec.h0[b + 3] * c - spec.h0[b + 2] * s);
    }

    const out = ifft2d(packed, n);
    let maxRe = 0;
    let maxIm = 0;
    for (let i = 0; i < n * n; i += 1) {
      maxRe = Math.max(maxRe, Math.abs(out[2 * i]));
      maxIm = Math.max(maxIm, Math.abs(out[2 * i + 1]));
    }
    expect(maxIm / maxRe).toBeLessThan(1e-6);
  });

  it('has a slope that does NOT depend on the choppiness setting', () => {
    // The impossible reading that exposed the leak. Choppiness scales the
    // HORIZONTAL displacement only. The height derivative cannot see it. If
    // this fails, a displacement field is bleeding into a slope field.
    const rmsSlope = (chop: number): number => {
      const spec = buildCascadeSpectrum(
        { ...WIND_SEA, choppiness: chop }, 64, 8080,
      );
      const f = realizeCascade(spec, 2);
      let s = 0;
      for (let i = 0; i < f.slopeX.length; i += 1) {
        s += f.slopeX[i] * f.slopeX[i] + f.slopeZ[i] * f.slopeZ[i];
      }
      return Math.sqrt(s / f.slopeX.length);
    };
    const a = rmsSlope(0);
    const b = rmsSlope(2.5);
    expect(Math.abs(a - b) / a).toBeLessThan(1e-6);
  });

  it('has slope fields that converge to a finite difference at second order', () => {
    // Proves the derivative spectra are the derivatives of the SAME field,
    // which is what makes the analytic normal correct.
    //
    // A central difference is only second-order accurate, so comparing it to
    // an EXACT spectral derivative always shows an error near the Nyquist
    // wavelength. Asserting a fixed tolerance there would be asserting the
    // discretization error, not the code. So the test bounds the same band on
    // two grid spacings and demands the error fall by the factor of four that
    // second-order accuracy predicts. A wrong derivative spectrum does not
    // converge at all.
    const band = { ...WIND_SEA, choppiness: 0, cutoffLowM: 20 };

    const rmsError = (n: number): number => {
      const spec = buildCascadeSpectrum(band, n, 555);
      const f = realizeCascade(spec, 1.25);
      const dx = band.patchM / n;
      let se = 0;
      let ss = 0;
      for (let z = 0; z < n; z += 1) {
        for (let x = 0; x < n; x += 1) {
          const xp = z * n + ((x + 1) % n);
          const xm = z * n + ((x + n - 1) % n);
          const fd = (f.height[xp] - f.height[xm]) / (2 * dx);
          const sv = f.slopeX[z * n + x];
          se += (fd - sv) * (fd - sv);
          ss += sv * sv;
        }
      }
      return Math.sqrt(se / ss);
    };

    // 64 and 128, not 32 and 64: at 32 the grid spacing is 3.0 m against a
    // 20 m shortest wave, which is not yet the asymptotic regime, and the
    // measured ratio undershoots at 3.17. At 64 and 128 both grids are well
    // inside it.
    const coarse = rmsError(64);
    const fine = rmsError(128);
    // Assert the ORDER, not a fixed ratio. Halving dx must drop the error by
    // 2^order, and a central difference is second order. The measured order
    // is 2.28 rather than exactly 2 because the error is dominated by the
    // shortest waves in the band rather than spread evenly across it. A wrong
    // derivative spectrum does not converge at any order.
    const order = Math.log2(coarse / fine);
    expect(order).toBeGreaterThan(1.8);
    expect(order).toBeLessThan(2.6);
    // And at the fine spacing the agreement must be good in absolute terms.
    expect(fine).toBeLessThan(0.02);
  });
});

describe('determinism', () => {
  it('gives byte-identical spectra for the same seed', () => {
    const a = buildCascadeSpectrum(WIND_SEA, 64, 31337);
    const b = buildCascadeSpectrum(WIND_SEA, 64, 31337);
    expect(Array.from(a.h0)).toEqual(Array.from(b.h0));
    expect(Array.from(a.wave)).toEqual(Array.from(b.wave));
    expect(a.m0).toBe(b.m0);
  });

  it('gives a different sea for a different seed', () => {
    const a = buildCascadeSpectrum(WIND_SEA, 64, 1);
    const b = buildCascadeSpectrum(WIND_SEA, 64, 2);
    expect(Array.from(a.h0)).not.toEqual(Array.from(b.h0));
    // But the SAME statistics: the seed picks the realization, not the sea
    // state.
    expect(a.m0).toBeCloseTo(b.m0, 12);
  });

  it('gives the same height at the same (seed, time)', () => {
    // The property a reproducible ship position depends on.
    const spec = buildCascadeSpectrum(WIND_SEA, 32, 909);
    const t = 17.375;
    const a = realizeCascade(spec, t);
    const b = realizeCascade(buildCascadeSpectrum(WIND_SEA, 32, 909), t);
    expect(Array.from(a.height)).toEqual(Array.from(b.height));
    expect(Array.from(a.dispX)).toEqual(Array.from(b.dispX));
  });

  it('gives a DIFFERENT height at a different time — the sea actually moves', () => {
    const spec = buildCascadeSpectrum(WIND_SEA, 32, 909);
    const a = realizeCascade(spec, 0);
    const b = realizeCascade(spec, 2.5);
    let diff = 0;
    for (let i = 0; i < a.height.length; i += 1) {
      diff += Math.abs(a.height[i] - b.height[i]);
    }
    expect(diff / a.height.length).toBeGreaterThan(1e-3);
  });
});

describe('the shipped sea state', () => {
  it('covers one contiguous band with no gap and no overlap', () => {
    // Three cascades now, so this is a chain rather than a pair. A gap loses
    // a whole band of waves; an overlap double-counts one and the sea gains
    // energy it should not have.
    const ordered = [...DEFAULT_CASCADES].sort((a, b) => a.cutoffHighM - b.cutoffHighM);
    expect(ordered[0].cutoffLowM).toBe(0);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i].cutoffLowM).toBe(ordered[i - 1].cutoffHighM);
    }
  });

  it('gives the wind sea and the swell different headings', () => {
    // Aligned cascades collapse back into one direction and the corduroy
    // returns. Demand a real angular separation.
    expect(Math.abs(SWELL.windDirRad - WIND_SEA.windDirRad)).toBeGreaterThan(0.5);
  });

  it('keeps the ripple on the wind heading, because short waves follow the wind', () => {
    expect(RIPPLE.windDirRad).toBe(WIND_SEA.windDirRad);
  });

  it('gives every cascade a tiling period with no short common multiple', () => {
    // Every patch size is prime, so the summed field repeats only at their
    // product — 1,629 kilometers, far past any horizon. Adding the third
    // cascade did not spend this property.
    const isPrime = (v: number) => {
      for (let d = 2; d * d <= v; d += 1) if (v % d === 0) return false;
      return v > 1;
    };
    let product = 1;
    for (const c of DEFAULT_CASCADES) {
      expect(isPrime(c.patchM)).toBe(true);
      product *= c.patchM;
    }
    expect(product).toBeGreaterThan(1_000_000);
  });

  it('puts the wind sea and swell JONSWAP peaks inside their own bands', () => {
    // The ripple is excluded on purpose: it is not a separate sea state. It
    // is the wind sea's own spectrum band-limited to the short end, so it
    // carries the tail and never the peak. The next test proves that claim.
    for (const c of [WIND_SEA, SWELL]) {
      const omegaP = jonswapPeakOmega(c.windSpeedMs, c.fetchM);
      const kP = (omegaP * omegaP) / GRAVITY_MS2;
      const lambdaP = (2 * Math.PI) / kP;
      expect(lambdaP).toBeGreaterThanOrEqual(c.cutoffLowM);
      expect(lambdaP).toBeLessThan(c.cutoffHighM);
    }
  });

  it('splits the wind sea across two patches without inventing energy', () => {
    // THE TEST THAT JUSTIFIES THE THIRD CASCADE.
    //
    // The ripple is the wind sea below 13 m, resolved on a finer patch. So
    // the variance of ripple + wind-sea must equal the variance of the one
    // undivided 0-97 m band. If it does not, the third cascade added energy
    // rather than resolution, and the sea got taller for a rendering reason.
    //
    // The tolerance is 3% because m0 is a discrete sum over each cascade's
    // own grid, and the 13 m and 97 m grids sample the same integral at
    // different spacings. Measured: 2.0% low.
    const n = 256;
    expect(RIPPLE.windSpeedMs).toBe(WIND_SEA.windSpeedMs);
    expect(RIPPLE.fetchM).toBe(WIND_SEA.fetchM);

    const merged = buildCascadeSpectrum({ ...WIND_SEA, cutoffLowM: 0 }, n, 1);
    const split = buildCascadeSpectrum(RIPPLE, n, 1).m0
      + buildCascadeSpectrum(WIND_SEA, n, 1).m0;
    expect(Math.abs(split - merged.m0) / merged.m0).toBeLessThan(0.03);
  });

  it('resolves the short waves the two-cascade sea could not', () => {
    // The failure that made a third cascade necessary, stated as a number.
    // The finest wavelength a patch of N cells can hold is 2L/N, and the
    // texel is L/N. At 1.6 m eye height the two-cascade sea offered 0.76 m
    // and 0.38 m, so the near water had no structure smaller than a meter.
    const n = 256;
    expect((2 * RIPPLE.patchM) / n).toBeLessThan(0.15);
    expect(RIPPLE.patchM / n).toBeLessThan(0.06);
  });

  it('carries most of the surface SLOPE in the ripple, which is what the eye reads', () => {
    // Slope, not height, is what makes water look like water at eye level.
    // The ripple holds 0.8% of the variance and the largest slope of the
    // three cascades — which is exactly why losing it to a coarse texel made
    // the sea read as a smooth hill.
    const rms = (p: CascadeParams): number => {
      const f = realizeCascade(buildCascadeSpectrum(p, 128, 11), 5);
      let s = 0;
      for (let i = 0; i < f.slopeX.length; i += 1) {
        s += f.slopeX[i] * f.slopeX[i] + f.slopeZ[i] * f.slopeZ[i];
      }
      return Math.sqrt(s / f.slopeX.length);
    };
    expect(rms(RIPPLE)).toBeGreaterThan(rms(WIND_SEA));
    expect(rms(WIND_SEA)).toBeGreaterThan(rms(SWELL));
  });

  it('keeps the total sea height the two-cascade version reported', () => {
    // Hs is what a sailor reads and what ship motion is keyed to. Adding a
    // cascade must not change it: the band moved, it did not appear.
    const n = 256;
    const m0 = DEFAULT_CASCADES.reduce(
      (s, c, ci) => s + buildCascadeSpectrum(c, n, (0x0cea9 ^ (ci * 0x9e3779b9)) >>> 0).m0,
      0,
    );
    // The two-cascade sea measured 11.99 ft. Three cascades measure 11.96 ft.
    expect(significantWaveHeightM(m0)).toBeGreaterThan(3.60);
    expect(significantWaveHeightM(m0)).toBeLessThan(3.70);
  });

  it('flags exactly the cascades that can actually fold', () => {
    // Foam comes from the folding Jacobian. The swell provably cannot fold —
    // a 126 m wave 3 m high is nowhere near steep enough — so including it
    // would only dilute the signal.
    expect(RIPPLE.drivesFoam).toBe(true);
    expect(WIND_SEA.drivesFoam).toBe(true);
    expect(SWELL.drivesFoam).toBe(false);
  });

  it('fades each cascade out before the mesh can no longer carry it', () => {
    // A cascade drawn past its resolvable range produces aliasing, not
    // detail. Short bands must fade first.
    const ordered = [...DEFAULT_CASCADES].sort((a, b) => a.cutoffHighM - b.cutoffHighM);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i].dispLod.endM).toBeGreaterThanOrEqual(ordered[i - 1].dispLod.endM);
    }
    // Normals are read per fragment, so they outlive the geometry that
    // carries the same band. That is what gives the near water its texture.
    expect(RIPPLE.normalLod.endM).toBeGreaterThan(RIPPLE.dispLod.endM);
  });
});

