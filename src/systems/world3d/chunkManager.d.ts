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
export interface ChunkDiff {
    toLoad: ChunkCoord[];
    toUnload: ChunkCoord[];
}
/**
 * Computes which chunks to load and unload based on the camera position, load/unload bounds,
 * and the active memory set of loaded chunks.
 */
export declare function computeChunkDiff(center: ChunkCoord, loadRadius: number, unloadRadius: number, currentlyLoaded: Set<string>): ChunkDiff;
