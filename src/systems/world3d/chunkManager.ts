/**
 * @file chunkManager.ts
 * @description Pure sliding-window logic: given the camera's chunk and the currently-loaded
 * set, compute which chunks to load and which to unload.
 *
 * Why this is built this way:
 * - Chebyshev (square ring) distance is the natural metric for a grid of chunks because it
 *   guarantees a full square window is always fully covered in every direction.
 * - Hysteresis: We load chunks when they are strictly within `loadRadius` but we only unload
 *   them when they exceed `unloadRadius` (where unloadRadius >= loadRadius).
 *   This prevents boundary oscillation thrashing when a player walks back and forth over a chunk line.
 * - Nearest-first ordering: Chunks to be loaded are sorted by proximity, filling the areas
 *   closest to the camera first to keep loading seamless.
 */

import type { ChunkCoord } from './types';
import { chunkKey, parseChunkKey } from './coords';

export interface ChunkDiff {
  toLoad: ChunkCoord[];
  toUnload: ChunkCoord[];
}

/** Calculates the Chebyshev distance between two chunk coordinates. */
const chebyshev = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/**
 * Computes which chunks to load and unload based on the camera position, load/unload bounds,
 * and the active memory set of loaded chunks.
 */
export function computeChunkDiff(
  center: ChunkCoord,
  loadRadius: number,
  unloadRadius: number,
  currentlyLoaded: Set<string>,
): ChunkDiff {
  const toLoad: ChunkCoord[] = [];

  // 1. Gather all chunks within Chebyshev loadRadius of center that are not already loaded or pending
  for (let dy = -loadRadius; dy <= loadRadius; dy++) {
    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      const cx = center.cx + dx;
      const cy = center.cy + dy;
      if (currentlyLoaded.has(chunkKey(cx, cy))) continue;
      toLoad.push({ cx, cy });
    }
  }

  // 2. Sort closest-first to prioritize camera-adjacent loading
  toLoad.sort(
    (a, b) =>
      chebyshev(a.cx, a.cy, center.cx, center.cy) - chebyshev(b.cx, b.cy, center.cx, center.cy),
  );

  // 3. Mark chunks beyond unloadRadius to be purged
  const toUnload: ChunkCoord[] = [];
  for (const key of currentlyLoaded) {
    const { cx, cy } = parseChunkKey(key);
    if (chebyshev(cx, cy, center.cx, center.cy) > unloadRadius) {
      toUnload.push({ cx, cy });
    }
  }

  return { toLoad, toUnload };
}
