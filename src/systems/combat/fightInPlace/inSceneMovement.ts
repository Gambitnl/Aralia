/**
 * @file inSceneMovement.ts — the invisible referee for in-scene (3D) movement.
 *
 * Fight-in-place slice 2 ("kill the teleport"): when a fight is rendered IN the
 * streamed world, a click on the 3D ground picks a WORLD-METERS position. This
 * module is the referee that turns that click into a legal/illegal move:
 *
 *   world meters ──worldMetersToPatchTile──▶ 5-ft tile ──computeReachableTiles──▶ legal?
 *
 * It is pure (no React/Three) so the world-pos → tile → legality pipeline is
 * unit-testable and IDENTICAL to what the always-available 2D board rules. The
 * tile mapping mirrors `extractLocalTerrainPatch` exactly (the player sits at the
 * geometric CENTER tile; one tile == 5 ft == 1.524 m), and the reachability BFS
 * is a faithful port of `useGridMovement`'s reachability (8-neighbour, 5-10-5
 * diagonal cost, difficult-terrain multiplier, blocked tiles) — the referee and
 * the board must never disagree, so the algorithm is shared in spirit and pinned
 * by tests here.
 *
 * Locked decision #1 (invisible 5-ft referee) and #2 (gridless presentation):
 * the player never sees squares, but every in-scene click resolves THROUGH this
 * tile lattice, so combat rules stay bit-identical to the 2D board.
 */
import type { BattleMapData } from '../../../types/combat';
import {
  calculateMovementCost,
  getTileMovementMultiplier,
} from '../../../utils/combat/movementUtils';

/** 5 feet in meters — one referee cell. Kept local so this module is React/Three-free. */
export const GROUND_METERS_PER_CELL_FIP = 1.524;

/** A patch tile coordinate. */
export interface PatchTile {
  x: number;
  y: number;
}

/**
 * The extraction anchor: the player's world-meters position at the moment the
 * patch was extracted. `extractLocalTerrainPatch` centers the patch on this
 * point, so it is the origin the tile↔world mapping pivots around.
 */
export interface PatchAnchor {
  playerXM: number;
  playerZM: number;
}

function centerOf(patch: BattleMapData): PatchTile {
  return {
    x: Math.floor(patch.dimensions.width / 2),
    y: Math.floor(patch.dimensions.height / 2),
  };
}

/**
 * Map a world-meters position to the patch tile it falls in, or null when the
 * position is outside the patch bounds. Inverse of {@link patchTileToWorldMeters}.
 *
 * This mirrors `extractLocalTerrainPatch`'s per-tile math:
 *   wx = playerX + (tx - centerX) * CELL  ⇒  tx = round((wx - playerX)/CELL) + centerX
 */
export function worldMetersToPatchTile(
  patch: BattleMapData,
  anchor: PatchAnchor,
  worldXM: number,
  worldZM: number,
): PatchTile | null {
  const center = centerOf(patch);
  const tx = Math.round((worldXM - anchor.playerXM) / GROUND_METERS_PER_CELL_FIP) + center.x;
  const ty = Math.round((worldZM - anchor.playerZM) / GROUND_METERS_PER_CELL_FIP) + center.y;
  if (tx < 0 || ty < 0 || tx >= patch.dimensions.width || ty >= patch.dimensions.height) {
    return null;
  }
  return { x: tx, y: ty };
}

/**
 * Map a patch tile back to the world-meters position of its CENTER. Inverse of
 * {@link worldMetersToPatchTile}; used to place tokens and the reachable-area
 * disc on the streamed ground.
 */
export function patchTileToWorldMeters(
  patch: BattleMapData,
  anchor: PatchAnchor,
  tileX: number,
  tileY: number,
): { xM: number; zM: number } {
  const center = centerOf(patch);
  return {
    xM: anchor.playerXM + (tileX - center.x) * GROUND_METERS_PER_CELL_FIP,
    zM: anchor.playerZM + (tileY - center.y) * GROUND_METERS_PER_CELL_FIP,
  };
}

/**
 * Pure reachability BFS — the set of tile ids a mover with `movementFeet` of
 * movement can reach from `startTile`. Faithful port of `useGridMovement`'s
 * reachability core: 8-neighbour expansion, 5-10-5 alternating diagonal cost,
 * difficult-terrain multiplier, `blocksMovement` gating. No prone/multi-tile
 * handling here (single-token referee for the slice); callers that need those
 * still route through the 2D board, which owns the full hook.
 */
export function computeReachableTiles(
  patch: BattleMapData,
  startTile: PatchTile,
  movementFeet: number,
): Set<string> {
  return new Set(computeReachableCosts(patch, startTile, movementFeet).keys());
}

/**
 * Like {@link computeReachableTiles} but returns each reachable tile's cheapest
 * cost in feet (the start tile costs 0). The in-scene move handler uses this to
 * both rule legality AND fill the `movementCost` on the committed action, so the
 * feet deducted match what the 2D board would deduct for the same destination.
 */
export function computeReachableCosts(
  patch: BattleMapData,
  startTile: PatchTile,
  movementFeet: number,
): Map<string, number> {
  const best = new Map<string, number>();
  const startId = `${startTile.x}-${startTile.y}`;
  const start = patch.tiles.get(startId);
  if (!start) return best;
  best.set(startId, 0);

  const queue: Array<{ x: number; y: number; cost: number; diagonalCount: number }> = [
    { x: startTile.x, y: startTile.y, cost: 0, diagonalCount: 0 },
  ];
  const visited = new Map<string, number>();
  visited.set(`${startId}-0`, 0);

  while (queue.length > 0) {
    const node = queue.shift()!;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = node.x + dx;
        const ny = node.y + dy;
        const nid = `${nx}-${ny}`;
        const neighbor = patch.tiles.get(nid);
        if (!neighbor || neighbor.blocksMovement) continue;

        const { cost: baseCost, isDiagonal } = calculateMovementCost(dx, dy, node.diagonalCount);
        const terrainMult = getTileMovementMultiplier(neighbor.movementCost);
        const stepCost = baseCost * terrainMult;
        const newCost = node.cost + stepCost;
        if (newCost > movementFeet) continue;

        const newDiagonalCount = isDiagonal ? node.diagonalCount + 1 : node.diagonalCount;
        const parity = newDiagonalCount % 2;
        const key = `${nid}-${parity}`;
        const prev = visited.get(key);
        if (prev === undefined || newCost < prev) {
          visited.set(key, newCost);
          const bestSoFar = best.get(nid);
          if (bestSoFar === undefined || newCost < bestSoFar) best.set(nid, newCost);
          queue.push({ x: nx, y: ny, cost: newCost, diagonalCount: newDiagonalCount });
        }
      }
    }
  }
  return best;
}

/** The referee's verdict on a single in-scene move click. */
export interface InSceneMoveVerdict {
  legal: boolean;
  /** The patch tile the click resolved to, or null when off-map. */
  tile: PatchTile | null;
  /** Movement feet the destination costs from the start tile (legal moves). */
  costFeet?: number;
  /** Human-readable rationale (illegal moves only carry a reason). */
  reason?: string;
}

export interface InSceneMoveArgs {
  patch: BattleMapData;
  anchor: PatchAnchor;
  startTile: PatchTile;
  movementFeet: number;
  worldXM: number;
  worldZM: number;
}

/**
 * The full referee call the in-scene click handler makes: a world-meters click
 * → tile → legality, ruled against the same reachability the 2D board uses.
 * Illegal verdicts still carry the resolved tile (when on-map) so the UI can
 * show why (out of range / blocked) rather than silently ignoring the click.
 */
export function validateInSceneMove(args: InSceneMoveArgs): InSceneMoveVerdict {
  const { patch, anchor, startTile, movementFeet, worldXM, worldZM } = args;
  const tile = worldMetersToPatchTile(patch, anchor, worldXM, worldZM);
  if (!tile) {
    return { legal: false, tile: null, reason: 'clicked outside the combat area (off-map)' };
  }
  const target = patch.tiles.get(`${tile.x}-${tile.y}`);
  if (target?.blocksMovement) {
    return { legal: false, tile, reason: 'that tile is blocked / impassable' };
  }
  const costs = computeReachableCosts(patch, startTile, movementFeet);
  const cost = costs.get(`${tile.x}-${tile.y}`);
  if (cost === undefined) {
    return { legal: false, tile, reason: 'out of movement range this turn' };
  }
  return { legal: true, tile, costFeet: cost };
}
