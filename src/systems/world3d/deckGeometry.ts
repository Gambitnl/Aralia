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
const PILING_DEPTH_M = 3; // square posts drop this far below the slab underside
const PILING_SIDE_M = 0.25; // post cross-section
const RAIL_HEIGHT_M = 1.0; // railing box standing on the deck top
const RAIL_THICK_M = 0.15; // railing thickness across the edge
const ARCH_STRIPS = 8; // longitudinal slices for an arched bridge top

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

    /** Push an axis-yawed box (base at baseY) into the shared arrays — cribbed
     * from gateGeometry.pushBox; both windings, no back-face culling artifacts. */
    const pushBox = (
      bx: number, bz: number, baseY: number,
      w: number, h: number, d: number, ang: number,
      color: [number, number, number],
    ) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      const corners: Array<[number, number]> = ([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] as Array<[number, number]>)
        .map(([x, z]) => [bx + x * c - z * s, bz + x * s + z * c]);
      const base = positions.length / 3;
      for (const y of [baseY, baseY + h]) {
        for (const [x, z] of corners) { positions.push(x, y, z); normals.push(0, 1, 0); colors.push(...color); }
      }
      const quad = (a: number, b: number, cc: number, dd: number) => {
        indices.push(a, b, cc, cc, dd, a, cc, b, a, a, dd, cc);
      };
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        quad(base + i, base + j, base + 4 + j, base + 4 + i);
      }
      quad(base + 4, base + 5, base + 6, base + 7); // top
      quad(base + 3, base + 2, base + 1, base + 0); // bottom (posts are seen from below the deck)
    };

    const detail = deck.detail;
    const arched = deck.kind === 'bridge' && !!detail && detail.archRiseM > 0 && n === 4;

    if (!arched) {
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

    if (detail && n === 4) {
      // Long-axis: compare |edge 0→1| vs |edge 1→2| and take the longer pair of
      // opposite edges — corner winding varies by producer, so never assume it.
      const elen = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(b.x - a.x, b.z - a.z);
      const e01 = elen(local[0], local[1]);
      const e12 = elen(local[1], local[2]);
      // Two long edges as [start, end] pairs running the SAME direction, so a
      // shared parameter t sweeps both sides of the span in step.
      const longEdges: Array<[{ x: number; z: number }, { x: number; z: number }]> = e01 >= e12
        ? [[local[0], local[1]], [local[3], local[2]]]
        : [[local[1], local[2]], [local[0], local[3]]];

      const lerp = (a: { x: number; z: number }, b: { x: number; z: number }, t: number) =>
        ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      const rise = arched ? detail.archRiseM : 0;
      const lift = (t: number) => rise * 4 * t * (1 - t);

      if (arched) {
        // Arched bridge — replace the flat fan with strips along the long axis;
        // the top lifts by archRiseM·4t(1−t), peaking mid-span.
        const [edgeA, edgeB] = longEdges;
        for (let i = 0; i < ARCH_STRIPS; i++) {
          const t0 = i / ARCH_STRIPS, t1 = (i + 1) / ARCH_STRIPS;
          const a0 = lerp(edgeA[0], edgeA[1], t0), b0 = lerp(edgeB[0], edgeB[1], t0);
          const a1 = lerp(edgeA[0], edgeA[1], t1), b1 = lerp(edgeB[0], edgeB[1], t1);
          const y0 = top + lift(t0), y1 = top + lift(t1);
          const base = positions.length / 3;
          positions.push(a0.x, y0, a0.z); normals.push(0, 1, 0); pushColor();
          positions.push(b0.x, y0, b0.z); normals.push(0, 1, 0); pushColor();
          positions.push(a1.x, y1, a1.z); normals.push(0, 1, 0); pushColor();
          positions.push(b1.x, y1, b1.z); normals.push(0, 1, 0); pushColor();
          // Strip quad, both windings.
          indices.push(base, base + 1, base + 3, base + 3, base + 2, base);
          indices.push(base + 3, base + 1, base, base, base + 2, base + 3);
          // Per-slice side skirts along both long edges, down to the slab underside.
          for (const [p0, y0e, p1, y1e] of [
            [a0, y0, a1, y1] as const,
            [b0, y0, b1, y1] as const,
          ]) {
            const sb = positions.length / 3;
            const dx = p1.x - p0.x, dz = p1.z - p0.z;
            const len = Math.hypot(dx, dz) || 1;
            const nx = -dz / len, nz = dx / len;
            positions.push(p0.x, y0e, p0.z); normals.push(nx, 0, nz); pushColor();
            positions.push(p0.x, bot, p0.z); normals.push(nx, 0, nz); pushColor();
            positions.push(p1.x, y1e, p1.z); normals.push(nx, 0, nz); pushColor();
            positions.push(p1.x, bot, p1.z); normals.push(nx, 0, nz); pushColor();
            indices.push(sb, sb + 1, sb + 2, sb + 2, sb + 1, sb + 3);
            indices.push(sb + 2, sb + 1, sb, sb + 3, sb + 1, sb + 2);
          }
        }
        // End skirts across the two short edges (lift is 0 at t=0 and t=1).
        for (const [a, b] of [[edgeA[0], edgeB[0]], [edgeA[1], edgeB[1]]] as const) {
          const sb = positions.length / 3;
          const dx = b.x - a.x, dz = b.z - a.z;
          const len = Math.hypot(dx, dz) || 1;
          const nx = -dz / len, nz = dx / len;
          positions.push(a.x, top, a.z); normals.push(nx, 0, nz); pushColor();
          positions.push(a.x, bot, a.z); normals.push(nx, 0, nz); pushColor();
          positions.push(b.x, top, b.z); normals.push(nx, 0, nz); pushColor();
          positions.push(b.x, bot, b.z); normals.push(nx, 0, nz); pushColor();
          indices.push(sb, sb + 1, sb + 2, sb + 2, sb + 1, sb + 3);
          indices.push(sb + 2, sb + 1, sb, sb + 3, sb + 1, sb + 2);
        }
      }

      // Pilings — square posts marching along both long edges (docks AND bridges).
      if (detail.pilingSpacingM > 0) {
        const postColor: [number, number, number] = [cr * 0.8, cg * 0.8, cb * 0.8];
        for (const [a, b] of longEdges) {
          const edgeLen = elen(a, b);
          const posts = Math.max(2, Math.round(edgeLen / detail.pilingSpacingM));
          for (let k = 0; k <= posts; k++) {
            const p = lerp(a, b, k / posts);
            pushBox(p.x, p.z, bot - PILING_DEPTH_M, PILING_SIDE_M, PILING_DEPTH_M, PILING_SIDE_M, 0, postColor);
          }
        }
      }

      // Railings — thin boxes along each long edge, standing on the deck top.
      if (detail.railing) {
        const railColor: [number, number, number] = [
          Math.min(1, cr * 1.1), Math.min(1, cg * 1.1), Math.min(1, cb * 1.1),
        ];
        for (const [a, b] of longEdges) {
          const yaw = Math.atan2(b.z - a.z, b.x - a.x);
          if (arched) {
            // Arched bridge — the rail follows the deck: one segment per arch
            // strip, each based on that slice's lifted top (river/coastal styles
            // pair railing:true with archRiseM>0, so a single flat rail at topY
            // would clip through a 1.5 m arch mid-span).
            for (let i = 0; i < ARCH_STRIPS; i++) {
              const t0 = i / ARCH_STRIPS, t1 = (i + 1) / ARCH_STRIPS;
              const p0 = lerp(a, b, t0), p1 = lerp(a, b, t1);
              const segLen = Math.hypot(p1.x - p0.x, p1.z - p0.z);
              const mid = lerp(a, b, (t0 + t1) / 2);
              pushBox(mid.x, mid.z, top + lift((t0 + t1) / 2), segLen, RAIL_HEIGHT_M, RAIL_THICK_M, yaw, railColor);
            }
          } else {
            const edgeLen = elen(a, b);
            const mid = lerp(a, b, 0.5);
            pushBox(mid.x, mid.z, top, edgeLen, RAIL_HEIGHT_M, RAIL_THICK_M, yaw, railColor);
          }
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
  };
}
