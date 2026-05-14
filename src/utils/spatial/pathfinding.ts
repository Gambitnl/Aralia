// @dependencies-start
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
// @dependencies-end

/**
 * @file pathfinding.ts
 * Implements the A* pathfinding algorithm for grid-based movement.
 * Updated to support D&D 5e Variant 5-10-5 diagonal movement.
 */
import { BattleMapTile, BattleMapData, Position } from '../../types/combat';
import { calculateMovementCost, isDifficultMovementCost } from '../combat/movementUtils';
import { applyMovementCostModifiers, MovementConfig } from '../combat/physicsUtils';

interface PathNode {
  tile: BattleMapTile;
  g: number; // cost from start
  h: number; // heuristic cost to end
  f: number; // g + h
  parent: PathNode | null;
  diagonalCount: number; // Number of diagonals taken to reach this node
}

/**
 * Calculates the Chebyshev distance between two tiles.
 * Used as the heuristic for A* pathfinding.
 * Multiplied by 5 to match 5e movement scale.
 */
export function heuristic(a: BattleMapTile, b: BattleMapTile): number {
  return Math.max(Math.abs(a.coordinates.x - b.coordinates.x), Math.abs(a.coordinates.y - b.coordinates.y)) * 5;
}

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
export function findPath(
  startTile: BattleMapTile,
  endTile: BattleMapTile,
  mapData: BattleMapData,
  movementConfig: Partial<MovementConfig> = {},
  sizeMultiplier: number = 1
): BattleMapTile[] {
  const openSet: PathNode[] = [];
  const closedSet = new Map<string, number>();

  const startNode: PathNode = {
    tile: startTile,
    g: 0,
    h: heuristic(startTile, endTile),
    f: heuristic(startTile, endTile),
    parent: null,
    diagonalCount: 0
  };
  openSet.push(startNode);

  while (openSet.length > 0) {
    let lowestIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIndex].f) {
        lowestIndex = i;
      }
    }
    const currentNode = openSet[lowestIndex];

    if (currentNode.tile.id === endTile.id) {
      const path: BattleMapTile[] = [];
      let temp: PathNode | null = currentNode;
      while (temp) {
        path.push(temp.tile);
        temp = temp.parent;
      }
      return path.reverse();
    }

    openSet.splice(lowestIndex, 1);

    const parity = currentNode.diagonalCount % 2;
    const closedKey = `${currentNode.tile.id}-${parity}`;

    const existingG = closedSet.get(closedKey);
    if (existingG !== undefined && existingG <= currentNode.g) {
      continue;
    }
    closedSet.set(closedKey, currentNode.g);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const neighborX = currentNode.tile.coordinates.x + dx;
        const neighborY = currentNode.tile.coordinates.y + dy;
        const neighborId = `${neighborX}-${neighborY}`;
        
        // Multi-tile collision check
        let canPass = true;
        let maxTerrainCost = 1; // Normalized base cost
        
        for (let sx = 0; sx < sizeMultiplier; sx++) {
          for (let sy = 0; sy < sizeMultiplier; sy++) {
            const checkId = `${neighborX + sx}-${neighborY + sy}`;
            const checkTile = mapData.tiles.get(checkId);
            
            if (!checkTile || checkTile.blocksMovement) {
              canPass = false;
              break;
            }
            
            if (isDifficultMovementCost(checkTile.movementCost)) {
              maxTerrainCost = 2;
            }
          }
          if (!canPass) break;
        }

        if (!canPass) continue;

        const neighborTile = mapData.tiles.get(neighborId)!;
        const { cost: baseStepCost, isDiagonal } = calculateMovementCost(dx, dy, currentNode.diagonalCount);

        const stepConfig: MovementConfig = {
          ...movementConfig,
          isDifficultTerrain: maxTerrainCost === 2,
        };

        const stepCost = applyMovementCostModifiers(baseStepCost, stepConfig);
        const gScore = currentNode.g + stepCost;
        const newDiagonalCount = isDiagonal ? currentNode.diagonalCount + 1 : currentNode.diagonalCount;
        const newParity = newDiagonalCount % 2;

        let neighborNode = openSet.find(node =>
          node.tile.id === neighborId && (node.diagonalCount % 2) === newParity
        );

        if (!neighborNode) {
          neighborNode = {
            tile: neighborTile,
            g: gScore,
            h: heuristic(neighborTile, endTile),
            f: gScore + heuristic(neighborTile, endTile),
            parent: currentNode,
            diagonalCount: newDiagonalCount
          };
          openSet.push(neighborNode);
        } else if (gScore < neighborNode.g) {
          neighborNode.parent = currentNode;
          neighborNode.g = gScore;
          neighborNode.f = gScore + neighborNode.h;
          neighborNode.diagonalCount = newDiagonalCount;
        }
      }
    }
  }

  return [];
}
