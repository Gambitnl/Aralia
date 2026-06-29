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

/**
 * Per-kind vertex tint (TG5). A dock is weathered, oiled timber decking; a bridge
 * reads as lighter dressed-stone/pale planking spanning the channel. Carried as
 * vertex colors so docks and bridges share one mesh/material yet stay visually
 * distinct — a quay must not look like a bridge span.
 */
const DECK_COLOR: Record<'dock' | 'bridge', [number, number, number]> = {
  // #5a3a22 — darker, browner weathered dock timber.
  dock: [0x5a / 255, 0x3a / 255, 0x22 / 255],
  // #c8b89c — pale dressed stone / sun-bleached bridge planking.
  bridge: [0xc8 / 255, 0xb8 / 255, 0x9c / 255],
};

/** Deck meshes carry per-vertex colors so DeckPiece renders with `vertexColors`. */
type DeckMesh = ChunkGeometryArrays & { colors: Float32Array };

const EMPTY: DeckMesh = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
  colors: new Float32Array(0),
};

export function buildDeckMesh(data: ChunkData): DeckMesh {
  const decks = (data.decks ?? []).filter((d) => d.points.length >= 3);
  if (decks.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  for (const deck of decks) {
    const top = deck.topY;
    const bot = deck.topY - DECK_THICK_M;
    const [cr, cg, cb] = DECK_COLOR[deck.kind];
    const pushColor = () => colors.push(cr, cg, cb);
    const local = deck.points.map((p) => gridPointToLocal(p.x, p.y, data.cx, data.cy));
    const n = local.length;

    // Top face — triangle fan, emitted both windings so it shows from above.
    const topBase = positions.length / 3;
    for (const l of local) { positions.push(l.x, top, l.z); normals.push(0, 1, 0); pushColor(); }
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
      positions.push(a.x, top, a.z); normals.push(nx, 0, nz); pushColor();
      positions.push(a.x, bot, a.z); normals.push(nx, 0, nz); pushColor();
      positions.push(b.x, top, b.z); normals.push(nx, 0, nz); pushColor();
      positions.push(b.x, bot, b.z); normals.push(nx, 0, nz); pushColor();
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
