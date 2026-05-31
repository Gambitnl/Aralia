/**
 * @file chunkSampler.ts
 * Slices WorldData into the per-chunk input for geometry: a bilinearly-sampled
 * height subgrid, a per-vertex biome id buffer, the river/road polylines clipped
 * to this chunk, and any sites whose center lies inside the chunk.
 */
import type { WorldData } from '@/services/worldSim/types';
import type { ChunkData } from './types';
import { chunkGridAABB } from './coords';
import { clipPolylineToChunk } from './polylineClip';

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

function sampleBiomeNearest(world: WorldData, gx: number, gy: number): string {
  const { cols, rows } = world.gridSize;
  const x = Math.max(0, Math.min(cols - 1, Math.round(gx)));
  const y = Math.max(0, Math.min(rows - 1, Math.round(gy)));
  return world.biomeIds[y * cols + x] ?? 'plains';
}

export function sampleChunk(
  world: WorldData,
  cx: number,
  cy: number,
  resolution: number,
): ChunkData {
  const aabb = chunkGridAABB(cx, cy);
  const heights = new Float32Array(resolution * resolution);
  const biomeIds: string[] = new Array(resolution * resolution);

  for (let j = 0; j < resolution; j++) {
    const ty = resolution === 1 ? 0 : j / (resolution - 1);
    const gy = aabb.minGY + (aabb.maxGY - aabb.minGY) * ty;
    for (let i = 0; i < resolution; i++) {
      const tx = resolution === 1 ? 0 : i / (resolution - 1);
      const gx = aabb.minGX + (aabb.maxGX - aabb.minGX) * tx;
      const idx = j * resolution + i;
      heights[idx] = sampleHeightBilinear(world, gx, gy);
      biomeIds[idx] = sampleBiomeNearest(world, gx, gy);
    }
  }

  const rivers = world.rivers.flatMap((r) => clipPolylineToChunk(r.points, r.width, cx, cy));
  const roads = world.roads.flatMap((rd) =>
    clipPolylineToChunk(rd.points, rd.points.map(() => 0.04), cx, cy),
  );

  const sites = world.sites
    .filter(
      (s) =>
        s.position.x >= aabb.minGX &&
        s.position.x <= aabb.maxGX &&
        s.position.y >= aabb.minGY &&
        s.position.y <= aabb.maxGY,
    )
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      position: s.position,
      footprint: s.footprint,
      walled: s.walled ?? false,
    }));

  return { cx, cy, resolution, heights, biomeIds, rivers, roads, sites };
}
