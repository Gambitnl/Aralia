/**
 * @file doors.ts — wire doors between rooms and place the street entrance.
 *
 * Task 5 of the Building Blueprint Pipeline. Builds room adjacency from the
 * shared wall edges of the partition grid, computes a spanning tree over the
 * rooms (one door per tree edge, so every room is reachable), then adds a few
 * loop doors on leftover adjacencies. Privacy pass: the tree is a weighted
 * Prim that steers private rooms (PRIVATE_PURPOSES) into leaf positions fed
 * by corridors, avoids direct private↔main doors unless they are the only
 * connection, and loop doors never touch a private room. The street entry goes on an outer wall
 * edge of the MAIN room — or, when the main room touches no outer wall, on a
 * corridor connected to it — never a random back room. Exactly one entry
 * per ground floor; non-ground floors pass streetEntry: false and get none.
 * Frontage (Task 9): the entry prefers a STREET edge — an outer edge on the
 * plan's min-y boundary (the 3D bridge maps the min-y face to the street,
 * `interiorParts.ts`). The entry room's outer edges are filtered to street
 * edges first; when that filter is empty (a main room boxed off the street),
 * it relaxes to the room's full outer-edge list (honest constraint
 * relaxation — a landlocked room still gets a door). Either way EXACTLY ONE
 * draw is made from the 'doors' stream (the pool is filtered, no draw is
 * added), so stream stability holds regardless of which branch is taken.
 *
 * Swing contract: `openDir` + `swingInto` are the explicit spatial channel.
 * `openDir` is the unit cell delta pointing from the door across the edge
 * INTO the room the door opens into (perpendicular to the wall), and
 * `swingInto` is that room's id. The POLICY for choosing swingInto stays the
 * larger-room rule: interior doors open into the LARGER of the two rooms
 * (ties by lower id); the street entry opens INWARD (swingInto === b, the
 * room you step into). a/b ordering is kept (b is still the larger room /
 * entry room) but is no longer the swing channel — renderers must draw the
 * leaf from openDir/swingInto.
 *
 * Deterministic: all randomness derives from the 'doors' stream of the given
 * seed path. Pure data — no three.js, no rendering concerns. No fallback:
 * throws if the room graph cannot be connected or no entry wall exists.
 */
import type { BlueprintDoor, BlueprintRoom, RoomPurpose } from './blueprintTypes';
import { EXTERIOR } from './blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';

const CELL_FT = 5;
/** Chance (out of 100) to promote a leftover adjacency into a loop door. */
const LOOP_DOOR_PERCENT = 25;

/** Room purposes that deserve privacy: they should hang off the tree as
 *  leaves (one door), reached through corridors or other non-private rooms,
 *  and never open straight onto the main hall when any other route exists. */
export const PRIVATE_PURPOSES: readonly RoomPurpose[] = [
  'bedroom', 'guest-room', 'private-room', 'solar',
];

// Deterministic spanning-tree edge scores (lower = preferred). These are
// PREFERENCES, not bans: when a private↔main edge is the only way to reach a
// room, it is still taken (constraint relaxation, never disconnection).
/** Direct private-room ↔ main-hall door: worst choice. */
const SCORE_PRIVATE_MAIN = 1000;
/** Branching the tree THROUGH a private room turns it into a pass-room. */
const SCORE_THROUGH_PRIVATE = 500;
/** Branching through a private room that is ALREADY a pass-room (tree degree
 *  ≥ 2). Cheaper than spoiling a fresh one: unavoidable through-traffic
 *  concentrates on as few private rooms as possible. */
const SCORE_THROUGH_SPOILED_PRIVATE = 300;
/** Attaching a private room at all — deferred until the public tree is
 *  built, so private rooms land in leaf positions, not on trunk paths. */
const SCORE_INTO_PRIVATE = 50;
/** Reaching a private room from a non-corridor (corridors are the ideal feeder). */
const SCORE_PRIVATE_OFF_CORRIDOR = 10;

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

  /** Unit cell delta from the door edge into the room `into` (derived from
   *  rg geometry — no RNG). Axis 'y' doors sit on an x grid line between
   *  cells (gx-1,gy) and (gx,gy); axis 'x' doors between (gx,gy-1) and
   *  (gx,gy). Exactly one side belongs to `into`. */
  const openDirFor = (site: EdgeSite, into: number): { nx: number; ny: number } => {
    if (site.axis === 'y') {
      const gx = site.x / CELL_FT;
      const gy = Math.floor(site.y / CELL_FT);
      if (at(gx, gy) === into) return { nx: 1, ny: 0 };
      if (at(gx - 1, gy) === into) return { nx: -1, ny: 0 };
    } else {
      const gx = Math.floor(site.x / CELL_FT);
      const gy = site.y / CELL_FT;
      if (at(gx, gy) === into) return { nx: 0, ny: 1 };
      if (at(gx, gy - 1) === into) return { nx: 0, ny: -1 };
    }
    throw new Error(
      `doors: swing room ${into} is not on either side of the door edge ` +
      `at (${site.x},${site.y}) axis ${site.axis} for ${path}`,
    );
  };

  /** Interior door: opens into the larger room, which goes in slot b. */
  const makeDoor = (u: number, v: number, site: EdgeSite): BlueprintDoor => {
    const su = sizeById.get(u) ?? 0;
    const sv = sizeById.get(v) ?? 0;
    const larger = sv > su || (sv === su && v < u) ? v : u;
    const smaller = larger === v ? u : v;
    return {
      a: smaller, b: larger, x: site.x, y: site.y, axis: site.axis, isEntry: false,
      openDir: openDirFor(site, larger), swingInto: larger,
    };
  };

  // ---- Spanning tree (weighted Prim from the main room), one door per tree
  // edge. Edge weights implement the privacy pass: private rooms prefer to
  // hang as leaves off corridors/non-private rooms rather than opening onto
  // the main hall or becoming pass-through branches. Weights only reorder
  // which adjacencies become tree edges — connectivity is still guaranteed
  // (every candidate edge stays legal, high-score edges are last resorts).
  // With no street entry to place, any room works as the root; prefer the
  // main room when marked, else the lowest-id room, so order stays stable.
  const main = rooms.find((r) => r.isMain)
    ?? (streetEntry ? undefined : [...rooms].sort((a, b) => a.id - b.id)[0]);
  if (!main) throw new Error(`doors: no main room at ${path}`);
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const privateSet = new Set<RoomPurpose>(PRIVATE_PURPOSES);
  const isPrivate = (id: number): boolean =>
    privateSet.has(roomById.get(id)?.purpose as RoomPurpose);
  const isMainRoom = (id: number): boolean => roomById.get(id)?.isMain === true;
  const isCorridor = (id: number): boolean =>
    roomById.get(id)?.isCorridor === true;
  const treeDegree = new Map<number, number>();
  const bumpDegree = (id: number): void =>
    void treeDegree.set(id, (treeDegree.get(id) ?? 0) + 1);
  /** Score of adding tree edge from in-tree room `u` to new room `v`. */
  const edgeScore = (u: number, v: number): number => {
    let s = 0;
    if ((isPrivate(u) && isMainRoom(v)) || (isMainRoom(u) && isPrivate(v))) {
      s += SCORE_PRIVATE_MAIN;
    }
    if (isPrivate(u)) {
      s += (treeDegree.get(u) ?? 0) >= 2
        ? SCORE_THROUGH_SPOILED_PRIVATE
        : SCORE_THROUGH_PRIVATE;
    }
    if (isPrivate(v)) {
      s += SCORE_INTO_PRIVATE;
      if (!isCorridor(u)) s += SCORE_PRIVATE_OFF_CORRIDOR;
    }
    return s;
  };
  const sharedKeys = [...shared.keys()].sort();
  const doors: BlueprintDoor[] = [];
  const treeEdges = new Set<string>();
  const visited = new Set<number>([main.id]);
  while (visited.size < rooms.length) {
    // Cheapest frontier edge; ties break on (score, new-room id, in-tree id)
    // so the pick order is fully deterministic.
    let bestKey = ''; let bestU = -1; let bestV = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const key of sharedKeys) {
      if (treeEdges.has(key)) continue;
      const [a, b] = key.split('|').map(Number);
      const aIn = visited.has(a); const bIn = visited.has(b);
      if (aIn === bIn) continue; // both in tree, or neither reachable yet
      const u = aIn ? a : b; // in-tree side
      const v = aIn ? b : a; // room being connected
      const s = edgeScore(u, v);
      if (s < bestScore || (s === bestScore && (v < bestV || (v === bestV && u < bestU)))) {
        bestScore = s; bestKey = key; bestU = u; bestV = v;
      }
    }
    if (bestV < 0) {
      throw new Error(
        `doors: room graph is disconnected at ${path} ` +
        `(${visited.size}/${rooms.length} rooms reachable from main)`,
      );
    }
    visited.add(bestV);
    treeEdges.add(bestKey);
    bumpDegree(bestU);
    bumpDegree(bestV);
    const sites = shared.get(bestKey) as EdgeSite[];
    doors.push(makeDoor(bestU, bestV, sites[rng.nextInt(0, sites.length)]));
  }

  // ---- Loop doors: a few leftover adjacencies become second routes — but
  // never on a private room (a loop door would make it a walk-through
  // pass-room). Private-incident leftovers are filtered out BEFORE any RNG
  // draw, so they consume no stream entropy.
  const leftoverKeys = [...shared.keys()]
    .filter((k) => !treeEdges.has(k))
    .filter((k) => {
      const [a, b] = k.split('|').map(Number);
      return !isPrivate(a) && !isPrivate(b);
    })
    .sort();
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
  // Street edges: outer TOP edges (axis 'x') sitting on the plan's min-y
  // boundary — the cell they cap is the topmost occupied cell in its column,
  // so nothing of the footprint lies between it and the street. Prefer them;
  // relax to every outer edge only when the room touches no street at all.
  const isStreetEdge = (s: EdgeSite): boolean => {
    if (s.axis !== 'x') return false; // only horizontal edges face min-y
    const gx = Math.floor(s.x / CELL_FT);
    const gy = s.y / CELL_FT; // this is the TOP edge of cell (gx, gy)
    if (at(gx, gy) < 0) return false; // must cap an occupied cell below it
    for (let y = 0; y < gy; y++) if (at(gx, y) >= 0) return false; // occupied above
    return true;
  };
  const allSites = outer.get(entryRoom) as EdgeSite[];
  const streetSites = allSites.filter(isStreetEdge);
  const entrySites = streetSites.length > 0 ? streetSites : allSites;
  const site = entrySites[rng.nextInt(0, entrySites.length)];
  doors.push({
    a: EXTERIOR, b: entryRoom, x: site.x, y: site.y, axis: site.axis, isEntry: true,
    openDir: openDirFor(site, entryRoom), swingInto: entryRoom,
  });

  return { doors };
}
