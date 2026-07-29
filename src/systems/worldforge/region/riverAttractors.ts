/**
 * @file riverAttractors.ts — the ONE rule for how a river-bearing burg pulls its
 * river through town.
 *
 * The region tier (`generateRegion.generateRiverBanks`) and the town tier
 * (`town/townRiverCourse`) each generate the river course independently, from
 * world data alone, and must land on the IDENTICAL line — that is what makes the
 * town river and the wilderness river one river. `generateRiverCourse` is pure,
 * so identity reduces to feeding it identical inputs. The attractor set is the
 * subtlest of those inputs, so it lives here once instead of being restated at
 * each tier where the two statements could silently drift.
 *
 * Everything here is a pure function of WORLD data (atlas cells, burgs,
 * feetPerPixel) and is computed from the FULL unclipped anchor line, never a
 * window, so adjacent regions agree at a shared world point.
 */
import type { Feet } from '../units';
import { townSpanFtForPeople, POPULATION_RATE } from '../town/townScale';

/** A settlement that pulls its river toward itself, with a hard cutoff radius. */
export interface RiverAttractor {
  x: Feet;
  y: Feet;
  radiusFt: Feet;
}

/** The burg fields the attractor rule reads. */
export interface AttractorBurg {
  i?: number;
  x: number;
  y: number;
  cell: number;
  removed?: boolean;
  population?: number;
}

/** Distance from point (px, py) to line segment (ax, ay)–(bx, by). */
export function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.01) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * A river's FULL unclipped cell-center anchor line in world feet — the input
 * `generateRiverCourse` resamples. Both tiers build it here so neither can
 * quietly filter the cell list differently.
 */
export function riverAnchorsFt(
  riverCells: readonly number[] | undefined,
  cellPoints: Array<[number, number]>,
  feetPerPixel: number,
): Array<[Feet, Feet]> {
  const out: Array<[Feet, Feet]> = [];
  for (const c of riverCells ?? []) {
    const p = cellPoints[c];
    if (!p) continue;
    out.push([p[0] * feetPerPixel, p[1] * feetPerPixel]);
  }
  return out;
}

/**
 * The attractor radius for one river-bearing burg.
 *
 * Baseline is the burg's own town span, so a burg already sitting on its river
 * only bends the course locally. But the atlas STATES this burg sits on this
 * river, and at canonical zoom the cell-center chord can pass further than a
 * town is wide (Epicea: 4,045 ft from a 2,536 ft town) — leaving the burg
 * OUTSIDE its own attractor radius, where the pull is exactly zero. The radius
 * must therefore reach the line it is meant to pull, and reach it with
 * authority: the smoothstep falloff is ~0 at the radius edge, so a chord sitting
 * exactly at the radius would not move at all. Doubling the gap puts the chord
 * at mid-falloff, where each pass closes about half the distance and
 * `ATTRACT_ITERATIONS` converges onto the settlement.
 */
export function riverAttractorRadiusFt(
  burgXFt: Feet,
  burgYFt: Feet,
  spanFt: Feet,
  riverAnchors: Array<[Feet, Feet]>,
): Feet {
  let radiusFt = spanFt * 1.5;
  let gapFt = Infinity;
  for (let i = 0; i < riverAnchors.length - 1; i++) {
    const [ax, ay] = riverAnchors[i];
    const [bx, by] = riverAnchors[i + 1];
    gapFt = Math.min(gapFt, pointToSegmentDist(burgXFt, burgYFt, ax, ay, bx, by));
  }
  if (Number.isFinite(gapFt)) radiusFt = Math.max(radiusFt, gapFt * 2);
  return radiusFt;
}

/**
 * Every river-bearing burg in the atlas, grouped by the river its own cell
 * carries (`cells.r`) — exactly the atlas's statement of which settlement sits
 * on which river.
 */
export function buildRiverAttractors(
  burgs: readonly AttractorBurg[],
  cellPoints: Array<[number, number]>,
  cellRiverIds: ArrayLike<number> | undefined,
  rivers: ReadonlyArray<{ i: number; cells: number[] }>,
  feetPerPixel: number,
): Map<number, RiverAttractor[]> {
  const riversById = new Map<number, { i: number; cells: number[] }>();
  for (const river of rivers) riversById.set(river.i, river);

  const attractors = new Map<number, RiverAttractor[]>();
  for (const burg of burgs) {
    if (!burg?.i || burg.removed) continue;
    const riverId = cellRiverIds?.[burg.cell];
    if (!riverId) continue;
    const bxFt = burg.x * feetPerPixel;
    const byFt = burg.y * feetPerPixel;
    const spanFt = townSpanFtForPeople((burg.population ?? 0) * POPULATION_RATE);
    const anchors = riverAnchorsFt(riversById.get(Number(riverId))?.cells, cellPoints, feetPerPixel);
    const radiusFt = riverAttractorRadiusFt(bxFt, byFt, spanFt, anchors);

    const list = attractors.get(Number(riverId)) ?? [];
    list.push({ x: bxFt, y: byFt, radiusFt });
    attractors.set(Number(riverId), list);
  }
  return attractors;
}
