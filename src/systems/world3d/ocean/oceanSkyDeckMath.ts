/**
 * @file oceanSkyDeckMath.ts — the stratus deck's laws, on the CPU (river mouth
 * round 6, law 1). No three import: the sky (`oceanSky.ts`) builds its shader
 * from these numbers, and the tests and the place's record (`oceanMouthMath.ts`,
 * SARCELLE_CONDITIONS) run them as the page does.
 *
 * WHY THIS EXISTS. At a near-grazing view the water is mostly reflected sky.
 * The river mouth's judged frame (the Sarcelle clip) was shot under a BRIGHT
 * GRAY deck of broken cloud, and the sky model had two end states only: the
 * fair cumulus sky (overcast 0) and the dark storm deck (overcast 1). Round 4
 * measured the clip as "overcast 0" because the storm deck darkened the
 * reflected band; so the water reflected a fair blue sky and the judge of
 * round 5 saw "one uniform blue-gray mirror field". A thin stratus deck is a
 * third state: a cloud layer of finite optical depth tau.
 *
 * THE LAWS, each with its source:
 *
 *   THE LAYER'S TRANSMISSION (`deckTransmission`): the delta-Eddington
 *   two-stream solution for a conservative (non-absorbing, visible light)
 *   layer (Shettle and Weinman 1970; Joseph, Wiscombe and Weinman 1976): the
 *   forward diffraction peak f = g^2 of the droplets' phase function is held
 *   as unscattered light (tau' = (1 - g^2) tau), and the rest of the layer
 *   reflects R = [(3/4)(1 - g) tau + (1/2 - (3/4) mu0)(1 - e^(-tau' / mu0))] /
 *   [1 + (3/4)(1 - g) tau] of the sun's beam (mu0 the cosine of the sun's
 *   zenith angle). g = 0.85 for water cloud in the visible (Hansen and Travis
 *   1974). A deck of tau 5 to 15 lets 0.56 to 0.33 of the beam through at a
 *   30 degree sun, nearly all of it scattered: a bright gray layer, its
 *   luminance near the clear sky's; tau 50 and up is the dark storm deck.
 *
 *   THE BASE'S RADIANCE (`deckBaseRadiance`): the Eddington field at the base
 *   of the layer, I(mu) = I0 (1 + 1.5 mu) (mu the sine of the elevation; the
 *   Marshak condition at a dark lower boundary), I0 = F / (2 pi), F the
 *   scattered flux down. The forward peak spreads round the sun as one
 *   Henyey-Greenstein lobe of the droplets' g: the brighter sun patch.
 *
 *   THE DECK'S PATCHES (`deckTauField`): within a stratocumulus scene the
 *   optical depth is gamma distributed (Barker, Wielicki and Parker 1996),
 *   mean tauMean, shape nu; the deck covers the clip's cloud share of the
 *   sky, and the rest are gaps of clear sky. The field is a tileable random
 *   field ranked to a uniform share, so the cover and the distribution are
 *   exact, and mapped through the gamma quantile.
 *
 *   THE LIGHT UNDER IT (`deckSceneLight`): the sun's direct share along its
 *   own ray through the field, e^(-tau / mu0); the diffuse light's gain over
 *   the clear sky's (`skyGain`); the light the air under the deck gets
 *   (`airGain`). Every lit thing of the place (the water's body, the sand)
 *   takes these, so the deck is one sky over one scene.
 *
 * THE UNITS. The sky's radiances are eye-tuned scene-linear values (the clear
 * gradient was fitted to photographed skies); the floor's light (`FLOOR_LIGHT`
 * in oceanSeabedMath.ts) is calibrated on sunlit sand. Their absolute scales
 * differ, but the floor's RATIO of the sun's light to the sky's is the
 * measured clear-sky ratio (Iqbal 1983). So the deck's light is in the sky's
 * own units: the clear sky's irradiance (the gradient's own integral over the
 * dome, `clearE`) times that ratio is the sun's light on top of the deck.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 05:45:34
 * Dependents: systems/world3d/ocean/oceanSky.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** The droplets' asymmetry parameter in the visible (Hansen and Travis 1974, water cloud). */
export const DECK_G = 0.85;

/** The layer's shares of the sun's beam and of the sky's diffuse light, at the sun's cosine mu0. */
export interface DeckTransmission {
  /** All of the beam that comes through (scattered and not). */
  readonly total: number;
  /** The beam in the forward peak, the unscattered part included: e^(-(1 - g^2) tau / mu0). */
  readonly forward: number;
  /** The unscattered beam: e^(-tau / mu0). */
  readonly direct: number;
  /** All of the sky's diffuse light that comes through (mu0 = 2/3, the diffuse mean). */
  readonly skyTotal: number;
  /** The sky's light that comes through in the forward peak (the sky's image, blurred). */
  readonly skyForward: number;
}

/** The delta-Eddington transmission of a conservative layer of optical depth tau (see the file header). */
export function deckTransmission(tau: number, mu0: number, g = DECK_G): DeckTransmission {
  const t = Math.max(tau, 0);
  const mu = Math.max(mu0, 0.05);
  const s = 0.75 * (1 - g) * t;
  const tp = (1 - g * g) * t;
  const forward = Math.exp(-tp / mu);
  const r = (s + (0.5 - 0.75 * mu) * (1 - forward)) / (1 + s);
  // mu0 = 2/3 for the diffuse sky: the (1/2 - 3/4 mu0) term is 0 there.
  return {
    total: Math.min(Math.max(1 - r, 0), 1),
    forward,
    direct: Math.exp(-t / mu),
    skyTotal: 1 / (1 + s),
    skyForward: Math.exp(-1.5 * tp),
  };
}

/** The Henyey-Greenstein phase function, per steradian (integrates to 1 over the sphere). */
export function hgPhase(cosT: number, g = DECK_G): number {
  const d = 1 + g * g - 2 * g * cosT;
  return (1 - g * g) / (4 * Math.PI * Math.pow(Math.max(d, 1e-9), 1.5));
}

export type V3 = readonly [number, number, number];

/** The deck's light: the clear sky's irradiance and the sun's over it, in the sky's units. */
export interface DeckLightIn {
  /** The clear sky's diffuse irradiance on a flat surface, RGB, the sky's units (`clearSkyIrradianceCpu`). */
  readonly clearE: V3;
  /** The sun's horizontal irradiance over the sky's diffuse one, clear (FLOOR_LIGHT: sunE mu0 / skyE). */
  readonly ratio: number;
  /** The sun's color, luminance 1. */
  readonly sunTint: V3;
}

const lumOf = (c: V3): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/**
 * THE CELLS' WALLS. A deck of broken cloud seen at a low elevation shows the
 * walls of its cells more than their bases: between the base and the top a
 * ray at elevation e runs D / tan(e) over the ground, and past a cell's
 * width W that is mostly wall (the cloud cover seen grows toward the horizon
 * by the cells' sides; Welch and Wielicki 1984). The share of a ray that
 * meets a wall first is 1 - e^(-(D / W) / tan e). The cell's depth from its
 * optical depth: tau = (3/2) LWC D / (rho_w r_e) (Stephens 1978), at a
 * marine stratocumulus's mean liquid water 0.3 g/m^3 and droplet radius
 * 10 um (Miles, Verlinde and Clothiaux 2000: 0.2 to 0.4, 8 to 12 um):
 * tau / D = 0.045 per meter. A wall reflects as a layer of the cell's own
 * width in optical depth (0.045 W, thick), lit by the sun at its cosine on
 * the wall (the wall faces the eye) and by half the clear dome.
 */
export const DECK_TAU_PER_M = 1.5 * 0.3e-3 / (1000 * 10e-6);

/**
 * The radiance of the deck along a direction `up` (the sine of its
 * elevation) at `cosSun` from the sun, for a local optical depth tau, with
 * `cosWall` the sun's cosine on a wall that faces the eye (-(sun.x v.x +
 * sun.z v.z), v the view's unit heading) and `cellM` the cells' width:
 *   the base: the scattered light (the Eddington field I0 (1 + 1.5 mu)), the
 *   forward peak's lobe round the sun, and the sky behind the layer through
 *   its forward share along the view (`behind`, the clear sky's radiance in
 *   that direction);
 *   the walls (DECK_TAU_PER_M) over their share of the ray.
 */
export function deckCloudRadiance(up: number, cosSun: number, cosWall: number, tau: number, sunY: number, li: DeckLightIn, behind: V3, cellM: number): V3 {
  const mu0 = Math.max(sunY, 0.05);
  const t = Math.max(tau, 0);
  const tr = deckTransmission(t, mu0);
  const eSunH = lumOf(li.clearE) * li.ratio;
  const upD = Math.max(up, 0.02);
  const viewFwd = Math.exp(-(1 - DECK_G * DECK_G) * t / upD);
  const shape = (1 + 1.5 * Math.max(up, 0)) / (2 * Math.PI);
  const lobe = (eSunH / mu0) * Math.max(tr.forward - tr.direct, 0) * hgPhase(cosSun);
  const tanE = upD / Math.sqrt(Math.max(1 - upD * upD, 1e-6));
  const wallShare = 1 - Math.exp(-(t / DECK_TAU_PER_M / cellM) / tanE);
  const tauWall = DECK_TAU_PER_M * cellM;
  const cw = Math.max(cosWall, 0);
  const rSun = 1 - deckTransmission(tauWall, Math.max(cw, 0.05)).total;
  const rSky = 1 - deckTransmission(tauWall, 2 / 3).total;
  return [0, 1, 2].map((k) => {
    const ed = eSunH * li.sunTint[k] * Math.max(tr.total - tr.forward, 0) + li.clearE[k] * Math.max(tr.skyTotal - tr.skyForward, 0);
    const base = ed * shape + lobe * li.sunTint[k] + behind[k] * viewFwd;
    const wall = ((eSunH / mu0) * cw * rSun * li.sunTint[k] + 0.5 * li.clearE[k] * rSky) / Math.PI;
    return base * (1 - wallShare) + wall * wallShare;
  }) as unknown as V3;
}

/**
 * The air between the eye and the deck along `up`: e^(-k / up), k the deck's
 * base over the air's extinction length (only the ratio enters). The air's
 * own light is the clear sky's air light times `airGain`.
 */
export function deckAirTransmission(up: number, airK: number): number {
  return Math.exp(-airK / Math.max(up, 0.02));
}

/* ------------------------------------------------------------------ */
/* The gamma distribution of the deck's optical depth                    */
/* ------------------------------------------------------------------ */

/** ln Gamma(x), Lanczos (g 7, 9 terms; |relative error| under 1e-13 for x > 0). */
export function lnGamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const xx = x - 1;
  let a = c[0];
  const t = xx + 7.5;
  for (let i = 1; i < 9; i += 1) a += c[i] / (xx + i);
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

/** The regularized lower incomplete gamma P(a, x): the series under a + 1, the continued fraction over it. */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const lg = lnGamma(a);
  if (x < a + 1) {
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n < 500; n += 1) {
      del *= x / (a + n);
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lg);
  }
  // Lentz's continued fraction for Q(a, x).
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lg) * h;
}

/** The q-quantile of a gamma distribution of shape nu and mean `mean` (bisection on P). */
export function gammaQuantile(q: number, nu: number, mean: number): number {
  const theta = mean / nu;
  if (q <= 0) return 0;
  let lo = 0;
  let hi = mean * 50 + 50 * theta;
  for (let k = 0; k < 100; k += 1) {
    const mid = 0.5 * (lo + hi);
    if (gammaP(nu, mid / theta) < q) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/* ------------------------------------------------------------------ */
/* The field of patches                                                  */
/* ------------------------------------------------------------------ */

/** The field's texels a side. */
export const DECK_TEX_N = 256;
/**
 * The field's largest optical depth, the 8-bit texture's full scale: the
 * gamma's 0.999 quantile is clipped here, a share of 1e-3 of the deck.
 */
export const DECK_TAU_MAX = 40;

/** Mulberry32, seeded. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The deck's optical depth per texel, a tileable field n x n: four octaves of
 * smooth value noise (cells of n / 8 texels and three halvings, weights 1,
 * 1/2, 1/4, 1/8), ranked to a uniform share u. A texel with u under
 * 1 - cloudShare is a gap (0); over it, tau is the gamma quantile of
 * (u - (1 - cloudShare)) / cloudShare, so the cover is the clip's share and
 * the deck's optical depth has the gamma law exactly. Seeded: the same sky
 * on every load.
 */
export function deckTauField(cloudShare: number, tauMean: number, nu: number, n = DECK_TEX_N, seed = 0x5c0d): Float32Array {
  const acc = new Float32Array(n * n);
  const r = rng(seed);
  for (let o = 0; o < 4; o += 1) {
    const cells = 8 << o;
    const w = 1 / (1 << o);
    const lat = new Float32Array(cells * cells);
    for (let i = 0; i < lat.length; i += 1) lat[i] = r();
    const step = n / cells;
    for (let y = 0; y < n; y += 1) {
      const fy = y / step;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < n; x += 1) {
        const fx = x / step;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const at = (i: number, j: number) => lat[((j % cells) * cells) + (i % cells)];
        const v = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
        acc[y * n + x] += v * w;
      }
    }
  }
  const order = Array.from(acc.keys()).sort((a, b) => acc[a] - acc[b]);
  const out = new Float32Array(n * n);
  const gap = 1 - cloudShare;
  // The gamma's quantile at 256 steps of the cloud's share, interpolated (the bisection is slow per texel).
  const QN = 256;
  const qTab = new Float64Array(QN + 1);
  for (let k = 0; k <= QN; k += 1) qTab[k] = Math.min(gammaQuantile(Math.min(k / QN, 0.9995), nu, tauMean), DECK_TAU_MAX);
  for (let rank = 0; rank < order.length; rank += 1) {
    const u = (rank + 0.5) / order.length;
    if (u < gap) continue;
    const q = ((u - gap) / cloudShare) * QN;
    const k = Math.min(Math.floor(q), QN - 1);
    out[order[rank]] = qTab[k] + (qTab[k + 1] - qTab[k]) * (q - k);
  }
  return out;
}

/** The deck's geometry: its base height, the field's tile on the ground, and its offset (all meters). */
export interface DeckGeometry {
  readonly baseM: number;
  readonly tileM: number;
  readonly offsetM: readonly [number, number];
}

/** The field's optical depth along a direction (the base's point over the eye), bilinear, the tile wrapping. */
export function deckTauAlong(field: Float32Array, n: number, geo: DeckGeometry, dir: V3): number {
  const up = Math.max(dir[1], 0.02);
  const u = ((dir[0] / up) * geo.baseM + geo.offsetM[0]) / geo.tileM;
  const v = ((dir[2] / up) * geo.baseM + geo.offsetM[1]) / geo.tileM;
  const fx = (u - Math.floor(u)) * n - 0.5;
  const fy = (v - Math.floor(v)) * n - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (i: number, j: number) => field[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

/** The light under the deck, for every lit thing of the place. */
export interface DeckSceneLight {
  /** The sun's unscattered share along its own ray through the field: e^(-tau_sun / mu0). */
  readonly sunDirect: number;
  /** The sun's unscattered share in the field's mean (the gaps' 1 and the cloud's e^(-tau / mu0)): the air's sun. */
  readonly sunDirectMean: number;
  /** The diffuse light on a flat surface over the clear sky's diffuse light. */
  readonly skyGain: number;
  /**
   * The air's light under the deck over the clear day's: the sun through the
   * gaps (the field's mean direct share) and the diffuse gain.
   */
  readonly airGain: number;
  /** The field's optical depth on the sun's ray. */
  readonly tauSun: number;
}

/**
 * The light under the deck. The diffuse gain is the field's mean, texel by
 * texel: a gap passes the clear sky (1); a cloud texel passes the sun's
 * scattered light, ratio (T - e^(-tau / mu0)), and the sky's, skyTotal, over
 * the clear sky's own (the dome as the field's texels, each one equal: the
 * projection's weighting is left out).
 */
export function deckSceneLight(field: Float32Array, n: number, geo: DeckGeometry, sunDir: V3, ratio: number): DeckSceneLight {
  const mu0 = Math.max(sunDir[1], 0.05);
  let sum = 0;
  let dSum = 0;
  for (let i = 0; i < field.length; i += 1) {
    const t = field[i];
    if (t <= 0) { sum += 1; dSum += 1; continue; }
    const tr = deckTransmission(t, mu0);
    sum += ratio * Math.max(tr.total - tr.direct, 0) + tr.skyTotal;
    dSum += tr.direct;
  }
  const skyGain = sum / field.length;
  const sunDirectMean = dSum / field.length;
  const tauSun = deckTauAlong(field, n, geo, sunDir);
  const sunDirect = Math.exp(-tauSun / mu0);
  return { sunDirect, sunDirectMean, skyGain, airGain: (ratio * sunDirectMean + skyGain) / (ratio + 1), tauSun };
}
