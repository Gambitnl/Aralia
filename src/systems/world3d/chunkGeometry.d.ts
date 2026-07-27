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
/**
 * Number of perimeter (skirt) vertices baked into the MAIN terrain geometry.
 * Stitched grids carry NO inline skirt: their seams are bit-identical
 * watertight, so an interior wall could only ever show up as an artifact —
 * MSAA samples in the sub-pixel band at the seam line pick up the flat-shaded
 * (dark) wall as a dotted hairline tracing chunk borders. Their skirts are
 * emitted as four per-edge sub-geometries instead (see buildTerrainMesh), and
 * the scene draws each ONLY while that edge has no loaded neighbour (the
 * streaming-window frontier), where a wall is genuinely load-bearing.
 */
export declare function skirtVertexCount(res: number): number;
/** Number of skirt triangles in the MAIN terrain geometry (see skirtVertexCount). */
export declare function skirtTriangleCount(res: number): number;
/** Total terrain vertices (base grid, plus skirt when present) for a res×res grid. */
export declare function terrainVertexCount(res: number, withSkirt: boolean): number;
/** Number of top-surface triangles for a res×res grid (stitched or uniform). */
export declare function baseTriangleCount(res: number): number;
/**
 * Generates local positions, triangle indices, and lighting normals for a chunk.
 * Skirtless by default; pass `skirtDepth>0` to add a perimeter skirt.
 */
export declare function buildPlaceholderHeightfield(data: ChunkData, opts?: {
    skirtDepth?: number;
}): ChunkGeometryArrays;
/**
 * Heightfield terrain mesh with per-vertex biome coloring. Adds a perimeter
 * skirt by default (adaptive depth) to hide mixed-resolution seams between
 * neighboring LOD chunks; pass `skirtDepth: 0` to disable it.
 */
export declare function buildTerrainMesh(data: ChunkData, opts?: {
    skirtDepth?: number;
}): TerrainMesh;
