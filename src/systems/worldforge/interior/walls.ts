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
 * Deterministic: all randomness derives from the 'walls' stream of the seed
 * path. Pure data — no three.js, no rendering concerns.
 */
import type { BlueprintDoor, BlueprintWindow, WallEdge } from './blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';

const CELL_FT = 5;
const OUTER_THICKNESS_FT = 1.5;
const INNER_THICKNESS_FT = 0.5;
/** Windows keep at least one cell of clearance from any door. */
const DOOR_CLEARANCE_FT = CELL_FT;

const edgeKey = (axis: 'x' | 'y', x: number, y: number): string =>
  `${axis}:${x}:${y}`;

/** One candidate window slot on an outer wall, tagged with its run. */
interface OuterSlot {
  x: number; y: number; axis: 'x' | 'y';
  /** Groups edges into straight runs: axis + fixed coordinate + outward side. */
  runKey: string;
  /** Position along the run, for ordering. */
  along: number;
  facesOpenAir: boolean;
}

/**
 * Build the wall segments and windows of one floor.
 *
 * @param rg room-id grid from partition(): rg[y][x], -1 outside.
 * @param doors doors from wireDoors(); a wall edge occupied by a door is
 *   omitted, and windows keep one cell of clearance from every door.
 */
export function buildWalls(
  path: SeedPath,
  rg: number[][],
  doors: BlueprintDoor[],
): { walls: WallEdge[]; windows: BlueprintWindow[] } {
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
    });
    if (outer) {
      outerSlots.push({
        x: ex, y: ey, axis,
        runKey: axis === 'y' ? `y:${ex}:${nx - x}` : `x:${ey}:${ny - y}`,
        along: axis === 'y' ? ey : ex,
        facesOpenAir: raySeesOpenAir(nx, ny, nx - x, ny - y),
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

  // ---- Windows: spaced along each open-air outer run, clear of doors.
  const nearDoor = (s: OuterSlot): boolean =>
    doors.some((d) => Math.hypot(d.x - s.x, d.y - s.y) <= DOOR_CLEARANCE_FT);

  const runs = new Map<string, OuterSlot[]>();
  for (const s of outerSlots) {
    if (!s.facesOpenAir) continue;
    let list = runs.get(s.runKey);
    if (!list) { list = []; runs.set(s.runKey, list); }
    list.push(s);
  }

  const windows: BlueprintWindow[] = [];
  for (const key of [...runs.keys()].sort()) {
    const run = (runs.get(key) as OuterSlot[]).sort((a, b) => a.along - b.along);
    let i = rng.nextInt(0, 2); // stagger the first window per run
    while (i < run.length) {
      const s = run[i];
      if (!nearDoor(s)) {
        windows.push({ x: s.x, y: s.y, axis: s.axis });
      }
      i += 1 + rng.nextInt(1, 3); // gap of 1-2 cells between windows
    }
  }

  return { walls, windows };
}
