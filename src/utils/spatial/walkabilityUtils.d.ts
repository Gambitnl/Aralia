/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:20
 * Dependents: spatial/index.ts, walkabilityUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/walkabilityUtils.ts
 * Utilities for determining tile walkability and pathfinding in towns.
 */
import { TownMap, TileType } from '../../types/realmsmith';
import { TownPosition } from '../../types/town';
/**
 * Check if a specific tile type is walkable
 */
export declare function isTileTypeWalkable(tileType: TileType): boolean;
/**
 * Check if a specific tile type is blocking
 */
export declare function isTileTypeBlocking(tileType: TileType): boolean;
/**
 * Check if a tile at a specific position is walkable
 * Takes into account: tile type, buildings, doodads, and bounds
 */
export declare function isPositionWalkable(pos: TownPosition, townMap: TownMap): boolean;
/**
 * Get all walkable neighboring positions (8-directional)
 */
export declare function getWalkableNeighbors(pos: TownPosition, townMap: TownMap): TownPosition[];
/**
 * Calculate the Manhattan distance between two positions
 */
export declare function manhattanDistance(a: TownPosition, b: TownPosition): number;
/**
 * A* pathfinding implementation for town navigation
 * Returns array of positions from start to end (excluding start, including end)
 * Returns empty array if no path found
 */
export declare function findPath(start: TownPosition, end: TownPosition, townMap: TownMap, maxIterations?: number): TownPosition[];
/**
 * Find the nearest walkable position to a target
 * Useful for finding a spot near a building entrance
 */
export declare function findNearestWalkable(target: TownPosition, townMap: TownMap, maxRadius?: number): TownPosition | null;
/**
 * Get the building at a position (if any)
 */
export declare function getBuildingAtPosition(pos: TownPosition, townMap: TownMap): string | null;
/**
 * Get adjacent buildings to a position
 */
export declare function getAdjacentBuildings(pos: TownPosition, townMap: TownMap): string[];
