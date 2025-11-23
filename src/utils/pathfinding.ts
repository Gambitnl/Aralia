/**
 * @file pathfinding.ts
 * Implements the A* pathfinding algorithm for grid-based movement.
 */
import { BattleMapTile, BattleMapData } from '../types/combat';

interface PathNode {
  tile: BattleMapTile;
  g: number; // cost from start
  h: number; // heuristic cost to end
  f: number; // g + h
  parent: PathNode | null;
}

function heuristic(a: BattleMapTile, b: BattleMapTile): number {
  // Manhattan distance
  return Math.abs(a.coordinates.x - b.coordinates.x) + Math.abs(a.coordinates.y - b.coordinates.y);
}

export function findPath(startTile: BattleMapTile, endTile: BattleMapTile, mapData: BattleMapData): BattleMapTile[] {
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();

  const startNode: PathNode = {
    tile: startTile,
    g: 0,
    h: heuristic(startTile, endTile),
    f: heuristic(startTile, endTile),
    parent: null,
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

    // Move current from open to closed
    openSet.splice(lowestIndex, 1);
    closedSet.add(currentNode.tile.id);

    // Check neighbors
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const neighborX = currentNode.tile.coordinates.x + dx;
        const neighborY = currentNode.tile.coordinates.y + dy;
        const neighborId = `${neighborX}-${neighborY}`;
        
        if (closedSet.has(neighborId)) continue;
        
        const neighborTile = mapData.tiles.get(neighborId);
        if (!neighborTile || neighborTile.blocksMovement) continue;
        
        const gScore = currentNode.g + neighborTile.movementCost;
        let neighborNode = openSet.find(node => node.tile.id === neighborId);

        if (!neighborNode) {
          neighborNode = {
            tile: neighborTile,
            g: gScore,
            h: heuristic(neighborTile, endTile),
            f: gScore + heuristic(neighborTile, endTile),
            parent: currentNode,
          };
          openSet.push(neighborNode);
        } else if (gScore < neighborNode.g) {
          neighborNode.parent = currentNode;
          neighborNode.g = gScore;
          neighborNode.f = gScore + neighborNode.h;
        }
      }
    }
  }

  // No path found
  return [];
}
