/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 13:41:53
 * Dependents: systems/visibility/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file VisibilitySystem.ts
 * Core logic for calculating light levels and character visibility in the Underdark.
 *
 * "In the deep, light is not a given. It is a resource." - Depthcrawler
 */
import { BattleMapData, CombatCharacter, LightSource, LightLevel } from '../../types/combat';
export type VisibilityTier = 'visible' | 'dim' | 'hidden';
export declare class VisibilitySystem {
    /**
     * Calculates the light level for every tile on the map based on active light sources.
     * Considers walls blocking light.
     *
     * @param mapData The current state of the battle map.
     * @param lightSources List of active light sources.
     * @returns A map of tile IDs to their LightLevel.
     */
    static calculateLightLevels(mapData: BattleMapData, lightSources: LightSource[]): Map<string, LightLevel>;
    /**
     * Calculates what a specific observer can see.
     *
     * @param observer The character looking around.
     * @param mapData The map.
     * @param lightLevels Pre-calculated light levels for the map.
     * @returns A map of Tile IDs to VisibilityTier.
     */
    static calculateVisibility(observer: CombatCharacter, mapData: BattleMapData, lightLevels: Map<string, LightLevel>): Map<string, VisibilityTier>;
    private static isLineBlocked;
    /**
     * Opaque cover is only meaningful for object-mounted light sources, so the
     * visibility pass checks the map's explicit object records before spending
     * the light budget on tiles.
     */
    private static isSuppressedByOpaqueCover;
}
