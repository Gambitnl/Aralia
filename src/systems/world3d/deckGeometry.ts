/**
 * @file deckGeometry.ts
 * Build low timber-slab meshes for town dock piers and bridge spans (Worldforge
 * Option B). Each deck is a flat convex quad whose top sits at a given world-Y
 * (just above the town water surface); we fan-triangulate the top face and drop
 * a short vertical skirt around the rim so the slab reads with thickness from
 * the side. Mirrors wallGeometry's chunk-local segment walk.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
import { gridPointToLocal } from './coords';

const DECK_THICK_M = 0.45; // slab thickness — a plank deck standing just off the water

const EMPTY: ChunkGeometryArrays = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
};

export function buildDeckMesh(data: ChunkData): ChunkGeometryArrays {
  const decks = (data.decks ?? []).filter((d) => d.points.length >= 3);
  if (decks.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (const deck of decks) {
    const top = deck.topY;
    const bot = deck.topY - DECK_THICK_M;
    const local = deck.points.map((p) => gridPointToLocal(p.x, p.y, data.cx, data.cy));
    const n = local.length;

    // Top face — triangle fan, emitted both windings so it shows from above.
    const topBase = positions.length / 3;
    for (const l of local) { positions.push(l.x, top, l.z); normals.push(0, 1, 0); }
    for (let i = 1; i < n - 1; i++) {
      indices.push(topBase, topBase + i, topBase + i + 1);
      indices.push(topBase, topBase + i + 1, topBase + i);
    }

    // Skirt — a vertical quad per rim edge, two-sided.
    for (let i = 0; i < n; i++) {
      const a = local[i];
      const b = local[(i + 1) % n];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const base = positions.length / 3;
      positions.push(a.x, top, a.z); normals.push(nx, 0, nz);
      positions.push(a.x, bot, a.z); normals.push(nx, 0, nz);
      positions.push(b.x, top, b.z); normals.push(nx, 0, nz);
      positions.push(b.x, bot, b.z); normals.push(nx, 0, nz);
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      indices.push(base + 2, base + 1, base, base + 3, base + 1, base + 2);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}
