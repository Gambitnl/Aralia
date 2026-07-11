/**
 * @file intact/attach.ts
 * @description Spine / corridor growth — direction resolution, the directed
 * `attachRoom`/`attachRoomAtSpineCell` placers (with the VERBATIM 8-neighborhood
 * no-touch validation), spine/channel runs, spine growth, and anchor resolution.
 * Extracted VERBATIM from buildIntact.ts (packet W1-P6). Move-only: every body is
 * byte-identical to the original, so the seeded draw order inside each placement
 * attempt is unchanged. `attachRoom`/`attachSpine` were already public (re-exported
 * by `../buildIntact`); `resolveDir`/`attachRoomAtSpineCell`/`findByPurpose`/
 * `growSpine`/`findSpineOrigin` were file-internal and are exported here so the
 * builder + repeat modules can import them.
 */

import {
  DIRS,
  bakeMask,
  gi,
  roomCx,
  roomCy,
  stampRoom,
  SPINE_LANE_GAP,
  SPINE_SEGMENT_CELLS,
  type IntactState,
  type Room,
  type SpineCell,
} from './primitives';
import type { Rng } from './rng';
import { sprawlCorLen, sprawlElbow } from './sprawl';
import { CellKind, type Cell, type RoomPurpose, type RoomShape } from '../types';
import { type RoomSpec } from '../archetypes';

// ─── Direction resolution ────────────────────────────────────────────────────

/** Resolve a spec's `dir` token against the plan's flow axis. */
export function resolveDir(
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
export function attachRoomAtSpineCell(
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
export function findByPurpose(st: IntactState, purpose: RoomPurpose): Room | undefined {
  return st.rooms.find((r) => r.purpose === purpose);
}

// ─── Spine growth ────────────────────────────────────────────────────────────

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
export function growSpine(st: IntactState, spineCells: SpineCell[]): boolean {
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
export function findSpineOrigin(st: IntactState): number {
  const chapel = st.rooms.find((r) => r.purpose === 'chapel');
  if (chapel) return chapel.id;
  const junction = st.rooms.find((r) => r.purpose === 'junction');
  if (junction) return junction.id;
  return st.entranceId;
}
