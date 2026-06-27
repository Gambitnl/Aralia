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
  type InteriorFloor,
  type InteriorFurnishing,
  type InteriorPlan,
  type InteriorRoom,
  type InteriorStair,
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

interface FloorLayout {
  rooms: InteriorRoom[];
  doorways: InteriorDoorway[];
  furnishings: InteriorFurnishing[];
  /** Index of the anchor room: the street-entry room (ground) or the stair landing (upper). */
  anchorRoomId: number;
}

/** The room rect index containing a plot-local point (half-open, clamped). */
function rectAtPoint(rects: Rect[], x: number, y: number): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d) return i;
  }
  return 0;
}

/**
 * BSP-pack one floor of `widthFt × depthFt` into rooms + a doorway spanning tree,
 * assign roles, furnish, and keep doorways (and the stair, if any) clear. The
 * ground floor (`opts.ground`) gets a street entry door and role flavor from the
 * plot; an upper floor has no street door — its anchor is the room the stair
 * lands in, and its rooms are sleeping quarters. `basePath` seeds the floor, so
 * passing the building's interior path reproduces the original ground floor
 * byte-for-byte while each upper floor draws from its own stream.
 */
function buildFloor(
  basePath: SeedPath,
  widthFt: number,
  depthFt: number,
  isMarket: boolean,
  opts: { ground: boolean; stair?: { x: number; y: number } },
): FloorLayout {
  const roomRng = rngFromPath(streamPath(basePath, 'rooms'));
  const floorArea = widthFt * depthFt;
  const roomBudget = Math.min(isMarket ? 8 : 6, Math.max(2, Math.round(floorArea / 700)));
  const targetArea = (floorArea / roomBudget) * 1.15 * (0.85 + roomRng.next() * 0.3);

  const rects: Rect[] = [];
  const doorways: InteriorDoorway[] = [];

  const split = (r: Rect): number[] => {
    const aspect = Math.max(r.w, r.d) / Math.min(r.w, r.d);
    const splittable =
      (r.w * r.d > targetArea || aspect > 2.5) &&
      (r.w >= MIN_ROOM_FT * 2 || r.d >= MIN_ROOM_FT * 2);
    if (!splittable) {
      rects.push(r);
      return [rects.length - 1];
    }
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

  // Anchor room: ground = the street-entry room; upper = the room the stair lands in.
  let anchorRoomId = 0;
  if (opts.ground) {
    const frontX = widthFt / 2;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.y === 0 && r.x <= frontX && frontX <= r.x + r.w) { anchorRoomId = i; break; }
    }
    const entry = rects[anchorRoomId];
    const entryDoorX = Math.min(
      entry.x + entry.w - CELL_FT / 2,
      Math.max(entry.x + CELL_FT / 2, snap(entry.x + entry.w / 2)),
    );
    doorways.unshift({ a: EXTERIOR, b: anchorRoomId, x: entryDoorX, y: 0, axis: 'x' });
  } else if (opts.stair) {
    anchorRoomId = rectAtPoint(rects, opts.stair.x, opts.stair.y);
  }

  // Roles: anchor leads (shopfloor on a ground market, else hall/landing); the
  // rest follow a per-context sequence (upper floors are sleeping quarters).
  const roles: RoomRole[] = new Array(rects.length);
  roles[anchorRoomId] = isMarket && opts.ground ? 'shopfloor' : 'hall';
  const rest = rects
    .map((r, i) => ({ i, area: r.w * r.d }))
    .filter(({ i }) => i !== anchorRoomId)
    .sort((p, q) => q.area - p.area || p.i - q.i);
  const sequence: RoomRole[] = !opts.ground
    ? ['bedroom', 'bedroom', 'storage', 'bedroom', 'bedroom']
    : isMarket
      ? ['storage', 'workshop', 'bedroom', 'storage', 'bedroom']
      : ['kitchen', 'bedroom', 'storage', 'bedroom', 'bedroom'];
  rest.forEach(({ i }, k) => {
    roles[i] = sequence[Math.min(k, sequence.length - 1)];
  });

  const rooms: InteriorRoom[] = rects.map((r, i) => ({
    id: i, role: roles[i], x: r.x, y: r.y, w: r.w, d: r.d,
  }));

  // Furnishings, then keep doorways AND the stair cell clear (props placed blind
  // to door/stair positions would otherwise block a threshold or the landing).
  const furnishRng = rngFromPath(streamPath(basePath, 'furnish'));
  const furnishings: InteriorFurnishing[] = [];
  for (const room of rooms) furnishings.push(...furnishRoom(room, furnishRng));
  const clearFurnishings = furnishings.filter((f) => {
    const onDoor = doorways.some((dr) =>
      (dr.a === f.roomId || dr.b === f.roomId) &&
      Math.abs(f.x - dr.x) < CELL_FT && Math.abs(f.y - dr.y) < CELL_FT);
    const onStair = !!opts.stair &&
      Math.abs(f.x - opts.stair.x) < CELL_FT && Math.abs(f.y - opts.stair.y) < CELL_FT;
    return !onDoor && !onStair;
  });

  return { rooms, doorways, furnishings: clearFurnishings, anchorRoomId };
}

export function generateInterior(plot: InteriorPlotInput, seedPath: SeedPath): InteriorPlan {
  const interiorPath = childSeedPath(seedPath, `interior:${plot.id}`);

  // Local envelope from the footprint's edge lengths (rotation-free frame).
  const [c0, c1, , c3] = plot.footprint;
  const widthFt = Math.max(MIN_ROOM_FT, snapDown(Math.hypot(c1[0] - c0[0], c1[1] - c0[1])));
  const depthFt = Math.max(MIN_ROOM_FT, snapDown(Math.hypot(c3[0] - c0[0], c3[1] - c0[1])));
  const isMarket = plot.role === 'market';

  // Ground floor — seeded by the interior path, so it reproduces byte-for-byte.
  const ground = buildFloor(interiorPath, widthFt, depthFt, isMarket, { ground: true });

  // Multi-storey: a single vertical stair shaft at the ground entry room's
  // centroid (interior, clear of the wall doorways), repeated up each gap. Each
  // upper floor packs the same envelope (sleeping quarters), reached at the stair.
  const storeys = Math.max(1, Math.floor(plot.storeys || 1));
  const upperFloors: InteriorFloor[] = [];
  const stairs: InteriorStair[] = [];
  if (storeys > 1) {
    const entry = ground.rooms[ground.anchorRoomId];
    const stair = { x: snap(entry.x + entry.w / 2), y: snap(entry.y + entry.d / 2) };
    // Clear ground furniture off the stair landing too.
    ground.furnishings = ground.furnishings.filter(
      (f) => !(Math.abs(f.x - stair.x) < CELL_FT && Math.abs(f.y - stair.y) < CELL_FT),
    );
    for (let level = 1; level < storeys; level++) {
      stairs.push({ fromFloor: level - 1, x: stair.x, y: stair.y });
      const floorPath = childSeedPath(interiorPath, `floor:${level}`);
      const floor = buildFloor(floorPath, widthFt, depthFt, isMarket, { ground: false, stair });
      upperFloors.push({ level, rooms: floor.rooms, doorways: floor.doorways, furnishings: floor.furnishings });
    }
  }

  return {
    plotId: plot.id,
    widthFt,
    depthFt,
    storeys,
    rooms: ground.rooms,
    doorways: ground.doorways,
    furnishings: ground.furnishings,
    upperFloors,
    stairs,
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
