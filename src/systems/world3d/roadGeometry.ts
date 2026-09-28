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
  const joins = new Map<string, { points: [number, number][]; count: number; lift: number; color: number[] }>();

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

    for (const [layerIndex, layer] of layers.entries()) {
      // A higher-tier road must cover every layer of the lower tier, including
      // its rut stripe. The shared millimeter bias was smaller than a layer.
      const layerLift = tier
        ? { lane: 0, street: 1, avenue: 2, plaza: 3 }[tier.tier] * 0.03 + layerIndex * 0.01
        : layer.liftM;
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
        const yr = surfaceHeightAt(data, gxOf(e.rx), gyOf(e.rz)) + ROAD_LIFT_M + layerLift;
        const yl = surfaceHeightAt(data, gxOf(e.lx), gyOf(e.lz)) + ROAD_LIFT_M + layerLift;
        positions.push(e.rx, yr, e.rz);
        normals.push(0, 1, 0);
        colors.push(cr, cg, cb);
        positions.push(e.lx, yl, e.lz);
        normals.push(0, 1, 0);
        colors.push(cr, cg, cb);
      }
      indices.push(...ribbonStripIndices(pts.length, startVert));
      if (tier) for (const i of [0, edges.length - 1]) {
        const p = local2d[i], e = edges[i];
        const key = `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}:${layer.colorHex}:${layerLift}`;
        const join = joins.get(key) ?? { points: [], count: 0, lift: layerLift, color: [cr, cg, cb] };
        join.points.push([p[0], p[1]], [e.rx, e.rz], [e.lx, e.lz]);
        join.count++;
        joins.set(key, join);
      }
    }
  }

  // Connect matching street ends with a bevel, rather than leaving the outer
  // corner between their square caps empty. Each paving layer gets the same
  // join construction, so curbs follow the corner instead of crossing it.
  for (const join of joins.values()) {
    if (join.count < 2) continue;
    const sorted = join.points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const half = (points: [number, number][]) => {
      const hull: [number, number][] = [];
      for (const p of points) {
        while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 1e-8) hull.pop();
        hull.push(p);
      }
      return hull.slice(0, -1);
    };
    const hull = [...half(sorted), ...half([...sorted].reverse())];
    if (hull.length < 3) continue;
    const start = positions.length / 3;
    for (const [x, z] of hull) {
      positions.push(x, surfaceHeightAt(data, (x + data.cx * S) / M, (z + data.cy * S) / M) + ROAD_LIFT_M + join.lift, z);
      normals.push(0, 1, 0);
      colors.push(...join.color);
    }
    for (let i = 1; i + 1 < hull.length; i++) indices.push(start, start + i + 1, start + i);
  }

  return drapeRoadTriangles(data, {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
  });
}

/**
 * Split road faces at the terrain grid AND its diagonals. Sampling only ribbon
 * corners leaves the face between them on a different plane from the ground:
 * plaza paving then disappears in triangular patches and layered bands cross.
 * Every resulting face now rests on one terrain triangle, at its original lift.
 * Flat chunks retain their compact historical buffers.
 */
function drapeRoadTriangles(data: ChunkData, mesh: RoadMesh): RoadMesh {
  if (data.resolution < 2 || data.heights.every(h => h === data.heights[0])) return mesh;
  type Point = [number, number];
  const positions: number[] = [], indices: number[] = [], normals: number[] = [], colors: number[] = [];
  const step = S / (data.resolution - 1);
  const height = (x: number, z: number) => surfaceHeightAt(data, (x + data.cx * S) / M, (z + data.cy * S) / M);
  const clip = (poly: Point[], distance: (p: Point) => number): Point[] => {
    const out: Point[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = distance(a), db = distance(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  };
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const first = mesh.indices[t] * 3;
    const triangle: Point[] = Array.from(mesh.indices.slice(t, t + 3), index => [mesh.positions[index * 3], mesh.positions[index * 3 + 2]] as Point);
    const lift = mesh.positions[first + 1] - height(triangle[0][0], triangle[0][1]);
    const minX = Math.floor(Math.min(...triangle.map(p => p[0])) / step);
    const maxX = Math.floor(Math.max(...triangle.map(p => p[0])) / step);
    const minZ = Math.floor(Math.min(...triangle.map(p => p[1])) / step);
    const maxZ = Math.floor(Math.max(...triangle.map(p => p[1])) / step);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      let cell = clip(triangle, p => p[0] - x * step);
      cell = clip(cell, p => (x + 1) * step - p[0]);
      cell = clip(cell, p => p[1] - z * step);
      cell = clip(cell, p => (z + 1) * step - p[1]);
      for (const side of [-1, 1]) {
        const poly = clip(cell, p => side * (p[0] + p[1] - (x + z + 1) * step));
        for (let i = 1; i + 1 < poly.length; i++) {
          const points = [poly[0], poly[i], poly[i + 1]];
          const [a, b, c] = points;
          if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-8) continue;
          for (const p of points) {
            indices.push(positions.length / 3);
            positions.push(p[0], height(p[0], p[1]) + lift, p[1]);
            normals.push(0, 1, 0);
            colors.push(mesh.colors[first], mesh.colors[first + 1], mesh.colors[first + 2]);
          }
        }
      }
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), normals: new Float32Array(normals), colors: new Float32Array(colors) };
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
