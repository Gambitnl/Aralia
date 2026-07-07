/**
 * @file buildIntact.ts
 * @description Purpose-driven INTACT layout generator — the heart of the
 * history-first dungeon rewrite. Pure data, zero THREE imports, deterministic.
 *
 * Where the old `grow()` grew rooms by random attachment (the "blob" look Remy
 * rejected), `buildIntact()` runs a BUILDER PROGRAM: it places the archetype's
 * `core` rooms once, each at the direction its RoomSpec asks for relative to the
 * plan's flow axis, then repeats `repeat` units until the room count. The result
 * reads as something a mason built for a purpose, not something that accreted.
 *
 * The four programs each produce one of the approved circulation shapes
 * (mocks .agent/scratch/dungeon-layout-mocks.html):
 *   - mausoleum : processional symmetry — stair→antechamber→chapel on one axis,
 *                 a SPINE corridor behind, burial galleries alternating off it.
 *   - mine      : diagonal vein descent — flowDir alternates [1,0]/[0,1] so the
 *                 gallery chain steps down-and-right; the sump lands deepest.
 *   - fortress  : gatehouse funnel → great-hall hub → service wings; repeat
 *                 passage-rooms hang off already-placed CORE rooms (spread).
 *   - waterworks: channel skeleton — 3-wide channel runs, cisterns at the ends,
 *                 everything meeting at the junction; channels/cisterns start wet.
 *
 * SUBSTRATE OWNERSHIP: the shared grid/room/mask primitives (`Rng`, `makeRng`,
 * `Room`, `gi`, `DIRS`, mask helpers, `stampRoom`, `roomCx`/`roomCy`) live HERE
 * and `generateDungeon.ts` imports them back, so nothing is duplicated.
 *
 * Determinism: every draw comes from the `Rng` wrapper over a seed path; the
 * wrapper's `int()` is INCLUSIVE (guarding SeededRandom.nextInt being max-
 * exclusive). Same path ⇒ byte-identical grid.
 */

import { rngFromPath, type SeedPath } from '../seedPath';
import {
  CellKind,
  type BuilderArchetype,
  type Cell,
  type DungeonEdge,
  type RoomPurpose,
  type RoomShape,
} from './types';
import { ARCHETYPES, type RoomSpec } from './archetypes';

// ─── RNG helpers (shared substrate) ──────────────────────────────────────────

/** Thin, allocation-light wrapper over the worldforge `SeededRandom` stream. */
export interface Rng {
  /** [a, b) */
  float(a: number, b: number): number;
  /** integer in [a, b] INCLUSIVE (guards the max-exclusive nextInt trap). */
  int(a: number, b: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

export function makeRng(path: SeedPath): Rng {
  const sr = rngFromPath(path);
  return {
    float: (a, b) => a + sr.next() * (b - a),
    int: (a, b) => sr.nextInt(a, b + 1),
    // min() guards the (conventional, not contractual) next() < 1 promise —
    // floor(1.0 * len) would index one past the end.
    pick: (arr) => arr[Math.min(arr.length - 1, Math.floor(sr.next() * arr.length))],
    chance: (p) => sr.next() < p,
  };
}

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
  type: import('./types').RoomType;
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
export const SPINE_STRIDE = 6;
/** Gallery PAIRS per straight trunk before the spine branches perpendicular. */
export const SPINE_PAIRS_PER_SEGMENT = 5;
export const SPINE_SEGMENT_CELLS = 2 + SPINE_PAIRS_PER_SEGMENT * SPINE_STRIDE; // 32
/**
 * Perpendicular jog between processional lanes — wide enough that the next
 * lane's galleries clear the previous lane's (a gallery reaches ~9 cells to a
 * flank plus its connector). Keeps parallel lanes from cross-colliding.
 */
export const SPINE_LANE_GAP = 16;

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

// ─── Sprawl interpolation ────────────────────────────────────────────────────

/** Long-corridor band at full sprawl (cells) — the Gozzys "rooms float apart". */
const SPRAWL_CORRIDOR = { lo: 4, hi: 12 } as const;

/**
 * Effective corridor length for an attach at the plan's sprawl level.
 * Interpolates from the spec's own tight range (sprawl 0) toward a long run
 * 4-12 cells (sprawl 1). A shared-wall spec (corridor [0,0]) stays a door at
 * low sprawl but is lifted OFF the wall as sprawl rises so suites break apart.
 */
function sprawlCorLen(st: IntactState, rng: Rng, range: readonly [number, number]): number {
  const s = st.sprawl;
  const tight = rng.int(range[0], range[1]);
  if (s <= 0) return tight;
  const longRun = rng.int(SPRAWL_CORRIDOR.lo, SPRAWL_CORRIDOR.hi);
  // A shared-wall door (tight 0) still gets pulled out at high sprawl.
  return Math.round(tight * (1 - s) + longRun * s);
}

/**
 * Whether an attach corridor of this length should bend a seeded elbow at the
 * given sprawl. Only long runs (≥ 4 cells) elbow, and only as sprawl climbs, so
 * the corridor network reads as bending galleries rather than straight spokes.
 */
function sprawlElbow(st: IntactState, rng: Rng, corLen: number): boolean {
  if (st.sprawl < 0.4 || corLen < 4) return false;
  return rng.chance(st.sprawl * 0.7);
}

// ─── Gozzys blend (size contrast + focal shapes, at all sprawl levels) ────────

/** An oversized hall — the "huge hall next to a closet" contrast. */
const GOZZYS_HALL = { w: [14, 18], h: [14, 18] } as const;
/** A tiny closet. */
const GOZZYS_CLOSET = { w: [3, 4], h: [3, 4] } as const;

/**
 * Occasionally override a repeat spec into a Gozzys focal room — an oversized
 * hall, a tiny closet, or an octagon/diamond focal chamber. Driven by a plain
 * ordinal (deterministic, no extra draws) so the cadence is spread across the
 * plan rather than clustered, and weighted SMALL so most rooms keep their spec.
 *
 * The 3-wide waterworks maintenance-walk (a channel-side corridor-room, h==3)
 * is left alone — turning it into a hall/closet would break the wet-channel read.
 */
function gozzysBlend(spec: RoomSpec, ordinal: number): RoomSpec {
  // Skip corridor-like walks (fixed 3-cell height): those are channel spines.
  if (spec.h[0] === 3 && spec.h[1] === 3) return spec;
  // Cadence: hall every 11th, closet every 7th (offset), focal shape every 9th.
  // Halls are rarest (biggest footprint); order matters — hall wins ties.
  const isHall = ordinal % 11 === 5;
  const isCloset = !isHall && ordinal % 7 === 3;
  const isFocal = !isHall && !isCloset && ordinal % 9 === 4;
  if (isHall) return { ...spec, w: GOZZYS_HALL.w, h: GOZZYS_HALL.h, shape: 'octagon' };
  if (isCloset) return { ...spec, w: GOZZYS_CLOSET.w, h: GOZZYS_CLOSET.h, shape: 'rect' };
  if (isFocal) {
    const shape: RoomShape = ordinal % 18 === 4 ? 'diamond' : 'octagon';
    // Focal rooms want a squarish mid-large footprint so the shape reads.
    return { ...spec, w: [8, 11], h: [8, 11], shape };
  }
  return spec;
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

// ─── Direction resolution ────────────────────────────────────────────────────

/** Resolve a spec's `dir` token against the plan's flow axis. */
function resolveDir(
  st: IntactState,
  rng: Rng,
  token: RoomSpec['dir'],
): readonly [number, number] {
  const [fx, fy] = st.flowDir;
  switch (token) {
    case 'flow':
      return [fx, fy];
    case 'back':
      return [-fx, -fy];
    case 'left':
      // Perpendicular-left of the flow axis (screen-space: rotate +90°).
      return [fy, -fx];
    case 'right':
      return [-fy, fx];
    case 'any':
    default:
      return rng.pick(DIRS);
  }
}

// ─── Directed attach ─────────────────────────────────────────────────────────

/**
 * Directed attach: the old `tryAttach` with (a) direction, size and shape from
 * `spec` instead of centroid-biased random; (b) corridor length from
 * `spec.corridor`; (c) the SAME 8-neighborhood no-touch validation VERBATIM
 * (this is what preserves the approved walls-between-rooms look); (d) on success
 * sets `purpose` and records the tree edge src→new. Retries up to 8 times with a
 * re-rolled room size and door position before giving up on the spec.
 *
 * Returns the placed Room, or null if no valid placement was found.
 */
export function attachRoom(
  st: IntactState,
  rng: Rng,
  src: Room,
  spec: RoomSpec,
  dir: readonly [number, number],
  /** When given, the corridor cell indices carved on the SUCCESSFUL placement are
   * pushed here — the waterworks path uses this to mark cistern-connector cells
   * (the channels) as built-wet. */
  corridorOut?: number[],
): Room | null {
  // Try the requested direction first, then the other three (a builder that
  // wants "left" but is boxed in that way still gets its room placed — the plan
  // shape degrades gracefully rather than dropping the room entirely).
  const dirs = orderedDirs(dir);
  for (const [dx, dy] of dirs) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const w = rng.int(spec.w[0], spec.w[1]);
      const h = rng.int(spec.h[0], spec.h[1]);
      const shape = spec.shape === 'compound' ? 'compound' : spec.shape;
      const mask = bakeMask(rng, shape, w, h);
      const corLen = sprawlCorLen(st, rng, spec.corridor);

      // Source-side wall exit cell along (dx, dy); may hug src's own floor.
      const start = wallExitCell(st, rng, src, dx, dy);
      if (!start) continue;
      const len = Math.max(1, corLen);
      const placed = placeRoomFromCell(
        st, start.x, start.y, dx, dy, w, h, shape, mask, len,
        rng, spec.purpose, src.id, src.id, corridorOut, sprawlElbow(st, rng, len),
      );
      if (placed) return placed;
    }
  }
  return null;
}

/** The requested direction, then the remaining DIRS in a stable order. */
function orderedDirs(dir: readonly [number, number]): Array<readonly [number, number]> {
  const rest = DIRS.filter((d) => d[0] !== dir[0] || d[1] !== dir[1]);
  return [dir, ...rest];
}

/**
 * The source-side wall floor cell to exit from, in direction (dx, dy). Picks a
 * door position along the wall away from the corners, then walks in to the last
 * floor cell of `src` on that line. Returns null if no floor cell lies on it.
 */
function wallExitCell(
  st: IntactState,
  rng: Rng,
  src: Room,
  dx: number,
  dy: number,
): Cell | null {
  const span = dx !== 0 ? src.h : src.w;
  const lo = src.shape === 'rect' ? 1 : Math.floor(span / 3);
  const hi = src.shape === 'rect' ? span - 2 : span - 1 - Math.floor(span / 3);
  if (hi < lo) return null;
  const t = rng.int(lo, hi);
  let fx: number;
  let fy: number;
  if (dx !== 0) {
    fy = src.y0 + t;
    fx = dx > 0 ? src.x0 + src.w - 1 : src.x0;
    while (st.roomOf[gi(fx, fy, st.side)] !== src.id) {
      fx -= dx;
      if (fx < src.x0 || fx >= src.x0 + src.w) return null;
    }
  } else {
    fx = src.x0 + t;
    fy = dy > 0 ? src.y0 + src.h - 1 : src.y0;
    while (st.roomOf[gi(fx, fy, st.side)] !== src.id) {
      fy -= dy;
      if (fy < src.y0 || fy >= src.y0 + src.h) return null;
    }
  }
  return { x: fx, y: fy };
}

/**
 * Place a room starting from floor cell (fx, fy), carving a `corLen`-cell
 * corridor in (dx, dy) and putting the new room one cell past the corridor end.
 * The 8-neighborhood no-touch validation below is lifted VERBATIM from the old
 * `tryAttach` — it is the walls-between-rooms guarantee Remy approved.
 *
 * `hugRoomId` is the room whose floor the corridor's FIRST cell may legally
 * touch (the source room for wall attach, or the spine's origin -2 for spine
 * attach). `edgeSrcId` is the graph node the recorded edge points back at.
 */
function placeRoomFromCell(
  st: IntactState,
  fx: number,
  fy: number,
  dx: number,
  dy: number,
  w: number,
  h: number,
  shape: RoomShape,
  mask: Uint8Array,
  corLen: number,
  rng: Rng,
  purpose: RoomPurpose,
  hugRoomId: number,
  edgeSrcId: number,
  /** On success, the carved corridor cell indices are appended here (channels). */
  corridorOut?: number[],
  /** Seeded elbow: bend the corridor perpendicular partway along the run (sprawl
   * networks read as bending galleries, not straight spokes). Ignored for runs
   * shorter than 4 cells (no room to bend cleanly). */
  elbow = false,
): Room | null {
  // Corridor cells: straight out of (fx, fy), with an optional perpendicular
  // elbow partway along a long run. The FINAL segment direction (ex, ey) decides
  // where the new room seats.
  const cor: Cell[] = [];
  let cxw = fx;
  let cyw = fy;
  let ex = dx;
  let ey = dy;
  const bend = elbow && corLen >= 4;
  // Bend near the middle, leaving ≥2 cells on each leg so the room clears the
  // source room's flank.
  const bendAt = bend ? rng.int(2, corLen - 2) : corLen + 1;
  const perpSide = rng.chance(0.5) ? 1 : -1;
  for (let k = 1; k <= corLen; k++) {
    if (k === bendAt + 1) {
      // Turn 90°: swap axes onto the chosen perpendicular side.
      ex = dy * perpSide;
      ey = dx * perpSide;
    }
    cxw += ex;
    cyw += ey;
    cor.push({ x: cxw, y: cyw });
  }

  // New room bounding box: near wall one past the corridor end; the entry line
  // enters it away from the corners. Seats off the FINAL leg direction (ex, ey).
  const end = cor[cor.length - 1];
  const q = shape === 'rect'
    ? rng.int(1, (ex !== 0 ? h : w) - 2)
    : Math.floor((ex !== 0 ? h : w) / 2);
  let x0: number;
  let y0: number;
  if (ex > 0) { x0 = end.x + 1; y0 = end.y - q; }
  else if (ex < 0) { x0 = end.x - w; y0 = end.y - q; }
  else if (ey > 0) { y0 = end.y + 1; x0 = end.x - q; }
  else { y0 = end.y - h; x0 = end.x - q; }

  // Bounds (leave a 2-cell rim on the working grid).
  if (x0 < 2 || y0 < 2 || x0 + w > st.side - 2 || y0 + h > st.side - 2) return null;
  for (const c of cor) {
    if (c.x < 2 || c.y < 2 || c.x >= st.side - 2 || c.y >= st.side - 2) return null;
  }

  // Candidate cell set: corridor + room floor mask.
  const roomCells: Cell[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (mask[j * w + i] === 1) roomCells.push({ x: x0 + i, y: y0 + j });
    }
  }
  const cand = new Set<number>();
  for (const c of cor) cand.add(gi(c.x, c.y, st.side));
  for (const c of roomCells) cand.add(gi(c.x, c.y, st.side));

  // The corridor must actually meet the new room's floor (masks can curve away).
  const doorIn = gi(end.x + ex, end.y + ey, st.side);
  if (!cand.has(doorIn)) return null;

  // Validation: candidates void; neighborhoods void/internal, except the first
  // corridor cell which may touch the hug-room's floor. VERBATIM no-touch guard.
  const door0 = gi(cor[0].x, cor[0].y, st.side);
  for (const k of cand) {
    if (st.grid[k] !== CellKind.Void) return null;
    const x = k % st.side;
    const y = (k / st.side) | 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nk = gi(x + ox, y + oy, st.side);
        if (st.grid[nk] === CellKind.Void || cand.has(nk)) continue;
        if (k === door0 && st.roomOf[nk] === hugRoomId) continue;
        return null;
      }
    }
  }

  // Commit.
  const room: Room = {
    id: st.rooms.length,
    x0, y0, w, h, shape, mask,
    type: 'combat', purpose, depth: 0, difficulty: 0, degree: 0, area: 0,
  };
  stampRoom(st, room);
  for (const c of cor) {
    const k = gi(c.x, c.y, st.side);
    st.grid[k] = CellKind.Floor;
    st.corridor[k] = 1;
    st.roomOf[k] = -2;
    if (corridorOut) corridorOut.push(k);
  }
  st.rooms.push(room);
  st.edges.push({ a: edgeSrcId, b: room.id, isLoop: false, isCritical: false });
  return room;
}

/**
 * Hang a room off a spine/channel corridor cell `(sx, sy)` in direction (dx, dy).
 * The corridor's first cell may hug the spine (roomOf -2); the recorded edge
 * points at `spineOriginId` so the spine belongs graph-wise to its origin room.
 */
function attachRoomAtSpineCell(
  st: IntactState,
  rng: Rng,
  sx: number,
  sy: number,
  dx: number,
  dy: number,
  spec: RoomSpec,
  purpose: RoomPurpose,
  spineOriginId: number,
): Room | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const w = rng.int(spec.w[0], spec.w[1]);
    const h = rng.int(spec.h[0], spec.h[1]);
    const shape = spec.shape === 'compound' ? 'compound' : spec.shape;
    const mask = bakeMask(rng, shape, w, h);
    const corLen = Math.max(1, sprawlCorLen(st, rng, spec.corridor));
    const placed = placeRoomFromCell(
      st, sx, sy, dx, dy, w, h, shape, mask, corLen, rng, purpose, -2, spineOriginId,
      undefined, sprawlElbow(st, rng, corLen),
    );
    if (placed) return placed;
  }
  return null;
}

// ─── Spine / channel corridor runs ───────────────────────────────────────────

/**
 * A spine (mausoleum) or channel-centerline (waterworks) is a straight corridor
 * run stamped like ordinary corridor cells (roomOf = -2). It anchors to `src`
 * and returns the list of stamped cells so galleries can hang off evenly spaced
 * points. Graph-wise the spine belongs to its origin room, mirroring how the old
 * code treats corridors as edges — so a gallery hung on the spine records its
 * edge against `src`, not against a phantom spine node.
 *
 * Returns the stamped cells (empty if it could not be placed without touching).
 */
export function attachSpine(
  st: IntactState,
  src: Room,
  len: number,
  dir: readonly [number, number],
): SpineCell[] {
  const [dx, dy] = dir;
  // Start the spine one cell out from the source-room center along the exit face.
  let sx = roomCx(src);
  let sy = roomCy(src);
  // Walk to the source wall, then one cell beyond.
  while (st.roomOf[gi(sx, sy, st.side)] === src.id) {
    sx += dx;
    sy += dy;
    if (sx < 2 || sy < 2 || sx >= st.side - 2 || sy >= st.side - 2) return [];
  }

  const cells: SpineCell[] = [];
  let cx = sx;
  let cy = sy;
  for (let k = 0; k < len; k++) {
    if (cx < 2 || cy < 2 || cx >= st.side - 2 || cy >= st.side - 2) break;
    const idx = gi(cx, cy, st.side);
    // Only extend over void the spine can legally occupy (its own line + the
    // first cell touching src). Stop at the first blocked cell.
    if (st.grid[idx] !== CellKind.Void) {
      // First cell may touch the source room; that is allowed.
      if (k === 0 && st.roomOf[idx] === src.id) { cx += dx; cy += dy; continue; }
      break;
    }
    cells.push({ x: cx, y: cy, dir });
    cx += dx;
    cy += dy;
  }

  for (const c of cells) {
    const idx = gi(c.x, c.y, st.side);
    st.grid[idx] = CellKind.Floor;
    st.corridor[idx] = 1;
    st.roomOf[idx] = -2;
  }
  return cells;
}

// ─── Anchor resolution ───────────────────────────────────────────────────────

/** First placed room of a given purpose (core anchors resolve against this). */
function findByPurpose(st: IntactState, purpose: RoomPurpose): Room | undefined {
  return st.rooms.find((r) => r.purpose === purpose);
}

// ─── The builder ─────────────────────────────────────────────────────────────

/**
 * Deterministic purpose-driven layout. Places the archetype's `core` rooms
 * once (deduplicated by purpose — the verbatim Task-3 test asserts exactly one
 * room per distinct core purpose), builds the archetype's spine/channels, then
 * cycles `repeat` specs until the room count. Returns null if < 70% of the
 * target rooms placed.
 */
export function buildIntact(
  rng: Rng,
  archetype: BuilderArchetype,
  roomCount: number,
  /** Loop-door density control (0..1). At 0 the builder still opens ≥1 cross-cut
   * (the "never a pure tree" anti-goal). Default keeps legacy 2-arg callers a
   * pure tree — the generator always passes the real value + `circRng`. */
  loopChance = 0,
  /** Dedicated sub-stream for the circulation pass, so adding built-loop draws
   * never perturbs the build stream's determinism. */
  circRng?: Rng,
  /** Layout dial (0 tight .. 1 sprawl). Legacy 2/3-arg callers default to 0
   * (fully tight — identical to the pre-sprawl builder). */
  sprawl = 0,
): IntactState | null {
  const data = ARCHETYPES[archetype];
  const sprawlClamped = Math.max(0, Math.min(1, sprawl));
  // The spine/vein programs grow mostly along ONE axis, so they need a working
  // grid taller than a room-count-square would give. Size generously — the grid
  // is cropped to the used extent afterward, so slack costs only transient RAM.
  // The binding constraint for the mausoleum is spine LENGTH (galleries hang off
  // one processional spine), so it scales with roomCount more steeply than the
  // spread archetypes; growing `side` here is the sanctioned lever (the
  // 8-neighborhood no-touch guard stays untouched).
  // Sprawl opens negative space and lengthens corridors, so the working grid
  // must grow with it (rooms float farther apart). The area factor scales with
  // sprawl; side is its sqrt, so the grid stays near-square. The mausoleum's
  // base factor is already very generous (its spine needs LENGTH), so it gets a
  // gentler sprawl bump than the spread archetypes — otherwise its huge grid
  // makes the O(side²) history/loop passes blow the perf budget at full sprawl.
  const side = archetype === 'mausoleum'
    ? Math.max(160, Math.ceil(Math.sqrt(roomCount * 1600 * (1 + 0.15 * sprawlClamped))))
    : Math.max(140, Math.ceil(Math.sqrt(roomCount * 640 * (1 + 0.8 * sprawlClamped))));

  const flowByArch: Record<BuilderArchetype, readonly [number, number]> = {
    mausoleum: [0, -1],
    mine: [1, 0], // alternates with [0,1] during the vein chase
    fortress: [0, -1],
    waterworks: [1, 0],
  };

  const st: IntactState = {
    side,
    grid: new Uint8Array(side * side),
    corridor: new Uint8Array(side * side),
    roomOf: new Int16Array(side * side).fill(-1),
    rooms: [],
    edges: [],
    entranceId: 0,
    flowDir: flowByArch[archetype],
    builtWater: new Set<number>(),
    sprawl: sprawlClamped,
  };

  // ── Entrance: the first core spec. The whole plan extends along +flowDir, so
  //    seat the entrance OPPOSITE the flow (≈35% off-center) to leave room for
  //    the processional/vein/channel to run without hitting the grid rim. Its
  //    outward face is the cosmetic "map edge" (real edge is set after crop).
  const entrySpec = data.core[0];
  const ew = rng.int(entrySpec.w[0], entrySpec.w[1]);
  const eh = rng.int(entrySpec.h[0], entrySpec.h[1]);
  const eShape = entrySpec.shape;
  const eMask = bakeMask(rng, eShape, ew, eh);
  const [flx, fly] = st.flowDir;
  // Seat the entrance well toward the TRAILING rim so the processional/vein has
  // most of the grid to run into. The mausoleum's single long spine benefits
  // most from a near-rim seat (≈42% back gives the spine ~85% of the height).
  const back = Math.floor(side * (archetype === 'mausoleum' ? 0.42 : 0.33));
  // Mine steps down-AND-right (flowDir alternates [1,0]/[0,1]); seat it in the
  // top-left so both axes have room. Others back off along their single axis.
  const backX = archetype === 'mine' ? back : flx * back;
  const backY = archetype === 'mine' ? back : fly * back;
  const entrance: Room = {
    id: 0,
    x0: ((side - ew) >> 1) - backX,
    y0: ((side - eh) >> 1) - backY,
    w: ew, h: eh, shape: eShape, mask: eMask,
    type: 'entrance', purpose: entrySpec.purpose, depth: 0, difficulty: 0, degree: 0, area: 0,
  };
  stampRoom(st, entrance);
  st.rooms.push(entrance);
  st.entranceId = 0;

  // ── Place the remaining CORE rooms in array order (the mine's sump is LAST in
  //    `core`, so array order lands it deepest, per the archetype comment).
  //
  //    A core spec MAY repeat a purpose (waterworks lists 'cistern' twice — two
  //    real cisterns anchor the channel ends, exactly as the mock shows). Every
  //    core spec instance keeps its DECLARED purpose; we do NOT relabel the
  //    second one. Downstream flood-by-purpose and story logic depend on both
  //    cisterns carrying the 'cistern' purpose, so the count of a repeated core
  //    purpose equals the number of specs that declare it.
  const spineCells: SpineCell[] = [];

  // Only the mausoleum carves a spine (behind the chapel) that galleries hang off.
  // Waterworks channels are the connectors to the cisterns/outfall, marked wet at
  // attach time (below) — no free-standing channel stub to trim away.
  const carveSpineAfter: RoomPurpose | null = archetype === 'mausoleum' ? 'chapel' : null;

  for (let ci = 1; ci < data.core.length; ci++) {
    const spec = data.core[ci];

    // Resolve the anchor room.
    let anchor: Room | undefined;
    if (spec.anchor === 'prev') {
      anchor = st.rooms[st.rooms.length - 1];
    } else if (spec.anchor === 'entry') {
      anchor = entrance;
    } else if (spec.anchor === 'spine') {
      anchor = undefined; // resolved against spine cells below
    } else {
      anchor = findByPurpose(st, spec.anchor);
    }

    // Each core spec keeps its declared purpose — including a repeated one (the
    // waterworks second 'cistern'). The two cisterns are separated physically by
    // their opposite anchor directions (left vs right off the junction).
    const placedSpec: RoomSpec = spec;
    let placed: Room | null = null;

    if (spec.anchor === 'spine' && spineCells.length > 0) {
      // Cap the spine's FAR end (ossuary). Hang off the last spine cell along
      // the flow axis so the ossuary sits at the processional terminus.
      const end = spineCells[spineCells.length - 1];
      const [fx, fy] = st.flowDir;
      placed = attachRoomAtSpineCell(
        st, rng, end.x, end.y, fx, fy, placedSpec, spec.purpose, findSpineOrigin(st),
      );
      // Fallback: if the terminus is boxed in, chain it off the last room.
      if (!placed) {
        placed = attachRoom(st, rng, st.rooms[st.rooms.length - 1], placedSpec, resolveDir(st, rng, spec.dir));
      }
    } else {
      if (!anchor) anchor = st.rooms[st.rooms.length - 1];
      const dir = resolveDir(st, rng, spec.dir);
      // Waterworks channels: the junction→cistern and junction→outfall connectors
      // ARE the channels from the mock (figure 5) — capture their corridor cells so
      // they start wet. For cisterns, also flood the whole basin floor. Both
      // cisterns thus read as water-filled basins fed by a visible channel, and the
      // outfall runs wet to its grate, instead of everything sitting dry.
      const wantChannel =
        archetype === 'waterworks' && (spec.purpose === 'cistern' || spec.purpose === 'outfall');
      const floodBasin = spec.purpose === 'cistern';
      const channelCells: number[] | undefined = wantChannel ? [] : undefined;
      placed = attachRoom(st, rng, anchor, placedSpec, dir, channelCells);
      if (placed && wantChannel) {
        for (const k of channelCells!) st.builtWater.add(k);
        if (floodBasin) addRoomWater(st, placed);
      }
    }

    // Core rooms MUST land (their purpose is part of the plan's contract). If
    // the designated anchor+direction is boxed in — e.g. the waterworks outfall
    // wanting the junction's 'back' face when the ladder chain already occupies
    // it — retry against every already-placed room in every direction before
    // giving up. Purpose stays; only the attach point degrades.
    //
    // Two guards keep the fallback from breaking the plan's structure:
    //  1) NEVER fall back onto the ENTRANCE (room 0). Attaching a core room to
    //     the entrance would push its degree above 1 and break the
    //     entrance-degree-1 invariant (this is exactly the waterworks outfall
    //     bug: it used to land on the ladder-shaft).
    //  2) Start the candidate scan from the intended anchor's NEIGHBORHOOD
    //     (nearest placed rooms first) rather than index 0, so a boxed core room
    //     re-seats close to where the plan wanted it, not next to the gate.
    if (!placed) {
      const anchorRoom = anchor ?? st.rooms[st.rooms.length - 1];
      const acx = roomCx(anchorRoom);
      const acy = roomCy(anchorRoom);
      const candidates = st.rooms
        .filter((r) => r.id !== st.entranceId && r.id !== anchorRoom.id)
        .sort((a, b) => {
          const da = (roomCx(a) - acx) ** 2 + (roomCy(a) - acy) ** 2;
          const db = (roomCx(b) - acx) ** 2 + (roomCy(b) - acy) ** 2;
          return da - db;
        });
      // Prefer the intended anchor itself first (its non-requested faces), then
      // its nearest neighbors — but the entrance is excluded throughout.
      const scan = anchorRoom.id === st.entranceId ? candidates : [anchorRoom, ...candidates];
      const wantChannel =
        archetype === 'waterworks' && (spec.purpose === 'cistern' || spec.purpose === 'outfall');
      const floodBasin = spec.purpose === 'cistern';
      outer: for (const cand of scan) {
        for (const d of DIRS) {
          const channelCells: number[] | undefined = wantChannel ? [] : undefined;
          placed = attachRoom(st, rng, cand, placedSpec, d, channelCells);
          if (placed) {
            if (wantChannel) {
              for (const k of channelCells!) st.builtWater.add(k);
              if (floodBasin) addRoomWater(st, placed);
            }
            break outer;
          }
        }
      }
    }

    // After the pivot core room is placed, carve the mausoleum spine. (Waterworks
    // no longer carves a free-standing channel stub here: that stub hung no room,
    // so trimDanglingCorridors peeled it back to nothing and the map read DRY. The
    // real channels are now the junction→cistern and junction→outfall connectors,
    // captured and marked wet where those rooms attach — they serve doorways, so
    // they survive the trim and render as visible wet channels, per mock figure 5.)
    if (spineCells.length === 0 && carveSpineAfter && placed?.purpose === carveSpineAfter) {
      // Room-through-room wings (chains of galleries) hang off spine anchors spaced
      // SPINE_STRIDE apart. Each wing yields a head + a short chain, so the trunk
      // needs roughly (roomCount / avg-wing-size) anchors. Carve an initial trunk
      // long enough to seat them all, so the processional reads as one clean axis
      // (growSpine only folds a corner if this hits the grid rim). Capped to keep
      // the bounding box near-square (the aspect < 2.2 invariant).
      // Assume ~3.4 rooms per wing (head + a 2-4 chain). Keep the trunk SHORT so
      // the bounding box stays near-square: the perpendicular wings supply width,
      // and if the trunk runs out of anchors growSpine folds a lane to add more.
      const wantAnchors = Math.ceil(roomCount / 3.4);
      const spineLen = Math.min(
        st.side - 8,
        Math.max(SPINE_SEGMENT_CELLS, 4 + wantAnchors * SPINE_STRIDE),
      );
      const carved = attachSpine(st, placed, spineLen, st.flowDir);
      spineCells.push(...carved);
    }
  }

  // ── Repeat units until roomCount. Galleries hang off the spine (alternating
  //    sides); mine veins chase the flow (alternating axis); fortress passage-
  //    rooms cycle over placed CORE rooms so filler SPREADS, not chains.
  const corePurposes = new Set<RoomPurpose>(data.core.map((s) => s.purpose));
  placeRepeats(st, rng, archetype, data.core.length, roomCount, spineCells, corePurposes);

  // ── BUILT circulation (DEFECT A): the intact structure would otherwise be a
  //    pure tree — a corridor conga line where cycles only appear when a decay
  //    event digs a tunnel. Builders built loops: open extra doors between
  //    DIFFERENT rooms separated by a 1-2 cell wall gap, per archetype. These are
  //    cycle edges (isLoop:true) but NOT dug — they render as clean built doors.
  addBuiltLoops(st, circRng ?? rng, archetype, loopChance);

  // Trim any corridor/spine/channel run that terminates in the void — a "corridor
  // to nowhere" (DEFECT 2 & 3). A grown spine wing whose galleries all failed to
  // place, or a channel stub past its last served cell, leaves carved corridor
  // cells serving no doorway; prune them so no corridor ends without a room.
  trimDanglingCorridors(st);

  if (st.rooms.length < Math.floor(roomCount * 0.7)) return null;
  return st;
}

// ─── Built circulation (DEFECT A) ────────────────────────────────────────────

/**
 * Per-archetype built-loop count band at default loopChance (0.25), keyed to the
 * approved circulation flavor:
 *  - mine       : cross-cuts between parallel drifts.
 *  - mausoleum  : doors between adjacent burial galleries.
 *  - fortress   : wing interconnections / a partial ring.
 *  - waterworks : maintenance-walk interconnections.
 * `[min, max]` are the target loop counts at loopChance 0.25, roomCount ~42.
 */
const LOOP_BAND: Record<BuilderArchetype, readonly [number, number]> = {
  mine: [3, 6],
  mausoleum: [3, 6],
  fortress: [2, 5],
  waterworks: [2, 5],
};

/**
 * Open BUILT loop doors between DIFFERENT rooms sitting 1-2 wall cells apart in a
 * straight line — reusing the old growth generator's adjacency-scan idea. One
 * candidate per room pair (the middle one in scan order); carve the gap cells as
 * corridor floor (roomOf -2) and add a cycle edge (`isLoop:true`, `dug` UNSET —
 * these are clean built doors, not hand-cut robber tunnels).
 *
 * Density: the archetype's LOOP_BAND scaled by `loopChance / 0.25`, so a caller
 * dialing loopChance up/down moves the count proportionally. At loopChance 0 we
 * still open ≥ 1 cross-cut — the intact structure is NEVER a pure tree (the old
 * anti-goal). Candidates are selected evenly-strided across the (deterministic)
 * scan-ordered list so the loops spread spatially rather than clumping.
 *
 * The entrance is NEVER an endpoint (same rule as event tunnels) — keeping the
 * entrance at graph degree 1. The gap-carve is exempt from the 8-neighborhood
 * no-touch guard exactly as the old addLoops was: it opens a 1-2 cell hole
 * between two ALREADY-placed rooms, adding a doorway, not fusing rooms.
 */
export function addBuiltLoops(
  st: IntactState,
  rng: Rng,
  archetype: BuilderArchetype,
  loopChance: number,
): void {
  interface Cand { cells: number[]; a: number; b: number }
  const S = st.side;
  const byPair = new Map<string, Cand[]>();

  const roomAt = (k: number): number => (st.grid[k] === CellKind.Floor ? st.roomOf[k] : -1);

  // Cells inside ANY room's bounding box — a cross-cut carved through the void
  // corners of an ellipse/octagon/compound room (e.g. a cistern basin) would read
  // as a dry corridor cutting through the room and would leave a Floor cell the
  // built-water baseline never covers. Forbid candidates from touching these.
  // Used extent (room bounding boxes) — the built-loop scan only needs to look at
  // the occupied region, not the whole (generously oversized) working grid. On
  // the huge mausoleum grid this cuts the scan by an order of magnitude.
  const inBBox = new Uint8Array(S * S);
  let exMinX = S, exMinY = S, exMaxX = 0, exMaxY = 0;
  for (const r of st.rooms) {
    for (let j = 0; j < r.h; j++) {
      for (let i = 0; i < r.w; i++) inBBox[gi(r.x0 + i, r.y0 + j, S)] = 1;
    }
    if (r.x0 < exMinX) exMinX = r.x0;
    if (r.y0 < exMinY) exMinY = r.y0;
    if (r.x0 + r.w > exMaxX) exMaxX = r.x0 + r.w;
    if (r.y0 + r.h > exMaxY) exMaxY = r.y0 + r.h;
  }
  const scanX0 = Math.max(2, exMinX - 1);
  const scanY0 = Math.max(2, exMinY - 1);
  const scanX1 = Math.min(S - 2, exMaxX + 1);
  const scanY1 = Math.min(S - 2, exMaxY + 1);

  const push = (a: number, b: number, cells: number[]): void => {
    // NEVER touch the entrance — built loops must not raise its degree above 1.
    if (a === st.entranceId || b === st.entranceId) return;
    // Reject carves that run through a room's bounding-box interior void.
    for (const cell of cells) if (inBBox[cell]) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const arr = byPair.get(key) ?? [];
    arr.push({ cells, a: Math.min(a, b), b: Math.max(a, b) });
    byPair.set(key, arr);
  };

  for (let y = scanY0; y < scanY1; y++) {
    for (let x = scanX0; x < scanX1; x++) {
      const k = gi(x, y, S);
      if (st.grid[k] !== CellKind.Void) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        // gap of 1: floor A | void | floor B
        const a1 = roomAt(gi(x - dx, y - dy, S));
        const b1 = roomAt(gi(x + dx, y + dy, S));
        if (a1 >= 0 && b1 >= 0 && a1 !== b1) {
          push(a1, b1, [k]);
          continue;
        }
        // gap of 2: floor A | void void | floor B
        const k2 = gi(x + dx, y + dy, S);
        if (st.grid[k2] === CellKind.Void) {
          const b2 = roomAt(gi(x + dx * 2, y + dy * 2, S));
          if (a1 >= 0 && b2 >= 0 && a1 !== b2) { push(a1, b2, [k, k2]); continue; }
          // gap of 3: floor A | void void void | floor B (the mine's large
          // galleries with long corridors sit wider apart; a 3-cell cross-cut
          // keeps parallel drifts connectable so the mine is never a pure tree).
          const k3 = gi(x + dx * 2, y + dy * 2, S);
          if (st.grid[k3] === CellKind.Void) {
            const b3 = roomAt(gi(x + dx * 3, y + dy * 3, S));
            if (a1 >= 0 && b3 >= 0 && a1 !== b3) push(a1, b3, [k, k2, k3]);
          }
        }
      }
    }
  }

  // One candidate per room pair (the middle in scan order), skipping pairs the
  // tree already connects. Map preserves insertion (scan) order → deterministic.
  const existing = new Set(st.edges.map((e) => `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`));
  const chosen: Cand[] = [];
  for (const [key, cands] of byPair) {
    if (existing.has(key)) continue;
    chosen.push(cands[cands.length >> 1]);
  }
  // At high sprawl rooms float far apart, so short straight-gap cross-cuts are
  // rare and the loop network must be carved as full CORRIDOR LINKS (BFS through
  // void, 1-wide, honoring the no-touch guard) — this is what gives the sprawl
  // corridor network its own junctions/tees instead of only shared-wall doors.
  // Carve several links (scaled by sprawl) before/instead of relying on gaps.
  const sprawlLinks = st.sprawl >= 0.4 ? Math.round(1 + st.sprawl * 2) : 0;
  if (chosen.length === 0) {
    // No short straight-gap cross-cut anywhere (widely-spaced drifts at small
    // room counts, or a sprawled plan). The intact structure must NEVER be a
    // pure tree, so carve built cross-cut CORRIDOR LINKS between spatially-close
    // non-adjacent, non-entrance rooms (same no-touch guard as event tunnels).
    carveFallbackCrossCuts(st, existing, Math.max(1, sprawlLinks));
    return;
  }

  // Target count from the archetype band, scaled by loopChance. Round so 0.25
  // hits the band; clamp to what geometry offers; floor at 1 (never a pure tree).
  const [lo, hi] = LOOP_BAND[archetype];
  const scale = loopChance / 0.25;
  const targetF = lo + (hi - lo) * 0.5; // band midpoint at default density
  let target = Math.round(targetF * scale);
  target = Math.max(1, Math.min(target, chosen.length));

  // Even stride over the scan-ordered candidates → spatial spread. A tiny rng
  // jitter on the start index keeps different seeds from always taking the same
  // cells while staying deterministic per seed.
  const stride = Math.max(1, Math.floor(chosen.length / target));
  const start = rng.int(0, stride - 1);
  let opened = 0;
  for (let i = start; i < chosen.length && opened < target; i += stride) {
    const c = chosen[i];
    const key = `${c.a}-${c.b}`;
    if (existing.has(key)) continue;
    for (const cell of c.cells) {
      st.grid[cell] = CellKind.Floor;
      st.corridor[cell] = 1;
      st.roomOf[cell] = -2;
    }
    // isLoop:true (cycle edge, counts toward the cyclomatic invariant); dug UNSET
    // (a clean BUILT door, not a hand-cut robber tunnel — the drawer keys its
    // wobble on `dug`, so these render as clean built doors).
    const edge: DungeonEdge = { a: c.a, b: c.b, isLoop: true, isCritical: false };
    // COLLAPSE-SAFETY GUARD (room-through-room topology): simulateHistory's
    // collapse/brick-off events wall a cycle edge's corridor, which it REDISCOVERS
    // via a "corridor cells touching only {a,b}" BFS. In tightly packed
    // chained-suite plans, two non-tree-adjacent rooms can also be linked by a
    // LONG clean corridor touching only that pair — which is actually the
    // articulation corridor of a THIRD room's subtree. Walling it would strand
    // floor. Reject any loop whose rediscovered corridor is not floor-safe to
    // wall, and roll the carve back, before it becomes a shipped stranding.
    if (loopWallStrands(st, c.a, c.b)) {
      for (const cell of c.cells) {
        st.grid[cell] = CellKind.Void;
        st.corridor[cell] = 0;
        st.roomOf[cell] = -1;
      }
      continue;
    }
    st.edges.push(edge);
    existing.add(key);
    opened++;
  }

  // The guard above may have rejected EVERY short cross-cut (never-a-pure-tree is
  // then unmet). Fall back to the bounded BFS carve, which connects clean pair-
  // isolated channels; if that also strands, the honest outcome is a tree (an
  // extremely rare tiny-plan geometry). We re-check the fallback too.
  if (opened === 0) carveFallbackCrossCuts(st, existing, Math.max(1, sprawlLinks));
  // Sprawl always wants a few full corridor LINKS on top of the short gaps, so
  // the corridor network carries loops with real junctions/tees (Gozzys look),
  // not just doors between rooms sharing a wall.
  else if (sprawlLinks > 0) carveFallbackCrossCuts(st, existing, sprawlLinks);
}

/**
 * True when walling the corridor simulateHistory would rediscover for a built loop
 * between rooms `a` and `b` would strand FLOOR from the entrance. Mirrors
 * simulateHistory's `loopCorridorCells` (BFS over corridor cells whose room-floor
 * 4-neighbors are all in {a,b}) + its wall-then-reachability check, so the builder
 * never emits a loop that a later collapse/brick-off could not safely bring down.
 */
function loopWallStrands(st: IntactState, a: number, b: number): boolean {
  const S = st.side;
  const N4: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const roomsTouched = (cell: number): Set<number> => {
    const x = cell % S;
    const y = (cell / S) | 0;
    const s = new Set<number>();
    for (const [dx, dy] of N4) {
      const nk = gi(x + dx, y + dy, S);
      if (st.grid[nk] === CellKind.Floor && st.roomOf[nk] >= 0) s.add(st.roomOf[nk]);
    }
    return s;
  };
  const passable = (cell: number): boolean => {
    if (st.grid[cell] !== CellKind.Floor || st.roomOf[cell] !== -2) return false;
    for (const id of roomsTouched(cell)) if (id !== a && id !== b) return false;
    return true;
  };
  // Rediscover the pair-isolated corridor between a and b (same BFS as the sim).
  const prev = new Int32Array(st.grid.length).fill(-2);
  const q: number[] = [];
  for (let i = 0; i < st.roomOf.length; i++) {
    if (st.roomOf[i] !== -2 || st.grid[i] !== CellKind.Floor) continue;
    if (passable(i) && roomsTouched(i).has(a)) { prev[i] = -1; q.push(i); }
  }
  let hit = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const c = q[h];
    if (roomsTouched(c).has(b)) { hit = c; break; }
    const x = c % S;
    const y = (c / S) | 0;
    for (const [dx, dy] of N4) {
      const nk = gi(x + dx, y + dy, S);
      if (prev[nk] !== -2 || !passable(nk)) continue;
      prev[nk] = c;
      q.push(nk);
      if (roomsTouched(nk).has(b)) { hit = nk; break; }
    }
  }
  if (hit < 0) return false; // no pair-isolated corridor → sim can't pick this edge
  const walled = new Set<number>();
  for (let c = hit; c !== -1; c = prev[c]) walled.add(c);

  // Flood floor from the entrance with those cells walled; strands iff some floor
  // cell is unreachable.
  const e = st.rooms[st.entranceId];
  let seed = gi(roomCx(e), roomCy(e), S);
  if (st.grid[seed] !== CellKind.Floor) {
    for (let i = 0; i < st.roomOf.length; i++) {
      if (st.roomOf[i] === e.id && st.grid[i] === CellKind.Floor) { seed = i; break; }
    }
  }
  const seen = new Uint8Array(st.grid.length);
  const bq = [seed];
  seen[seed] = 1;
  for (let h = 0; h < bq.length; h++) {
    const c = bq[h];
    for (const d of [-1, 1, -S, S]) {
      const n = c + d;
      if (n < 0 || n >= st.grid.length || seen[n] || walled.has(n)) continue;
      if (st.grid[n] === CellKind.Floor) { seen[n] = 1; bq.push(n); }
    }
  }
  for (let i = 0; i < st.grid.length; i++) {
    if (st.grid[i] === CellKind.Floor && !walled.has(i) && !seen[i]) return true;
  }
  return false;
}

/**
 * Fallback for the "never a pure tree" guarantee when no short straight-gap
 * cross-cut exists (widely spaced rooms at small counts): carve ONE clean built
 * corridor between the two spatially-closest non-adjacent, non-entrance rooms via
 * a bounded BFS through VOID, honoring the SAME 8-neighborhood no-touch guard as
 * event tunnels (a cell is walkable only if its floor 4-neighbors all belong to
 * the pair). Adds the cycle edge (isLoop:true, dug UNSET — a built door). Opens
 * at most one loop; a no-op if even this finds no clean channel (honest).
 */
function carveFallbackCrossCuts(st: IntactState, existing: Set<string>, maxLinks: number): void {
  const S = st.side;
  const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  // Room adjacency from existing edges, to skip already-connected pairs.
  const adjacent = new Set(st.edges.map((e) => `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`));
  // Cells inside any room's bounding box (see addBuiltLoops) — the carve must not
  // run through a room's interior void (would read as a dry cut through a basin).
  const inBBox = new Uint8Array(S * S);
  for (const r of st.rooms) {
    for (let j = 0; j < r.h; j++) {
      for (let i = 0; i < r.w; i++) inBBox[gi(r.x0 + i, r.y0 + j, S)] = 1;
    }
  }

  // Candidate pairs: non-entrance, not already adjacent, sorted nearest-first.
  const rooms = st.rooms.filter((r) => r.id !== st.entranceId);
  const pairs: Array<{ a: Room; b: Room; d2: number }> = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
      if (adjacent.has(key) || existing.has(key)) continue;
      const dx = roomCx(a) - roomCx(b);
      const dy = roomCy(a) - roomCy(b);
      pairs.push({ a, b, d2: dx * dx + dy * dy });
    }
  }
  pairs.sort((p, q) => p.d2 - q.d2 || (p.a.id - q.a.id) || (p.b.id - q.b.id));

  // Void cells 4-adjacent to a room's floor — scanned over the room's BOUNDING
  // BOX only (not the whole grid), so this is O(room area) rather than O(side²).
  const roomById = new Map(st.rooms.map((r) => [r.id, r]));
  const adjacentVoid = (roomId: number): number[] => {
    const r = roomById.get(roomId);
    if (!r) return [];
    const out = new Set<number>();
    for (let y = r.y0; y < r.y0 + r.h; y++) {
      for (let x = r.x0; x < r.x0 + r.w; x++) {
        if (st.roomOf[gi(x, y, S)] !== roomId) continue;
        for (const [dx, dy] of N4) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 2 || ny < 2 || nx >= S - 2 || ny >= S - 2) continue;
          const nk = gi(nx, ny, S);
          if (st.grid[nk] === CellKind.Void) out.add(nk);
        }
      }
    }
    return [...out].sort((p, q) => p - q);
  };

  // Single reusable BFS-parent buffer + a generation stamp, so we never re-fill
  // an O(side²) array per candidate pair (the former hot spot at high sprawl on
  // the huge mausoleum grid). `seen[c] === gen` marks a cell visited this BFS.
  const prev = new Int32Array(st.grid.length);
  const seen = new Int32Array(st.grid.length);
  let gen = 0;

  let tried = 0;
  let opened = 0;
  for (const { a, b } of pairs) {
    if (opened >= maxLinks) break; // carved enough links for the sprawl level
    if (tried >= 16 + maxLinks * 4) break; // bounded geometry budget
    tried++;
    const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
    if (existing.has(key) || adjacent.has(key)) continue;
    // Bound the BFS to the pair's bounding box + a margin, so a link carve never
    // wanders across the (mostly-void) sprawl grid — keeps each carve O(window),
    // which is what holds the 60-room perf budget at sprawl 1.
    const winX0 = Math.min(a.x0, b.x0) - 4;
    const winY0 = Math.min(a.y0, b.y0) - 4;
    const winX1 = Math.max(a.x0 + a.w, b.x0 + b.w) + 4;
    const winY1 = Math.max(a.y0 + a.h, b.y0 + b.h) + 4;
    const walkable = (k: number): boolean => {
      if (st.grid[k] !== CellKind.Void || inBBox[k]) return false;
      const x = k % S;
      const y = (k / S) | 0;
      if (x < 2 || y < 2 || x >= S - 2 || y >= S - 2) return false;
      if (x < winX0 || y < winY0 || x >= winX1 || y >= winY1) return false;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const nk = gi(x + ox, y + oy, S);
          if (st.grid[nk] !== CellKind.Floor) continue;
          const owner = st.roomOf[nk];
          if (owner !== a.id && owner !== b.id) return false;
        }
      }
      return true;
    };
    const seeds = adjacentVoid(a.id).filter(walkable);
    const goalSet = new Set(adjacentVoid(b.id));
    if (seeds.length === 0 || goalSet.size === 0) continue;
    gen++;
    const q: number[] = [];
    for (const s of seeds) { seen[s] = gen; prev[s] = -1; q.push(s); }
    let hit = -1;
    for (let h = 0; h < q.length && hit < 0; h++) {
      const c = q[h];
      if (goalSet.has(c)) { hit = c; break; }
      const x = c % S;
      const y = (c / S) | 0;
      for (const [dx, dy] of N4) {
        const nk = gi(x + dx, y + dy, S);
        if (seen[nk] === gen || !walkable(nk)) continue;
        seen[nk] = gen;
        prev[nk] = c;
        q.push(nk);
        if (goalSet.has(nk)) { hit = nk; break; }
      }
    }
    if (hit < 0) continue;
    // The carved corridor is PAIR-ISOLATED by construction: `walkable` admits a
    // void cell only when every FLOOR 8-neighbor belongs to {a, b}. So no third
    // room ever touches it, and a later collapse/brick-off that walls it cannot
    // strand a third subtree's floor — the stranding case `loopWallStrands`
    // guards (a LONG clean corridor that is secretly a third room's articulation)
    // simply cannot arise here. We therefore commit the link without that O(cells)
    // rediscovery+flood check, which was the perf hot spot at full sprawl.
    for (let c = hit; c !== -1; c = prev[c]) {
      st.grid[c] = CellKind.Floor;
      st.corridor[c] = 1;
      st.roomOf[c] = -2;
    }
    st.edges.push({ a: a.id, b: b.id, isLoop: true, isCritical: false });
    existing.add(key);
    adjacent.add(key);
    opened++;
  }
}

/**
 * Remove dead-end corridor cells — the honest formulation of "no corridor may
 * terminate without a room" (DEFECT 2, and it also clips any over-long channel
 * stub, DEFECT 3). A corridor cell (roomOf === -2) is a DEAD END when it is a
 * leaf on the floor graph: it has at most one 4-neighbor that is itself another
 * corridor cell, and NONE of its 4-neighbors is a room-floor cell (roomOf >= 0).
 * A cell 4-adjacent to a room floor is a DOORWAY and is always kept — that is the
 * "serves a doorway" anchor. Pruning iterates to a fixed point, so a whole
 * dangling run peels back cell-by-cell to the last cell that reaches a room, and
 * junction cells (≥ 2 corridor neighbors) are never removed.
 *
 * Only carved cells are touched (grid Floor→Void, corridor→0, roomOf→-1); room
 * floors and the 8-neighborhood no-touch guarantee are left completely intact.
 */
export function trimDanglingCorridors(st: IntactState): void {
  const { side, grid, corridor, roomOf } = st;
  const isCorridor = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= side || y >= side) return false;
    const k = gi(x, y, side);
    return grid[k] === CellKind.Floor && roomOf[k] === -2;
  };
  const touchesRoom = (x: number, y: number): boolean => {
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= side || ny >= side) continue;
      if (roomOf[gi(nx, ny, side)] >= 0) return true;
    }
    return false;
  };

  let removedAny = true;
  while (removedAny) {
    removedAny = false;
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        if (!isCorridor(x, y)) continue;
        // A doorway (adjacent to a room floor) is a served terminus — keep it.
        if (touchesRoom(x, y)) continue;
        // Count corridor 4-neighbors; ≤ 1 means this cell is a leaf of the
        // corridor graph that reaches no room → a corridor to nowhere.
        let corridorNeighbors = 0;
        for (const [dx, dy] of DIRS) if (isCorridor(x + dx, y + dy)) corridorNeighbors++;
        if (corridorNeighbors > 1) continue; // junction / mid-run cell — keep
        const k = gi(x, y, side);
        grid[k] = CellKind.Void;
        corridor[k] = 0;
        roomOf[k] = -1;
        st.builtWater.delete(k);
        removedAny = true;
      }
    }
  }
}

/**
 * Cycle `repeat` specs until the room count. Interpretation of the archetype
 * anchor tokens for REPEATS (the data can't express these; documented here):
 *  - mausoleum spine galleries: anchor to evenly spaced points along the spine,
 *    alternating the branch side each placement (processional symmetry). When
 *    the current spine is spent, the spine GROWS — first a second segment
 *    continuing the flow axis, else a perpendicular branch spine — so the
 *    processional keeps extending instead of the build bailing short.
 *  - mine veins: `anchor:'prev'` chains off the last vein, but flowDir
 *    alternates [1,0]/[0,1] so the chain steps diagonally down-right.
 *  - fortress `anchor:'prev'` = "any already-placed CORE room", picked by
 *    cycling an index so filler spreads across wings. When the core anchors
 *    saturate, already-placed REPEAT rooms fold into the anchor pool so wings
 *    grow OUTWARD (hub stays central) rather than the build bailing short.
 *  - waterworks repeats: maintenance-walk chains off prev; passage-rooms branch.
 */
function placeRepeats(
  st: IntactState,
  rng: Rng,
  archetype: BuilderArchetype,
  coreLen: number,
  roomCount: number,
  spineCells: SpineCell[],
  corePurposes: Set<RoomPurpose>,
): void {
  const data = ARCHETYPES[archetype];
  if (data.repeat.length === 0) return;

  // Core rooms available as fortress-style spread anchors (skip the entrance so
  // filler doesn't all pile at the gate).
  const coreRooms = st.rooms.slice(1, coreLen);
  // Fortress spread anchors — starts as the core wings; grows to include placed
  // REPEAT rooms once the core saturates (see the fortress branch below).
  const spreadAnchors: Room[] = [...coreRooms];
  let coreCursor = 0;
  let spineCursor = 1;
  let side: 1 | -1 = 1; // alternating gallery side
  // Guards against spinning forever when the spine can no longer be extended
  // (grid fully boxed); after this many consecutive failed extensions we stop.
  let spineExtendFails = 0;

  // DEFECT A2 (chain topology): the mine forks into 2-3 PARALLEL drifts off the
  // hoist rather than stringing every gallery in one drift (which made the crit
  // path ≈ room count). Each drift chains 1/2-1/3 of the galleries and runs
  // roughly parallel toward down-flow, so the diagonal-descent look survives and
  // cross-cuts later connect neighboring drifts. driftHeads[i] is the last room
  // placed on drift i; a round-robin cursor spreads galleries across drifts.
  const hoist = findByPurpose(st, 'hoist');
  const nDrifts = roomCount >= 36 ? 3 : 2;
  const driftHeads: Room[] = [];
  if (hoist) for (let d = 0; d < nDrifts; d++) driftHeads.push(hoist);
  // Every drift steps down-AND-right (its axis alternates [1,0]/[0,1] per step),
  // so ALL drifts run the same diagonal descent and stay roughly PARALLEL — the
  // lateral offset between them comes from the different door positions on the
  // hoist wall. Parallel drifts sit within a cell or two of each other, which is
  // exactly the gap addBuiltLoops needs to open cross-cuts between them. (An
  // earlier version gave each drift a DIFFERENT fixed axis, which made them
  // diverge — no cross-cut geometry, so the mine could end a pure tree.)
  const driftFlip: boolean[] = new Array(nDrifts).fill(false);
  let driftCursor = 0;
  // Waterworks bounded-chain state (DEFECT A2): several short maintenance-walk
  // branches off the core hubs rather than one long conga.
  let waterChainLen = 0;
  let waterChainHead: Room | null = null;
  // Fortress: how many placed repeats have been folded into the spread pool as an
  // outward ring (bounded to keep wings from chaining arbitrarily deep).
  let foldedRing = 0;
  // Mid-depth timbered store-room + compound-chamber cadence (DEFECT B shape
  // variety): every Nth gallery becomes a rectilinear timbered room, every Mth a
  // compound chamber — spread across the depth range, not clustered.
  let galleryOrdinal = 0;
  // GOZZYS BLEND (all sprawl levels): a running ordinal drives an occasional
  // oversized hall (14-18), tiny closet (3-4), and octagon/diamond focal room —
  // strong size contrast + focal shapes, at low weight so they read as accents.
  let blendOrdinal = 0;

  const maxTries = roomCount * 40;
  let specIx = 0;
  for (let tries = 0; tries < maxTries && st.rooms.length < roomCount; tries++) {
    const spec = data.repeat[specIx % data.repeat.length];
    specIx++;

    // A repeat that reuses a CORE purpose is re-purposed generic so it never
    // inflates a core purpose's count (the test asserts EXPECTED instances per
    // purpose, and a core purpose's expected count comes only from `core`).
    // Repeat-native purposes (burial-gallery, vein-gallery, passage-room) may
    // recur freely — that's the whole point of the repeat program.
    let effectivePurpose = spec.purpose;
    if (corePurposes.has(spec.purpose)) effectivePurpose = 'passage-room';
    let placedSpec: RoomSpec = { ...spec, purpose: effectivePurpose };
    placedSpec = gozzysBlend(placedSpec, blendOrdinal++);

    if (archetype === 'mausoleum' && spec.anchor === 'spine' && spineCells.length > 0) {
      // Galleries branch off the spine at a fixed stride, alternating side each
      // placement so they hang off both flanks (processional symmetry). The
      // stride (≈ a gallery's own height) keeps adjacent galleries from
      // colliding; a pair (both sides) advances the anchor down the spine.
      const n = spineCells.length;
      const anchorIx = 2 + spineCursor * SPINE_STRIDE;
      if (anchorIx >= n - 1) {
        // Trunk spent — GROW the skeleton by BRANCHING a perpendicular wing off
        // the far end (alternating left/right), so the footprint spreads two-
        // dimensionally like catacomb wings instead of running off as one worm
        // (DEFECT 1). growSpine caps each straight run at SPINE_SEGMENT_CELLS and
        // prefers a perpendicular turn; galleries then hang off the new wing.
        const grew = growSpine(st, spineCells);
        if (grew) { spineExtendFails = 0; continue; }
        spineExtendFails++;
        if (spineExtendFails >= 2) break; // truly boxed — honest shortfall
        continue;
      }
      const at = spineCells[anchorIx];
      // Perpendicular to THIS cell's LOCAL segment direction (a bent spine hangs
      // its galleries off the correct flanks of each wing).
      const [ldx, ldy] = at.dir;
      const perp: readonly [number, number] =
        Math.abs(ldx) > Math.abs(ldy) ? [0, side] : [side, 0];
      side = (side === 1 ? -1 : 1);
      spineCursor++;
      const spineOriginId = findSpineOrigin(st);
      // ROOM-THROUGH-ROOM WINGS (Remy critique #1): a wing is a CHAIN of galleries.
      // The first gallery hangs off the spine anchor; then 1-3 more galleries chain
      // DIRECTLY off the previous gallery through a shared-wall door (corridor
      // [0,1]), so the player walks the spine briefly, then moves gallery → gallery
      // → gallery with no hall between. The chain runs deeper along the same
      // perpendicular flank (away from the spine), giving each wing a spine-normal
      // spread. A 2-4 cell void gap between wings falls out naturally from the
      // SPINE_STRIDE spacing, so the silhouette is notched, not a solid slab.
      // The wing HEAD attaches with a short set-back connector (2-3 cells), NOT a
      // shared-wall door: this lifts the gallery box OFF the spine so its side wall
      // does not run parallel-adjacent to the spine corridor. Without the set-back,
      // a LEFT-flank and a RIGHT-flank gallery at nearby strides can sandwich a run
      // of spine cells so that stretch is flanked ONLY by that gallery pair — which
      // a later collapse/brick-off would mistake for a redundant loop and wall,
      // cutting the spine and stranding the deep rooms (ossuary/wings) beyond it.
      // The set-back keeps every spine cell touching the spine's own room, not a
      // gallery pair. The room-through-room CHAIN (below) still butts gallery to
      // gallery through shared-wall doors — only the spine attach is set back.
      const headSpec: RoomSpec = { ...placedSpec, corridor: [2, 3] };
      const head = attachRoomAtSpineCell(
        st, rng, at.x, at.y, perp[0], perp[1], headSpec, effectivePurpose, spineOriginId,
      );
      if (head) {
        // Chain depth 2-4 further galleries off the wing head. Deterministic draw
        // from the build stream; capped so a wing does not run the room budget dry.
        // Deeper chains widen each wing perpendicular to the trunk, which balances
        // the bounding box against the trunk length (aspect < 2.2 invariant).
        const chainDepth = rng.int(2, 4);
        let link = head;
        for (let c = 0; c < chainDepth && st.rooms.length < roomCount; c++) {
          // Continue the wing outward (same perpendicular flank), falling back to
          // the flow axis if boxed — attachRoom's orderedDirs handles the retry.
          const next = attachRoom(st, rng, link, placedSpec, perp);
          if (!next) break;
          link = next;
        }
      }
      continue;
    }

    if (archetype === 'mine') {
      // Multi-drift vein chase (DEFECT A2). Round-robin over the drift heads so
      // galleries spread across 2-3 parallel drifts forking off the hoist; each
      // drift steps down-flow along its own axis. This shortens the critical path
      // (galleries no longer form one long chain) and gives ≥ nDrifts leaf tips.
      const di = driftCursor % driftHeads.length;
      driftCursor++;
      // Per-drift alternating axis → diagonal down-right descent, parallel across
      // drifts (so cross-cuts between neighboring drifts have a 1-2 cell gap).
      const axis: readonly [number, number] = driftFlip[di] ? [0, 1] : [1, 0];
      driftFlip[di] = !driftFlip[di];
      st.flowDir = axis;

      // DEFECT B shape variety: mostly organic ellipse galleries, but an
      // occasional rectilinear timbered store-room (mid-depth) and an occasional
      // compound chamber, so the workings read varied, not an egg carton.
      const ord = galleryOrdinal++;
      const isTimbered = ord >= 3 && ord % 5 === 2; // rectilinear tool-store-like
      const isCompound = ord >= 2 && ord % 4 === 0; // irregular compound chamber
      const shapedSpec: RoomSpec = isTimbered
        ? { ...placedSpec, shape: 'rect', w: [4, 6], h: [4, 6] }
        : isCompound
          ? { ...placedSpec, shape: 'compound' }
          : placedSpec;

      const anchor = driftHeads[di] ?? st.rooms[st.rooms.length - 1];
      let placed = attachRoom(st, rng, anchor, shapedSpec, axis);
      // If this drift head is boxed in, try the OTHER down-flow axis off the same
      // head before re-anchoring elsewhere (keeps the drift going straight-ish).
      if (!placed) {
        const alt = axis[0] === 1 ? ([0, 1] as const) : ([1, 0] as const);
        placed = attachRoom(st, rng, anchor, shapedSpec, alt);
      }
      // Still boxed: BRANCH off an earlier vein room (deepest-first) so a new fork
      // chases the ore instead of stalling. Preserves the diagonal descent.
      if (!placed) {
        for (let bi = st.rooms.length - 1; bi >= 1 && !placed; bi--) {
          for (const d of ([[1, 0], [0, 1]] as const)) {
            placed = attachRoom(st, rng, st.rooms[bi], shapedSpec, d);
            if (placed) break;
          }
        }
      }
      // Advance this drift's head to the newly placed gallery so the drift chains.
      if (placed) driftHeads[di] = placed;
      continue;
    }

    if (archetype === 'fortress') {
      // Spread filler over already-placed rooms (cycle the cursor). The pool
      // starts as the core wings; once we have cycled a full lap without room to
      // spare, placed REPEAT rooms join the pool so wings grow OUTWARD from the
      // hub. The hub (great-hall) stays central because filler never re-anchors
      // on the gatehouse/entrance — spreadAnchors excludes room 0 by construction
      // (coreRooms = slice(1, coreLen)) and appended repeats are outer wings.
      const pool = spreadAnchors.length > 0 ? spreadAnchors : [st.rooms[st.rooms.length - 1]];
      const anchor = pool[coreCursor % pool.length];
      coreCursor++;
      const dir = resolveDir(st, rng, spec.dir);
      const placed = attachRoom(st, rng, anchor, placedSpec, dir);
      // Fold this wing room back into the anchor pool only ONCE the core anchors
      // are saturated, and only for the FIRST outward ring (DEFECT A2): folding
      // every placed repeat let wings chain arbitrarily deep, pushing the critical
      // path over the room count. Keeping the pool = core rooms + one outward ring
      // holds the hub central and the diameter short; built loops shortcut the
      // rest. `foldedRing` bounds the appended ring to the core-anchor count.
      if (
        placed &&
        coreCursor >= coreRooms.length &&
        foldedRing < coreRooms.length * 2 &&
        spreadAnchors.length < roomCount
      ) {
        spreadAnchors.push(placed);
        foldedRing++;
      }
      continue;
    }

    // waterworks & fallback (DEFECT A2): the maintenance walks used to chain off
    // 'prev' in ONE long line, so the critical path ran ≈ room count. Instead run
    // SEVERAL short branches off the core hubs (junction/cisterns/outfall): keep a
    // bounded local chain, then re-seat on the next core anchor. This turns the
    // undercity into a hub with radiating walks rather than a single worm, so the
    // entrance→deepest path stays well under the room count.
    const CHAIN_CAP = 3; // walks per branch before re-seating on a core hub
    let anchor: Room;
    if (spec.anchor === 'prev' && waterChainLen < CHAIN_CAP && waterChainHead) {
      anchor = waterChainHead;
      waterChainLen++;
    } else {
      anchor = coreRooms.length > 0
        ? coreRooms[coreCursor++ % coreRooms.length]
        : st.rooms[st.rooms.length - 1];
      waterChainLen = 0;
    }
    const dir = resolveDir(st, rng, spec.dir);
    const placed = attachRoom(st, rng, anchor, placedSpec, dir);
    if (placed) waterChainHead = placed;
  }
}

/**
 * Grow the mausoleum spine when a trunk's gallery anchors run out. Unlike the old
 * "continue the flow axis" growth (which produced the one-dimensional worm Remy
 * rejected), this BRANCHES a fresh perpendicular wing off the far end first,
 * ALTERNATING left/right so the skeleton fans out two-dimensionally like real
 * catacomb wings (DEFECT 1). Continuing the trunk axis is kept only as a last
 * resort when both perpendicular turns are boxed against the grid.
 *
 * The turn side alternates deterministically off the number of bends already in
 * the spine (no extra mutable state, so determinism holds). Each new run is
 * capped at SPINE_SEGMENT_CELLS so no single straight run dominates the plan.
 *
 * Appends the new cells (tagged with the new segment's local dir) to `spineCells`
 * in place and returns true if it grew.
 */
function growSpine(st: IntactState, spineCells: SpineCell[]): boolean {
  const end = spineCells[spineCells.length - 1];
  const [fx, fy] = end.dir; // current lane's flow axis
  // How many lanes (trunk runs) already exist = number of trunk→jog bends / 2.
  // Lanes march to alternating flanks of the ORIGINAL trunk so the plan is a
  // compact boustrophedon block (a comb of parallel processional lanes) rather
  // than one endless worm — bounding box stays near-square (DEFECT 1).
  let laneShifts = 0;
  for (let i = 1; i < spineCells.length; i++) {
    const a = spineCells[i - 1].dir;
    const b = spineCells[i].dir;
    if (a[0] !== b[0] || a[1] !== b[1]) laneShifts++;
  }
  // A lane pair = jog + return-run; the shift side flips every lane so lanes
  // fan out both ways from the seed trunk.
  const shiftSide = (Math.floor(laneShifts / 2) % 2 === 0) ? 1 : -1;
  // Perpendicular unit to the flow axis, on the chosen side.
  const perp: readonly [number, number] =
    Math.abs(fx) > Math.abs(fy) ? [0, shiftSide] : [shiftSide, 0];

  const rollBack = (cells: SpineCell[]): void => {
    for (const c of cells) {
      const idx = gi(c.x, c.y, st.side);
      st.grid[idx] = CellKind.Void;
      st.corridor[idx] = 0;
      st.roomOf[idx] = -1;
    }
  };

  // ROOM-THROUGH-ROOM COMPOSITION: the galleries are now CHAINS spreading
  // perpendicular off the spine (see placeRepeats), so the 2-D spread comes from
  // the WINGS, not from the spine folding into parallel lanes. The spine wants to
  // stay a SHORT-ish processional TRUNK that keeps yielding wing anchors. So the
  // primary growth is a straight flow-axis continuation; the perpendicular
  // jog+lane fold is the FALLBACK for when the trunk hits the grid rim (it then
  // turns a corner and keeps the processional going the other way).
  const straight = growSegmentFrom(st, end, [fx, fy], SPINE_SEGMENT_CELLS);
  if (straight.length >= 8) {
    spineCells.push(...straight);
    return true;
  }
  rollBack(straight);

  // Fallback: fold a perpendicular lane (jog to clear a wing column, then a lane
  // back along the reverse flow axis). Try the chosen side, then the other.
  const attempts: ReadonlyArray<{ jog: readonly [number, number]; lane: readonly [number, number] }> = [
    { jog: perp, lane: [-fx, -fy] },
    { jog: [-perp[0], -perp[1]], lane: [-fx, -fy] },
  ];
  for (const { jog, lane } of attempts) {
    const jogCells = growSegmentFrom(st, end, jog, SPINE_LANE_GAP);
    if (jogCells.length < SPINE_LANE_GAP) { rollBack(jogCells); continue; } // couldn't clear a column
    const laneStart = jogCells[jogCells.length - 1];
    const laneCells = growSegmentFrom(st, laneStart, lane, SPINE_SEGMENT_CELLS);
    if (laneCells.length < 8) {
      // Roll back the jog we just carved — a jog with no lane is a dead stub.
      rollBack(jogCells);
      continue;
    }
    spineCells.push(...jogCells, ...laneCells);
    return true;
  }
  return false;
}

/**
 * Carve one straight spine segment (≤ SPINE_SEGMENT_CELLS) starting one cell out
 * from `at` along `dir`, over void only. Returns the tagged cells (empty if the
 * run is too short to be worth a wing). The first cell is orthogonally adjacent
 * to `at` (a -2 spine cell), so the skeleton stays one connected floor run.
 */
function growSegmentFrom(
  st: IntactState,
  at: Cell,
  dir: readonly [number, number],
  maxLen: number = SPINE_SEGMENT_CELLS,
): SpineCell[] {
  const [dx, dy] = dir;
  const cells: SpineCell[] = [];
  let cx = at.x + dx;
  let cy = at.y + dy;
  for (let k = 0; k < maxLen; k++) {
    if (cx < 2 || cy < 2 || cx >= st.side - 2 || cy >= st.side - 2) break;
    const idx = gi(cx, cy, st.side);
    if (st.grid[idx] !== CellKind.Void) break;
    cells.push({ x: cx, y: cy, dir });
    cx += dx;
    cy += dy;
  }
  if (cells.length < 8) return []; // not enough room to be worth a segment
  for (const c of cells) {
    const idx = gi(c.x, c.y, st.side);
    st.grid[idx] = CellKind.Floor;
    st.corridor[idx] = 1;
    st.roomOf[idx] = -2;
  }
  return cells;
}

/**
 * The spine belongs to its origin room. We recover that origin as the room
 * whose exit face the spine started from — in practice the room carrying the
 * `carveSpineAfter` purpose (chapel / junction). Falls back to the entrance.
 */
function findSpineOrigin(st: IntactState): number {
  const chapel = st.rooms.find((r) => r.purpose === 'chapel');
  if (chapel) return chapel.id;
  const junction = st.rooms.find((r) => r.purpose === 'junction');
  if (junction) return junction.id;
  return st.entranceId;
}
