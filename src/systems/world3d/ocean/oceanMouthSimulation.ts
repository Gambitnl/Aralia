/**
 * @file oceanMouthSimulation.ts
 * Assembles the mouth simulation, forcing, spin-up and deterministic clock.
 * The intact field and soil classes live in oceanMouthField. Existing assembly
 * order, caches, stepping and checkpoint ownership are preserved here.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:30:33
 * Dependents: systems/world3d/ocean/oceanMouthMath.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type MouthDesign, type InfragravityEdge, type MouthSim } from './oceanMouthTypes';
import { BEACH_SWASH, BEACH_DT, G, stricklerManningN, MEDIUM_SAND_D50_M, beachToWorld, forcingCascades, IncidentWaves, sampledIncident, type IncidentFn, heldIncidentCrest, type SwashGridSpec, stockdonRunup2 } from './oceanBeachMath';
import { MOUTH_DX_M, shorelineS } from './oceanMouthCoast';
import { courseNearest, seabedPointAt } from './oceanSeabedMath';
import { type CascadeParams } from './oceanConfig';
import { mouthEdgeBore } from './oceanMouthJet';
import { MouthField, MOUTH_H_DRY, type MouthState } from './oceanMouthField';
import { mouthHandoverStarts } from './oceanMouthWaveMath';


/**
 * THE WATER TABLE UNDER THE MOUTH'S CELLS (round 5), m over the mean sea
 * level: the beach's law (BEACH_SWASH: wtShoreM at the water's edge, rising
 * by wtSlope per meter inland, at most wtMaxM over it) about the water
 * beside the bank: the river's normal surface up the valley (Manning,
 * \`channelNormalDepthM\`) and the mean sea level seaward of the mouth. The
 * distance inland is to the nearest cell under that water (a chamfer
 * distance over the grid, 1 and sqrt 2 steps).
 */
export function mouthWaterTable(design: MouthDesign, bed: Float64Array): Float64Array {
  const g = design.grid;
  const v = design.valley;
  const yn = channelNormalDepthM(design);
  const ref = new Float64Array(g.ns * g.na);
  const dist = new Float64Array(g.ns * g.na).fill(Infinity);
  for (let j = 0; j < g.na; j += 1) {
    for (let i = 0; i < g.ns; i += 1) {
      const c = j * g.ns + i;
      // ROUND 13: the river's surface by the channel's along (`mouthChannelAt`; the straight valley's s as before).
      const ch = v.course ? mouthChannelAt(design, g.s0 + (i + 0.5) * g.ds, g.a0 + (j + 0.5) * g.da) : null;
      const along = ch ? ch.along : g.s0 + (i + 0.5) * g.ds - design.mouthS;
      // ROUND 15 (ruling 2): on the low-flow channel the river's surface is the day's level (the fill's top).
      const lf = design.lowFlow;
      const eta = along <= 0 ? 0 : lf && design.course
        ? Math.max(design.tideM + lf.slope * Math.min(along, design.course.rootAlongM), 0)
        : Math.max((ch ? ch.thal : -v.depthM + v.slope * Math.min(along, v.headM)) + yn, 0);
      ref[c] = eta;
      if (bed[c] < eta) dist[c] = 0;
    }
  }
  // Two chamfer passes (forward and back).
  const d2 = Math.SQRT2;
  const relax = (c: number, cn: number, w: number) => { const x = dist[cn] + w; if (x < dist[c]) dist[c] = x; };
  for (let j = 0; j < g.na; j += 1) for (let i = 0; i < g.ns; i += 1) {
    const c = j * g.ns + i;
    if (i > 0) relax(c, c - 1, 1);
    if (j > 0) { relax(c, c - g.ns, 1); if (i > 0) relax(c, c - g.ns - 1, d2); if (i < g.ns - 1) relax(c, c - g.ns + 1, d2); }
  }
  for (let j = g.na - 1; j >= 0; j -= 1) for (let i = g.ns - 1; i >= 0; i -= 1) {
    const c = j * g.ns + i;
    if (i < g.ns - 1) relax(c, c + 1, 1);
    if (j < g.na - 1) { relax(c, c + g.ns, 1); if (i < g.ns - 1) relax(c, c + g.ns + 1, d2); if (i > 0) relax(c, c + g.ns - 1, d2); }
  }
  const out = new Float64Array(g.ns * g.na);
  const p = BEACH_SWASH;
  for (let c = 0; c < out.length; c += 1) {
    const dM = Number.isFinite(dist[c]) ? dist[c] * g.ds : 1e3;
    out[c] = ref[c] + Math.min(p.wtShoreM + p.wtSlope * dM, p.wtMaxM);
  }
  return out;
}

/**
 * The fixed step of the mouth, s: two of the beach's (1/100 s) steps, so a
 * pinned time lands on both clocks. Round 2: 0.02 s. The fastest signal on
 * the Sarcelle's grid is the shallow-water speed of its 1.07 m channel and
 * a breaking crest over it plus the 1 m/s outflow, about 5 m/s; on its 1 m
 * cells the Courant number is 0.10 (HLL needs under 0.5), on the creek's
 * 0.5 m cells about 0.15. At 0.01 s the Sarcelle's near field cost 293 ms
 * of CPU a simulated second (mouth2/timeQ31.ts).
 */
export const MOUTH_DT = 2 * BEACH_DT;

/**
 * THE SPIN-UP: the river runs into a still sea from its start guess for this
 * long before t = 0, so the start state is the river's steady flow (a pure
 * function of the design). From the normal-depth start guess
 * (`createMouthSim`) the field after 60 s stands within 0.3 mm of the field
 * after 120 s (`mouth/probeSpin.ts`).
 */
export const MOUTH_SPINUP_S = 60;
/**
 * THE SPIN-UP'S LENGTH ON A LONGER REACH (round 2): at least MOUTH_SPINUP_S,
 * and at least one round trip of a long wave over the valley, up and back,
 * at the river's own speed plus the shallow-water speed of its normal
 * depth: 2 L / (sqrt(g y_n) + u_n). The Sarcelle's 233 m reach takes 99 s;
 * its field after 120 s stands within 7.6 mm of the field after 240 s, and
 * after 60 s within 18 mm (mouth2/probeSpin2.ts). The creek keeps 60 s.
 */
export function mouthSpinUpS(d: MouthDesign): number {
  const yn = channelNormalDepthM(d);
  const un = d.dischargeM3S / Math.max(channelAreaM2(d, yn), 1e-6);
  return Math.max(MOUTH_SPINUP_S, (2 * d.headM) / (Math.sqrt(G * yn) + un));
}
/**
 * The spin-up's step, s: with the sea still, the fastest signal is the
 * shallow-water speed of the 0.64 m sea edge plus the river's flow, about
 * 3.5 m/s, so 0.03 s keeps the Courant number at 0.42 (HLL needs under 0.5).
 */
export const MOUTH_SPINUP_DT = 0.03;
/** The spin-up's step on a grid of cell dx, s: the same Courant number as MOUTH_SPINUP_DT on 0.5 m cells. */
export function mouthSpinUpDt(dx: number): number {
  return (MOUTH_SPINUP_DT * dx) / MOUTH_DX_M;
}

/* ------------------------------------------------------------------ */
/* ROUND 14 (ruling 1; GG-415): THE INFRAGRAVITY SWASH                  */
/* ------------------------------------------------------------------ */

/*
 * WHY. The platform's crest stands 0.397 m over the low water, and Stockdon et al.'s (2006) 2 % run-up of the day's
 * sea (H0 0.215 m, Tp 12.75 s, the face 1:11) is 0.64 m: the platform is overwashed every few waves. The near field
 * ran up 0.21 m (R2 of 62 run-up maxima on 13 rows over 300 s, `mouth14/probe/runup14.ts`): its sea edge is forced by
 * the FFT sea's linear modes alone. Stockdon's run-up has three parts: the setup 0.35 beta sqrt(H0 L0) (0.234 m), the
 * incident band's swash 0.75 beta sqrt(H0 L0) (0.502 m) and the INFRAGRAVITY band's swash 0.06 sqrt(H0 L0) (0.441 m;
 * Stockdon's eq. 12, no slope term: the infragravity swash grows with the offshore wave energy alone). The near field
 * makes the first two from the forced modes (the setup by the breakers' radiation stress, the swash by the bores); the
 * third is the long wave the wave groups make, which the shore reflects (Guza and Thornton 1985). The edge now carries
 * it:
 *   - THE SHAPE: on a wide, gentle surf zone the shore's long wave is forced at the moving breakpoint (Symonds, Huntley
 *     and Bowen 1982): a higher group breaks farther out and lifts the setup shoreward of it, so the long wave is
 *     linear in the groups' height and stands high at the shore under the high groups. (The bound long wave of
 *     Longuet-Higgins and Stewart 1962 is the groups' set-down, -E: it was the first form here, and its deep troughs
 *     (-0.43 m at an edge rms of 0.04 m) only drained the face: the run-up's R2 stayed at 0.19 m.) The groups' height
 *     is the envelope A = sqrt(2 E), E the edge's own series (at the law's gain) squared and low-passed by two passes
 *     of a running mean one peak period long (a triangle of 2 Tp: zeros at fp, the group band kept); the shape is
 *     A(t) - <A>. Each sampled edge row has its own groups (the swell runs at an angle to the shore), so the long wave
 *     varies along the shore by the groups' own length: the overwash comes in pieces.
 *   - THE HEIGHT: at the shoreline the band stands as a standing long wave whose swash is Stockdon's S_ig, the shore's
 *     rms elevation S_ig / 4. The standing long wave over the row's own floor solves the linear long-wave equation
 *     (g h eta')' + omega^2 eta = 0, regular at the shoreline (`standingLongWaveIncoming`); on a plane face it is
 *     eta = a_s J0(z), z = 2 omega sqrt(x / (g beta)) (Lamb 1932, art. 186), the sum of an incoming and an outgoing
 *     wave, each a_s |H0(z)| / 2 (a test holds the integration to it). At the edge's depth the solution splits into the
 *     incoming and the outgoing wave of the local wavenumber, each of amplitude sqrt(eta^2 + (eta' / k)^2) / 2; the
 *     edge's absorbing-generating boundary takes the incoming one. Omega is the band's mean frequency (the shape's zero
 *     up-crossings). (A plane face's J0 from the edge's mean slope was the first form here: over the spit's terrace,
 *     flat at 0.37 m from the edge to the face, it asked an edge wave a third of the one the shore needs.)
 * The band rides on the edge's forced series before the crest hold. The near field's own breakers, friction and the
 * platform's crest do the rest: the overwash's sheets, their reach and their drain-down are the solver's.
 */
/** ROUND 14 (ruling 1): the coast's sand's Manning n (Strickler's grain law, the beach's round 20). */
export function mouthSandManningN(d: MouthDesign): number {
  return stricklerManningN(d.params.island?.grainD50M ?? MEDIUM_SAND_D50_M);
}
/** ROUND 14 (ruling 1): each near-field cell's Manning n: the river's in its channel, the sand's off it. */
export function mouthManningCells(d: MouthDesign): Float64Array {
  const g = d.grid;
  const out = new Float64Array(g.ns * g.na);
  const sand = mouthSandManningN(d);
  const end = -d.valley.seaEndM;
  for (let j = 0; j < g.na; j += 1) {
    for (let i = 0; i < g.ns; i += 1) {
      const ch = mouthChannelAt(d, g.s0 + (i + 0.5) * g.ds, g.a0 + (j + 0.5) * g.da);
      out[j * g.ns + i] = ch.across < d.widthM / 2 && ch.along >= end ? d.manningN : sand;
    }
  }
  return out;
}
/**
 * ROUND 14 (ruling 1): THE FIELD'S OWN TRANSFER OF THE BAND, MEASURED. The linear long wave (with the bed's friction,
 * `standingLongWaveIncoming`) brings the edge's band to the shore at Stockdon's S_ig / 4; the near field itself, with
 * the incident band breaking over the terrace and the swash's own wet and dry front, brings 0.74 of it
 * (`mouth14/probe/igshore14.ts`: the band's rms 1 to 5 m off the shoreline on nine rows a = 100 to 300, over 300 s:
 * 0.0821 m at the linear height, 0.1149 at 1.66 times it, 0.1258 at 2 times; the law asks 0.1108). The edge's band is
 * the linear law's height times this measured gain, so the FIELD's shore stands at the law's S_ig: the law sets the
 * target, the field's measured response the height. Re-measure it when the near field's laws change.
 */
export const MOUTH_IG_FIELD_GAIN = 1.58;
/** Stockdon et al.'s (2006) infragravity swash coefficient, eq. 12: S_ig = 0.06 sqrt(H0 L0). */
export const STOCKDON_IG_SWASH = 0.06;
/** The infragravity band's significant swash at the shoreline (Stockdon et al. 2006), m. */
export function stockdonIgSwashM(h0M: number, tpS: number): number {
  return STOCKDON_IG_SWASH * Math.sqrt(h0M * ((G * tpS * tpS) / (2 * Math.PI)));
}
/**
 * |H0^(1)(x)| = sqrt(J0^2 + Y0^2), the modulus of the Hankel function of order 0 (Abramowitz and Stegun 1964, 9.4.1
 * and 9.4.2 under 3, 9.4.3 and 9.4.6 over it; error under 1e-7).
 */
export function hankel0Abs(x: number): number {
  if (x <= 0) return Infinity;
  if (x >= 3) {
    const y = 3 / x;
    const f0 = 0.79788456 + y * (-0.00000077 + y * (-0.0055274 + y * (-0.00009512 + y * (0.00137237 + y * (-0.00072805 + y * 0.00014476)))));
    return f0 / Math.sqrt(x);
  }
  const y = (x / 3) ** 2;
  const j0 = 1 + y * (-2.2499997 + y * (1.2656208 + y * (-0.3163866 + y * (0.0444479 + y * (-0.0039444 + y * 0.00021)))));
  const y0 = (2 / Math.PI) * Math.log(x / 2) * j0
    + 0.36746691 + y * (0.60559366 + y * (-0.74350384 + y * (0.25300117 + y * (-0.04261214 + y * (0.00427916 - y * 0.00024846)))));
  return Math.hypot(j0, y0);
}
/**
 * ROUND 14: the incoming wave's amplitude at the edge per unit of the shoreline's standing amplitude, for the linear
 * long wave of angular frequency `omega` over a floor of depths `depthM` (m, every `dxM` from the shoreline, index 0
 * at the shoreline, the last at the edge): (D eta')' + omega^2 eta = 0, integrated by RK4 from the shoreline (the J0
 * start on the first cell's slope) and split at the edge into its two waves of the local wavenumber. Without friction
 * D = g h. WITH THE BED'S FRICTION (`friction`: the bed's Manning n and the shoreline's standing amplitude, m) the
 * momentum loses lambda u, Lorentz's (1926) linearization of the quadratic stress c_f |u| u over the wave's cycle,
 * lambda = (8 / 3 pi) c_f U / h (c_f = g n^2 / h^(1/3), U the speed's amplitude), so D = g h / (1 + i lambda / omega)
 * and eta is complex; U comes from the frictionless pass and then from the last pass (three passes in all). A shallow
 * terrace takes the long wave's energy on the way in: the edge must bring more of it.
 */
export function standingLongWaveIncoming(depthM: ArrayLike<number>, dxM: number, omega: number, friction?: { readonly manningN: number; readonly shoreAmpM: number }): number {
  const n = depthM.length;
  const X = (n - 1) * dxM;
  const hAt = (x: number): number => {
    const u = Math.min(Math.max(x / dxM, 0), n - 1);
    const i = Math.min(Math.floor(u), n - 2);
    const f = u - i;
    return Math.max(depthM[i] * (1 - f) + depthM[i + 1] * f, 0.02);
  };
  const w2 = omega * omega;
  const x0 = Math.min(0.25 * dxM, X / 2);
  const x3 = Math.min(3 * dxM, X);
  const beta0 = Math.max(depthM[Math.round(x3 / dxM)] / x3, 1e-3);
  const step = 0.02;
  const nS = Math.max(Math.ceil((X - x0) / step), 1);
  // The speed's amplitude at each step of the last pass (per unit shoreline amplitude), for lambda.
  let uAmp: Float64Array | null = null;
  let result = 0;
  const passes = friction ? 3 : 1;
  for (let pass = 0; pass < passes; pass += 1) {
    // D = g h / (1 + i r), r = lambda / omega: D = g h (1 - i r) / (1 + r^2).
    const dAt = (x: number, k: number): [number, number] => {
      const h = hAt(x);
      let r = 0;
      if (friction && uAmp !== null) {
        const cf = (G * friction.manningN * friction.manningN) / h ** (1 / 3);
        const lam = ((8 / (3 * Math.PI)) * cf * uAmp[Math.min(Math.max(k, 0), nS)] * friction.shoreAmpM) / h;
        r = lam / omega;
      }
      const den = 1 + r * r;
      return [(G * h) / den, (-G * h * r) / den];
    };
    // State: eta (complex) and q = D eta' (complex); q' = -omega^2 eta, eta' = q / D.
    let x = x0;
    let er = 1 - (w2 * x0) / (G * beta0);
    let ei = 0;
    const [d0r, d0i] = dAt(x0, 0);
    const p0 = -w2 / (G * beta0);
    let qr = d0r * p0;
    let qi = d0i * p0;
    const uNew = new Float64Array(nS + 1);
    const deriv = (xx: number, k: number, a: number, b: number, c: number, e: number): [number, number, number, number] => {
      const [dr, di] = dAt(xx, k);
      const m = dr * dr + di * di;
      // eta' = q / D
      const pr = (c * dr + e * di) / m;
      const pi = (e * dr - c * di) / m;
      return [pr, pi, -w2 * a, -w2 * b];
    };
    for (let k = 0; k < nS; k += 1) {
      const dx = Math.min(step, X - x);
      if (dx <= 0) break;
      const k1 = deriv(x, k, er, ei, qr, qi);
      const k2 = deriv(x + dx / 2, k, er + (dx / 2) * k1[0], ei + (dx / 2) * k1[1], qr + (dx / 2) * k1[2], qi + (dx / 2) * k1[3]);
      const k3 = deriv(x + dx / 2, k, er + (dx / 2) * k2[0], ei + (dx / 2) * k2[1], qr + (dx / 2) * k2[2], qi + (dx / 2) * k2[3]);
      const k4 = deriv(x + dx, k + 1, er + dx * k3[0], ei + dx * k3[1], qr + dx * k3[2], qi + dx * k3[3]);
      er += (dx / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      ei += (dx / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      qr += (dx / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      qi += (dx / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
      x += dx;
      // The speed: -i omega u = -g eta' - lambda u, so |u| = g |eta'| / |omega + i lambda| ~ |q| / (h omega) (q = D eta').
      uNew[k + 1] = Math.hypot(qr, qi) / (hAt(x) * omega);
    }
    uNew[0] = uNew[1];
    uAmp = uNew;
    // At the edge: eta' = q / D, k = omega / sqrt(D) (complex); the incoming wave A = (eta + i eta' / k) / 2.
    const [dr, di] = dAt(X, nS);
    const m = dr * dr + di * di;
    const pr = (qr * dr + qi * di) / m;
    const pim = (qi * dr - qr * di) / m;
    // sqrt(D) by the principal root.
    const dm = Math.sqrt(Math.hypot(dr, di));
    const da = Math.atan2(di, dr) / 2;
    const sr = dm * Math.cos(da);
    const si = dm * Math.sin(da);
    // eta' / k = eta' sqrt(D) / omega; times i: i (pr + i pim)(sr + i si) / omega.
    const tr = (pr * sr - pim * si) / omega;
    const ti = (pr * si + pim * sr) / omega;
    result = Math.hypot(er - ti, ei + tr) / 2;
  }
  return result;
}
/**
 * The infragravity band at one edge row (see THE INFRAGRAVITY SWASH): `series` the edge's forced heights every `dtS`
 * (periodic over its span), the day's deep-water H0 and Tp, the edge's still depth and its distance from the
 * shoreline, m.
 */
export function infragravityEdge(o: {
  series: ArrayLike<number>; dtS: number; h0M: number; tpS: number; depthM: number; shoreDistM: number;
  /** The row's still depths from the shoreline (index 0) to the edge, every `profileDxM`; absent: the plane face. */
  profileM?: ArrayLike<number>; profileDxM?: number;
  /** The bed's Manning n for the band's friction on the way in (`standingLongWaveIncoming`); absent: none. */
  manningN?: number;
}): InfragravityEdge {
  const n = o.series.length;
  const e = new Float64Array(n);
  for (let k = 0; k < n; k += 1) e[k] = o.series[k] * o.series[k];
  // Two passes of a centered running mean one peak period long (periodic): a triangle of 2 Tp.
  const w = Math.max(1, Math.round(o.tpS / o.dtS));
  const h0 = Math.floor(w / 2);
  const wrap = (k: number): number => ((k % n) + n) % n;
  const box = (a: Float64Array): Float64Array => {
    const out = new Float64Array(n);
    let s = 0;
    for (let k = -h0; k < w - h0; k += 1) s += a[wrap(k)];
    for (let k = 0; k < n; k += 1) {
      out[k] = s / w;
      s += a[wrap(k + w - h0)] - a[wrap(k - h0)];
    }
    return out;
  };
  const env = box(box(e));
  // The groups' height envelope (breakpoint forcing, linear in A): A - <A>.
  let meanA = 0;
  for (let k = 0; k < n; k += 1) { env[k] = Math.sqrt(2 * Math.max(env[k], 0)); meanA += env[k]; }
  meanA /= n;
  const shape = new Float64Array(n);
  let v = 0;
  for (let k = 0; k < n; k += 1) { shape[k] = env[k] - meanA; v += shape[k] * shape[k]; }
  const rmsShape = Math.sqrt(v / n);
  let ups = 0;
  for (let k = 0; k < n; k += 1) if (shape[k] <= 0 && shape[(k + 1) % n] > 0) ups += 1;
  const periodS = (n * o.dtS) / Math.max(ups, 1);
  const omega = (2 * Math.PI) / periodS;
  const x = Math.max(o.shoreDistM, 1);
  const beta = Math.max(o.depthM, 0.05) / x;
  const z = 2 * omega * Math.sqrt(x / (G * beta));
  const shoreRmsM = stockdonIgSwashM(o.h0M, o.tpS) / 4;
  const rms = o.profileM && o.profileM.length >= 3
    ? shoreRmsM * standingLongWaveIncoming(o.profileM, o.profileDxM ?? 1, omega, o.manningN !== undefined ? { manningN: o.manningN, shoreAmpM: shoreRmsM * Math.SQRT2 } : undefined)
    : (shoreRmsM * hankel0Abs(z)) / 2;
  const k = rmsShape > 1e-12 ? rms / rmsShape : 0;
  for (let q = 0; q < n; q += 1) shape[q] *= k;
  return { etaM: shape, rmsM: rmsShape > 1e-12 ? rms : 0, periodS, zEdge: z, shoreRmsM };
}

/**
 * ROUND 14: THE POND'S STEADY LEVEL. A reach behind a spit is a reservoir whose outlet passes the river's flow only at
 * the head the pond stands at; it fills toward that level with a time constant of its area over the outlet's rating
 * slope (dQ / d eta), not in the long wave's round trip. Round 13's coarse pre-run ran the round trip's 259 s and left
 * the Sarcelle's pond at 0.10 m over the low water with the outlet passing 0.13 of the day's flow (its steady level is
 * 0.22 m: `mouth14/probe/spin14.ts`, 0.098 / 0.159 / 0.197 / 0.213 / 0.220 m at 259 / 600 / 1000 / 1500 / 2500 s). The
 * coarse pre-run now runs on in MOUTH_STEADY_CHUNK_S chunks after the rule until the grid's storage changes by less
 * than MOUTH_STEADY_SHARE of the inflow over a chunk (inflow and outflow within that share: the steady state), at most
 * MOUTH_STEADY_MAX_S in all. The straight valley keeps its one spin-up (it has no pond).
 */
export const MOUTH_STEADY_CHUNK_S = 100;
export const MOUTH_STEADY_SHARE = 0.02;
export const MOUTH_STEADY_MAX_S = 4000;
/** The span the edge series' rms height is measured over, s (round 4): 100 of the sea's Tz. */
export const MOUTH_EDGE_RMS_SPAN_S = 600;
/** ROUND 13: the most edge rows the rms heights are measured on (the deflected reach; see `createMouthSim`). */
export const MOUTH_EDGE_RMS_ROWS = 64;
/** ROUND 13: the coarse pre-run's cell over the field's (see `createMouthSim`, THE POND BEHIND THE SPIT). */
export const MOUTH_COARSE_FACTOR = 4;

/** ROUND 13: the channel's along at each grid cell (`mouthChannelAt`), cached a design. */
const ALONG_CACHE = new WeakMap<object, Float64Array>();
/*
 * ROUND 14 (ruling 3; GG-414): THE SALT WEDGE'S WATER. Round 12's arrested wedge (`saltWedgeLengthM`) put the sea's
 * water under the river's layer up the whole reach, and the pack drew it as the open sea's clear water: a teal pond with
 * the floor and its caustics under 0.5 m of clear water. The wedge's water comes in through the outlet from the SURF
 * ZONE. Two checks decide what it carries:
 *   - THE SILL (`mouth14/probe/sill14.ts`, the near field's flow over 20 to 60 s at the day's low water): across each
 *     section of the outlet the river's flux per unit width gives its critical thickness h_c = (q^2 / g')^(1/3) of 0.11
 *     to 0.22 m against the section's 0.35 to 1.06 m of water, and the river layer's densimetric Froude number is under
 *     1 over most of each section: no section is a control the wedge cannot pass under (Armi and Farmer 1986). The
 *     wedge stands.
 *   - WHAT IT KEEPS, by the river's own load laws. The surf's stirred SAND (van Rijn's reference concentration, round
 *     13) settles out of the pond: its fall speed (0.35 mm, `sandFallSpeedMS`) over the friction velocity of the
 *     pond's flow gives a Rouse number near 18 (bed load only past 2.5). The surf's FINES (the river's own 16 um load,
 *     SUSPENDED_D50_M) stay up in the surf: the breakers' bed stress is far over Krone's 0.06 Pa (no deposition), so
 *     the breakers mix the river's plume water through the whole column; in the pond their Rouse number is near 0.09:
 *     a wash load the wedge keeps. So the wedge's water carries the river's load at the river water's share of the
 *     outlet's surf water (the near field's own tracer, depth-mean, over the outlet's sea-end section).
 * The pack draws it as river water: the wedge's thickness times that share joins the river's column (`b.z`), at most
 * the water's depth. The pond is opaque by the river's own optics, to the bed where the outlet's water is the river's.
 */
const OUTLET_CACHE = new WeakMap<object, Int32Array>();
/** ROUND 14: the near field's cells on the outlet's sea-end section (the channel's along at the cut's sea end, +-1.5 m, inside its half width). */
export function outletSectionCells(d: MouthDesign): Int32Array {
  const hit = OUTLET_CACHE.get(d);
  if (hit) return hit;
  const g = d.grid;
  const end = -d.valley.seaEndM;
  const out: number[] = [];
  for (let j = 0; j < g.na; j += 1) {
    for (let i = 0; i < g.ns; i += 1) {
      const ch = mouthChannelAt(d, g.s0 + (i + 0.5) * g.ds, g.a0 + (j + 0.5) * g.da);
      if (Math.abs(ch.along - end) <= 1.5 && ch.across < d.widthM / 2) out.push(j * g.ns + i);
    }
  }
  const t = Int32Array.from(out);
  OUTLET_CACHE.set(d, t);
  return t;
}
/** ROUND 14: the river water's depth-mean share over the outlet's sea-end section (`outletSectionCells`), 0 to 1. */
export function outletRiverShare(d: MouthDesign, f: { h: ArrayLike<number>; hc: ArrayLike<number> }): number {
  let h = 0;
  let hc = 0;
  for (const c of outletSectionCells(d)) if (f.h[c] > 1e-3) { h += f.h[c]; hc += f.hc[c]; }
  return h > 0 ? Math.min(Math.max(hc / h, 0), 1) : 0;
}

export function channelAlongTable(d: MouthDesign): Float64Array {
  const hit = ALONG_CACHE.get(d);
  if (hit) return hit;
  const g = d.grid;
  const t = new Float64Array(g.ns * g.na);
  for (let j = 0; j < g.na; j += 1) {
    for (let i = 0; i < g.ns; i += 1) t[j * g.ns + i] = mouthChannelAt(d, g.s0 + (i + 0.5) * g.ds, g.a0 + (j + 0.5) * g.da).along;
  }
  ALONG_CACHE.set(d, t);
  return t;
}

/**
 * ROUND 13 (law 1): THE CHANNEL AT A POINT, straight or deflected: the distance along the channel from the mouth's
 * shoreline point (negative seaward), across it from its centerline, its thalweg there over the mean sea level, and
 * its downstream direction (toward the sea) in the beach frame (s, a). The straight valley: along s, across a.
 */
export function mouthChannelAt(d: MouthDesign, s: number, a: number): { along: number; across: number; thal: number; downS: number; downA: number } {
  const v = d.valley;
  const c = v.course;
  if (!c) {
    const along = s - d.mouthS;
    return { along, across: Math.abs(a - d.mouthA), thal: -v.depthM + v.slope * Math.min(along, v.headM), downS: -1, downA: 0 };
  }
  const [x, z] = beachToWorld(d.frame, s, a);
  const q = courseNearest(c, x, z);
  // The downstream direction: from the nearest point's segment, toward the lower along.
  const n = c.along.length;
  let k = 0;
  while (k + 2 < n && c.along[k + 1] < q.along) k += 1;
  const tx = c.xz[2 * k + 2] - c.xz[2 * k];
  const tz = c.xz[2 * k + 3] - c.xz[2 * k + 1];
  const l = Math.hypot(tx, tz) || 1;
  const ux = -tx / l;
  const uz = -tz / l;
  const f = d.frame;
  return { along: q.along, across: q.across, thal: q.thal, downS: ux * f.sX + uz * f.sZ, downA: ux * f.aX + uz * f.aZ };
}

/** World point of a mouth cell center. */
export function mouthCellWorld(d: MouthDesign, i: number, j: number): [number, number] {
  const g = d.grid;
  return beachToWorld(d.frame, g.s0 + (i + 0.5) * g.ds, g.a0 + (j + 0.5) * g.da);
}

/** Build the mouth's near field and run its spin-up. */
export function createMouthSim(
  design: MouthDesign, cascades: readonly CascadeParams[], n: number, seed: number, spinUpS = mouthSpinUpS(design),
  /**
   * ROUND 10 (law 1): each forced band's phase warp at the sea edge's points, m along the band's heading
   * (`phaseWarpMap` anchored on the beach's sea edge, sampled at each edge row; one array a cascade, in the
   * cascades' order; null or absent for a band not forced). With the grid's sea edge seaward of the beach's (the
   * swash bar on the grid), the drawn sea there reads each mode at x + W dir, so the edge is forced with the same
   * modes at the same places: one phase across the edge. Absent: every mode at its true place (W = 0).
   */
  edgeWarpM?: readonly (Float64Array | null)[],
  /** ROUND 13: the coarse pre-run's own build (no sea edge series, no pre-run of its own). */
  opts?: { readonly coarse?: boolean },
): MouthSim {
  const g = design.grid;
  const nc = g.ns * g.na;
  const coarse = opts?.coarse === true;
  const bed = new Float64Array(nc);
  for (let j = 0; j < g.na; j += 1) {
    for (let i = 0; i < g.ns; i += 1) {
      const [x, z] = mouthCellWorld(design, i, j);
      bed[j * g.ns + i] = -seabedPointAt(design.params, x, z).depthM;
    }
  }
  // The sea edge's points, one a row, and the sea there exactly as the beach
  // worker samples its own on the derived swash (round 20, BEACH_MATCH_SWASH:
  // the FFT sea's height from the same cascades, share and modes, each mode
  // shoaled and refracted to the edge's still depth, the crest held to the
  // depth). On the surf sea the unheld sea at the 0.64 m edge would stand
  // crests twice the depth.
  const ex = new Float64Array(g.na);
  const ez = new Float64Array(g.na);
  const dEdge = new Float64Array(g.na);
  for (let j = 0; j < g.na; j += 1) {
    const [x, z] = beachToWorld(design.frame, g.s0, g.a0 + (j + 0.5) * g.da);
    ex[j] = x;
    ez[j] = z;
    dEdge[j] = Math.max(-bed[j * g.ns], 0.05);
  }
  const shoal = { depthM: dEdge, normalX: design.frame.sX, normalZ: design.frame.sZ };
  const forcedNames = forcingCascades(cascades);
  const warped = edgeWarpM !== undefined && edgeWarpM.some((w) => w !== null && w.some((x) => x !== 0));
  // ROUND 10: one IncidentWaves a forced cascade at its own warped places (the modes and their shares are the same:
  // IncidentWaves picks its modes cascade by cascade), summed; with no warp round 9's one sum.
  // ROUND 13: the edge's sea on a set of rows (all rows for the field; sampled rows for the rms law below).
  const makeWaves = (rows: readonly number[]): MouthSim['waves'] => {
    const all = rows.length === g.na;
    const rx = all ? ex : Float64Array.from(rows, (j) => ex[j]);
    const rz = all ? ez : Float64Array.from(rows, (j) => ez[j]);
    const sh = all ? shoal : { depthM: Float64Array.from(rows, (j) => dEdge[j]), normalX: shoal.normalX, normalZ: shoal.normalZ };
    if (!warped) return new IncidentWaves({ cascades, n, seed, use: forcedNames, share: 0.95, maxModes: 700, px: rx, pz: rz, shoal: sh });
    const parts = cascades.map((c, ci) => {
      if (!forcedNames.includes(c.name)) return null;
      const w = edgeWarpM![ci] ?? null;
      const b = design.bands[ci];
      const px = Float64Array.from(rx, (x, k) => x + (w ? w[rows[k]] : 0) * b.dirX);
      const pz = Float64Array.from(rz, (z, k) => z + (w ? w[rows[k]] : 0) * b.dirZ);
      return new IncidentWaves({ cascades, n, seed, use: [c.name], share: 0.95, maxModes: 700, px, pz, shoal: sh });
    }).filter((p): p is IncidentWaves => p !== null);
    const tmp = new Float64Array(rows.length);
    return {
      points: rows.length,
      heights(t: number, out: Float64Array): void {
        out.fill(0);
        for (const p of parts) { p.heights(t, tmp); for (let j = 0; j < out.length; j += 1) out[j] += tmp[j]; }
      },
    };
  };
  const allRows = Array.from({ length: g.na }, (_, j) => j);
  // The coarse pre-run's sea stands still (the spin-up's): no series.
  const waves: MouthSim['waves'] = coarse ? { points: g.na, heights: (_t: number, out: Float64Array) => { out.fill(0); } } : makeWaves(allRows);
  const inc0 = sampledIncident(waves, 0.05);
  /* ROUND 4, THE SEA PAST THE BAR IS A TRAIN OF BORES (see `mouthEdgeBore`).
   * Each edge row's series is the FFT sea's modes shoaled to the edge with no
   * loss; its rms height is measured on the series (MOUTH_EDGE_RMS_SPAN_S at
   * 0.25 s), and the series is scaled to the rms height Battjes and Janssen's
   * balance leaves at the edge along that row's path, the phases kept (one
   * gain a row: the model is a bulk law of the sea's height, not of each
   * wave). Round 3's series stood at Hs 2.42 m on the 0.72 m edge, troughs to
   * -2.65 m. The crest hold stays on top (a crest over the bore's height). */
  /* ROUND 13: on the deflected reach the edge has six times the rows; both rms heights (the series' and the law's)
   * vary along the shore on the coast's own scale (the shore's wander over 45 m, the bar's flanks over its 13 m
   * spread), so they are measured on at most MOUTH_EDGE_RMS_ROWS rows evenly spread (a 5 m stride on the Sarcelle's
   * 324 rows) and taken linearly between them. The straight valley's 54 rows keep every row. */
  const stride = design.course ? Math.max(1, Math.round(g.na / MOUTH_EDGE_RMS_ROWS)) : 1;
  const sub: number[] = [];
  for (let j = 0; j < g.na; j += stride) sub.push(j);
  if (sub[sub.length - 1] !== g.na - 1) sub.push(g.na - 1);
  const edgeLinSub = new Float64Array(sub.length);
  const edgeLawSub = new Float64Array(sub.length);
  // ROUND 14 (ruling 1): the sampled rows' series, kept for the infragravity band.
  const igN = Math.round(MOUTH_EDGE_RMS_SPAN_S / 0.25);
  const igOn = !coarse && design.infragravity !== false && design.tpS !== undefined;
  const subSer = igOn ? new Float64Array(sub.length * igN) : null;
  if (!coarse) {
    const wSub = sub.length === g.na ? waves : makeWaves(sub);
    const tmp = new Float64Array(sub.length);
    const s1 = new Float64Array(sub.length);
    const s2 = new Float64Array(sub.length);
    const nS = Math.round(MOUTH_EDGE_RMS_SPAN_S / 0.25);
    for (let k = 0; k < nS; k += 1) {
      wSub.heights(k * 0.25, tmp);
      for (let j = 0; j < sub.length; j += 1) { s1[j] += tmp[j]; s2[j] += tmp[j] * tmp[j]; }
      if (subSer !== null) for (let j = 0; j < sub.length; j += 1) subSer[j * igN + k] = tmp[j];
    }
    // Hrms = sqrt(8 m0) (Rayleigh heights, Longuet-Higgins 1952).
    for (let j = 0; j < sub.length; j += 1) edgeLinSub[j] = Math.sqrt(Math.max(s2[j] / nS - (s1[j] / nS) ** 2, 0)) * 2 * Math.SQRT2;
    for (let k = 0; k < sub.length; k += 1) edgeLawSub[k] = mouthEdgeBore(design, g.a0 + (sub[k] + 0.5) * g.da).hrmsM;
  }
  const edgeLin = new Float64Array(g.na);
  const edgeLaw = new Float64Array(g.na);
  const edgeGain = new Float64Array(g.na);
  for (let k = 0; k + 1 < sub.length || k === 0; k += 1) {
    const j0 = sub[k];
    const j1 = sub[Math.min(k + 1, sub.length - 1)];
    for (let j = j0; j <= j1; j += 1) {
      const t = j1 > j0 ? (j - j0) / (j1 - j0) : 0;
      const k1 = Math.min(k + 1, sub.length - 1);
      edgeLin[j] = edgeLinSub[k] + t * (edgeLinSub[k1] - edgeLinSub[k]);
      edgeLaw[j] = edgeLawSub[k] + t * (edgeLawSub[k1] - edgeLawSub[k]);
    }
    if (sub.length === 1) break;
  }
  for (let j = 0; j < g.na; j += 1) edgeGain[j] = edgeLin[j] > 1e-6 ? Math.min(edgeLaw[j] / edgeLin[j], 1) : 1;
  /* ROUND 14 (ruling 1): THE INFRAGRAVITY BAND on each sampled row from its own series at the law's gain (the groups
   * the edge forces), its height by Stockdon's S_ig through the face's standing long wave; taken linearly between
   * the sampled rows, and in time between the 0.25 s samples (periodic over the 600 s span). */
  let igAll: Float32Array | null = null;
  let igInfo: MouthSim['infragravity'] = null;
  if (subSer !== null) {
    const edges: InfragravityEdge[] = [];
    const ser = new Float64Array(igN);
    for (let k = 0; k < sub.length; k += 1) {
      const j = sub[k];
      const gk = edgeGain[j];
      for (let q = 0; q < igN; q += 1) ser[q] = subSer[k * igN + q] * gk;
      // The edge row's distance to the still-water shoreline: the first cell up the row whose bed stands over it.
      let iS = g.ns;
      for (let i = 0; i < g.ns; i += 1) if (bed[j * g.ns + i] >= 0) { iS = i; break; }
      // At the outlet's rows the bed stays under the still water into the channel: the profile ends at the coast's own
      // shoreline on the row (the mouth line), as on the rows beside it.
      const iCoast = Math.max(Math.round((shorelineS(design.params, design.frame, g.a0 + (j + 0.5) * g.da) - g.s0) / g.ds), 1);
      if (iS > iCoast + 5) iS = iCoast;
      // The row's still depths from the shoreline (0) seaward to the edge (the first cell's center, half a cell in).
      const prof = new Float64Array(iS + 1);
      for (let i = 0; i < iS; i += 1) prof[iS - i] = Math.max(-bed[j * g.ns + i], 0);
      prof[0] = 0;
      edges.push(infragravityEdge({ series: ser, dtS: 0.25, h0M: design.hsM, tpS: design.tpS!, depthM: dEdge[j], shoreDistM: iS * g.ds, profileM: prof, profileDxM: g.ds, manningN: mouthSandManningN(design) }));
    }
    const ig = new Float32Array(g.na * igN);
    const igGain = design.infragravityGain ?? MOUTH_IG_FIELD_GAIN;
    for (let k = 0; k + 1 < sub.length || k === 0; k += 1) {
      const j0 = sub[k];
      const k1 = Math.min(k + 1, sub.length - 1);
      const j1 = sub[k1];
      for (let j = j0; j <= j1; j += 1) {
        const t = j1 > j0 ? (j - j0) / (j1 - j0) : 0;
        const a0 = edges[k].etaM;
        const a1 = edges[k1].etaM;
        for (let q = 0; q < igN; q += 1) ig[j * igN + q] = (a0[q] + t * (a1[q] - a0[q])) * igGain;
      }
      if (sub.length === 1) break;
    }
    igAll = ig;
    igInfo = { rows: sub.slice(), edges };
  }
  const incident: IncidentFn = (t, out) => {
    inc0(t, out);
    if (igAll === null) {
      for (let j = 0; j < out.length; j += 1) out[j] = heldIncidentCrest(out[j] * edgeGain[j], dEdge[j]);
      return;
    }
    const u = (((t / 0.25) % igN) + igN) % igN;
    const q0 = Math.floor(u) % igN;
    const q1 = (q0 + 1) % igN;
    const fq = u - Math.floor(u);
    for (let j = 0; j < out.length; j += 1) {
      const ig = igAll[j * igN + q0] * (1 - fq) + igAll[j * igN + q1] * fq;
      out[j] = heldIncidentCrest(out[j] * edgeGain[j] + ig, dEdge[j]);
    }
  };
  // THE INFLOW: the head column's channel cells, each taking a share of the
  // discharge by its conveyance per unit width, y^(5/3) (Manning), y the
  // channel's depth profile there.
  const v = design.valley;
  const cells: number[] = [];
  const shares: number[] = [];
  const iIn = g.ns - 1;
  const dCourse = design.course;
  if (!dCourse) {
    for (let j = 0; j < g.na; j += 1) {
      const a = g.a0 + (j + 0.5) * g.da - design.mouthA;
      const t = Math.abs(a) / (v.widthM / 2);
      if (t >= 1) continue;
      const y = v.depthM * (1 - t ** v.shapeP);
      cells.push(j * g.ns + iIn);
      shares.push(y ** (5 / 3));
    }
  } else {
    // ROUND 13 (law 1): the river comes in across the grid's root edge (the shore's direction), over the channel's cells.
    // ROUND 15 (ruling 2): over the low-flow channel's cells, by its own section, where the design carries one.
    const jIn = dCourse.dirA === 1 ? g.na - 1 : 0;
    const lfIn = design.lowFlow;
    const halfIn = lfIn ? lfIn.widthM / 2 : v.widthM / 2;
    const depthIn = lfIn ? lfIn.depthM : v.depthM;
    for (let i = 0; i < g.ns; i += 1) {
      const ch = mouthChannelAt(design, g.s0 + (i + 0.5) * g.ds, g.a0 + (jIn + 0.5) * g.da);
      const t = ch.across / halfIn;
      if (t >= 1) continue;
      const y = depthIn * (1 - t ** v.shapeP);
      cells.push(jIn * g.ns + i);
      shares.push(y ** (5 / 3));
    }
  }
  const tot = shares.reduce((p, x) => p + x, 0);
  const field = new MouthField({
    grid: g, bed, manningN: design.manningN, dt: MOUTH_DT, incident,
    dischargeM3S: design.dischargeM3S,
    inflowCells: Int32Array.from(cells),
    inflowShare: Float64Array.from(shares.map((x) => x / tot)),
    // The water arrives with the mouth's mean speed (continuity, Q / A).
    inflowSpeedMS: design.u0MS,
    // ROUND 13: along the shore, toward the outlet, on the deflected course.
    ...(dCourse ? { inflowAlong: { axis: 'a' as const, sign: -dCourse.dirA as 1 | -1 } } : {}),
    // Round 5 (GG-394): the banks' sand, with the beach's laws.
    waterTable: mouthWaterTable(design, bed),
    // ROUND 14 (ruling 1): ONE SAND, ONE ROUGHNESS. The river's reach n (its own bed) in the channel, from its sea end up
    // (`mouthChannelAt`: across under the half width); the coast's sand elsewhere, at the beach's Strickler n.
    manningNCell: mouthManningCells(design),
  });
  // THE START GUESS: the river at its normal depth down the valley (Manning,
  // `channelNormalDepthM`) and the sea at rest, so the spin-up settles a
  // river that is already there rather than filling a dry valley.
  const yn = channelNormalDepthM(design);
  const an = channelAreaM2(design, yn);
  // ROUND 15 (ruling 2): on the low-flow channel the guess is the day's level and speed (the fill's top, `lowFlowChannelOf`).
  const lfG = design.lowFlow && design.course ? design.lowFlow : null;
  for (let j = 0; j < g.na; j += 1) {
    for (let i = 0; i < g.ns; i += 1) {
      // ROUND 13: by the channel's along and across (`mouthChannelAt`; the straight valley's s and a as before).
      const ch = mouthChannelAt(design, g.s0 + (i + 0.5) * g.ds, g.a0 + (j + 0.5) * g.da);
      if (ch.across >= v.widthM / 2 || ch.along <= 0) continue;
      const c = j * g.ns + i;
      const eta = lfG ? design.tideM + lfG.slope * Math.min(ch.along, design.course!.rootAlongM) : Math.max(ch.thal + yn, 0);
      const hh = Math.max(eta - bed[c], 0);
      if (hh <= 0) continue;
      const u = lfG ? lfG.speedMS : design.dischargeM3S / an;
      field.h[c] = hh;
      field.hu[c] = hh * u * ch.downS;
      if (ch.downA !== 0) field.hv[c] = hh * u * ch.downA;
      field.hc[c] = hh;
    }
  }
  /* ROUND 13: THE POND BEHIND THE SPIT, FROM A COARSE PRE-RUN. The deflected reach is a long pond at the level the
   * outlet holds (mouth13/probe/spinConv13.ts: 8.4 cm over the still water, flat within 2 mm over 300 m, against the
   * start guess's 0); the day's flow fills it in the long-wave rule's 259 s, and a 60 s spin-up from the guess leaves
   * the level 65 mm rms off. The rule's spin-up runs first on the same reach at MOUTH_COARSE_FACTOR times the cell
   * (the same laws, the bed sampled at the coarse cells' centers), and the fine field starts from its level, flow and
   * river water (each fine cell from the coarse cell it lies in, where that cell is wet); the fine field then spins
   * up MOUTH_SPINUP_S at its own cells. The straight valley keeps its one spin-up. */
  let spinS = spinUpS;
  let coarseSpinS = 0;
  if (design.course && !coarse && spinUpS > MOUTH_SPINUP_S) {
    const k = MOUTH_COARSE_FACTOR;
    const gc: SwashGridSpec = { s0: g.s0, ds: g.ds * k, ns: Math.ceil(g.ns / k), a0: g.a0, da: g.da * k, na: Math.floor(g.na / k) };
    const csSim = createMouthSim({ ...design, grid: gc }, cascades, n, seed, spinUpS, undefined, { coarse: true });
    const cs = csSim.field;
    coarseSpinS = csSim.spinUpS ?? spinUpS;
    for (let j = 0; j < g.na; j += 1) {
      const jc = Math.min(Math.floor(j / k), gc.na - 1);
      for (let i = 0; i < g.ns; i += 1) {
        const ic = Math.min(Math.floor(i / k), gc.ns - 1);
        const cc = jc * gc.ns + ic;
        const hcC = cs.h[cc];
        if (hcC <= MOUTH_H_DRY) continue;
        const c = j * g.ns + i;
        const hh = Math.max(cs.bed[cc] + hcC - bed[c], 0);
        field.h[c] = hh;
        field.hu[c] = (hh * cs.hu[cc]) / hcC;
        field.hv[c] = (hh * cs.hv[cc]) / hcC;
        field.hc[c] = (hh * cs.hc[cc]) / hcC;
      }
    }
    spinS = MOUTH_SPINUP_S;
  }
  // THE SPIN-UP, the sea still, at its own fixed step.
  field.waves = false;
  field.dt = mouthSpinUpDt(g.ds);
  const steps = Math.round(spinS / field.dt);
  for (let k = 0; k < steps; k += 1) field.advance(0);
  // ROUND 14: the coarse pre-run of a deflected reach runs on to the pond's steady level (see MOUTH_STEADY_SHARE).
  let steadyS = spinS;
  if (coarse && design.course) {
    const cellA = g.ds * g.da;
    const stored = (): number => { let s = 0; for (let c = 0; c < nc; c += 1) s += field.h[c]; return s * cellA; };
    const chunk = Math.round(MOUTH_STEADY_CHUNK_S / field.dt);
    let v0 = stored();
    while (steadyS < MOUTH_STEADY_MAX_S) {
      for (let k = 0; k < chunk; k += 1) field.advance(0);
      steadyS += chunk * field.dt;
      const v1 = stored();
      const rate = Math.abs(v1 - v0) / (chunk * field.dt);
      v0 = v1;
      if (rate < MOUTH_STEADY_SHARE * design.dischargeM3S) break;
    }
  }
  field.dt = MOUTH_DT;
  field.waves = true;
  field.step = 0;
  const l = field.ledger;
  l.riverIn = 0; l.seaIn = 0; l.seaOut = 0; l.clipped = 0; l.tracerOut = 0; l.tracerIn = 0; l.tracerClipped = 0; l.sideOut = 0; l.tracerSideOut = 0;
  if (field.soil !== null) { l.soaked = 0; l.tracerSoaked = 0; }
  for (let c = 0; c < nc; c += 1) field.foam[c] = 0;
  /* ROUND 14 (ruling 1): THE SWASH ZONE'S SAND AT THE START. The spin-up runs with the sea still, so the sand starts at
   * its equilibrium with the water table everywhere and its skin dry over the platform, as if the day's sea had just
   * begun. The scene's sea has run for hours: every cell of the face and the platform under the day's run-up reach
   * (Stockdon's R2 over the still water, the face's 1:11) is wetted every few waves, and between two overwashes its
   * skin stays saturated (the sand drains its skin over minutes, `MouthSoil`; the overwash returns in tens of
   * seconds). Those cells start with the skin saturated and the water just gone; the field's own swash and drain-down
   * run from there. The coarse pre-run keeps the equilibrium (it draws nothing). */
  if (!coarse && field.soil !== null && design.tpS !== undefined && design.params.island) {
    const r2 = stockdonRunup2(design.hsM, design.tpS, design.params.island.faceSlope).r2;
    const soil = field.soil;
    for (let c = 0; c < nc; c += 1) {
      if (bed[c] >= 0 && bed[c] < r2 && soil.cap1[c] > 0) { soil.w1[c] = soil.cap1[c]; soil.dryS[c] = 0; }
    }
  }
  const start = field.snapshot();
  return {
    design, field, waves, start, edgeBore: { hrmsLinearM: edgeLin, hrmsLawM: edgeLaw, gain: edgeGain }, handoverS: mouthHandoverStarts(design, edgeLaw), infragravity: igInfo,
    spinUpS: coarseSpinS + steadyS,
  };
}

/** The channel's flow area under a depth y over its thalweg, m^2 (the |n / half|^p section, banks past its top). */
export function channelAreaM2(d: MouthDesign, y: number): number {
  const half = d.widthM / 2;
  const p = d.shapeP;
  if (y <= d.depthM) {
    const t = (y / d.depthM) ** (1 / p);
    return 2 * half * (y * t - (d.depthM * t ** (p + 1)) / (p + 1));
  }
  const full = 2 * half * (d.depthM - d.depthM / (p + 1));
  const over = y - d.depthM;
  return full + over * (2 * half + over / d.bankSlope);
}

/**
 * THE NORMAL DEPTH of the river in its valley, m over the thalweg: the depth
 * at which Manning's law carries the discharge down the river's slope,
 * Q = A R^(2/3) S^(1/2) / n, R = A / P with P the wetted width (a wide
 * channel), by bisection.
 */
export function channelNormalDepthM(d: MouthDesign): number {
  const half = d.widthM / 2;
  const q = (y: number): number => {
    const a = channelAreaM2(d, y);
    const wet = y <= d.depthM ? 2 * half * (y / d.depthM) ** (1 / d.shapeP) : d.widthM + 2 * (y - d.depthM) / d.bankSlope;
    const r = a / Math.max(wet, 1e-6);
    return (a * r ** (2 / 3) * Math.sqrt(d.slope)) / d.manningN;
  };
  let lo = 1e-4;
  let hi = 5 * d.depthM + 1;
  for (let k = 0; k < 80; k += 1) {
    const mid = (lo + hi) / 2;
    if (q(mid) < d.dischargeM3S) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The mouth's clock: bring the field to a time, from checkpoints, at the fixed step. */
export class MouthClock {
  private readonly checkpoints = new Map<number, MouthState>();
  constructor(readonly sim: MouthSim, readonly checkpointS = 5, readonly keep = 40) {}

  stepFor(t: number): number {
    return Math.max(Math.floor(t / this.sim.field.dt + 1e-6), 0);
  }

  advanceTo(t: number, budget = Infinity): { steps: number; reached: boolean } {
    const f = this.sim.field;
    const target = this.stepFor(t);
    if (target < f.step) {
      let best: MouthState | null = null;
      for (const s of this.checkpoints.values()) if (s.step <= target && (!best || s.step > best.step)) best = s;
      f.restore(best ?? this.sim.start);
    }
    const every = Math.max(Math.round(this.checkpointS / f.dt), 1);
    let steps = 0;
    while (f.step < target && steps < budget) {
      f.advance();
      steps += 1;
      if (f.step % every === 0 && !this.checkpoints.has(f.step)) {
        this.checkpoints.set(f.step, f.snapshot());
        if (this.checkpoints.size > this.keep) {
          const keys = [...this.checkpoints.keys()].sort((a, b) => a - b);
          this.checkpoints.delete(keys[1] ?? keys[0]);
        }
      }
    }
    return { steps, reached: f.step >= target };
  }
}
