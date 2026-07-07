/**
 * @file walls.ts — emit wall segments with thickness plus outward-facing windows.
 *
 * Task 6 of the Building Blueprint Pipeline. For every 5 ft cell edge where the
 * two sides differ (room vs room, or room vs outside) a WallEdge is emitted,
 * UNLESS a door already sits on that exact edge. Outer walls (one side outside)
 * are 1.5 ft thick; inner walls 0.5 ft. Wall x/y use the same edge-midpoint
 * convention as doors.ts, so a door and its wall edge compare equal on
 * (axis, x, y).
 *
 * Windows go only on outer edges that face TRUE open air: from each outer edge
 * we ray-cast outward to the footprint's bounding box — if the ray re-enters
 * the footprint (a re-entrant notch/courtyard), the edge gets no window.
 * Windows are spaced along each outer wall run with gaps drawn from the
 * 'walls' RNG stream, and never sit within one cell (5 ft) of any door or the
 * street entry.
 *
 * Purpose-aware windows (A12): when the caller passes the floor's rooms,
 * cellars never get windows, habitable rooms (bedroom/guest-room/private-room/
 * solar/kitchen and the main room) are guaranteed one window whenever they own
 * an eligible outer edge, and shopfronts guarantee wide glazing on the STREET
 * facade (the plan's min-y frontage — Task 9), falling back to the entry
 * facade then any eligible edge. Rooms with zero eligible edges honestly get
 * no window.
 *
 * Deterministic: all randomness derives from the 'walls' stream of the seed
 * path. Pure data — no three.js, no rendering concerns.
 */
import type {
  BlueprintDoor, BlueprintRoom, BlueprintWindow, RoomPurpose, WallEdge, WallRun,
} from './blueprintTypes';
import { EXTERIOR } from './blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';

const CELL_FT = 5;
/** Outer/inner wall thickness, feet. Exported so the 3D mesh builder can
 *  derive a door frame's thickness from the door's own kind (the wall edges
 *  at a door position are removed, so it can't read them off a WallEdge). */
export const OUTER_THICKNESS_FT = 1.5;
export const INNER_THICKNESS_FT = 0.5;
/** Windows keep at least one cell of clearance from any door. */
const DOOR_CLEARANCE_FT = CELL_FT;
/** Window opening width, feet (matches the 3D pane void). */
const WINDOW_FT = 3;
/** Corner clearance (Fix C): the 3 ft window void plus this margin must fit
 *  inside the continuous wall run between doors/corners it sits on, else the
 *  void clips into the perpendicular wall at a run end. Set to the perpendicular
 *  outer thickness so the void fully clears that wall (>= the spec's 1 ft
 *  floor). Slots that don't fit are dropped BEFORE the RNG draws (pool filter,
 *  not a draw-count change) so per-seed draw counts stay stable. */
const WINDOW_CORNER_MARGIN_FT = OUTER_THICKNESS_FT;

const edgeKey = (axis: 'x' | 'y', x: number, y: number): string =>
  `${axis}:${x}:${y}`;

/** Purposes that GUARANTEE >= 1 window when the room owns any eligible
 *  (open-air, door-clear) outer edge. The main room is guaranteed too. */
const GUARANTEED_PURPOSES: ReadonlySet<RoomPurpose> = new Set([
  'bedroom', 'guest-room', 'private-room', 'solar', 'kitchen',
]);

/** One candidate window slot on an outer wall, tagged with its run. */
interface OuterSlot {
  x: number; y: number; axis: 'x' | 'y';
  /** Groups edges into straight runs: axis + fixed coordinate + outward side. */
  runKey: string;
  /** Position along the run, for ordering. */
  along: number;
  facesOpenAir: boolean;
  /** Room id on the interior side of the edge. */
  roomA: number;
  /** Fixed coordinate of the wall line (x for axis 'y', y for axis 'x'). */
  fixed: number;
  /** Outward normal sign along the crossed axis (+1 or -1). */
  dir: number;
}

/**
 * Build the wall segments and windows of one floor.
 *
 * @param rg room-id grid from partition(): rg[y][x], -1 outside.
 * @param doors doors from wireDoors(); a wall edge occupied by a door is
 *   omitted, and windows keep one cell of clearance from every door.
 * @param rooms optional room list for purpose-aware windows. When given:
 *   cellar rooms NEVER get windows; bedroom/guest-room/private-room/solar/
 *   kitchen and the main room are GUARANTEED >= 1 window whenever they own at
 *   least one eligible (open-air, door-clear) outer edge — a room with zero
 *   eligible edges honestly gets none; shopfronts guarantee glazing on the
 *   entry-facing facade when eligible there, else on any eligible edge.
 *   When omitted, purpose-blind spacing (the pre-A12 behavior) applies.
 */
export function buildWalls(
  path: SeedPath,
  rg: number[][],
  doors: BlueprintDoor[],
  rooms?: BlueprintRoom[],
): { walls: WallEdge[]; windows: BlueprintWindow[]; wallRuns: WallRun[] } {
  const rng = rngFromPath(streamPath(path, 'walls'));
  const rows = rg.length;
  const cols = rows > 0 ? rg[0].length : 0;
  const inside = (x: number, y: number): boolean =>
    y >= 0 && y < rows && x >= 0 && x < cols && rg[y][x] >= 0;
  const at = (x: number, y: number): number =>
    inside(x, y) ? rg[y][x] : -1;

  const doorKeys = new Set(doors.map((d) => edgeKey(d.axis, d.x, d.y)));

  /** True when marching from cell (x,y) in (dx,dy) never re-enters the
   *  footprint before leaving the grid's bounding box. */
  const raySeesOpenAir = (x: number, y: number, dx: number, dy: number): boolean => {
    let cx = x, cy = y;
    while (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
      if (rg[cy][cx] >= 0) return false; // re-entrant notch: air is enclosed
      cx += dx; cy += dy;
    }
    return true;
  };

  const walls: WallEdge[] = [];
  const outerSlots: OuterSlot[] = [];

  /** Consider the edge between inside cell (x,y) and neighbor (nx,ny). */
  const consider = (
    x: number, y: number, nx: number, ny: number,
    ex: number, ey: number, axis: 'x' | 'y',
  ): void => {
    const here = at(x, y);
    const there = at(nx, ny);
    if (here === there) return; // no boundary
    if (doorKeys.has(edgeKey(axis, ex, ey))) return; // door occupies this edge
    const outer = there < 0;
    walls.push({
      x: ex, y: ey, axis,
      kind: outer ? 'outer' : 'inner',
      thicknessFt: outer ? OUTER_THICKNESS_FT : INNER_THICKNESS_FT,
      nx: nx - x, ny: ny - y,
      roomA: here,
      roomB: outer ? EXTERIOR : there,
    });
    if (outer) {
      outerSlots.push({
        x: ex, y: ey, axis,
        runKey: axis === 'y' ? `y:${ex}:${nx - x}` : `x:${ey}:${ny - y}`,
        along: axis === 'y' ? ey : ex,
        facesOpenAir: raySeesOpenAir(nx, ny, nx - x, ny - y),
        roomA: here,
        fixed: axis === 'y' ? ex : ey,
        dir: axis === 'y' ? nx - x : ny - y,
      });
    }
  };

  // Row-major scan; each inside cell claims its right/bottom boundary and
  // (only against distinct sides) its left/top, so every edge appears once.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (rg[y][x] < 0) continue;
      // Right edge (axis 'y', crosses the x = (x+1)*5 line).
      consider(x, y, x + 1, y, (x + 1) * CELL_FT, y * CELL_FT + CELL_FT / 2, 'y');
      // Bottom edge (axis 'x', crosses the y = (y+1)*5 line).
      consider(x, y, x, y + 1, x * CELL_FT + CELL_FT / 2, (y + 1) * CELL_FT, 'x');
      // Left/top edges only when the neighbor is NOT inside a room — the
      // room-vs-room case was already emitted from the neighbor's scan.
      if (at(x - 1, y) < 0) {
        consider(x, y, x - 1, y, x * CELL_FT, y * CELL_FT + CELL_FT / 2, 'y');
      }
      if (at(x, y - 1) < 0) {
        consider(x, y, x, y - 1, x * CELL_FT + CELL_FT / 2, y * CELL_FT, 'x');
      }
    }
  }

  // ---- Corner clearance (Fix C): mark each outer slot whether the 3 ft window
  // void + margin fits inside the CONTINUOUS wall run (between doors/corners) it
  // belongs to. Doors already removed their edges, so grouping every outer slot
  // by (axis, fixed, dir) and splitting on 5 ft-contiguity yields the true run
  // extents — the same runs the merged WallRuns describe. A slot that can't fit
  // the void clear of its run ends would clip the perpendicular wall, so it is
  // dropped from the candidate pool below (BEFORE any RNG draw).
  const fitsCorner = new Set<string>();
  {
    const byRunKey = new Map<string, OuterSlot[]>();
    for (const s of outerSlots) {
      const list = byRunKey.get(s.runKey) ?? [];
      list.push(s);
      byRunKey.set(s.runKey, list);
    }
    const need = WINDOW_FT / 2 + WINDOW_CORNER_MARGIN_FT;
    for (const list of byRunKey.values()) {
      list.sort((a, b) => a.along - b.along);
      let start = 0;
      for (let i = 1; i <= list.length; i++) {
        if (i === list.length || list[i].along - list[i - 1].along !== CELL_FT) {
          // Contiguous run list[start..i-1]: extent = first/last edge ± half a cell.
          const lo = list[start].along - CELL_FT / 2;
          const hi = list[i - 1].along + CELL_FT / 2;
          for (let j = start; j < i; j++) {
            const s = list[j];
            if (s.along - need >= lo - 1e-6 && s.along + need <= hi + 1e-6) {
              fitsCorner.add(edgeKey(s.axis, s.x, s.y));
            }
          }
          start = i;
        }
      }
    }
  }
  const slotFits = (s: OuterSlot): boolean =>
    fitsCorner.has(edgeKey(s.axis, s.x, s.y));

  // ---- Windows: spaced along each open-air outer run, clear of doors.
  const nearDoor = (s: OuterSlot): boolean =>
    doors.some((d) => Math.hypot(d.x - s.x, d.y - s.y) <= DOOR_CLEARANCE_FT);

  const roomById = new Map<number, BlueprintRoom>();
  if (rooms) for (const r of rooms) roomById.set(r.id, r);
  const purposeOf = (id: number): RoomPurpose | undefined =>
    roomById.get(id)?.purpose;
  const isCellar = (id: number): boolean =>
    rooms !== undefined && purposeOf(id) === 'cellar';

  const runs = new Map<string, OuterSlot[]>();
  for (const s of outerSlots) {
    if (!s.facesOpenAir) continue;
    if (isCellar(s.roomA)) continue; // cellars NEVER get windows
    let list = runs.get(s.runKey);
    if (!list) { list = []; runs.set(s.runKey, list); }
    list.push(s);
  }

  const windows: BlueprintWindow[] = [];
  const windowsPerRoom = new Map<number, number>();
  const windowSlotKeys = new Set<string>();
  const place = (s: OuterSlot): void => {
    windows.push({ x: s.x, y: s.y, axis: s.axis });
    windowsPerRoom.set(s.roomA, (windowsPerRoom.get(s.roomA) ?? 0) + 1);
    windowSlotKeys.add(edgeKey(s.axis, s.x, s.y));
  };

  for (const key of [...runs.keys()].sort()) {
    const run = (runs.get(key) as OuterSlot[]).sort((a, b) => a.along - b.along);
    let i = rng.nextInt(0, 2); // stagger the first window per run
    while (i < run.length) {
      const s = run[i];
      // Corner clearance (Fix C) is a POOL filter: the RNG draws below are
      // untouched (identical stagger + gaps per seed), only the placement is
      // suppressed for a slot whose void would clip a run end. Draw counts stay
      // stable, so unaffected buildings keep their exact window set.
      if (!nearDoor(s) && slotFits(s)) place(s);
      i += 1 + rng.nextInt(1, 3); // gap of 1-2 cells between windows
    }
  }

  // ---- Purpose guarantees (only when room purposes are known). RNG-free and
  // deterministic: the median eligible slot in sorted (runKey, along) order.
  if (rooms) {
    const eligibleByRoom = new Map<number, OuterSlot[]>();
    for (const s of outerSlots) {
      // Corner clearance (Fix C): a guaranteed window must also clear its run
      // ends, so an unfittable slot is not eligible (the room honestly gets no
      // window when it owns no fittable edge).
      if (!s.facesOpenAir || nearDoor(s) || isCellar(s.roomA) || !slotFits(s)) continue;
      let list = eligibleByRoom.get(s.roomA);
      if (!list) { list = []; eligibleByRoom.set(s.roomA, list); }
      list.push(s);
    }
    const bySlotOrder = (a: OuterSlot, b: OuterSlot): number =>
      a.runKey === b.runKey ? a.along - b.along : a.runKey < b.runKey ? -1 : 1;
    const median = (slots: OuterSlot[]): OuterSlot =>
      [...slots].sort(bySlotOrder)[Math.floor((slots.length - 1) / 2)];

    // Street slots (Task 9 frontage): outward-facing outer edges on the plan's
    // min-y boundary — axis 'x', outward normal pointing to lower y (dir -1),
    // capping the topmost occupied cell of their column. The 3D bridge maps
    // this face to the street, so a shopfront biases its wide glazing here.
    const isStreetSlot = (s: OuterSlot): boolean => {
      if (s.axis !== 'x' || s.dir !== -1) return false;
      const gx = Math.floor(s.x / CELL_FT);
      const gy = s.y / CELL_FT; // top edge of cell (gx, gy)
      if (!inside(gx, gy)) return false;
      for (let y = 0; y < gy; y++) if (inside(gx, y)) return false;
      return true;
    };

    const entry = doors.find((d) => d.isEntry);
    const onEntryFacade = (s: OuterSlot): boolean =>
      entry !== undefined &&
      s.axis === entry.axis &&
      s.fixed === (entry.axis === 'y' ? entry.x : entry.y) &&
      // Outer slots face outward; the entry leaf opens inward.
      s.dir === -(entry.axis === 'y' ? entry.openDir.nx : entry.openDir.ny);

    for (const room of [...rooms].sort((a, b) => a.id - b.id)) {
      const eligible = eligibleByRoom.get(room.id);
      if (!eligible || eligible.length === 0) continue; // honest omission
      const count = (): number => windowsPerRoom.get(room.id) ?? 0;
      if (room.purpose === 'shopfront') {
        // Guarantee wide glazing on the STREET facade (min-y frontage) when the
        // shopfront owns eligible street edges; fall back to the entry facade,
        // then to any eligible edge. Street runs are preferred so the display
        // window faces the road, matching where Task 9 puts the entry.
        const street = eligible.filter(isStreetSlot);
        const facade = street.length > 0 ? street : eligible.filter(onEntryFacade);
        const hasFacadeGlass = facade.some((s) =>
          windowSlotKeys.has(edgeKey(s.axis, s.x, s.y)));
        if (facade.length > 0 && !hasFacadeGlass) place(median(facade));
        else if (facade.length === 0 && count() === 0) place(median(eligible));
      } else if (room.isMain || GUARANTEED_PURPOSES.has(room.purpose)) {
        if (count() === 0) place(median(eligible));
      }
    }
  }

  return { walls, windows, wallRuns: mergeWallRuns(walls) };
}

/**
 * Merge collinear, same-kind, same-normal wall edges into maximal straight
 * runs. Edges 5 ft apart along the same grid line are contiguous; any gap
 * (a door edge emits no WallEdge) breaks the run. RNG-free and pure —
 * output order is deterministic (sorted group key, then position).
 */
export function mergeWallRuns(walls: WallEdge[]): WallRun[] {
  const groups = new Map<string, WallEdge[]>();
  for (const w of walls) {
    const fixed = w.axis === 'y' ? w.x : w.y;
    const key = `${w.axis}:${w.kind}:${fixed}:${w.nx}:${w.ny}`;
    let list = groups.get(key);
    if (!list) { list = []; groups.set(key, list); }
    list.push(w);
  }

  const along = (w: WallEdge): number => (w.axis === 'y' ? w.y : w.x);
  const runs: WallRun[] = [];
  const pushRun = (first: WallEdge, last: WallEdge): void => {
    const half = CELL_FT / 2; // edge x/y are cell-edge midpoints; snap to lines
    if (first.axis === 'y') {
      runs.push({
        x1: first.x, y1: first.y - half, x2: first.x, y2: last.y + half,
        axis: 'y', kind: first.kind, thicknessFt: first.thicknessFt,
        nx: first.nx, ny: first.ny,
      });
    } else {
      runs.push({
        x1: first.x - half, y1: first.y, x2: last.x + half, y2: first.y,
        axis: 'x', kind: first.kind, thicknessFt: first.thicknessFt,
        nx: first.nx, ny: first.ny,
      });
    }
  };

  for (const key of [...groups.keys()].sort()) {
    const edges = (groups.get(key) as WallEdge[]).sort((a, b) => along(a) - along(b));
    let start = 0;
    for (let i = 1; i <= edges.length; i++) {
      if (i === edges.length || along(edges[i]) - along(edges[i - 1]) !== CELL_FT) {
        pushRun(edges[start], edges[i - 1]);
        start = i;
      }
    }
  }
  return runs;
}
