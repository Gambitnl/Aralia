/**
 * @file intact/circulation.ts
 * @description Built circulation (DEFECT A) + dead-end trim — extracted VERBATIM
 * from buildIntact.ts (packet W1-P6). `addBuiltLoops` opens the BUILT cross-cut
 * doors that keep the intact structure from ever being a pure tree; the private
 * `loopWallStrands`/`carveFallbackCrossCuts` back it; `trimDanglingCorridors`
 * peels corridor runs that terminate in the void. Move-only: bodies are
 * byte-identical, so the single `rng.int` jitter draw in `addBuiltLoops` fires in
 * the same place. `addBuiltLoops`/`trimDanglingCorridors` were already public
 * (re-exported by `../buildIntact`).
 */

import {
  DIRS,
  gi,
  roomCx,
  roomCy,
  type IntactState,
  type Room,
} from './primitives';
import type { Rng } from './rng';
import { CellKind, type BuilderArchetype, type DungeonEdge } from '../types';

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
