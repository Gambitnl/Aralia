/**
 * @file intact/primitives.ts
 * @description Room / mask / grid primitives (shared substrate) — extracted
 * VERBATIM from buildIntact.ts (packet W1-P6). These are the grid geometry, mask
 * bakers, spine-composition tuning constants, the stamp helpers, and the working
 * `IntactState`/`SpineCell` types that both the builder and `generateDungeon.ts`
 * lean on. Move-only: bodies are byte-identical to the originals so every seeded
 * draw (compoundMask/bakeMask) fires in the same order. Re-exported by
 * `../buildIntact` so the public import surface is unchanged.
 */

import type { Rng } from './rng';
import {
  CellKind,
  type Cell,
  type DungeonEdge,
  type RoomPurpose,
  type RoomShape,
} from '../types';

// ─── Working types (shared substrate) ────────────────────────────────────────

export interface Room {
  id: number;
  x0: number; // top-left cell of the bounding box
  y0: number;
  w: number;
  h: number;
  shape: RoomShape;
  /** Footprint mask, row-major w*h — 1 = floor. Rooms are stamped from this. */
  mask: Uint8Array;
  type: import('../types').RoomType;
  /** What this room was built as (history-first layout). */
  purpose: RoomPurpose;
  depth: number;
  difficulty: number;
  degree: number;
  area: number;
}

export const roomCx = (r: Room): number => r.x0 + Math.floor(r.w / 2);
export const roomCy = (r: Room): number => r.y0 + Math.floor(r.h / 2);

/** True when local cell (i, j) of a room's bounding box is floor. */
export function inMask(shape: RoomShape, w: number, h: number, i: number, j: number): boolean {
  if (shape === 'rect') return true;
  if (shape === 'ellipse') {
    const nx = (i - (w - 1) / 2) / (w / 2);
    const ny = (j - (h - 1) / 2) / (h / 2);
    return nx * nx + ny * ny <= 1.02;
  }
  if (shape === 'diamond') {
    // A 45°-rotated square: the octagon chamfer taken to its limit. Keep only
    // the cells within Manhattan distance of the center (normalized so the four
    // tips reach the box edges) — a crisp diamond focal room.
    const nx = Math.abs(i - (w - 1) / 2) / (w / 2);
    const ny = Math.abs(j - (h - 1) / 2) / (h / 2);
    return nx + ny <= 1.02;
  }
  // octagon: chamfer the corners
  const chamfer = Math.floor(Math.min(w, h) * 0.3);
  return Math.min(i, w - 1 - i) + Math.min(j, h - 1 - j) >= chamfer;
}

/**
 * Compound footprint: the union of a full-height column block and a partial-
 * height full-width block — yields L, T, and plus shapes depending on where
 * the two land. This is how Watabou rooms get their irregular outlines.
 */
export function compoundMask(rng: Rng, w: number, h: number): Uint8Array {
  const m = new Uint8Array(w * h);
  const hA = rng.int(Math.max(2, Math.floor(h * 0.45)), Math.max(3, Math.floor(h * 0.7)));
  const wB = rng.int(Math.max(2, Math.floor(w * 0.45)), Math.max(3, Math.floor(w * 0.7)));
  const topA = rng.chance(0.5);
  const xB = rng.pick([0, w - wB, (w - wB) >> 1]);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const inA = topA ? j < hA : j >= h - hA;
      const inB = i >= xB && i < xB + wB;
      if (inA || inB) m[j * w + i] = 1;
    }
  }
  return m;
}

export function bakeMask(rng: Rng, shape: RoomShape, w: number, h: number): Uint8Array {
  if (shape === 'compound') return compoundMask(rng, w, h);
  const m = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (inMask(shape, w, h, i, j)) m[j * w + i] = 1;
    }
  }
  return m;
}

// ─── Grid geometry (shared substrate) ────────────────────────────────────────

export const DIRS: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// ─── Spine composition tuning ────────────────────────────────────────────────
// Galleries hang off a mausoleum spine at this stride (a gallery's own height),
// alternating flanks. A SEGMENT caps a straight trunk at ~4-5 gallery PAIRS
// before the skeleton must branch perpendicular — this is what keeps the plan
// from reading as a one-dimensional worm (DEFECT 1). SPINE_SEGMENT_CELLS is
// sized so the last usable gallery anchor (2 + cursor*STRIDE) sits inside the
// segment for ~5 pairs, plus a two-cell lead-in.
// ROOM-SIZE ×2 (Remy 2026-07-07): burial galleries are now ~10-15 cells tall
// (was 7-11), so the stride between spine anchors must grow so adjacent gallery
// wings on the same flank clear each other. Raised 6 → 8.
export const SPINE_STRIDE = 8;
/** Gallery PAIRS per straight trunk before the spine branches perpendicular. */
export const SPINE_PAIRS_PER_SEGMENT = 5;
export const SPINE_SEGMENT_CELLS = 2 + SPINE_PAIRS_PER_SEGMENT * SPINE_STRIDE; // 42
/**
 * Perpendicular jog between processional lanes — wide enough that the next
 * lane's galleries clear the previous lane's (a ×2-scale gallery reaches ~13
 * cells to a flank plus its connector). Keeps parallel lanes from cross-colliding.
 * Raised 16 → 22 for the bigger galleries.
 */
export const SPINE_LANE_GAP = 22;

export const gi = (x: number, y: number, W: number): number => y * W + x;

/** Minimal grid surface `stampRoom` needs (shared by GrowState & IntactState). */
export interface GridSurface {
  side: number;
  grid: Uint8Array;
  roomOf: Int16Array;
}

/** Stamp a room's floor mask into the working grid, returning its area. */
export function stampRoom(st: GridSurface, r: Room): void {
  let area = 0;
  for (let j = 0; j < r.h; j++) {
    for (let i = 0; i < r.w; i++) {
      if (r.mask[j * r.w + i] !== 1) continue;
      const k = gi(r.x0 + i, r.y0 + j, st.side);
      st.grid[k] = CellKind.Floor;
      st.roomOf[k] = r.id;
      area++;
    }
  }
  r.area = area;
}

/** Mark every floor cell of a placed room as built-wet (waterworks cisterns). */
export function addRoomWater(st: IntactState, r: Room): void {
  for (let j = 0; j < r.h; j++) {
    for (let i = 0; i < r.w; i++) {
      if (r.mask[j * r.w + i] !== 1) continue;
      st.builtWater.add(gi(r.x0 + i, r.y0 + j, st.side));
    }
  }
}

// ─── Intact builder state ────────────────────────────────────────────────────

export interface IntactState {
  side: number;
  grid: Uint8Array; // CellKind
  corridor: Uint8Array;
  roomOf: Int16Array; // -1 void, -2 corridor, else room id
  rooms: Room[]; // Room gains `purpose: RoomPurpose`
  edges: DungeonEdge[]; // all isLoop:false at this stage — builders build trees + the spine
  entranceId: number; // the 'entry' room
  flowDir: readonly [number, number]; // the plan's main axis
  /** Working-grid cell indices that start WET (waterworks channels/cisterns). */
  builtWater: Set<number>;
  /**
   * Layout dial (0 tight .. 1 sprawl). At 0 corridors keep their tight spec
   * ranges and rooms butt through shared-wall doors; toward 1 attach corridors
   * stretch into long runs (4-12 cells) with a seeded elbow, room/wing spacing
   * grows, and the room-to-room share falls so negative space opens up.
   */
  sprawl: number;
}

/**
 * A carved spine/channel cell tagged with the LOCAL flow direction of the
 * segment it belongs to. Galleries branch perpendicular to `dir` — so once the
 * spine bends into a perpendicular wing, its galleries hang off the correct
 * flanks of THAT wing, not the original trunk axis (this is what makes the
 * mausoleum grow as wings off a trunk rather than a single worm).
 */
export interface SpineCell extends Cell {
  dir: readonly [number, number];
}
