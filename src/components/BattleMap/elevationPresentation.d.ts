/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 14:52:20
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMapTile.tsx, components/BattleMap/groundPainter/paintPipeline.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { BattleMapCrossing, BattleMapSurface, BattleMapTerrain } from "../../types/combat";
export type ElevationRelation = "higher" | "lower" | "level";
export interface BattleMapElevationPresentation {
    /** Rounded height above the lowest sampled ground tile on this battle map. */
    localReliefFeet: number;
    /** The comparison creature's height on the same map-floor scale. */
    referenceLocalReliefFeet: number | null;
    /** Signed rounded difference from the active or selected combatant. */
    relativeFeet: number | null;
    relation: ElevationRelation | "unreferenced";
    badgeText: string;
    relativeText: string | null;
    primaryText: string;
    secondaryText: string;
}
/** Recover true relief feet from the battle map's renderer-oriented encoding. */
export declare function elevationUnitsToFeet(elevation: number): number;
/** Return the five-foot contour band containing an encoded elevation value. */
export declare function elevationContourBand(elevation: number): number;
/**
 * Find the lowest finite ground sample in one tactical crop.
 *
 * WorldForge height values retain their wider-world offset, so the smallest
 * tile is not normally zero. Player-facing map height subtracts this baseline
 * before converting to feet; otherwise a river crop can claim every tile is
 * dozens of feet above an undefined "local low point."
 */
export declare function findBattleMapElevationBaseline(tiles: Iterable<{
    elevation: number;
}>): number;
/**
 * Describe one tile relative to a creature when a reference elevation exists.
 * Rounding to whole feet avoids counterfeit precision from interpolated source
 * terrain while retaining differences that are useful at tactical scale.
 */
export declare function describeBattleMapElevation(elevation: number, referenceElevation?: number | null, referenceLabel?: string, mapBaselineElevation?: number): BattleMapElevationPresentation;
/**
 * The physical tile facts that decide the inspector's terrain wording. A full
 * BattleMapTile satisfies this shape; tests can pass just the deciding fields.
 */
export interface BattleMapTerrainFacts {
    terrain: BattleMapTerrain;
    surface?: Pick<BattleMapSurface, "kind"> | null;
    crossing?: Pick<BattleMapCrossing, "kind"> | null;
}
/**
 * Name a tile's ground in plain language for the tile inspector.
 *
 * Physical facts outrank the base terrain word: a bridge or ford is the most
 * useful thing to say about a water tile, and a road matters more than the
 * ground it was worn into. Special terrains carry a short movement qualifier
 * so the player learns the rule with the name.
 */
export declare function describeBattleMapTerrain(tile: BattleMapTerrainFacts): string;
