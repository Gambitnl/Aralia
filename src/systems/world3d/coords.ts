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
import { WORLD3D_CONFIG } from './config';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
const M = WORLD3D_CONFIG.METERS_PER_CELL;

/** Which chunk a world-space (x, z) position falls in. */
export function worldToChunk(worldX: number, worldZ: number): ChunkCoord {
  return { cx: Math.floor(worldX / S), cy: Math.floor(worldZ / S) };
}

/** Stable string key for a chunk coordinate (used as Map/Set key). */
export function chunkKey(cx: number, cy: number): string {
  return `${cx}|${cy}`;
}

/** Inverse of chunkKey. */
export function parseChunkKey(key: string): ChunkCoord {
  const [cx, cy] = key.split('|');
  return { cx: Number(cx), cy: Number(cy) };
}

/** Min (north-west) corner of a chunk in world meters. Returned as {x, y} where y is the world Z. */
export function chunkOriginWorld(cx: number, cy: number): Vec2 {
  return { x: cx * S, y: cy * S };
}

/** Convert a world-space (x, z) position to fractional grid-cell coordinates. */
export function worldToGrid(worldX: number, worldZ: number): Vec2 {
  return { x: worldX / M, y: worldZ / M };
}

/** Grid-space axis-aligned bounding box for a chunk. */
export function chunkGridAABB(cx: number, cy: number): {
  minGX: number;
  minGY: number;
  maxGX: number;
  maxGY: number;
} {
  const minGX = (cx * S) / M;
  const minGY = (cy * S) / M;
  const maxGX = ((cx + 1) * S) / M;
  const maxGY = ((cy + 1) * S) / M;
  return { minGX, minGY, maxGX, maxGY };
}

/** Convert grid-cell coords to world meters. Inverse of worldToGrid. */
export function gridToWorld(gx: number, gy: number): { x: number; z: number } {
  return { x: gx * M, z: gy * M };
}

/** Convert a grid-space point to chunk-local world meters (origin at the chunk's NW corner). */
export function gridPointToLocal(
  gx: number,
  gy: number,
  cx: number,
  cy: number,
): { x: number; z: number } {
  return { x: gx * M - cx * S, z: gy * M - cy * S };
}
