/**
 * @file wallGeometry.ts
 * Build vertical wall meshes along clipped town wall-ring polylines (Worldforge
 * Option B). Where roadGeometry lays a flat ribbon on the ground, this extrudes
 * each segment UPWARD into a two-sided stone barrier: bottom edge at the terrain
 * surface, top edge at WALL_HEIGHT_M above it. Mirrors roadGeometry's segment
 * walk so the two stay structurally parallel.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { gridPointToLocal } from './coords';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const WALL_HEIGHT_M = 3.2;   // a touch over two storeys — reads as a town rampart
const WALL_BASE_SINK_M = 0.4; // sink the footing so it meets sloped ground cleanly

/** Legacy weathered-stone tint for wall runs that carry no style-family color. */
const DEFAULT_WALL_HEX = '#9a9387';

/** Wall meshes carry per-vertex colors so WallPiece renders with `vertexColors`. */
type WallMesh = ChunkGeometryArrays & { colors: Float32Array };

const EMPTY: WallMesh = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
  colors: new Float32Array(0),
};

export function buildWallMesh(data: ChunkData): WallMesh {
  // Each entry is an OPEN polyline run: consecutive points become wall segments
  // and NO closing segment is added. A walled town arrives either as one closed
  // run (first point repeated) or, where a river crosses the ring, as several
  // open runs that leave a gap around each water-gate (TG7, split upstream in
  // groundChunkLoader). The gap reads as an arch/portcullis break so the river
  // passes through a gate instead of clipping solid stone.
  const rings = (data.walls ?? []).filter((r) => r.points.length >= 2);
  if (rings.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  for (const ring of rings) {
    // Per-run style-family tint (styled-architecture slice) as vertex colors,
    // mirroring deckGeometry's hex→rgb: each town's ramparts read in its own
    // stone under one shared vertex-colored material.
    const hex = ring.colorHex ?? DEFAULT_WALL_HEX;
    const cr = parseInt(hex.slice(1, 3), 16) / 255;
    const cg = parseInt(hex.slice(3, 5), 16) / 255;
    const cb = parseInt(hex.slice(5, 7), 16) / 255;
    const pts = ring.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const la = gridPointToLocal(a.x, a.y, data.cx, data.cy);
      const lb = gridPointToLocal(b.x, b.y, data.cx, data.cy);
      const ya = heightAt(data, a.x, a.y) - WALL_BASE_SINK_M;
      const yb = heightAt(data, b.x, b.y) - WALL_BASE_SINK_M;

      // Segment normal (horizontal), for flat lighting on the wall face.
      const dx = lb.x - la.x;
      const dz = lb.z - la.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const base = positions.length / 3;
      // 4 verts: a-bottom, a-top, b-bottom, b-top.
      positions.push(la.x, ya, la.z);                  normals.push(nx, 0, nz); colors.push(cr, cg, cb);
      positions.push(la.x, ya + WALL_HEIGHT_M, la.z);  normals.push(nx, 0, nz); colors.push(cr, cg, cb);
      positions.push(lb.x, yb, lb.z);                  normals.push(nx, 0, nz); colors.push(cr, cg, cb);
      positions.push(lb.x, yb + WALL_HEIGHT_M, lb.z);  normals.push(nx, 0, nz); colors.push(cr, cg, cb);
      // Two triangles, emitted both windings so the barrier shows from inside
      // and outside the ring without back-face culling artifacts.
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      indices.push(base + 2, base + 1, base, base + 3, base + 1, base + 2);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
  };
}

function heightAt(data: ChunkData, gx: number, gy: number): number {
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
