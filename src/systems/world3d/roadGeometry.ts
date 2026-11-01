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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 22:42:33
 * Dependents: components/World3D/World3DScene.tsx, systems/world3d/chunkBundle.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ChunkData, ChunkGeometryArrays } from './types';
import type { TerrainFootingDetail } from './terrainFootingDetail';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { gridPointToLocal } from './coords';
import {
  STREET_TIER_SPECS,
  streetTierByColorHex,
  streetRibbonLayers,
  ribbonEdgeOffsets,
  ribbonStripIndices,
  type StreetRibbonLayer,
} from '../worldforge/town/streetRibbons';
import { ROAD_3D_TIERS } from '../worldforge/travel/roadTunables';
import earcut from 'earcut';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
const ROAD_LIFT_M = 0.3;

/**
 * The market square's fill over ROAD_LIFT_M: over the highest avenue layer
 * (2 x 0.03 + 2 x 0.01 = 0.08 m) and under the plaza ring (4 x 0.03 = 0.12 m).
 */
const PLAZA_FILL_LIFT_M = 0.09;

/** How far back along each street a junction plate reaches, in the street's half widths. */
const JUNCTION_PLATE_REACH = 1.5;
/** A junction plate's lift over its own layer: under the next layer (0.01 m up). */
const JUNCTION_PLATE_LIFT_M = 0.005;
/** Two street ends this close to opposite (cos 20 degrees) are one straight run, not a junction. */
const JUNCTION_STRAIGHT_COS = 0.94;
/** The road-space half width a junction plate reports to the material. */
const JUNCTION_PLATE_HALF_W_M = 1000;

/**
 * Default packed-dirt tint for road runs that carry no per-street color — the
 * inherited regional roads (chunkSampler path) and any legacy producer. Town
 * streets ride their own tier tints through `colorHex` (see streetRibbons.ts),
 * rendered under one vertex-colored material so RoadPiece needs a single draw
 * call. Mirrors wallGeometry's DEFAULT_WALL_HEX.
 */
const DEFAULT_ROAD_HEX = '#a08b62';


/**
 * What a road surface IS, so the WebGPU road material can draw it
 * (gpu/roadSurfaceNode.ts). The tier tints stay the identity on the wire and the
 * 2D maps' colors; the 3D look comes from the kind (agora-257c, 2026-10-27).
 */
export const ROAD_SURFACE = {
  /** Plaza core: large flagstones. */
  flagstone: 1,
  /** Avenue core: small cut stone blocks laid in courses across the road. */
  setts: 2,
  /** Street: rounded field stones. */
  cobble: 3,
  /** Lane: packed dirt with two wheel ruts. */
  lane: 4,
  /** Plaza and avenue edging band: long curb stones. */
  curb: 5,
  /** The lane's flat rut stripe; the WebGPU material draws real ruts and drops it. */
  rutStripe: 6,
  /** Region highway: a paved trunk road. */
  highway: 7,
  /** Region road and any road with no tier: packed earth with ruts. */
  road: 8,
  /** Region trail: two worn tracks with grass between them. */
  trail: 9,
  /** Region path: a faint worn line. */
  path: 10,
  /** Verge beside paving: dust and gutter grime fading into the ground. */
  vergePaved: 11,
  /** Verge beside a dirt road: spilled dirt and worn grass fading into the ground. */
  vergeDirt: 12,
} as const;

const PAVED_KINDS: ReadonlySet<number> = new Set([
  ROAD_SURFACE.flagstone, ROAD_SURFACE.setts, ROAD_SURFACE.cobble, ROAD_SURFACE.highway,
]);

/**
 * Verge width beside a road, meters. The WebGPU material recomputes it from the
 * same half width and kind, so keep the two in step (gpu/roadSurfaceNode.ts).
 */
export function vergeWidthM(vergeKind: number, halfW: number): number {
  return vergeKind === ROAD_SURFACE.vergePaved ? 0.5 : Math.min(1.5, Math.max(0.6, halfW * 0.25));
}

/** The verge sits this far under the road ribbons, over the ground (ROAD_LIFT_M less it). */
const VERGE_DROP_M = 0.04;

/**
 * Road meshes carry per-vertex colors so RoadPiece renders with `vertexColors`,
 * and `road`: 4 floats per vertex in ROAD SPACE (distance along the road from
 * its start in meters, signed distance across from its centerline in meters,
 * the road's full half width in meters, and its ROAD_SURFACE kind). A junction
 * plate has no road direction: it carries its local x and z with half width 0.
 */
type RoadMesh = ChunkGeometryArrays & { colors: Float32Array; road: Float32Array; terrainLift?: Float32Array };

const EMPTY: RoadMesh = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
  colors: new Float32Array(0),
  road: new Float32Array(0),
};

const REGION_KIND_BY_HEX = new Map<string, number>([
  [ROAD_3D_TIERS.highway.colorHex.toLowerCase(), ROAD_SURFACE.highway],
  [ROAD_3D_TIERS.road.colorHex.toLowerCase(), ROAD_SURFACE.road],
  [ROAD_3D_TIERS.trail.colorHex.toLowerCase(), ROAD_SURFACE.trail],
  [ROAD_3D_TIERS.path.colorHex.toLowerCase(), ROAD_SURFACE.path],
]);

/** The surface kind of one paint layer of one ribbon. */
function surfaceKindOf(
  tier: ReturnType<typeof streetTierByColorHex>,
  layers: StreetRibbonLayer[],
  layerIndex: number,
  colorHex: string | undefined,
): number {
  if (!tier) return REGION_KIND_BY_HEX.get((colorHex ?? DEFAULT_ROAD_HEX).toLowerCase()) ?? ROAD_SURFACE.road;
  const layer = layers[layerIndex];
  if (tier.edgeHex && layer.colorHex === tier.edgeHex && layerIndex === 0) return ROAD_SURFACE.curb;
  if (tier.rutHex && layer.colorHex === tier.rutHex) return ROAD_SURFACE.rutStripe;
  return { plaza: ROAD_SURFACE.flagstone, avenue: ROAD_SURFACE.setts, street: ROAD_SURFACE.cobble, lane: ROAD_SURFACE.lane }[tier.tier];
}

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
  const road: number[] = [];
  const joins = new Map<string, { points: [number, number][]; plate: [number, number][]; dirs: [number, number][]; count: number; lift: number; color: number[]; kind: number }>();

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
    // Distance along the road: from the source line's start when the loader
    // sent it, so the pattern runs on across chunk seams; else from this run.
    const along: number[] = ribbon.alongM?.length === pts.length
      ? ribbon.alongM
      : local2d.reduce<number[]>((acc, p, i) => {
          acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p[0] - local2d[i - 1][0], p[1] - local2d[i - 1][1]));
          return acc;
        }, []);
    // Chunk-local metres → fractional grid coords (inverse of gridPointToLocal)
    // for per-vertex surface sampling.
    const gxOf = (localX: number) => (localX + data.cx * S) / M;
    const gyOf = (localZ: number) => (localZ + data.cy * S) / M;

    for (const [layerIndex, layer] of layers.entries()) {
      // A higher-tier road must cover every layer of the lower tier, including
      // its rut stripe. The shared millimeter bias was smaller than a layer.
      // The plaza tier sits one step higher (4, not 3): the square's own fill
      // (PLAZA_FILL_LIFT_M) takes the step between the avenues and the ring.
      const layerLift = tier
        ? { lane: 0, street: 1, avenue: 2, plaza: 4 }[tier.tier] * 0.03 + layerIndex * 0.01
        : layer.liftM;
      const cr = parseInt(layer.colorHex.slice(1, 3), 16) / 255;
      const cg = parseInt(layer.colorHex.slice(3, 5), 16) / 255;
      const cb = parseInt(layer.colorHex.slice(5, 7), 16) / 255;
      const kind = surfaceKindOf(tier, layers, layerIndex, ribbon.colorHex);
      const startVert = positions.length / 3;
      // The SHARED edge-offset math (identical sign convention to the old
      // inline loop: first-pushed vertex is the −perp side = `r` here).
      const edges = ribbonEdgeOffsets(local2d, (i) => halfW[i] * layer.widthScale);
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        // Drape each ribbon edge on the RENDERED surface at its own position.
        const yr = surfaceHeightAt(data, gxOf(e.rx), gyOf(e.rz)) + ROAD_LIFT_M + layerLift;
        const yl = surfaceHeightAt(data, gxOf(e.lx), gyOf(e.lz)) + ROAD_LIFT_M + layerLift;
        const across = halfW[i] * layer.widthScale;
        positions.push(e.rx, yr, e.rz);
        normals.push(0, 1, 0);
        colors.push(cr, cg, cb);
        road.push(along[i], -across, halfW[i], kind);
        positions.push(e.lx, yl, e.lz);
        normals.push(0, 1, 0);
        colors.push(cr, cg, cb);
        road.push(along[i], across, halfW[i], kind);
      }
      indices.push(...ribbonStripIndices(pts.length, startVert));
      if (tier) for (const i of [0, edges.length - 1]) {
        const p = local2d[i], e = edges[i];
        const key = `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}:${layer.colorHex}:${layerLift}`;
        const join = joins.get(key) ?? { points: [], plate: [], dirs: [], count: 0, lift: layerLift, color: [cr, cg, cb], kind };
        join.points.push([p[0], p[1]], [e.rx, e.rz], [e.lx, e.lz]);
        // The junction plate reaches JUNCTION_PLATE_REACH half widths back
        // along each street, over the inner wedge where two streets overlap.
        const j = i === 0 ? 1 : edges.length - 2;
        const seg = Math.hypot(local2d[j][0] - p[0], local2d[j][1] - p[1]);
        const t = seg > 1e-6 ? Math.min(1, (JUNCTION_PLATE_REACH * halfW[i] * layer.widthScale) / seg) : 0;
        const ej = edges[j];
        join.plate.push(
          [e.rx, e.rz], [e.lx, e.lz],
          [e.rx + (ej.rx - e.rx) * t, e.rz + (ej.rz - e.rz) * t],
          [e.lx + (ej.lx - e.lx) * t, e.lz + (ej.lz - e.lz) * t],
        );
        if (seg > 1e-6) join.dirs.push([(local2d[j][0] - p[0]) / seg, (local2d[j][1] - p[1]) / seg]);
        join.count++;
        joins.set(key, join);
      }
    }
  }

  // THE MARKET SQUARE (agora-257c, 2026-10-28): only the square's ring of
  // plaza-tier streets reached the bake, so its middle drew as bare floor. The
  // plan's own plaza polygon is now paved in flagstones. It lies OVER every
  // street that runs into the square and under the square's own ring, so a
  // street stops at the square's edge: before, each street's end showed on
  // the slabs as a flat wedge of its own paving (Remy's walk, 2026-10-28).
  // Road space is world x and z, so the slabs run on across chunk seams.
  // The plaza tier's tint: the square's fill draws in it under the WebGL world.
  const plazaTier = STREET_TIER_SPECS.plaza.colorHex;
  const pr = parseInt(plazaTier.slice(1, 3), 16) / 255;
  const pg = parseInt(plazaTier.slice(3, 5), 16) / 255;
  const pb = parseInt(plazaTier.slice(5, 7), 16) / 255;
  for (const plaza of data.plazas ?? []) {
    if (plaza.points.length < 3) continue;
    const start = positions.length / 3;
    const flat: number[] = [];
    for (const p of plaza.points) {
      const l = gridPointToLocal(p.x, p.y, data.cx, data.cy);
      flat.push(l.x, l.z);
      positions.push(l.x, surfaceHeightAt(data, p.x, p.y) + ROAD_LIFT_M + PLAZA_FILL_LIFT_M, l.z);
      normals.push(0, 1, 0);
      colors.push(pr, pg, pb);
      road.push(l.x + data.cx * S, l.z + data.cy * S, 0, ROAD_SURFACE.flagstone);
    }
    const tris = earcut(flat);
    for (let t = 0; t + 2 < tris.length; t += 3) {
      // Wind each triangle to face up (see waterGeometry.pushUpwardTriangles).
      const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
      const ny = (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]);
      if (ny <= 0) indices.push(start + a, start + b, start + c);
      else indices.push(start + a, start + c, start + b);
    }
  }

  // Connect matching street ends with a bevel, rather than leaving the outer
  // corner between their square caps empty. Each paving layer gets the same
  // join construction, so curbs follow the corner instead of crossing it.
  //
  // JUNCTION PLATES (roads step 5, agora-257c 2026-10-28). Where streets of one
  // tier meet at an angle, their ribbons overlap in the inner wedge at the SAME
  // height, and the two sets of stone courses z-fought along a jagged seam
  // (Remy's walk). Such a join now draws one plate instead: the hull of every
  // street's end reaching JUNCTION_PLATE_REACH half widths back, lifted
  // JUNCTION_PLATE_LIFT_M over its layer (under the next layer, 0.01 m up),
  // laid in world x and z so one pattern runs across the whole crossing.
  // A straight run that only changes segments keeps the flat bevel: there the
  // overlap is a sliver, and a plate would show as a patch of turned stones.
  for (const join of joins.values()) {
    if (join.count < 2) continue;
    const bent = join.count > 2 || (join.dirs.length === 2
      && join.dirs[0][0] * join.dirs[1][0] + join.dirs[0][1] * join.dirs[1][1] > -JUNCTION_STRAIGHT_COS);
    const sorted = (bent ? [...join.points, ...join.plate] : join.points).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
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
    const plateLift = bent ? JUNCTION_PLATE_LIFT_M : 0;
    for (const [x, z] of hull) {
      positions.push(x, surfaceHeightAt(data, (x + data.cx * S) / M, (z + data.cy * S) / M) + ROAD_LIFT_M + join.lift + plateLift, z);
      normals.push(0, 1, 0);
      colors.push(...join.color);
      // World x and z; a half width far wider than the plate, so the material
      // sees its middle everywhere (no camber, no ruts across a junction).
      road.push(x + data.cx * S, z + data.cy * S, JUNCTION_PLATE_HALF_W_M, join.kind);
    }
    for (let i = 1; i + 1 < hull.length; i++) indices.push(start, start + i + 1, start + i);
  }

  return drapeRoadTriangles(data, {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    road: new Float32Array(road),
  });
}

/**
 * A VERGE strip along each side of every road (agora-257c, 2026-10-28, roads
 * step 3). A road ribbon ended on a hard line, the "paper cut-out" Remy saw.
 * The verge starts at the road's edge in the road's own look and fades, along
 * a ragged line, into the ground beside it: the WebGPU road material draws it
 * transparent, so the real terrain shows through as it thins. It lies just
 * under the road layers, so where a verge meets another road the road wins.
 * WebGPU only: the WebGL world keeps its plain ribbons.
 */
export function buildRoadVergeMesh(data: ChunkData): RoadMesh {
  const ribbons = data.roads.filter((r) => r.points.length >= 2);
  if (ribbons.length === 0) return EMPTY;
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const road: number[] = [];
  for (const ribbon of ribbons) {
    const pts = ribbon.points;
    const tier = streetTierByColorHex(ribbon.colorHex);
    const layers = tier ? streetRibbonLayers(tier) : LEGACY_SINGLE_LAYER(ribbon.colorHex ?? DEFAULT_ROAD_HEX);
    // The road's own surface: its core layer (the last that is not the rut stripe).
    let coreIndex = layers.length - 1;
    while (coreIndex > 0 && surfaceKindOf(tier, layers, coreIndex, ribbon.colorHex) === ROAD_SURFACE.rutStripe) coreIndex--;
    const coreKind = surfaceKindOf(tier, layers, coreIndex, ribbon.colorHex);
    const vergeKind = PAVED_KINDS.has(coreKind) ? ROAD_SURFACE.vergePaved : ROAD_SURFACE.vergeDirt;
    const local2d = pts.map((p) => {
      const l = gridPointToLocal(p.x, p.y, data.cx, data.cy);
      return [l.x, l.z] as const;
    });
    const halfW = pts.map((_, i) => ((ribbon.width[i] ?? 0.04) * M) / 2);
    const along: number[] = ribbon.alongM?.length === pts.length
      ? ribbon.alongM
      : local2d.reduce<number[]>((acc, p, i) => {
          acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p[0] - local2d[i - 1][0], p[1] - local2d[i - 1][1]));
          return acc;
        }, []);
    const inner = ribbonEdgeOffsets(local2d, (i) => halfW[i]);
    const outer = ribbonEdgeOffsets(local2d, (i) => halfW[i] + vergeWidthM(vergeKind, halfW[i]));
    const y = (x: number, z: number) =>
      surfaceHeightAt(data, (x + data.cx * S) / M, (z + data.cy * S) / M) + ROAD_LIFT_M - VERGE_DROP_M;
    // Right side: (outer r, inner r) pairs; left side: (inner l, outer l) pairs.
    // Each pair is (-perp side, +perp side), the order ribbonStripIndices winds up.
    for (const side of ['r', 'l'] as const) {
      const start = positions.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const o = outer[i], n = inner[i];
        const vw = vergeWidthM(vergeKind, halfW[i]);
        const pair: Array<[number, number, number]> = side === 'r'
          ? [[o.rx, o.rz, -(halfW[i] + vw)], [n.rx, n.rz, -halfW[i]]]
          : [[n.lx, n.lz, halfW[i]], [o.lx, o.lz, halfW[i] + vw]];
        for (const [x, z, across] of pair) {
          positions.push(x, y(x, z), z);
          normals.push(0, 1, 0);
          colors.push(0, 0, 0);
          road.push(along[i], across, halfW[i], vergeKind);
        }
      }
      indices.push(...ribbonStripIndices(pts.length, start));
    }
  }
  return drapeRoadTriangles(data, {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    road: new Float32Array(road),
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
  // Retain the original draw offsets as derived mesh metadata. A render-only
  // near-foot projection can then keep the same layer ordering on source land.
  const terrainLift = new Float32Array(mesh.positions.length / 3);
  for (let i = 0; i < terrainLift.length; i++) terrainLift[i] = mesh.positions[i * 3 + 1]
    - surfaceHeightAt(data, (mesh.positions[i * 3] + data.cx * S) / M, (mesh.positions[i * 3 + 2] + data.cy * S) / M);
  mesh = { ...mesh, terrainLift };
  if (data.resolution < 2 || data.heights.every(h => h === data.heights[0])) return mesh;
  type Point = [number, number];
  const positions: number[] = [], indices: number[] = [], normals: number[] = [], colors: number[] = [], road: number[] = [], lifts: number[] = [];
  const step = S / (data.resolution - 1);
  const height = (x: number, z: number) => surfaceHeightAt(data, (x + data.cx * S) / M, (z + data.cy * S) / M);
  const clip = clipRoadPolygon;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const first = mesh.indices[t] * 3;
    const triangle: Point[] = Array.from(mesh.indices.slice(t, t + 3), index => [mesh.positions[index * 3], mesh.positions[index * 3 + 2]] as Point);
    const lift = mesh.positions[first + 1] - height(triangle[0][0], triangle[0][1]);
    // Road space varies across the source triangle; each cut vertex takes its
    // barycentric blend, so stones and ruts stay put where the face is split.
    const [ta, tb, tc] = triangle;
    const area = (tb[0] - ta[0]) * (tc[1] - ta[1]) - (tb[1] - ta[1]) * (tc[0] - ta[0]);
    const ia = mesh.indices[t] * 4, ib = mesh.indices[t + 1] * 4, ic = mesh.indices[t + 2] * 4;
    const roadAt = (p: Point): number[] => {
      const w1 = area === 0 ? 0 : ((p[0] - ta[0]) * (tc[1] - ta[1]) - (p[1] - ta[1]) * (tc[0] - ta[0])) / area;
      const w2 = area === 0 ? 0 : ((tb[0] - ta[0]) * (p[1] - ta[1]) - (tb[1] - ta[1]) * (p[0] - ta[0])) / area;
      const w0 = 1 - w1 - w2;
      return [0, 1, 2].map((k) => mesh.road[ia + k] * w0 + mesh.road[ib + k] * w1 + mesh.road[ic + k] * w2)
        .concat(mesh.road[ia + 3]);
    };
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
            road.push(...roadAt(p));
            lifts.push(lift);
          }
        }
      }
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), normals: new Float32Array(normals), colors: new Float32Array(colors), road: new Float32Array(road), terrainLift: new Float32Array(lifts) };
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


type RoadPoint = [number, number];

function clipRoadPolygon(poly: RoadPoint[], distance: (p: RoadPoint) => number): RoadPoint[] {
    const out: RoadPoint[] = [];
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
  }

/**
 * Match the existing near-foot terrain experiment without changing walking
 * support. The old ribbon lift separates draw layers over coarse triangles;
 * it is not a platform that should bury a traveler standing on source ground.
 * Keep that ordering in millimeters near the feet and blend to the unchanged
 * exterior. Road-space interpolation retains the existing stones and ruts.
 * Older worker bundles without offset metadata keep their original buffers.
 */
export type FootingRoadMesh = ChunkGeometryArrays & { colors?: Float32Array; road?: Float32Array; terrainLift?: Float32Array };

export function refineRoadMeshForFooting(
  mesh: FootingRoadMesh,
  origin: { x: number; z: number },
  detail: TerrainFootingDetail,
): FootingRoadMesh {
  return refineRoadPartitions(mesh, origin, detail, false)[0];
}

/** The walking renderer can draw several bounded meshes instead of losing the
 * whole view when a dense junction does not fit in one. No source face is
 * dropped. Keep the original single-mesh API's refusal contract for callers
 * that cannot render partitions; at most four250k meshes may be allocated. */
export function refineRoadMeshesForFooting(mesh: FootingRoadMesh, origin: {x: number; z: number}, detail: TerrainFootingDetail): FootingRoadMesh[] {
  return refineRoadPartitions(mesh, origin, detail, true);
}

function refineRoadPartitions(mesh: FootingRoadMesh, origin: {x: number; z: number}, detail: TerrainFootingDetail, partitioned: boolean): FootingRoadMesh[] {
  const sourceColors = mesh.colors, sourceRoad = mesh.road, sourceLift = mesh.terrainLift;
  const count = mesh.positions.length / 3;
  if (!count || !sourceColors || !sourceRoad || !sourceLift || sourceLift.length !== count
    || sourceColors.length !== count * 3 || sourceRoad.length !== count * 4) return [mesh];
  if (![origin.x, origin.z, detail.centerX, detail.centerZ, detail.innerRadius, detail.outerRadius, detail.maxEdgeM].every(Number.isFinite)
    || detail.innerRadius < 0 || detail.outerRadius <= detail.innerRadius || detail.maxEdgeM <= 0) throw Error('Invalid road footing detail');

  const minX = detail.centerX - detail.outerRadius - origin.x, maxX = detail.centerX + detail.outerRadius - origin.x;
  const minZ = detail.centerZ - detail.outerRadius - origin.z, maxZ = detail.centerZ + detail.outerRadius - origin.z;
  let meetsPatch = false;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const vertices = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    if (Math.max(...vertices.map(v => mesh.positions[v * 3])) >= minX && Math.min(...vertices.map(v => mesh.positions[v * 3])) <= maxX
      && Math.max(...vertices.map(v => mesh.positions[v * 3 + 2])) >= minZ && Math.min(...vertices.map(v => mesh.positions[v * 3 + 2])) <= maxZ) { meetsPatch = true; break; }
  }
  if (!meetsPatch) return [mesh];

  const positions: number[] = [], indices: number[] = [], normals: number[] = [], colors: number[] = [], road: number[] = [], lifts: number[] = [];
  // Adjacent source faces often reach the same paving vertex. Reuse only
  // identical rendered attributes: different stones, tiers and road directions
  // retain their own vertices and every original face remains in the mesh.
  // Compare the same fourteen Float32 attributes as the old decimal key.
  // A numeric bucket avoids allocating a long string for every clipped vertex.
  // Hash collisions still compare every attribute, so distinct stones, normals
  // and road directions cannot merge. Zero/NaN equality matches the old key.
  const sharedVertices = new Map<number, number | number[]>();
  const keyValues = new Float32Array(14), keyWords = new Uint32Array(keyValues.buffer);
  const sameValue = (value: number, expected: number) => {
    const rounded = Math.fround(value);
    return rounded === expected || (Number.isNaN(rounded) && Number.isNaN(expected));
  };
  const sameVertex = (index: number) => {
    for (let k = 0; k < 3; k++) {
      if (!sameValue(positions[index * 3 + k], keyValues[k])
        || !sameValue(colors[index * 3 + k], keyValues[3 + k])
        || !sameValue(normals[index * 3 + k], keyValues[6 + k])) return false;
    }
    for (let k = 0; k < 4; k++) if (!sameValue(road[index * 4 + k], keyValues[9 + k])) return false;
    return sameValue(lifts[index], keyValues[13]);
  };
  const parts: FootingRoadMesh[] = [];
  const finishPart = (): FootingRoadMesh => ({...mesh, positions: new Float32Array(positions), indices: new Uint32Array(indices),
    normals: new Float32Array(normals), colors: new Float32Array(colors), road: new Float32Array(road), terrainLift: new Float32Array(lifts)});
  // Every road face uses one finite world-space grid, including its diagonal
  // planes. Sampling a curved surface separately at each clipped face vertex
  // gave overlapping paving slightly different heights and visible flecks.
  // Patch borders are grid lines too, so projection meets the old exterior.
  const cells = Math.ceil(detail.outerRadius * 2 / (detail.maxEdgeM / Math.SQRT2));
  if (!Number.isSafeInteger(cells) || cells > 250000) throw Error('Road footing detail exceeds bounded mesh budget');
  const step = detail.outerRadius * 2 / cells;
  // Keep the old eight-decimal coordinate identity without formatting every
  // repeated triangle corner. Only ambiguous half-way cases need toFixed;
  // its exact rounding and negative rounded zero remain the authority.
  const coordinateKey = (value: number): number | string => {
    const scaled = value * 1e8, rounded = Math.round(scaled);
    if (!Number.isSafeInteger(rounded)) return value.toFixed(8);
    if (Math.abs(Math.abs(scaled - rounded) - .5) <= 4 * Number.EPSILON * Math.max(1, Math.abs(scaled))) {
      const text = value.toFixed(8), exact = Number(text.replace('.', ''));
      return exact === 0 && text.startsWith('-') ? -Infinity : exact;
    }
    return rounded === 0 && value < 0 ? -Infinity : rounded;
  };
  const groundSamples = new Map<number, Map<number, number>>();
  let work = 0;
  const planes = [(p: RoadPoint) => p[0] - minX, (p: RoadPoint) => maxX - p[0], (p: RoadPoint) => p[1] - minZ, (p: RoadPoint) => maxZ - p[1]];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const vertices = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    const triangle: RoadPoint[] = vertices.map(v => [mesh.positions[v * 3], mesh.positions[v * 3 + 2]]);
    const [a, b, c] = triangle;
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-12) continue;
    const cache = [new Map<number | string, Map<number | string, number>>(), new Map<number | string, Map<number | string, number>>()];
    const rememberVertex = (x: number | string, z: number | string, projected: boolean, index: number) => {
      const records = cache[projected ? 1 : 0], column = records.get(x);
      if (column) column.set(z, index);
      else records.set(x, new Map([[z, index]]));
      return index;
    };
    // Many clipped vertices reuse the same grid corner on this source face.
    // Cache its exact projected height, without changing the plane, sample
    // coordinates or arithmetic order. This avoids rebuilding a sampler for
    // every vertex as the player's detail window moves along a paved street.
    const drawnHeights = new Map<number, Map<number, number>>();
    const rememberHeight = (x: number, z: number, height: number) => {
      const column = drawnHeights.get(x);
      if (column) column.set(z, height);
      else drawnHeights.set(x, new Map([[z, height]]));
      return height;
    };
    const drawHeight = (px: number, pz: number) => {
      const remembered = drawnHeights.get(px)?.get(pz);
      if (remembered !== undefined) return remembered;
      const x = px + origin.x, z = pz + origin.z;
      const wb = ((px - a[0]) * (c[1] - a[1]) - (pz - a[1]) * (c[0] - a[0])) / area;
      const wc = ((b[0] - a[0]) * (pz - a[1]) - (b[1] - a[1]) * (px - a[0])) / area;
      const ws = [1 - wb - wc, wb, wc];
      const originalY = ((0 + mesh.positions[vertices[0] * 3 + 1] * ws[0])
        + mesh.positions[vertices[1] * 3 + 1] * ws[1]) + mesh.positions[vertices[2] * 3 + 1] * ws[2];
      const originalLift = ((0 + sourceLift[vertices[0]] * ws[0])
        + sourceLift[vertices[1]] * ws[1]) + sourceLift[vertices[2]] * ws[2];
      const radius = Math.max(Math.abs(x - detail.centerX), Math.abs(z - detail.centerZ));
      const fraction = Math.max(0, Math.min(1, (detail.outerRadius - radius) / (detail.outerRadius - detail.innerRadius)));
      const blend = fraction * fraction * (3 - 2 * fraction);
      if (blend > 0) {
        const column = groundSamples.get(x);
        let ground = column?.get(z);
        if (ground == null) {
          ground = detail.heightAt(x, z);
          if (column) column.set(z, ground);
          else groundSamples.set(x, new Map([[z, ground]]));
        }
        if (!Number.isFinite(ground)) throw Error('Nonfinite canonical road footing surface');
        // Preserve tier, plaza and junction ordering. These drawing offsets
        // stay above the real ground without creating a new walking floor.
        // Keep the smallest authored tier gap at a quarter millimeter.
        // Compressing it to fifty micrometers let separately triangulated
        // curbs cross the stones above them in the played Sedanes square.
        // The highest ordinary plaza layer remains below one centimeter;
        // this is drawing separation, not a new physical walking surface.
        const target = ground + .003 + (originalLift - ROAD_LIFT_M) * .05;
        return rememberHeight(px, pz, originalY + (target - originalY) * blend);
      }
      return rememberHeight(px, pz, originalY);
    };
    const vertexAt = (p: RoadPoint, project: boolean): number => {
      const xKey = coordinateKey(p[0]), zKey = coordinateKey(p[1]);
      const found = cache[project ? 1 : 0].get(xKey)?.get(zKey); if (found != null) return found;
      const w1 = ((p[0] - a[0]) * (c[1] - a[1]) - (p[1] - a[1]) * (c[0] - a[0])) / area;
      const w2 = ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / area;
      const weights = [1 - w1 - w2, w1, w2];
      const blendAttribute = (array: Float32Array, stride: number, component: number) =>
        ((0 + array[vertices[0] * stride + component] * weights[0])
          + array[vertices[1] * stride + component] * weights[1])
          + array[vertices[2] * stride + component] * weights[2];
      const baseY = blendAttribute(mesh.positions, 3, 1), lift = blendAttribute(sourceLift, 1, 0);
      let y = baseY;
      if (project) {
        const ix = Math.max(0, Math.min(cells - 1, Math.floor((p[0] - minX) / step)));
        const iz = Math.max(0, Math.min(cells - 1, Math.floor((p[1] - minZ) / step)));
        const left = minX + ix * step, top = minZ + iz * step;
        const right = ix === cells - 1 ? maxX : left + step, bottom = iz === cells - 1 ? maxZ : top + step;
        const u = (p[0] - left) / (right - left), v = (p[1] - top) / (bottom - top);
        // The same affine triangle supports every overlapping face, while its
        // own source tier/UV/color data and unchanged exterior remain intact.
        y = u + v <= 1
          ? drawHeight(left,top) * (1-u-v) + drawHeight(right,top) * u + drawHeight(left,bottom) * v
          : drawHeight(right,bottom) * (u+v-1) + drawHeight(left,bottom) * (1-u) + drawHeight(right,top) * (1-v);
      }
      const color = [0, 1, 2].map(k => blendAttribute(sourceColors, 3, k));
      const normal = [0, 1, 2].map(k => blendAttribute(mesh.normals, 3, k));
      const paving = [0, 1, 2].map(k => blendAttribute(sourceRoad, 4, k));
      paving.push(sourceRoad[vertices[0] * 4 + 3]);
      keyValues[0] = p[0]; keyValues[1] = y; keyValues[2] = p[1];
      keyValues.set(color, 3); keyValues.set(normal, 6); keyValues.set(paving, 9); keyValues[13] = lift;
      let sharedKey = 2166136261;
      for (let k = 0; k < keyWords.length; k++) {
        let word = keyWords[k];
        if ((word & 0x7fffffff) === 0) word = 0;
        else if ((word & 0x7f800000) === 0x7f800000 && (word & 0x007fffff) !== 0) word = 0x7fc00000;
        sharedKey = Math.imul(sharedKey ^ word, 16777619) >>> 0;
      }
      const bucket = sharedVertices.get(sharedKey);
      const shared = typeof bucket === 'number' ? (sameVertex(bucket) ? bucket : undefined)
        : bucket?.find(sameVertex);
      if (shared != null) return rememberVertex(xKey, zKey, project, shared);
      if (positions.length / 3 >= 250000) throw Error(`Road footing detail exceeds bounded mesh budget (origin ${origin.x},${origin.z}; center ${detail.centerX},${detail.centerZ}; source face ${t / 3})`);
      const index = positions.length / 3;
      positions.push(p[0], y, p[1]);
      colors.push(...color); normals.push(...normal); road.push(...paving);
      lifts.push(lift); rememberVertex(xKey, zKey, project, index);
      if (typeof bucket === 'number') sharedVertices.set(sharedKey, [bucket, index]);
      else if (bucket) bucket.push(index);
      else sharedVertices.set(sharedKey, index);
      return index;
    };
    const emit = (poly: RoadPoint[], project: boolean) => {
      for (let i = 1; i + 1 < poly.length; i++) {
        const [p, q, r] = [poly[0], poly[i], poly[i + 1]];
        if (Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) < 1e-10) continue;
        // A thin clipping remnant can collapse completely in the Float32
        // buffer sent to the GPU. It draws no paving, so do not spend the
        // bounded vertex allowance on that zero-area derived triangle.
        const px = Math.fround(p[0]), pz = Math.fround(p[1]);
        const renderedArea = (Math.fround(q[0]) - px) * (Math.fround(r[1]) - pz)
          - (Math.fround(q[1]) - pz) * (Math.fround(r[0]) - px);
        if (renderedArea === 0) continue;
        if (partitioned && positions.length / 3 >= 249997) {
          if (parts.length >= 3) throw Error('Road footing detail exceeds bounded partition budget');
          // Flush only between complete triangles. Shared boundary vertices
          // are copied with their exact attributes into the next draw mesh.
          parts.push(finishPart());
          positions.length = indices.length = normals.length = colors.length = road.length = lifts.length = 0;
          sharedVertices.clear(); for (const records of cache) records.clear();
        }
        indices.push(vertexAt(p, project), vertexAt(q, project), vertexAt(r, project));
      }
    };
    // Split the original face, rather than placing overlapping new paving.
    // The four rejected strips retain its exact old plane and attributes.
    let core = triangle;
    for (const plane of planes) {
      emit(clipRoadPolygon(core, p => -plane(p)), false);
      core = clipRoadPolygon(core, plane);
      if (!core.length) break;
    }
    if (!core.length) continue;
    const x0 = Math.max(0, Math.floor((Math.min(...core.map(p => p[0])) - minX) / step)), x1 = Math.min(cells - 1, Math.floor((Math.max(...core.map(p => p[0])) - minX) / step));
    const z0 = Math.max(0, Math.floor((Math.min(...core.map(p => p[1])) - minZ) / step)), z1 = Math.min(cells - 1, Math.floor((Math.max(...core.map(p => p[1])) - minZ) / step));
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (++work > 2000000) throw Error('Road footing detail exceeds bounded work budget');
      const left = minX + x * step, top = minZ + z * step;
      let cell = clipRoadPolygon(core, p => p[0] - left);
      cell = clipRoadPolygon(cell, p => left + step - p[0]);
      cell = clipRoadPolygon(cell, p => p[1] - top);
      cell = clipRoadPolygon(cell, p => top + step - p[1]);
      for (const side of [-1, 1]) emit(clipRoadPolygon(cell, p => side * (p[0] + p[1] - left - top - step)), true);
    }
  }
  return [...parts, finishPart()];
}
