/**
 * @file coords.ts
 * @description Pure coordinate transforms between world space (meters, x/z plane, y up),
 * chunk space (integer cx/cy), and WorldData grid space (gridX/gridY cells).
 *
 * Why this is built this way:
 * - Coordinates mapping between Three.js (x/z) and WorldData (cols/rows) must be unified:
 *   gridX = worldX / METERS_PER_CELL, gridY = worldZ / METERS_PER_CELL.
 *   This prevents horizontal flip or rotation bugs in subsequent rendering and mesh sampling.
 * - String keys `chunkKey` allow efficient, O(1) set-based tracking of loaded chunks in the slide manager.
 * - `chunkGridAABB` defines the sub-grid boundaries in grid-space for one chunk, serving as the sampling bounds.
 */
import type { Vec2 } from '@/services/worldSim/types';
import type { ChunkCoord } from './types';
/** Which chunk a world-space (x, z) position falls in. */
export declare function worldToChunk(worldX: number, worldZ: number): ChunkCoord;
/** Stable string key for a chunk coordinate (used as Map/Set key). */
export declare function chunkKey(cx: number, cy: number): string;
/** Inverse of chunkKey. */
export declare function parseChunkKey(key: string): ChunkCoord;
/** Min (north-west) corner of a chunk in world meters. Returned as {x, y} where y is the world Z. */
export declare function chunkOriginWorld(cx: number, cy: number): Vec2;
/** Convert a world-space (x, z) position to fractional grid-cell coordinates. */
export declare function worldToGrid(worldX: number, worldZ: number): Vec2;
/** Grid-space axis-aligned bounding box for a chunk. */
export declare function chunkGridAABB(cx: number, cy: number): {
    minGX: number;
    minGY: number;
    maxGX: number;
    maxGY: number;
};
/** Convert grid-cell coords to world meters. Inverse of worldToGrid. */
export declare function gridToWorld(gx: number, gy: number): {
    x: number;
    z: number;
};
/** Convert a grid-space point to chunk-local world meters (origin at the chunk's NW corner). */
export declare function gridPointToLocal(gx: number, gy: number, cx: number, cy: number): {
    x: number;
    z: number;
};
