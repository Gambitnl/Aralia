/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 19/07/2026, 22:06:11
 * Dependents: components/DesignPreview/steps/PreviewStartSelect.tsx, components/MapPane.tsx, components/World3D/WebGPUProbe.tsx, components/World3D/World3DDemo.tsx, components/World3D/World3DWrapper.tsx, components/World3D/worldGenCore.ts, components/Worldforge/AtlasDemo.tsx, components/Worldforge/SpawnPreview.tsx, components/Worldforge/StartPointSelection.tsx, components/Worldforge/responsiveAtlasCore.ts, components/Worldforge/responsiveAtlasPreparation.ts, hooks/useKnownPortsSync.ts, hooks/useVoyageArrival.ts, systems/spells/ai/MaterialTagService.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/settlementDefense.ts, systems/worldforge/chronicle/worldChronicle.ts, systems/worldforge/dungeon/world/chronicle.ts, systems/worldforge/dungeon/world/deriveIdentity.ts, systems/worldforge/dungeon/world/dungeonSites.ts, systems/worldforge/dungeon/world/raidPressure.ts, systems/worldforge/dungeon/world/rumors.ts, systems/worldforge/forests/forestKindForCell.ts, systems/worldforge/leaf3d/atlasGroundRestore.ts, systems/worldforge/local/biomeForCell.ts, systems/worldforge/local/burgProximity.ts, systems/worldforge/local/resolveSpawn.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/chronicleForLocation.ts, systems/worldforge/townsim/registerBurgMerchants.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file legacySubmapBridge.ts â€” the seam between the LEGACY game world and
 * the Worldforge world (Remy's 2026-06-11 focus, slice 2: Azgaar â†’ submap).
 *
 * The legacy game (world map tiles, Location records, biomeIds) and the
 * Worldforge world (FMG atlas cells) are different worlds with no shared
 * coordinates. This bridge DEFINES the mapping so legacy surfaces can start
 * consuming Worldforge terrain before the legacy world generator is retired
 * (decision: replace aggressively â€” the Azgaar world is becoming THE world):
 *
 *   legacy world-map tile (x, y) on a WÃ—H map
 *     â†’ proportional FMG map position (x/WÂ·960, y/HÂ·540 px)
 *     â†’ nearest LAND atlas cell (water landings walk to the closest land)
 *     â†’ L1 region around that cell â†’ L2 local at the cell center.
 *
 * KNOWN INTERIM MISMATCH (documented, accepted): the legacy location's
 * biomeId does NOT constrain the FMG cell's biome â€” a legacy "forest" can
 * land on Azgaar desert until the world map itself is the atlas. Terrain is
 * deterministic per (worldSeed, location coords) either way.
 *
 * Caching: atlas generation costs ~0.5-1.5 s â€” cached per seed string at
 * module level (one world per session in practice). Regions and locals are
 * cached per anchor/center so re-entering a location is instant.
 */
import { type FmgAtlasResult } from "../fmg/generateAtlas";
import { type FmgWorldResult } from "../fmg/generateWorld";
import type { LocalArtifact, RegionArtifact, RegionTownSite } from "../artifacts";
import type { Burg } from "../fmg/burgs-generator";
export interface TownTileEntry {
    x: number;
    y: number;
    burgId: number;
    name: string;
}
type LiveBurg = Burg & {
    i: number;
};
/** Deterministic seed string for the FMG world from the game's worldSeed. */
export declare function worldforgeSeedString(worldSeed: number): string;
/**
 * Culture-true person namer for a burg's roster (SPEC: AI/procedural names
 * per culture). FMG's Markov name chains draw from the GLOBAL Math.random
 * (see fmg/utils/probabilityUtils RNG CONTRACT), so each call swaps in an
 * Alea stream seeded from the caller's own seeded rng and restores the
 * original in `finally` — no other system ever sees the swapped stream
 * (name generation is fully synchronous). Throws when the burg or
 * its culture can't be resolved - no fallback namer provided.
 */
export declare function getBurgNamer(worldSeed: number, burgId: number): (rng: {
    next(): number;
}) => string;
/**
 * FMG culture TYPE for a burg ('Highland' | 'Naval' | 'River' | 'Lake' |
 * 'Nomadic' | 'Hunting' | 'Generic') — drives the architecture style family
 * selected per town. No-fallback (project directive): throws if the burg or
 * its culture can't be resolved, same posture as getBurgNamer above.
 */
export declare function getBurgCultureType(worldSeed: number, burgId: number): string;
/**
 * FMG biome id for a burg — drives the climate class per town.
 * Throws when the burg or its cell biome can't be resolved (no-fallback).
 */
export declare function getBurgBiomeId(worldSeed: number, burgId: number): number;
export declare function getBridgeAtlas(worldSeed: number): FmgWorldResult;
/**
 * Install an atlas prepared by the browser worker into the existing canonical
 * per-seed cache.
 *
 * Structured clone cannot carry the runtime quadtree because it owns function
 * accessors. Rebuilding that lookup from the unchanged cell points restores the
 * same exact-cell behavior without regenerating or changing any world data.
 */
export declare function installPreparedBridgeAtlas(worldSeed: number, atlas: FmgWorldResult, transferProperties?: {
    gridPrecipitation?: ReadonlyArray<readonly [string, number]>;
}): FmgWorldResult;
/**
 * Map a legacy world-map tile to its anchoring atlas LAND cell.
 * Proportional projection, then nearest land cell by center distance
 * (linear scan — ~10k cells, sub-millisecond, no index needed).
 *
 * NOTE (cell-native world): the approved bridge spec proposed reimplementing
 * this as `legacyGridToAtlasCell + snapToLandCell` to unify the land rule with
 * the marker half. That was tried and reverted — it shifts `getTownTilesForGrid`
 * (FMG 960×540 projection vs graphWidth, and nearest-all+snap vs nearest-land),
 * breaking the town-tile mapping + pipeline round-trip. Kept as-is; the shared
 * `snapToLandCell` is still the single land-rule home for new cell-native paths.
 */
export declare function legacyTileToAtlasCell(atlas: FmgAtlasResult, worldMapX: number, worldMapY: number, worldMapWidth: number, worldMapHeight: number): number;
/**
 * The live burg (if any) a legacy grid tile opens onto. A tile "contains" a
 * burg when the burg's atlas position floor-projects into it (the algebraic
 * inverse of the tile-center convention). When several burgs share a tile the
 * one nearest the tile center wins (ties: lower id) — deterministic and purely
 * spatial, so the 2D grid, the town-tile inverse, and 3D entry all agree.
 */
export declare function burgForTile(atlas: FmgWorldResult, worldMapX: number, worldMapY: number, worldMapWidth: number, worldMapHeight: number): LiveBurg | null;
export interface BridgeLocalResult {
    local: LocalArtifact;
    region: RegionArtifact;
    /** The atlas cell the location resolved to (diagnostics / future wiring). */
    anchorCellId: number;
    /** FMG biome id used for the local profile. */
    biomeId: number;
}
/**
 * The bridge entry point: deterministic L2 LocalArtifact for a legacy
 * location. Same inputs â†’ byte-identical terrain, every call, every session.
 */
/**
 * Cell-first Locale entrypoint (cell-native world, Stage 1). Builds the
 * region/local for an EXACT atlas cell — no grid round-trip — so "enter cell C"
 * anchors the 3D slice on C, not a coarse-grid neighbour. `anchorCellId` must be
 * a land cell (callers land-snap first via snapToLandCell where needed).
 */
export declare function getWorldforgeLocalForCell(worldSeed: number, anchorCellId: number, opts?: {
    centerPx?: readonly [number, number];
}): BridgeLocalResult;
/**
 * Select the settlement represented by a Local window.
 *
 * Envelopes can overlap a 3,000 ft Local. The nearest overlapping burg wins,
 * with source id as the deterministic tie-breaker, which preserves room for
 * denser future settlement layouts without making array order into identity.
 */
export declare function canonicalTownSiteForLocal(region: RegionArtifact, local: Pick<LocalArtifact, 'bounds'>): RegionTownSite | undefined;
/**
 * Grid-tile Locale entrypoint (legacy bookkeeping path). A thin wrapper that
 * recovers the anchor cell from a coarse grid tile (nearest-land), then defers
 * to {@link getWorldforgeLocalForCell}. Used for party-location / WF_TILE /
 * WF_TOWN entries that don't carry an exact cell.
 */
export declare function getWorldforgeLocalForLocation(worldSeed: number, worldMapX: number, worldMapY: number, worldMapWidth: number, worldMapHeight: number): BridgeLocalResult;
export declare function getTownTilesForGrid(worldSeed: number, cols: number, rows: number): TownTileEntry[];
/** Test/dev hook: drop all cached worlds (e.g. between seeds in a session). */
export declare function clearBridgeCaches(): void;
export {};
