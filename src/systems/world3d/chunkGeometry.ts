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
 * - Per-LOD chunks use different mesh resolutions (W3D-G10 / T7). Where a coarse chunk neighbors a
 *   fine one, their edges sample the heightfield at different densities and a vertical crack appears.
 *   To hide it we drop a downward "skirt" wall around each rendered chunk's perimeter, so the seam
 *   shows skirt instead of void. The skirt is opt-in (skirtDepth>0); `buildTerrainMesh` enables it
 *   by default, while the raw `buildPlaceholderHeightfield` stays skirtless.
 */

import type { ChunkData, ChunkGeometryArrays, TerrainMesh } from './types';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { biomeColor } from './terrainColor';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

/** Number of perimeter (skirt) vertices for a res×res grid. 0 when res<2. */
export function skirtVertexCount(res: number): number {
  return res >= 2 ? 4 * (res - 1) : 0;
}

/** Number of skirt triangles for a res×res grid (two per perimeter edge segment). */
export function skirtTriangleCount(res: number): number {
  return res >= 2 ? 4 * (res - 1) * 2 : 0;
}

/** Total terrain vertices (base grid, plus skirt when present) for a res×res grid. */
export function terrainVertexCount(res: number, withSkirt: boolean): number {
  return res * res + (withSkirt ? skirtVertexCount(res) : 0);
}

/**
 * Ordered ring of base vertex indices around the grid perimeter, clockwise,
 * length 4*(res-1). Each edge contributes its (res-1) leading vertices so
 * corners are visited exactly once.
 */
function perimeterRing(res: number): number[] {
  if (res < 2) return [];
  const ring: number[] = [];
  for (let i = 0; i < res - 1; i++) ring.push(i); // top row, left→right
  for (let j = 0; j < res - 1; j++) ring.push(j * res + (res - 1)); // right col, top→bottom
  for (let i = res - 1; i > 0; i--) ring.push((res - 1) * res + i); // bottom row, right→left
  for (let j = res - 1; j > 0; j--) ring.push(j * res); // left col, bottom→top
  return ring;
}

interface HeightfieldCore extends ChunkGeometryArrays {
  /** Vertex count of the base grid (res*res); skirt vertices follow it. */
  baseVertCount: number;
  /** For each appended skirt vertex, the base vertex index it duplicates. */
  skirtSource: number[];
}

/**
 * Adaptive downward skirt depth in meters: at least the configured minimum, and
 * at least the chunk's own vertical relief so the skirt always reaches below the
 * deepest possible seam with a coarser/finer neighbor.
 */
function defaultSkirtDepth(data: ChunkData): number {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.heights.length; i++) {
    const m = heightToMeters(data.heights[i]);
    if (m < min) min = m;
    if (m > max) max = m;
  }
  const relief = max > min ? max - min : 0;
  return Math.max(WORLD3D_CONFIG.SKIRT_MIN_DEPTH_M, relief);
}

/**
 * Builds positions/indices/normals for the base heightfield grid and, when
 * skirtDepth>0, a perimeter skirt. Normals are computed over the top surface
 * only (skirt vertices copy their source normal) so the skirt never tilts the
 * terrain lighting.
 */
function buildHeightfieldCore(data: ChunkData, skirtDepth: number): HeightfieldCore {
  const res = data.resolution;
  const baseVertCount = res * res;
  const useSkirt = skirtDepth > 0 && res >= 2;
  const ring = useSkirt ? perimeterRing(res) : [];
  const skirtCount = ring.length;
  const vertCount = baseVertCount + skirtCount;

  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);

  // 1. Base vertex positions: x/z spread across [0, S], y from the shared
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

  // 2. Base index buffer: two triangles per grid cell quad.
  const baseTriCount = (res - 1) * (res - 1) * 2;
  const skirtTriCount = useSkirt ? skirtCount * 2 : 0;
  const indices = new Uint32Array((baseTriCount + skirtTriCount) * 3);
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
  const baseIndexCount = t;

  // 3. Surface normals from the base (top-surface) triangles only.
  for (let f = 0; f < baseIndexCount; f += 3) {
    const ia = indices[f] * 3;
    const ib = indices[f + 1] * 3;
    const ic = indices[f + 2] * 3;

    const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
    const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
    const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    for (const vi of [ia, ib, ic]) {
      normals[vi] += nx;
      normals[vi + 1] += ny;
      normals[vi + 2] += nz;
    }
  }
  for (let v = 0; v < baseVertCount; v++) {
    const o = v * 3;
    const len = Math.hypot(normals[o], normals[o + 1], normals[o + 2]) || 1;
    normals[o] /= len;
    normals[o + 1] /= len;
    normals[o + 2] /= len;
  }

  // 4. Skirt: lowered duplicates of the perimeter ring + connecting quads.
  const skirtSource: number[] = [];
  if (useSkirt) {
    for (let k = 0; k < skirtCount; k++) {
      const src = ring[k];
      const sv = baseVertCount + k;
      positions[sv * 3] = positions[src * 3];
      positions[sv * 3 + 1] = positions[src * 3 + 1] - skirtDepth;
      positions[sv * 3 + 2] = positions[src * 3 + 2];
      // Copy the source (top) normal so skirt lighting matches the edge.
      normals[sv * 3] = normals[src * 3];
      normals[sv * 3 + 1] = normals[src * 3 + 1];
      normals[sv * 3 + 2] = normals[src * 3 + 2];
      skirtSource.push(src);
    }
    for (let k = 0; k < skirtCount; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % skirtCount];
      const aDown = baseVertCount + k;
      const bDown = baseVertCount + ((k + 1) % skirtCount);
      indices[t++] = a;
      indices[t++] = aDown;
      indices[t++] = b;
      indices[t++] = b;
      indices[t++] = aDown;
      indices[t++] = bDown;
    }
  }

  return { positions, indices, normals, baseVertCount, skirtSource };
}

/**
 * Generates local positions, triangle indices, and lighting normals for a chunk.
 * Skirtless by default; pass `skirtDepth>0` to add a perimeter skirt.
 */
export function buildPlaceholderHeightfield(
  data: ChunkData,
  opts: { skirtDepth?: number } = {},
): ChunkGeometryArrays {
  const core = buildHeightfieldCore(data, opts.skirtDepth ?? 0);
  return { positions: core.positions, indices: core.indices, normals: core.normals };
}

/**
 * Heightfield terrain mesh with per-vertex biome coloring. Adds a perimeter
 * skirt by default (adaptive depth) to hide mixed-resolution seams between
 * neighboring LOD chunks; pass `skirtDepth: 0` to disable it.
 */
export function buildTerrainMesh(data: ChunkData, opts: { skirtDepth?: number } = {}): TerrainMesh {
  const skirtDepth = opts.skirtDepth ?? defaultSkirtDepth(data);
  const core = buildHeightfieldCore(data, skirtDepth);
  const baseVertCount = core.baseVertCount;
  const totalVerts = core.positions.length / 3;
  const colors = new Float32Array(totalVerts * 3);

  // Base-grid colors: precomputed blend when available, else per-vertex biome
  // color. In the per-vertex path we also blend toward rock on steep faces:
  // slope01 = 1 - n·up, read straight off the already-computed vertex normal
  // (normals[o+1] is the up-component of the unit normal), so a near-vertical
  // cliff tints as exposed rock while flat ground keeps its biome tint.
  if (data.biomeColors && data.biomeColors.length === baseVertCount * 3) {
    colors.set(data.biomeColors);
  } else {
    for (let v = 0; v < baseVertCount; v++) {
      const ny = core.normals[v * 3 + 1]; // up-component of the unit surface normal
      const slope01 = Math.max(0, Math.min(1, 1 - ny));
      const [r, g, b] = biomeColor(data.biomeIds[v] ?? 'plains', data.heights[v] ?? 0, slope01);
      colors[v * 3] = r;
      colors[v * 3 + 1] = g;
      colors[v * 3 + 2] = b;
    }
  }

  // Skirt colors copy their source edge color so the wall matches the terrain.
  for (let k = 0; k < core.skirtSource.length; k++) {
    const src = core.skirtSource[k];
    const sv = baseVertCount + k;
    colors[sv * 3] = colors[src * 3];
    colors[sv * 3 + 1] = colors[src * 3 + 1];
    colors[sv * 3 + 2] = colors[src * 3 + 2];
  }

  return { positions: core.positions, indices: core.indices, normals: core.normals, colors };
}
