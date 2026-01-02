/**
 * @file lineOfSight.ts
 * Utility for calculating line of sight on a grid.
 */
import { BattleMapTile, BattleMapData } from '../types/combat';

/**
 * Implements Bresenham's line algorithm to find all tiles on a line between two points.
 * @param x0 - Start X coordinate
 * @param y0 - Start Y coordinate
 * @param x1 - End X coordinate
 * @param y1 - End Y coordinate
 * @returns An array of coordinates representing the line.
 */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): { x: number, y: number }[] {
  const points: { x: number, y: number }[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;
  let reachedEnd = false;

  while (!reachedEnd) {
    points.push({ x: Math.round(x), y: Math.round(y) });
    if (Math.round(x) === x1 && Math.round(y) === y1) {
      reachedEnd = true;
      break;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

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
export function hasLineOfSight(startTile: BattleMapTile, endTile: BattleMapTile, mapData: BattleMapData): boolean {
  const line = bresenhamLine(startTile.coordinates.x, startTile.coordinates.y, endTile.coordinates.x, endTile.coordinates.y);

  // Check each tile along the path, excluding start and end
  for (let i = 1; i < line.length - 1; i++) {
    const point = line[i];
    const tile = mapData.tiles.get(`${point.x}-${point.y}`);
    
    // A tile blocks line of sight if it has the blocksLoS flag.
    // Ideally, we would check: tile.elevation >= Math.min(startTile.elevation, endTile.elevation)
    // But currently we treat all blocksLoS tiles as infinite height walls.
    if (tile && tile.blocksLoS) {
       return false;
    }
  }
  return true;
}
