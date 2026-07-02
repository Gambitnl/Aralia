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
 * - Resolutions that nest into the 4-segment anchor basis (see edgeWeld.ts) get a STITCHED border:
 *   the outer ring is triangulated against only the 5 anchor vertices per edge, so every tier emits
 *   the exact same 4-segment border edges and no T-vertex exists on any seam. T-vertices sit ON a
 *   neighbour's long triangle edge mathematically, but the GPU interpolates the long edge's clip
 *   coordinates while transforming the T-vertex directly — the last-ulp disagreement rasterizes as
 *   a faint dotted hairline along chunk borders. The weld keeps the border polyline shape; the
 *   stitch removes the redundant vertices from the triangulation (zero visual change otherwise).
 */

import type { ChunkData, ChunkGeometryArrays, TerrainMesh } from './types';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { ANCHOR_SEGMENTS } from './edgeWeld';
import { biomeColor } from './terrainColor';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

/** Whether a res×res grid border can be stitched to the shared anchor basis. */
function stitchesBorder(res: number): boolean {
  const segments = res - 1;
  return segments >= ANCHOR_SEGMENTS && segments % ANCHOR_SEGMENTS === 0 && res >= 5;
}

/**
 * How far below the surface a stitched chunk's skirt STARTS (meters). With
 * bit-identical watertight seams the skirt is never legitimately visible, but
 * a skirt that shares the border edge z-fights the neighbour's surface along
 * the seam line — the flat-shaded (dark) wall wins depth ties by an ulp and
 * rasterizes as a dotted hairline tracing chunk borders. Dropping the wall's
 * top ring below the surface makes it lose every tie. 0.25 m exceeds the
 * depth-buffer noise at the farthest streamed seam (~1.5 km with near=1) and
 * subtends well under a pixel at the ~500 m window perimeter where a sliver
 * of background could theoretically peek through.
 */
export const SKIRT_TOP_DROP_M = 0.25;

/** Number of perimeter (skirt) vertices for a res×res grid. 0 when res<2. */
export function skirtVertexCount(res: number): number {
  if (res < 2) return 0;
  // Stitched grids hang a DETACHED skirt from the anchor ring: an own top ring
  // (dropped below the surface) plus the bottom ring. Uniform grids keep the
  // legacy shared-top skirt (their seams have no watertightness guarantee, so
  // the wall must touch the surface).
  return stitchesBorder(res) ? 2 * 4 * ANCHOR_SEGMENTS : 4 * (res - 1);
}

/** Number of skirt triangles for a res×res grid (two per perimeter edge segment). */
export function skirtTriangleCount(res: number): number {
  return (stitchesBorder(res) ? 4 * ANCHOR_SEGMENTS : 4 * (res - 1)) * 2;
}

/** Total terrain vertices (base grid, plus skirt when present) for a res×res grid. */
export function terrainVertexCount(res: number, withSkirt: boolean): number {
  return res * res + (withSkirt ? skirtVertexCount(res) : 0);
}

/** Number of top-surface triangles for a res×res grid (stitched or uniform). */
export function baseTriangleCount(res: number): number {
  if (!stitchesBorder(res)) return (res - 1) * (res - 1) * 2;
  // Interior uniform quads + the border stitch band (one triangle per loop vertex).
  const inner = res - 3;
  return inner * inner * 2 + 4 * ANCHOR_SEGMENTS + 4 * inner;
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

/**
 * The 16 anchor vertices around the perimeter (4 per edge, corners visited
 * once), clockwise from the NW corner. This is the border loop every nesting
 * tier shares — chunk seams and the skirt both triangulate against it.
 */
function anchorRing(res: number): number[] {
  const q = (res - 1) / ANCHOR_SEGMENTS;
  const ring: number[] = [];
  for (let k = 0; k < 4; k++) ring.push(k * q); // north row, left→right
  for (let k = 0; k < 4; k++) ring.push(k * q * res + (res - 1)); // east col, top→bottom
  for (let k = 4; k > 0; k--) ring.push((res - 1) * res + k * q); // south row, right→left
  for (let k = 4; k > 0; k--) ring.push(k * q * res); // west col, bottom→top
  return ring;
}

/** Perimeter of the interior sub-grid [1..res-2]², clockwise from (1,1). */
function innerRing(res: number): number[] {
  const lo = 1;
  const hi = res - 2;
  const ring: number[] = [];
  for (let i = lo; i < hi; i++) ring.push(lo * res + i); // top, left→right
  for (let j = lo; j < hi; j++) ring.push(j * res + hi); // right, top→bottom
  for (let i = hi; i > lo; i--) ring.push(hi * res + i); // bottom, right→left
  for (let j = hi; j > lo; j--) ring.push(j * res + lo); // left, bottom→top
  return ring;
}

/**
 * Triangulate the one-cell border band between the anchor-only outer loop and
 * the full-resolution inner loop by zipping the two closed loops in parameter
 * order. Both loops are uniform squares walked clockwise from the NW corner, so
 * comparing normalized loop position picks the advance that keeps triangles
 * fat and the band watertight. Winding matches the uniform grid quads
 * (negative signed area in the XZ plane).
 */
function stitchBandTriangles(res: number): number[] {
  const outer = anchorRing(res);
  const inner = innerRing(res);
  const No = outer.length;
  const Ni = inner.length;
  const tris: number[] = [];
  let o = 0;
  let i = 0;
  while (o < No || i < Ni) {
    const advanceOuter = i >= Ni || (o < No && (o + 1) / No <= (i + 1) / Ni);
    if (advanceOuter) {
      tris.push(outer[o], inner[i % Ni], outer[(o + 1) % No]);
      o++;
    } else {
      tris.push(outer[o % No], inner[i], inner[(i + 1) % Ni]);
      i++;
    }
  }
  return tris;
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
  const stitched = stitchesBorder(res);
  const useSkirt = skirtDepth > 0 && res >= 2;
  // Stitched grids hang the skirt from the anchor ring: its top edges then
  // coincide exactly with the terrain's anchor-only border edges, so the skirt
  // itself cannot reintroduce a T-junction against the border.
  const ring = useSkirt ? (stitched ? anchorRing(res) : perimeterRing(res)) : [];
  const ringLen = ring.length;
  // Stitched skirts carry their own (dropped) top ring; legacy skirts share
  // the border vertices as their top and only append the bottom ring.
  const skirtCount = stitched ? ringLen * 2 : ringLen;
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

  // 2. Base index buffer. Stitched grids get uniform quads only in the
  //    interior sub-grid plus the anchor stitch band around it; uniform grids
  //    get two triangles per cell quad everywhere.
  const baseTriCount = baseTriangleCount(res);
  const skirtTriCount = useSkirt ? ringLen * 2 : 0;
  const indices = new Uint32Array((baseTriCount + skirtTriCount) * 3);
  let t = 0;
  const quadLo = stitched ? 1 : 0;
  const quadHi = stitched ? res - 2 : res - 1;
  for (let j = quadLo; j < quadHi; j++) {
    for (let i = quadLo; i < quadHi; i++) {
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
  if (stitched) {
    for (const idx of stitchBandTriangles(res)) indices[t++] = idx;
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
  //    Stitched: an OWN top ring dropped SKIRT_TOP_DROP_M below the surface
  //    (the wall must lose every depth tie against the neighbour's watertight
  //    surface — see SKIRT_TOP_DROP_M) plus the bottom ring. Legacy: the wall
  //    hangs straight off the shared border vertices.
  const skirtSource: number[] = [];
  if (useSkirt) {
    const dropTop = stitched ? SKIRT_TOP_DROP_M : 0;
    for (let k = 0; k < skirtCount; k++) {
      const src = ring[k % ringLen];
      const sv = baseVertCount + k;
      const drop = stitched && k < ringLen ? dropTop : skirtDepth;
      positions[sv * 3] = positions[src * 3];
      positions[sv * 3 + 1] = positions[src * 3 + 1] - drop;
      positions[sv * 3 + 2] = positions[src * 3 + 2];
      // Copy the source (top) normal so skirt lighting matches the edge.
      normals[sv * 3] = normals[src * 3];
      normals[sv * 3 + 1] = normals[src * 3 + 1];
      normals[sv * 3 + 2] = normals[src * 3 + 2];
      skirtSource.push(src);
    }
    for (let k = 0; k < ringLen; k++) {
      const kNext = (k + 1) % ringLen;
      const a = stitched ? baseVertCount + k : ring[k];
      const b = stitched ? baseVertCount + kNext : ring[kNext];
      const aDown = baseVertCount + (stitched ? ringLen : 0) + k;
      const bDown = baseVertCount + (stitched ? ringLen : 0) + kNext;
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
