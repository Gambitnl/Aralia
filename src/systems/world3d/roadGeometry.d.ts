/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 03:54:53
 * Dependents: systems/world3d/chunkBundle.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file roadGeometry.ts
 * Build flat ribbon meshes along clipped road polylines, raised slightly above the
 * terrain surface so they render on top. Mirrors waterGeometry's ribbon approach.
 *
 * STREETS-UNIFY SLICE (2026-07-18): the centerline→ribbon math (perpendicular
 * edge offsets + strip indices) moved into the SHARED pure street module
 * `worldforge/town/streetRibbons.ts`, which the design-preview town schematic
 * consumes too — one source of geometric truth for both 3D street renderers.
 * Town streets (recognised by their tier tint, the only tier identity that
 * survives chunk clipping) now render as LAYERED ribbons — edging bands under
 * plaza/avenue cores, a worn rut stripe over lane dirt — while inherited
 * regional roads and any legacy producer keep the exact single-band packed-dirt
 * output they had before (vertex layout and colors unchanged).
 *
 * TWO INVISIBILITY ROOT CAUSES FIXED (same slice) — road ribbons had never
 * actually been visible in the streamed ground path:
 *   1. WINDING: the old inline index pattern wound ribbon faces CLOCKWISE from
 *      above (down-facing) — front-side culling discarded every ribbon from any
 *      above-ground camera while the explicit (0,1,0) normals made the code
 *      read correct. The shared `ribbonStripIndices` now winds up-facing,
 *      matching the schematic renderer (see streetRibbons.ts root-cause note).
 *   2. HEIGHTS: ribbons sampled the height grid at the NEAREST vertex, at the
 *      CENTERLINE only — on ground-mode chunks (coarse LOD grids, town terrain
 *      pads) that error reaches metres, far beyond the 0.3 m lift, sinking
 *      ribbons under the surface (live seed-42 probe: street vertices ~0.4 m
 *      below). Heights now interpolate the SAME triangles the terrain mesh
 *      renders (same quad split as chunkGeometry.ts), per RIBBON-EDGE vertex,
 *      so ribbons drape across side-slopes instead of poking through them.
 * Flat-terrain vertex values are numerically unchanged; the 0.3 m lift stays.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
/** Road meshes carry per-vertex colors so RoadPiece renders with `vertexColors`. */
type RoadMesh = ChunkGeometryArrays & {
    colors: Float32Array;
};
export declare function buildRoadMesh(data: ChunkData): RoadMesh;
export {};
