/**
 * @file chunkGeometry.ts
 * @description Build a flat-shaded heightfield mesh (positions/indices/normals) from a ChunkData.
 * Positions are local to the chunk origin; the scene translates the mesh into place.
 *
 * Why this is built this way:
 * - Local-space positions (origin at [0,0]) keep float coordinate precision high in Three.js,
 *   preventing rendering jitter far from the world center.
 * - Flat-shaded normals are calculated by accumulating cross products of edge vectors of each face,
 *   then normalizing at the end, providing correct lighting contours.
 * - This provides a clean placeholder for Plan 2. Plan 3 will extend/replace this with detailed
 *   terrain texturing, water sheets, and road polylines using the same output format.
 */

import type { ChunkData, ChunkGeometryArrays, TerrainMesh } from './types';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { biomeColor } from './terrainColor';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

/**
 * Generates local positions, triangle indices, and lighting normals for a chunk.
 */
export function buildPlaceholderHeightfield(data: ChunkData): ChunkGeometryArrays {
  const res = data.resolution;
  const vertCount = res * res;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);

  // 1. Compute vertex positions: x/z spread across [0, S], y from height via the shared
  //    exaggerated height→meters mapping (kept in lockstep with water/road builders).
  for (let j = 0; j < res; j++) {
    const tz = res === 1 ? 0 : j / (res - 1);
    for (let i = 0; i < res; i++) {
      const tx = res === 1 ? 0 : i / (res - 1);
      const idx = (j * res + i) * 3;
      positions[idx] = tx * S;
      positions[idx + 1] = heightToMeters(data.heights[j * res + i]);
      positions[idx + 2] = tz * S;
    }
  }

  // 2. Build index buffer: two triangles per grid cell quad
  const indices = new Uint32Array((res - 1) * (res - 1) * 6);
  let t = 0;
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const a = j * res + i;
      const b = j * res + i + 1;
      const c = (j + 1) * res + i;
      const d = (j + 1) * res + i + 1;
      indices[t++] = a;
      indices[t++] = c;
      indices[t++] = b;
      indices[t++] = b;
      indices[t++] = c;
      indices[t++] = d;
    }
  }

  // 3. Compute surface normals by accumulating face cross products
  for (let f = 0; f < indices.length; f += 3) {
    const ia = indices[f] * 3;
    const ib = indices[f + 1] * 3;
    const ic = indices[f + 2] * 3;

    const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
    const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
    const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

    // Cross product: e1 × e2
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    for (const vi of [ia, ib, ic]) {
      normals[vi] += nx;
      normals[vi + 1] += ny;
      normals[vi + 2] += nz;
    }
  }

  // 4. Normalize normal vectors
  for (let v = 0; v < vertCount; v++) {
    const o = v * 3;
    const len = Math.hypot(normals[o], normals[o + 1], normals[o + 2]) || 1;
    normals[o] /= len;
    normals[o + 1] /= len;
    normals[o + 2] /= len;
  }

  return { positions, indices, normals };
}

/**
 * Heightfield terrain mesh with per-vertex biome coloring. Reuses the placeholder
 * heightfield's position/index/normal generation, then adds a parallel colors buffer.
 */
export function buildTerrainMesh(data: ChunkData): TerrainMesh {
  const base = buildPlaceholderHeightfield(data);
  const vertCount = data.resolution * data.resolution;
  const colors = new Float32Array(vertCount * 3);
  for (let v = 0; v < vertCount; v++) {
    const [r, g, b] = biomeColor(data.biomeIds[v] ?? 'plains', data.heights[v] ?? 0);
    colors[v * 3] = r;
    colors[v * 3 + 1] = g;
    colors[v * 3 + 2] = b;
  }
  return { ...base, colors };
}
