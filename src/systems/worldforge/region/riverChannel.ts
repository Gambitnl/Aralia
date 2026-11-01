/**
 * @file riverChannel.ts - a river's water and the channel it cuts, in one place.
 *
 * ONE WATER (Remy, 2026-10-30): "the complexity lies in the co-play between
 * landscape and water quantity." The world's channel and the live river's
 * water must come from one rule, or the water drains out of its channel or
 * floods over it. Before this file the world kept three numbers that did not
 * agree: one width per river (its mouth's), one 0.5 m depth for every river,
 * and the river page's 1.5 m^3/s for every live river.
 *
 * THE CHAIN, each step from the one before:
 *  1. THE WATER COUNT. The atlas routes rain downhill and adds it up cell by
 *     cell (FMG `cells.fl`). The count grows at each tributary. It is a
 *     RELATIVE count: read as m^3/s with the map's width curve, a 35 m river
 *     would carry 391 m^3/s and need a channel 7 to 9 m deep (the median river
 *     11 m wide and 7 m deep, a slot canyon). Measured on world 1793313247714,
 *     2026-10-30 (agora-257c).
 *  2. THE WIDTH. The map turns the count into a width (`riverWidthFt`, the
 *     map's own curve, kept as it is).
 *  3. THE FLOW. A river of that width carries the flow that hydraulic geometry
 *     gives: w = a Q^b (Moody and Troutman 2002, a = 7.2, b = 0.5, Q in m^3/s
 *     and w in m, at the mean annual flow; `oceanMouthLaws.ts` records the
 *     same law). That is the river's NORMAL flow.
 *  4. THE CHANNEL. A channel is cut by its flood, not its normal flow (Remy's
 *     ruling, 2026-10-30): the flood fills it to its banks; the normal flow
 *     runs lower in it. Its depth is the depth at which the flood flows at
 *     the river's fall (Manning), in a channel whose banks stand at the angle
 *     of repose. On the same world the median channel is then 1.2 m deep and
 *     about a tenth of its width, the ratio of real rivers.
 *  5. THE FALL. The river's slope comes from the atlas heights along its own
 *     cells, over a window that widens until the river falls, and on into its
 *     parent river where its own cells are flat.
 */
import { HG_WIDTH_A, HG_WIDTH_B, SAND_REPOSE_RAD } from '@/systems/world3d/ocean/oceanMouthLaws';
import { riverWidthFt } from './riverWidth';

const FEET_TO_METERS = 0.3048;

/**
 * THE FLOOD THAT CUTS THE CHANNEL, as a multiple of the normal flow. Still a
 * STATED input: the channel-filling flood returns about every 1.5 years on
 * average (Williams 1978; the USACE and NC State channel-forming flow notes),
 * and 3 puts the normal flow at about half the channel's depth.
 *
 * GG-540 (2026-11-02): `riverFloodToNormalFlow` now derives each river's
 * ratio from its catchment's climate (Turc 1954; Guo et al. 2014), and every
 * river segment records it, but the channel does not use it yet. The width
 * comes from the map and is tied to the MEAN flow (Moody and Troutman 2002),
 * so a larger flood can only make the channel deeper: the derived ratios (3.9
 * in a wet catchment, up to 22 in a dry one) cut V channels 13 to 26 m deep,
 * where real dry rivers are wide and shallow. The width law at the bankfull
 * flow comes first.
 */
export const RIVER_FLOOD_TO_NORMAL_FLOW = 3;

/** A river catchment's climate: mean annual rainfall, mm, and mean temperature, deg C. */
export interface RiverClimate {
  precipMm: number;
  tempC: number;
}

/**
 * The runoff ratio Q/P below which the flood fit has no data: the smallest
 * mean annual flood among the 266 basins (0.36 mm/d, Guo et al. 2014) is the
 * fit's value at Q/P = 0.007.
 */
const RUNOFF_RATIO_MIN = 0.007;

/** The standard normal value at non-exceedance 1/3, the 1.5-year return period. */
const Z_ONE_AND_HALF_YEAR = -0.430727;

/**
 * THE FLOOD THAT CUTS THE CHANNEL, as a multiple of the river's normal (mean
 * annual) flow, from its catchment's climate (GG-540, 2026-11-02). Remy's
 * rule: derive fitted values, do not state them. Each step is a published fit:
 *  1. THE RUNOFF RATIO Q/P. Turc (1954, "Le bilan d'eau des sols", Annales
 *     Agronomiques 5) gives the yearly evaporation from the rainfall P and the
 *     mean temperature T: E = P / sqrt(0.9 + (P/L)^2), L = 300 + 25 T +
 *     0.05 T^3 (mm); where P/L < 0.316 all rain evaporates. Q/P = 1 - E/P.
 *  2. THE MEAN ANNUAL FLOOD and its spread. Guo, Li, Leung, Guo, Liu and
 *     Sivapalan (2014, "Links between flood frequency and annual water balance
 *     behaviors", Water Resources Research 50, doi:10.1002/2013WR014374),
 *     Table 1, fitted on 266 MOPEX basins of 113 to 10,209 km^2: the mean of
 *     the annual maximum daily flows per unit area, mm/d, is
 *     exp(3.41 + 0.89 ln(Q/P)), and its coefficient of variation is
 *     exp(-1.05 - 0.41 ln(Q/P)).
 *  3. THE CHANNEL-FORMING FLOOD returns about every 1.5 years (Williams 1978;
 *     the USACE and NC State channel-forming flow notes). Read off a
 *     lognormal flood curve with that mean and spread (Chow 1954, "The
 *     log-probability law and its engineering applications"), which, unlike
 *     a Gumbel curve, stays positive for the large spread of dry climates.
 *  4. THE MEAN FLOW per unit area is P (Q/P), in mm/d.
 * The ratio is step 3 over step 4. A humid catchment (1,200 mm, 12 deg C)
 * gives about 7, a dry one about 20: a dry river's floods stand far above its
 * mean flow. Below Q/P 0.007 the fit has no data, so Q/P is held there.
 */
export function riverFloodToNormalFlow(climate: RiverClimate): number {
  const p = climate.precipMm;
  const t = climate.tempC;
  if (!(p > 0) || !Number.isFinite(t)) {
    throw new Error(`[river] A flood ratio needs the catchment's rainfall and temperature (P ${p} mm, T ${t} C).`);
  }
  // Below about -11 C Turc's evaporating power is no longer positive: cold
  // air takes up almost no water, so the rain runs off.
  const l = Math.max(1, 300 + 25 * t + 0.05 * t * t * t);
  const evaporation = p / l < 0.316 ? p : p / Math.sqrt(0.9 + (p / l) * (p / l));
  const runoffRatio = Math.max(RUNOFF_RATIO_MIN, 1 - evaporation / p);
  const meanFloodMmD = Math.exp(3.41 + 0.89 * Math.log(runoffRatio));
  const cv = Math.exp(-1.05 - 0.41 * Math.log(runoffRatio));
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const floodMmD = (meanFloodMmD / Math.sqrt(1 + cv * cv)) * Math.exp(Z_ONE_AND_HALF_YEAR * sigma);
  const meanFlowMmD = (p / 365.25) * runoffRatio;
  return floodMmD / meanFlowMmD;
}

/** Manning roughness of a natural river bed, s/m^(1/3). The live river's bed uses the same value. */
export const RIVER_CHANNEL_MANNING = 0.04;

/**
 * The bank's run per meter of rise: the banks stand at the repose angle of
 * medium sand, 32 degrees (`SAND_REPOSE_RAD`, Bagnold 1941; Allen 1970).
 */
export const RIVER_BANK_RUN_PER_RISE = 1 / Math.tan(SAND_REPOSE_RAD);

/** The normal flow of a river of this top width, m^3/s (hydraulic geometry, step 3). */
export function riverNormalFlowM3s(widthM: number): number {
  if (!(widthM > 0)) return 0;
  return Math.pow(widthM / HG_WIDTH_A, 1 / HG_WIDTH_B);
}

/** The flood that fills the channel to its banks, m^3/s: the normal flow
 * times the river's flood ratio (`riverFloodToNormalFlow`; the reference
 * ratio when the atlas carries no climate). */
export function riverFloodFlowM3s(widthM: number, floodRatio = RIVER_FLOOD_TO_NORMAL_FLOW): number {
  return riverNormalFlowM3s(widthM) * floodRatio;
}

/**
 * A river's channel: a trapezoid whose top is the river's width at the flood
 * level. `bottomWidthM` is 0 when the banks meet (a V channel).
 */
export interface RiverChannelSection {
  topWidthM: number;
  depthM: number;
  bottomWidthM: number;
  /** The bank's run per meter of rise. */
  run: number;
  slope: number;
}

/** The flow through a trapezoid of bottom width b at water depth y (Manning), m^3/s. */
function trapezoidFlowM3s(b: number, run: number, y: number, slope: number, n: number): number {
  if (y <= 0) return 0;
  const area = (b + run * y) * y;
  const wet = b + 2 * y * Math.sqrt(1 + run * run);
  return (area * Math.pow(area / wet, 2 / 3) * Math.sqrt(slope)) / n;
}

/**
 * THE CHANNEL OF A RIVER of this width at this fall: the depth at which its
 * flood fills a trapezoid whose top is that width. When even the V channel
 * (the banks meet at the bed) cannot carry the flood, the channel is that V:
 * the flood then spills over its banks, as a real one does.
 */
export function riverChannelSection(
  widthM: number,
  slope: number,
  n = RIVER_CHANNEL_MANNING,
  /**
   * The flood the channel must carry: by default the flood of a river of this
   * width. A channel narrower than its river (a town's channel) passes the
   * RIVER's flood, so it is cut deeper.
   */
  floodM3s = riverFloodFlowM3s(widthM),
): RiverChannelSection {
  if (!(widthM > 0) || !(slope > 0)) {
    throw new Error(`[river] A channel needs a width and a fall (width ${widthM} m, slope ${slope}).`);
  }
  const run = RIVER_BANK_RUN_PER_RISE;
  const q = floodM3s;
  const maxDepth = widthM / (2 * run);
  const flowAt = (d: number) => trapezoidFlowM3s(widthM - 2 * run * d, run, d, slope, n);
  let lo = 0;
  let hi = maxDepth;
  if (flowAt(hi) <= q) lo = hi;
  else {
    // The flow grows with the depth over (0, maxDepth]: bisect.
    for (let k = 0; k < 60; k += 1) {
      const d = (lo + hi) / 2;
      if (flowAt(d) > q) hi = d; else lo = d;
    }
  }
  const depthM = (lo + hi) / 2;
  return { topWidthM: widthM, depthM, bottomWidthM: Math.max(0, widthM - 2 * run * depthM), run, slope };
}

/**
 * The depth of a flow in a channel, m (Manning). Past the flood level the
 * banks are read as going on at the same angle.
 */
export function riverFlowDepthM(section: RiverChannelSection, flowM3s: number, n = RIVER_CHANNEL_MANNING): number {
  if (!(flowM3s > 0)) return 0;
  let lo = 0;
  let hi = section.depthM;
  while (trapezoidFlowM3s(section.bottomWidthM, section.run, hi, section.slope, n) < flowM3s) hi *= 2;
  for (let k = 0; k < 60; k += 1) {
    const d = (lo + hi) / 2;
    if (trapezoidFlowM3s(section.bottomWidthM, section.run, d, section.slope, n) > flowM3s) hi = d; else lo = d;
  }
  return (lo + hi) / 2;
}

/** The parts of the atlas the fall reads. */
export interface RiverFallAtlas {
  /** Cell centers, atlas pixels. */
  p: ArrayLike<readonly [number, number] | undefined>;
  /** Cell heights, FMG 0..100 (20 is sea level). */
  h: ArrayLike<number>;
  /** Cell water count (`cells.fl`). */
  fl: ArrayLike<number>;
  /** Cell feature id, for a lake's surface height. */
  f?: ArrayLike<number>;
  features?: ReadonlyArray<{ height?: number } | 0 | undefined>;
  /** The atlas rivers, for the walk into a parent river. */
  rivers: ReadonlyArray<{ i: number; cells: readonly number[]; parent?: number }>;
  /** A cell's climate (FMG rainfall `prec` x 100 mm, temperature deg C), for the flood ratio. Absent on atlases without climate. */
  climate?: (cell: number) => RiverClimate | undefined;
}

/**
 * THE WATER ALONG A RIVER, one entry per segment between the river's own cell
 * centers (segment k runs from cell k to cell k + 1, the last one into the
 * cell the river drains to). Each holds the water count of its upstream cell
 * (a cell's count applies from its center down) and the river's fall there.
 */
export interface RiverSegmentWater {
  /** The atlas water count of the segment's upstream cell. */
  count: number;
  /** The map's width there, ft (`riverWidthFt`). */
  widthFt: number;
  /** The fall, m per m. */
  slope: number;
  /**
   * The flood that would cut the channel here, as a multiple of the normal
   * flow (`riverFloodToNormalFlow`), from the mean climate of the river's own
   * cells from its source to this segment: the main stem stands for its
   * catchment. The reference ratio where the atlas carries no climate.
   * RECORDED, NOT YET APPLIED (GG-540, 2026-11-02): the channel still cuts
   * with RIVER_FLOOD_TO_NORMAL_FLOW until the width follows the bankfull flow.
   */
  floodRatio: number;
}

/**
 * A water cell's surface (a lake's own height, else sea level) and a land
 * cell's height, FMG units, read the way the river generator reads them.
 */
function surfaceH(atlas: RiverFallAtlas, c: number): number {
  const h = atlas.h[c];
  if (h >= 20) return h;
  const feature = atlas.f && atlas.features ? atlas.features[atlas.f[c]] : undefined;
  const lake = feature ? feature.height : undefined;
  return typeof lake === 'number' && lake > 0 ? Math.max(lake, 20) : 20;
}

/**
 * The segments of one river: its water and its fall. `heightFt` turns an FMG
 * height (0..100) into feet; `feetPerPixel` scales the atlas.
 *
 * A river whose whole water path reads flat (2026-10-31: 6 of 201 rivers in
 * world 1793371993547, such as river 377, two land cells at height 20 straight
 * into the sea) still falls: FMG heights are whole numbers, so the fall is less
 * than one height step. Its expected value is half a step, spread over the
 * whole path. This used to throw, which stopped the region, and with it the
 * game, from loading anywhere near such a river.
 */
export function riverSegmentWater(
  atlas: RiverFallAtlas,
  riverId: number,
  feetPerPixel: number,
  heightFt: (h01: number) => number,
): RiverSegmentWater[] {
  const river = atlas.rivers.find((r) => r.i === riverId);
  if (!river) throw new Error(`[river] River ${riverId} is not in the atlas.`);
  const own = river.cells.filter((c) => c >= 0 && atlas.p[c]);
  if (own.length < 2) return [];
  // THE WATER'S PATH past the river's end: on through the parent river (the
  // cell the river drains to is a parent cell), so a river with flat cells of
  // its own reads the fall its water meets downstream.
  const chain = own.slice();
  const seen = new Set<number>([river.i]);
  let parentId = river.parent;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = atlas.rivers.find((r) => r.i === parentId);
    if (!parent) break;
    const at = parent.cells.indexOf(chain[chain.length - 1]);
    if (at < 0) break;
    for (const c of parent.cells.slice(at + 1)) if (c >= 0 && atlas.p[c]) chain.push(c);
    parentId = parent.parent;
  }
  const zFt = chain.map((c) => heightFt(surfaceH(atlas, c) / 100));
  const along: number[] = [0];
  for (let k = 1; k < chain.length; k += 1) {
    const a = atlas.p[chain[k - 1]]!;
    const b = atlas.p[chain[k]]!;
    along.push(along[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]) * feetPerPixel);
  }
  const out: RiverSegmentWater[] = [];
  // The catchment's climate so far: a running mean over the river's own cells.
  let pSum = 0;
  let tSum = 0;
  let nClimate = 0;
  for (let k = 0; k < own.length - 1; k += 1) {
    const here = atlas.climate?.(own[k]);
    if (here && here.precipMm > 0 && Number.isFinite(here.tempC)) {
      pSum += here.precipMm;
      tSum += here.tempC;
      nClimate += 1;
    }
    const floodRatio = nClimate > 0
      ? riverFloodToNormalFlow({ precipMm: pSum / nClimate, tempC: tSum / nClimate })
      : RIVER_FLOOD_TO_NORMAL_FLOW;
    // The fall over the segment; where it is flat, the window widens a cell
    // each way until the water falls.
    let a = k;
    let b = k + 1;
    while (zFt[a] - zFt[b] <= 0 && (a > 0 || b < chain.length - 1)) {
      if (a > 0) a -= 1;
      if (b < chain.length - 1) b += 1;
    }
    let drop = zFt[a] - zFt[b];
    if (!(drop > 0)) {
      // The whole path is one height step: half a step of fall over all of it.
      const step = surfaceH(atlas, chain[b]);
      drop = heightFt((step + 0.5) / 100) - heightFt(step / 100);
    }
    const count = atlas.fl[own[k]];
    out.push({ count, widthFt: riverWidthFt(count), slope: drop / (along[b] - along[a]), floodRatio });
  }
  return out;
}

/** The map width of a river at a segment, m. */
export function segmentWidthM(s: RiverSegmentWater): number {
  return s.widthFt * FEET_TO_METERS;
}
