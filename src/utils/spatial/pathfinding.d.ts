/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 14:09:19
 * Dependents: utils/pathfinding.ts, utils/spatial/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file pathfinding.ts
 * Implements the A* pathfinding algorithm for grid-based movement.
 * Updated to support D&D 5e Variant 5-10-5 diagonal movement.
 */
import { BattleMapTile, BattleMapData } from '../../types/combat';
import { MovementConfig } from '../combat/physicsUtils';
/**
 * Calculates the Chebyshev distance between two tiles.
 * Used as the heuristic for A* pathfinding.
 * Multiplied by 5 to match 5e movement scale.
 */
export declare function heuristic(a: BattleMapTile, b: BattleMapTile): number;
/**
 * Finds the shortest path between two tiles using the A* algorithm.
 * Supports 8-way movement (including diagonals) with 5-10-5 cost rule.
 *
 * @param startTile - The starting tile.
 * @param endTile - The destination tile.
 * @param mapData - The complete battle map data containing all tiles.
 * @param movementConfig - Optional configuration for movement physics (climbing, swimming, etc.).
 * @param sizeMultiplier - The width/height of the creature in tiles (default 1).
 * @returns An array of tiles representing the path from start to end (inclusive of start).
 *          Returns an empty array if no path is found.
 */
export declare function findPath(startTile: BattleMapTile, endTile: BattleMapTile, mapData: BattleMapData, movementConfig?: Partial<MovementConfig>, sizeMultiplier?: number): BattleMapTile[];
