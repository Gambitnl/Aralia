/**
 * @file canonicalTown.ts — the SINGLE source of truth for a burg's town plan.
 *
 * Both the 2D map drill (`MapPane`/`TownPlanView`) and the 3D ground bake
 * (`bridge/groundChunkLoader.ts`) generate a burg's town from THIS module, so
 * the same burg is the exact same place in both views (Worldforge Option B —
 * "truly identical towns"). The plan is produced once in the atlas-pixel frame
 * by `town/townEngine.ts`; the 3D side affine-transforms the RESULT to feet
 * rather than re-running the generator at feet scale.
 *
 * Why transform the result instead of re-generating: the submap Voronoi site
 * sampler quantizes coordinates (`submapEngine.ts` `toFixed(3)`) in ABSOLUTE
 * space and uses rejection sampling, so the generator is NOT scale-invariant —
 * running it on the same shape at two scales yields different towns. Generating
 * once (atlas px) and scaling the geometry sidesteps that entirely: identity is
 * guaranteed because there is one generator call per (atlas, burgId).
 *
 * IDENTITY PRECONDITION: 2D and 3D must pass the SAME atlas. A burgId only means
 * the same burg within one FMG world. See the call sites for how the atlas is
 * sourced.
 */
import { generateTownPlan, type TownPlan } from './townEngine';
import { polygonBounds, type Pt } from '../submap/submapEngine';
import type { FmgWorldResult } from '../fmg/generateWorld';
import { rootSeedPath, childSeedPath, streamPath } from '../seedPath';
import { burgCellPolygon, cellWaterPolylines, cellWaterFeatures, cellRoadPolylines } from './cellFeatures';

export { burgCellPolygon } from './cellFeatures';

/** Minimal atlas surface this module reads (satisfied by FmgWorldResult). */
type TownAtlas = Pick<FmgWorldResult, 'pack'>;

/**
 * Canonical generation span. The town is generated in a normalized frame (the
 * burg's cell SHAPE, centered at the origin, longest side scaled to this span),
 * so the 2D view (fit-to-view) and the 3D view (scaled to feet) share one plan.
 * A raw FMG cell is geographic (~50k ft at canonical FEET_PER_FMG_PIXEL) — far
 * too big for a town — so size is decided per-view, only the shape is shared.
 */
export const CANON_TOWN_SPAN = 1000;

/**
 * People per FMG population point (FMG `populationRate`, default 1000 — see
 * generateWorld.ts). FMG stores burg `population` in POINTS (~0.01–60); the
 * town generator's typology bands (`townEngine.typologyForPopulation`) and ward
 * count expect real PEOPLE, so we scale here. (Urbanization is 1 in the bridge
 * atlas, so it drops out.)
 */
export const POPULATION_RATE = 1000;

/** Real urban population (people) for a burg. */
export function peopleForBurg(atlas: TownAtlas, burgId: number): number {
  return (atlas.pack.burgs?.[burgId]?.population ?? 0) * POPULATION_RATE;
}

/**
 * Physical town span (feet) by population — drives the 3D footprint size so a
 * city reads bigger than a hamlet and wards aren't crammed. Clamped to a sane
 * walkable range.
 */
export function townSpanFtForBurg(atlas: TownAtlas, burgId: number): number {
  const people = peopleForBurg(atlas, burgId);
  return Math.max(800, Math.min(6000, Math.sqrt(Math.max(people, 1)) * 6));
}

/**
 * The shared seed path for a burg's town: `wf:<worldSeed>/burg:<id>/s:town`.
 * BOTH views derive this identically from (worldSeed, burgId) — it does NOT
 * depend on the drill path, so the same burg always seeds the same town.
 */
export function canonicalTownSeedPath(worldSeed: number, burgId: number): string {
  return streamPath(childSeedPath(rootSeedPath(worldSeed), `burg:${burgId}`), 'town');
}

/**
 * The cell-normalisation affine: cell shape centered at the origin, longest bbox
 * side scaled to CANON_TOWN_SPAN. Returned as a mapper so the footprint AND the
 * inherited water/road polylines all land in the same normalized frame.
 */
function canonAffine(cellPoly: Pt[]): (p: Pt) => Pt {
  const b = polygonBounds(cellPoly);
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
  const k = CANON_TOWN_SPAN / span;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return ([x, y]) => [(x - cx) * k, (y - cy) * k];
}

// Memoize per atlas (object identity) → per burg. Same world + same burg never
// regenerates; a different atlas (different world) gets its own table.
const planCache = new WeakMap<object, Map<number, TownPlan>>();

/**
 * The canonical town plan for a burg, in the NORMALIZED frame (cell shape,
 * centered at the origin, ~CANON_TOWN_SPAN across). The 2D renderer fits this to
 * view directly; the 3D bake scales+translates it via {@link transformTownPlan}
 * using {@link townPlacementForBurg}. Identity: same atlas + burgId ⇒ same plan.
 */
export function getCanonicalTownPlan(
  atlas: TownAtlas,
  worldSeed: number,
  burgId: number,
): TownPlan {
  let perBurg = planCache.get(atlas as object);
  if (!perBurg) { perBurg = new Map(); planCache.set(atlas as object, perBurg); }
  const hit = perBurg.get(burgId);
  if (hit) return hit;

  const cellPoly = burgCellPolygon(atlas, burgId);
  const toCanon = canonAffine(cellPoly);
  const toCanonLine = (line: Pt[]): Pt[] => line.map(toCanon);
  const footprint = cellPoly.map(toCanon);
  const population = peopleForBurg(atlas, burgId);
  // Inherited water (rivers/coast) + regional roads, derived from the burg cell
  // and mapped into the SAME normalized frame as the footprint. These drive
  // riverside/harbour docks, bridges between wards, and main streets continued
  // from real roads. Identity holds because the plan is generated ONCE here and
  // the 3D bake only affine-transforms this result.
  const water = cellWaterPolylines(atlas, burgId).map(toCanonLine);
  const roads = cellRoadPolylines(atlas, burgId).map(toCanonLine);
  const plan = generateTownPlan(footprint, canonicalTownSeedPath(worldSeed, burgId), {
    population,
    water,
    roads,
  });
  perBurg.set(burgId, plan);
  return plan;
}

/**
 * The burg's inherited water in the NORMALIZED canonical frame, split by kind —
 * the SAME polylines (same `canonAffine`) that {@link getCanonicalTownPlan} fed
 * to the generator to seat docks/bridges. The 3D bake transforms these to feet
 * and fills them into water bodies, so the rendered water sits exactly under the
 * docks. Pure + deterministic from (atlas, burgId).
 */
export function getCanonicalTownWaterFeatures(
  atlas: TownAtlas,
  burgId: number,
): { rivers: Pt[][]; coast: Pt[][] } {
  const toCanon = canonAffine(burgCellPolygon(atlas, burgId));
  const { rivers, coast } = cellWaterFeatures(atlas, burgId);
  return {
    rivers: rivers.map((l) => l.map(toCanon)),
    coast: coast.map((l) => l.map(toCanon)),
  };
}

const mapPt = (p: Pt, k: number, dx: number, dy: number): Pt => [p[0] * k + dx, p[1] * k + dy];
const mapPoly = (poly: Pt[], k: number, dx: number, dy: number): Pt[] =>
  poly.map((p) => mapPt(p, k, dx, dy));

/**
 * Affine map (scale then translate) every coordinate of a town plan. Pure;
 * returns a new plan and leaves the cached normalized plan untouched. Because
 * the geometry was computed once and only transformed here, the 3D town is the
 * same relative town as the 2D one.
 */
export function transformTownPlan(plan: TownPlan, k: number, dx = 0, dy = 0): TownPlan {
  const wards = plan.wards.map((w) => ({
    polygon: mapPoly(w.polygon, k, dx, dy),
    block: mapPoly(w.block, k, dx, dy),
    plots: w.plots.map((pl) => ({ ...pl, polygon: mapPoly(pl.polygon, k, dx, dy) })),
    civic: w.civic,
  }));
  return {
    footprint: mapPoly(plan.footprint, k, dx, dy),
    core: mapPoly(plan.core, k, dx, dy),
    wards,
    // Top-level plots share refs with wards[].plots (townEngine contract).
    plots: wards.flatMap((w) => w.plots),
    outskirts: plan.outskirts.map((o) => ({ ...o, polygon: mapPoly(o.polygon, k, dx, dy) })),
    walls: {
      ring: mapPoly(plan.walls.ring, k, dx, dy),
      gatehouses: mapPoly(plan.walls.gatehouses, k, dx, dy),
      // TG7: carry the river↔wall crossing points through the transform so the 3D
      // bake can break the wall ring for a water-gate where a river passes through
      // (previously dropped here, so the river clipped solid stone).
      waterGates: plan.walls.waterGates ? mapPoly(plan.walls.waterGates, k, dx, dy) : [],
    },
    civic: plan.civic.map((c) => ({ ...c, polygon: mapPoly(c.polygon, k, dx, dy) })),
    streets: plan.streets.map((s) => mapPoly(s, k, dx, dy)),
    farmsteads: plan.farmsteads.map((f) => ({ ...f, x: f.x * k + dx, y: f.y * k + dy })),
    demographics: plan.demographics,
  };
}
