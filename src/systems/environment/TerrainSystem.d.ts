/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 04:59:05
 * Dependents: systems/environment/EnvironmentSystem.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/environment/TerrainSystem.ts
 * Defines the mechanical rules for different terrain types.
 * Maps string identifiers to Movement Costs, Cover, and other tactical properties.
 *
 * This file owns the canonical shared terrain registry. EnvironmentSystem keeps
 * a battle-map compatibility overlay for the few terrain keys whose semantics
 * intentionally differ from the broader exploration/world terrain set.
 */
import { TerrainRule, CoverType } from '../../types/environment';
/**
 * Registry of terrain rules.
 * This is the canonical terrain source for the wider terrain system.
 */
export declare const TERRAIN_RULES: Record<string, TerrainRule>;
/**
 * Gets the movement cost for a specific terrain type.
 * Defaults to 1 if unknown.
 */
export declare function getTerrainMovementCost(terrainId: string): number;
/**
 * Gets the cover bonus provided by the terrain itself.
 * Note: This is ground cover (e.g. waist-high water, tall grass),
 * distinct from Objects (walls, trees).
 */
export declare function getTerrainCover(terrainId: string): CoverType;
/**
 * Determines if a terrain type grants advantage on Stealth checks.
 */
export declare function terrainGrantsStealth(terrainId: string): boolean;
