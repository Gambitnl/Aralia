/**
 * @file waterGeometry.ts
 * Build visible water surfaces for clipped rivers and lake polygons. Ground
 * rivers arrive with a loader-computed waterline that crossings can query too,
 * so this file renders that shared truth instead of hiding a second guessed
 * ribbon beneath the carved bed. Legacy continent rivers keep their previous
 * terrain-following fallback. Output is chunk-local.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 17:13:32
 * Dependents: systems/world3d/chunkBundle.ts, systems/worldforge/bridge/groundWaterSurfaceQuery.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ChunkData, ChunkGeometryArrays, ClippedPolyline } from './types';
import earcut from 'earcut';
import Delaunator from 'delaunator';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { gridPointToLocal } from './coords';
import { ribbonBedHeightAt, validateRibbonBed } from '../worldforge/bridge/groundRibbonBed';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
// Legacy continent rivers do not yet carry the ground-mode waterline contract.
// Keep their historical buried offset rather than changing a separate renderer
// as a side effect of this walking-scale feature.
const LEGACY_RIVER_DROP_M = 0.5;
const LAKE_DROP_M = LEGACY_RIVER_DROP_M + 0.05;

/**
 * Water depth at which the surface stops reading through to the bed, in meters.
 *
 * Measured on the streamed world at dcell 785 / seed 42 (11x11 chunk sweep,
 * 14,453 water polygons): the carved bed sits a median 0.44 m under the water
 * surface in a body's interior and a median -0.03 m — i.e. level with it — at
 * the polygon's own edge. So the whole shoreline transition lives inside the
 * first half meter of depth, which is where the opacity ramp has to spend its
 * range. A ramp normalized to the 21.9 m maximum would leave every pool in the
 * scene at the pale end of it.
 */
const OPAQUE_DEPTH_M = 0.55;

/**
 * Depth at which water reaches its deepest color. Deliberately much longer than
 * the opacity ramp: opacity is about seeing the bed, which stops fast, while
 * color keeps deepening down the channel long after the bed is hidden.
 */
const DEEP_COLOR_DEPTH_M = 2.5;

/** Ease so the pale margin holds its width instead of snapping to full tone. */
function smoothstep01(t: number): number {
  const c = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * Water geometry carries a per-vertex DEPTH encoding in its color attribute.
 *
 * Not a color: the three channels are (opacity ramp, color ramp, raw normalized
 * depth), unpacked by `waterSurfaceMaterial`'s shader hooks. Depth is a CPU-side
 * fact — it needs the carved bed heightfield, which the fragment shader has no
 * access to — and the color attribute is the only per-vertex channel the chunk
 * geometry pipeline already transports end to end.
 */
export interface WaterMesh extends ChunkGeometryArrays {
  colors: Float32Array;
  /**
   * Surface flow per vertex, world meters per second on x and z (2 per vertex).
   * Rivers flow along their course at a speed set by the waterline's slope;
   * lakes and the sea are still (0, 0). The water material moves its ripple
   * and foam along this (agora-257c, 2026-10-27: the ripple did not move).
   */
  flow: Float32Array;
}

/**
 * Vertices across a river ribbon. Two (one per bank) gave the shader only bank
 * depths, which are about 0, so a whole river drew at shoreline opacity: on
 * tile 17,4 a 1.3 m deep river was almost clear (agora-257c, 2026-10-27). Five
 * put the deep middle and both shoulders into the depth encoding.
 *
 * Thirteen since 2026-10-30 (with a row at least every RIBBON_ROW_STEP_M): five
 * across and one row per polyline point (about 12 m) still made quads 4.5 m by
 * 12 m, and the per-vertex depth spread over them as long pale wedges, so the
 * bed and the bridge posts showed through the channel as ghosts, and an edge
 * vertex over a low bank stood a flat sliver of water on it (Remy, Sinzheim,
 * "weirdness under water"). Thirteen puts a vertex about every 1.5 m across an
 * 18 m river, the ground grid's own spacing.
 */
export const RIBBON_ACROSS = 13;

/** The longest step between two ribbon rows along the river, m (2026-10-30; see RIBBON_ACROSS). */
export const RIBBON_ROW_STEP_M = 2;

/** River surface speed with no slope, m/s: a slow lowland river. */
const RIVER_BASE_SPEED_MPS = 0.5;
/** Added speed per unit of waterline slope (m/m), m/s. */
const RIVER_SPEED_PER_SLOPE = 60;
/** Fastest drawn surface speed, m/s: rapids. */
const RIVER_MAX_SPEED_MPS = 3;

const EMPTY: WaterMesh = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
  colors: new Float32Array(0),
  flow: new Float32Array(0),
};

export function buildWaterMesh(data: ChunkData): WaterMesh {
  // Legacy continent packets retain their terrain-following renderer. Native
  // ground packets must prove their source bed before emitting water faces.
  if (data.groundRibbonMode !== undefined || data.groundRibbonBed || data.groundRibbonSource) validateRibbonBed(data);
  const lakes = data.lakes?.filter((l) => l.points.length >= 3) ?? [];
  const ribbons = data.rivers.filter((r) => r.points.length >= 2);
  if (lakes.length === 0 && ribbons.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const flow: number[] = [];

  for (const lake of lakes) {
    if (lake.interior?.length) {
      emitFilledBody(lake, data, positions, indices, normals, colors, flow);
      continue;
    }
    const startVert = positions.length / 3;
    emitLake(lake, data, positions, normals, colors, flow);
    const flat: number[] = [];
    for (const p of lake.points) {
      const local = gridPointToLocal(p.x, p.y, data.cx, data.cy);
      flat.push(local.x, local.z);
    }
    pushUpwardTriangles(earcut(flat), startVert, positions, indices);
  }

  for (const ribbon of ribbons) {
    const startVert = positions.length / 3;
    const { rows, depth } = emitRibbon(ribbon, data, positions, normals, colors, flow);
    // A triangle with all three vertices dry stands over a bank: drop it
    // (2026-10-30). One wet vertex keeps it, fading to clear at the dry ones.
    // Only a ground river (a real shared waterline) is judged: a legacy
    // continent ribbon sits under its own ground sample by design.
    const judged = !!ribbon.waterlineY?.length;
    const wet = (a: number, b: number, c: number) => !judged
      || depth[a - startVert] > 0 || depth[b - startVert] > 0 || depth[c - startVert] > 0;
    for (let i = 0; i < rows - 1; i++) {
      for (let k = 0; k < RIBBON_ACROSS - 1; k++) {
        const l0 = startVert + i * RIBBON_ACROSS + k;
        const r0 = l0 + 1;
        const l1 = l0 + RIBBON_ACROSS;
        const r1 = l1 + 1;
        if (wet(l0, l1, r0)) indices.push(l0, l1, r0);
        if (wet(r0, l1, r1)) indices.push(r0, l1, r1);
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    flow: new Float32Array(flow),
  };
}

/**
 * Encode one vertex's water depth into the color attribute.
 *
 * Both ramps are evaluated here rather than in the shader because the constants
 * that set them are measurements of this world's carve pass, and they belong
 * next to the note recording those measurements.
 */
function pushDepthEncoding(colors: number[], depthM: number): void {
  const d = Math.max(0, depthM);
  colors.push(
    smoothstep01(d / OPAQUE_DEPTH_M),
    smoothstep01(d / DEEP_COLOR_DEPTH_M),
    Math.min(1, d / DEEP_COLOR_DEPTH_M),
  );
}

/**
 * Water height for one polygon vertex.
 *
 * Sea and lake are flat, so they use the body's single height. A river is not
 * flat: its surface descends, so the vertex is projected onto the centerline and
 * the height interpolated between the two points it falls between. Clipping to a
 * chunk invents vertices, which is why this is computed per vertex here instead
 * of being carried as an array from the loader.
 */
export function waterSurfaceYAt(
  body: NonNullable<ChunkData['lakes']>[number],
  gx: number,
  gy: number,
): number {
  const line = body.centerline;
  if (body.kind !== 'river' || !line || line.length === 0) return body.surfaceY;
  if (line.length === 1) return line[0].surfaceY;

  let best = { d2: Infinity, y: line[0].surfaceY };
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    // Where along a→b the vertex projects, clamped to the segment.
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((gx - a.x) * dx + (gy - a.y) * dy) / lenSq));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const d2 = (gx - px) ** 2 + (gy - py) ** 2;
    if (d2 < best.d2) {
      best = { d2, y: a.surfaceY + (b.surfaceY - a.surfaceY) * t };
    }
  }
  return best.y;
}

/**
 * Append earcut's triangles with every face pointing UP.
 *
 * Water was invisible everywhere in the game and this is why: earcut's winding
 * follows the input ring's orientation, and these rings come out clockwise, so
 * the triangles faced DOWN. Every vertex normal says (0,1,0), but back-face
 * culling goes by winding, not by the normal attribute — so a surface that
 * claimed to face up was culled from every camera above it. Measured in-game
 * 2026-07-28: rendering the water alone drew 0 pixels front-side and 24,864
 * double-sided.
 *
 * Orienting the geometry is the fix rather than switching the material to
 * DoubleSide: a sheet drawn from both sides is two sets of faces at one depth,
 * which is the z-fighting trap that already bit the town walls and gates.
 */
export function pushUpwardTriangles(
  tris: number[],
  startVert: number,
  positions: number[],
  indices: number[],
): void {
  for (let t = 0; t + 2 < tris.length; t += 3) {
    const a = startVert + tris[t];
    const b = startVert + tris[t + 1];
    const c = startVert + tris[t + 2];
    // Cross product's Y component decides which way the face looks. Reading the
    // emitted positions avoids reasoning about the 2D winding convention.
    const ax = positions[a * 3];
    const az = positions[a * 3 + 2];
    const bx = positions[b * 3];
    const bz = positions[b * 3 + 2];
    const cx = positions[c * 3];
    const cz = positions[c * 3 + 2];
    const normalY = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    // In a right-handed Y-up frame a face points up when this term is negative.
    if (normalY <= 0) indices.push(a, b, c);
    else indices.push(a, c, b);
  }
}

function emitLake(
  lake: NonNullable<ChunkData['lakes']>[number],
  data: ChunkData,
  positions: number[],
  normals: number[],
  colors: number[],
  flow: number[],
): void {
  // Sea surfaces are already AT their true height (zero) and must not be pushed
  // under their own floor; the legacy buried offset applies to the old flat
  // lake path only: a body with NO kind. A `lake` (a hydrology basin filled to
  // its spill level) took it too, which sank every pond 0.55 m below its own
  // level, and a basin needs only 0.5 m of depth to fill (agora-257c, 2026-10-27).
  const drop = lake.kind === undefined ? LAKE_DROP_M : 0;
  lake.points.forEach((p, i) => {
    const local = gridPointToLocal(p.x, p.y, data.cx, data.cy);
    const y = waterSurfaceYAt(lake, p.x, p.y) - drop;
    positions.push(local.x, y, local.z);
    normals.push(0, 1, 0);
    // Depth against the SHALLOWER of the loader's full-grid bed and the ground
    // this chunk actually draws. A far chunk draws a vertex every 4 to 8 m and
    // cannot hold a 10 m pool 0.5 m deep: measured against the fine bed alone,
    // the pool stood over flat drawn ground as a hard-edged staircase of grid
    // squares (Remy, 17,4, 2026-10-28). Up close the drawn ground holds the
    // basin and the pool shows at its full depth.
    const drawn = waterHeightAt(data, p.x, p.y);
    pushDepthEncoding(colors, y - Math.max(lake.bedY?.[i] ?? drawn, drawn));
    const f = lakeFlowAt(lake, p.x, p.y);
    flow.push(f.x, f.z);
  });
}

/**
 * A body with inner samples (2026-10-30; the loader's `townWaterFill`): its
 * fine outline plus its inner points, filled with a Delaunay mesh. Each vertex
 * takes its height and depth by the same rules as an outline vertex (the
 * body's surface at that point; depth against the shallower of the fine bed and
 * the drawn ground), so the deep channel goes dark and opaque and only the true
 * shore fades. Delaunay fills the points' convex hull, so a triangle whose
 * center falls outside the outline is dropped, and so is a triangle over dry
 * ground (all three vertices at or above the water): that one would only stand
 * as a flat sheet over a bank, invisible at best.
 */
function emitFilledBody(
  lake: NonNullable<ChunkData['lakes']>[number],
  data: ChunkData,
  positions: number[],
  indices: number[],
  normals: number[],
  colors: number[],
  flow: number[],
): void {
  const pts = [...lake.points, ...(lake.interior ?? [])];
  const beds = [...(lake.bedY ?? []), ...(lake.interiorBedY ?? [])];
  const drop = lake.kind === undefined ? LAKE_DROP_M : 0;
  const startVert = positions.length / 3;
  const coords = new Float64Array(pts.length * 2);
  const depth: number[] = [];
  pts.forEach((p, i) => {
    const local = gridPointToLocal(p.x, p.y, data.cx, data.cy);
    coords[i * 2] = local.x;
    coords[i * 2 + 1] = local.z;
    const y = waterSurfaceYAt(lake, p.x, p.y) - drop;
    positions.push(local.x, y, local.z);
    normals.push(0, 1, 0);
    const drawn = waterHeightAt(data, p.x, p.y);
    const d = y - Math.max(beds[i] ?? drawn, drawn);
    depth.push(d);
    pushDepthEncoding(colors, d);
    const f = lakeFlowAt(lake, p.x, p.y);
    flow.push(f.x, f.z);
  });
  if (pts.length < 3) return;
  const tri = new Delaunator(coords).triangles;
  const ring = lake.points;
  const insideRing = (gx: number, gy: number): boolean => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i], b = ring[j];
      if ((a.y > gy) !== (b.y > gy) && gx < ((b.x - a.x) * (gy - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  };
  const kept: number[] = [];
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t], b = tri[t + 1], c = tri[t + 2];
    if (depth[a] <= 0 && depth[b] <= 0 && depth[c] <= 0) continue;
    const gx = (pts[a].x + pts[b].x + pts[c].x) / 3;
    const gy = (pts[a].y + pts[b].y + pts[c].y) / 3;
    if (!insideRing(gx, gy)) continue;
    kept.push(a, b, c);
  }
  pushUpwardTriangles(kept, startVert, positions, indices);
}

/**
 * Flow of a lake-polygon vertex. A town river drawn as a polygon flows along
 * its centerline segment nearest the vertex; still water does not flow.
 */
function lakeFlowAt(
  lake: NonNullable<ChunkData['lakes']>[number],
  gx: number,
  gy: number,
): { x: number; z: number } {
  const line = lake.centerline;
  if (lake.kind !== 'river' || !line || line.length < 2) return { x: 0, z: 0 };
  let best = { d2: Infinity, i: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((gx - a.x) * dx + (gy - a.y) * dy) / lenSq));
    const d2 = (gx - a.x - dx * t) ** 2 + (gy - a.y - dy * t) ** 2;
    if (d2 < best.d2) best = { d2, i };
  }
  const a = line[best.i];
  const b = line[best.i + 1];
  return riverFlow(b.x - a.x, b.y - a.y, a.surfaceY - b.surfaceY);
}

/**
 * Surface flow along a river step: direction in world x/z, speed from the
 * waterline slope. dgx/dgy are grid units; dropM is the fall over the step.
 */
function riverFlow(dgx: number, dgy: number, dropM: number): { x: number; z: number } {
  const lenM = Math.hypot(dgx, dgy) * M;
  if (lenM === 0) return { x: 0, z: 0 };
  const slope = Math.max(0, dropM) / lenM;
  const speed = Math.min(RIVER_MAX_SPEED_MPS, RIVER_BASE_SPEED_MPS + RIVER_SPEED_PER_SLOPE * slope);
  return { x: ((dgx * M) / lenM) * speed, z: ((dgy * M) / lenM) * speed };
}

function emitRibbon(
  ribbon: ClippedPolyline,
  data: ChunkData,
  positions: number[],
  normals: number[],
  colors: number[],
  flow: number[],
): { rows: number; depth: number[] } {
  const pts = ribbon.points;
  // Per polyline point: direction, half width, surface height and flow.
  const at = pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dirX = (next.x - prev.x) * M;
    const dirZ = (next.y - prev.y) * M;
    const len = Math.hypot(dirX, dirZ) || 1;
    // Ground-mode chunks carry the authoritative per-point surface. Older
    // callers remain byte-compatible by falling back to their original bed
    // sample and drop when no shared waterline is present.
    const sharedWaterlineY = ribbon.waterlineY?.[i];
    const y = typeof sharedWaterlineY === 'number' && Number.isFinite(sharedWaterlineY)
      ? sharedWaterlineY
      : waterHeightAt(data, p.x, p.y) - LEGACY_RIVER_DROP_M;
    // The waterline falls from prev to next; that slope sets the speed.
    const prevY = ribbon.waterlineY?.[Math.max(0, i - 1)];
    const nextY = ribbon.waterlineY?.[Math.min(pts.length - 1, i + 1)];
    const dropM = typeof prevY === 'number' && typeof nextY === 'number' ? prevY - nextY : 0;
    return {
      perpX: -dirZ / len,
      perpZ: dirX / len,
      halfW: ((ribbon.width[i] ?? 0.01) * M) / 2,
      y,
      f: riverFlow(next.x - prev.x, next.y - prev.y, dropM),
    };
  });

  const depth: number[] = [];
  let rows = 0;
  // One row of RIBBON_ACROSS vertices at segment i, fraction t toward i + 1.
  const row = (i: number, t: number): void => {
    const a = at[i];
    const b = at[Math.min(at.length - 1, i + 1)];
    const pa = pts[i];
    const pb = pts[Math.min(pts.length - 1, i + 1)];
    const gx = pa.x + (pb.x - pa.x) * t;
    const gy = pa.y + (pb.y - pa.y) * t;
    let perpX = a.perpX + (b.perpX - a.perpX) * t;
    let perpZ = a.perpZ + (b.perpZ - a.perpZ) * t;
    const pl = Math.hypot(perpX, perpZ) || 1;
    perpX /= pl;
    perpZ /= pl;
    const halfW = a.halfW + (b.halfW - a.halfW) * t;
    const y = a.y + (b.y - a.y) * t;
    const fx = a.f.x + (b.f.x - a.f.x) * t;
    const fz = a.f.z + (b.f.z - a.f.z) * t;
    const local = gridPointToLocal(gx, gy, data.cx, data.cy);
    // Read the native source bed under each ribbon vertex, independent of
    // display LOD. Legacy and out-of-source samples retain the drawn grid.
    // This preserves authored vertices and the existing any-wet-vertex mask.
    const halfGrid = halfW / M;
    for (let k = 0; k < RIBBON_ACROSS; k++) {
      const s = (2 * k) / (RIBBON_ACROSS - 1) - 1; // -1 left bank .. +1 right bank
      positions.push(local.x + perpX * halfW * s, y, local.z + perpZ * halfW * s);
      normals.push(0, 1, 0);
      const d = y - (ribbon.waterlineY?.length === ribbon.points.length
        ? ribbonBedHeightAt(data, gx + perpX * halfGrid * s, gy + perpZ * halfGrid * s,
          () => drawnHeightAt(data, gx + perpX * halfGrid * s, gy + perpZ * halfGrid * s))
        : drawnHeightAt(data, gx + perpX * halfGrid * s, gy + perpZ * halfGrid * s));
      depth.push(d);
      pushDepthEncoding(colors, d);
      flow.push(fx, fz);
    }
    rows += 1;
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const segM = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) * M;
    const k = Math.max(1, Math.ceil(segM / RIBBON_ROW_STEP_M));
    for (let j = 0; j < k; j++) row(i, j / k);
  }
  if (pts.length > 0) row(pts.length - 1, 0);
  return { rows, depth };
}

/**
 * The drawn ground height at a grid point, read bilinearly from the chunk's
 * own height samples (2026-10-30; the ribbon's depth). `waterHeightAt` keeps
 * the nearest sample for its older callers.
 */
function drawnHeightAt(data: ChunkData, gx: number, gy: number): number {
  const res = data.resolution;
  const span = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / M;
  if (res < 2 || span === 0) return waterHeightAt(data, gx, gy);
  const fx = Math.max(0, Math.min(res - 1, ((gx - data.cx * span) / span) * (res - 1)));
  const fy = Math.max(0, Math.min(res - 1, ((gy - data.cy * span) / span) * (res - 1)));
  const i = Math.min(res - 2, Math.floor(fx));
  const j = Math.min(res - 2, Math.floor(fy));
  const tx = fx - i, ty = fy - j;
  const h = (c: number, r: number) => heightToMeters(data.heights[r * res + c]);
  return (h(i, j) * (1 - tx) + h(i + 1, j) * tx) * (1 - ty) + (h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx) * ty;
}

function waterHeightAt(data: ChunkData, gx: number, gy: number): number {
  const res = data.resolution;
  const span = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / M;
  const minGX = data.cx * span;
  const minGY = data.cy * span;
  const tx = span === 0 ? 0 : (gx - minGX) / span;
  const ty = span === 0 ? 0 : (gy - minGY) / span;
  const i = Math.max(0, Math.min(res - 1, Math.round(tx * (res - 1))));
  const j = Math.max(0, Math.min(res - 1, Math.round(ty * (res - 1))));
  return heightToMeters(data.heights[j * res + i]);
}
