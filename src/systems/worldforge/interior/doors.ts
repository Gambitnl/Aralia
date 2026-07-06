/**
 * @file doors.ts — wire doors between rooms and place the street entrance.
 *
 * Task 5 of the Building Blueprint Pipeline. Builds room adjacency from the
 * shared wall edges of the partition grid, computes a spanning tree over the
 * rooms (one door per tree edge, so every room is reachable), then adds a few
 * loop doors on leftover adjacencies. The street entry goes on an outer wall
 * edge of the MAIN room — or, when the main room touches no outer wall, on a
 * corridor connected to it — never a random back room. Exactly one entry
 * per ground floor; non-ground floors pass streetEntry: false and get none.
 *
 * Swing convention (BlueprintDoor has no swing field, so a/b ordering is the
 * channel): a door OPENS INTO the room in slot `b`. For interior doors `b` is
 * always the LARGER of the two rooms (ties by lower id); for the entry,
 * a === EXTERIOR and b is the room you step into.
 *
 * Deterministic: all randomness derives from the 'doors' stream of the given
 * seed path. Pure data — no three.js, no rendering concerns. No fallback:
 * throws if the room graph cannot be connected or no entry wall exists.
 */
import type { BlueprintDoor, BlueprintRoom } from './blueprintTypes';
import { EXTERIOR } from './blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';

const CELL_FT = 5;
/** Chance (out of 100) to promote a leftover adjacency into a loop door. */
const LOOP_DOOR_PERCENT = 25;

/** A candidate door position: midpoint of one shared cell edge, in feet. */
interface EdgeSite { x: number; y: number; axis: 'x' | 'y'; }

const pairKey = (a: number, b: number): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

/**
 * Wire the doors of one floor.
 *
 * @param rg room-id grid from partition(): rg[y][x], -1 outside.
 * @returns a connected door graph plus exactly one street entry.
 */
export function wireDoors(
  path: SeedPath,
  rg: number[][],
  rooms: BlueprintRoom[],
  opts?: { streetEntry?: boolean },
): { doors: BlueprintDoor[] } {
  const streetEntry = opts?.streetEntry !== false;
  const rng = rngFromPath(streamPath(path, 'doors'));
  const rows = rg.length;
  const cols = rows > 0 ? rg[0].length : 0;
  const at = (x: number, y: number): number =>
    y >= 0 && y < rows && x >= 0 && x < cols ? rg[y][x] : EXTERIOR;

  // ---- Adjacency: shared wall edges between distinct rooms, and each
  // room's outer wall edges. Row-major scan keeps candidate order stable.
  const shared = new Map<string, EdgeSite[]>(); // pairKey -> candidate edges
  const outer = new Map<number, EdgeSite[]>(); // roomId -> outer wall edges
  const addShared = (a: number, b: number, site: EdgeSite): void => {
    const key = pairKey(a, b);
    let list = shared.get(key);
    if (!list) { list = []; shared.set(key, list); }
    list.push(site);
  };
  const addOuter = (id: number, site: EdgeSite): void => {
    let list = outer.get(id);
    if (!list) { list = []; outer.set(id, list); }
    list.push(site);
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const id = at(x, y);
      if (id < 0) continue;
      // Vertical wall on the cell's right edge (axis 'y', crosses x line).
      const right = at(x + 1, y);
      const rightSite: EdgeSite = {
        x: (x + 1) * CELL_FT, y: y * CELL_FT + CELL_FT / 2, axis: 'y',
      };
      if (right < 0) addOuter(id, rightSite);
      else if (right !== id) addShared(id, right, rightSite);
      // Horizontal wall on the cell's bottom edge (axis 'x', crosses y line).
      const below = at(x, y + 1);
      const belowSite: EdgeSite = {
        x: x * CELL_FT + CELL_FT / 2, y: (y + 1) * CELL_FT, axis: 'x',
      };
      if (below < 0) addOuter(id, belowSite);
      else if (below !== id) addShared(id, below, belowSite);
      // Left and top edges only matter when the neighbor is outside (the
      // shared case was already recorded from the neighbor's scan).
      if (at(x - 1, y) < 0) {
        addOuter(id, { x: x * CELL_FT, y: y * CELL_FT + CELL_FT / 2, axis: 'y' });
      }
      if (at(x, y - 1) < 0) {
        addOuter(id, { x: x * CELL_FT + CELL_FT / 2, y: y * CELL_FT, axis: 'x' });
      }
    }
  }

  const sizeById = new Map<number, number>();
  for (const r of rooms) sizeById.set(r.id, r.cells.length);

  /** Interior door: opens into the larger room, which goes in slot b. */
  const makeDoor = (u: number, v: number, site: EdgeSite): BlueprintDoor => {
    const su = sizeById.get(u) ?? 0;
    const sv = sizeById.get(v) ?? 0;
    const larger = sv > su || (sv === su && v < u) ? v : u;
    const smaller = larger === v ? u : v;
    return { a: smaller, b: larger, x: site.x, y: site.y, axis: site.axis, isEntry: false };
  };

  // ---- Spanning tree (BFS from the main room), one door per tree edge.
  // With no street entry to place, any room works as the root; prefer the
  // main room when marked, else the lowest-id room, so order stays stable.
  const main = rooms.find((r) => r.isMain)
    ?? (streetEntry ? undefined : [...rooms].sort((a, b) => a.id - b.id)[0]);
  if (!main) throw new Error(`doors: no main room at ${path}`);
  const neighbors = new Map<number, number[]>();
  for (const key of shared.keys()) {
    const [a, b] = key.split('|').map(Number);
    (neighbors.get(a) ?? neighbors.set(a, []).get(a)!).push(b);
    (neighbors.get(b) ?? neighbors.set(b, []).get(b)!).push(a);
  }
  const doors: BlueprintDoor[] = [];
  const treeEdges = new Set<string>();
  const visited = new Set<number>([main.id]);
  const queue = [main.id];
  while (queue.length > 0) {
    const u = queue.shift() as number;
    for (const v of (neighbors.get(u) ?? []).slice().sort((a, b) => a - b)) {
      if (visited.has(v)) continue;
      visited.add(v);
      queue.push(v);
      const key = pairKey(u, v);
      treeEdges.add(key);
      const sites = shared.get(key) as EdgeSite[];
      doors.push(makeDoor(u, v, sites[rng.nextInt(0, sites.length)]));
    }
  }
  if (visited.size !== rooms.length) {
    throw new Error(
      `doors: room graph is disconnected at ${path} ` +
      `(${visited.size}/${rooms.length} rooms reachable from main)`,
    );
  }

  // ---- Loop doors: a few leftover adjacencies become second routes.
  const leftoverKeys = [...shared.keys()].filter((k) => !treeEdges.has(k)).sort();
  for (const key of leftoverKeys) {
    if (rng.nextInt(0, 100) >= LOOP_DOOR_PERCENT) continue;
    const [a, b] = key.split('|').map(Number);
    const sites = shared.get(key) as EdgeSite[];
    doors.push(makeDoor(a, b, sites[rng.nextInt(0, sites.length)]));
  }

  // ---- Street entry: outer wall of the main room, else of a corridor
  // connected (via doors) to the main room. Never a random back room.
  // Non-ground floors (streetEntry: false) get no exterior door at all —
  // the spanning tree above already guarantees room connectivity, and this
  // block is the last consumer of the 'doors' RNG stream, so skipping it
  // cannot shift any earlier draw.
  if (!streetEntry) return { doors };
  let entryRoom = -1;
  if ((outer.get(main.id) ?? []).length > 0) {
    entryRoom = main.id;
  } else {
    const doorAdj = new Set(
      doors.flatMap((d) => (d.a === main.id ? [d.b] : d.b === main.id ? [d.a] : [])),
    );
    const corridor = rooms
      .filter((r) => r.isCorridor && doorAdj.has(r.id) && (outer.get(r.id) ?? []).length > 0)
      .sort((a, b) => a.id - b.id)[0];
    if (corridor) entryRoom = corridor.id;
  }
  if (entryRoom < 0) {
    throw new Error(`doors: no outer wall for a street entry at ${path}`);
  }
  const entrySites = outer.get(entryRoom) as EdgeSite[];
  const site = entrySites[rng.nextInt(0, entrySites.length)];
  doors.push({
    a: EXTERIOR, b: entryRoom, x: site.x, y: site.y, axis: site.axis, isEntry: true,
  });

  return { doors };
}
