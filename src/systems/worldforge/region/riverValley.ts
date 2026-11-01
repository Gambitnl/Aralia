/**
 * @file riverValley.ts — a river runs at the bottom of its own valley.
 *
 * Remy, 2026-11-01, looking at the live river through Fapolis: "fix the gorge,
 * towns should build down to the river."
 *
 * THE FAULT. The region carve cut each river a fixed channel depth below the
 * ground under it. The ground under a river does not always fall downstream:
 * through Fapolis (seed 42, tile 9,5) it rose from 7 m where the river enters
 * the 3D window to 19 m at the town, then fell to 6 m. A river cannot flow over
 * a 12 m hill, so the 3D ground carve (which never lets a bed rise downstream)
 * cut a 15 m trench with steep walls through the town, and the building pads
 * beside it stood on pale columns of ground.
 *
 * THE RULE. Water runs downhill and cuts its valley as it goes:
 * - THE GRADE. Walk each river from source to mouth over the region ground at
 *   its course. The river's flood level (its bank top) is the lowest ground
 *   seen so far: it never rises downstream. Where the ground humps over the
 *   river, the grade passes through the hump at the level the river had
 *   before it. The grade reads the ground along the river's FULL course, so
 *   two neighboring windows get the same grade at a shared point (seam purity).
 * - THE VALLEY. Beside the channel the ground is at most the flood level over
 *   a floodplain one river width wide on each side, then rises at
 *   VALLEY_SIDE_SLOPE until it meets the land. The cut only lowers ground.
 *
 * What is preserved: where the ground already falls downstream (most rivers),
 * the grade is the ground itself and the valley lowers nothing beyond the old
 * channel. The channel's own shape (full depth in its core, a linear fall to
 * its half width) is unchanged, and the old relative cut stays a lower bound.
 *
 * The 3D ground carve (`groundChunkLoader` `carveRiverChannelToGrade`) still
 * runs after this. With the valley here it finds banks near the flood level,
 * so its cut is shallow, and the town's building pads (laid before that carve)
 * already stand on the valley ground.
 */

import type { Feet } from '../units';
import { elevationCurveFt } from '../local/generateLocal';

/**
 * Rise over run of a valley side, from the floodplain edge to the land.
 * 1 in 8 (about 7 degrees) is a gentle lowland valley wall: a street climbs
 * it, and a town on it can step its houses down to the water.
 */
export const VALLEY_SIDE_SLOPE = 1 / 8;

/** Floodplain width beside the channel, on each side, in river widths. */
export const FLOODPLAIN_WIDTHS = 1;

/**
 * The farthest a valley side reaches from the channel edge, ft. A river cut
 * deep into high country would otherwise lower whole hillsides; past this
 * reach the cut fades out over VALLEY_FADE_FT so it never leaves a step.
 */
export const VALLEY_REACH_CAP_FT = 2500;
const VALLEY_FADE_FT = 600;

/**
 * The flood level along a course, ft, from the source (index 0) to the mouth.
 * It never rises downstream and never drops under `floorFt` (the valley floor
 * stays land; the channel itself may cut below it). Pure.
 *
 * Without `fallFt` it is the running minimum of the ground. With it (GG-536,
 * 2026-11-01), the level also falls at least `fallFt[i]` from point i - 1 to
 * point i (the atlas grade times the step), because water on a dead level bed
 * drains away to the outflow edge of the live river. That forced fall stops
 * once the level stands `maxDriftFt[i]` under the ground there, so a long
 * flat plain does not drive the river into a trench: past that depth the
 * level holds, and the ground falling again takes it on down.
 */
export function riverGradeFt(
  groundFt: ArrayLike<number>,
  floorFt: number,
  fallFt?: ArrayLike<number>,
  maxDriftFt?: ArrayLike<number>,
): Float64Array {
  const grade = new Float64Array(groundFt.length);
  let prev = Number.POSITIVE_INFINITY;
  for (let i = 0; i < groundFt.length; i++) {
    const g = Number.isFinite(groundFt[i]) ? groundFt[i] : prev;
    let level = Math.min(g, prev);
    if (fallFt && i > 0 && Number.isFinite(prev)) {
      const forced = Math.min(g, prev - Math.max(0, fallFt[i]));
      // The deepest the forced fall may take it: the drift cap under the
      // ground, but never above the level it already had.
      const lowest = Math.min(prev, g - (maxDriftFt ? maxDriftFt[i] : Number.POSITIVE_INFINITY));
      level = Math.max(forced, lowest);
    }
    level = Math.max(floorFt, level);
    grade[i] = level;
    prev = level;
  }
  return grade;
}

/**
 * The valley ground at `d` ft from the course centerline, ft, given the flood
 * level there, the channel's half width and its flood depth. Inside the
 * channel: the flood level less the depth (full in the core, falling linearly
 * to zero at the half width). Outside: the flood level over the floodplain,
 * then the valley side. Pure.
 */
export function valleyTargetFt(
  d: Feet, floodFt: number, halfWidthFt: Feet, coreFt: Feet, depthFt: number, widthFt: Feet,
): number {
  if (d < halfWidthFt) {
    const falloff = d <= coreFt ? 1 : 1 - (d - coreFt) / (halfWidthFt - coreFt);
    return floodFt - depthFt * falloff;
  }
  const side = Math.max(0, d - halfWidthFt - FLOODPLAIN_WIDTHS * widthFt);
  return floodFt + side * VALLEY_SIDE_SLOPE;
}

/**
 * How far a valley side must reach from the channel edge so that past it the
 * valley stands above every sample of the window (`maxFt`): then stopping
 * there leaves no step. Capped at VALLEY_REACH_CAP_FT. Pure.
 */
export function valleyReachFt(floodFt: number, maxFt: number, widthFt: Feet): Feet {
  const rise = Math.max(0, maxFt - floodFt);
  return FLOODPLAIN_WIDTHS * widthFt + Math.min(VALLEY_REACH_CAP_FT, rise / VALLEY_SIDE_SLOPE);
}

/**
 * The weight of the valley cut at `beyondEdgeFt` past the channel edge: 1, then
 * a linear fade to 0 over the last VALLEY_FADE_FT of a CAPPED reach (an
 * uncapped reach ends where the valley is already above the land). Pure.
 */
export function valleyCutWeight(beyondEdgeFt: Feet, reachFt: Feet, capped: boolean): number {
  if (beyondEdgeFt >= reachFt) return 0;
  if (!capped) return 1;
  const fadeStart = reachFt - VALLEY_FADE_FT;
  return beyondEdgeFt <= fadeStart ? 1 : (reachFt - beyondEdgeFt) / VALLEY_FADE_FT;
}

/**
 * Feet back to a normalized height: the inverse of `elevationCurveFt`, which
 * is exactly `n * 2000` below n = 0.5 and strictly increasing above it. Pure.
 */
export function normalizedFromFt(ft: number): number {
  if (ft <= 1000) return ft / 2000;
  let lo = 0.5;
  let hi = 1;
  if (ft >= elevationCurveFt(1)) return 1;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (elevationCurveFt(mid) < ft) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
