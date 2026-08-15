/**
 * @file oceanSpectrum.ts — JONSWAP + TMA, cosine-2s spreading, and the
 * deterministic initial spectrum the GPU transform consumes.
 *
 * ALL METRIC. See `oceanUnits.ts` for the boundary rule.
 *
 * PROVENANCE
 *
 * The method is published oceanography and is implemented here from the
 * literature, not copied from any repository:
 *
 *   - JONSWAP: Hasselmann et al. (1973), "Measurements of wind-wave growth
 *     and swell decay during the Joint North Sea Wave Project".
 *   - TMA depth correction: Bouws et al. (1985); the depth function is
 *     Kitaigorodskii et al. (1975).
 *   - cosine-2s spreading with a frequency-dependent power: Mitsuyasu et al.
 *     (1975), as restated by Hasselmann et al. (1980).
 *   - The complex-amplitude construction and the displacement/derivative
 *     spectra: Tessendorf, "Simulating Ocean Water" (SIGGRAPH course notes).
 *
 * WHY THE SPECTRUM IS BUILT ON THE CPU
 *
 * The initial spectrum h0(k) depends on the seed and NOT on time. It is built
 * once. Building it on the CPU buys three things at zero frame cost:
 *
 *   1. DETERMINISM. The random draw is a seeded generator in plain
 *      TypeScript, so the same seed gives byte-identical amplitudes on every
 *      machine. A GPU hash would not promise that across vendors.
 *   2. TESTABILITY. vitest has no GPU. Every claim about the spectrum is
 *      proved here, on the CPU, against known spectral identities.
 *   3. A PRECOMPUTED DISPERSION. The angular frequency omega(k) is baked into
 *      the buffer, so the per-frame GPU pass never evaluates tanh — which TSL
 *      does not expose anyway.
 */
import {
  GRAVITY_MS2,
  type CascadeParams,
} from './oceanConfig';

const TWO_PI = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

/**
 * A 32-bit mixing PRNG (mulberry32). Chosen because it is exactly
 * reproducible in integer arithmetic and has no floating-point state, so the
 * same seed gives the same stream on every platform.
 */
export function makeOceanRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Two independent standard normals from two uniforms (Box-Muller).
 *
 * The spectrum needs Gaussian amplitudes, not uniform ones. A uniform draw
 * gives a sea whose crest statistics are wrong: real sea-surface elevation is
 * Gaussian to first order, and that is exactly what makes the Rayleigh crest
 * distribution come out right.
 */
export function gaussianPair(u1: number, u2: number): [number, number] {
  // u1 is clamped away from 0 because log(0) is not finite.
  const r = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-12)));
  const theta = TWO_PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

/* ------------------------------------------------------------------ */
/* Gamma function, for the spreading normalization                     */
/* ------------------------------------------------------------------ */

const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** log(Gamma(x)) for x > 0, Lanczos approximation. */
export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection: Gamma(x)Gamma(1-x) = pi / sin(pi x)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let sum = LANCZOS_C[0];
  for (let i = 1; i < LANCZOS_G + 2; i += 1) sum += LANCZOS_C[i] / (z + i);
  const t = z + LANCZOS_G + 0.5;
  return 0.5 * Math.log(TWO_PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

/* ------------------------------------------------------------------ */
/* JONSWAP                                                             */
/* ------------------------------------------------------------------ */

/**
 * JONSWAP scale parameter.
 *
 *   alpha = 0.076 * (g * fetch / windSpeed^2)^-0.22
 *
 * The bracket is the inverse dimensionless fetch. Short fetch -> large alpha
 * -> a steeper, younger sea.
 */
export function jonswapAlpha(windSpeedMs: number, fetchM: number): number {
  const dimensionlessFetch = (GRAVITY_MS2 * fetchM) / (windSpeedMs * windSpeedMs);
  return 0.076 * Math.pow(dimensionlessFetch, -0.22);
}

/**
 * JONSWAP peak angular frequency, rad/s.
 *
 *   peakOmega = 22 * (windSpeed * fetch / g^2)^-0.33
 *
 * The bracket has units of s^3, so the result is 1/s. This is the standard
 * fetch-limited peak rewritten: it agrees with 22*(g/U)*(gF/U^2)^-0.33 to the
 * rounding in the published exponent.
 */
export function jonswapPeakOmega(windSpeedMs: number, fetchM: number): number {
  const g2 = GRAVITY_MS2 * GRAVITY_MS2;
  return 22 * Math.pow((windSpeedMs * fetchM) / g2, -0.33);
}

/** The JONSWAP peak-enhancement exponent gamma. 3.3 is the JONSWAP mean. */
export const JONSWAP_GAMMA = 3.3;

/**
 * The one-dimensional JONSWAP variance density S(omega), in m^2 s/rad.
 *
 * S = alpha g^2 / omega^5 * exp(-1.25 (omegaP/omega)^4) * gamma^r
 *   r = exp(-(omega-omegaP)^2 / (2 sigma^2 omegaP^2))
 *   sigma = 0.07 below the peak, 0.09 above it.
 *
 * The first two factors are Pierson-Moskowitz. The gamma^r factor is what
 * JONSWAP adds: a fetch-limited sea has a sharper peak than a fully
 * developed one, because the energy has not yet spread down the spectrum.
 */
export function jonswapS(
  omega: number,
  windSpeedMs: number,
  fetchM: number,
): number {
  if (omega <= 1e-6) return 0;
  const alpha = jonswapAlpha(windSpeedMs, fetchM);
  const omegaP = jonswapPeakOmega(windSpeedMs, fetchM);
  const g2 = GRAVITY_MS2 * GRAVITY_MS2;

  const pm = (alpha * g2) / Math.pow(omega, 5)
    * Math.exp(-1.25 * Math.pow(omegaP / omega, 4));

  const sigma = omega <= omegaP ? 0.07 : 0.09;
  const d = omega - omegaP;
  const r = Math.exp(-(d * d) / (2 * sigma * sigma * omegaP * omegaP));

  return pm * Math.pow(JONSWAP_GAMMA, r);
}

/**
 * The TMA shallow-water correction factor, dimensionless, in [0, 1].
 *
 * Kitaigorodskii's depth function. Deep water leaves the spectrum alone;
 * shallow water strips the low-frequency energy that cannot exist there.
 *
 *   omegaH = omega * sqrt(depth / g)
 *   omegaH <= 1        -> 0.5 * omegaH^2
 *   1 < omegaH < 2     -> 1 - 0.5 * (2 - omegaH)^2
 *   omegaH >= 2        -> 1
 *
 * At 1000 m depth this is 1 for every frequency the sea carries, so the open
 * ocean pays nothing for it. It is here so a coastal sea state is one
 * parameter away.
 */
export function tmaFactor(omega: number, depthM: number): number {
  const omegaH = omega * Math.sqrt(depthM / GRAVITY_MS2);
  if (omegaH <= 1) return 0.5 * omegaH * omegaH;
  if (omegaH >= 2) return 1;
  const t = 2 - omegaH;
  return 1 - 0.5 * t * t;
}

/* ------------------------------------------------------------------ */
/* Dispersion                                                          */
/* ------------------------------------------------------------------ */

/**
 * Finite-depth dispersion: omega^2 = g k tanh(k h). Returns omega, rad/s.
 *
 * Deep water collapses this to omega = sqrt(g k), which is why long swell
 * outruns chop: phase speed goes as 1/sqrt(k).
 */
export function dispersionOmega(k: number, depthM: number): number {
  return Math.sqrt(GRAVITY_MS2 * k * Math.tanh(Math.min(k * depthM, 20)));
}

/**
 * d(omega)/dk for the same relation. Needed to move a spectrum from
 * frequency space into wavenumber space; the Jacobian is not optional and
 * omitting it is the classic way to get a sea with the wrong energy.
 *
 *   2 omega domega/dk = g [ tanh(kh) + kh sech^2(kh) ]
 */
export function dispersionDerivative(k: number, depthM: number): number {
  const omega = dispersionOmega(k, depthM);
  if (omega <= 1e-9) return 0;
  const kh = Math.min(k * depthM, 20);
  const th = Math.tanh(kh);
  const sech2 = 1 - th * th;
  return (GRAVITY_MS2 * (th + kh * sech2)) / (2 * omega);
}

/* ------------------------------------------------------------------ */
/* Directional spreading                                               */
/* ------------------------------------------------------------------ */

/**
 * The Mitsuyasu spreading power s, which VARIES WITH FREQUENCY.
 *
 *   sPeak = 11.5 * (g / (omegaP * U))^2.5
 *   omega <= omegaP -> sPeak * (omega/omegaP)^5
 *   omega >  omegaP -> sPeak * (omega/omegaP)^-2.5
 *
 * This is the part that stops the sea reading as corduroy. A constant s
 * spreads every frequency by the same angle, so every wavelength arrives on
 * the same fan of headings and the crests line up into ridges. In a real sea
 * the energy at the peak is narrowly directional and everything away from the
 * peak is broad, which breaks the alignment.
 */
export function spreadingPower(
  omega: number,
  omegaP: number,
  windSpeedMs: number,
): number {
  const sPeak = 11.5 * Math.pow(GRAVITY_MS2 / (omegaP * windSpeedMs), 2.5);
  const ratio = omega / Math.max(omegaP, 1e-6);
  const s = omega <= omegaP
    ? sPeak * Math.pow(ratio, 5)
    : sPeak * Math.pow(ratio, -2.5);
  // Clamped: s below ~0.1 is a nearly flat fan and s above ~40 overflows the
  // cos^(2s) power in float32 for angles away from the mean.
  return Math.min(Math.max(s, 0.1), 40);
}

/**
 * The cosine-2s normalization constant, so that the integral of D over a full
 * turn is exactly 1.
 *
 *   N(s) = 2^(2s-1) / pi * Gamma(s+1)^2 / Gamma(2s+1)
 */
export function cosine2sNormalization(s: number): number {
  const logN = (2 * s - 1) * Math.LN2
    - Math.log(Math.PI)
    + 2 * logGamma(s + 1)
    - logGamma(2 * s + 1);
  return Math.exp(logN);
}

/**
 * cosine-2s directional spreading D(theta), 1/rad. Integrates to 1.
 *
 *   D = N(s) * cos^(2s)((theta - thetaMean) / 2)
 *
 * The half-angle is what makes this a proper distribution on the full circle
 * rather than a half-circle lobe: cos((theta-mean)/2) is non-negative across
 * a full turn and vanishes exactly opposite the mean.
 */
export function cosine2sSpread(
  theta: number,
  thetaMean: number,
  s: number,
): number {
  const half = (theta - thetaMean) * 0.5;
  const c = Math.cos(half);
  // cos^(2s) of a negative base is fine because the exponent is applied to
  // c^2, which is never negative.
  return cosine2sNormalization(s) * Math.pow(c * c, s);
}

/* ------------------------------------------------------------------ */
/* The two-dimensional wavenumber spectrum                             */
/* ------------------------------------------------------------------ */

/**
 * The 2-D variance density in wavevector space, m^4.
 *
 *   Psi(kx, kz) = S(omega) * TMA(omega, h) * D(theta) * (domega/dk) / k
 *
 * The /k comes from the polar area element: S(omega) domega dtheta must equal
 * Psi(k) k dk dtheta. Drop it and the long waves are over-weighted.
 *
 * Returns 0 outside the cascade's wavelength band, which is how the two
 * cascades avoid double-counting the band they share.
 */
export function directionalSpectrum(
  kx: number,
  kz: number,
  p: CascadeParams,
): number {
  const k = Math.hypot(kx, kz);
  if (k < 1e-9) return 0;

  const wavelength = TWO_PI / k;
  if (wavelength < p.cutoffLowM || wavelength >= p.cutoffHighM) return 0;

  const omega = dispersionOmega(k, p.depthM);
  if (omega < 1e-9) return 0;

  const omegaP = jonswapPeakOmega(p.windSpeedMs, p.fetchM);
  const s = spreadingPower(omega, omegaP, p.windSpeedMs);
  const theta = Math.atan2(kz, kx);

  const sOmega = jonswapS(omega, p.windSpeedMs, p.fetchM);
  const tma = tmaFactor(omega, p.depthM);
  const d = cosine2sSpread(theta, p.windDirRad, s);
  const dOmegaDk = dispersionDerivative(k, p.depthM);

  return (sOmega * tma * d * dOmegaDk) / k;
}

/* ------------------------------------------------------------------ */
/* The initial spectrum buffer                                         */
/* ------------------------------------------------------------------ */

/**
 * One cascade's time-invariant spectrum, laid out for the GPU.
 *
 * `h0` is vec4 per cell: (h0.re, h0.im, conj(h0(-k)).re, conj(h0(-k)).im).
 * Both halves are stored because the per-frame pass needs them together and
 * a second gather from the mirrored index would cost a scattered read.
 *
 * `wave` is vec4 per cell: (omega, kx, kz, 1/k). The reciprocal is stored
 * rather than computed because the GPU pass would otherwise need a guarded
 * divide at k = 0 in the hottest kernel it runs.
 *
 * The wavevector grid is CENTERED: index x maps to kx = (x - N/2) * 2pi/L.
 * That puts k = 0 at the middle of the array, which is where the spectrum's
 * symmetry is easiest to reason about. The cost is a (-1)^(x+z) sign on the
 * transform output, which the surface pass applies.
 */
export interface CascadeSpectrum {
  readonly n: number;
  readonly params: CascadeParams;
  /** 4 floats per cell, length 4 * n * n. */
  readonly h0: Float32Array;
  /** 4 floats per cell, length 4 * n * n. */
  readonly wave: Float32Array;
  /**
   * The zeroth spectral moment m0, m^2 — the total variance the spectrum
   * carries. The realized height field must reproduce this, and the test
   * suite checks exactly that.
   */
  readonly m0: number;
}

/**
 * Build one cascade's initial spectrum.
 *
 * THE AMPLITUDE, DERIVED RATHER THAN COPIED. The realized field is
 *
 *   h(x) = sum_k [ h0(k) e^{i w t} + conj(h0(-k)) e^{-i w t} ] e^{i k x}
 *
 * so its spatial variance is sum_k E|hhat_k|^2, and the two halves are drawn
 * independently, so E|hhat_k|^2 = E|h0(k)|^2 + E|h0(-k)|^2. Summing over the
 * whole grid counts every wavevector twice. Setting that equal to the target
 * variance m0 = sum_k Psi(k) dk^2 gives
 *
 *   E|h0(k)|^2 = Psi(k) dk^2 / 2
 *
 * and with h0 = c (xi_r + i xi_i), where E[xi_r^2 + xi_i^2] = 2,
 *
 *   c = dk * sqrt(Psi(k)) / 2
 *
 * That factor of 1/2 is the one every ocean implementation gets wrong at
 * least once; `oceanSpectrum.test.ts` asserts the realized variance against
 * m0 precisely so it cannot drift.
 *
 * DETERMINISM. The generator is seeded once and consumed in a fixed raster
 * order. The same (seed, cascade index) always yields the same buffer.
 */
export function buildCascadeSpectrum(
  params: CascadeParams,
  n: number,
  seed: number,
): CascadeSpectrum {
  const h0 = new Float32Array(4 * n * n);
  const wave = new Float32Array(4 * n * n);
  const rng = makeOceanRng(seed);

  const dk = TWO_PI / params.patchM;
  const half = n / 2;
  let m0 = 0;

  /*
   * ONE GAUSSIAN PAIR PER CELL, DRAWN FIRST, THEN SHARED.
   *
   * This ordering is the whole correctness of the module, and getting it
   * wrong is subtle enough to survive a casual look at the result.
   *
   * The realized surface is
   *
   *   hhat(k) = h0(k) e^{i w t} + conj(h0(-k)) e^{-i w t}
   *
   * and it is REAL only if the second term genuinely uses the amplitude
   * stored at the MIRRORED cell. A first version of this function drew fresh
   * randoms for the conjugate half at every cell. The variance came out
   * right, the mean came out right, and the surface still looked like waves —
   * but hhat was no longer Hermitian, so the inverse transform carried a
   * large imaginary residue.
   *
   * That residue is not cosmetic. The pipeline packs TWO real fields into one
   * complex transform and reads them back as the real and imaginary parts. A
   * field with a spurious imaginary part therefore LEAKS INTO ITS PARTNER:
   * the horizontal displacement bled into the slope, and the measured slope
   * grew with the choppiness setting, which is impossible for a height
   * derivative. That impossible reading is what exposed the bug.
   *
   * So: draw the whole grid once, then index it twice.
   */
  const gauss = new Float32Array(2 * n * n);
  for (let i = 0; i < n * n; i += 1) {
    const [ga, gb] = gaussianPair(rng(), rng());
    gauss[2 * i] = ga;
    gauss[2 * i + 1] = gb;
  }

  for (let z = 0; z < n; z += 1) {
    for (let x = 0; x < n; x += 1) {
      const idx = (z * n + x) * 4;

      const kx = (x - half) * dk;
      const kz = (z - half) * dk;
      const k = Math.hypot(kx, kz);

      const omega = dispersionOmega(k, params.depthM);
      wave[idx + 0] = omega;
      wave[idx + 1] = kx;
      wave[idx + 2] = kz;
      wave[idx + 3] = k > 1e-9 ? 1 / k : 0;

      // The cell holding -k. On a centered grid, index x maps to
      // kx = (x - n/2) dk, so -k lives at (n - x, n - z), wrapped. The wrap
      // makes the Nyquist row pair with itself, which is correct: its k and
      // -k are the same point on the grid.
      const mxIdx = (n - x) % n;
      const mzIdx = (n - z) % n;
      const mg = (mzIdx * n + mxIdx) * 2;

      /*
       * THE NYQUIST ROW AND COLUMN CARRY NO ENERGY.
       *
       * Index 0 on the centered grid is kx = -(n/2) dk. Its negative,
       * +(n/2) dk, is NOT on the grid — the wrap maps index 0 to itself. So
       * that mode has no conjugate partner and cannot be made Hermitian, and
       * it leaves a real imaginary residue in the transform. Since the whole
       * packing scheme depends on Hermitian symmetry, the honest move is to
       * drop the mode rather than to tolerate the residue.
       *
       * The cost is 2 rows out of 256, at the extreme short-wave end where
       * the JONSWAP tail is already near zero. The benefit is a surface that
       * is exactly real, which is what the packing needs.
       */
      const onNyquist = x === 0 || z === 0;

      const psiK = onNyquist ? 0 : directionalSpectrum(kx, kz, params);
      const psiM = onNyquist ? 0 : directionalSpectrum(-kx, -kz, params);

      const ampK = 0.5 * dk * Math.sqrt(Math.max(psiK, 0));
      const ampM = 0.5 * dk * Math.sqrt(Math.max(psiM, 0));

      const g0 = gauss[(z * n + x) * 2];
      const g1 = gauss[(z * n + x) * 2 + 1];
      const g2 = gauss[mg];
      const g3 = gauss[mg + 1];

      h0[idx + 0] = g0 * ampK;
      h0[idx + 1] = g1 * ampK;
      // The stored value is conj(h0(-k)): the same draw the mirrored cell
      // uses, with the imaginary part negated. Doing the conjugate here means
      // the per-frame GPU pass needs no branch and no mirrored fetch.
      h0[idx + 2] = g2 * ampM;
      h0[idx + 3] = -g3 * ampM;

      // m0 accumulates the analytic variance, not the drawn one, because the
      // draw is a sample OF this variance.
      m0 += psiK * dk * dk;
    }
  }

  return { n, params, h0, wave, m0 };
}

/**
 * Significant wave height Hs = 4 sqrt(m0), METERS.
 *
 * The oceanographic definition: the mean height of the highest third of the
 * waves. It is the single number a sailor would recognize, and it is the
 * number the test suite checks against the fetch-limited empirical law.
 */
export function significantWaveHeightM(m0: number): number {
  return 4 * Math.sqrt(m0);
}

/**
 * The empirical fetch-limited significant wave height, METERS.
 *
 *   Hs = 0.0016 * U * sqrt(fetch / g) * ... -> in the standard dimensionless
 *   form, g Hs / U^2 = 0.0016 * (g F / U^2)^0.5
 *
 * Hasselmann et al. (1973), eq. for the fetch-limited growth of variance.
 * Used ONLY as a test oracle: if the integrated JONSWAP spectrum does not
 * land near this, the spectrum is wrong.
 */
export function empiricalFetchLimitedHsM(
  windSpeedMs: number,
  fetchM: number,
): number {
  const dimensionlessFetch = (GRAVITY_MS2 * fetchM) / (windSpeedMs * windSpeedMs);
  return (0.0016 * Math.sqrt(dimensionlessFetch) * windSpeedMs * windSpeedMs)
    / GRAVITY_MS2;
}
