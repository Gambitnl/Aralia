/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:00
 * Dependents: combatUtils.ts, lineOfSight.ts, spatial/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file lineOfSight.ts
 * Utility for calculating line of sight on a grid.
 */
import { BattleMapTile, BattleMapData } from '../../types/combat';
/**
 * Implements Bresenham's line algorithm to find all tiles on a line between two points.
 * @param x0 - Start X coordinate
 * @param y0 - Start Y coordinate
 * @param x1 - End X coordinate
 * @param y1 - End Y coordinate
 * @returns An array of coordinates representing the line.
 */
export declare function bresenhamLine(x0: number, y0: number, x1: number, y1: number): {
    x: number;
    y: number;
}[];
/**
 * Checks if there is a clear line of sight between two tiles, considering obstacles.
 *
 * NOTE: Current implementation uses a simplified elevation check. Any tile flagged with `blocksLoS`
 * between the start and end points will completely block vision, regardless of relative elevations.
 *
 * Future improvements should compare tile elevations (e.g. looking down from a cliff should
 * ignore low walls).
 *
 * @param startTile - The tile where the line of sight originates.
 * @param endTile - The tile being targeted.
 * @param mapData - The complete battle map data.
 * @returns `true` if there is a clear line of sight, `false` if blocked.
 */
export declare function hasLineOfSight(startTile: BattleMapTile, endTile: BattleMapTile, mapData: BattleMapData): boolean;
