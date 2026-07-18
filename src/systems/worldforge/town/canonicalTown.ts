// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/07/2026, 23:25:14
 * Dependents: components/MapPane.tsx, components/Worldforge/AtlasDemo.tsx, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/legacySubmapBridge.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/registerBurgMerchants.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import type { RegionTownSite } from '../artifacts';
import { toArtifactPlan, type AdaptedTownPlan } from './townPlanAdapter';
import {
  climateForBiomeId,
  styleFamilyForCultureType,
  type StyleFamily,
} from './architectureStyle';

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
    // Preserve non-geometric ward facts such as wealth, civic role, and the
    // architecture district. The previous field-by-field copy silently dropped
    // wealth before 3D adaptation, so transformed towns lost their social finish.
    ...w,
    polygon: mapPoly(w.polygon, k, dx, dy),
    block: mapPoly(w.block, k, dx, dy),
    plots: w.plots.map((pl) => ({ ...pl, polygon: mapPoly(pl.polygon, k, dx, dy) })),
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
    // Court identity and amenity remain unchanged; only the spatial receipt is
    // transformed into the destination frame used by the artifact adapter.
    courtyards: plan.courtyards.map((court) => ({
      ...court,
      center: mapPt(court.center, k, dx, dy),
      radius: court.radius * Math.abs(k),
    })),
    farmsteads: plan.farmsteads.map((f) => ({ ...f, x: f.x * k + dx, y: f.y * k + dy })),
    demographics: plan.demographics,
  };
}

/**
 * Adapt one Atlas burg into the exact feet-space artifact consumed by both the
 * Local map and Ground 3D.
 *
 * Callers provide the Atlas they already own. This keeps standalone Atlas
 * inspection, native PLAYING descent, save reconstruction, and the 3D bake on
 * one plan source without forcing them through a second cell-addressed world.
 */
export function canonicalArtifactTownForSiteFromAtlas(
  atlas: TownAtlas,
  worldSeed: number,
  site: RegionTownSite,
): AdaptedTownPlan & { family: StyleFamily } {
  const burg = atlas.pack.burgs?.[site.burgId];
  if (!burg || burg.removed || !burg.i) {
    throw new Error(`Cannot resolve canonical Atlas burg ${site.burgId} in world ${worldSeed}`);
  }

  // Resolve culture and biome from this same Atlas object. These are visual
  // identity inputs, so silently consulting another cached world would make
  // the Local plan and 3D architecture disagree even if their burg ids match.
  const cultureId = burg.culture ?? 0;
  const culture = atlas.pack.cultures?.[cultureId] as { type?: string } | undefined;
  if (!culture?.type) {
    throw new Error(
      `Cannot resolve culture ${cultureId} for canonical burg ${site.burgId} in world ${worldSeed}`,
    );
  }
  const biomeId = (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[burg.cell];
  if (biomeId === undefined) {
    throw new Error(
      `Cannot resolve biome for canonical burg ${site.burgId} in world ${worldSeed}`,
    );
  }

  // Generate in the normalized burg frame once, then place that exact result
  // into the Region envelope used by the retained Local and Ground window.
  const enginePlan = getCanonicalTownPlan(atlas, worldSeed, site.burgId);
  const spanFt = townSpanFtForBurg(atlas, site.burgId);
  const placeScale = spanFt / CANON_TOWN_SPAN;
  const placeDx = site.envelope.x + site.envelope.width / 2;
  const placeDy = site.envelope.y + site.envelope.height / 2;
  const feetPlan = transformTownPlan(enginePlan, placeScale, placeDx, placeDy);
  const family = styleFamilyForCultureType(culture.type);
  const adapted = toArtifactPlan(
    feetPlan,
    site.burgId,
    family,
    climateForBiomeId(Number(biomeId)),
  );

  // Current Regions already carry this exact receipt. The legacy construction
  // branch is deliberately centralized here so old fixtures gain one stable
  // name instead of making each renderer fall back independently.
  const isCoastal = Boolean(burg.port);
  const identity = site.identity ?? {
    kind: 'town' as const,
    sourceKind: 'atlas-burg' as const,
    sourceId: site.burgId,
    name: burg.name ?? `Burg ${site.burgId}`,
    settlementType: burg.capital ? 'capital' as const : isCoastal ? 'port' as const : 'town' as const,
    biomeId: Number(biomeId),
    hasRoadAccess: site.gates.length > 0,
    hasRiverAccess: Boolean(
      (atlas.pack.cells as unknown as { r?: ArrayLike<number> }).r?.[burg.cell],
    ),
    isCoastal,
  };

  return {
    ...adapted,
    plan: {
      ...adapted.plan,
      identity,
    },
    family,
  };
}
