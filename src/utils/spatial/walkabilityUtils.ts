/**
 * @file src/utils/walkabilityUtils.ts
 * Utilities for determining tile walkability and pathfinding in towns.
 */

import { TownMap, TileType } from '../../types/realmsmith';
import { TownPosition, WALKABLE_TILE_TYPES, BLOCKING_TILE_TYPES } from '../../types/town';

/**
 * Check if a specific tile type is walkable
 */
export function isTileTypeWalkable(tileType: TileType): boolean {
    return WALKABLE_TILE_TYPES.includes(tileType);
}

/**
 * Check if a specific tile type is blocking
 */
export function isTileTypeBlocking(tileType: TileType): boolean {
    return BLOCKING_TILE_TYPES.includes(tileType);
}

/**
 * Check if a tile at a specific position is walkable
 * Takes into account: tile type, buildings, doodads, and bounds
 */
export function isPositionWalkable(
    pos: TownPosition,
    townMap: TownMap
): boolean {
    // Bounds check
    if (pos.x < 0 || pos.x >= townMap.width || pos.y < 0 || pos.y >= townMap.height) {
        return false;
    }

    const tile = townMap.tiles[pos.x]?.[pos.y];
    if (!tile) return false;

    // Check if tile is inside a building
    if (tile.buildingId) {
        return false;
    }

    // Check tile type
    if (!isTileTypeWalkable(tile.type)) {
        return false;
    }

    // Check for blocking doodads (trees, rocks, etc.)
    if (tile.doodad) {
        const blockingDoodads = [
            'TREE_OAK', 'TREE_PINE', 'TREE_PALM', 'TREE_DEAD',
            'ROCK', 'WELL', 'CRATE', 'BARREL'
        ];
        if (blockingDoodads.includes(tile.doodad.type)) {
            return false;
        }
    }

    return true;
}

/**
 * Get all walkable neighboring positions (8-directional)
 */
export function getWalkableNeighbors(
    pos: TownPosition,
    townMap: TownMap
): TownPosition[] {
    const neighbors: TownPosition[] = [];
    const directions = [
        { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    ];

    for (const dir of directions) {
        const neighbor = { x: pos.x + dir.x, y: pos.y + dir.y };
        if (isPositionWalkable(neighbor, townMap)) {
            neighbors.push(neighbor);
        }
    }

    return neighbors;
}

/**
 * Calculate the Manhattan distance between two positions
 */
export function manhattanDistance(a: TownPosition, b: TownPosition): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Calculate the Chebyshev distance (allows diagonal movement)
 */
function chebyshevDistance(a: TownPosition, b: TownPosition): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * A* pathfinding implementation for town navigation
 * Returns array of positions from start to end (excluding start, including end)
 * Returns empty array if no path found
 */
export function findPath(
    start: TownPosition,
    end: TownPosition,
    townMap: TownMap,
    maxIterations: number = 1000
): TownPosition[] {
    // Quick exit if start or end is invalid
    if (!isPositionWalkable(end, townMap)) {
        return [];
    }

    const posKey = (p: TownPosition) => `${p.x},${p.y}`;

    interface PathNode {
        pos: TownPosition;
        g: number; // Cost from start
        h: number; // Estimated cost to end
        f: number; // Total cost
        parent: PathNode | null;
    }

    const openSet: Map<string, PathNode> = new Map();
    const closedSet: Set<string> = new Set();

    const startNode: PathNode = {
        pos: start,
        g: 0,
        h: chebyshevDistance(start, end),
        f: chebyshevDistance(start, end),
        parent: null,
    };

    openSet.set(posKey(start), startNode);

    let iterations = 0;

    while (openSet.size > 0 && iterations < maxIterations) {
        iterations++;

        // Find node with lowest f score
        let current: PathNode | null = null;
        let lowestF = Infinity;

        for (const node of openSet.values()) {
            if (node.f < lowestF) {
                lowestF = node.f;
                current = node;
            }
        }

        if (!current) break;

        // Check if we reached the goal
        if (current.pos.x === end.x && current.pos.y === end.y) {
            // Reconstruct path
            const path: TownPosition[] = [];
            let node: PathNode | null = current;
            while (node && node.parent) {
                path.unshift(node.pos);
                node = node.parent;
            }
            return path;
        }

        // Move current to closed set
        openSet.delete(posKey(current.pos));
        closedSet.add(posKey(current.pos));

        // Check neighbors
        const neighbors = getWalkableNeighbors(current.pos, townMap);

        for (const neighborPos of neighbors) {
            const key = posKey(neighborPos);

            if (closedSet.has(key)) continue;

            // Cost: 1 for cardinal, ~1.41 for diagonal
            const isDiagonal = neighborPos.x !== current.pos.x && neighborPos.y !== current.pos.y;
            const moveCost = isDiagonal ? 1.414 : 1;
            const tentativeG = current.g + moveCost;

            const existing = openSet.get(key);

            if (!existing) {
                // New node
                const h = chebyshevDistance(neighborPos, end);
                openSet.set(key, {
                    pos: neighborPos,
                    g: tentativeG,
                    h,
                    f: tentativeG + h,
                    parent: current,
                });
            } else if (tentativeG < existing.g) {
                // Better path found
                existing.g = tentativeG;
                existing.f = tentativeG + existing.h;
                existing.parent = current;
            }
        }
    }

    // No path found
    return [];
}

/**
 * Find the nearest walkable position to a target
 * Useful for finding a spot near a building entrance
 */
export function findNearestWalkable(
    target: TownPosition,
    townMap: TownMap,
    maxRadius: number = 5
): TownPosition | null {
    if (isPositionWalkable(target, townMap)) {
        return target;
    }

    for (let radius = 1; radius <= maxRadius; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                    const pos = { x: target.x + dx, y: target.y + dy };
                    if (isPositionWalkable(pos, townMap)) {
                        return pos;
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Get the building at a position (if any)
 */
export function getBuildingAtPosition(
    pos: TownPosition,
    townMap: TownMap
): string | null {
    const tile = townMap.tiles[pos.x]?.[pos.y];
    return tile?.buildingId ?? null;
}

/**
 * Get adjacent buildings to a position
 */
export function getAdjacentBuildings(
    pos: TownPosition,
    townMap: TownMap
): string[] {
    const buildings: Set<string> = new Set();
    const directions = [
        { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    ];

    for (const dir of directions) {
        const neighborPos = { x: pos.x + dir.x, y: pos.y + dir.y };
        const buildingId = getBuildingAtPosition(neighborPos, townMap);
        if (buildingId) {
            buildings.add(buildingId);
        }
    }

    return Array.from(buildings);
}
