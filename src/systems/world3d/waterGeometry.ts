// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:48:54
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
 * Build flat ribbon meshes along clipped river polylines. Each polyline point
 * produces a left/right vertex pair offset perpendicular to the local direction
 * by half the river width (grid→meters). Lake polygons are filled as flat
 * triangulated surfaces first, so the river ribbons can still read on top.
 * Output is chunk-local.
 */
import type { ChunkData, ChunkGeometryArrays, ClippedPolyline } from './types';
import earcut from 'earcut';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { gridPointToLocal } from './coords';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const WATER_DROP_M = 0.5;
const LAKE_DROP_M = WATER_DROP_M + 0.05;

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
    for (const index of earcut(flat)) indices.push(startVert + index);
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

function emitLake(
  lake: NonNullable<ChunkData['lakes']>[number],
  data: ChunkData,
  positions: number[],
  normals: number[],
): void {
  for (const p of lake.points) {
    const local = gridPointToLocal(p.x, p.y, data.cx, data.cy);
    positions.push(local.x, lake.surfaceY - LAKE_DROP_M, local.z);
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
    const y = waterHeightAt(data, p.x, p.y) - WATER_DROP_M;

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
