// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:30:57
 * Dependents: systems/world3d/chunkBundle.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file waterGeometry.ts
 * Build visible water surfaces for clipped rivers and lake polygons. Ground
 * rivers arrive with a loader-computed waterline that crossings can query too,
 * so this file renders that shared truth instead of hiding a second guessed
 * ribbon beneath the carved bed. Legacy continent rivers keep their previous
 * terrain-following fallback. Output is chunk-local.
 */
import type { ChunkData, ChunkGeometryArrays, ClippedPolyline } from './types';
import earcut from 'earcut';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { gridPointToLocal } from './coords';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
// Legacy continent rivers do not yet carry the ground-mode waterline contract.
// Keep their historical buried offset rather than changing a separate renderer
// as a side effect of this walking-scale feature.
const LEGACY_RIVER_DROP_M = 0.5;
const LAKE_DROP_M = LEGACY_RIVER_DROP_M + 0.05;

const EMPTY: ChunkGeometryArrays = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
};

export function buildWaterMesh(data: ChunkData): ChunkGeometryArrays {
  const lakes = data.lakes?.filter((l) => l.points.length >= 3) ?? [];
  const ribbons = data.rivers.filter((r) => r.points.length >= 2);
  if (lakes.length === 0 && ribbons.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (const lake of lakes) {
    const startVert = positions.length / 3;
    emitLake(lake, data, positions, normals);
    const flat: number[] = [];
    for (const p of lake.points) {
      const local = gridPointToLocal(p.x, p.y, data.cx, data.cy);
      flat.push(local.x, local.z);
    }
    pushUpwardTriangles(earcut(flat), startVert, positions, indices);
  }

  for (const ribbon of ribbons) {
    const startVert = positions.length / 3;
    emitRibbon(ribbon, data, positions, normals);
    const ptCount = ribbon.points.length;
    for (let i = 0; i < ptCount - 1; i++) {
      const l0 = startVert + i * 2;
      const r0 = l0 + 1;
      const l1 = startVert + (i + 1) * 2;
      const r1 = l1 + 1;
      indices.push(l0, l1, r0, r0, l1, r1);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
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
): void {
  // Sea surfaces are already AT their true height (zero) and must not be pushed
  // under their own floor; the legacy buried offset applies to the old flat
  // lake path only.
  const drop = lake.kind === 'sea' || lake.kind === 'river' ? 0 : LAKE_DROP_M;
  for (const p of lake.points) {
    const local = gridPointToLocal(p.x, p.y, data.cx, data.cy);
    positions.push(local.x, waterSurfaceYAt(lake, p.x, p.y) - drop, local.z);
    normals.push(0, 1, 0);
  }
}

function emitRibbon(
  ribbon: ClippedPolyline,
  data: ChunkData,
  positions: number[],
  normals: number[],
): void {
  const pts = ribbon.points;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dirX = (next.x - prev.x) * M;
    const dirZ = (next.y - prev.y) * M;
    const len = Math.hypot(dirX, dirZ) || 1;
    const perpX = -dirZ / len;
    const perpZ = dirX / len;
    const halfW = ((ribbon.width[i] ?? 0.01) * M) / 2;

    const local = gridPointToLocal(p.x, p.y, data.cx, data.cy);
    // Ground-mode chunks carry the authoritative per-point surface. Older
    // callers remain byte-compatible by falling back to their original bed
    // sample and drop when no shared waterline is present.
    const sharedWaterlineY = ribbon.waterlineY?.[i];
    const y = typeof sharedWaterlineY === 'number' && Number.isFinite(sharedWaterlineY)
      ? sharedWaterlineY
      : waterHeightAt(data, p.x, p.y) - LEGACY_RIVER_DROP_M;

    positions.push(local.x - perpX * halfW, y, local.z - perpZ * halfW);
    normals.push(0, 1, 0);
    positions.push(local.x + perpX * halfW, y, local.z + perpZ * halfW);
    normals.push(0, 1, 0);
  }
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
