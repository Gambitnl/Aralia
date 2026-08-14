// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/08/2026, 15:05:43
 * Dependents: components/BattleMap/BattleMapOverlay.tsx, hooks/combat/engine/useCombatEngine.ts, systems/combat/fallingGroundImpactResolution.ts, systems/combat/reactions/companionProtectionReaction.ts, systems/spells/mechanics/reactiveDamageRetaliationResolution.ts, systems/spells/mechanics/witchBoltOngoingResolution.ts, utils/combat/combatAI.ts, utils/combat/combatUtils.ts, utils/spatial/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file traces sight and targeting rays across the combat grid.
 *
 * Target validation, combat AI, reactions, and production visibility call this
 * helper so walls, sealed corners, and opaque target endpoints have one answer.
 * The source cell stays exempt because the observer already occupies it.
 *
 * Called by: combat targeting, visibility, reactions, and combat AI.
 * Depends on: production BattleMap tile records.
 */
import { BattleMapTile, BattleMapData } from '../../types/combat';
import { getBattleMapTileAltitudeFeet } from './elevationGeometry';

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
export interface LineOfSightOptions {
  /** Light may illuminate an opaque wall face even though sight cannot target through that endpoint. */
  includeEndTileBlocker?: boolean;
  /** Explicit creature altitude overrides the source ground for flying sight. */
  startAltitudeFeet?: number;
  /** Explicit creature altitude overrides the target ground for flying sight. */
  endAltitudeFeet?: number;
}

export function hasLineOfSight(
  startTile: BattleMapTile,
  endTile: BattleMapTile,
  mapData: BattleMapData,
  options: LineOfSightOptions = {},
): boolean {
  const line = bresenhamLine(startTile.coordinates.x, startTile.coordinates.y, endTile.coordinates.x, endTile.coordinates.y);
  const includeEndTileBlocker = options.includeEndTileBlocker ?? true;
  const startEyeFeet = (options.startAltitudeFeet ?? getBattleMapTileAltitudeFeet(startTile)) + 5;
  const endEyeFeet = (options.endAltitudeFeet ?? getBattleMapTileAltitudeFeet(endTile)) + 5;

  // A legacy opaque tile without a finite authored top remains fully opaque.
  // When a blocker top exists, compare it with the rising or falling eye ray.
  const blockerIntersectsRay = (tile: BattleMapTile | undefined, progress: number): boolean => {
    if (!tile?.blocksLoS) return false;
    const blockerTopFeet = tile.airspace?.blockerTopFeet;
    if (typeof blockerTopFeet !== 'number' || !Number.isFinite(blockerTopFeet)) return true;
    const rayHeightFeet = startEyeFeet + (endEyeFeet - startEyeFeet) * progress;
    return blockerTopFeet >= rayHeightFeet;
  };

  // The source cell is occupied by the observer and cannot hide that observer
  // from its own ray. Every later cell, including the target endpoint, is a
  // real sight fact and can therefore impose Total Cover.
  for (let i = 1; i < line.length; i++) {
    const point = line[i];
    const tile = mapData.tiles.get(`${point.x}-${point.y}`);
    
    // A tile blocks line of sight if it has the blocksLoS flag.
    // Ideally, we would check: tile.elevation >= Math.min(startTile.elevation, endTile.elevation)
    // But currently we treat all blocksLoS tiles as infinite height walls.
    const isEndPoint = i === line.length - 1;
    const progress = line.length <= 1 ? 1 : i / (line.length - 1);
    if (blockerIntersectsRay(tile, progress) && (includeEndTileBlocker || !isEndPoint)) {
       return false;
    }

    // A diagonal step passes through the corner shared by two orthogonal
    // cells. When both are opaque there is no open edge for the ray; when only
    // one is opaque, the opposite side still supplies a legitimate open lane.
    const previous = line[i - 1];
    const isDiagonalStep = previous.x !== point.x && previous.y !== point.y;
    if (isDiagonalStep) {
      const horizontalNeighbour = mapData.tiles.get(`${point.x}-${previous.y}`);
      const verticalNeighbour = mapData.tiles.get(`${previous.x}-${point.y}`);
      if (
        blockerIntersectsRay(horizontalNeighbour, progress)
        && blockerIntersectsRay(verticalNeighbour, progress)
      ) {
        return false;
      }
    }
  }
  return true;
}
