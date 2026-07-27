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
import { type TownPlan } from './townEngine';
import { POPULATION_RATE } from './townScale';
import { type Pt } from '../submap/submapEngine';
import type { FmgWorldResult } from '../fmg/generateWorld';
import type { RegionTownSite } from '../artifacts';
import { type AdaptedTownPlan } from './townPlanAdapter';
import { type StyleFamily } from './architectureStyle';
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
export declare const CANON_TOWN_SPAN = 1000;
/**
 * People per FMG population point (FMG `populationRate`, default 1000 — see
 * generateWorld.ts). FMG stores burg `population` in POINTS (~0.01–60); the
 * town generator's typology bands (`townEngine.typologyForPopulation`) and ward
 * count expect real PEOPLE, so we scale here. (Urbanization is 1 in the bridge
 * atlas, so it drops out.) Canonical value lives in townScale.ts; re-exported
 * here so existing importers keep working.
 */
export { POPULATION_RATE };
/** Real urban population (people) for a burg. */
export declare function peopleForBurg(atlas: TownAtlas, burgId: number): number;
/**
 * Physical town span (feet) by population — drives the 3D footprint size so a
 * city reads bigger than a hamlet and wards aren't crammed. The formula lives
 * in townScale.ts (2026-07-22 town-scale lift: the old `sqrt(people) × 6`,
 * floor 800 ft packed ~330 people/ha — every town under ~18k people rendered
 * as the same 244 m doll-house square) and is shared with the region pass's
 * envelope so the flattening pad and gates always contain the town.
 */
export declare function townSpanFtForBurg(atlas: TownAtlas, burgId: number): number;
/**
 * The shared seed path for a burg's town: `wf:<worldSeed>/burg:<id>/s:town`.
 * BOTH views derive this identically from (worldSeed, burgId) — it does NOT
 * depend on the drill path, so the same burg always seeds the same town.
 */
export declare function canonicalTownSeedPath(worldSeed: number, burgId: number): string;
/**
 * The canonical town plan for a burg, in the NORMALIZED frame (cell shape,
 * centered at the origin, ~CANON_TOWN_SPAN across). The 2D renderer fits this to
 * view directly; the 3D bake scales+translates it via {@link transformTownPlan}
 * using {@link townPlacementForBurg}. Identity: same atlas + burgId ⇒ same plan.
 */
export declare function getCanonicalTownPlan(atlas: TownAtlas, worldSeed: number, burgId: number): TownPlan;
/**
 * The burg's inherited water in the NORMALIZED canonical frame, split by kind —
 * the SAME polylines (same `canonAffine`) that {@link getCanonicalTownPlan} fed
 * to the generator to seat docks/bridges. The 3D bake transforms these to feet
 * and fills them into water bodies, so the rendered water sits exactly under the
 * docks. Pure + deterministic from (atlas, burgId).
 */
export declare function getCanonicalTownWaterFeatures(atlas: TownAtlas, burgId: number): {
    rivers: Pt[][];
    coast: Pt[][];
};
/**
 * Affine map (scale then translate) every coordinate of a town plan. Pure;
 * returns a new plan and leaves the cached normalized plan untouched. Because
 * the geometry was computed once and only transformed here, the 3D town is the
 * same relative town as the 2D one.
 */
export declare function transformTownPlan(plan: TownPlan, k: number, dx?: number, dy?: number): TownPlan;
/**
 * Adapt one Atlas burg into the exact feet-space artifact consumed by both the
 * Local map and Ground 3D.
 *
 * Callers provide the Atlas they already own. This keeps standalone Atlas
 * inspection, native PLAYING descent, save reconstruction, and the 3D bake on
 * one plan source without forcing them through a second cell-addressed world.
 */
export declare function canonicalArtifactTownForSiteFromAtlas(atlas: TownAtlas, worldSeed: number, site: RegionTownSite): AdaptedTownPlan & {
    family: StyleFamily;
};
