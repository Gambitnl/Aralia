/**
 * @file generateInterior.ts
 * @description L4 interior generator — deterministic BSP room-packing of a
 * TownPlan plot footprint (SPEC §4 L4, decisions #10/#11/#12).
 *
 * How it works:
 * 1. The plot's quad footprint is reduced to a local rectangle: width along
 *    the frontage edge (corners 0→1, the street wall), depth along corners
 *    0→3, both snapped DOWN to the 5 ft grid. Town plots are generated as
 *    rotated rectangles, so this loses only the sub-cell remainder.
 * 2. The rectangle is split recursively (BSP) on 5 ft aligned lines until
 *    leaves fall under a target room area; each split records one doorway
 *    connecting the two halves, so the doorway graph is a spanning tree —
 *    every room is reachable from every other by construction.
 * 3. The entry door sits on the street wall (y = 0) in whichever room owns
 *    the frontage center — the same wall + center the 3D renderer already
 *    draws the exterior door on, so exterior and interior agree seamlessly.
 * 4. Rooms get roles from the plot role (market → shopfloor-first, house →
 *    hall-first) and a furnishing table per role places props against
 *    deterministic walls.
 *
 * Determinism: every random draw comes from rngFromPath over
 * childSeedPath(seedPath, `interior:<plotId>`) streams — same plot, same
 * seed path → byte-identical plan.
 */

import { childSeedPath, rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { Feet } from '../units';
import {
  EXTERIOR,
  type InteriorDoorway,
  type InteriorFurnishing,
  type InteriorPlan,
  type InteriorRoom,
  type RoomRole,
} from './types';

/** Atomic grid (decision #12). */
const CELL_FT = 5;
/** Smallest allowed room side. */
const MIN_ROOM_FT = 10;

export interface InteriorPlotInput {
  id: number;
  /** Closed quad, [x, y] feet, corners 0-1 = street frontage (TownPlan contract). */
  footprint: Array<[Feet, Feet]>;
  role: string;
  storeys: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

const snapDown = (v: number): number => Math.floor(v / CELL_FT) * CELL_FT;
const snap = (v: number): number => Math.round(v / CELL_FT) * CELL_FT;

export function generateInterior(plot: InteriorPlotInput, seedPath: SeedPath): InteriorPlan {
  const interiorPath = childSeedPath(seedPath, `interior:${plot.id}`);

  // Local envelope from the footprint's edge lengths (rotation-free frame).
  const [c0, c1, , c3] = plot.footprint;
  const widthFt = Math.max(MIN_ROOM_FT, snapDown(Math.hypot(c1[0] - c0[0], c1[1] - c0[1])));
  const depthFt = Math.max(MIN_ROOM_FT, snapDown(Math.hypot(c3[0] - c0[0], c3[1] - c0[1])));

  // ── Rooms: BSP split with one doorway per split (spanning tree) ──────
  const roomRng = rngFromPath(streamPath(interiorPath, 'rooms'));
  // Room budget by role and floor area: a 60×45 house wants ~4 rooms, not a
  // 16-cell warren (first render proved the old fixed 260 sq ft target wrong).
  // targetArea is what a leaf must EXCEED to keep splitting, so it sits a
  // little above area/budget; ±15% per-plot jitter varies the packing.
  const isMarket = plot.role === 'market';
  const floorArea = widthFt * depthFt;
  const roomBudget = Math.min(isMarket ? 8 : 6, Math.max(2, Math.round(floorArea / 700)));
  const targetArea = (floorArea / roomBudget) * 1.15 * (0.85 + roomRng.next() * 0.3);

  const rects: Rect[] = [];
  const doorways: InteriorDoorway[] = [];

  const split = (r: Rect): number[] => {
    // Corridor guard: rooms over 2.5:1 keep splitting even under the area
    // target (the first render produced 10×60 "bedrooms" without this).
    const aspect = Math.max(r.w, r.d) / Math.min(r.w, r.d);
    const splittable =
      (r.w * r.d > targetArea || aspect > 2.5) &&
      (r.w >= MIN_ROOM_FT * 2 || r.d >= MIN_ROOM_FT * 2);
    if (!splittable) {
      rects.push(r);
      return [rects.length - 1];
    }

    // Split the longer axis at a 5 ft aligned position keeping MIN on both sides.
    const alongW = r.w >= r.d ? r.w >= MIN_ROOM_FT * 2 : !(r.d >= MIN_ROOM_FT * 2);
    const len = alongW ? r.w : r.d;
    const lo = MIN_ROOM_FT;
    const hi = len - MIN_ROOM_FT;
    const pos = snap(lo + roomRng.next() * (hi - lo));
    const cut = Math.min(hi, Math.max(lo, pos));

    const a: Rect = alongW ? { ...r, w: cut } : { ...r, d: cut };
    const b: Rect = alongW
      ? { x: r.x + cut, y: r.y, w: r.w - cut, d: r.d }
      : { x: r.x, y: r.y + cut, w: r.w, d: r.d - cut };

    const idsA = split(a);
    const idsB = split(b);

    // Doorway across the cut line: pick the A/B leaf pair with the longest
    // shared wall, put the door at the snapped center of the overlap.
    const line = alongW ? r.x + cut : r.y + cut;
    let best: { ia: number; ib: number; lo: number; hi: number } | null = null;
    for (const ia of idsA) {
      const ra = rects[ia];
      const touchesA = alongW ? ra.x + ra.w === line : ra.y + ra.d === line;
      if (!touchesA) continue;
      for (const ib of idsB) {
        const rb = rects[ib];
        const touchesB = alongW ? rb.x === line : rb.y === line;
        if (!touchesB) continue;
        const oLo = Math.max(alongW ? ra.y : ra.x, alongW ? rb.y : rb.x);
        const oHi = Math.min(
          alongW ? ra.y + ra.d : ra.x + ra.w,
          alongW ? rb.y + rb.d : rb.x + rb.w,
        );
        if (oHi - oLo <= 0) continue;
        if (!best || oHi - oLo > best.hi - best.lo) best = { ia, ib, lo: oLo, hi: oHi };
      }
    }
    if (best) {
      const at = snap((best.lo + best.hi) / 2);
      const doorAt = Math.min(best.hi - CELL_FT / 2, Math.max(best.lo + CELL_FT / 2, at));
      doorways.push(
        alongW
          ? { a: best.ia, b: best.ib, x: line, y: doorAt, axis: 'y' }
          : { a: best.ia, b: best.ib, x: doorAt, y: line, axis: 'x' },
      );
    }
    return [...idsA, ...idsB];
  };

  split({ x: 0, y: 0, w: widthFt, d: depthFt });

  // ── Entry door: street wall (y=0), frontage center — matches the 3D shell ──
  const frontX = widthFt / 2;
  let entryIdx = 0;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.y === 0 && r.x <= frontX && frontX <= r.x + r.w) {
      entryIdx = i;
      break;
    }
  }
  const entry = rects[entryIdx];
  const entryDoorX = Math.min(
    entry.x + entry.w - CELL_FT / 2,
    Math.max(entry.x + CELL_FT / 2, snap(entry.x + entry.w / 2)),
  );
  doorways.unshift({ a: EXTERIOR, b: entryIdx, x: entryDoorX, y: 0, axis: 'x' });

  // ── Roles: entry room from plot role, rest by size order ──────────────
  const roles: RoomRole[] = new Array(rects.length);
  roles[entryIdx] = isMarket ? 'shopfloor' : 'hall';
  const rest = rects
    .map((r, i) => ({ i, area: r.w * r.d }))
    .filter(({ i }) => i !== entryIdx)
    .sort((p, q) => q.area - p.area || p.i - q.i);
  const sequence: RoomRole[] = isMarket
    ? ['storage', 'workshop', 'bedroom', 'storage', 'bedroom']
    : ['kitchen', 'bedroom', 'storage', 'bedroom', 'bedroom'];
  rest.forEach(({ i }, k) => {
    roles[i] = sequence[Math.min(k, sequence.length - 1)];
  });

  const rooms: InteriorRoom[] = rects.map((r, i) => ({
    id: i,
    role: roles[i],
    x: r.x,
    y: r.y,
    w: r.w,
    d: r.d,
  }));

  // ── Furnishings: per-role table, placed against deterministic walls ───
  const furnishRng = rngFromPath(streamPath(interiorPath, 'furnish'));
  const furnishings: InteriorFurnishing[] = [];
  for (const room of rooms) {
    furnishings.push(...furnishRoom(room, furnishRng));
  }

  // Keep doorways passable: the per-role furnishing tables place props against
  // fixed walls, blind to where the doors landed, so ~1 in 6 doors ended up with
  // a hearth/shelf/bed on its threshold. Drop any prop sitting on a doorway it
  // shares a room with (door cell + the approach cell), so an agent can walk
  // through and the 3D renderer never buries a door behind furniture.
  const clearFurnishings = furnishings.filter((f) =>
    !doorways.some((dr) =>
      (dr.a === f.roomId || dr.b === f.roomId) &&
      Math.abs(f.x - dr.x) < CELL_FT && Math.abs(f.y - dr.y) < CELL_FT,
    ),
  );

  return {
    plotId: plot.id,
    widthFt,
    depthFt,
    storeys: plot.storeys,
    rooms,
    doorways,
    furnishings: clearFurnishings,
  };
}

/** One props pass per room. Positions are room-interior feet, wall-snapped. */
function furnishRoom(room: InteriorRoom, rng: { next(): number }): InteriorFurnishing[] {
  const out: InteriorFurnishing[] = [];
  const cx = room.x + room.w / 2;
  const cy = room.y + room.d / 2;
  const backY = room.y + room.d - CELL_FT / 2; // against the inner (back) wall
  const sideX = rng.next() < 0.5 ? room.x + CELL_FT / 2 : room.x + room.w - CELL_FT / 2;
  const put = (kind: string, x: number, y: number, rotation: 0 | 90 | 180 | 270) =>
    out.push({ kind, roomId: room.id, x, y, rotation });

  switch (room.role) {
    case 'hall':
      put('table', snap(cx), snap(cy), 0);
      put('hearth', sideX, snap(cy), sideX < cx ? 90 : 270);
      break;
    case 'shopfloor':
      put('counter', snap(cx), room.y + CELL_FT * 1.5, 0);
      put('shelf', snap(cx), backY, 180);
      break;
    case 'kitchen':
      put('hearth', snap(cx), backY, 180);
      put('barrel', room.x + CELL_FT / 2, room.y + CELL_FT / 2, 0);
      break;
    case 'bedroom':
      put('bed', room.x + CELL_FT, room.y + room.d - CELL_FT, 180);
      put('chest', room.x + CELL_FT, room.y + CELL_FT / 2, 0);
      break;
    case 'storage':
      put('barrel', room.x + CELL_FT / 2, room.y + CELL_FT / 2, 0);
      put('crate', room.x + room.w - CELL_FT / 2, backY, 0);
      break;
    case 'workshop':
      put('workbench', snap(cx), backY, 180);
      break;
  }
  return out;
}
