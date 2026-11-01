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
const WALL_HEIGHT_M = 5.2;   // includes the buried footing: 4.8 m above ground
const WALL_HALF_WIDTH_M = 1.2;
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
    // ONE BAND PER RUN, MITERED AT EVERY BEND (agora-257c, 2026-10-28). Each
    // segment used to be its own box: at a bend the outer faces left a wedge
    // gap and the inner faces crossed, so the corners of the ring looked broken
    // (Remy: "city walls don't properly attach"). Now every point carries one
    // offset along the bisector of its two segments, so the faces of adjacent
    // segments meet on a shared edge. End caps close only a run's real ends
    // (a gate gap or a chunk border); a closed ring miters its seam too.
    let pts = ring.points;
    const first = pts[0], last = pts[pts.length - 1];
    const closed = pts.length > 3 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-6;
    if (closed) pts = pts.slice(0, -1);
    const n = pts.length;
    const L = pts.map((p) => gridPointToLocal(p.x, p.y, data.cx, data.cy));
    const Y = pts.map((p) => heightAt(data, p.x, p.y) - WALL_BASE_SINK_M);
    const segCount = closed ? n : n - 1;
    // Horizontal normal of each segment (left of its direction).
    const segN = Array.from({ length: segCount }, (_, s) => {
      const a = L[s], b = L[(s + 1) % n];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
    });
    const h = WALL_HALF_WIDTH_M;
    // Offset of each point: the miter of its two segments, or its one segment's
    // normal at an open end. The 1/cos stretch is capped so a hairpin stays sane.
    const off = L.map((_, i) => {
      const prev = closed ? segN[(i - 1 + segCount) % segCount] : segN[i - 1];
      const next = closed ? segN[i % segCount] : segN[i];
      const a = prev ?? next!, b = next ?? prev!;
      let mx = a.x + b.x, mz = a.z + b.z;
      const ml = Math.hypot(mx, mz);
      if (ml < 1e-6) { mx = b.x; mz = b.z; } else { mx /= ml; mz /= ml; }
      const cos = Math.max(0.35, mx * b.x + mz * b.z);
      return { x: (mx * h) / cos, z: (mz * h) / cos };
    });
    const corner = (i: number, side: 1 | -1, top: boolean): number[] => [
      L[i].x + side * off[i].x,
      Y[i] + (top ? WALL_HEIGHT_M : 0),
      L[i].z + side * off[i].z,
    ];
    /** Push a quad wound so its face looks along `normal`. */
    const quad = (q: number[][], normal: number[]) => {
      const base = positions.length / 3;
      const u = q[1].map((v, j) => v - q[0][j]), v = q[2].map((w, j) => w - q[0][j]);
      const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const order = c[0] * normal[0] + c[1] * normal[1] + c[2] * normal[2] >= 0 ? [0, 1, 2, 3] : [3, 2, 1, 0];
      for (const k of order) {
        positions.push(...q[k]);
        normals.push(...normal);
        colors.push(cr, cg, cb);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    for (let s = 0; s < segCount; s++) {
      const i = s, j = (s + 1) % n;
      const N = segN[s];
      // Outer (+normal) side, inner (-normal) side, top, bottom.
      quad([corner(i, 1, false), corner(j, 1, false), corner(j, 1, true), corner(i, 1, true)], [N.x, 0, N.z]);
      quad([corner(i, -1, false), corner(i, -1, true), corner(j, -1, true), corner(j, -1, false)], [-N.x, 0, -N.z]);
      quad([corner(i, 1, true), corner(j, 1, true), corner(j, -1, true), corner(i, -1, true)], [0, 1, 0]);
      quad([corner(i, 1, false), corner(i, -1, false), corner(j, -1, false), corner(j, 1, false)], [0, -1, 0]);
    }
    if (!closed) {
      // End caps at the run's two real ends, facing out along the run.
      const capAt = (i: number, dir: number) => {
        const s = i === 0 ? 0 : segCount - 1;
        const a = L[s], b = L[s + 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const t = [((b.x - a.x) / len) * dir, 0, ((b.z - a.z) / len) * dir];
        quad([corner(i, 1, false), corner(i, -1, false), corner(i, -1, true), corner(i, 1, true)], t);
      };
      capAt(0, -1);
      capAt(n - 1, 1);
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
