/**
 * @file chunkSampler.ts
 * @description Slices WorldData into the per-chunk input needed for geometry.
 * Samples the coarse WorldData heights (e.g. 60x40 grid) onto a high-resolution chunk
 * heightfield (e.g. 16x16 vertices grid) using bilinear interpolation.
 *
 * Why this is built this way:
 * - Bilinear interpolation smooths out the low-resolution Atlas/grid, preventing ugly step-like
 *   terrains in 3D.
 * - Clamp-to-edge logic ensures that if a chunk is loaded beyond the boundary of the simulated world,
 *   it gracefully clamps to the last available row/column value, avoiding NaN values or crashes.
 * - Row-major indexing `[j * resolution + i]` maps directly to the standard geometry vertex layout.
 */

import type { WorldData } from '@/services/worldSim/types';
import type { ChunkData } from './types';
import { chunkGridAABB } from './coords';

/**
 * Samples the height grid at fractional coordinates using bilinear interpolation,
 * clamping out-of-bound coords to the nearest boundary edge.
 */
function sampleHeightBilinear(world: WorldData, gx: number, gy: number): number {
  const { cols, rows } = world.gridSize;
  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));

  const x0 = Math.floor(clampX(gx));
  const y0 = Math.floor(clampY(gy));
  const x1 = clampX(x0 + 1);
  const y1 = clampY(y0 + 1);
  const tx = clampX(gx) - x0;
  const ty = clampY(gy) - y0;

  const h = (xx: number, yy: number) => world.heights[yy * cols + xx] ?? 0;
  const top = h(x0, y0) * (1 - tx) + h(x1, y0) * tx;
  const bot = h(x0, y1) * (1 - tx) + h(x1, y1) * tx;
  return top * (1 - ty) + bot * ty;
}

/**
 * Slices the world data into a specific chunk's grid data at the requested vertex resolution.
 */
export function sampleChunk(
  world: WorldData,
  cx: number,
  cy: number,
  resolution: number,
): ChunkData {
  const aabb = chunkGridAABB(cx, cy);
  const heights = new Float32Array(resolution * resolution);

  for (let j = 0; j < resolution; j++) {
    const ty = resolution === 1 ? 0 : j / (resolution - 1);
    const gy = aabb.minGY + (aabb.maxGY - aabb.minGY) * ty;
    for (let i = 0; i < resolution; i++) {
      const tx = resolution === 1 ? 0 : i / (resolution - 1);
      const gx = aabb.minGX + (aabb.maxGX - aabb.minGX) * tx;
      heights[j * resolution + i] = sampleHeightBilinear(world, gx, gy);
    }
  }

  return { cx, cy, resolution, heights };
}
