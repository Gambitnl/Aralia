// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:48:54
 * Dependents: systems/world3d/chunkWorkerCore.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file chunkSampler.ts
 * Slices WorldData into the per-chunk input for geometry: a bilinearly-sampled
 * height subgrid, a per-vertex biome id buffer, the river/road polylines clipped
 * to this chunk, and any sites whose center lies inside the chunk.
 */
import type { WorldData } from '@/services/worldSim/types';
import type { Road } from '@/services/worldSim/types';
import type { ChunkData } from './types';
import { chunkGridAABB } from './coords';
import { clipPolylineToChunk } from './polylineClip';
import { heightToMeters } from './config';
import { biomeColor } from './terrainColor';

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

function sampleBiomeBlend(world: WorldData, gx: number, gy: number, height01: number): [number, number, number] {
  const { cols, rows } = world.gridSize;
  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));
  const x = clampX(gx);
  const y = clampY(gy);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.floor(clampX(x0 + 1));
  const y1 = Math.floor(clampY(y0 + 1));
  const sx = x - x0;
  const sy = y - y0;

  const colorAt = (ix: number, iy: number) => {
    const idx = Math.floor(iy) * cols + Math.floor(ix);
    return biomeColor(world.biomeIds[idx] ?? 'plains', height01);
  };
  const c00 = colorAt(x0, y0);
  const c10 = colorAt(x1, y0);
  const c01 = colorAt(x0, y1);
  const c11 = colorAt(x1, y1);

  const w00 = (1 - sx) * (1 - sy);
  const w10 = sx * (1 - sy);
  const w01 = (1 - sx) * sy;
  const w11 = sx * sy;

  return [
    c00[0] * w00 + c10[0] * w10 + c01[0] * w01 + c11[0] * w11,
    c00[1] * w00 + c10[1] * w10 + c01[1] * w01 + c11[1] * w11,
    c00[2] * w00 + c10[2] * w10 + c01[2] * w01 + c11[2] * w11,
  ];
}

const ROAD_WIDTH_BY_TYPE: Record<Road['type'], number> = {
  major: 0.06,
  minor: 0.04,
  trail: 0.025,
};

function roadWidthForType(type: Road['type']): number {
  return ROAD_WIDTH_BY_TYPE[type];
}

type GridPoint = { x: number; y: number };

function polylineTouchesChunkBounds(points: Array<{ x: number; y: number }>, cx: number, cy: number): boolean {
  if (points.length === 0) return false;
  const { minGX, minGY, maxGX, maxGY } = chunkGridAABB(cx, cy);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return minX < maxGX && maxX >= minGX && minY < maxGY && maxY >= minGY;
}

function polygonTouchesChunkBounds(points: GridPoint[], cx: number, cy: number): boolean {
  return polylineTouchesChunkBounds(points, cx, cy);
}

function clipPolygonToChunk(points: GridPoint[], cx: number, cy: number): GridPoint[] {
  const { minGX, minGY, maxGX, maxGY } = chunkGridAABB(cx, cy);

  const clipAgainst = (
    input: GridPoint[],
    inside: (p: GridPoint) => boolean,
    intersect: (a: GridPoint, b: GridPoint) => GridPoint,
  ): GridPoint[] => {
    if (input.length === 0) return [];
    const output: GridPoint[] = [];
    let prev = input[input.length - 1];
    let prevInside = inside(prev);
    for (const cur of input) {
      const curInside = inside(cur);
      if (curInside) {
        if (!prevInside) output.push(intersect(prev, cur));
        output.push(cur);
      } else if (prevInside) {
        output.push(intersect(prev, cur));
      }
      prev = cur;
      prevInside = curInside;
    }
    return output;
  };

  const lerp = (a: GridPoint, b: GridPoint, t: number): GridPoint => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const intersectX = (bound: number) => (a: GridPoint, b: GridPoint): GridPoint => {
    const dx = b.x - a.x;
    const t = dx === 0 ? 0 : (bound - a.x) / dx;
    return lerp(a, b, t);
  };
  const intersectY = (bound: number) => (a: GridPoint, b: GridPoint): GridPoint => {
    const dy = b.y - a.y;
    const t = dy === 0 ? 0 : (bound - a.y) / dy;
    return lerp(a, b, t);
  };

  let clipped = points.slice();
  clipped = clipAgainst(clipped, (p) => p.x >= minGX, intersectX(minGX));
  clipped = clipAgainst(clipped, (p) => p.x < maxGX, intersectX(maxGX));
  clipped = clipAgainst(clipped, (p) => p.y >= minGY, intersectY(minGY));
  clipped = clipAgainst(clipped, (p) => p.y < maxGY, intersectY(maxGY));

  if (clipped.length < 3) return [];

  // Remove accidental duplicate vertices from edge-on clipping so the lake fill
  // builder receives a stable, triangulable ring.
  const deduped: GridPoint[] = [];
  for (const p of clipped) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) deduped.push(p);
  }
  if (deduped.length >= 2) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (first.x === last.x && first.y === last.y) deduped.pop();
  }
  return deduped.length >= 3 ? deduped : [];
}

function polygonCentroid(points: GridPoint[]): GridPoint {
  if (points.length === 0) return { x: 0, y: 0 };

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    twiceArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }

  if (Math.abs(twiceArea) < 1e-9) {
    const sum = points.reduce(
      (acc, p) => {
        acc.x += p.x;
        acc.y += p.y;
        return acc;
      },
      { x: 0, y: 0 },
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
  }

  return {
    x: cx / (3 * twiceArea),
    y: cy / (3 * twiceArea),
  };
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
  const biomeColors = new Float32Array(resolution * resolution * 3);

  for (let j = 0; j < resolution; j++) {
    const ty = resolution === 1 ? 0 : j / (resolution - 1);
    const gy = aabb.minGY + (aabb.maxGY - aabb.minGY) * ty;
    for (let i = 0; i < resolution; i++) {
      const tx = resolution === 1 ? 0 : i / (resolution - 1);
      const gx = aabb.minGX + (aabb.maxGX - aabb.minGX) * tx;
      const idx = j * resolution + i;
      heights[idx] = sampleHeightBilinear(world, gx, gy);
      biomeIds[idx] = sampleBiomeNearest(world, gx, gy);
      const color = sampleBiomeBlend(world, gx, gy, heights[idx] ?? 0);
      biomeColors[idx * 3] = color[0];
      biomeColors[idx * 3 + 1] = color[1];
      biomeColors[idx * 3 + 2] = color[2];
    }
  }

  const rivers = world.rivers.flatMap((r) =>
    polylineTouchesChunkBounds(r.points, cx, cy) ? clipPolylineToChunk(r.points, r.width, cx, cy) : [],
  );
  const roads = world.roads.flatMap((rd) =>
    polylineTouchesChunkBounds(rd.points, cx, cy)
      ? clipPolylineToChunk(
          rd.points,
          rd.points.map(() => roadWidthForType(rd.type)),
          cx,
          cy,
        )
      : [],
  );

  const lakes = world.lakes.flatMap((lake) => {
    if (!polygonTouchesChunkBounds(lake, cx, cy)) return [];
    const clipped = clipPolygonToChunk(lake, cx, cy);
    if (clipped.length < 3) return [];
    const center = polygonCentroid(lake);
    return [
      {
        points: clipped,
        surfaceY: heightToMeters(sampleHeightBilinear(world, center.x, center.y)),
      },
    ];
  });

  const sites = world.sites
    .filter(
      // Half-open interval [min, max): a site whose position lands exactly on a
      // chunk boundary (position.x === maxGX, shared with the next chunk's minGX)
      // is owned by exactly one chunk — the lower one — instead of both. This is
      // what kept producing duplicate site React keys after T10 chunk-scoped them.
      (s) =>
        s.position.x >= aabb.minGX &&
        s.position.x < aabb.maxGX &&
        s.position.y >= aabb.minGY &&
        s.position.y < aabb.maxGY,
    )
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      position: s.position,
      footprint: s.footprint,
      walled: s.walled ?? false,
      population: s.population,
      surfaceY: heightToMeters(sampleHeightBilinear(world, s.position.x, s.position.y)),
    }));

  return { cx, cy, resolution, heights, biomeIds, biomeColors, rivers, roads, lakes, sites };
}
