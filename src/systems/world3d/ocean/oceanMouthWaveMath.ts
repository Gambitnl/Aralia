/**
 * @file oceanMouthWaveMath.ts
 * The mouth wave laws, breaking, roller coverage and phase-warp calculations.
 * Functions and their scientific notes are retained intact. These CPU laws
 * still feed the same surface and simulation through the compatibility facade.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/10/2026, 02:30:33
 * Dependents: systems/world3d/ocean/oceanMouthCoast.ts, systems/world3d/ocean/oceanMouthJet.ts, systems/world3d/ocean/oceanMouthMath.ts, systems/world3d/ocean/oceanMouthSimulation.ts, systems/world3d/ocean/oceanMouthYoungSea.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type CascadeParams } from './oceanConfig';
import { forcingCascades, G, waveNumberAt, bathyShoalGain, BATHY_BREAK_START, BATHY_BREAK_FULL, BATHY_BORE_GAMMA, BATHY_CREST_TO_HEIGHT, beachToWorld, type BeachFrame } from './oceanBeachMath';
import { jonswapPeakOmega, jonswapS, JONSWAP_GAMMA } from './oceanSpectrum';
import { type MouthBand, type MouthDesign, type BoreMarch, type RollerCoast, type PhaseWarpMap } from './oceanMouthTypes';
import { frictionVelocityMS } from './oceanMouthFineChop';
import { BLOCK_BREAK_R } from './oceanMouthLaws';
import { seabedPointAt } from './oceanSeabedMath';
import { soulsbyWaveFriction } from './oceanMouthTransport';


/**
 * THE WIND-LOCKED BANDS (round 2; the lead's point 2). A wind wave grows at
 * the rate beta = 0.04 (u* / c)^2 omega (Plant 1982), so it regrows from
 * nothing over a GROWTH LENGTH cg / beta. A band whose waves at its center
 * (the geometric mean of its cutoffs) regrow within the channel's width is
 * held in place by the wind: on the river it is the local wind sea, whatever
 * the current does to the sea's waves that come in. u* from the band's wind
 * by the drag law u* = sqrt(Cd) U10, Cd = (0.8 + 0.065 U10) 1e-3 (Wu 1982).
 * On `surf` (12 m/s, u* 0.45 m/s) the ripple band's center, 0.8 m, regrows in
 * 6 m; the chop's, 14 m, in 1.4 km: only the ripple is wind-locked. A band
 * the grid carries is never wind-locked (the grid holds its water).
 */
export function windLockedBands(cascades: readonly CascadeParams[], widthM: number): string[] {
  const forced = forcingCascades(cascades);
  const out: string[] = [];
  for (const c of cascades) {
    if (forced.includes(c.name)) continue;
    const lo = Math.max(c.cutoffLowM, (2 * c.patchM) / 256);
    const lam = Math.sqrt(lo * c.cutoffHighM);
    const k = (2 * Math.PI) / lam;
    const omega = Math.sqrt(G * k);
    const cp = omega / k;
    const ustar = Math.sqrt((0.8 + 0.065 * c.windSpeedMs) * 1e-3) * c.windSpeedMs;
    const beta = 0.04 * (ustar / cp) ** 2 * omega;
    const growM = cp / 2 / beta;
    if (growM < widthM) out.push(c.name);
  }
  return out;
}

/**
 * The period that carries a band's energy: its JONSWAP peak's wavelength
 * clamped into the band's cutoffs, as a deep-water period, s. The same law
 * as `oceanBandPeriodS` in `oceanBathymetry.ts` (a test holds them equal);
 * copied because that module imports three.
 */
export function bandPeriodS(c: CascadeParams): number {
  const w = jonswapPeakOmega(c.windSpeedMs, c.fetchM);
  const lp = (2 * Math.PI * 9.81) / (w * w);
  const l = Math.min(Math.max(lp, Math.max(c.cutoffLowM, 0.1)), c.cutoffHighM);
  return Math.sqrt((2 * Math.PI * l) / 9.81);
}

export function mouthBands(cascades: readonly CascadeParams[], bandHsM: Readonly<Record<string, number>> = {}, widthM = Infinity): MouthBand[] {
  const forced = forcingCascades(cascades);
  const locked = windLockedBands(cascades, widthM);
  return cascades.map((c) => ({
    name: c.name,
    omega: (2 * Math.PI) / bandPeriodS(c),
    depth0M: c.depthM,
    // A cascade's waves travel toward windDirRad + pi in this pipeline
    // (`oceanSeaStates.ts`, NOTE THE SIGN: the e^{+i omega t} factor runs
    // each mode toward -k).
    dirX: -Math.cos(c.windDirRad),
    dirZ: -Math.sin(c.windDirRad),
    forced: forced.includes(c.name),
    cg0MS: groupSpeed((2 * Math.PI) / bandPeriodS(c), c.depthM),
    hsM: bandHsM[c.name] ?? 0,
    local: locked.includes(c.name),
    windMS: c.windSpeedMs,
    localWindMS: c.windSpeedMs,
    fetchM: c.fetchM,
    tailPower: c.tailPower ?? 5,
    // The band's waves, deep water: from its long cutoff to the FFT's two-texel wave.
    omegaLo: Math.sqrt((G * 2 * Math.PI) / Math.max(c.cutoffHighM, 1e-3)),
    omegaHi: Math.sqrt((G * 2 * Math.PI) / Math.max(c.cutoffLowM, (2 * c.patchM) / 256)),
    crestStretch: 1,
  }));
}

/**
 * THE LOCAL WIND SEA ON THE RIVER (round 2; the lead's point 2): a wind-locked
 * band's share of height (h) and of slope (s) where the wind has blown over
 * the river's water for a fetch X only. The short waves' level is set by the
 * wind (the equilibrium range: Phillips 1958; Toba 1973), so it is the sea's
 * own band; the fetch cuts the long side at the young sea's peak
 * omega_p = 22 (U X / g^2)^-0.33 (JONSWAP, Hasselmann et al. 1973, the
 * pipeline's `jonswapPeakOmega`), by the same cutoff the spectrum's low side
 * has, exp(-1.25 (omega_p / omega)^4), relative to the sea's own:
 *   h^2 = Int S C dw / Int S dw,   s^2 = Int w^4 S C dw / Int w^4 S dw
 * over the band (deep water, slope variance k^2 S with k = w^2 / g), S the
 * band's JONSWAP at its own wind and fetch, C the ratio of the two cutoffs.
 * U is the wind relative to the water, |W - U_water|. The peak enhancement
 * (gamma) of the young sea is left out (a young sea's peak is sharper:
 * this under-states h near the peak). Returns 1, 1 for the sea's own fetch.
 * ROUND 3: the young sea's peak enhancement is in: the local spectrum carries
 * gamma^(r_L) at its own peak where the sea's carries gamma^(r_S) at its own
 * (JONSWAP, Hasselmann et al. 1973: gamma 3.3, sigma 0.07 under the peak and
 * 0.09 over it), so the local sea has its peak and its tail, not the sea's
 * tail cut off.
 */
export function localBandShares(b: MouthBand, windRelMS: number, fetchM: number): { h: number; s: number } {
  const wpL = jonswapPeakOmega(Math.max(windRelMS, 0.5), Math.max(fetchM, 0.1));
  const wpS = jonswapPeakOmega(b.windMS, b.fetchM);
  if (wpL <= wpS) return { h: 1, s: 1 };
  /* ROUND 4: THE SHORT WAVES' LEVEL FOLLOWS THE WIND OVER THE WATER (Toba
   * 1973: the equilibrium range F(omega) = alpha_s g u* omega^-4, so its level
   * goes as u*). Rounds 2 and 3 kept the sea's own level whatever the wind
   * over the river; with the place's wind (the clip's, `localWindMS`) and the
   * flow under it the level is u*(W_rel) / u*(W_sea) of the sea's (Wu's drag). */
  const toba = frictionVelocityMS(Math.max(windRelMS, 0.5)) / frictionVelocityMS(b.windMS);
  const n = 96;
  const l0 = Math.log(b.omegaLo);
  const l1 = Math.log(b.omegaHi);
  let m0 = 0;
  let m0c = 0;
  let m4 = 0;
  let m4c = 0;
  for (let k = 0; k < n; k += 1) {
    const w = Math.exp(l0 + ((k + 0.5) / n) * (l1 - l0));
    const dw = w * ((l1 - l0) / n);
    const sv = jonswapS(w, b.windMS, b.fetchM, b.tailPower) * dw;
    const rOf = (wp: number) => { const sg = w <= wp ? 0.07 : 0.09; return Math.exp(-((w - wp) ** 2) / (2 * sg * sg * wp * wp)); };
    const cut = Math.exp(-1.25 * ((wpL / w) ** 4 - (wpS / w) ** 4)) * JONSWAP_GAMMA ** (rOf(wpL) - rOf(wpS));
    m0 += sv;
    m0c += sv * cut;
    m4 += sv * w ** 4;
    m4c += sv * cut * w ** 4;
  }
  return { h: Math.sqrt((toba * m0c) / Math.max(m0, 1e-30)), s: Math.sqrt((toba * m4c) / Math.max(m4, 1e-30)) };
}

/* ------------------------------------------------------------------ */
/* The wave laws (CPU twins of the surface's)                            */
/* ------------------------------------------------------------------ */

/** Linear theory's group speed at angular frequency omega on depth d, m/s (Fenton and McKee 1990, as the bathymetry module). */
export function groupSpeed(omega: number, depthM: number): number {
  const dd = Math.max(depthM, 0.05);
  const k = waveNumberAt(omega, dd);
  const kh = k * dd;
  const nG = 0.5 * (1 + (2 * kh) / Math.sinh(2 * kh));
  return (nG * omega) / k;
}

/**
 * THE CURRENT'S SHARE of a band's height (Bretherton and Garrett 1968, see
 * BLOCK_BREAK_R): r = -U.k / cg. Following (r < 0) the wave stretches and
 * lowers, (1 - r)^(-1/2) under 1; opposing it grows the same way and breaks
 * from r = 0.5 to nothing at r = 1.
 */
export function currentShare(r: number): number {
  if (r >= 1) return 0;
  const grow = 1 / Math.sqrt(1 - r);
  if (r <= BLOCK_BREAK_R) return grow;
  const t = (r - BLOCK_BREAK_R) / (1 - BLOCK_BREAK_R);
  return grow * (1 - t * t * (3 - 2 * t));
}

/**
 * ONE BAND'S SHARE at a point: shoaling from the FFT's own depth to the local
 * sea depth (Ks ratio, Dean and Dalrymple 1991; 1 where the sea is deeper
 * than the FFT's), times the current's share, times the share the grid has
 * not taken (a band the grid carries hands over to it).
 */
export function bandShareCpu(b: MouthBand, seaDepthM: number, uX: number, uZ: number, handover: number): number {
  const tS = (2 * Math.PI) / b.omega;
  const dd = Math.max(seaDepthM, 0.05);
  const ks = dd < b.depth0M ? bathyShoalGain(tS, dd) / bathyShoalGain(tS, b.depth0M) : 1;
  const r = -(uX * b.dirX + uZ * b.dirZ) / groupSpeed(b.omega, dd);
  const cur = currentShare(r);
  return ks * cur * (b.forced ? 1 - handover : 1);
}

/**
 * THE DEPTH HOLDS THE SUMMED FFT HEIGHT (the bathymetry module's laws): a
 * crest or trough |eta| over a sea depth d breaks by the breaking share
 * (H / d from 0.45 to 0.75) toward the height a broken wave keeps,
 * H = 0.55 d. The returned factor multiplies the FFT's displacement; it is 0
 * where the sea depth is 0 (the bed over the mean sea level: the river's
 * water alone carries no sea wave).
 */
/**
 * THE ENVELOPE HOLD (river mouth round 1c, the lead's seam 3): the share of
 * the HORIZONTAL displacement the depth keeps. The broken wave keeps
 * H = 0.55 d (OCEAN_BORE_GAMMA); here H is the local significant height, the
 * bands' Hs times their shares summed in quadrature, so the factor changes
 * only with the depth and the shares, never along one wave. The crest-by-
 * crest hold (`holdShareCpu`) changes with the crest's own height, and on
 * the horizontal displacement it made a fold at the edge of each held crest
 * (a Gerstner wave: J = 1 - k A^2 / H there, against 1 - k A unheld): the
 * folds drew as the navy back faces over the whole coast's sea in round 1b.
 */
export function envelopeHoldCpu(hsLocalM: number, seaDepthM: number): number {
  const d = Math.max(seaDepthM, 0);
  const x = hsLocalM / Math.max(d, 1e-3);
  const t = Math.min(Math.max((x - BATHY_BREAK_START) / (BATHY_BREAK_FULL - BATHY_BREAK_START), 0), 1);
  const brk = t * t * (3 - 2 * t);
  const keep = Math.min(1, (BATHY_BORE_GAMMA * d) / Math.max(hsLocalM, 1e-6));
  return 1 + (keep - 1) * brk;
}

export function holdShareCpu(etaM: number, seaDepthM: number): number {
  const a = Math.abs(etaM);
  if (a <= 1e-9) return seaDepthM > 0 ? 1 : 0;
  const dd = Math.max(seaDepthM, 0);
  const x = (BATHY_CREST_TO_HEIGHT * a) / Math.max(dd, 1e-3);
  const t = Math.min(Math.max((x - BATHY_BREAK_START) / (BATHY_BREAK_FULL - BATHY_BREAK_START), 0), 1);
  const b = t * t * (3 - 2 * t);
  const held = (BATHY_BORE_GAMMA * dd) / BATHY_CREST_TO_HEIGHT;
  const f = Math.min(1, held / a);
  return 1 + (f - 1) * b;
}

/**
 * THE HAND-OVER: the share of the forced bands the grid carries at a cell,
 * 0 at the grid's sea edge (the sea there IS the FFT's) to 1 inward, by a
 * smoothstep over half the shortest forced wave (the chop's 2 m: half a
 * wave hands the height over with no step in its slope). The lateral edges
 * hand back the same way where they stand in the sea.
 */
export function mouthHandoverLengthM(cascades: readonly CascadeParams[]): number {
  const forced = forcingCascades(cascades);
  const shortest = Math.min(...cascades.filter((c) => forced.includes(c.name)).map((c) => Math.max(c.cutoffLowM, 0.5)));
  return shortest / 2;
}

function smooth01(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

/**
 * ROUND 11 (law 1; the lead's ruling 2): THE NEAR FIELD OWNS THE BROKEN WATER. Round 10's swash bar put the grid's
 * sea edge out past the bar's toe (s0 -28) and handed the forced bands over to the grid one hand-over length inside
 * it, so the grid drew the whole surf on the bar's face at its 1 m cells: a first-order scheme with six cells a wave
 * damps an unbroken wave within a few wavelengths, and the surf in front of the mouth drew as a flat dark plate with
 * no breaker (mouth10/shots/f1-mouth-down.png, mouth11/shots/d0-mouth-down.png). A shock-capturing scheme carries
 * BORES (the broken waves of the surf and the swash: Hibberd and Peregrine 1979) at that resolution; an unbroken
 * wave is the FFT's to draw (linear theory, held by the depth). So each row of the grid hands the forced bands over
 * where the edge's waves break in full: the first cell landward of the sea edge whose still depth is at most the
 * edge's rms height over McCowan's index (H / h = 0.78, `depthLimitedBreakShare` at 1), and at the latest the
 * mouth's line (the river's own water is the grid's). Seaward of that line the grid still runs (it forces the bar's
 * sheets with the sea that reaches them) and the FFT draws the water; on a plain coast row the line is the grid's
 * sea edge, as before. `hrmsEdgeM`: per grid row, the rms height the edge is forced at (`MouthSim.edgeBore.hrmsLawM`).
 */
export function mouthHandoverStarts(d: MouthDesign, hrmsEdgeM: ArrayLike<number>): Float64Array {
  const g = d.grid;
  const out = new Float64Array(g.na);
  for (let j = 0; j < g.na; j += 1) {
    const a = g.a0 + (j + 0.5) * g.da;
    const hb = Math.max(hrmsEdgeM[j], 0) / MCCOWAN_GAMMA;
    let s = Math.max(d.mouthS, g.s0);
    for (let i = 0; i < g.ns; i += 1) {
      const sc = g.s0 + (i + 0.5) * g.ds;
      if (sc >= d.mouthS) break;
      const [x, z] = beachToWorld(d.frame, sc, a);
      if (seabedPointAt(d.params, x, z).depthM <= hb) { s = sc - 0.5 * g.ds; break; }
    }
    out[j] = Math.max(s, g.s0);
  }
  return out;
}

/** The hand-over at grid coordinates (s, a). Round 11: `startS` (`mouthHandoverStarts`) is each row's start; absent, the grid's sea edge (rounds 1 to 10). */
export function mouthHandoverAt(d: MouthDesign, blendM: number, s: number, a: number, startS?: ArrayLike<number>): number {
  const g = d.grid;
  const a0 = g.a0;
  const a1 = g.a0 + g.na * g.da;
  const s1 = g.s0 + g.ns * g.ds;
  if (s < g.s0 || s > s1 || a < a0 || a > a1) return 0;
  const sS = startS === undefined ? g.s0 : startS[Math.min(Math.max(Math.floor((a - a0) / g.da), 0), g.na - 1)];
  return smooth01((s - sS) / blendM) * smooth01((a - a0) / blendM) * smooth01((a1 - a) / blendM);
}

/* ------------------------------------------------------------------ */
/* The bore's lean (round 3)                                             */
/* ------------------------------------------------------------------ */

/**
 * THE BORE'S SHAPE BY THE URSELL NUMBER (Ruessink, Ramaekers and van Rijn
 * 2012, Coastal Eng. 65, their eq. 9 to 11, fitted to 30,000 field records):
 * a wave that shoals and breaks loses its sine's shape, its front steepening
 * and its back flattening (the saw-tooth of a bore). With the local Ursell
 * number Ur = (3/8) a k / (k h)^3, a = Hs / 2:
 *   B = 0.857 / (1 + exp((-0.471 - log10 Ur) / 0.297)),
 *   psi = -pi/2 + (pi/2) tanh(0.815 / Ur^0.672),
 * and the asymmetry As = -B sin psi, 0 offshore and up to 0.857 in the surf.
 */
export const RUESSINK_B_MAX = 0.857;
export function ruessinkAsymmetry(ur: number): number {
  const u = Math.max(ur, 1e-9);
  const b = RUESSINK_B_MAX / (1 + Math.exp((-0.471 - Math.log10(u)) / 0.297));
  const psi = -Math.PI / 2 + (Math.PI / 2) * Math.tanh(0.815 / u ** 0.672);
  return -b * Math.sin(psi);
}

/**
 * THE LEAN THAT GIVES A SINE THAT ASYMMETRY: the surface leans forward along
 * the band's heading, a point moving by kappa eta. To first order the profile
 * gains a second harmonic, eta = a cos t + b sin 2t with b = kappa k a^2 / 2,
 * whose asymmetry (Hilbert skewness, <H(eta)^3> / <eta^2>^1.5) is 2.12 b / a;
 * so kappa = As / (1.06 k a). Along the heading the leaned slope is
 * sd / (1 - kappa sd), and kappa sd stays under As / 1.06 <= 0.81 on a sine
 * of amplitude a: the lean never folds the surface.
 */
export const LEAN_PER_ASYMMETRY = 1.06;

/** The lean table's depth range and texels: depth 0 to LEAN_TABLE_DEPTH_M on LEAN_TABLE_N texels. */
export const LEAN_TABLE_DEPTH_M = 16;
export const LEAN_TABLE_N = 256;

/**
 * Each band's lean kappa (1/m) by the still-water depth, for the coast's sea:
 * the band's offshore Hs shoaled to the depth (energy flux, `bandShareCpu`
 * with no current) and the sum held by the depth (`envelopeHoldCpu`, H =
 * 0.55 d in the surf), the Ursell number at the band's own period, and
 * kappa = As / (1.06 k a). 0 for a band the grid does not force (the ripple
 * keeps its own shape) and at depth 0. Row-major RGBA, cascade i in channel i.
 */
export function boreLeanTable(bands: readonly MouthBand[]): Float32Array {
  const out = new Float32Array(LEAN_TABLE_N * 4);
  for (let t = 0; t < LEAN_TABLE_N; t += 1) {
    const d = ((t + 0.5) / LEAN_TABLE_N) * LEAN_TABLE_DEPTH_M;
    const hsB = bands.map((b) => (b.forced ? b.hsM * bandShareCpu(b, d, 0, 0, 0) : 0));
    const hsLoc = Math.sqrt(hsB.reduce((s, h) => s + h * h, 0));
    const keep = envelopeHoldCpu(hsLoc, d);
    for (let ci = 0; ci < Math.min(bands.length, 4); ci += 1) {
      const b = bands[ci];
      if (!b.forced || hsB[ci] <= 0) continue;
      const a = (hsB[ci] * keep) / 2;
      if (a <= 1e-4) continue;
      const k = waveNumberAt(b.omega, d);
      const ur = (0.375 * a * k) / (k * d) ** 3;
      out[t * 4 + ci] = ruessinkAsymmetry(ur) / (LEAN_PER_ASYMMETRY * k * a);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The river's fetch-limited ripple: its spread (round 3)                */
/* ------------------------------------------------------------------ */

/**
 * THE DIRECTIONAL SPREAD OF A WIND SEA (Donelan, Hamilton and Hui 1985; Banner
 * 1990 above 1.6 times the peak): D(theta) = (beta / 2) sech^2(beta theta),
 *   beta = 2.61 r^1.3 (0.56 < r < 0.95), 2.28 r^-1.3 (0.95 < r < 1.6),
 *   10^(-0.4 + 0.8393 exp(-0.567 ln(r^2))) above, r = omega / omega_p.
 * A wave near its sea's peak is narrow in direction; far above the peak it is
 * broad. Half the energy lies within atanh(1/2) / beta = 0.549 / beta of the
 * heading (the sech^2 law's integral is tanh(beta theta)), and at most within
 * pi / 4: the isotropic limit.
 */
export function donelanBeta(r: number): number {
  const rr = Math.max(r, 0.56);
  if (rr < 0.95) return 2.61 * rr ** 1.3;
  if (rr < 1.6) return 2.28 * rr ** -1.3;
  return 10 ** (-0.4 + 0.8393 * Math.exp(-0.567 * Math.log(rr * rr)));
}
export const SECH2_HALF_ENERGY = Math.atanh(0.5);
export function halfEnergyAngle(beta: number): number {
  return Math.min(SECH2_HALF_ENERGY / Math.max(beta, 1e-6), Math.PI / 4);
}

/** The band's slope-carrying angular frequency: the mean of omega under omega^4 S (deep water), rad/s. */
export function bandSlopeOmega(b: MouthBand, windMS = b.windMS, fetchM = b.fetchM): number {
  const n = 96;
  const l0 = Math.log(b.omegaLo);
  const l1 = Math.log(b.omegaHi);
  let m4 = 0;
  let m5 = 0;
  for (let k = 0; k < n; k += 1) {
    const w = Math.exp(l0 + ((k + 0.5) / n) * (l1 - l0));
    const dw = w * ((l1 - l0) / n);
    const s = jonswapS(w, windMS, fetchM, b.tailPower) * dw;
    m4 += s * w ** 4;
    m5 += s * w ** 5;
  }
  return m4 > 0 ? m5 / m4 : Math.sqrt(b.omegaLo * b.omegaHi);
}

/**
 * THE RIVER'S RIPPLE IS LONG-CRESTED (round 3; the lead's point 3). On the
 * river the wind-locked band is the local wind sea at the fetch over the
 * water (`localBandShares`), whose peak stands near the band's own waves, so
 * by Donelan's law its spread is narrow; the FFT's band is the open sea's,
 * whose peak lies far below it, so it is broad: short-crested blobs where the
 * clip shows long crests across the current (round 2's highlights: 9 px
 * across against the clip's 28). The FFT cannot change its spectrum per
 * place, so on the river its field is read stretched along the crests by
 *   S = tan(theta_sea) / tan(theta_local),
 * theta the half-energy angles (`halfEnergyAngle`) at the band's slope-carrying frequency
 * (`bandSlopeOmega`) against the sea's peak and the local sea's peak (the
 * JONSWAP peak at the river's fetch, `jonswapPeakOmega`): a random field
 * f(x_wind, x_crest / S) keeps its spectrum along the heading and squeezes
 * the cross-heading wave numbers by S (tan theta' = tan theta / S), so the
 * half-energy angle narrows from theta_sea to theta_local. 1 where the fetch
 * is the sea's own.
 */
export function crestStretchOf(b: MouthBand, localFetchM: number): number {
  if (!b.local || !(localFetchM < b.fetchM)) return 1;
  const wp = jonswapPeakOmega(b.windMS, b.fetchM);
  const wpL = jonswapPeakOmega(b.localWindMS, Math.max(localFetchM, 0.1));
  const ws = bandSlopeOmega(b);
  const tSea = halfEnergyAngle(donelanBeta(ws / wp));
  const tLoc = halfEnergyAngle(donelanBeta(ws / wpL));
  return Math.max(Math.tan(tSea) / Math.tan(tLoc), 1);
}

/* ------------------------------------------------------------------ */
/* The reflected ray's occlusion (round 3; the surface's CPU twin)       */
/* ------------------------------------------------------------------ */

/** erfc(x) for x >= 0, Abramowitz and Stegun 7.1.26 (|error| under 1.5e-7): the surface's own form. */
export function erfcAS(x: number): number {
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const e = p * Math.exp(-ax * ax);
  return x >= 0 ? e : 2 - e;
}

/**
 * THE SHARE OF A PIXEL'S REFLECTED RAYS THE WATER STOPS (oceanSurface.ts, the
 * river page's reflection; round 3). The ray from the shaded normal climbs
 * `elev` (the sine of its elevation); the pixel's unresolved facets spread it
 * as N(elev, s), s = 2 sigmaU (a facet tilt d turns the ray by 2 d; Cox and
 * Munk's Gaussian sea): Phi(-elev / s) of them dip under the horizon, and the
 * rest meet the waves ahead at their mean elevation e+ = elev + s phi(z) /
 * Phi(z) (z = elev / s) with Smith's (1967) shadowing of a Gaussian sea of
 * slope spread sigmaTotal per axis: G = 1 / (1 + L), L = (e^(-nu^2) /
 * (nu sqrt(pi)) - erfc(nu)) / 2, nu = tan(e+) / (sqrt(2) sigmaTotal).
 */
export function reflectedStoppedShareCpu(elev: number, sigmaTotal: number, sigmaU: number): number {
  const s = Math.max(sigmaU, 1e-3) * 2;
  const pBelow = 0.5 * erfcAS(elev / (s * Math.SQRT2));
  const z = elev / s;
  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const eUp = Math.max(elev + (s * phi) / Math.max(1 - pBelow, 1e-4), 0);
  const tanE = eUp / Math.sqrt(Math.max(1 - eUp * eUp, 1e-6));
  const nu = Math.max(tanE / (Math.max(sigmaTotal, 1e-3) * Math.SQRT2), 1e-4);
  const lam = Math.max(0.5 * (Math.exp(-nu * nu) / (nu * Math.sqrt(Math.PI)) - erfcAS(nu)), 0);
  const ahead = 1 - 1 / (1 + lam);
  return pBelow + (1 - pBelow) * ahead;
}
/**
 * ROUND 10 (law 1): THE SWASH BAR'S CREST over the mean sea level, m (see "THE TIDE AND THE SWASH BAR" in
 * `deriveMouthDesign`): the low water plus the swash zone's mean water over it, Stockdon et al.'s (2006) setup in
 * its dissipative form, 0.016 sqrt(H0 L0) (H0 the deep sea's significant height, L0 its peak's deep wavelength, the
 * coast's run-up inputs, `deriveSurfCoast`). A swash bar's top is a broad flat platform (Masselink et al. 2006),
 * so its swash is the infragravity swash of a dissipative face, whatever the lobe's flanks. The slope form
 * (0.35 beta sqrt(H0 L0)) on the lobe's own face has no fixed point here: the face steepens as the crest rises and
 * its setup grows faster (a test holds that). On the surf sea: 0.40 m over the low water.
 */
export const STOCKDON_DISSIPATIVE_SETUP = 0.016;
export function swashBarCrestM(o: { tideM: number; hsM: number; tpS: number }): number {
  const l0 = (G * o.tpS * o.tpS) / (2 * Math.PI);
  return o.tideM + STOCKDON_DISSIPATIVE_SETUP * Math.sqrt(o.hsM * l0);
}

/**
 * BATTJES AND JANSSEN (1978): THE RANDOM WAVES' ENERGY ACROSS A SURF ZONE.
 * River mouth round 3 forced the near field's sea edge with the FFT sea's
 * modes shoaled to the edge's still depth and only the crests held: on the
 * Sarcelle's 0.72 m edge that series stood at Hs 2.42 m with troughs to
 * -2.65 m (mouth4/probeBore0.ts), a sea of 2.4 m in 0.7 m of water, and the
 * near field carried it up the channel at Hs 0.7 m in 1.3 m of water. A sea
 * of 2.4 m cannot reach the mouth: it breaks over the shelf and over the bar
 * first, and what passes is a train of bores. The law for the bores' height
 * is the energy balance of a random breaking sea (Battjes and Janssen 1978),
 * marched along the waves' path:
 *   d/dx [ E (cg + U) / sigma ] = -(D_b + D_f) / sigma          (wave action,
 *     Bretherton and Garrett 1968, with the current U along the path),
 *   E = rho g Hrms^2 / 8,
 *   D_b = (alpha / 4) rho g f Q_b Hm^2   (the bores' dissipation, alpha = 1),
 *   Hm = (0.88 / k) tanh(gamma k h / 0.88)   (Miche's limit),
 *   (1 - Q_b) / ln Q_b = -(Hrms / Hm)^2   (the share of broken waves),
 *   gamma = 0.5 + 0.4 tanh(33 s0), s0 = Hrms0 / L0   (Battjes and Stive 1985),
 *   D_f = (2 / (3 pi)) rho fw ub^3   (the bed's friction over one wave,
 *     Jonsson 1966; ub = pi Hrms / (T sinh k h), fw Soulsby's, the coast's
 *     sand),
 * with the intrinsic frequency sigma = omega - k U and sigma^2 = g k tanh(k h).
 * f = 1 / T and the period T the sea's zero-crossing period (the coast's Tz:
 * one representative period, as Battjes and Janssen's model takes it).
 */
export const BJ_ALPHA = 1;
/** Battjes and Stive (1985): the breaker index of the random sea from its deep-water steepness. */
export function battjesStiveGamma(hrms0M: number, tS: number): number {
  const l0 = (G * tS * tS) / (2 * Math.PI);
  return 0.5 + 0.4 * Math.tanh((33 * hrms0M) / l0);
}
/** The share of broken waves Q_b (Battjes and Janssen 1978) for b = Hrms / Hm: the root of (1 - Q) / ln Q = -b^2. */
export function bjBreakFraction(b: number): number {
  if (!(b > 0)) return 0;
  if (b >= 1) return 1;
  // f(Q) = 1 - Q + b^2 ln Q has the trivial root Q = 1 and the wanted one under its maximum at Q = b^2:
  // f < 0 near 0, f(b^2) > 0. Bisection in log Q.
  let lo = -700;
  let hi = Math.log(b * b);
  const f = (l: number) => 1 - Math.exp(l) + b * b * l;
  for (let k = 0; k < 200; k += 1) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) < 0) lo = mid; else hi = mid;
    if (hi - lo < 1e-14) break;
  }
  return Math.exp(0.5 * (lo + hi));
}
/**
 * The wave number of absolute frequency omega on depth h with a current U
 * along the wave's path (m/s; negative opposes it): the root of
 * (omega - k U)^2 = g k tanh(k h) on the branch sigma > 0. NaN where the
 * current blocks the wave (no root with cg + U > 0).
 */
export function waveNumberOnCurrent(omega: number, depthM: number, uMS: number): number {
  const h = Math.max(depthM, 0.05);
  let k = waveNumberAt(omega, h);
  for (let it = 0; it < 80; it += 1) {
    const th = Math.tanh(k * h);
    const sig = Math.sqrt(G * k * th);
    const f = omega - k * uMS - sig;
    const dsig = (G * th + G * k * h * (1 - th * th)) / (2 * Math.max(sig, 1e-9));
    const df = -uMS - dsig;
    if (Math.abs(df) < 1e-12) return NaN;
    let kn = k - f / df;
    if (!(kn > 0)) kn = k / 2;
    if (Math.abs(kn - k) < 1e-10 * k) { k = kn; break; }
    k = kn;
  }
  const sig = omega - k * uMS;
  if (!(sig > 0)) return NaN;
  // No root (the current past the blocking point): Newton wanders; refuse what is not a root.
  if (Math.abs(sig - Math.sqrt(G * k * Math.tanh(k * h))) > 1e-6 * omega) return NaN;
  const kh = k * h;
  const cg = (sig / k) * 0.5 * (1 + (2 * kh) / Math.sinh(Math.min(2 * kh, 700)));
  return cg + uMS > 1e-3 ? k : NaN;
}

/**
 * MARCH THE BJ BALANCE along a path (see above): from hrms0M at xs[0] on
 * depth[0], depth, current and step per sample. Second-order (Heun) steps.
 * Where the current blocks the wave the height falls to 0 and stays there.
 * `gamma` absent: Battjes and Stive's from `deepHrmsM` (the deep-water rms
 * height; default hrms0M).
 */
export function battjesJanssenMarch(o: {
  xM: ArrayLike<number>;
  depthM: ArrayLike<number>;
  currentMS?: ArrayLike<number>;
  hrms0M: number;
  tS: number;
  d50M: number;
  gamma?: number;
  deepHrmsM?: number;
}): BoreMarch {
  const n = o.xM.length;
  const omega = (2 * Math.PI) / o.tS;
  const f = 1 / o.tS;
  const gamma = o.gamma ?? battjesStiveGamma(o.deepHrmsM ?? o.hrms0M, o.tS);
  const xs = Float64Array.from(o.xM as ArrayLike<number>);
  const hrms = new Float64Array(n);
  const qb = new Float64Array(n);
  const cgU = new Float64Array(n);
  // Per sample: k, sigma, cg + U; the dissipation per rho g at an Hrms.
  const kin = (i: number) => {
    const h = Math.max(o.depthM[i], 0.05);
    const u = o.currentMS ? o.currentMS[i] : 0;
    const k = waveNumberOnCurrent(omega, h, u);
    if (!(k > 0)) return null;
    const sig = omega - k * u;
    const kh = k * h;
    const cg = (sig / k) * 0.5 * (1 + (2 * kh) / Math.sinh(Math.min(2 * kh, 700)));
    return { h, k, sig, cgu: cg + u, kh };
  };
  const diss = (kk: { h: number; k: number; kh: number }, hr: number): { d: number; q: number } => {
    const hm = (0.88 / kk.k) * Math.tanh((gamma * kk.k * kk.h) / 0.88);
    const q = bjBreakFraction(hr / Math.max(hm, 1e-6));
    const db = (BJ_ALPHA / 4) * f * q * hm * hm;
    const ub = (Math.PI * hr) / (o.tS * Math.sinh(Math.min(kk.kh, 20)));
    const fw = Math.min(soulsbyWaveFriction(ub, o.tS, o.d50M), 0.3);
    const df = ((2 / (3 * Math.PI)) * fw * ub * ub * ub) / G;
    return { d: db + df, q };
  };
  let k0 = kin(0);
  if (!k0) { return { xM: xs, hrmsM: hrms, qb, cgU, gamma }; }
  hrms[0] = o.hrms0M;
  cgU[0] = k0.cgu;
  // The action flux per rho g: A = (Hrms^2 / 8) (cg + U) / sigma.
  let a = ((o.hrms0M * o.hrms0M) / 8) * (k0.cgu / k0.sig);
  qb[0] = diss(k0, o.hrms0M).q;
  let blocked = false;
  for (let i = 0; i + 1 < n; i += 1) {
    const k1 = kin(i + 1);
    if (blocked || !k0 || !k1) { blocked = true; hrms[i + 1] = 0; qb[i + 1] = 0; cgU[i + 1] = k1 ? k1.cgu : 0; continue; }
    const dx = xs[i + 1] - xs[i];
    const hOf = (aa: number, kk: { sig: number; cgu: number }) => Math.sqrt(Math.max((8 * aa * kk.sig) / kk.cgu, 0));
    const d0 = diss(k0, hrms[i]).d / k0.sig;
    const aP = Math.max(a - dx * d0, 0);
    const d1 = diss(k1, hOf(aP, k1)).d / k1.sig;
    a = Math.max(a - 0.5 * dx * (d0 + d1), 0);
    hrms[i + 1] = hOf(a, k1);
    qb[i + 1] = diss(k1, hrms[i + 1]).q;
    cgU[i + 1] = k1.cgu;
    k0 = k1;
  }
  return { xM: xs, hrmsM: hrms, qb, cgU, gamma };
}

/** The step of the edge's march, m. */
export const MOUTH_BORE_STEP_M = 0.5;

/**
 * THE YOUNG SEA HAS NO LONG WAVES (river mouth round 4, the lead's point 1:
 * "one glossy, smeared, large-amplitude wave field"). On the near field the
 * wind-locked band is the local sea at the channel's fetch, whose spectrum
 * stops at its peak (JONSWAP's exp(-1.25 (omega_p / omega)^4); 0.78 m on the
 * Sarcelle's 117 m). Rounds 2 and 3 scaled the open sea's band as a whole by
 * the slope share `rippleS`: the band's 1 to 6.5 m waves, which only the open
 * sea's 50 km fetch grows, stayed at two thirds of their slope and drew the
 * river's surface as broad glossy swells (the bisect: mouth4/shots/bv2, the
 * fine chop off). The cut takes them out: the surface reads the band's mean
 * slope over a box of half the local peak's wavelength (the normal mip's own
 * average, a low-pass that keeps the waves longer than about the peak) and
 * subtracts it, which leaves the waves shorter than the peak. The gain
 * 1 / sqrt(f) (f the share of the band's slope variance shorter than the
 * peak, on the band's own JONSWAP) gives the rest the band's variance back,
 * so `rippleS` still sets the drawn slope variance: the share keeps its law,
 * and the spectrum now has the young sea's shape.
 */
export function localPeakCut(b: MouthBand, localFetchM: number): { cutM: number; gain: number } | null {
  if (!b.local || !(localFetchM < b.fetchM)) return null;
  const wpL = jonswapPeakOmega(b.localWindMS, Math.max(localFetchM, 0.1));
  const lamP = (2 * Math.PI * G) / (wpL * wpL);
  const n = 160;
  const l0 = Math.log(b.omegaLo);
  const l1 = Math.log(b.omegaHi);
  let all = 0;
  let short = 0;
  for (let k = 0; k < n; k += 1) {
    const w = Math.exp(l0 + ((k + 0.5) / n) * (l1 - l0));
    const v = jonswapS(w, b.windMS, b.fetchM, b.tailPower) * w ** 5;
    all += v;
    if (w > wpL) short += v;
  }
  const f = short / Math.max(all, 1e-30);
  return { cutM: lamP / 2, gain: 1 / Math.sqrt(Math.max(f, 1e-3)) };
}

/* ------------------------------------------------------------------ */
/* Round 7: the break line's coverage from the roller's dissipation       */
/* ------------------------------------------------------------------ */

/**
 * THE ROLLER'S AREA PER CREST (river mouth round 7, law 1a). A broken crest
 * carries a roller of aerated water down its front face. Svendsen (1984): its
 * cross-section is A_r = 0.9 H^2. Duncan (1981), from towed breakers: the
 * roller's cross-section is A_r = 0.11 L_r^2 along the face. The two give the
 * roller's length on the face, L_r = sqrt(0.9 / 0.11) H = 2.86 H. The white
 * water a crest carries is that length of its face, not the whole front face
 * (round 3 to 6) and not a fixed share.
 */
export const SVENDSEN_ROLLER_AREA_PER_H2 = 0.9;
export const DUNCAN_ROLLER_AREA_PER_L2 = 0.11;
export const ROLLER_LENGTH_PER_H = Math.sqrt(SVENDSEN_ROLLER_AREA_PER_H2 / DUNCAN_ROLLER_AREA_PER_L2);

export function rollerCoastOf(d: { hsM: number; tzS: number }): RollerCoast {
  const omega = (2 * Math.PI) / d.tzS;
  const hrmsDeepM = d.hsM / Math.SQRT2;
  return { tS: d.tzS, k0: (omega * omega) / G, gamma: battjesStiveGamma(hrmsDeepM, d.tzS), hrmsDeepM };
}

/** Fenton and McKee's (1990) explicit wave number on depth h, 1/m: k0 / tanh((k0 h)^(3/4))^(2/3). The GPU's form. */
export function fentonMcKeeK(k0: number, depthM: number): number {
  const h = Math.max(depthM, 0.05);
  return k0 / Math.tanh((k0 * h) ** 0.75) ** (2 / 3);
}

/**
 * THE ROLLER ON DEPTH h (law 1a): the local wave number k, Battjes and
 * Janssen's highest wave H_m = (0.88 / k) tanh(gamma k h / 0.88) (the broken
 * wave's height: their model's breaking waves all stand at H_m), the roller's
 * length L_r = 2.86 H_m, its phase span theta_r = k L_r (rad, held to pi) and
 * its share of the wave's length, theta_r / (2 pi). The mean share of the sea
 * that active rollers cover is Q_b times that share (`rollerMeanCoverage`):
 * the coverage follows the dissipation, D = (alpha / 4) rho g f Q_b H_m^2 is
 * carried by the rollers whose area is 0.9 H_m^2 a crest.
 */
export function rollerOnDepth(depthM: number, rc: RollerCoast): { kM: number; hmM: number; lrM: number; thetaR: number; phaseShare: number } {
  const h = Math.max(depthM, 0.05);
  const k = fentonMcKeeK(rc.k0, h);
  const hm = (0.88 / k) * Math.tanh((rc.gamma * k * h) / 0.88);
  const lr = ROLLER_LENGTH_PER_H * hm;
  const thetaR = Math.min(k * lr, Math.PI);
  return { kM: k, hmM: hm, lrM: lr, thetaR, phaseShare: thetaR / (2 * Math.PI) };
}

/** The mean share of the sea's surface under an active roller where Q_b of the waves break (law 1a). */
export function rollerMeanCoverage(qb: number, depthM: number, rc: RollerCoast): number {
  return Math.min(Math.max(qb, 0), 1) * rollerOnDepth(depthM, rc).phaseShare;
}

/**
 * THE ROLLER'S SOURCE AT A POINT (law 1, the foam source's CPU twin,
 * oceanMouth.ts). From the raw FFT sea at the point: the forced bands'
 * elevation eta and the analytic signal's quadrature q (each band's slope down
 * its heading over its own wave number: positive on a front face). The
 * point's wave: amplitude A = sqrt(eta^2 + q^2), height 2 A (the deep sea's
 * Rayleigh scale), phase past the crest theta = atan2(q, eta). The wave breaks when its height passes H_q = Hrms sqrt(-ln Q_b)
 * (law 1b: the top Q_b of a Rayleigh record; the envelope is the wave group's,
 * so a whole crest along the group breaks, and every crest of a group over
 * H_q breaks at once), over the bathymetry index's band (0.6 H_q to H_q). Its
 * roller covers the front face from the crest to theta_r (`rollerOnDepth`),
 * with an edge over the last fifth. Returns the strength, 0 to 1.
 */
export function rollerSourceCpu(etaM: number, quadM: number, depthM: number, qb: number, rc: RollerCoast, breakStart = 0.6): number {
  if (!(qb > 1e-4) || !(quadM >= 0)) return 0;
  const a = Math.hypot(etaM, quadM);
  if (!(a > 1e-6)) return 0;
  const hq = rc.hrmsDeepM * Math.sqrt(-Math.log(Math.min(Math.max(qb, 1e-6), 1)));
  const ss = (e0: number, e1: number, x: number) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };
  const breaks = ss(hq * breakStart, hq + 1e-4, 2 * a);
  const { thetaR } = rollerOnDepth(depthM, rc);
  const cosT = etaM / a;
  const onRoller = ss(Math.cos(thetaR), Math.cos(0.8 * thetaR), cosT);
  return breaks * onRoller;
}

/* ------------------------------------------------------------------ */
/* Round 7: the sea's reflectance at grazing, by its slopes               */
/* ------------------------------------------------------------------ */

/**
 * THE EFFECTIVE FRESNEL REFLECTANCE OF A ROUGH SEA (law 2; the CPU twin of
 * oceanSurface.ts `riverFresnelPair`, the same rule and taps). sinE: the
 * sine of the mean grazing angle; sigma: the slope's spread per axis (Cox and
 * Munk's Gaussian). The facets are weighted by their area projected on the
 * view (sin e + s cos e); their incidence cos i = (sin e + s cos e) /
 * sqrt(1 + s^2 + sigma^2); Fresnel in Schlick's form, F0 0.02. Returns the
 * weighted mean (the law) and the plain mean over the facets that face the
 * eye (what per-pixel shading of a normal map draws).
 */
export function effectiveFresnelCpu(sinE: number, sigma: number, taps = 14, span = 3.5): { weighted: number; plain: number } {
  const se = Math.min(Math.max(sinE, -1), 1);
  const ce = Math.sqrt(Math.max(1 - se * se, 0));
  let sw = 0; let swf = 0; let sv = 0; let svf = 0;
  for (let k = 0; k < taps; k += 1) {
    const z = -span + ((k + 0.5) * 2 * span) / taps;
    const pz = Math.exp(-0.5 * z * z);
    const s = sigma * z;
    const proj = se + s * ce;
    const c = Math.min(Math.max(proj / Math.sqrt(1 + s * s + sigma * sigma), 0), 1);
    const f = 0.02 + 0.98 * (1 - c) ** 5;
    const w = Math.max(proj, 0) * pz;
    const v = (proj >= 0 ? 1 : 0) * pz;
    sw += w; swf += w * f; sv += v; svf += v * f;
  }
  // Round 8: where no facet faces the eye the limit is grazing incidence, Fresnel 1 (the surface's own form).
  return { weighted: (swf + 1e-6) / (sw + 1e-6), plain: (svf + 1e-6) / (sv + 1e-6) };
}

/** The number of directions the slanting-fetch spread is summed over, across the half plane about the heading. */
export const SLANT_FETCH_DIRS = 31;

/**
 * THE LOCAL SEA'S SPREAD BY THE FETCH IN EACH DIRECTION (law 3; GG-395's open
 * item from round 3). A wind sea in a channel grows in each direction theta
 * (from the band's heading) under the wind over the fetch the water gives
 * that direction, X(theta) (Donelan, Hamilton
 * and Hui 1985: the "slanting fetch"; Pettersson, Kahma and Tuomi 2010 for
 * narrow fetch geometries): E(theta) = S_J(omega_s; U, X(theta)) times
 * Donelan's sech^2 spread at that direction's own peak. Across a 40 m channel
 * the directions off its axis have a few tens of meters of water, and at the
 * band's slope-carrying frequency (`bandSlopeOmega`) a sea that young holds
 * almost nothing, so the spread narrows round the axis and the crests run
 * long across the current. The half-energy angle about the heading gives the
 * crest stretch S = tan(theta_sea) / tan(theta_local), as `crestStretchOf`
 * does for one fetch (the same S where every direction has the sea's fetch).
 */
export function slantFetchStretch(b: MouthBand, fetchAt: (thetaRad: number) => number): { stretch: number; thetaHalf: number } {
  if (!b.local) return { stretch: 1, thetaHalf: Math.PI / 4 };
  const ws = bandSlopeOmega(b);
  const n = SLANT_FETCH_DIRS;
  const th: number[] = [];
  const e: number[] = [];
  let tot = 0;
  for (let k = 0; k < n; k += 1) {
    const t = -Math.PI / 2 + ((k + 0.5) * Math.PI) / n;
    // The wind's own speed in every direction: Donelan's spread is measured about the wind at the full
    // wind speed, so the direction's share is the spread's; only the fetch changes with the direction.
    const u = b.localWindMS;
    let v = 0;
    if (Math.abs(t) < Math.PI / 2) {
      const x = Math.max(fetchAt(t), 0.1);
      const wp = jonswapPeakOmega(u, x);
      const beta = donelanBeta(ws / wp);
      const sech = 1 / Math.cosh(beta * t);
      v = jonswapS(ws, u, x, b.tailPower) * 0.5 * beta * sech * sech;
    }
    th.push(t);
    e.push(v);
    tot += v;
  }
  const tSea = halfEnergyAngle(donelanBeta(ws / jonswapPeakOmega(b.windMS, b.fetchM)));
  if (!(tot > 0)) return { stretch: 1, thetaHalf: tSea };
  // The half-energy angle about the heading: the smallest |theta| holding half of it.
  const idx = th.map((_, i) => i).sort((p, q) => Math.abs(th[p]) - Math.abs(th[q]));
  let acc = 0;
  let thetaHalf = Math.PI / 2;
  for (const i of idx) {
    acc += e[i];
    if (acc >= 0.5 * tot) { thetaHalf = Math.abs(th[i]); break; }
  }
  thetaHalf = Math.min(Math.max(thetaHalf, (0.5 * Math.PI) / n), Math.PI / 4);
  return { stretch: Math.max(Math.tan(tSea) / Math.tan(thetaHalf), 1), thetaHalf };
}

/* ------------------------------------------------------------------ */
/* River mouth round 8                                                   */
/* ------------------------------------------------------------------ */

/**
 * ROUND 8, LAW 1: THE FILM ENDS AT THE FRONT. The river's film (`filmSlick`) is
 * an insoluble surface layer: it does not mix down, it rides the surface water,
 * and where the plume's surface water meets the sea's the surface converges
 * (Garvine 1974), so the film is held against the front and stops there. Rounds
 * 5 to 7 gave the film the river water's SHARE (0 to 1), so it thinned with the
 * share across the plume's whole shoulder, and at the eye no slick/rough edge
 * showed. Now the film is whole where the surface water is mostly the river's
 * and absent past it: the front is the drawn river share's half value
 * (PLUME_FRONT_SHARE; the jet's own front, `JetPoint.gc` 0.5, where the axis is
 * all river water; round 2's color front is the same half-change), one law on
 * the near field (the solver's tracer) and on the plume (the jet's share times
 * the sea's takeover). So the slick is a tongue: on the Sarcelle 15 to 25 m each
 * side of the axis, ending where the axis share falls to 0.5, about 190 m out
 * (mouth8/probe/probeTip8.ts); the front's eddies (`frontEddyShiftM`) move its
 * edge, because the reader shifts the point before it reads the plume. A first
 * build ended the film at the scalar's half value across the jet only (whatever
 * the axis share), so it ran out to the plume's 6.8 km reach and drew a black
 * line of pixels at the horizon (mouth8/eye/b0-f1-band.png).
 */
export const PLUME_FRONT_SHARE = 0.5;
/** The film at a river share (the reader's twin, the vertex): 1 where the surface water is at least half the river's. */
export function riverFilmAt(riverShare: number): number {
  return riverShare >= PLUME_FRONT_SHARE ? 1 : 0;
}

/**
 * ROUND 8, LAW 2: THE BREAKING ON THE BAR IS DEPTH-LIMITED. The mouth's source
 * broke a crest where its group's envelope (the forced bands' analytic signal,
 * on the deep sea's Rayleigh scale) passed H_q = Hrms sqrt(-ln Q_b) (round 7):
 * the top Q_b of the record, in groups. That holds where the breaking is
 * selective (the outer surf, where only the highest waves of a group reach the
 * depth limit). Where the local record itself stands at the depth limit the surf
 * is SATURATED: every crest that arrives is held at H = gamma h and breaks,
 * whatever its group was offshore (the inner surf's height is set by the depth,
 * not by the offshore height: Thornton and Guza 1982; Battjes and Janssen's
 * own Q_b goes to 1 as Hrms reaches the breaker height H_m). The saturation is
 * the record's rms height over McCowan's (1894) limit, r = Hrms / (gamma h),
 * gamma = 0.78; the share of crests that break whatever their phase in the
 * group rises over the bathymetry module's breaking band, from
 * BATHY_BREAK_START / BATHY_BREAK_FULL (0.6) of the limit to all of it.
 * Hrms is the Battjes and Janssen march over the coast's floor
 * (`coastStirredColumns.hrmsM`, the bar and the valley in it), so the rule acts
 * where the floor makes it: on the bar's crest (h 0.61 to 0.70 m on the axis,
 * r 0.84 to 1.03), and not in the two channels at its flanks (r 0.39 to 0.56) nor
 * on the outer shelf (h 1.5 to 2.8 m, r 0.51 to 0.65).
 */
export const MCCOWAN_GAMMA = 0.78;
export function depthLimitedBreakShare(hrmsM: number, depthM: number): number {
  if (!(depthM > 0.02) || !(hrmsM > 0)) return 0;
  const r = hrmsM / (MCCOWAN_GAMMA * depthM);
  const r0 = BATHY_BREAK_START / BATHY_BREAK_FULL;
  const t = Math.min(Math.max((r - r0) / (1 - r0), 0), 1);
  return t * t * (3 - 2 * t);
}
/**
 * The source's phase-free breaking share at a point (the CPU twin of the GPU's
 * `fq`, oceanMouth.ts): the larger of the group rule (round 7: the envelope
 * height hEnv over H_q's ramp) and the depth-limited share (above).
 */
export function sourceBreakingShareCpu(o: { hEnvM: number; qb: number; hrmsDeepM: number; depthLimited: number }): number {
  const qb = Math.min(Math.max(o.qb, 1e-6), 1);
  const hQ = Math.sqrt(-Math.log(qb)) * o.hrmsDeepM;
  const e0 = hQ * (BATHY_BREAK_START / BATHY_BREAK_FULL);
  const t = Math.min(Math.max((o.hEnvM - e0) / Math.max(hQ + 1e-4 - e0, 1e-9), 0), 1);
  const group = o.qb > 1e-4 ? t * t * (3 - 2 * t) : 0;
  return Math.max(group, o.depthLimited);
}

/**
 * ROUND 9, LAW 2: THE CREST MOVES AT THE SHALLOW SPEED. The FFT's bands are
 * deep-water modes: their crests move at omega / k0 wherever the surface draws
 * them, so on the bar (0.61 m deep) the forced bands' crest runs at the deep
 * speed (8.5 m/s at the sea's Tz) where the wave's own runs at
 * sqrt(g (h + H)) (3.2 m/s), and the breaker head the mouth's source lays rode
 * the fast crest off the bar: the bar's line flickered with the crests' phase
 * (round 8: none at t 44). A mode of frequency omega on depth h has the local
 * wave number k(h), and its phase is the integral of k along its heading. The
 * deep mode read at the warped place X(x), dX / dl = k / k0 along its
 * heading, has that phase: its local wavelength is 2 pi / k and its crest
 * moves at omega / k. THE WAVE NUMBER (Hedges 1976's amplitude dispersion,
 * omega^2 = g k tanh(k (h + H)), by Fenton and McKee's explicit form on
 * h + H; H the Battjes and Janssen march's Hrms over the floor): on the bar's
 * crest c = sqrt(g (h + H)) as the foam field's broken roller runs
 * (`foamRollerCrestSpeedMs`). Each forced band takes its own k at its period.
 *
 * THE ANCHOR. Both near fields (the mouth's grid and the beach's) are forced at
 * their one sea edge, s = s0, with the FFT sea's own modes at their true place;
 * the warp is 0 on that line, so the drawn sea and the grids' sea edges hold
 * one phase there (the seam tests), and W(x) = the integral of (k / k0 - 1)
 * from the line to x along the band's heading (negative seaward: the read
 * place lies further out). On dry floor the warp holds (no wave there).
 */
export function hedgesK(omega: number, depthM: number, heightM: number): number {
  return fentonMcKeeK((omega * omega) / G, Math.max(depthM, 0) + Math.max(heightM, 0));
}
export function phaseWarpRatio(omega: number, depthM: number, heightM: number): number {
  return hedgesK(omega, depthM, heightM) / ((omega * omega) / G);
}

/**
 * ROUND 11: the mouth's box of the warp (see `phaseWarpMap`'s `box`): the sea edge's warp from the box's sides, the
 * straight sweep seaward of it, the first-arrival march landward of it. Writes band `bi` of `data` in the box.
 */
function phaseWarpBox(
  box: { readonly s0: number; readonly a0: number; readonly a1: number },
  b: MouthBand, bi: number, data: Float32Array,
  map: { res: number; texelM: number; originX: number; originZ: number; data: Float32Array },
  frame: BeachFrame, jRatio: (x: number, z: number) => number,
): void {
  const n = map.res;
  const tx = map.texelM;
  if (Math.abs(frame.aZ) > 1e-6 || Math.abs(Math.abs(frame.aX) - 1) > 1e-6) throw new Error('[ocean] The warp\'s mouth box needs the frame\'s a along X.');
  // The landward direction along z, and the band's run along it: the forced sea comes onshore.
  const zLand = Math.sign(frame.sZ);
  if (!(Math.sign(b.dirZ) === zLand)) throw new Error('[ocean] A forced band runs offshore; the warp\'s march needs it onshore.');
  const aOf = (i: number) => (map.originX + i * tx - frame.originX) * frame.aX;
  const cols: number[] = [];
  for (let i = 0; i < n; i += 1) { const a = aOf(i); if (a >= Math.min(box.a0, box.a1) && a <= Math.max(box.a0, box.a1)) cols.push(i); }
  if (cols.length === 0) return;
  const iLo = Math.max(Math.min(...cols) - 1, 0);
  const iHi = Math.min(Math.max(...cols) + 1, n - 1);
  const inBox = new Uint8Array(n);
  for (const i of cols) inBox[i] = 1;
  const zEdge = frame.originZ + box.s0 * frame.sZ;
  const jE = Math.min(Math.max(Math.round((zEdge - map.originZ) / tx), 0), n - 1);
  const W = (i: number, j: number) => data[(j * n + i) * 4 + bi];
  // The sea edge: linear between the two side columns' sweep (plain coast), along the shore.
  const edge = new Float64Array(n);
  for (let i = 0; i < n; i += 1) edge[i] = W(i, jE);
  for (const i of cols) { const t = (i - iLo) / Math.max(iHi - iLo, 1); edge[i] = W(iLo, jE) * (1 - t) + W(iHi, jE) * t; }
  const xPerZ = b.dirX / b.dirZ;
  const lenPerZ = 1 / Math.abs(b.dirZ);
  const lerpRow = (row: ArrayLike<number>, fi: number) => {
    const f = Math.min(Math.max(fi, 0), n - 1);
    const i0 = Math.min(Math.floor(f), n - 2);
    const t = f - i0;
    const a = row[i0];
    const c = row[i0 + 1];
    if (!Number.isFinite(a)) return t > 0.5 ? c : a;
    if (!Number.isFinite(c)) return t < 0.5 ? a : c;
    return a * (1 - t) + c * t;
  };
  // Seaward of the edge: the straight sweep from the edge (rows away from the land).
  {
    let prev = Float64Array.from(edge);
    for (const i of cols) data[(jE * n + i) * 4 + bi] = edge[i];
    for (let j = jE - zLand; j >= 0 && j < n; j -= zLand) {
      const z = map.originZ + j * tx;
      const dz = -zLand * tx;
      const row = new Float64Array(n);
      for (let i = 0; i < n; i += 1) row[i] = W(i, j);
      for (const i of cols) {
        const x = map.originX + i * tx;
        const xu = x - xPerZ * dz;
        const jMid = 0.5 * (jRatio(x, z) + jRatio(xu, z - dz));
        // One row seaward: the read place moves out by (J - 1) dl (W falls).
        row[i] = lerpRow(prev, (xu - map.originX) / tx) - (jMid - 1) * tx * lenPerZ;
        data[(j * n + i) * 4 + bi] = row[i];
      }
      prev = row;
    }
  }
  // Landward of the edge: the first arrival. prop carries the phase (Infinity where no wave arrives); the written
  // warp carries on past dry land as the sweep does (no change).
  const kRatio = (x: number, z: number): number => {
    const i = Math.min(Math.max(Math.round((x - map.originX) / tx), 0), n - 1);
    const j = Math.min(Math.max(Math.round((z - map.originZ) / tx), 0), n - 1);
    return inDepth(i, j) ? jRatio(x, z) : Infinity;
  };
  // A dry texel (the floor's depth under the still water at most 2 cm, as the sweep's `jRatio` holds) passes no wave.
  const inDepth = (i: number, j: number) => map.data[(j * n + i) * 4] > 0.02;
  let prop = Float64Array.from(edge);
  let out = Float64Array.from(edge);
  for (let j = jE + zLand; j >= 0 && j < n; j += zLand) {
    const z = map.originZ + j * tx;
    const dz = zLand * tx;
    const zP = z - dz;
    const nProp = new Float64Array(n);
    const nOut = new Float64Array(n);
    for (let i = 0; i < n; i += 1) { nProp[i] = W(i, j); nOut[i] = W(i, j); }
    for (const i of cols) {
      const x = map.originX + i * tx;
      const xu = x - xPerZ * dz;
      const kEnd = kRatio(x, z);
      let best = Infinity;
      for (const di of [0, -1, 1]) {
        const xs = xu + di * tx;
        const wp = lerpRow(prop, (xs - map.originX) / tx);
        if (!Number.isFinite(wp) || !Number.isFinite(kEnd)) continue;
        const kS = kRatio(xs, zP);
        if (!Number.isFinite(kS)) continue;
        const L = Math.hypot(x - xs, dz);
        // W = phase / k0 less the deep phase's run along the heading.
        const cand = wp + 0.5 * (kS + kEnd) * L - ((x - xs) * b.dirX + dz * b.dirZ);
        if (cand < best - 1e-9) best = cand;
      }
      nProp[i] = best;
      // The written warp: the arrival where a wave arrives, else held from the row before (no wave there).
      nOut[i] = Number.isFinite(best) ? best : lerpRow(out, (xu - map.originX) / tx);
      data[(j * n + i) * 4 + bi] = nOut[i];
    }
    // Columns outside the box carry the sweep's values into the next row's reads (prop: finite where wet).
    for (let i = 0; i < n; i += 1) if (!inBox[i]) nProp[i] = inDepth(i, j) ? W(i, j) : Infinity;
    prop = nProp;
    out = nOut;
  }
}

/**
 * THE WARP BY A SWEEP (law 2): rows of the map are lines of one s (the frame's
 * s runs along -Z on the coast; a test holds it), so each row's W is the row
 * nearer the anchor's W at the place one row back along the heading (linear
 * across the row) plus (J - 1) dl over the step, J the mean of the two places'
 * k / k0. One pass a band, both ways from the anchor line.
 */
export function phaseWarpMap(o: {
  map: { res: number; texelM: number; originX: number; originZ: number; data: Float32Array };
  hrmsM: Float32Array;
  frame: BeachFrame;
  anchorS: number;
  bands: readonly MouthBand[];
  patchM: readonly number[];
  /**
   * ROUND 11 (law 1; the lead's ruling 2): THE MOUTH'S BOX, where the mouth's grid is forced at its own sea edge
   * seaward of the anchor (the swash bar's grid: s0 out past the bar's toe): the grid's sea edge s and its span along
   * the shore (a0 .. a1). Absent: the sweep alone (rounds 9 and 10).
   *
   * Round 10 swept the box's columns straight along the heading from the anchor (the beach's sea edge, s -7, which
   * crosses the swash bar's bare lens) out through the bar: a dry cell added nothing and a 3 cm cell beside it
   * added k / k0 - 1 of 10 to 25 a meter (the swell's Hedges k on h + H), so the warp jumped by tens of meters
   * between columns at the lens's sides. The drawn bands and the grid's sea edge (forced at those places) then
   * read their modes at unrelated phases there: the navy stripes and the NaN dots along the lens's sides
   * (mouth11/shots/d0-mouth-down.png). In the box now:
   *   - THE SEA EDGE'S WARP is the coast's own: the straight sweep's value at the box's two side columns (plain
   *     coast, no bar), linear between them along the edge. The bar does not change the phase of the waves that
   *     have not reached it (the sea runs onshore; its reflection is not drawn).
   *   - SEAWARD of the edge, the straight sweep from that edge (no bar there).
   *   - LANDWARD of it, THE FIRST ARRIVAL (Fermat's principle; the eikonal |grad phase| = k): each texel's phase is
   *     the least of three paths from the row before (one back along the heading, and one texel to either side),
   *     each at the mean k of its two ends; a dry texel (depth under 2 cm) passes no wave. In water whose depth
   *     changes across the shore only the straight path is the least (the refracted path's offset per row stays
   *     under half a texel at this heading: a test), so the march is the sweep there and the box's sides meet the
   *     coast's warp with no step; round a bare crest the phase arrives through the channels at its flanks. Past the
   *     dry land the warp holds, as the sweep's does.
   */
  box?: { readonly s0: number; readonly a0: number; readonly a1: number };
}): PhaseWarpMap {
  const { map, frame } = o;
  const n = map.res;
  const tx = map.texelM;
  if (Math.abs(Math.abs(frame.sZ) - 1) > 1e-6) throw new Error('[ocean] The phase warp sweeps the map by rows of one s: the frame\'s s must run along Z.');
  const data = new Float32Array(n * n * 4);
  const zAnchor = frame.originZ + o.anchorS * frame.sZ;
  const edgeW: number[] = [];
  let taperM = 0;
  for (let bi = 0; bi < o.bands.length && bi < 4; bi += 1) {
    const b = o.bands[bi];
    if (!b.forced) { edgeW.push(0); continue; }
    // dz along the heading per unit length, and dx per unit dz.
    if (!(Math.abs(b.dirZ) > 0.2)) throw new Error('[ocean] A forced band runs nearly along the coast; the row sweep needs it to cross the rows.');
    const xPerZ = b.dirX / b.dirZ;
    const lenPerZ = 1 / Math.abs(b.dirZ);
    const jRatio = (x: number, z: number): number => {
      const i = Math.min(Math.max(Math.round((x - map.originX) / tx), 0), n - 1);
      const j = Math.min(Math.max(Math.round((z - map.originZ) / tx), 0), n - 1);
      const dep = map.data[(j * n + i) * 4];
      if (!(dep > 0.02)) return 1;
      return phaseWarpRatio(b.omega, dep, o.hrmsM[j * n + i]);
    };
    const rowW = (prev: Float32Array | null, j: number, zPrev: number, sign: number): Float32Array => {
      const z = map.originZ + j * tx;
      const dz = z - zPrev;
      const out = new Float32Array(n);
      for (let i = 0; i < n; i += 1) {
        const x = map.originX + i * tx;
        const xu = x - xPerZ * dz;
        let wPrev = 0;
        if (prev !== null) {
          const fi = Math.min(Math.max((xu - map.originX) / tx, 0), n - 1);
          const i0 = Math.min(Math.floor(fi), n - 2);
          const t = fi - i0;
          wPrev = prev[i0] * (1 - t) + prev[i0 + 1] * t;
        }
        const jMid = 0.5 * (jRatio(x, z) + jRatio(xu, zPrev));
        out[i] = wPrev + sign * (jMid - 1) * Math.abs(dz) * lenPerZ;
      }
      return out;
    };
    // The heading's sign along z: moving along the heading changes z by dirZ per meter.
    const jA = (zAnchor - map.originZ) / tx;
    const j0 = Math.max(Math.ceil(jA), 0);
    // Rows at z >= zAnchor, then rows at z < zAnchor.
    let prev: Float32Array | null = null;
    let zPrev = zAnchor;
    for (let j = j0; j < n; j += 1) {
      const sign = Math.sign(b.dirZ) * Math.sign(map.originZ + j * tx - zPrev) || 1;
      const w = rowW(prev, j, zPrev, sign);
      for (let i = 0; i < n; i += 1) data[(j * n + i) * 4 + bi] = w[i];
      prev = w;
      zPrev = map.originZ + j * tx;
    }
    prev = null;
    zPrev = zAnchor;
    for (let j = j0 - 1; j >= 0; j -= 1) {
      const sign = Math.sign(b.dirZ) * Math.sign(map.originZ + j * tx - zPrev) || 1;
      const w = rowW(prev, j, zPrev, sign);
      for (let i = 0; i < n; i += 1) data[(j * n + i) * 4 + bi] = w[i];
      prev = w;
      zPrev = map.originZ + j * tx;
    }
    if (o.box !== undefined) phaseWarpBox(o.box, b, bi, data, map, frame, jRatio);
    // The edge's largest |W| and the taper it asks for.
    let e = 0;
    for (let k = 0; k < n; k += 1) {
      for (const [i, j] of [[k, 0], [k, n - 1], [0, k], [n - 1, k]]) e = Math.max(e, Math.abs(data[(j * n + i) * 4 + bi]));
    }
    edgeW.push(e);
    const lam = (2 * Math.PI * G) / (b.omega * b.omega);
    const step = lam / Math.max(o.patchM[bi], lam);
    taperM = Math.max(taperM, e / Math.max(step, 1e-3));
  }
  return { data, taperM, edgeW };
}
