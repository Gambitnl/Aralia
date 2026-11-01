/**
 * @file deckGeometry.ts
 * Build low timber-slab meshes for town dock piers and bridge spans (Worldforge
 * Option B). Each deck is a flat convex quad whose top sits at a given world-Y
 * (just above the town water surface); we fan-triangulate the top face and drop
 * a short vertical skirt around the rim so the slab reads with thickness from
 * the side. Mirrors wallGeometry's chunk-local segment walk.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 22:08:38
 * Dependents: components/World3D/groundBuildingMotion.ts, systems/world3d/chunkBundle.ts, systems/worldforge/bridge/groundWaterSurfaceQuery.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ChunkData, ChunkGeometryArrays } from './types';
import { gridPointToLocal } from './coords';
import { WORLD3D_CONFIG, heightToMeters } from './config';

const DECK_THICK_M = 0.45; // slab thickness — a plank deck standing just off the water
const PILING_SIDE_M = 0.25; // post cross-section
const PILING_EMBED_M = 1.2; // post feet plant this deep under the sampled terrain
const PILING_MIN_CLEAR_M = 0.3; // no post where the bank is within this of the soffit
const RAIL_HEIGHT_M = 1.0; // railing box standing on the deck top
const RAIL_THICK_M = 0.15; // railing thickness across the edge
const RAIL_BURY_CLIP_M = 0.35; // drop a rail segment once the bank rises this far over its base
const ARCH_STRIPS = 8; // longitudinal slices for an arched bridge top
// Bridge-end abutment: a dressed-stone block that receives the deck into its
// bank (terrain-to-deck masonry), sized to shoulder past the deck on all sides.
const ABUT_LEN_M = 3.0; // along the span
const ABUT_REACH_UNDER_M = 1.0; // how much of that length tucks under the deck end
const ABUT_EXTRA_HALF_W_M = 0.5; // proud of the deck edge on each side
const ABUT_EMBED_M = 1.0; // block base sinks this far under the lowest sampled ground

/**
 * Per-kind vertex tint (TG5). A dock is weathered, oiled timber decking; a bridge
 * reads as lighter dressed-stone/pale planking spanning the channel. Carried as
 * vertex colors so docks and bridges share one mesh/material yet stay visually
 * distinct — a quay must not look like a bridge span.
 */
const DECK_COLOR: Record<'dock' | 'bridge' | 'ford' | 'fordStone', [number, number, number]> = {
  // #5a3a22 — darker, browner weathered dock timber.
  dock: [0x5a / 255, 0x3a / 255, 0x22 / 255],
  // #c8b89c — pale dressed stone / sun-bleached bridge planking.
  bridge: [0xc8 / 255, 0xb8 / 255, 0x9c / 255],
  // #b3a37d — wet-sand gravel bar of a ford. Darker than the 2D painter's dry
  // fill (#cebc8e) because 3D sun hits it at full strength; light enough to
  // stay readable against the water-tinted riverbed at tactical distance.
  ford: [0xb3 / 255, 0xa3 / 255, 0x7d / 255],
  // #5c554a — dark river-worn stepping stones against the pale bar.
  fordStone: [0x5c / 255, 0x55 / 255, 0x4a / 255],
};

/** Deck meshes carry per-vertex colors so DeckPiece renders with `vertexColors`. */
type DeckMesh = ChunkGeometryArrays & { colors: Float32Array; slabTopIndices?: Uint32Array };

const EMPTY: DeckMesh = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
  colors: new Float32Array(0),
};

type ClippedDeckVertex = { p: number[]; n: number[]; c: number[] };

/** Cut the finished bridge at the chunk boundary. Interpolating its existing
 * faces preserves one arch, rail layout and slab underside through the seam;
 * it creates no artificial end wall or abutment at that boundary. */
function appendClippedBridge(mesh: DeckMesh, positions: number[], indices: number[], normals: number[], colors: number[], slabTops?: number[]): void {
  const size = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const slabFaces = new Set<string>();
  const tops = mesh.slabTopIndices ?? [];
  for (let i = 0; i < tops.length; i += 3) slabFaces.add([tops[i], tops[i + 1], tops[i + 2]].join(','));
  const vertex = (index: number): ClippedDeckVertex => ({
    p: Array.from(mesh.positions.slice(index * 3, index * 3 + 3)),
    n: Array.from(mesh.normals.slice(index * 3, index * 3 + 3)),
    c: Array.from(mesh.colors.slice(index * 3, index * 3 + 3)),
  });
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const face = Array.from(mesh.indices.slice(t, t + 3));
    let polygon = face.map(vertex);
    for (const [axis, bound, sign] of [[0, 0, 1], [0, size, -1], [2, 0, 1], [2, size, -1]]) {
      const clipped: ClippedDeckVertex[] = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const da = (a.p[axis] - bound) * sign, db = (b.p[axis] - bound) * sign;
        if (da >= 0) clipped.push(a);
        if ((da >= 0) !== (db >= 0)) {
          const share = da / (da - db);
          const blend = (key: 'p' | 'n' | 'c') => a[key].map((v, k) => v + (b[key][k] - v) * share);
          const cut = { p: blend('p'), n: blend('n'), c: blend('c') };
          cut.p[axis] = bound;
          clipped.push(cut);
        }
      }
      polygon = clipped;
      if (polygon.length < 3) break;
    }
    for (let i = 1; i + 1 < polygon.length; i++) {
      const triangle = [polygon[0], polygon[i], polygon[i + 1]];
      const a = triangle[0].p, b = triangle[1].p, c = triangle[2].p;
      const u = b.map((v, k) => v - a[k]), v = c.map((value, k) => value - a[k]);
      if (Math.hypot(u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]) < 1e-10) continue;
      const base = positions.length / 3;
      for (const point of triangle) { positions.push(...point.p); normals.push(...point.n); colors.push(...point.c); }
      indices.push(base, base + 1, base + 2);
      if (slabFaces.has(face.join(','))) slabTops?.push(base, base + 1, base + 2);
    }
  }
}

export function buildDeckMesh(data: ChunkData): DeckMesh {
  const slabTops: number[] = [];
  const mesh = buildDeckGeometry(data, slabTops);
  // Worker structured-cloning retains this additive receipt alongside the
  // unchanged draw arrays. Walking must query the mounted mesh, not guess LOD.
  return { ...mesh, slabTopIndices: new Uint32Array(slabTops) };
}

// The optional receipt names only slab-top triangles. The renderer's arrays
// stay unchanged; walking can close the authored 0.45 m slab underneath them.
function buildDeckGeometry(data: ChunkData, slabTops?: number[]): DeckMesh {
  const decks = (data.decks ?? []).filter((d) => d.points.length >= 3);
  if (decks.length === 0) return EMPTY;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  // Rendered-terrain height (meters) at a chunk-local (x, z): bilinear over the
  // same welded heightfield buildTerrainMesh triangulates, so piling feet,
  // abutment bases, and rail burial checks track the visible ground. Decks are
  // clipped to the chunk rect, but abutments can poke past the border — clamp.
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const res = data.resolution;
  const terrainYAt = (x: number, z: number): number => {
    if (res < 2) return heightToMeters(data.heights[0] ?? 0);
    const fx = Math.max(0, Math.min(res - 1, (x / S) * (res - 1)));
    const fz = Math.max(0, Math.min(res - 1, (z / S) * (res - 1)));
    const i0 = Math.min(res - 2, Math.floor(fx));
    const j0 = Math.min(res - 2, Math.floor(fz));
    const tx = fx - i0;
    const tz = fz - j0;
    const h = (i: number, j: number) => data.heights[j * res + i] ?? 0;
    const near = h(i0, j0) * (1 - tx) + h(i0 + 1, j0) * tx;
    const far = h(i0, j0 + 1) * (1 - tx) + h(i0 + 1, j0 + 1) * tx;
    return heightToMeters(near * (1 - tz) + far * tz);
  };

  for (const deck of decks) {
    if (deck.kind === 'bridge' && deck.sourcePoints?.length === 4) {
      // A short clipped quad can be wider than it is long, and a five-corner
      // clip loses the old quad-only arch. Build from the original span first.
      // Existing callers without that packet retain their prior geometry.
      const complete = buildDeckMesh({ ...data, decks: [{ ...deck, points: deck.sourcePoints, sourcePoints: undefined }] });
      appendClippedBridge(complete, positions, indices, normals, colors, slabTops);
      continue;
    }
    const top = deck.topY;
    const bot = deck.topY - DECK_THICK_M;
    // Per-deck tint (ford wet/dry strips, stone jitter) wins over the kind color.
    const [cr, cg, cb] = deck.color ?? DECK_COLOR[deck.kind];
    const pushColor = () => colors.push(cr, cg, cb);
    const local = deck.points.map((p) => gridPointToLocal(p.x, p.y, data.cx, data.cy));
    const n = local.length;

    /** Push an axis-yawed box (base at baseY) into the shared arrays — cribbed
     * from gateGeometry.pushBox, but each face wound outward exactly once.
     * DoubleSide shows the far side; a second reversed copy would z-fight its
     * coplanar twin and flip the authored normal wherever it won the tie. */
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
        // Outward winding for this corner walk (sides get a→b bottom-to-top,
        // top gets 4→5→6→7, bottom gets 3→2→1→0).
        indices.push(cc, b, a, a, dd, cc);
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
      // Top face — triangle fan wound so its geometric normal points up,
      // matching the authored (0,1,0). Corner order varies by producer, so the
      // polygon's signed area decides the fan direction; DoubleSide shows the
      // underside. (A second reversed copy here z-fought its twin and shaded
      // the deck near-black from above wherever the flipped copy won.)
      const topBase = positions.length / 3;
      for (const l of local) { positions.push(l.x, top, l.z); normals.push(0, 1, 0); pushColor(); }
      let area2 = 0;
      for (let i = 1; i < n - 1; i++) {
        area2 += (local[i].z - local[0].z) * (local[i + 1].x - local[0].x)
          - (local[i].x - local[0].x) * (local[i + 1].z - local[0].z);
      }
      for (let i = 1; i < n - 1; i++) {
        if (area2 > 0) indices.push(topBase, topBase + i, topBase + i + 1);
        else indices.push(topBase, topBase + i + 1, topBase + i);
        slabTops?.push(...indices.slice(-3));
      }

      // Skirt — one vertical quad per rim edge, wound with the authored
      // normal; DoubleSide shows the far side.
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
          // Strip quad wound so its geometric normal points up (the lift only
          // moves Y, so the horizontal cross sign is exact); see the flat fan.
          const stripUp = (b0.z - a0.z) * (b1.x - a0.x) - (b0.x - a0.x) * (b1.z - a0.z) > 0;
          if (stripUp) indices.push(base, base + 1, base + 3, base + 3, base + 2, base);
          else indices.push(base + 3, base + 1, base, base, base + 2, base + 3);
          slabTops?.push(...indices.slice(-6));
          // Per-slice side skirts along both long edges. The bottom edge
          // follows the arch at constant slab thickness — dropping to the flat
          // underside instead builds a bare wall up to archRiseM + thickness
          // tall at mid-span (the 2026-07-18 approach-artifact fix).
          for (const [p0, y0e, p1, y1e] of [
            [a0, y0, a1, y1] as const,
            [b0, y0, b1, y1] as const,
          ]) {
            const sb = positions.length / 3;
            const dx = p1.x - p0.x, dz = p1.z - p0.z;
            const len = Math.hypot(dx, dz) || 1;
            const nx = -dz / len, nz = dx / len;
            positions.push(p0.x, y0e, p0.z); normals.push(nx, 0, nz); pushColor();
            positions.push(p0.x, y0e - DECK_THICK_M, p0.z); normals.push(nx, 0, nz); pushColor();
            positions.push(p1.x, y1e, p1.z); normals.push(nx, 0, nz); pushColor();
            positions.push(p1.x, y1e - DECK_THICK_M, p1.z); normals.push(nx, 0, nz); pushColor();
            indices.push(sb, sb + 1, sb + 2, sb + 2, sb + 1, sb + 3);
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
        }
      }

      const postColor: [number, number, number] = [cr * 0.8, cg * 0.8, cb * 0.8];

      // Pilings — square posts marching along both long edges (docks AND
      // bridges). Each post drops from its slice of the soffit to the SAMPLED
      // terrain (plus embed), so posts over a carved channel reach the bed
      // instead of dangling from a fixed-depth stub; where the bank swallows
      // the underside there is nothing to hold up, so no post.
      if (detail.pilingSpacingM > 0) {
        for (const [a, b] of longEdges) {
          const edgeLen = elen(a, b);
          const posts = Math.max(2, Math.round(edgeLen / detail.pilingSpacingM));
          for (let k = 0; k <= posts; k++) {
            const t = k / posts;
            const p = lerp(a, b, t);
            const soffitY = (arched ? top + lift(t) : top) - DECK_THICK_M;
            const terrainY = terrainYAt(p.x, p.z);
            if (terrainY >= soffitY - PILING_MIN_CLEAR_M) continue;
            const baseY = terrainY - PILING_EMBED_M;
            // Post top tucks 0.1 m into the slab so no hairline gap opens.
            pushBox(p.x, p.z, baseY, PILING_SIDE_M, soffitY + 0.1 - baseY, PILING_SIDE_M, 0, postColor);
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
            // would clip through a 1.5 m arch mid-span). Segments the bank has
            // buried are skipped — a straight deck crossing a concave rising
            // bank otherwise leaves stray rail tips cresting out of the ground.
            for (let i = 0; i < ARCH_STRIPS; i++) {
              const t0 = i / ARCH_STRIPS, t1 = (i + 1) / ARCH_STRIPS;
              const p0 = lerp(a, b, t0), p1 = lerp(a, b, t1);
              const baseY = top + lift((t0 + t1) / 2);
              const bankY = Math.max(terrainYAt(p0.x, p0.z), terrainYAt(p1.x, p1.z));
              if (bankY > baseY + RAIL_BURY_CLIP_M) continue;
              const segLen = Math.hypot(p1.x - p0.x, p1.z - p0.z);
              const mid = lerp(a, b, (t0 + t1) / 2);
              pushBox(mid.x, mid.z, baseY, segLen, RAIL_HEIGHT_M, RAIL_THICK_M, yaw, railColor);
            }
          } else {
            const edgeLen = elen(a, b);
            const mid = lerp(a, b, 0.5);
            pushBox(mid.x, mid.z, top, edgeLen, RAIL_HEIGHT_M, RAIL_THICK_M, yaw, railColor);
          }
        }
      }

      // Abutments — a stone block at each bridge end that lands on ground:
      // terrain-to-deck masonry receiving the roadway into its bank. Ends
      // hanging over the channel (or a chunk-border clip seam over water)
      // stay on pilings — no floating masonry.
      if (deck.kind === 'bridge') {
        const [edgeA, edgeB] = longEdges;
        const widthM = Math.hypot(edgeB[0].x - edgeA[0].x, edgeB[0].z - edgeA[0].z) || 1;
        const halfW = widthM / 2 + ABUT_EXTRA_HALF_W_M;
        for (const endT of [0, 1] as const) {
          const ea = endT === 0 ? edgeA[0] : edgeA[1];
          const eb = endT === 0 ? edgeB[0] : edgeB[1];
          const inA = endT === 0 ? edgeA[1] : edgeA[0];
          const mid = { x: (ea.x + eb.x) / 2, z: (ea.z + eb.z) / 2 };
          const inLen = Math.hypot(inA.x - ea.x, inA.z - ea.z) || 1;
          const dirIn = { x: (inA.x - ea.x) / inLen, z: (inA.z - ea.z) / inLen };
          const across = { x: -dirIn.z, z: dirIn.x };
          const c = {
            x: mid.x + dirIn.x * (ABUT_REACH_UNDER_M - ABUT_LEN_M / 2),
            z: mid.z + dirIn.z * (ABUT_REACH_UNDER_M - ABUT_LEN_M / 2),
          };
          let minT = Infinity;
          let maxT = -Infinity;
          for (const [sl, sw] of [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
            const sx = c.x + dirIn.x * sl * (ABUT_LEN_M / 2) + across.x * sw * halfW;
            const sz = c.z + dirIn.z * sl * (ABUT_LEN_M / 2) + across.z * sw * halfW;
            const ty = terrainYAt(sx, sz);
            if (ty < minT) minT = ty;
            if (ty > maxT) maxT = ty;
          }
          if (maxT < bot - 1.0) continue; // this end floats — pilings carry it
          const baseY = Math.min(minT, bot) - ABUT_EMBED_M;
          const yaw = Math.atan2(dirIn.z, dirIn.x);
          // Block top sits 3 cm under the deck top: flush enough to read as
          // the roadway's masonry footing without z-fighting the deck face.
          const blockH = top - 0.03 - baseY;
          if (blockH < 0.3) continue;
          pushBox(c.x, c.z, baseY, ABUT_LEN_M, blockH, halfW * 2, yaw, postColor);
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

type DeckVertex = [number, number, number];
type DeckTriangle = {
  a: DeckVertex; b: DeckVertex; c: DeckVertex;
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
  up: number;
};

export interface DeckSupportQuery {
  /** False for a legacy mesh with no slab receipt. Callers can refuse physical
   * admission until a fresh production chunk supplies complete clearance. */
  hasSlabUndersides: boolean;
  /** All actual upward faces under this chunk-local point, low to high.
   * Includes rail/abutment tops. The walker must select a reachable height;
   * taking the highest face would teleport somebody standing below a bridge. */
  surfaceHeightsAt(xM: number, zM: number): number[];
  /** Standing-body box against slab, rails, posts and abutments. Exact face
   * contact is permitted; penetration blocks. Invalid poses fail closed. */
  intersectsBody(point: { xM: number; zM: number; yM: number }, halfWidth?: number, height?: number): boolean;
}

/** Query the same clipped ChunkData that renders the deck, once per retained
 * chunk. It deliberately does not reconstruct an arch from GroundDeck.topY:
 * new packets clip the original span's eight planar arch strips; legacy
 * packets keep their existing geometry until a normal rebuild.
 * This supplies geometry only, never a spawn, lift or saved-height migration. */
export function createDeckSupportQuery(data: ChunkData): DeckSupportQuery {
  return createDeckSupportQueryFromMesh(buildDeckMesh(data));
}

/** Mounted worker mesh adapter. Coordinates are relative to that chunk's NW
 * origin. Keep this query with the mesh's lifetime and replace it with the mesh;
 * it never regenerates terrain, estimates a resolution or mutates draw buffers. */
export function createDeckSupportQueryFromMesh(mesh: Pick<ChunkGeometryArrays, 'positions' | 'indices'> & { slabTopIndices?: Uint32Array }): DeckSupportQuery {
  const slabTops = mesh.slabTopIndices ?? new Uint32Array(0);
  const triangles: DeckTriangle[] = [];
  const vertex = (i: number, drop = 0): DeckVertex => [
    mesh.positions[i * 3], mesh.positions[i * 3 + 1] - drop, mesh.positions[i * 3 + 2],
  ];
  const add = (a: DeckVertex, b: DeckVertex, c: DeckVertex) => {
    if (![...a, ...b, ...c].every(Number.isFinite)) return;
    triangles.push({ a, b, c,
      minX: Math.min(a[0], b[0], c[0]), maxX: Math.max(a[0], b[0], c[0]),
      minY: Math.min(a[1], b[1], c[1]), maxY: Math.max(a[1], b[1], c[1]),
      minZ: Math.min(a[2], b[2], c[2]), maxZ: Math.max(a[2], b[2], c[2]),
      up: (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
    });
  };
  for (let i = 0; i < mesh.indices.length; i += 3) {
    add(vertex(mesh.indices[i]), vertex(mesh.indices[i + 1]), vertex(mesh.indices[i + 2]));
  }
  // The visible skirts already author this thickness. Close their underside
  // for clearance: a head must not enter the slab just because its bottom is
  // not rendered. Reverse winding keeps the underside out of walking support.
  for (let i = 0; i < slabTops.length; i += 3) {
    add(vertex(slabTops[i + 2], DECK_THICK_M), vertex(slabTops[i + 1], DECK_THICK_M), vertex(slabTops[i], DECK_THICK_M));
  }

  // Short walking steps reuse a small spatial index rather than scanning all
  // town pilings. Unusually wide triangles use a bounded fallback list.
  const size = 8;
  const bins = new Map<string, DeckTriangle[]>();
  const wide: DeckTriangle[] = [];
  for (const t of triangles) {
    const x0 = Math.floor(t.minX / size), x1 = Math.floor(t.maxX / size);
    const z0 = Math.floor(t.minZ / size), z1 = Math.floor(t.maxZ / size);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4096) { wide.push(t); continue; }
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const key = `${x}|${z}`;
      const bin = bins.get(key);
      if (bin) bin.push(t); else bins.set(key, [t]);
    }
  }
  const candidates = (x0: number, x1: number, z0: number, z1: number): Set<DeckTriangle> => {
    if ((Math.floor(x1 / size) - Math.floor(x0 / size) + 1) * (Math.floor(z1 / size) - Math.floor(z0 / size) + 1) > 4096
      || [x0, x1, z0, z1].some(v => Math.abs(v / size) > Number.MAX_SAFE_INTEGER)) return new Set(triangles);
    const result = new Set(wide);
    for (let x = Math.floor(x0 / size); x <= Math.floor(x1 / size); x++) {
      for (let z = Math.floor(z0 / size); z <= Math.floor(z1 / size); z++) {
        for (const t of bins.get(`${x}|${z}`) ?? []) result.add(t);
      }
    }
    return result;
  };
  return {
    hasSlabUndersides: mesh.slabTopIndices != null,
    surfaceHeightsAt(xM, zM) {
      if (!Number.isFinite(xM) || !Number.isFinite(zM)) return [];
      const hits: number[] = [];
      for (const t of candidates(xM, xM, zM, zM)) {
        if (t.up <= 1e-10 || xM < t.minX - 1e-7 || xM > t.maxX + 1e-7 || zM < t.minZ - 1e-7 || zM > t.maxZ + 1e-7) continue;
        const [a, b, c] = [t.a, t.b, t.c];
        const bx = b[0] - a[0], bz = b[2] - a[2], cx = c[0] - a[0], cz = c[2] - a[2];
        const px = xM - a[0], pz = zM - a[2], det = bx * cz - bz * cx;
        const u = (px * cz - pz * cx) / det, v = (bx * pz - bz * px) / det;
        if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) hits.push(a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]));
      }
      return hits.sort((a, b) => a - b).filter((y, i, values) => i === 0 || y - values[i - 1] > 1e-5);
    },
    intersectsBody(point, halfWidth = 0.3, height = 1.9) {
      const { xM, zM, yM } = point;
      if (![xM, zM, yM, halfWidth, height].every(Number.isFinite) || halfWidth <= 0 || height <= 0.0002) return true;
      const center: DeckVertex = [xM, yM + height / 2, zM];
      const half: DeckVertex = [halfWidth, height / 2 - 0.0001, halfWidth];
      for (const t of candidates(xM - halfWidth, xM + halfWidth, zM - halfWidth, zM + halfWidth)) {
        if (t.maxX <= xM - halfWidth || t.minX >= xM + halfWidth || t.maxZ <= zM - halfWidth || t.minZ >= zM + halfWidth
          || t.maxY <= center[1] - half[1] || t.minY >= center[1] + half[1]) continue;
        if (deckTriangleIntersectsBox(t, center, half)) return true;
      }
      return false;
    },
  };
}

/** Triangle/box separating-axis test: box axes, triangle normal and nine
 * edge/axis crosses. A rail's bounding rectangle alone must not block the
 * empty space beside a rotated bridge. */
function deckTriangleIntersectsBox(t: DeckTriangle, center: DeckVertex, half: DeckVertex): boolean {
  const points = [t.a, t.b, t.c].map(p => p.map((v, i) => v - center[i]) as DeckVertex);
  const edges = points.map((p, i) => points[(i + 1) % 3].map((v, axis) => v - p[axis]) as DeckVertex);
  const cross = (a: DeckVertex, b: DeckVertex): DeckVertex => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const axes: DeckVertex[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], cross(edges[0], edges[1])];
  for (const edge of edges) axes.push(cross(edge, [1, 0, 0]), cross(edge, [0, 1, 0]), cross(edge, [0, 0, 1]));
  for (const axis of axes) {
    if (axis.every(v => Math.abs(v) < 1e-12)) continue;
    const projections = points.map(p => p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2]);
    const radius = half[0] * Math.abs(axis[0]) + half[1] * Math.abs(axis[1]) + half[2] * Math.abs(axis[2]);
    if (Math.max(...projections) <= -radius + 1e-10 || Math.min(...projections) >= radius - 1e-10) return false;
  }
  return true;
}
