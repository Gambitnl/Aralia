// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 26/08/2026, 14:22:35
 * Dependents: components/DesignPreview/steps/sidebyside/SideBySideOcean.tsx, systems/world3d/ocean/index.ts, systems/world3d/ocean/oceanCompute.ts, systems/world3d/ocean/oceanField.ts, systems/world3d/ocean/oceanFieldReference.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
 *   - sech^2 spreading with a frequency-dependent width: Donelan, Hamilton
 *     and Hui (1985), extended above 1.6 fp by Banner (1990). A cascade picks
 *     one of the two by its `spreading` field.
 *   - Swell decay away from its storm: Snodgrass et al. (1966), carried as a
 *     cascade's `energyScale`.
 *   - The complex-amplitude construction and the displacement/derivative
 *     spectra: Tessendorf, "Simulating Ocean Water" (SIGGRAPH course notes).
 *     The displacement SIGN is not his: see oceanCompute.ts.
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
  tailPower = 5,
  taper = false,
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

  const s = pm * Math.pow(JONSWAP_GAMMA, r);

  /*
   * THE TAIL ABOVE THE PEAK. JONSWAP's omega^-5 is Phillips's 1958
   * saturation range. Toba (1973), Donelan et al. (1985) and Phillips
   * himself (1985) measured omega^-4 in the field: the equilibrium range
   * holds twice JONSWAP's energy one octave above the peak and four times
   * two octaves above. `tailPower` is that exponent; 5 keeps JONSWAP
   * exactly, and the factor below is 1 at the peak so the spectrum stays
   * continuous there. Only the high side is touched: the low side is set by
   * the exp(-1.25 (wp/w)^4) cutoff, which every fit shares.
   */
  if (omega <= omegaP) return s;
  let tail = tailPower !== 5 ? Math.pow(omega / omegaP, 5 - tailPower) : 1;
  // The taper is off unless a cascade asks for it; see `elfouhailyTaper`.
  if (taper) tail *= elfouhailyTaper(omega, omegaP, windSpeedMs);
  return s * tail;
}

/**
 * The Elfouhaily taper on the equilibrium range, dimensionless, in (0, 1].
 *
 * Elfouhaily, Chapron, Katsaros and Vandemark (1997), "A unified directional
 * spectrum for long and short wind-driven waves", J. Geophys. Res. 102(C7),
 * write the long-wave curvature spectrum as the omega^-4 equilibrium range
 * times
 *
 *   exp(-(Omega / sqrt(10)) (sqrt(k / kp) - 1)),   Omega = U10 / cp,
 *
 * and sqrt(k / kp) is omega / omegaP in deep water. The factor is 1 at the
 * peak, so the peak and Hs are kept, and it takes the equilibrium range back
 * down toward JONSWAP's omega^-5 level by a few peak frequencies, where
 * their short-wave curvature term takes over. For the Water Pro sea (15 m/s,
 * 47 m peak, Omega = 1.75) it is 0.87 at 30 m, 0.61 at 13 m and 0.39 at
 * 6.5 m, so omega^-4 with the taper sits 1.09, 1.15 and 1.05 times JONSWAP
 * there, where omega^-4 alone sits 1.25, 1.90 and 2.69 times it.
 *
 * WHY IT EXISTS. Without it an omega^-4 band that meets an omega^-5 band
 * steps down at the seam: the Water Pro chop ends at its 6.5 m edge 2.7
 * times above the ripple band it meets, and its slope variance per octave
 * rises toward that edge. Round 4 of the gauntlet suspected that step of the
 * dark bands 8 m apart the critics named, and built this to test it.
 *
 * WHAT THE TEST FOUND, so no sea uses it today: the bands were the chop's
 * back slopes at every wavelength of the band, not its 6.5-13 m end (a CPU
 * copy of the judged frame kept them with the taper on, and with the whole
 * chop on omega^-5), and on the GPU the taper took the middle distance's
 * wave contrast and glints further from the reference. It stays because it
 * is the published shape of the equilibrium range, and a sea state that
 * joins an omega^-4 band to a shorter one without a step can ask for it.
 * See oceanSeaStates.ts, ROUND 4.
 */
export function elfouhailyTaper(omega: number, omegaP: number, windSpeedMs: number): number {
  if (omega <= omegaP) return 1;
  const omegaInv = (windSpeedMs * omegaP) / GRAVITY_MS2;
  return Math.exp(-(omegaInv / Math.sqrt(10)) * (omega / omegaP - 1));
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

/**
 * The Donelan-Banner spreading width beta, which VARIES WITH FREQUENCY.
 *
 * Donelan, Hamilton and Hui (1985), from wave-staff arrays on Lake Ontario,
 * with Banner (1990) for the short waves those arrays could not resolve:
 *
 *   f/fp <  0.95 -> beta = 2.61 (f/fp)^ 1.3      long side of the peak
 *   f/fp <  1.6  -> beta = 2.28 (f/fp)^-1.3      short side of the peak
 *   f/fp >= 1.6  -> beta = 10^(-0.4 + 0.8393 exp(-0.567 ln((f/fp)^2)))
 *
 * beta is the width of sech^2(beta theta): the half-width at half height is
 * 0.88 / beta radians. At the peak that is 22 degrees, at 1.6 fp it is 41
 * degrees, at 3 fp it is 73 degrees. The two short-side branches meet at
 * 1.6 fp, where both give 1.24.
 *
 * WHY THIS AND NOT MITSUYASU FOR A YOUNG SEA. Mitsuyasu's peak power goes
 * as (c_p / U)^2.5, so a 47 m peak under a 15 m/s wind (c_p / U = 0.57) gets
 * s = 2.8, a half-width of 56 degrees, and crests about one wavelength long.
 * Donelan found no such wave-age dependence at the peak, and the reference
 * sea, seen from above, shows crests three to five wavelengths long. The
 * Donelan peak gives that; the Banner tail then widens the short chop until
 * it crosses the peak crests at an angle, which is the scaly pattern a wind
 * sea shows from above and the cross-hatched chop it shows at eye level.
 *
 * Below 0.56 fp Donelan had no data. The long-side power law is kept; it
 * sends beta toward zero and that tail toward isotropic, where the JONSWAP
 * low side carries almost nothing anyway.
 */
export function donelanBeta(omega: number, omegaP: number): number {
  const r = omega / Math.max(omegaP, 1e-6);
  if (r < 0.95) return 2.61 * Math.pow(r, 1.3);
  if (r < 1.6) return 2.28 * Math.pow(r, -1.3);
  return Math.pow(10, -0.4 + 0.8393 * Math.exp(-0.567 * Math.log(r * r)));
}

/**
 * sech^2 directional spreading D(theta), 1/rad, normalized on the full turn.
 *
 *   D = beta sech^2(beta (theta - thetaMean)) / (2 tanh(beta pi))
 *
 * Donelan's form is 0.5 beta sech^2, which integrates to 1 only over an
 * infinite line. On [-pi, pi] it integrates to tanh(beta pi): 0.90 at the
 * Banner short-wave width, so a tenth of the energy would go missing from
 * the chop. The denominator puts it back, and the energy-conservation test
 * in oceanSpectrum.test.ts is what holds it there.
 *
 * The angle is wrapped to [-pi, pi] first, so the lobe is centered on the
 * mean direction wherever on the circle that direction lies.
 */
export function sech2Spread(theta: number, thetaMean: number, beta: number): number {
  // beta -> 0 is the uniform distribution; the ratio below would be 0/0.
  if (beta < 1e-6) return 1 / TWO_PI;
  let d = theta - thetaMean;
  d -= TWO_PI * Math.round(d / TWO_PI);
  const c = Math.cosh(beta * d);
  return beta / (c * c) / (2 * Math.tanh(beta * Math.PI));
}

/**
 * The Hasselmann spreading power s, which VARIES WITH FREQUENCY, for the
 * cosine-2s form.
 *
 * Hasselmann, Dunckel and Ewing (1980), "Directional wave spectra observed
 * during JONSWAP 1973", J. Phys. Oceanogr. 10, from pitch-roll buoys in the
 * North Sea:
 *
 *   s = 9.77 (f/fp)^mu
 *   f <  fp -> mu = 4.06
 *   f >= fp -> mu = -2.33 - 1.45 (U/cp - 1.17)
 *
 * with cp = g / omegaP the phase speed at the peak. At the peak s = 9.77 for
 * every wave age: a half-width at half height of 30 degrees (cosine-2s of
 * the half angle), wider than Donelan's 22. Above the peak the power falls
 * as the sea gets younger: at U/cp = 1.75 (the 15 m/s, 47 m Water Pro sea)
 * mu = -3.17, so s = 2.7 at 1.5 fp (57 degrees) and 1.1 at 2 fp (85).
 *
 * WHY A THIRD UNIMODAL FORM. Donelan at the peak gives crests three to five
 * wavelengths long; at eye level, 60 degrees off square, those crests ran
 * across the whole judged frame as parallel bands, which two critics read
 * as brushed metal. Mitsuyasu's power at this wave age is 2.8 (56 degrees,
 * crests about a wavelength) and was rejected in round 1 as too short from
 * above. Hasselmann's peak sits between the two and is the other published
 * measurement that found no wave-age dependence at the peak; its short-wave
 * branch widens faster than Donelan's, which is what breaks the chop into
 * crossing crests of different lengths.
 */
export function hasselmannPower(
  omega: number,
  omegaP: number,
  windSpeedMs: number,
): number {
  const ratio = omega / Math.max(omegaP, 1e-6);
  const cp = GRAVITY_MS2 / Math.max(omegaP, 1e-6);
  const mu = ratio < 1 ? 4.06 : -2.33 - 1.45 * (windSpeedMs / cp - 1.17);
  const s = 9.77 * Math.pow(ratio, mu);
  // The same clamp as `spreadingPower`, for the same float32 reason.
  return Math.min(Math.max(s, 0.1), 40);
}

/**
 * The Ewans bimodal lobe half-separation, RADIANS, which VARIES WITH
 * FREQUENCY.
 *
 * Ewans (1998), "Observations of the directional spectrum of fetch-limited
 * waves", J. Phys. Oceanogr. 28, from a wave-staff array off Maui, New
 * Zealand: above the peak the directional distribution is BIMODAL. The energy
 * sits in two lobes on either side of the wind, and their separation grows
 * with frequency, because the short waves are generated by the nonlinear
 * transfer from the peak, which sends them out at an angle to it. His fit:
 *
 *   f/fp <= 1 -> 14.93 degrees
 *   f/fp >  1 -> exp(5.453 - 2.750 (fp/f)) degrees
 *
 * 14.9 degrees at the peak, 26 at 1.25 fp, 37 at 1.5 fp, 59 at 2 fp. The two
 * branches meet at the peak. Capped at 60 degrees: the array resolved the
 * lobes to about 2 fp, the fit keeps growing past what it measured, and a
 * lobe past 60 degrees sends short waves across the wind, which the
 * reference chop does not show.
 *
 * WHY THIS AND NOT ONLY DONELAN-BANNER. Donelan's sech^2 widens the chop
 * into one broad fan, and a broad fan of short waves reads as isotropic
 * speckle. Ewans's two lobes put the same energy into two crossing
 * families, which is the cross-hatched chop a wind sea shows at eye level
 * and the oblique second family the gauntlet critics asked for.
 */
export const EWANS_MAX_LOBE_RAD = Math.PI / 3;

export function ewansLobeRad(omega: number, omegaP: number): number {
  const r = omega / Math.max(omegaP, 1e-6);
  // The published 14.93 is exp(5.453 - 2.75) rounded; the exact value keeps
  // the two branches continuous at the peak.
  const deg = r <= 1 ? Math.exp(5.453 - 2.75) : Math.exp(5.453 - 2.75 / r);
  return Math.min(deg, EWANS_MAX_LOBE_RAD * (180 / Math.PI)) * (Math.PI / 180);
}

/**
 * The Ewans lobe width, the sech^2 beta of ONE lobe.
 *
 * Ewans fits each lobe above the peak as a wrapped normal of standard
 * deviation
 *
 *   f/fp >= 1 -> 11.38 + 5.357 (f/fp)^-7.929 degrees
 *
 * 16.7 degrees at the peak, falling to 11.6 by 1.5 fp. His low side is a
 * constant 11.38, which would make the width JUMP at the peak; the fit's
 * peak value is held on the low side instead, where the two lobes merge
 * into one hump anyway. A wrapped normal of
 * standard deviation sigma has its half height at 1.177 sigma; sech^2(beta
 * theta) has it at 0.881 / beta. Matching the half-widths gives
 * beta = 0.749 / sigma, so the lobe shape here is the same family the
 * Donelan branch uses and one normalization serves both.
 */
export function ewansLobeBeta(omega: number, omegaP: number): number {
  const r = omega / Math.max(omegaP, 1e-6);
  const sigmaDeg = 11.38 + 5.357 * Math.pow(Math.max(r, 1), -7.929);
  return 0.749 / (sigmaDeg * (Math.PI / 180));
}

/**
 * Ewans bimodal directional spreading D(theta), 1/rad, normalized on the
 * full turn: half the energy in a sech^2 lobe at thetaMean + lobe, half in
 * one at thetaMean - lobe. Each lobe is `sech2Spread`, which already
 * integrates to exactly 1 on [-pi, pi], so the pair does too.
 */
export function ewansSpread(
  theta: number,
  thetaMean: number,
  omega: number,
  omegaP: number,
): number {
  const lobe = ewansLobeRad(omega, omegaP);
  const beta = ewansLobeBeta(omega, omegaP);
  return 0.5 * sech2Spread(theta, thetaMean + lobe, beta)
    + 0.5 * sech2Spread(theta, thetaMean - lobe, beta);
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
  const theta = Math.atan2(kz, kx);

  const sOmega = jonswapS(omega, p.windSpeedMs, p.fetchM, p.tailPower ?? 5, p.tailTaper ?? false);
  const tma = tmaFactor(omega, p.depthM);
  // Four spreading models, chosen per cascade. An absent field is the
  // shipped Mitsuyasu form, so every existing sea state keeps its shape.
  const d = p.spreading === 'donelan'
    ? sech2Spread(theta, p.windDirRad, donelanBeta(omega, omegaP))
    : p.spreading === 'ewans'
      ? ewansSpread(theta, p.windDirRad, omega, omegaP)
      : p.spreading === 'hasselmann'
        ? cosine2sSpread(theta, p.windDirRad, hasselmannPower(omega, omegaP, p.windSpeedMs))
        : cosine2sSpread(theta, p.windDirRad, spreadingPower(omega, omegaP, p.windSpeedMs));
  const dOmegaDk = dispersionDerivative(k, p.depthM);

  // `energyScale` is a swell's decay away from its storm; 1 for a local sea.
  return (sOmega * tma * d * dOmegaDk * (p.energyScale ?? 1)) / k;
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
