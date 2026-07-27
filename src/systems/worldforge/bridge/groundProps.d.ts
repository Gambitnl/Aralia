/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 03:31:24
 * Dependents: systems/combat/worldScenario/worldBattleScenario.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file groundProps.ts — adapter that projects a live GroundWorld onto the prop
 * placement engine's slim `PropPlacementContext`, plus the combat-extraction
 * imprint helper. This is the WIRING layer promised at the end of
 * props/placementEngine.ts: the DATA layer (propSchema / catalog / placementEngine)
 * stays renderer- and GroundWorld-agnostic; this module owns the one-way
 * projection GroundWorld → context and the referee imprint onto BattleMapTiles.
 *
 * Determinism (spec decision 9): props derive from a seed path built off the
 * region's own `seedPath` when present (so props share the town's identity root),
 * else off `rootSeedPath(seed)` anchored to the artifact window origin — the SAME
 * discipline the hidden-sites top-up uses. Same world + same window → identical
 * props, forever.
 */
import type { GroundWorld } from './groundChunkLoader';
import type { PropPlacementContext } from '../props/placementEngine';
import type { WorldBusiness } from '../../../types/business';
import { type PropInstance, type PropDefinition } from '../props/propSchema';
import type { SeedPath } from '../seedPath';
import type { BattleMapTile } from '@/types/combat';
export { WAVE1_PROPS_BY_ID, PROPS_BY_ID } from '../props/catalog';
/**
 * Derive the props seed path for a ground window. Rooted at the region's town
 * identity when we have it (props then live under the town's own path), else at
 * the world root anchored to the window origin — matching the hidden-sites
 * fallback so two windows of the same world never collide.
 */
export declare function propsSeedPathFor(ground: GroundWorld, seed: number, regionSeedPath?: SeedPath): SeedPath;
/**
 * Project a GroundWorld onto the placement engine's context. Reads exactly what
 * the loader already knows: building plots (+roles), roads, dock/bridge decks,
 * the biome grid, and market plazas synthesized from each town's market plots.
 */
export declare function groundToPlacementContext(ground: GroundWorld, worldBusinesses?: Record<string, WorldBusiness>): PropPlacementContext;
/**
 * Produce the WAVE-1 prop instances for a ground window, deterministically. Thin
 * wrapper over the placement engine that owns the GroundWorld→context projection
 * and the seed-path derivation so callers (the loader, tests) get one entry point.
 */
export declare function buildGroundProps(ground: GroundWorld, seed: number, regionSeedPath?: SeedPath, worldBusinesses?: Record<string, WorldBusiness>): PropInstance[];
/**
 * Footprint of a placed prop in ground meters as a half-extent (radius). Size
 * class S imprints its own cell only; M/L imprint a small footprint disc so a
 * crate-stack or fence run marks the cells it truly spans.
 */
export declare function propFootprintRadiusM(def: PropDefinition): number;
/**
 * Imprint a placed prop's referee data onto the BattleMap tile at (tx, ty) whose
 * ground-meter center is (wx, wz), IF the prop's footprint covers that tile.
 * Mutates the tile in place; a "harder" prop wins each boolean so overlapping
 * props never soften a tile. Returns true if this prop touched the tile.
 *
 * This is the promise of the wave made concrete: a prop is born combat-legible —
 * the same crate the 3D scene will draw already blocks movement, grants cover,
 * and carries its wood/thickness for spell penetration.
 */
export declare function imprintPropOnTile(tile: BattleMapTile, prop: PropInstance, wx: number, wz: number): boolean;
