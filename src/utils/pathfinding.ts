/**
 * @file pathfinding.ts
 * Implements the A* pathfinding algorithm for grid-based movement.
 * Updated to support D&D 5e Variant 5-10-5 diagonal movement.
 */
import { BattleMapTile, BattleMapData } from '../types/combat';
import { calculateMovementCost } from './movementUtils';

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
 * @returns An array of tiles representing the path from start to end (inclusive of start).
 *          Returns an empty array if no path is found.
 */
export function findPath(startTile: BattleMapTile, endTile: BattleMapTile, mapData: BattleMapData): BattleMapTile[] {
  const openSet: PathNode[] = [];

  // Stores lowest G score for a tile AND diagonal parity
  // Key format: "x-y-parity" where parity is 0 (even) or 1 (odd)
  // This ensures we explore paths that might be slightly more expensive locally
  // but land on a "cheaper" diagonal step for the future.
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
    // Find the node with the lowest F score
    let lowestIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIndex].f) {
        lowestIndex = i;
      }
    }
    const currentNode = openSet[lowestIndex];

    // End condition
    if (currentNode.tile.id === endTile.id) {
      const path: BattleMapTile[] = [];
      let temp: PathNode | null = currentNode;
      while (temp) {
        path.push(temp.tile);
        temp = temp.parent;
      }
      return path.reverse();
    }

    // Move current from open
    openSet.splice(lowestIndex, 1);

    // Key includes parity (0 or 1)
    const parity = currentNode.diagonalCount % 2;
    const closedKey = `${currentNode.tile.id}-${parity}`;

    // Pruning: If we've found a better path to this tile WITH THE SAME PARITY, skip.
    const existingG = closedSet.get(closedKey);
    if (existingG !== undefined && existingG <= currentNode.g) {
      continue;
    }
    closedSet.set(closedKey, currentNode.g);

    // Check neighbors
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const neighborX = currentNode.tile.coordinates.x + dx;
        const neighborY = currentNode.tile.coordinates.y + dy;
        const neighborId = `${neighborX}-${neighborY}`;
        
        const neighborTile = mapData.tiles.get(neighborId);
        if (!neighborTile || neighborTile.blocksMovement) continue;
        
        // Calculate cost
        const { cost: baseStepCost, isDiagonal } = calculateMovementCost(dx, dy, currentNode.diagonalCount);

        // TODO(Mechanist): Replace this simple multiplier with `calculateMovementCost` from `physicsUtils.ts` to support stacking penalties (climbing/crawling) and speed offsets.
        const terrainMultiplier = neighborTile.movementCost || 1;
        const stepCost = baseStepCost * terrainMultiplier;

        const gScore = currentNode.g + stepCost;
        const newDiagonalCount = isDiagonal ? currentNode.diagonalCount + 1 : currentNode.diagonalCount;

        // We need to check if we already have this node in OpenSet
        // Finding strictly by ID is insufficient because we might need to add the same tile again if parity differs
        // A* usually updates the node in OpenSet. Here, we can have multiple nodes for the same tile if parities differ.
        // So we filter by tile ID AND parity match.

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
          // Found a better path to this specific tile+parity state
          neighborNode.parent = currentNode;
          neighborNode.g = gScore;
          neighborNode.f = gScore + neighborNode.h;
          neighborNode.diagonalCount = newDiagonalCount;
        }
      }
    }
  }

  // No path found
  return [];
}
