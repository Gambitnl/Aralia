/**
 * @file oceanWakeFoam.ts
 * The original stern churn, breaking and foam deposits along a hull course.
 * Their physical constants, age rules and CPU deposit mirror remain unchanged.
 * The old oceanWakeMath entry preserves every legacy consumer.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:15:52
 * Dependents: systems/world3d/ocean/oceanWakeMath.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type WakeHull, smoothstep, type WakeSegment, hullHalfBreadth, type WakeGrid } from './oceanWakeWaves';


/* ------------------------------------------------------------------ */
/* The white water                                                     */
/* ------------------------------------------------------------------ */

/**
 * THE STERN CHURN: the propeller race and the broken flow off the transom.
 *
 * The foam AMOUNT is the share of the water the foam covers: the surface's
 * lace is equalized (`wakeLaceCdfTable`) so an amount of 0.6 whitens 60% of
 * it, in rafts with holes, and 1 or more is solid.
 *
 *   PEAK     the trail's amount, without the boil, just aft of the
 *            transom: 0.9. With round 2's raft lace (large gaps, rafts,
 *            popped cells, speckle) and its see-through thin foam, 0.9
 *            leaves a lace with open gaps a few beams back; round 1's
 *            punched-hole lace at the same 0.9 read to both blind critics
 *            as one opaque sheet. (Swept: 0.75 broke the chase view's
 *            trail into two thin ribbons by 20 m.)
 *   TAU_S    e-folding time of the white water, seconds. A natural
 *            whitecap's foam decays in 2 to 12 s (Callaghan, Deane and
 *            Stokes 2012); a propeller drives its bubbles 2 to 3 m down,
 *            the draft, and they take longer to rise: 10 s, 60 m at 6 m/s.
 *            (Round 1 had 16 s, and the chase crop, 20 to 36 m behind the
 *            stern, lost only a sixth of its amount across it.) The bubble
 *            cloud under the trail outlasts it (WAKE_BUBBLE_TAU_S).
 *   HALF_WIDTH  the profile's width at the transom over the beam: 0.45 B,
 *            the transom's own half-breadth (0.375 B) and a little of the
 *            race beside it.
 *   GROWTH, GROWTH_M   the turbulent wake widens as (1 + d / GROWTH_M)^0.35:
 *            1.3 times one hull length back, 1.8 times five back. Far
 *            behind a hull the wake spreads as d^(1/5) to d^(1/3) (Reed and
 *            Milgram 2002). Round 1's (1 + d / 15)^0.4 made the quarter
 *            view's trail cover two thirds of its crop; the critic asked
 *            for "a narrower trail with a dense core".
 */
export const WAKE_STERN_FOAM_PEAK = 0.9;
/**
 * THE BOIL. Right aft of the transom the propeller race and the water
 * closing in behind the hull throw up a mound of solid white, which thins
 * to the trail within about half a hull length (photographs of trawlers at
 * service speed): the amount there is raised by BOIL e^{-d / BOIL_M}: 2.0
 * at the transom, 1.25 at 10 m, 0.89 at 20 m, 0.57 at 36 m. So the white
 * water ages on screen: a solid core at the stern, lace a few beams back,
 * rafts and ribbons by the end of the chase crop.
 */
export const WAKE_STERN_BOIL = 1.1;
export const WAKE_STERN_BOIL_M = 12;
/**
 * The boil is narrower than the trail: 0.6 of its width. The race is the
 * propeller's jet, a core in the middle of the churn; at the trail's full
 * width the solid white reached the churn's edges and drew them as one
 * clean curve along the stern wave's crest (the round-1 quarter critic).
 */
export const WAKE_STERN_BOIL_WIDTH = 0.6;
export const WAKE_STERN_FOAM_TAU_S = 10;
export const WAKE_STERN_HALF_WIDTH = 0.45;
export const WAKE_STERN_GROWTH = 0.35;
export const WAKE_STERN_GROWTH_M = 20;

/**
 * THE BREAKING WAVES. Where the wake's own waves are steep enough they
 * spill, and the water they spill onto keeps the foam as the hull moves
 * on. A regular wave's slope amplitude is its steepness ak; Stokes' limit
 * is ak = 0.44, and spilling begins well under it, from about 0.3 (Duncan
 * 1983 measured the steady breakers behind a towed hydrofoil at H / lambda
 * about 0.1, ak = 0.31). The field here is linear, and a real crest of
 * linear slope ak is sharpened by its second harmonic to about ak (1 + ak)
 * (Stokes): a linear 0.22 is a true 0.27, a linear 0.40 a true 0.56, past
 * the limit. So a crest breaks from linear slope 0.22 and fully at 0.40:
 * that lights the stern wave and the first diverging crests beside the
 * hull, and nothing past a hull length or two, which is where a
 * displacement hull's waves stop breaking.
 *
 *   FOAM_PER_S   foam a point gains per second under a full breaker, as an
 *                optical depth: the cover is COVER_MAX (1 - e^{-F}), so water
 *                that keeps breaking saturates instead of piling up (behind
 *                the transom the stern wave breaks over 10 m, and a plain
 *                sum put an amount of 4 there, a sheet of paint). A diverging
 *                crest 2 to 3 m wide passes a point in 0.4 s at 6 m/s; 3 per
 *                second gives it F = 1.2, a cover of 0.56.
 *   COVER_MAX    the most the breakers cover: 0.35, so a spilling crest's
 *                foam is lace and streaks beside the churn, not a second
 *                sheet. At 0.8 the side sheets joined the churn and the
 *                quarter view's trail filled two thirds of the crop, its
 *                top edge one clean curve along the crest (both named by
 *                the round-1 critic).
 *   TAU_S        the spilled foam decays as a small whitecap's does,
 *                2.5 s, the short end of Callaghan et al.'s 2 to 12 s: a
 *                spilling breaker entrains little air. So a crest's foam
 *                trails 15 m aft of it and the crest itself, the active
 *                breaker, is the white line of the V.
 *   ACTIVE       the cover ON a breaking crest: the whitecap while it
 *                spills, 0.3 of the breaking rate. At 0.85 the crest's front
 *                was a hard white line along the ridge, "the edge of a
 *                decal" to a guidance critic, and at 0.5 still one clean
 *                curve; the deposit behind it builds up over the crest's
 *                width and gives the front its ramp.
 *   BUBBLE_TAU_S its bubble cloud, shallow, clears in 10 s.
 *   REACH_S      how far back along the track the kernel sums: three decay
 *                times, 5% left.
 */
export const WAKE_BREAK_SLOPE_LO = 0.22;
export const WAKE_BREAK_SLOPE_HI = 0.4;
export const WAKE_BREAK_FOAM_PER_S = 3;
export const WAKE_BREAK_COVER_MAX = 0.35;
export const WAKE_BREAK_TAU_S = 2.5;
export const WAKE_BREAK_ACTIVE = 0.3;
export const WAKE_BREAK_BUBBLE_TAU_S = 10;
export const WAKE_BREAK_REACH_S = 3 * WAKE_BREAK_TAU_S;
/**
 * Meters outside the waterline where the wave field is not trusted to
 * break: under the hull the pressure patch's depression is steep but it is
 * the hull, not a wave. The patch is Gaussian with sigma B / 4, so its wall
 * is inside 0.5 m of the waterline.
 */
export const WAKE_BREAK_HULL_MARGIN_M = 0.5;

/**
 * THE BOW'S OWN BREAKER. The water a stem runs into is stopped and rises by
 * its stagnation head, U^2 / 2g = 1.8 m at 6 m/s, and spills along the
 * flare: the "bone in the teeth" of a hull at speed. The pressure patch
 * holds the hull's displacement, not that stagnation, so the linear field
 * has no crest there, and the contact breaker is added: a band out to
 * BAND_M from the waterline along the forward FORE_SHARE of the hull,
 * strongest at the stem and gone at the end of the share.
 */
export const WAKE_BOW_BAND_M = 1.6;
export const WAKE_BOW_FORE_SHARE = 0.32;

/**
 * The bow's contact breaking rate at hull-frame x (from the hull's center)
 * and offset `outM` from the waterline.
 */
export function wakeBowBreaking(hull: WakeHull, xM: number, outM: number): number {
  const L = hull.lengthM;
  const along = smoothstep(L / 2 - WAKE_BOW_FORE_SHARE * L, L / 2 - 0.04 * L, xM)
    * (1 - smoothstep(L / 2 + 0.5, L / 2 + 2.5, xM));
  const across = smoothstep(-0.3, 0.1, outM) * (1 - smoothstep(0.4 * WAKE_BOW_BAND_M, WAKE_BOW_BAND_M, outM));
  return along * across;
}

/**
 * THE BUBBLE CLOUD. Bubbles under the white water scatter light, so an old
 * wake shows as a paler, greener lane after its foam has gone. Bubbles of
 * 0.1 to 1 mm rise at 1 to 10 cm/s, so a cloud 2 m deep clears in about
 * half a minute: 30 s, 180 m at 6 m/s. The lane is 1.5 times the churn's
 * width, because the cloud spreads under the surface as well.
 */
export const WAKE_BUBBLE_TAU_S = 30;
export const WAKE_BUBBLE_WIDTH = 1.5;

/** The white water at one point of the window. */
export interface WakeFoamSample {
  /** Foam amount (coverage): 0 none, 1 solid. */
  foam: number;
  /** Bubble cloud, 0 to 1. */
  bubbles: number;
  /** The course's direction of motion at the nearest point, window frame. */
  tanU: number;
  tanV: number;
  /** Seconds since the hull's center passed the nearest point (negative ahead of it). */
  ageS: number;
  /** Signed distance from the track, meters (+ toward the window's +v). */
  lateralM: number;
  /** Course distance from the hull's center back to the nearest point, meters. */
  behindM: number;
  /** True inside the hull's waterline. */
  inside: boolean;
}

/**
 * The stern churn at window point (u, v).
 *
 * The nearest point of the course gives how far behind the hull the water
 * is, how far to the side, and how long ago the hull passed. The first
 * piece is extended ahead of the hull so the water beside the bow gets a
 * negative distance. Aft of the transom the churn is PEAK e^{-t/TAU} over a
 * profile e^{-(|n| / w)^2}, w growing with distance; no foam inside the
 * waterline (`hullHalfBreadth`). Gaussian, not flat-topped: the reference
 * band's edges thin out over a third of its width.
 *
 * THE UNPACK KERNEL MIRRORS THIS FUNCTION. Keep them identical.
 */
export function wakeFoamAt(
  uM: number, vM: number, segs: readonly WakeSegment[], hull: WakeHull, out?: WakeFoamSample,
): WakeFoamSample {
  const o: WakeFoamSample = out ?? {
    foam: 0, bubbles: 0, tanU: 1, tanV: 0, ageS: 0, lateralM: 0, behindM: 0, inside: false,
  };
  let best = Infinity;
  let age = 0;
  let behind = 0;
  let lateral = 0;
  let tu = 1;
  let tv = 0;
  let speed = 1;
  for (let j = 0; j < segs.length; j += 1) {
    const s = segs[j];
    // From the young end toward the old end.
    const eu = s.vu * s.durS;
    const ev = s.vv * s.durS;
    const len2 = Math.max(eu * eu + ev * ev, 1e-12);
    let mu = ((uM - s.du) * eu + (vM - s.dv) * ev) / len2;
    if (j > 0) mu = Math.max(mu, 0);
    mu = Math.min(mu, 1);
    const qu = s.du + mu * eu;
    const qv = s.dv + mu * ev;
    const d2 = (uM - qu) * (uM - qu) + (vM - qv) * (vM - qv);
    if (d2 < best) {
      best = d2;
      age = s.ageS + mu * s.durS;
      behind = s.arcM + mu * Math.sqrt(len2);
      // Motion direction (cosH, sinH); lateral = cross(motion, P - Q).
      lateral = s.cosH * (vM - qv) - s.sinH * (uM - qu);
      tu = s.cosH;
      tv = s.sinH;
      speed = s.speedMs;
    }
  }
  o.tanU = tu;
  o.tanV = tv;
  o.ageS = age;
  o.lateralM = lateral;
  o.behindM = behind;
  const L = hull.lengthM;
  const B = hull.beamM;
  const n = Math.abs(lateral);
  const u = Math.max(speed, 0.5);
  const xi = -behind / (L / 2);
  o.inside = xi > -1 && xi < 1 && n < hullHalfBreadth(hull, xi);

  const dStern = Math.max(behind - L / 2, 0);
  const t = dStern / u;
  const w = WAKE_STERN_HALF_WIDTH * B * Math.pow(1 + dStern / WAKE_STERN_GROWTH_M, WAKE_STERN_GROWTH);
  const ramp = smoothstep(0, 1.5, behind - L / 2);
  const r = n / w;
  const rc = r / WAKE_STERN_BOIL_WIDTH;
  const churn = (WAKE_STERN_FOAM_PEAK * Math.exp(-t / WAKE_STERN_FOAM_TAU_S) * Math.exp(-r * r)
    + WAKE_STERN_BOIL * Math.exp(-dStern / WAKE_STERN_BOIL_M) * Math.exp(-rc * rc)) * ramp;
  const rb = n / (WAKE_BUBBLE_WIDTH * w);
  const bubbles = Math.exp(-t / WAKE_BUBBLE_TAU_S) * Math.exp(-rb * rb) * ramp;
  o.foam = o.inside ? 0 : churn;
  o.bubbles = o.inside ? 0 : bubbles;
  return o;
}

/**
 * The breaking rate at one texel, 0 to 1: the wake's slope magnitude mapped
 * through the spilling band, on a crest (eta > 0) only, and never on the
 * hull or within WAKE_BREAK_HULL_MARGIN_M outside its waterline; and the
 * bow's contact breaker (`wakeBowBreaking`), whichever is more.
 *
 * THE UNPACK KERNEL MIRRORS THIS FUNCTION. Keep them identical.
 */
export function wakeBreaking(etaM: number, slope: number, lateralM: number, behindM: number, hull: WakeHull): number {
  const x = -behindM;
  const xi = x / (hull.lengthM / 2);
  const halfB = xi > -1 && xi < 1 ? hullHalfBreadth(hull, xi) : 0;
  const n = Math.abs(lateralM);
  const bow = wakeBowBreaking(hull, x, n - halfB);
  if (halfB > 0 && n < halfB + WAKE_BREAK_HULL_MARGIN_M) return bow;
  const wave = etaM > 0 ? smoothstep(WAKE_BREAK_SLOPE_LO, WAKE_BREAK_SLOPE_HI, slope) : 0;
  return Math.max(wave * wakeBreakingReach(hull, behindM, n), bow);
}

/**
 * Where the wave field's breaking counts: the hull's own wedge. From 3 m
 * ahead of the stem back WAKE_BREAK_REACH_L hull lengths, and out to the
 * half-beam plus 0.4 of the distance behind the stem (a 22 degree side,
 * past Kelvin's 19.5), fading over 6 m. The deposit sweeps foam aft as if
 * every breaker stood still under the hull, which is true of the hull's
 * steady waves and false of anything else in the field: a touch's rings
 * broke, and their foam was swept into a phantom lane beside the track
 * (the first touch capture). The hull's crests stop breaking well inside
 * the reach (the tests find none past four hull lengths).
 */
export const WAKE_BREAK_REACH_L = 6;
export function wakeBreakingReach(hull: WakeHull, behindM: number, lateralAbsM: number): number {
  const L = hull.lengthM;
  const fromStem = behindM + L / 2;
  const edge = hull.beamM / 2 + 0.4 * Math.max(fromStem, 0);
  return smoothstep(-3, -1, fromStem)
    * (1 - smoothstep(edge, edge + 6, lateralAbsM))
    * (1 - smoothstep(0.8 * WAKE_BREAK_REACH_L * L, WAKE_BREAK_REACH_L * L, behindM));
}

/**
 * The hull's half-breadth envelope at hull-frame x: the widest the hull has
 * been from the stem back to x. Forward of midship it is the half-breadth
 * (the hull still widens going aft); from midship aft it is B / 2. Water
 * that met the hull at the bow is pushed out to this envelope and runs
 * on past it.
 */
export function hullEnvelope(hull: WakeHull, xM: number): number {
  if (xM <= 0) return hull.beamM / 2;
  return hullHalfBreadth(hull, xM / (hull.lengthM / 2));
}

/**
 * The foam the breaking waves leave, per texel of the window: at texel i,
 * the sum over the texels m ahead of it along its streamline of their
 * breaking rate D, each the time a parcel spends under it (texel / U) and
 * m texels / U old:
 *
 *   F(i) = FOAM_PER_S dt SUM_m D(i + m, j'(m)) e^{-m dt / TAU},  dt = texel / U
 *   cover = max(COVER_MAX (1 - e^{-F}), ACTIVE D(i))
 *
 * THE STREAMLINE. A parcel keeps its offset from the hull's envelope
 * (`hullEnvelope`) as the hull passes: water the stem splits is pushed out
 * as the hull widens, so the bow's white water runs back along the flanks
 * and trails past the transom at the full beam, as a hull's does, instead
 * of being left inside the hull's own track. The shift fades as
 * e^{-offset / B}, since the hull moves the water beside it and not the
 * water a beam out. So the texel m ahead is looked up in the row
 * j + (env(x + m) - env(x)) e^{-offset / B} / texel, on the parcel's side.
 *
 * Exact for a hull on a straight course, whose breakers stand still in the
 * window while the water runs aft; in a turn the rows follow the chord, an
 * approximation, stated. Inside the waterline there is no water: 0.
 *
 * THE DEPOSIT KERNEL MIRRORS THIS FUNCTION. Keep them identical.
 */
export function wakeDepositCpu(
  breaking: Float64Array, lateral: Float64Array, behind: Float64Array,
  grid: WakeGrid, speedMs: number, hull: WakeHull,
): { foam: Float64Array; bubbles: Float64Array } {
  const { nu, nv, texelM } = grid;
  const dt = texelM / Math.max(speedMs, 0.5);
  const reach = Math.ceil(WAKE_BREAK_REACH_S / dt);
  const kf = Math.exp(-dt / WAKE_BREAK_TAU_S);
  const kb = Math.exp(-dt / WAKE_BREAK_BUBBLE_TAU_S);
  const foam = new Float64Array(nu * nv);
  const bubbles = new Float64Array(nu * nv);
  for (let j = 0; j < nv; j += 1) {
    for (let i = 0; i < nu; i += 1) {
      const c = j * nu + i;
      const x0 = -behind[c];
      const n0 = lateral[c];
      const env0 = hullEnvelope(hull, x0);
      const off = Math.abs(n0) - env0;
      const inside = Math.abs(x0) < hull.lengthM / 2 && Math.abs(n0) < hullHalfBreadth(hull, x0 / (hull.lengthM / 2));
      if (inside) continue;
      const side = n0 < 0 ? -1 : 1;
      const keep = Math.exp(-Math.max(off, 0) / hull.beamM);
      let f = 0;
      let bb = 0;
      let wf = 1;
      let wb = 1;
      for (let m = 0; m <= reach && i + m < nu; m += 1) {
        const shift = (hullEnvelope(hull, x0 + m * texelM) - env0) * keep * side;
        const jj = Math.min(nv - 1, Math.max(0, j + Math.round(shift / texelM)));
        const d = breaking[jj * nu + i + m];
        f += d * wf;
        bb += d * wb;
        wf *= kf;
        wb *= kb;
      }
      foam[c] = Math.max(
        WAKE_BREAK_COVER_MAX * (1 - Math.exp(-WAKE_BREAK_FOAM_PER_S * dt * f)),
        WAKE_BREAK_ACTIVE * breaking[c],
      );
      bubbles[c] = 1 - Math.exp(-0.6 * WAKE_BREAK_FOAM_PER_S * dt * bb);
    }
  }
  return { foam, bubbles };
}

/**
 * THE LACE'S SHAPE ON SCREEN (the read in oceanWake.ts mirrors this): for
 * a flat plane seen from height h at horizontal range d, with the view
 * azimuth phi against the flow, one pixel's footprint is long along the
 * view (1 / sin e, tan e = h / d) and unit across it; its extent along the
 * flow squared is cos^2 phi / sin^2 e + sin^2 phi and across the flow
 * sin^2 phi / sin^2 e + cos^2 phi, and the ratio across over along is
 * r^2 = (h^2 + d^2 sin^2 phi) / (h^2 + d^2 cos^2 phi). Along the flow it
 * is sin e; across it, 1 / sin e.
 */
export function wakeSideRatio(hM: number, dM: number, phiRad: number): number {
  const h2 = hM * hM;
  const d2 = dM * dM;
  const s = Math.sin(phiRad);
  const c = Math.cos(phiRad);
  return Math.sqrt((h2 + d2 * s * s) / Math.max(h2 + d2 * c * c, 1e-12));
}

/**
 * THE MIX OF TWO UNIFORM READS, MADE UNIFORM AGAIN (the read in oceanWake.ts
 * mirrors this). sideStretch mixes two reads of the ranked raft channel,
 * m = (1 - w) a + w b with a and b uniform on [0, 1]; m is trapezoidal, so
 * a threshold of it would cover more of a dense trail and less of a thin
 * one than the same threshold of one read. Its distribution function, for
 * p = min(w, 1 - w) and q = max(w, 1 - w): x^2 / (2 p q) under p,
 * (x - p / 2) / q up to q, 1 - (1 - x)^2 / (2 p q) to 1. Applied to m it
 * returns a uniform value, so the cover at a given amount is the same at
 * every view. At w 0 or 1 it is the identity.
 */
export function wakeMixUniformCdf(x: number, w: number): number {
  const p = Math.min(w, 1 - w);
  const q = Math.max(w, 1 - w);
  if (p < 1e-6) return x;
  const xx = Math.min(Math.max(x, 0), 1);
  if (xx < p) return (xx * xx) / (2 * p * q);
  if (xx < q) return (xx - p / 2) / q;
  return 1 - ((1 - xx) * (1 - xx)) / (2 * p * q);
}

/**
 * NO FACET TURNS ITS BACK TO THE EYE (the read in oceanWake.ts mirrors this).
 * The wake's slope along the horizontal direction away from the camera,
 * `along`, saturated smoothly at `cap` (a share of the view ray's
 * elevation, tan e) past a `knee` (a smaller share, 0 in round 3): under
 * the knee the slope is itself; over it, the excess is squashed as
 * x c / (c + x) with c = cap - knee, so the slope never reaches the cap
 * and the wake alone never tilts a facet past the view ray. A slope toward
 * the eye is unchanged. Continuous at the knee, with slope 1 there. Round
 * 4 added the knee: from zero, the cap bent every slope the chase view
 * sees (its elevation is high, so no facet there could turn away).
 */
export function wakeCapAlong(along: number, cap: number, knee = 0): number {
  if (along <= knee) return along;
  const c = Math.max(cap - knee, 1e-6);
  const x = along - knee;
  return knee + (x * c) / (c + x);
}
