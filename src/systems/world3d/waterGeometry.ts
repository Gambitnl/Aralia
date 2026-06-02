/**
 * @file waterGeometry.ts
 * Build flat ribbon meshes along clipped river polylines. Each polyline point
 * produces a left/right vertex pair offset perpendicular to the local direction
 * by half the river width (grid→meters). Output is chunk-local.
 */
import type { ChunkData, ChunkGeometryArrays, ClippedPolyline } from './types';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { gridPointToLocal } from './coords';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const WATER_DROP_M = 0.5;

const EMPTY: ChunkGeometryArrays = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
};

export function buildWaterMesh(data: ChunkData): ChunkGeometryArrays {
  const ribbons = data.rivers.filter((r) => r.points.length >= 2);
  if (ribbons.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

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
