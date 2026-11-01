/**
 * @file oceanMouthCoast.ts
 * Derives the coast, channel and spit design from the existing place inputs.
 * Sizing, sediment optics choices and geometry equations keep their original
 * order and values. No source geometry or live scene is changed by this move.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:30:33
 * Dependents: systems/world3d/ocean/oceanMouthMath.ts, systems/world3d/ocean/oceanMouthSimulation.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type CascadeParams } from './oceanConfig';
import { forcingCascades, type BeachFrame, beachToWorld, IncidentWaves, stockdonRunup2, MEDIUM_SAND_D50_M, type SwashGridSpec, BEACH_GRID, beachFrameOf, BATHY_BORE_GAMMA, BATHY_BREAK_FULL, G } from './oceanBeachMath';
import { type SurfCoast, type MouthDesign, type MouthPlace, type LongshoreDrift, type DeflectedSpit, type LowFlowChannel, type DeflectedCourse } from './oceanMouthTypes';
import { type SeabedParams, islandFrameAt, LAGOON_CAY, LAGOON_SEABED, type SeabedValley, seabedPointAt, type SeabedCourse, courseNearest } from './oceanSeabedMath';
import { HG_WIDTH_A, HG_WIDTH_B, ratingCurveGM3, RIVER_OUTLET_S, HG_DEPTH_C, HG_DEPTH_F, SAND_REPOSE_RAD, SED_ABSORB_SLOPE_NM, SED_ABSORB_443_M2_G } from './oceanMouthLaws';
import { RIVER_DISCHARGE_M3S, getRiverShape, courseKeyAt } from '../river/riverReach';
import { bandPeriodS, swashBarCrestM, mouthHandoverLengthM, mouthBands, MCCOWAN_GAMMA } from './oceanMouthWaveMath';
import { deanProfileA, coastBreakRef, frictionJet, sandFallSpeedMS, SUSPENDED_D50_M, jetDeposit, vanRijnCritSpeedMS, jetProfileAt, SAND_REL_DENSITY } from './oceanMouthTransport';
import { mouthPlaceConditions, placeRiverWindMS } from './oceanMouthConditions';
import { sedimentSlopeForHue, srgbToLinear, type TurbidOptics, type RiverIop, turbidOptics, riverIopForReflectance, turbidOpticsIop } from './oceanMouthOptics';


/**
 * ROUND 12 (gap 2; the lead's ruling 2): THE DAY'S SEA. The clip's bar stands bare with thin sheets where our swash
 * covered it 96 % of the time at the sea state's height (round 11: the edge's Hrms 0.65 m), so the clip's day ran
 * smaller waves than the sea state's mean. A sea on one day differs from the mean by the energy its swell and its
 * wind sea carry (a swell keeps a share of its storm's energy: Snodgrass et al. 1966, the sea states'
 * `energyScale`), not by its periods. The day's sea is the sea state with each FORCED band's energy (the bands the
 * near fields carry, `forcingCascades`) times `energy`: the same modes, phases and periods, each height times
 * sqrt(energy). The wind-locked bands (the ripple) are the wind's and stay. 1 returns the cascades unchanged.
 */
export function daySeaCascades(cascades: readonly CascadeParams[], energy: number): CascadeParams[] {
  if (energy === 1) return cascades.slice();
  const forced = forcingCascades(cascades);
  return cascades.map((c) => (forced.includes(c.name) ? { ...c, energyScale: (c.energyScale ?? 1) * energy } : c));
}
/** The coast's sea statistics on the day: the forced bands' heights times sqrt(energy), the periods and the floor kept. */
export function daySeaCoast(mean: SurfCoast, cascades: readonly CascadeParams[], energy: number): SurfCoast {
  const forced = forcingCascades(cascades);
  const g = Math.sqrt(energy);
  const bandHsM: Record<string, number> = {};
  for (const [k, v] of Object.entries(mean.bandHsM)) bandHsM[k] = forced.includes(k) ? v * g : v;
  return { ...mean, hsM: mean.hsM * g, bandHsM };
}

/** The still-water shoreline's s on the beach frame's line a, by bisection on the island's frame. */
/** ROUND 13: the mean-sea shoreline's s at a place's a, on the design's coast (the judged pose's and the probes' read). */
export function shorelineSOf(d: MouthDesign, a: number): number {
  return shorelineS(d.params, d.frame, a);
}
export function shorelineS(params: SeabedParams, frame: BeachFrame, a: number): number {
  const isl = params.island!;
  let lo = -30;
  let hi = 30;
  for (let k = 0; k < 60; k += 1) {
    const mid = (lo + hi) / 2;
    const [x, z] = beachToWorld(frame, mid, a);
    if (islandFrameAt(isl, x, z).s < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The sea's significant height and zero-up-crossing period at a point, from
 * the FFT sea's own height on the CPU (the beach's `IncidentWaves`: the same
 * cascades, share and modes as the beach worker), over `spanS` seconds.
 */
export function seaStatsAt(
  cascades: readonly CascadeParams[], n: number, seed: number, x: number, z: number, spanS = 1200, everyS = 0.1,
  use: readonly string[] = forcingCascades(cascades),
): { hsM: number; tzS: number } {
  const waves = new IncidentWaves({
    cascades, n, seed, use, share: 0.95, maxModes: 700,
    px: Float64Array.of(x), pz: Float64Array.of(z),
  });
  const out = new Float64Array(1);
  const steps = Math.round(spanS / everyS);
  let s1 = 0;
  let s2 = 0;
  let ups = 0;
  let prev = 0;
  for (let k = 0; k <= steps; k += 1) {
    waves.heights(k * everyS, out);
    const e = out[0];
    s1 += e;
    s2 += e * e;
    if (k > 0 && prev < 0 && e >= 0) ups += 1;
    prev = e;
  }
  const m = s1 / (steps + 1);
  const sd = Math.sqrt(Math.max(s2 / (steps + 1) - m * m, 0));
  return { hsM: 4 * sd, tzS: ups > 0 ? spanS / ups : Infinity };
}

/* ------------------------------------------------------------------ */
/* The surf coast                                                        */
/* ------------------------------------------------------------------ */

/**
 * THE SURF COAST (Remy, 2026-10-09: the judged beach moves to a surf-sized
 * sea; "why can't we have all variations somewhere on the map? make the map
 * and river big enough to support all types?"). One long sand coast facing
 * the `surf` sea's swell, which arrives from +Z (`oceanSeaStates.ts`, NOTE
 * THE SIGN): the land lies at -Z, the shoreline runs along X through the
 * origin. It is the island machinery of the cay (`SeabedIsland`) on an
 * ellipse 6 km by 2 km, so along the 1.28 km of the floor's map the
 * shoreline curves by under 0.2 m (its radius at the -B end is a^2 / b,
 * 9 km) and wanders only by the cay's own warp.
 *
 * THE PLACES ALONG THE SHORE, in the beach frame's a (meters along the
 * shore; a runs toward -X):
 *   - a = -24 .. 30 THE JUDGED BEACH: the beach's judged poses (beach-seq,
 *                   beach-top) on the mouth's right bank, as on the cay;
 *   - a = 40        THE SARCELLE MOUTH: a river across the beach into the
 *                   surf, sized from the Sarcelle clips (`ref/real/mouth/`):
 *                   the clip's river is about 40 m wide at the mouth, and
 *                   the same hydraulic geometry that sizes the channel
 *                   (w = 7.2 Q^0.5) gives Q = (40 / 7.2)^2 = 31 m^3/s
 *                   (river mouth round 2, the lead's ruling; round 1 built it
 *                   at the river scene's 1.5 m^3/s, an 8.8 m channel);
 *   - a = -200      THE CREEK MOUTH: the river scene's own 1.5 m^3/s
 *                   (RIVER_DISCHARGE_M3S), the round-1 mouth, kept as a
 *                   second and smaller place on the same coast (Remy, sheet
 *                   q37: "one map holds every variation"), 240 m from the
 *                   Sarcelle so the two mouths' grids and near plumes do
 *                   not meet (`?mouthplace=creek`);
 *   - a = -360      THE DELTA REACH: room for a wide delta plume of a larger
 *                   river (the Danube clip), 400 m from the small mouth so
 *                   the two plumes do not meet;
 *   - a = +400      THE LAGOON MOUTH: room for a barrier lagoon behind the
 *                   beach with its inlet (the Berre clip).
 * The floor's map covers a = -640 .. 640 and 540 m inland to 740 m out, so
 * each place lies on it with no rebuild of the scene: a new place is a new
 * `SeabedValley` (or a lagoon) on the same coast.
 */
export const COAST_PLACES = {
  judgedBeach: { a0: -24, a1: 30 },
  sarcelleMouth: { a: 40, widthRefM: 40, dischargeM3S: (40 / HG_WIDTH_A) ** (1 / HG_WIDTH_B) },
  creekMouth: { a: -200, dischargeM3S: RIVER_DISCHARGE_M3S },
  deltaReach: { a: -360 },
  lagoonMouth: { a: 400 },
} as const;

/**
 * DERIVE THE SURF COAST from the sea and the sand. The face, its toe, the
 * cusps, the sand and its grain are the cay's (the same medium quartz sand:
 * Bascom's 1:11 face for 0.35 mm). From the sea: the berm at Stockdon's 2%
 * run-up (the cay's own rule: "the berm stands at the reach of the largest
 * swash"), the backshore rising the cay's 0.85 m over it; below the toe,
 * Dean's profile for the grain. The floor under the coast is the open sea's
 * (the lagoon's base with no lagoon: no reef, heads, grass or spurs), at the
 * lagoon's open-sea depth, which Dean's profile meets 5 km out.
 */
export function deriveSurfCoast(cascades: readonly CascadeParams[], n: number, seed: number, statsSpanS = 1200): SurfCoast {
  const cay = LAGOON_CAY;
  // The coast: a = along X (heading pi puts the a axis on -X and s inland on -Z).
  const semiMajorM = 3000;
  const semiMinorM = 1000;
  // The sea 200 m out, past the surf zone, on the judged beach's line.
  const { hsM, tzS } = seaStatsAt(cascades, n, seed, 0, 200, statsSpanS);
  // The peak band: the forcing band of the most variance; its period.
  let best = { hs: -1, t: tzS };
  const bandHsM: Record<string, number> = {};
  for (const name of forcingCascades(cascades)) {
    const c = cascades.find((k) => k.name === name)!;
    const st = seaStatsAt(cascades, n, seed, 0, 200, Math.min(statsSpanS, 600), 0.1, [name]);
    bandHsM[name] = st.hsM;
    if (st.hsM > best.hs) best = { hs: st.hsM, t: bandPeriodS(c) };
  }
  // The unforced bands too (the ripple): the envelope hold reads every band's height.
  for (const c of cascades) {
    if (bandHsM[c.name] === undefined) bandHsM[c.name] = seaStatsAt(cascades, n, seed, 0, 200, Math.min(statsSpanS, 600), 0.1, [c.name]).hsM;
  }
  const tpS = best.t;
  const runup2M = stockdonRunup2(hsM, tpS, cay.faceSlope).r2;
  const d50 = cay.grainD50M ?? MEDIUM_SAND_D50_M;
  const deanA = deanProfileA(d50);
  const xToe = cay.faceToeM / cay.faceSlope;
  const params: SeabedParams = {
    ...LAGOON_SEABED,
    // The map: 1.28 km along the shore, from 540 m inland to 740 m out.
    centerX: 0,
    centerZ: 100,
    // No lagoon: its center lies far inland, so every point is past its
    // wall at the open-sea depth (deepM), with no reef line in the map.
    lagoonX: 0,
    lagoonZ: -1e6,
    lagoonRadiusM: 0,
    headCover: 0,
    grassCover: 0,
    rimM: 0,
    island: {
      ...cay,
      centerX: 0,
      centerZ: -semiMinorM,
      semiMajorM,
      semiMinorM,
      headingRad: Math.PI,
      bermM: runup2M,
      crestM: runup2M + (cay.crestM - cay.bermM),
      // The join: the profile's slope at the toe, (2/3) A x^(-1/3).
      terraceSlope: (2 / 3) * deanA * xToe ** (-1 / 3),
      offshore: { deanA },
    },
  };
  return { params, hsM, tzS, tpS, runup2M, deanA, bandHsM };
}

/**
 * THE BEACH'S SWASH GRID ON THE COAST: the cay's grid, run on along the shore
 * past the Sarcelle mouth to a = 64 m, so the judged poses keep their bank
 * (a -24 to 30) and the mouth has a bank of 14 m on its far side (the mouth's
 * grid takes a = 30 to 50). ROUND 1's grid (the 1.5 m^3/s mouth at a = 40);
 * kept for the tests of round 1. The page uses `coastBeachGrid(design)`.
 */
export const COAST_BEACH_GRID: SwashGridSpec = { ...BEACH_GRID, na: 176 };

/**
 * THE BEACH'S SWASH GRID AROUND A PLACE (round 2): the round-1 relation kept
 * for any mouth, so the swash runs on both banks: a right bank (a under the
 * mouth's grid) of COAST_RIGHT_BANK_M, the round-1 span from the judged
 * beach's a = -24 to the round-1 mouth grid's a = 14.5 (the span the beach's
 * judged poses need), and a left bank of COAST_LEFT_BANK_M, the same 38 m:
 * round 1's 14 m left bank put the swash patch's end in the bank frames as a
 * hard-sided box (the coast past the patch has no swash).
 */
export const COAST_RIGHT_BANK_M = 38;
export const COAST_LEFT_BANK_M = 38;
export function coastBeachGrid(d: MouthDesign): SwashGridSpec {
  /* ROUND 13: on the deflected planform the mouth's grid runs the spit's whole reach along the shore and carries the
   * swash on the platform's face itself; the beach's grid keeps the outlet's box (the mouth's grid as the straight
   * valley would draw it, both banks), so its cost stays the straight mouth's. */
  const g = ((): SwashGridSpec => {
    const g0 = d.grid;
    if (!d.course) return g0;
    const aOut = d.course.dirA === 1 ? g0.a0 : g0.a0 + g0.na * g0.da;
    const halfOut = Math.abs(d.mouthA - aOut);
    return { ...g0, a0: d.mouthA - halfOut, na: Math.round((2 * halfOut) / g0.da) };
  })();
  const a0 = Math.floor((g.a0 - COAST_RIGHT_BANK_M) / BEACH_GRID.da) * BEACH_GRID.da;
  const a1 = g.a0 + g.na * g.da + COAST_LEFT_BANK_M;
  return { ...BEACH_GRID, a0, na: Math.ceil((a1 - a0) / BEACH_GRID.da) };
}

/**
 * THE MOUTH GRID'S CELL, m (round 2: from the design, not one number). Two
 * rules, the smaller cell wins, on the swash's 0.5 m lattice along the shore:
 *   - the shortest forced wave (the `surf` chop's 6.5 m, its low cutoff) in
 *     at least MOUTH_CELLS_PER_WAVE cells, so the first-order HLL scheme
 *     carries the forced sea into the mouth (6 cells: 1.0 m on `surf`);
 *   - the channel's width in at least MOUTH_CELLS_PER_CHANNEL cells, so the
 *     cross-section's |n / half|^p shape is held (16 cells: 0.5 m for the
 *     creek's 8.8 m, the round-1 cell).
 * The Sarcelle's 40 m channel takes 1.0 m: 40 cells across. At round 1's
 * 0.5 m its grid would be 50,024 cells and step at 1.36 s of CPU a simulated
 * second (mouth2/timeQ31.ts), slower than the clock; at 1.0 m 12,506 cells.
 */
export const MOUTH_CELLS_PER_WAVE = 6;
export const MOUTH_CELLS_PER_CHANNEL = 16;
export const MOUTH_CELL_LATTICE_M = 0.5;
/** Round 1's cell, m: the creek's. */
export const MOUTH_DX_M = 0.5;
export function mouthCellM(cascades: readonly CascadeParams[], widthM: number): number {
  const forced = forcingCascades(cascades);
  const shortest = Math.min(...cascades.filter((c) => forced.includes(c.name)).map((c) => Math.max(c.cutoffLowM, 0.5)));
  const raw = Math.min(shortest / MOUTH_CELLS_PER_WAVE, widthM / MOUTH_CELLS_PER_CHANNEL);
  return Math.max(Math.floor(raw / MOUTH_CELL_LATTICE_M) * MOUTH_CELL_LATTICE_M, MOUTH_CELL_LATTICE_M);
}
export function mouthPlaceOf(name: string | null | undefined): { a: number; dischargeM3S: number; name: MouthPlace } {
  if (name === 'creek') return { a: COAST_PLACES.creekMouth.a, dischargeM3S: COAST_PLACES.creekMouth.dischargeM3S, name: 'creek' };
  if (name === null || name === undefined || name === '' || name === 'sarcelle') {
    return { a: COAST_PLACES.sarcelleMouth.a, dischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S, name: 'sarcelle' };
  }
  throw new Error(`[ocean] Unknown mouth place "${name}". Known places: sarcelle, creek.`);
}

/**
 * DERIVE THE MOUTH from the discharge, the river's own reach and the sea.
 * Every number of the valley, the bar, the jet and the grid comes from here.
 */
export function deriveMouthDesign(o: {
  cascades: readonly CascadeParams[];
  n: number;
  seed: number;
  /** The coast the valley is cut into. Absent: the surf coast (`deriveSurfCoast`). */
  coast?: SurfCoast;
  /**
   * The place on the coast (round 2): its a and its discharge. Absent: the
   * Sarcelle mouth (a = 40, 31 m^3/s). `mouthA` and `dischargeM3S` override it.
   */
  place?: MouthPlace;
  /** Where along the shore, the beach frame's a, m. */
  mouthA?: number;
  /**
   * The discharge, m^3/s. For the creek, the river scene's (`getRiverShape`,
   * RIVER_DISCHARGE_M3S at its default); for the Sarcelle, its width's.
   */
  dischargeM3S?: number;
  /** The river's mean flow for the rating curve, m^3/s. Absent: the place's own discharge (the width's flow). */
  meanDischargeM3S?: number;
  /** The Hs measure's span, s (the tests shorten it). */
  statsSpanS?: number;
  /**
   * ROUND 10: the still water's height over the mean sea level, m. Absent: the place's record
   * (`MouthPlaceConditions.tideM`; 0 for a place with none). `&mouthtide=0` mounts the mean sea level (the control).
   */
  tideM?: number;
  /**
   * ROUND 10: the bar's crest law. Absent (ROUND 11): 'swash', the swash bar (`swashBarCrestM`); 'break' is rounds 3 to
   * 10's crest (`&mouthbar=break`, the control).
   */
  barLaw?: 'swash' | 'break';
  /**
   * ROUND 11 (law 1): the flow on the day, m^3/s: the near field's inflow, the drawn jet, the load and the wind over the
   * water. Absent: the place's record (`MouthPlaceConditions.dayDischargeM3S`), or the mean flow for a place with
   * none. The channel, the bar and the jet that lays it stay the mean flow's (`dischargeM3S` or the place's).
   */
  dayDischargeM3S?: number;
  /**
   * ROUND 12 (gap 2; the lead's ruling 2): THE SEA ON THE DAY, the forced bands' significant height offshore of the
   * coast (`SurfCoast.hsM`, 200 m out), m. Absent: the place's record (`MouthPlaceConditions.daySeaHsM`); null: the
   * sea state's own (the mean sea; rounds 1 to 11 and their tests). See `daySeaCascades`.
   */
  daySeaHsM?: number | null;
  /** ROUND 12 (gap 1): the river water's dissolved absorption at 443 nm, 1/m. Absent: the record's; null: none. */
  cdomAg443M?: number | null;
  /**
   * ROUND 13 (law 1): the planform. Absent: 'deflected' where the place's record carries a drift
   * (`MouthPlaceConditions.drift`), else 'straight'. 'straight' is rounds 1 to 12's valley (`&mouthplan=straight`).
   */
  planform?: 'deflected' | 'straight';
  /**
   * ROUND 14 (ruling 1): the infragravity band at the near field's sea edge (`infragravityEdge`). Absent: on.
   * `&mouthig=0` mounts round 13's edge (the control).
   */
  infragravity?: boolean;
  /** ROUND 14 (ruling 1): the platform's washover surface (`deflectedCourse`). Absent: on. `&mouthwash=0`: round 13's flat cap. */
  washover?: boolean;
  /** ROUND 14 (ruling 2): the spit's seaward terrace (`deflectedCourse`). Absent: on. `&mouthterrace=0`: none. */
  terrace?: boolean;
  /** ROUND 15 (ruling 2): the day's low-flow channel on the deflected reach (`lowFlowChannelOf`). Absent: on. `&mouthlow=0`: round 14's pond. */
  lowFlow?: boolean;
  /** ROUND 15 (ruling 1): the day's load, g/m^3. Absent: the record's fitted load (`dayLoadGM3`); null: the rating curve's (`&mouthload=rating`). */
  dayLoadGM3?: number | null;
  /** ROUND 15 (ruling 3): the terrace's front at the record's surf band (`surfBandM`). Absent: on where the record has one. `&mouthband=0`: round 14's width. */
  surfBand?: boolean;
}): MouthDesign {
  const coastMean = o.coast ?? deriveSurfCoast(o.cascades, o.n, o.seed, o.statsSpanS ?? 1200);
  /* ROUND 12 (gap 2): THE TWO SEAS, as round 11's two discharges. The MEAN sea (the sea state's) shapes the coast:
   * the berm (`deriveSurfCoast`), the bar's crest (the swash bar's setup), the formative jet that lays the bar (its
   * waves' stirring) and the surf zone's scale. The DAY's sea (the place's record) forces the near fields' sea edges
   * and the coast's march, the drawn jet's stirring, the takeover and the breakers. The day's sea is the mean sea
   * with the forced bands' energy scaled (`daySeaCascades`): the same modes and phases, the height by sqrt(energy),
   * the periods kept. On the page the FFT's own forced bands take the same scale (`applyDaySea`, oceanMouth.ts). */
  const placeSea = mouthPlaceConditions(mouthPlaceOf(o.place ?? 'sarcelle').name);
  const daySeaHsM = o.daySeaHsM === undefined ? (placeSea?.daySeaHsM ?? null) : o.daySeaHsM;
  const seaEnergy = daySeaHsM === null ? 1 : (daySeaHsM / coastMean.hsM) ** 2;
  const coast: SurfCoast = seaEnergy === 1 ? coastMean : daySeaCoast(coastMean, o.cascades, seaEnergy);
  const base = coast.params;
  const isl = base.island;
  if (!isl) throw new Error('[ocean] The river mouth cuts its valley into a cay: the seabed has no island.');
  const place = mouthPlaceOf(o.place ?? 'sarcelle');
  const q = o.dischargeM3S ?? (place.name === 'creek' ? getRiverShape().dischargeM3S ?? RIVER_DISCHARGE_M3S : place.dischargeM3S);
  /* ROUND 11 (law 1): THE TWO DISCHARGES. q is the flow that shapes the channel and lays the bar (the width's mean);
   * qDay the flow on the day the scene shows (the place's record: the clip's day). */
  const placeC0 = mouthPlaceConditions(place.name);
  const qDay = o.dayDischargeM3S ?? placeC0?.dayDischargeM3S ?? q;
  // THE LOAD (round 2): the rating curve at the day's flow, set at the mean flow (see RATING_EXPONENT_B).
  const qMean = o.meanDischargeM3S ?? q;
  const ratingLoadGM3 = ratingCurveGM3(qDay, qMean);
  /* ROUND 15 (ruling 1): THE DAY'S LOAD IS THE RECORD'S MEASURED INPUT where the place carries one (the fit to the
   * clip's river bands, `MouthPlaceConditions.dayLoadGM3`); the rating curve's load is the derived one, kept beside it. */
  const dayLoad = o.dayLoadGM3 === undefined ? (placeC0?.dayLoadGM3 ?? null) : o.dayLoadGM3;
  const sedimentGM3 = dayLoad ?? ratingLoadGM3;
  // Hydraulic geometry: the channel at the mouth.
  const widthM = HG_WIDTH_A * q ** HG_WIDTH_B;
  // The river's own reach: slope, shape, roughness.
  const kUp = courseKeyAt(RIVER_OUTLET_S[0]);
  const kDn = courseKeyAt(RIVER_OUTLET_S[1]);
  const riverSlope = (kUp.thalweg - kDn.thalweg) / (RIVER_OUTLET_S[1] - RIVER_OUTLET_S[0]);
  const shapeP = kDn.shapeP;
  const manningN = kDn.manning;
  /* ROUND 13 (law 1; GG-413): THE PLANFORM. Where the place's record carries the clip's drift, the spit by the drift law
   * (`deflectedSpitOf`): the channel keeps the width at the mean flow, and runs at the spit's slope and depth (the mean
   * flow at Escoffier's speed); the straight valley keeps Leopold and Maddock's depth and the river's own slope. */
  const driftRec = placeC0?.drift ?? null;
  const planform = o.planform ?? (driftRec ? 'deflected' : 'straight');
  if (planform === 'deflected' && driftRec === null) throw new Error(`[ocean] The ${place.name} mouth has no drift in its record: it has no deflected planform.`);
  const tideM0 = o.tideM ?? placeC0?.tideM ?? 0;
  const spit = planform === 'deflected' && driftRec !== null
    ? deflectedSpitOf({
      qMeanM3S: q, widthM, shapeP, manningN, tideM: tideM0, hsM: coastMean.hsM, tpS: coastMean.tpS, runup2M: coastMean.runup2M,
      faceSlope: isl.faceSlope, drift: longshoreDriftOf({ hsM: coastMean.hsM, tpS: coastMean.tpS, ...driftRec }),
    })
    : null;
  const depthM = spit ? spit.channelDepthM : HG_DEPTH_C * q ** HG_DEPTH_F;
  const slope = spit ? spit.slope : riverSlope;
  // The area of |n / half|^p from the thalweg to the top: (p / (p + 1)) w d.
  const areaM2 = (shapeP / (shapeP + 1)) * widthM * depthM;
  // Round 11: the mean flow's speed lays the bar (the formative jet); the day's is the outflow the scene draws.
  const u0MeanMS = q / areaM2;
  /* ROUND 15 (ruling 2): THE DAY'S CHANNEL on the deflected reach by at-a-station hydraulic geometry
   * (`lowFlowChannelOf`): the day's outflow runs through it at its speed, not through the mean section. */
  const lowFlow = spit && (o.lowFlow ?? true) && qDay !== q ? lowFlowChannelOf({ spit, qMeanM3S: q, qDayM3S: qDay, shapeP, manningN }) : undefined;
  const u0MS = lowFlow ? lowFlow.speedMS : qDay / areaM2;
  const bankSlope = Math.tan(SAND_REPOSE_RAD);
  const frame = beachFrameOf(isl);
  // The mouth at its place on the coast (COAST_PLACES), inside the beach's
  // swash grid, so the swash runs on both banks.
  const mouthA = o.mouthA ?? place.a;
  const mouthS = shorelineS(base, frame, mouthA);
  const [mouthX, mouthZ] = beachToWorld(frame, mouthS, mouthA);
  // THE VALLEY HEAD: three backwater lengths inland. The sea's level reaches
  // up a river over the backwater length d / S (Paola and Mohrig 1996;
  // Lamb et al. 2012), its effect falling as e^(-x / L); at three lengths
  // it is under 5%, so the near field holds the whole reach the sea touches.
  const headStraightM = (3 * (HG_DEPTH_C * q ** HG_DEPTH_F)) / riverSlope;
  let headM = spit ? spit.lengthM : (3 * depthM) / slope;
  // The sea offshore (the coast's): the bar's crest and the jet's takeover read it.
  const hsM = coast.hsM;
  const tzS = coast.tzS;
  // Linear theory's surface orbital speed of the significant wave: pi H / T.
  const uOrbMS = (Math.PI * hsM) / tzS;
  // ROUND 13 (law 1): the deflected course; the river's own valley above the root runs the straight head's length.
  const seaEndM = isl.faceToeM / isl.faceSlope;
  /* ROUND 14 (rulings 1 and 2): the washover's surface and the spit's terrace (`deflectedCourse`): the terrace's top at
   * the closure depth of the day's (the modal) sea, its width the mean sea's surf zone on the coast's own floor. */
  const terraceOn = o.terrace ?? true;
  const surfMean = coastBreakRef(base, frame, mouthS, mouthA, coastMean.hsM);
  /* ROUND 15 (ruling 3): THE TERRACE'S FRONT AT THE CLIP'S SURF BAND. Round 14 ran the terrace out to the mean sea's
   * surf zone (106.5 m) and the day's sea broke at its front, out of the clip's band, and ran 100 m in as bores a few
   * centimeters high. The band's outer edge is where the day's sea starts to break: the terrace's front stands there
   * (the record's measure, `surfBandM`); its top keeps the closure law. On a flat terrace the day's sea breaks at the
   * front and its bores die over about 10 m inside it (mouth15/probe/surf15.ts), so the band is the FRONT: the top's
   * edge stands at the band's inner edge and the front falls at the face's slope to the coast's floor, which it meets
   * at the band's outer edge (3.3 m over 36 m at 1:11: the two edges agree with the face law). The day's Hs is read from
   * the clip's breaker faces at this eye (mouth15/faces15.py; GG-417 closed for that record). */
  const band = (o.surfBand ?? true) ? (placeC0?.surfBandM ?? null) : null;
  // The terrace's top runs to the band's INNER edge; its front (the face's 1:11) is the band (see SARCELLE_CONDITIONS).
  const terraceWidthM = band ? band[0] : surfMean.widthM;
  const dCourse = spit
    ? deflectedCourse({
      params: base, frame, mouthA, spit, seaEndM, inlandM: headStraightM, riverSlope, bankSlope, crestM: isl.crestM,
      washover: o.washover ?? true, tideM: tideM0, faceSlope: isl.faceSlope,
      ...(terraceOn ? { terrace: { depthStillM: birkemeierClosureM(coast.hsM, coastMean.tpS), widthM: terraceWidthM } } : {}),
      ...(lowFlow ? { lowFlow: { widthM: lowFlow.widthM, depthM: lowFlow.depthM, slope: lowFlow.slope } } : {}),
    })
    : null;
  const valley0: SeabedValley = {
    mouthX, mouthZ, inX: frame.sX, inZ: frame.sZ,
    widthM, depthM, shapeP, slope, headM, bankSlope,
    // The cut ends at the foreshore's toe, where the face stands deeper than the channel.
    seaEndM,
    ...(dCourse ? { course: dCourse.course } : {}),
  };
  /* THE JET AND ITS BAR (round 3; see "The friction-dominated jet and its
   * bar"). The jet runs over the coast's own floor with the valley and no bar
   * (the bar is what it lays), on the axis seaward of the mouth line. Round 2's
   * bar (the inertia-dominated jet down to the sand's 0.3 m/s, 799 m out) is
   * replaced: the bar is the jet's first deposition lobe. */
  const params0: SeabedParams = { ...base, island: { ...isl, valley: valley0 } };
  const d50 = isl.grainD50M ?? MEDIUM_SAND_D50_M;
  const axisDepth = (x: number) => seabedPointAt(params0, mouthX - frame.sX * x, mouthZ - frame.sZ * x).depthM;
  // ROUND 11: the bar is the MEAN flow's deposit (the formative jet); the drawn jet is the day's (the same law).
  // ROUND 12 (gap 2): the formative jet stirs at the MEAN sea's waves (the sea that shaped the bar).
  const jetMean = frictionJet({ dischargeM3S: q, u0MS: u0MeanMS, areaM2, manningN, hsM: coastMean.hsM, tzS: coastMean.tzS, d50M: d50, depthAt: axisDepth, fallMS: sandFallSpeedMS(SUSPENDED_D50_M) });
  // ROUND 15 (ruling 2): the day's jet leaves through the day's own section (`lowFlow`), at its speed.
  const jet = qDay === q && seaEnergy === 1 ? jetMean : frictionJet({ dischargeM3S: qDay, u0MS, areaM2: lowFlow ? lowFlow.areaM2 : areaM2, manningN, hsM, tzS, d50M: d50, depthAt: axisDepth, fallMS: sandFallSpeedMS(SUSPENDED_D50_M) });
  let coreI = 0;
  while (coreI + 1 < jet.n && jet.rcM[coreI] > 0) coreI += 1;
  const coreM = jet.xM[coreI];
  const deposit = jetDeposit(jetMean);
  const barM = deposit ? deposit.xM : 0;
  const bx = mouthX - frame.sX * barM;
  const bz = mouthZ - frame.sZ * barM;
  const floorDepthM = seabedPointAt(params0, bx, bz).depthM;
  // THE CREST: the bar grows until the sea's waves break on it in full. The
  // wave that reaches it is the sea's significant wave held to the floor
  // there (the broken wave's H = 0.55 d, the bathymetry module's bore); it
  // breaks in full where H / d = 0.75 (McCowan 1894, BATHY_BREAK_FULL).
  // ROUND 12: the bar is the MEAN sea's (morphology).
  const barWaveM = Math.min(coastMean.hsM, BATHY_BORE_GAMMA * Math.max(floorDepthM, 0));
  // The bar's plan: a disc on the lobe's center of mass (the shelf law's
  // shape; the middle-ground bar's own planform is open), at full height over
  // half the lobe's half-peak length, back to the floor at its farther end.
  const innerM = Math.max(deposit ? (deposit.halfToM - deposit.halfFromM) / 2 : 0, 0.5);
  const outerM = Math.max(deposit ? Math.max(deposit.toM - deposit.xM, deposit.xM - deposit.fromM) : 0, innerM + 1);
  /* ROUND 10, THE TIDE AND THE SWASH BAR (law 1). The place's still water at the clip's moment (the record's
   * `tideM`: the low water) is the floor's datum (`SeabedParams.stillLevelM`), so the one water stands at it.
   * Rounds 3 to 9 set the crest where the sea's wave, held to the floor, breaks in full: a crest 0.61 m under the
   * mean sea level, which a tide inside the coast's range (`tidalRangeM`, 0.4 m) cannot bare. That law is the
   * breakpoint bar's. The clip's bar stands bare at its low water with thin sheets of swash over it: a SWASH BAR.
   * On a wave-dominated coast the broken waves carry the jet's lobe on shoreward and up until it stands in the
   * swash of the low water (Masselink, Kroon and Davidson-Arnott 2006: swash bars form at the low-tide level and
   * build by overwash). The crest stands at the MEAN WATER OF THE LOW WATER'S SWASH ZONE (`swashBarCrestM`): there
   * the swash tops it half the time, and the overwash's onshore carry over the crest balances the backwash's and
   * the river's offshore carry (a crest under it is topped by most swashes and grows; one over it is topped by few
   * and the river and the backwash plane it down). On the surf sea that crest stands 0.40 m over the low water.
   * WHY IT IS NOT THE DEFAULT (mouth10/probe/probeQ10.ts, the near field out past the bar, 40 s): the ONE WATER
   * drowns it. The record's river (31 m^3/s, the width's mean flow) cannot pass the two flank channels the lobe
   * leaves (10 to 20 cm under the low water): it backs up 0.62 m behind the bar and runs over the crest in a sheet
   * of 0.19 m (p50; 0.26 m with the waves' setup), and the bar never bares. The near field bares it with the clip's
   * thin sheets only at a low flow: 3 m^3/s gives a crest bare 95 % of the time with the waves off and swash sheets
   * of 4 cm (p50) with them on. The clip's bare bar therefore says the river ran far under its mean flow that day,
   * which is a ruling on the place's record (the discharge), not this law's. And a near field out over the bar draws
   * the surf there at its 1 m cells, which cannot carry the forced bands (their shortest wave is 6 cells): the surf
   * in front of the mouth drew as a flat dark plate (mouth10/shots/f1-mouth-down.png). So 'break' stays the default
   * crest, at the tide: 0.41 m under the low water. */
  /* ROUND 11 (law 1; the lead's ruling 2): THE SWASH BAR IS THE DEFAULT. At the clip's day (`dayDischargeM3S`) the
   * river passes the flank channels under the crest and the bar stands bare with the swash over it, as the clip
   * shows: the drowning above was the mean flow's, a flow the clip's day did not run. 'break' is the control. */
  const placeC = placeC0;
  const tideM = tideM0;
  const barLaw = o.barLaw ?? 'swash';
  let barCrestDepthM = barWaveM / BATHY_BREAK_FULL;
  if (barLaw === 'swash') barCrestDepthM = -swashBarCrestM({ tideM, hsM: coastMean.hsM, tpS: coastMean.tpS });
  const uCritMS = vanRijnCritSpeedMS(Math.max(barCrestDepthM + tideM, 0.05), d50);
  /* ROUND 6, THE BAR'S PLANFORM (law 2). A middle-ground bar is not a disc:
   * the jet drops its sand across its whole width (Wright 1977: the bar forms
   * on the axis and the channel splits round it into two), so the crest's
   * height across the axis follows the deposit across the jet. The friction
   * jet's speed across it is a flat core of half-width rc with Gaussian
   * shoulders of sigma (`frictionJet`); the deposit is taken as the Gaussian
   * of the same spread (variance rc^2 / 3 + sigma^2: the flat core's plus
   * the shoulders'), so the crest shoals toward the axis and falls to the
   * floor in the two channels at its flanks. Along the axis the lobe's radii
   * hold as before. Rip channels (Short 1999: one every 1.5 to 4 surf-zone
   * widths) do not cut it: the bar is narrower than one rip spacing (the
   * coast's surf zone is `surfRef.widthM` wide), so by the law none falls on
   * it; the coast's own floor is Dean's barless profile, which has no bar for
   * a rip to cut. */
  const pBar = jetProfileAt(jetMean, barM);
  const laterM = Math.sqrt((pBar.rc * pBar.rc) / 3 + pBar.sigma * pBar.sigma);
  const bar = deposit && floorDepthM > barCrestDepthM
    ? { xM: bx, zM: bz, innerM, outerM, depthM: barCrestDepthM, floorDepthM, laterM }
    : null;
  const valley: SeabedValley = {
    ...valley0,
    ...(bar ? { bar: { xM: bar.xM, zM: bar.zM, innerM: bar.innerM, outerM: bar.outerM, depthM: bar.depthM, laterM: bar.laterM } } : {}),
  };
  const params: SeabedParams = { ...base, island: { ...isl, valley }, ...(tideM !== 0 ? { stillLevelM: tideM } : {}) };
  // THE GRID: from the beach's sea edge (one sea edge for the near field) to
  // the valley head, and across the valley at its widest (the coast's top
  // over the bank slope from the channel's edge) with two cells over.
  // ROUND 10 (law 1): a bar that stands in the swash is the near field's water (its sheets, its wet sand, its
  // bores on the face): the grid's sea edge moves out past the bar's seaward toe by one hand-over length, so
  // the bar's whole lobe is on the grid. The sea edge is forced at the drawn sea's own phase there
  // (`createMouthSim`'s `edgeWarpM`: the phase warp is anchored on the beach's sea edge, BEACH_GRID.s0).
  const barToeS = bar ? mouthS - (barM + outerM) - mouthHandoverLengthM(o.cascades) : Infinity;
  const s0 = barLaw === 'swash' && bar ? Math.min(BEACH_GRID.s0, Math.floor(barToeS)) : BEACH_GRID.s0;
  const dx = mouthCellM(o.cascades, widthM);
  const aHalf = widthM / 2 + isl.crestM / bankSlope + 2 * dx;
  let grid: SwashGridSpec;
  if (!dCourse || !spit) {
    const s1 = mouthS + headM;
    const ns = Math.ceil((s1 - s0) / dx);
    const na = 2 * Math.ceil(aHalf / dx);
    grid = { s0, ds: dx, ns, a0: mouthA - (na / 2) * dx, da: dx, na };
  } else {
    /* ROUND 13 (law 1): THE GRID ROUND THE DEFLECTED REACH, by round 1's rule (the near field holds the whole reach the
     * sea's level touches: the spit's reach is shorter than one backwater length, depth / slope): along the shore
     * from the outlet's far bank to the root bend's start (the river comes in across the grid's root edge, along the
     * shore), and from the sea edge to the inland bank's top over the whole reach (the shoreline wanders). */
    const aOut = mouthA - dCourse.dirA * Math.ceil(aHalf / dx) * dx;
    const aEnd = dCourse.aRootM - dCourse.dirA * 2;
    const na = Math.floor(Math.abs(aEnd - aOut) / dx);
    const a0 = dCourse.dirA === 1 ? aOut : aOut - na * dx;
    let s1 = -Infinity;
    for (let k = 0; k <= na; k += 5) {
      const a = a0 + k * dx;
      s1 = Math.max(s1, shorelineS(base, frame, a) + spit.centerOffsetM + widthM / 2 + isl.crestM / bankSlope + 2 * dx);
    }
    const ns = Math.ceil((s1 - s0) / dx);
    grid = { s0, ds: dx, ns, a0, da: dx, na };
    // The reach on the grid: the course's along at the root edge (the spin-up's long-wave round trip reads it).
    headM = spit.lengthM - dx * 2;
  }
  return {
    // Round 11: dischargeM3S is the DAY's flow (the near field's inflow, the jet drawn); meanDischargeM3S the mean.
    dischargeM3S: qDay, widthM, depthM, shapeP, manningN, slope, areaM2, u0MS, bankSlope,
    frame, mouthS, mouthA, mouthX, mouthZ, headM, hsM, tzS, uOrbMS, coreM, uCritMS, barM, jet, deposit, barCrestDepthM, bar, tideM, barLaw,
    surfRef: coastBreakRef(params0, frame, mouthS, mouthA, coastMean.hsM),
    // ROUND 12 (gap 2): the day's sea against the mean's.
    meanSeaHsM: coastMean.hsM, seaEnergy,
    // ROUND 14 (ruling 1): the coast's peak period and the infragravity band's switch.
    tpS: coastMean.tpS, infragravity: o.infragravity ?? true,
    valley, params, grid, sedimentGM3, meanDischargeM3S: qMean, place: place.name,
    // ROUND 13 (law 1): the planform, the spit and its course.
    planform, ...(spit ? { spit } : {}), ...(dCourse ? { course: dCourse } : {}),
    // ROUND 15: the day's low-flow channel (ruling 2) and the rating curve's load beside the record's (ruling 1).
    ...(lowFlow ? { lowFlow } : {}), ratingLoadGM3,
    // Round 5: the river's optics fit to the clip's water where the place has a measure (`placeRiverOptics`).
    // Round 12 (gap 1): with the record's CDOM, the particles of the mean flow's fit and the dissolved term.
    optics: placeRiverOptics(place.name, sedimentGM3, ratingCurveGM3(qMean, qMean), o.cdomAg443M),
    // Round 4: the local sea's wind is the place's (the clip's chop), where it has a measure.
    bands: mouthBands(o.cascades, coast.bandHsM, widthM).map((b) => {
      const w = b.local ? placeRiverWindMS(place.name, u0MS) : null;
      return w === null ? b : { ...b, localWindMS: w };
    }),
  };
}

/**
 * ROUND 12 (gap 3, GG-394): ONE TERRAIN AT THE SPIT, the floor's detail rectangles (`OceanSeabedOptions.detail`):
 * the mouth's grid box less the beach's own patch (the beach's 0.5 m sand mesh draws that), in the beach frame: the
 * bar and the near mouth seaward of the beach's sea edge, and the banks and spits from the beach's top row (the berm)
 * up the valley, at the beach grid's cell along the shore, so the detail mesh's vertices on those lines are the sand
 * mesh's border vertices. Round 10 found the sawtooth at the spit: the seam between the beach's fine sand mesh and the
 * floor's 2.5 m triangles at the beach's top row.
 */
export function mouthFloorDetail(d: MouthDesign, beach: SwashGridSpec): {
  originX: number; originZ: number; sX: number; sZ: number; aX: number; aZ: number;
  rects: (readonly [number, number, number, number])[]; cellM: number;
} {
  const g = d.grid;
  const top = beach.s0 + beach.ns * beach.ds;
  // The box's a edges on the beach's own a lattice (outward), so the shared border vertices coincide.
  const a0 = beach.a0 + Math.floor((g.a0 - beach.a0) / beach.da) * beach.da;
  const a1 = beach.a0 + Math.ceil((g.a0 + g.na * g.da - beach.a0) / beach.da) * beach.da;
  const fr = d.frame;
  const rects: (readonly [number, number, number, number])[] = [];
  if (g.s0 < beach.s0) rects.push([g.s0, beach.s0, a0, a1]);
  rects.push([top, g.s0 + g.ns * g.ds, a0, a1]);
  // ROUND 13: past the beach grid's own a range (the deflected reach) the beach's rows too: no sand mesh draws them.
  const b0 = beach.a0;
  const b1 = beach.a0 + beach.na * beach.da;
  if (a1 > b1) rects.push([beach.s0, top, Math.max(b1, a0), a1]);
  if (a0 < b0) rects.push([beach.s0, top, a0, Math.min(b0, a1)]);
  return { originX: fr.originX, originZ: fr.originZ, sX: fr.sX, sZ: fr.sZ, aX: fr.aX, aZ: fr.aZ, rects, cellM: beach.da };
}

/**
 * 1 for each beach swash cell inside the mouth's grid (the swash's walls:
 * `SwashField.wall`), less `insetM` on each side along the shore.
 *
 * ROUND 2, THE OVERLAP (the lead's point 5, the bank ends): with `insetM` the
 * hand-over length, the beach's grid runs on into the mouth grid's two side
 * bands where the mouth's own hand-over ramps in, so on those bands both
 * grids hold the water and the sea's one surface draws the sum of their
 * levels by weights that sum to 1 (oceanMouth.ts, `beachAt`). Round 1 walled
 * the whole strip: both weights fell to 0 at the strip's edge, and the
 * drawn water there sank to the mean sea level along a straight line, the
 * hard-edged pale blocks at both banks' ends (round 1c's open item).
 * The two grids still do not trade water: each holds its own band.
 */
export function mouthSwashWalls(d: MouthDesign, beach: SwashGridSpec = COAST_BEACH_GRID, insetM = 0): Uint8Array {
  const g = d.grid;
  const out = new Uint8Array(beach.ns * beach.na);
  const a0 = g.a0 + insetM;
  const a1 = g.a0 + g.na * g.da - insetM;
  const s1 = g.s0 + g.ns * g.ds;
  for (let j = 0; j < beach.na; j += 1) {
    const a = beach.a0 + (j + 0.5) * beach.da;
    if (a < a0 || a > a1) continue;
    for (let i = 0; i < beach.ns; i += 1) {
      const s = beach.s0 + (i + 0.5) * beach.ds;
      if (s >= g.s0 && s <= s1) out[j * beach.ns + i] = 1;
    }
  }
  return out;
}
/* ------------------------------------------------------------------ */
/* ROUND 13 (law 1; GG-413): THE PLANFORM BY THE LONGSHORE DRIFT         */
/* ------------------------------------------------------------------ */

/*
 * WHY. Twelve rounds built the Sarcelle as a straight channel between two spits, seen head-on toward the sea. The
 * clip (mouth/ref/sarcelle-join-t4.png) shows a DEFLECTED mouth: the river runs along the shore behind a long low
 * spit platform, and the camera on the river looks across that platform to the surf. A spit is the product of the
 * longshore drift: the breakers' oblique approach drives sand along the shore, the spit grows down the drift, and
 * the river's outlet is pushed with its tip until the river can no longer keep it open (Zenkovich 1967; Kirk 1991 for
 * the wave-dominated river outlets of a gravel or sand coast, the hapua). The laws, in order:
 *   - THE DRIFT (`longshoreDriftOf`): the CERC formula (Shore Protection Manual 1984; Komar and Inman 1970),
 *     Q = K / (16 (s - 1)(1 - p)) sqrt(g / kappa) Hb^(5/2) sin(2 theta_b), K = 0.39 for the significant height, kappa
 *     McCowan's 0.78, s 2.65, p 0.4; the breaker height by Komar and Gaughan (1972), Hb = 0.39 g^(1/5) (T H0^2)^(2/5),
 *     from the MEAN sea state (the sea that shapes the coast, `deriveSurfCoast`); the breaker angle theta_b to the shore
 *     and its sense are the place's record, measured on the clip (`MouthPlaceConditions.drift`).
 *   - THE PLATFORM (`deflectedSpitOf`): its crest at the swash bar's law (`swashBarCrestM`, Stockdon's dissipative
 *     setup over the low water: the overwash's mean water, as the swash bar's crest), and its width from the beach's
 *     own berm law: the berm stands where the mean sea's 2 % run-up reaches (Stockdon's R2 over the face's slope, the
 *     berm's s in `islandHeightAt`), and the overwash carries the swash's sand on over a crest lower than R2 out to
 *     that reach, so the platform runs from the shoreline to R2 / tan(beta). Its seaward face is the coast's own face.
 *   - THE CHANNEL BEHIND IT keeps the width Leopold and Maddock give at the mean flow (the width that shapes it).
 *   - THE SPIT'S LENGTH, by inlet stability (Escoffier 1940; Bruun 1978): the outlet stays open while its flow runs at
 *     least the equilibrium speed at which its scour removes the drift's supply (about 0.9 m/s for sand inlets,
 *     Escoffier's closure curve; Bruun 1978: 0.9 to 1.0 m/s). The river may stand behind the spit at most at the
 *     platform's crest (over it the river overtops the platform and breaches a new, short outlet: the hapua's
 *     truncation, Kirk 1991), so the deflected reach's head is the crest over the outlet's water. As the spit grows,
 *     the same head drives the mean flow over a longer reach, the slope falls and the speed with it (Manning, the
 *     channel's own n and section, the width held). The spit ends at the length where the mean flow runs at
 *     Escoffier's speed: L = head / S_e, S_e = (n u_e / R_e^(2/3))^2, R_e the section's hydraulic radius at the depth
 *     that carries the mean flow at u_e. Past it the outlet shoals shut and the river breaches near the root.
 *   - THE BENDS: the outlet turns seaward through the spit's own width (its radius the channel's centerline offset
 *     from the shoreline: a forced bend, tighter than a free meander's 2 to 3 widths, Leopold and Wolman 1960); the
 *     root's bend inland at the same radius.
 * The drift's rate is printed and kept: it sets Bruun's ratio (the mean flow's yearly volume over the drift's yearly
 * volume; under 20 the outlet is a drift-dominated, migrating one) and the tip's migration speed. The coast's own
 * sea state is not turned to the drift's angle: the angle is the long-term mean sea's, measured on the clip, and the
 * FFT sea of the scene is the day's.
 */
/** CERC's coefficient for the significant breaker height (Shore Protection Manual 1984). */
export const CERC_K_SIG = 0.39;
/** The sand's porosity in the CERC volume (SPM 1984). */
export const SAND_POROSITY = 0.4;
/** Escoffier's (1940) equilibrium speed of a sand outlet, m/s (Bruun 1978: 0.9 to 1.0 m/s). */
export const ESCOFFIER_SPEED_MS = 0.9;
/** Seconds in a mean year. */
export const YEAR_S = 365.25 * 86400;
/**
 * ROUND 14 (ruling 2): THE CLOSURE DEPTH (Birkemeier 1985, Hallermeier's 1981 form refitted on the Duck profiles):
 * d_c = 1.75 He - 57.9 He^2 / (g Te^2), m under the low water, for a sea of significant height He and period Te. Inside
 * it that sea moves the bed; outside it the bed is the older sea's.
 */
export function birkemeierClosureM(heM: number, teS: number): number {
  return 1.75 * heM - (57.9 * heM * heM) / (G * teS * teS);
}
/** Komar and Gaughan's (1972) breaker height, m, of a deep-water height H0 (m) and period T (s). */
export function komarGaughanBreakerM(h0M: number, tS: number): number {
  return 0.39 * G ** 0.2 * (tS * h0M * h0M) ** 0.4;
}
/** The CERC drift, m^3/s of sand (the solid volume over the porosity), for the breaker height and angle. */
export function cercDriftM3S(hbM: number, thetaBRad: number): number {
  return (CERC_K_SIG * Math.sqrt(G / MCCOWAN_GAMMA) * hbM ** 2.5 * Math.sin(2 * thetaBRad))
    / (16 * (SAND_REL_DENSITY - 1) * (1 - SAND_POROSITY));
}
export function longshoreDriftOf(o: { hsM: number; tpS: number; breakerAngleDeg: number; sense: 1 | -1 }): LongshoreDrift {
  const th = (o.breakerAngleDeg * Math.PI) / 180;
  const hb = komarGaughanBreakerM(o.hsM, o.tpS);
  const q = cercDriftM3S(hb, th);
  return { breakerAngleRad: th, sense: o.sense, hbM: hb, qM3S: q, qM3Yr: q * YEAR_S };
}
/** The area and the wetted perimeter of the |n / half|^p section full to its top, m^2 and m. */
export function channelSectionFull(widthM: number, depthM: number, p: number): { areaM2: number; wetM: number } {
  const half = widthM / 2;
  let wet = 0;
  const nStep = 400;
  for (let k = 0; k < nStep; k += 1) {
    const n0 = (k / nStep) * half;
    const n1 = ((k + 1) / nStep) * half;
    const dz = depthM * ((n1 / half) ** p - (n0 / half) ** p);
    wet += Math.hypot(n1 - n0, dz);
  }
  return { areaM2: (p / (p + 1)) * widthM * depthM, wetM: 2 * wet };
}
export function deflectedSpitOf(o: {
  qMeanM3S: number; widthM: number; shapeP: number; manningN: number; tideM: number;
  hsM: number; tpS: number; runup2M: number; faceSlope: number; drift: LongshoreDrift;
}): DeflectedSpit {
  const crestM = swashBarCrestM({ tideM: o.tideM, hsM: o.hsM, tpS: o.tpS });
  const headM = crestM - o.tideM;
  const platformWidthM = o.runup2M / o.faceSlope;
  // The section that carries the mean flow at Escoffier's speed, the width held.
  const areaE = o.qMeanM3S / ESCOFFIER_SPEED_MS;
  const depthE = (areaE * (o.shapeP + 1)) / (o.shapeP * o.widthM);
  const sec = channelSectionFull(o.widthM, depthE, o.shapeP);
  const r = sec.areaM2 / sec.wetM;
  const slope = ((o.manningN * ESCOFFIER_SPEED_MS) / r ** (2 / 3)) ** 2;
  const lengthM = headM / slope;
  const centerOffsetM = platformWidthM + o.widthM / 2;
  return {
    drift: o.drift, crestM, headM, platformWidthM,
    channelWidthM: o.widthM, channelDepthM: depthE, hydraulicRadiusM: r, slope, lengthM,
    bendRadiusM: centerOffsetM, centerOffsetM,
    bruunRatio: (o.qMeanM3S * YEAR_S) / Math.max(o.drift.qM3Yr, 1e-9),
  };
}
/*
 * ROUND 15 (ruling 2): THE LOW-FLOW CHANNEL. Round 14 found the day's reach a 40 m pond running 0.12 to 0.21 m/s
 * everywhere: the clip's river (a standing wavelet of 1 m/s behind a snag, a seam at row 480) runs where that pond
 * cannot. A river at a low flow does not fill its mean-flow section: it runs in a narrower, shallower channel of its
 * own inside the mean-flow width, and the rest of the mean-flow bed stands bare or wet at the day's level.
 *   - AT-A-STATION HYDRAULIC GEOMETRY (Leopold and Maddock 1953): at one station w ~ Q^b, d ~ Q^f, v ~ Q^m with
 *     b + f + m = 1 (continuity). Their classic means over 20 US stations are b 0.26, f 0.40, m 0.34
 *     (`LEOPOLD_MADDOCK_AT_A_STATION`). For a section of a stated shape and friction law the exponents follow
 *     (Ferguson 1986, the at-a-station exponents from the section's form): in the |n / half|^p section the width grows
 *     as the depth's 1 / p power (b = f / p), and Manning's law in a wide channel gives v ~ d^(2/3) at one slope
 *     (m = 2 f / 3), so f = 1 / (1 + 1 / p + 2 / 3). The channel's own p (3.05 at the Sarcelle) gives b 0.17, f 0.50,
 *     m 0.33: the classic set within its spread. `atAStationExponents` derives them from the section.
 *   - THE DAY'S CHANNEL: the mean-flow section (Escoffier's, `deflectedSpitOf`) at the day's flow over the mean:
 *     w_d = w (Q_d / Q)^b, d_d = d (Q_d / Q)^f, v_d = v (Q_d / Q)^m, checked by continuity through the section; its
 *     slope by Manning at v_d and the section's hydraulic radius (the day's water surface falls along the reach at it).
 *   - THE BED: the mean-flow bed inside the mean width is FILLED to the day's water level (the sand the drift and the
 *     overwash bring at low flow, Kirk 1991's hapua at low flow) and the day's channel is cut into the fill about the
 *     course's centerline (the thalweg follows the course): `SeabedCourse.lowFlow`. The outlet's throat shoals with it.
 */
/** Leopold and Maddock's (1953) classic at-a-station exponents (width, depth, velocity). */
export const LEOPOLD_MADDOCK_AT_A_STATION = { b: 0.26, f: 0.4, m: 0.34 } as const;
/** The at-a-station exponents of the |n / half|^p section under Manning's law (Ferguson 1986): b + f + m = 1. */
export function atAStationExponents(shapeP: number): { b: number; f: number; m: number } {
  const f = 1 / (1 + 1 / shapeP + 2 / 3);
  return { b: f / shapeP, f, m: (2 * f) / 3 };
}
export function lowFlowChannelOf(o: {
  spit: DeflectedSpit; qMeanM3S: number; qDayM3S: number; shapeP: number; manningN: number;
  /** Absent: the section's own exponents (`atAStationExponents`). */
  exponents?: { readonly b: number; readonly f: number; readonly m: number };
}): LowFlowChannel {
  const ex = o.exponents ?? atAStationExponents(o.shapeP);
  const r = Math.max(o.qDayM3S, 1e-9) / o.qMeanM3S;
  const widthM = o.spit.channelWidthM * r ** ex.b;
  const depthM = o.spit.channelDepthM * r ** ex.f;
  const speedMS = ESCOFFIER_SPEED_MS * r ** ex.m;
  const sec = channelSectionFull(widthM, depthM, o.shapeP);
  const continuityMS = o.qDayM3S / sec.areaM2;
  const hydraulicRadiusM = sec.areaM2 / sec.wetM;
  const slope = ((o.manningN * speedMS) / hydraulicRadiusM ** (2 / 3)) ** 2;
  return { widthM, depthM, speedMS, areaM2: sec.areaM2, hydraulicRadiusM, slope, exponents: ex, continuityMS, qMeanM3S: o.qMeanM3S, qDayM3S: o.qDayM3S };
}
/**
 * THE DEFLECTED COURSE in world XZ (law 1): from the sea end (`seaEndM` seaward of the mouth's shoreline point) up
 * the outlet, round the outlet's bend through the spit's width, along the shore behind the platform at the
 * channel's centerline offset from the local mean-sea shoreline (`shorelineS` at each a: the channel follows the
 * coast's own wander), round the root's bend and up the river's own valley for `inlandM` at its own slope. Every
 * position follows from the spit's numbers; nothing is placed by hand. The thalweg: -depth at the mouth, rising at
 * the spit's slope to the root, then at the river's own slope.
 */
export function deflectedCourse(o: {
  params: SeabedParams; frame: BeachFrame; mouthA: number; spit: DeflectedSpit; seaEndM: number; inlandM: number;
  riverSlope: number; bankSlope: number; crestM: number;
  /** ROUND 14 (ruling 1): the washover's surface on the platform (the cap's landward slope). Absent: round 13's flat cap. */
  washover?: boolean;
  /** ROUND 14 (ruling 2): the terrace's top under the low water, m, and its width from the shoreline, m. Absent: none. */
  terrace?: { readonly depthStillM: number; readonly widthM: number };
  /** The low water's height over the mean sea level, m (the record's tide). */
  tideM?: number;
  /** ROUND 14: the coast's sand face's slope (the terrace's front falls at it). Absent: the bank's repose slope. */
  faceSlope?: number;
  /** ROUND 15 (ruling 2): the day's low-flow channel cut into the filled mean bed (`SeabedCourse.lowFlow`). Absent: none. */
  lowFlow?: { readonly widthM: number; readonly depthM: number; readonly slope: number };
}): DeflectedCourse {
  const sp = o.spit;
  const r = sp.bendRadiusM;
  const dirA: 1 | -1 = sp.drift.sense === 1 ? -1 : 1;
  const sig: number[] = [];
  const aa: number[] = [];
  const add = (sigma: number, da: number) => { sig.push(sigma); aa.push(o.mouthA + dirA * da); };
  add(-o.seaEndM, 0);
  add(0, 0);
  const arcN = Math.max(Math.ceil((Math.PI * r) / 2 / 2), 8);
  for (let k = 1; k <= arcN; k += 1) { const f = (k / arcN) * (Math.PI / 2); add(r * Math.sin(f), r - r * Math.cos(f)); }
  const legM = Math.max(sp.lengthM - (Math.PI * r) / 2, 0);
  const legN = Math.max(Math.ceil(legM / 3), 1);
  for (let k = 1; k <= legN; k += 1) add(r, r + (k / legN) * legM);
  const aRoot = r + legM;
  for (let k = 1; k <= arcN; k += 1) { const f = (k / arcN) * (Math.PI / 2); add(r + r - r * Math.cos(f), aRoot + r * Math.sin(f)); }
  const inN = Math.max(Math.ceil(o.inlandM / 5), 1);
  for (let k = 1; k <= inN; k += 1) add(2 * r + (k / inN) * o.inlandM, aRoot + r);
  const n = sig.length;
  const xz = new Float64Array(2 * n);
  const along = new Float64Array(n);
  const thal = new Float64Array(n);
  let x0 = Infinity; let z0 = Infinity; let x1 = -Infinity; let z1 = -Infinity;
  for (let k = 0; k < n; k += 1) {
    const s = sig[k] + shorelineS(o.params, o.frame, aa[k]);
    const [x, z] = beachToWorld(o.frame, s, aa[k]);
    xz[2 * k] = x; xz[2 * k + 1] = z;
    x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z);
  }
  // Along: 0 at the mouth's shoreline point (index 1), negative seaward.
  for (let k = 1; k < n; k += 1) along[k] = along[k - 1] + Math.hypot(xz[2 * k] - xz[2 * k - 2], xz[2 * k + 1] - xz[2 * k - 1]);
  const a1 = along[1];
  for (let k = 0; k < n; k += 1) along[k] -= a1;
  const rootAlong = sp.lengthM;
  for (let k = 0; k < n; k += 1) {
    const l = along[k];
    thal[k] = -sp.channelDepthM + sp.slope * Math.min(l, rootAlong) + o.riverSlope * Math.max(l - rootAlong, 0);
  }
  // The cut reaches the channel's half-width, the platform's width and the banks' rise over the coast's crest.
  const m = sp.channelWidthM / 2 + sp.platformWidthM + o.crestM / o.bankSlope + 10;
  const course0: SeabedCourse = { xz, along, thal, box: [x0 - m, z0 - m, x1 + m, z1 + m], spit: null };
  // The spit's side: the side of a point on the platform half-way along the reach.
  const mid = Math.min(Math.max(Math.round((2 + arcN + legN / 2)), 0), n - 1);
  const [ms, ma] = [sig[mid] - sp.channelWidthM / 2 - sp.platformWidthM / 2, aa[mid]];
  const [mx, mz] = beachToWorld(o.frame, ms + shorelineS(o.params, o.frame, ma), ma);
  const side = courseNearest(course0, mx, mz).side >= 0 ? 1 : -1;
  /* ROUND 14 (ruling 1): THE WASHOVER'S SURFACE. The overwash carries the swash's sand over the crest and drops it as
   * the sheet slows and soaks; a washover deposit thins landward and builds out into the water behind the barrier, so
   * its surface runs from the crest down to that water's level at its landward edge (Leatherman 1979; Donnelly,
   * Kraus and Larson 2006: washover fans prograde into the back-barrier water). The water behind the spit is the
   * river's, at the mean flow that shapes it: its level rises from the low water at the outlet at the spit's own
   * slope to the crest at the root (Escoffier's balance above: the head is the crest). So the platform is the crest at
   * its seaward edge (the mean-sea shoreline, across = the centerline's offset) and the river's mean level at its
   * landward edge (across = the channel's half width): flat at the root, a fall of the whole head at the outlet. */
  const washover = o.washover === true
    ? { seaAcrossM: sp.centerOffsetM, innerAcrossM: sp.channelWidthM / 2, baseM: (o.tideM ?? 0), slope: sp.slope }
    : undefined;
  /* ROUND 14 (ruling 2): THE SPIT'S SEAWARD TERRACE. The drift carries its sand along the spit inside the mean sea's
   * surf zone (CERC's transport is the breakers'); at a drift-dominated outlet (Bruun's ratio 20) the supply is over
   * what the waves can carry past it, and the sand settles on the spit's seaward face: the spit's subaqueous platform
   * (Meistrell 1972: a spit grows on a platform the drift builds ahead of it; FitzGerald 1988: the swash platform of a
   * wave-dominated outlet). The bed rises until the sea that works it most of the days moves it on: the platform's
   * top stands at the closure depth of the place's modal sea (`birkemeierClosureM` of the day's sea, the record's
   * daySeaHsM: 0.375 m under the low water), above which that sea carries the sand onshore into the swash platform and
   * the berm. Its width is the mean sea's surf zone (`coastBreakRef`: where the drift runs, 106.5 m from the shoreline),
   * and its front falls back to the coast's floor at the sand face's own slope (the coast's 1:11: the slope the waves keep
   * a sand face at; the repose angle stood a 2.6 m cliff at its edge, drawn from above as a box). Along the shore it
   * spans the spit to the root, whole from one surf-zone width past the channel's far bank at the outlet (the jet's axis
   * keeps its own floor, so the bar is the jet's as before), faded over one surf-zone width outside: the drift's sand
   * spreads over the surf zone's own scale. */
  const terrace = o.terrace
    ? {
      depthM: o.terrace.depthStillM - (o.tideM ?? 0), widthM: o.terrace.widthM, frontSlope: o.faceSlope ?? o.bankSlope,
      frame: { originX: o.frame.originX, originZ: o.frame.originZ, aX: o.frame.aX, aZ: o.frame.aZ },
      a0: o.mouthA + dirA * (sp.channelWidthM / 2 + o.terrace.widthM), a1: o.mouthA + dirA * aRoot, fadeM: o.terrace.widthM,
    }
    : undefined;
  /* ROUND 15 (ruling 2): THE LOW-FLOW CHANNEL. The day's water surface runs from the outlet's low water (`tideM`) up the
   * reach at the day's own Manning slope; the fill stands at it inside the mean width and the day's channel is cut into
   * the fill about the centerline (see the law above `lowFlowChannelOf`). Seaward of the shoreline point the level is
   * the low water: the outlet's throat shoals to the day's depth. */
  const lowFlow = o.lowFlow ? { widthM: o.lowFlow.widthM, depthM: o.lowFlow.depthM, baseM: o.tideM ?? 0, slope: o.lowFlow.slope, toM: rootAlong } : undefined;
  const course: SeabedCourse = {
    ...course0,
    spit: { capM: sp.crestM, side: side as 1 | -1, fromM: -o.seaEndM, toM: rootAlong, fadeM: (Math.PI * r) / 2, ...(washover ? { washover } : {}) },
    ...(terrace ? { terrace } : {}),
    ...(lowFlow ? { lowFlow } : {}),
  };
  return {
    course, aRootM: o.mouthA + dirA * aRoot, dirA, rootAlongM: rootAlong,
    terrace: terrace ? { depthStillM: o.terrace!.depthStillM, depthMslM: terrace.depthM, widthM: terrace.widthM, a0: terrace.a0, a1: terrace.a1 } : null,
  };
}

/**
 * THE PLACE'S SEDIMENT ABSORPTION SLOPE, 1/nm (round 4; see THE PLACE'S
 * CONDITIONS): from the clip's sand where the place has a clip, else round 2's
 * soil mineral (SED_ABSORB_SLOPE_NM).
 */
export function sedimentSlopeOf(place: MouthPlace, loadGM3: number): number {
  const c = mouthPlaceConditions(place);
  if (c === null) return SED_ABSORB_SLOPE_NM;
  return sedimentSlopeForHue(srgbToLinear(c.sandSrgb[0]) / srgbToLinear(c.sandSrgb[2]), loadGM3);
}

/**
 * THE PLACE'S RIVER OPTICS: the fit to the clip's water where the place has a
 * measure (round 5), else round 4's form (the sand's hue, `sedimentSlopeOf`;
 * the creek has no clip).
 */
export function placeRiverOptics(
  place: MouthPlace, loadGM3: number,
  /** ROUND 12: the load at the mean flow, g/m^3 (where round 5's measure fixed the particles). Absent: `loadGM3`. */
  meanLoadGM3 = loadGM3,
  /** ROUND 12: the dissolved organic matter at 443 nm, 1/m. Absent: the place's record (`cdomAg443M`); null: none. */
  cdomAg443M?: number | null,
): TurbidOptics & { readonly iop: RiverIop } {
  const c = mouthPlaceConditions(place);
  if (c === null || c.waterRInf === null) {
    const sl = sedimentSlopeOf(place, loadGM3);
    return { ...turbidOptics(loadGM3, 0.9, sl), iop: { aP443M2G: SED_ABSORB_443_M2_G, sPNm: sl, aG443M: 0, residualR: 0 } };
  }
  /* ROUND 12 (gap 1; the lead's ruling 1): THE RIVER'S OWN COLOR. Round 5 fitted the clip's water with the load at the
   * mean flow (500 g/m^3): there the particles carry the light and the fit gives their absorption (the catchment's
   * grey mineral: a*_p(443) 0.0097 m^2/g, slope 0.0005 /nm) and no dissolved term. At the clip's day (25 g/m^3) the
   * particles scatter a twentieth of that, so the water's color is its own: the dissolved organic matter (humic and
   * fulvic acids, tannin) the record carries as `cdomAg443M`, measured on the clip (SARCELLE_CONDITIONS). The
   * particles keep the mean flow's fit; the water at the day is that mineral at the day's load plus the record's
   * a_g. With no CDOM record the day's water is refitted at its own load as round 11 did. */
  const ag = cdomAg443M === undefined ? c.cdomAg443M : cdomAg443M;
  if (ag === null) {
    const iop = riverIopForReflectance(c.waterRInf, loadGM3);
    return { ...turbidOpticsIop(loadGM3, iop), iop };
  }
  const part = riverIopForReflectance(c.waterRInf, meanLoadGM3);
  const iop: RiverIop = { aP443M2G: part.aP443M2G, sPNm: part.sPNm, aG443M: part.aG443M + ag, residualR: part.residualR };
  return { ...turbidOpticsIop(loadGM3, iop), iop };
}
