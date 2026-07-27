// @dependencies-start
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
// @dependencies-end

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
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { gridPointToLocal } from './coords';
import {
  streetTierByColorHex,
  streetRibbonLayers,
  ribbonEdgeOffsets,
  ribbonStripIndices,
  type StreetRibbonLayer,
} from '../worldforge/town/streetRibbons';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
const ROAD_LIFT_M = 0.3;

/**
 * Default packed-dirt tint for road runs that carry no per-street color — the
 * inherited regional roads (chunkSampler path) and any legacy producer. Town
 * streets ride their own tier tints through `colorHex` (see streetRibbons.ts),
 * rendered under one vertex-colored material so RoadPiece needs a single draw
 * call. Mirrors wallGeometry's DEFAULT_WALL_HEX.
 */
const DEFAULT_ROAD_HEX = '#a08b62';

/** Road meshes carry per-vertex colors so RoadPiece renders with `vertexColors`. */
type RoadMesh = ChunkGeometryArrays & { colors: Float32Array };

const EMPTY: RoadMesh = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
  colors: new Float32Array(0),
};

/** The pre-slice single-band recipe, kept for non-street ribbons. */
const LEGACY_SINGLE_LAYER = (hex: string): StreetRibbonLayer[] => [
  { colorHex: hex, widthScale: 1, liftM: 0 },
];

export function buildRoadMesh(data: ChunkData): RoadMesh {
  const ribbons = data.roads.filter((r) => r.points.length >= 2);
  if (ribbons.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  for (const ribbon of ribbons) {
    const pts = ribbon.points;
    // Town street tier (by tint) → its layered paint recipe; otherwise the
    // historical single packed-dirt band (regional roads, legacy producers).
    const tier = streetTierByColorHex(ribbon.colorHex);
    const layers = tier
      ? streetRibbonLayers(tier)
      : LEGACY_SINGLE_LAYER(ribbon.colorHex ?? DEFAULT_ROAD_HEX);

    // Shared per-ribbon data, computed once and reused by every layer: local
    // XZ centerline (chunk frame, metres) and full half-widths.
    const local2d = pts.map((p) => {
      const l = gridPointToLocal(p.x, p.y, data.cx, data.cy);
      return [l.x, l.z] as const;
    });
    const halfW = pts.map((_, i) => ((ribbon.width[i] ?? 0.04) * M) / 2);
    // Chunk-local metres → fractional grid coords (inverse of gridPointToLocal)
    // for per-vertex surface sampling.
    const gxOf = (localX: number) => (localX + data.cx * S) / M;
    const gyOf = (localZ: number) => (localZ + data.cy * S) / M;

    for (const layer of layers) {
      const cr = parseInt(layer.colorHex.slice(1, 3), 16) / 255;
      const cg = parseInt(layer.colorHex.slice(3, 5), 16) / 255;
      const cb = parseInt(layer.colorHex.slice(5, 7), 16) / 255;
      const startVert = positions.length / 3;
      // The SHARED edge-offset math (identical sign convention to the old
      // inline loop: first-pushed vertex is the −perp side = `r` here).
      const edges = ribbonEdgeOffsets(local2d, (i) => halfW[i] * layer.widthScale);
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        // Drape each ribbon edge on the RENDERED surface at its own position.
        const yr = surfaceHeightAt(data, gxOf(e.rx), gyOf(e.rz)) + ROAD_LIFT_M + layer.liftM;
        const yl = surfaceHeightAt(data, gxOf(e.lx), gyOf(e.lz)) + ROAD_LIFT_M + layer.liftM;
        positions.push(e.rx, yr, e.rz);
        normals.push(0, 1, 0);
        colors.push(cr, cg, cb);
        positions.push(e.lx, yl, e.lz);
        normals.push(0, 1, 0);
        colors.push(cr, cg, cb);
      }
      indices.push(...ribbonStripIndices(pts.length, startVert));
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
  };
}

/**
 * Height of the RENDERED terrain surface at fractional grid coords — the exact
 * value the terrain mesh shows there, not the nearest height-grid vertex.
 * Interpolates across the same (a,c,b)/(b,c,d) quad split chunkGeometry.ts
 * triangulates, over per-vertex `heightToMeters` values (the terrain converts
 * per vertex and lets the GPU interpolate linearly, so interpolating converted
 * corners reproduces the on-screen surface). Points past the chunk border
 * (ribbon edges overhanging the clip box) clamp to the border row, which the
 * edge-weld pass keeps consistent with the neighbouring chunk.
 */
function surfaceHeightAt(data: ChunkData, gx: number, gy: number): number {
  const res = data.resolution;
  const span = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / M;
  if (res < 2 || span === 0) return heightToMeters(data.heights[0] ?? 0);
  const fx = Math.max(0, Math.min(res - 1, ((gx - data.cx * span) / span) * (res - 1)));
  const fy = Math.max(0, Math.min(res - 1, ((gy - data.cy * span) / span) * (res - 1)));
  const i0 = Math.min(res - 2, Math.floor(fx));
  const j0 = Math.min(res - 2, Math.floor(fy));
  const u = fx - i0;
  const v = fy - j0;
  const h = (i: number, j: number) => heightToMeters(data.heights[j * res + i]);
  const ha = h(i0, j0);
  const hb = h(i0 + 1, j0);
  const hc = h(i0, j0 + 1);
  const hd = h(i0 + 1, j0 + 1);
  // Terrain quad split: triangle (a,c,b) covers u+v ≤ 1, (b,c,d) the rest.
  return u + v <= 1
    ? ha + u * (hb - ha) + v * (hc - ha)
    : hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd);
}
