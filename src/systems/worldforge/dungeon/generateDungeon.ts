/**
 * @file generateDungeon.ts
 * @description Deterministic procedural dungeon generator — pure data, zero
 * THREE imports. Spec: docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md.
 *
 * Layout is GROWTH-BASED (rewrite of the rejected scatter+separate draft): the
 * dungeon grows from an entrance room by repeatedly attaching a straight
 * corridor + a new room through a door in an existing room's wall, rejecting
 * any placement that would touch existing floor. This guarantees the look of a
 * designed map: rooms are always distinct walled spaces, corridors always read
 * as corridors, and everything is grid-aligned by construction.
 *
 * Pipeline (each stage draws from its own named seed sub-stream so adding a
 * draw to one never perturbs another):
 *   1. grow      → entrance room, then door → corridor → room attachments
 *   2. loops     → open extra doors through 1–2 cell wall gaps between rooms
 *   3. crop      → shrink the working grid to the used extent + margin
 *   4. semantics → entrance / boss / critical path / room types + difficulty
 *   5. rasterize → walls (void touching floor) + BFS distance field
 *   6. decorate  → pillar colonnades, torches, set pieces, CR-budgeted spawns
 *
 * Determinism: every draw comes from `rngFromPath` over a `wf:<seed>/dungeon`
 * path. Connectivity is guaranteed by construction, but the flood-fill guard
 * stays; a layout that places too few rooms re-rolls against a derived path
 * (max 5 attempts) and fails honestly (Aralia no-fallback directive).
 */

import { childSeedPath, rngFromPath, rootSeedPath, streamPath, type SeedPath } from '../seedPath';
import {
  CELL_FT,
  CellKind,
  type Cell,
  type DungeonEdge,
  type DungeonInput,
  type DungeonParams,
  type DungeonPlan,
  type DungeonProp,
  type DungeonRoom,
  type DungeonSpawn,
  type DungeonTrap,
  type RoomShape,
  type RoomType,
} from './types';

const DEFAULT_PARAMS: DungeonParams = {
  roomCount: 42,
  loopChance: 0.25,
  decorDensity: 0.6,
  theme: 'crypt',
  partyLevel: 3,
};

/** Grid padding (cells) around the used extent after cropping. */
const MARGIN = 3;
const MAX_ATTEMPTS = 5;

// ─── RNG helpers ─────────────────────────────────────────────────────────────

/** Thin, allocation-light wrapper over the worldforge `SeededRandom` stream. */
interface Rng {
  /** [a, b) */
  float(a: number, b: number): number;
  /** integer in [a, b] INCLUSIVE (guards the max-exclusive nextInt trap). */
  int(a: number, b: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

function makeRng(path: SeedPath): Rng {
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

// ─── Working types ───────────────────────────────────────────────────────────

interface Room {
  id: number;
  x0: number; // top-left cell of the bounding box
  y0: number;
  w: number;
  h: number;
  shape: RoomShape;
  type: RoomType;
  depth: number;
  difficulty: number;
  degree: number;
  area: number;
}

const roomCx = (r: Room): number => r.x0 + Math.floor(r.w / 2);
const roomCy = (r: Room): number => r.y0 + Math.floor(r.h / 2);

/** True when local cell (i, j) of a room's bounding box is floor. */
function inMask(shape: RoomShape, w: number, h: number, i: number, j: number): boolean {
  if (shape === 'rect') return true;
  if (shape === 'ellipse') {
    const nx = (i - (w - 1) / 2) / (w / 2);
    const ny = (j - (h - 1) / 2) / (h / 2);
    return nx * nx + ny * ny <= 1.02;
  }
  // octagon: chamfer the corners
  const chamfer = Math.floor(Math.min(w, h) * 0.3);
  return Math.min(i, w - 1 - i) + Math.min(j, h - 1 - j) >= chamfer;
}

// ─── Stage 1: growth ─────────────────────────────────────────────────────────

const DIRS: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];

interface GrowState {
  side: number;
  grid: Uint8Array; // CellKind (Void / Floor)
  corridor: Uint8Array; // 1 where corridor floor
  roomOf: Int16Array; // room id per floor cell; -1 void, -2 corridor
  rooms: Room[];
  edges: DungeonEdge[];
  /** Working-grid indices of cells carved for SECRET loop connections. */
  secret: Set<number>;
}

const gi = (x: number, y: number, W: number): number => y * W + x;

/** Pick a room footprint. Small chambers, medium rooms, and great halls. */
function pickRoomSize(rng: Rng): { w: number; h: number; shape: RoomShape } {
  const roll = rng.float(0, 1);
  let w: number;
  let h: number;
  if (roll < 0.35) {
    w = rng.int(4, 6);
    h = rng.int(4, 6);
  } else if (roll < 0.75) {
    w = rng.int(7, 10);
    h = rng.int(6, 9);
  } else {
    // great halls / galleries — sometimes long and thin
    w = rng.int(10, 16);
    h = rng.int(8, 13);
    if (rng.chance(0.3)) h = rng.int(5, 7); // gallery
  }
  const sroll = rng.float(0, 1);
  // Non-rect shapes only for roomy footprints (masks eat small rooms).
  const shape: RoomShape = w >= 7 && h >= 7 ? (sroll < 0.65 ? 'rect' : sroll < 0.85 ? 'octagon' : 'ellipse') : 'rect';
  return { w, h, shape };
}

function stampRoom(st: GrowState, r: Room): void {
  let area = 0;
  for (let j = 0; j < r.h; j++) {
    for (let i = 0; i < r.w; i++) {
      if (!inMask(r.shape, r.w, r.h, i, j)) continue;
      const k = gi(r.x0 + i, r.y0 + j, st.side);
      st.grid[k] = CellKind.Floor;
      st.roomOf[k] = r.id;
      area++;
    }
  }
  r.area = area;
}

/**
 * Try to attach corridor + room to `src` in direction `d`. Every new floor
 * cell (and its 8-neighborhood) must be void, except the door adjacency to the
 * source room and internal adjacency within the new feature — so the new room
 * always keeps at least one wall cell between itself and everything else.
 */
function tryAttach(st: GrowState, rng: Rng, src: Room): boolean {
  // Compactness bias (Watabou reference look): most growth points back toward
  // the complex centroid so the dungeon reads as one dense mass, not a sprawl.
  let dir = rng.pick(DIRS);
  if (rng.chance(0.55) && st.rooms.length > 2) {
    let mx = 0;
    let my = 0;
    for (const r of st.rooms) { mx += roomCx(r); my += roomCy(r); }
    mx /= st.rooms.length;
    my /= st.rooms.length;
    const vx = mx - roomCx(src);
    const vy = my - roomCy(src);
    let best = dir;
    let bestDot = -Infinity;
    for (const d of DIRS) {
      const dot = d[0] * vx + d[1] * vy + rng.float(0, 2); // jittered argmax
      if (dot > bestDot) { bestDot = dot; best = d; }
    }
    dir = best;
  }
  const [dx, dy] = dir;
  const size = pickRoomSize(rng);
  // Mostly doors punched straight through a shared wall (length 1), sometimes
  // a short passage, occasionally a long hall — the Watabou one-page-dungeon
  // packing Remy pointed at as the reference look.
  const lenRoll = rng.float(0, 1);
  const corLen = lenRoll < 0.4 ? 1 : lenRoll < 0.75 ? rng.int(2, 4) : rng.int(5, 9);

  // Door position along the source wall (skip corners; middle third for masks).
  const span = dx !== 0 ? src.h : src.w;
  const lo = src.shape === 'rect' ? 1 : Math.floor(span / 3);
  const hi = src.shape === 'rect' ? span - 2 : span - 1 - Math.floor(span / 3);
  if (hi < lo) return false;
  const t = rng.int(lo, hi);

  // Source-side door cell: last floor cell of src along the exit line.
  let fx: number;
  let fy: number;
  if (dx !== 0) {
    fy = src.y0 + t;
    fx = dx > 0 ? src.x0 + src.w - 1 : src.x0;
    while (st.roomOf[gi(fx, fy, st.side)] !== src.id) {
      fx -= dx;
      if (fx < src.x0 || fx >= src.x0 + src.w) return false;
    }
  } else {
    fx = src.x0 + t;
    fy = dy > 0 ? src.y0 + src.h - 1 : src.y0;
    while (st.roomOf[gi(fx, fy, st.side)] !== src.id) {
      fy -= dy;
      if (fy < src.y0 || fy >= src.y0 + src.h) return false;
    }
  }

  // Corridor cells (straight run out of the wall).
  const cor: Cell[] = [];
  for (let k = 1; k <= corLen; k++) cor.push({ x: fx + dx * k, y: fy + dy * k });

  // New room bounding box: its near wall sits one past the corridor end, and
  // the corridor line enters it away from the corners.
  const q = size.shape === 'rect'
    ? rng.int(1, (dx !== 0 ? size.h : size.w) - 2)
    : Math.floor((dx !== 0 ? size.h : size.w) / 2);
  const end = cor[cor.length - 1];
  let x0: number;
  let y0: number;
  if (dx > 0) { x0 = end.x + 1; y0 = end.y - q; }
  else if (dx < 0) { x0 = end.x - size.w; y0 = end.y - q; }
  else if (dy > 0) { y0 = end.y + 1; x0 = end.x - q; }
  else { y0 = end.y - size.h; x0 = end.x - q; }

  // Bounds (leave a 2-cell rim on the working grid).
  if (x0 < 2 || y0 < 2 || x0 + size.w > st.side - 2 || y0 + size.h > st.side - 2) return false;
  for (const c of cor) {
    if (c.x < 2 || c.y < 2 || c.x >= st.side - 2 || c.y >= st.side - 2) return false;
  }

  // Candidate cell set: corridor + room floor mask.
  const roomCells: Cell[] = [];
  for (let j = 0; j < size.h; j++) {
    for (let i = 0; i < size.w; i++) {
      if (inMask(size.shape, size.w, size.h, i, j)) roomCells.push({ x: x0 + i, y: y0 + j });
    }
  }
  const cand = new Set<number>();
  for (const c of cor) cand.add(gi(c.x, c.y, st.side));
  for (const c of roomCells) cand.add(gi(c.x, c.y, st.side));

  // The corridor must actually meet the new room's floor (masks can curve away).
  const doorIn = gi(end.x + dx, end.y + dy, st.side);
  if (!cand.has(doorIn)) return false;

  // Validation: candidates void; neighborhoods void/internal, except the source
  // door face which may touch source-room floor at the corridor's first cell.
  const door0 = gi(cor[0].x, cor[0].y, st.side);
  for (const k of cand) {
    if (st.grid[k] !== CellKind.Void) return false;
    const x = k % st.side;
    const y = (k / st.side) | 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nk = gi(x + ox, y + oy, st.side);
        if (st.grid[nk] === CellKind.Void || cand.has(nk)) continue;
        // Existing floor: only the source room's own floor hugging the door cell.
        if (k === door0 && st.roomOf[nk] === src.id) continue;
        return false;
      }
    }
  }

  // Commit.
  const room: Room = {
    id: st.rooms.length,
    x0, y0, w: size.w, h: size.h, shape: size.shape,
    type: 'combat', depth: 0, difficulty: 0, degree: 0, area: 0,
  };
  stampRoom(st, room);
  for (const c of cor) {
    const k = gi(c.x, c.y, st.side);
    st.grid[k] = CellKind.Floor;
    st.corridor[k] = 1;
    st.roomOf[k] = -2;
  }
  st.rooms.push(room);
  st.edges.push({ a: src.id, b: room.id, isLoop: false, isCritical: false });
  return true;
}

function grow(rng: Rng, roomCount: number): GrowState | null {
  const side = Math.max(72, Math.ceil(Math.sqrt(roomCount * 300)));
  const st: GrowState = {
    side,
    grid: new Uint8Array(side * side),
    corridor: new Uint8Array(side * side),
    roomOf: new Int16Array(side * side).fill(-1),
    rooms: [],
    edges: [],
    secret: new Set<number>(),
  };

  // Seed room at center.
  const first = pickRoomSize(rng);
  const seedRoom: Room = {
    id: 0,
    x0: (side - first.w) >> 1,
    y0: (side - first.h) >> 1,
    w: first.w, h: first.h, shape: first.shape,
    type: 'combat', depth: 0, difficulty: 0, degree: 0, area: 0,
  };
  stampRoom(st, seedRoom);
  st.rooms.push(seedRoom);

  const maxTries = roomCount * 60;
  for (let tries = 0; tries < maxTries && st.rooms.length < roomCount; tries++) {
    // Mix breadth (any room) and depth (recent rooms) so the map both sprawls
    // and grows long branches.
    const src = rng.chance(0.5)
      ? rng.pick(st.rooms)
      : st.rooms[rng.int(Math.max(0, st.rooms.length - 6), st.rooms.length - 1)];
    tryAttach(st, rng, src);
  }
  if (st.rooms.length < Math.max(3, Math.floor(roomCount * 0.7))) return null;
  return st;
}

// ─── Stage 2: loops ──────────────────────────────────────────────────────────

/**
 * Open extra doors where two DIFFERENT rooms sit 1–2 wall cells apart in a
 * straight line. One candidate per room pair (the middle one in scan order);
 * each opens with `loopChance` and records an `isLoop` edge — so loop count
 * stays exactly the cyclomatic number of the room graph.
 */
function addLoops(st: GrowState, rng: Rng, loopChance: number): void {
  interface Cand { cells: number[]; a: number; b: number }
  const byPair = new Map<string, Cand[]>();
  const S = st.side;

  const roomAt = (k: number): number => (st.grid[k] === CellKind.Floor ? st.roomOf[k] : -1);

  for (let y = 2; y < S - 2; y++) {
    for (let x = 2; x < S - 2; x++) {
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
          if (a1 >= 0 && b2 >= 0 && a1 !== b2) push(a1, b2, [k, k2]);
        }
      }
    }
  }

  function push(a: number, b: number, cells: number[]): void {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const arr = byPair.get(key) ?? [];
    arr.push({ cells, a: Math.min(a, b), b: Math.max(a, b) });
    byPair.set(key, arr);
  }

  const existing = new Set(st.edges.map((e) => `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`));
  // Deterministic order: Map preserves insertion order (scan order).
  for (const [key, cands] of byPair) {
    if (existing.has(key)) continue;
    if (!rng.chance(loopChance)) continue;
    const c = cands[cands.length >> 1];
    // ~1 in 3 loop connections is a secret passage (hidden until searched).
    const isSecret = rng.chance(0.33);
    for (const k of c.cells) {
      st.grid[k] = CellKind.Floor;
      st.corridor[k] = 1;
      st.roomOf[k] = -2;
      if (isSecret) st.secret.add(k);
    }
    st.edges.push({ a: c.a, b: c.b, isLoop: true, isCritical: false, isSecret });
    existing.add(key);
  }
}

// ─── Stage 3: crop ───────────────────────────────────────────────────────────

function crop(st: GrowState): { grid: Uint8Array; corridor: Uint8Array; roomOf: Int16Array; W: number; H: number; secretCells: Cell[] } {
  const S = st.side;
  let minX = S;
  let minY = S;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (st.grid[gi(x, y, S)] !== CellKind.Void) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const W = maxX - minX + 1 + MARGIN * 2;
  const H = maxY - minY + 1 + MARGIN * 2;
  const grid = new Uint8Array(W * H);
  const corridor = new Uint8Array(W * H);
  const roomOf = new Int16Array(W * H).fill(-1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const from = gi(x, y, S);
      const to = gi(x - minX + MARGIN, y - minY + MARGIN, W);
      grid[to] = st.grid[from];
      corridor[to] = st.corridor[from];
      roomOf[to] = st.roomOf[from];
    }
  }
  for (const r of st.rooms) {
    r.x0 = r.x0 - minX + MARGIN;
    r.y0 = r.y0 - minY + MARGIN;
  }
  const secretCells: Cell[] = [];
  for (const k of st.secret) {
    secretCells.push({ x: (k % S) - minX + MARGIN, y: ((k / S) | 0) - minY + MARGIN });
  }
  secretCells.sort((a, b) => a.y - b.y || a.x - b.x);
  return { grid, corridor, roomOf, W, H, secretCells };
}

// ─── Stage 4: semantics ──────────────────────────────────────────────────────

function adjacency(n: number, edges: DungeonEdge[]): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }
  return adj;
}

/** BFS returning distance + parent arrays over the room graph. */
function bfsGraph(adj: number[][], src: number): { dist: number[]; parent: number[] } {
  const n = adj.length;
  const distArr = new Array<number>(n).fill(-1);
  const parent = new Array<number>(n).fill(-1);
  const queue = [src];
  distArr[src] = 0;
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    for (const v of adj[u]) {
      if (distArr[v] === -1) {
        distArr[v] = distArr[u] + 1;
        parent[v] = u;
        queue.push(v);
      }
    }
  }
  return { dist: distArr, parent };
}

function assignSemantics(rng: Rng, rooms: Room[], edges: DungeonEdge[]): {
  entranceId: number;
  bossId: number;
  criticalRoomIds: number[];
} {
  const n = rooms.length;
  const adj = adjacency(n, edges);
  rooms.forEach((r, i) => { r.degree = adj[i].length; });

  // Entrance: the degree-1 room at one end of the graph diameter (double BFS),
  // so the run to the far side is as long as the layout allows.
  const d0 = bfsGraph(adj, 0).dist;
  let far = 0;
  for (let i = 1; i < n; i++) if (d0[i] > d0[far]) far = i;
  const dFar = bfsGraph(adj, far).dist;
  let entranceId = -1;
  let bestD = -1;
  for (let i = 0; i < n; i++) {
    if (rooms[i].degree !== 1) continue;
    if (dFar[i] > bestD) { bestD = dFar[i]; entranceId = i; }
  }
  if (entranceId === -1) entranceId = far; // heavy looping ate every leaf

  // Boss: deepest tier from the entrance, preferring the biggest room in it,
  // never adjacent to the entrance.
  const { dist: depth, parent } = bfsGraph(adj, entranceId);
  const maxDepth = Math.max(1, ...depth.filter((d) => d >= 0));
  let bossId = -1;
  let bossScore = -1;
  for (let i = 0; i < n; i++) {
    if (i === entranceId) continue;
    if (depth[i] < Math.max(2, Math.ceil(0.6 * maxDepth))) continue;
    if (adj[entranceId].includes(i)) continue;
    // Inside the deep tier, size matters most — the climax needs an arena,
    // not the single deepest closet.
    const score = rooms[i].w * rooms[i].h + depth[i] * 4;
    if (score > bossScore) { bossScore = score; bossId = i; }
  }
  if (bossId === -1) {
    for (let i = 0; i < n; i++) {
      if (i !== entranceId && !adj[entranceId].includes(i) && (bossId === -1 || depth[i] > depth[bossId])) bossId = i;
    }
  }

  // Critical path entrance → boss.
  const criticalRoomIds: number[] = [];
  for (let v = bossId; v !== -1; v = parent[v]) criticalRoomIds.push(v);
  criticalRoomIds.reverse();
  const onCritical = new Set(criticalRoomIds);
  for (const e of edges) {
    const ai = criticalRoomIds.indexOf(e.a);
    e.isCritical = ai !== -1 && (criticalRoomIds[ai + 1] === e.b || criticalRoomIds[ai - 1] === e.b);
  }

  // Depth + difficulty ramp.
  rooms.forEach((r, i) => {
    r.depth = Math.max(0, depth[i]);
    r.difficulty = 0.15 + 0.85 * (r.depth / maxDepth);
  });

  // Types. Boss + entrance first.
  rooms.forEach((r) => { r.type = 'combat'; });
  rooms[bossId].type = 'boss';
  rooms[bossId].difficulty = 1.0;
  rooms[entranceId].type = 'entrance';
  rooms[entranceId].difficulty = 0;

  // Treasure: up to 4 dead-end leaves (deepest first), off the critical path.
  const leaves = rooms
    .filter((r) => r.degree === 1 && r.id !== entranceId && r.id !== bossId && !onCritical.has(r.id))
    .sort((a, b) => b.depth - a.depth);
  for (const r of leaves.slice(0, 4)) r.type = 'treasure';

  // Shrines: 1–2 mid-depth rooms off the critical path (not already special).
  const midLo = maxDepth * 0.35;
  const midHi = maxDepth * 0.7;
  const shrinePool = rooms.filter(
    (r) => r.type === 'combat' && !onCritical.has(r.id) && r.depth >= midLo && r.depth <= midHi,
  );
  const shrineCount = shrinePool.length ? rng.int(1, 2) : 0;
  for (let k = 0; k < shrineCount && shrinePool.length; k++) {
    shrinePool.splice(rng.int(0, shrinePool.length - 1), 1)[0].type = 'shrine';
  }

  // Elite gates: 1–2 critical-path rooms at 55–85% depth.
  const elitePool = criticalRoomIds
    .map((id) => rooms[id])
    .filter((r) => r.type === 'combat' && r.depth >= maxDepth * 0.55 && r.depth <= maxDepth * 0.85);
  const eliteCount = elitePool.length ? rng.int(1, 2) : 0;
  for (let k = 0; k < eliteCount && elitePool.length; k++) {
    elitePool.splice(rng.int(0, elitePool.length - 1), 1)[0].type = 'elite';
  }

  return { entranceId, bossId, criticalRoomIds };
}

// ─── Stage 5: rasterize ──────────────────────────────────────────────────────

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]];

/** Mark VOID cells that touch a FLOOR cell (8-neighbor) as WALL. */
function rasterizeWalls(grid: Uint8Array, W: number, H: number): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[gi(x, y, W)] !== CellKind.Void) continue;
      for (const [dx, dy] of N8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (grid[gi(nx, ny, W)] === CellKind.Floor) {
          grid[gi(x, y, W)] = CellKind.Wall;
          break;
        }
      }
    }
  }
}

/** BFS distance field over FLOOR (4-connected) from a source cell; −1 elsewhere. */
function distanceField(grid: Uint8Array, W: number, H: number, sx: number, sy: number): Int16Array {
  const bfs = new Int16Array(W * H).fill(-1);
  if (grid[gi(sx, sy, W)] !== CellKind.Floor) return bfs;
  const queue = [gi(sx, sy, W)];
  bfs[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % W;
    const cy = (cur / W) | 0;
    for (const [dx, dy] of N4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = gi(nx, ny, W);
      if (grid[ni] === CellKind.Floor && bfs[ni] === -1) {
        bfs[ni] = bfs[cur] + 1;
        queue.push(ni);
      }
    }
  }
  return bfs;
}

// ─── Stage 6: decorate ───────────────────────────────────────────────────────

/** Doorway = corridor cell 4-adjacent to a room-floor cell. */
function findDoorways(roomOf: Int16Array, W: number, H: number): Cell[] {
  const doors: Cell[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (roomOf[gi(x, y, W)] !== -2) continue;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (roomOf[gi(nx, ny, W)] >= 0) { doors.push({ x, y }); break; }
      }
    }
  }
  return doors;
}

const CR_TABLE: Array<{ cr: string; xp: number; key: string }> = [
  { cr: '1/8', xp: 25, key: 'crypt_rat' },
  { cr: '1/4', xp: 50, key: 'skeleton' },
  { cr: '1/2', xp: 100, key: 'ghoul' },
  { cr: '1', xp: 200, key: 'specter' },
  { cr: '2', xp: 450, key: 'wight' },
  { cr: '3', xp: 700, key: 'wraith' },
];

function decorate(
  rng: Rng,
  rooms: Room[],
  grid: Uint8Array,
  roomOf: Int16Array,
  W: number,
  H: number,
  doorSet: Set<number>,
  decorDensity: number,
): { props: DungeonProp[]; spawns: DungeonSpawn[]; traps: DungeonTrap[] } {
  const props: DungeonProp[] = [];
  const spawns: DungeonSpawn[] = [];
  const traps: DungeonTrap[] = [];
  const occupied = new Set<number>();

  /** Blocked for placement: occupied, a doorway, or hugging a doorway. */
  const blocked = (x: number, y: number): boolean => {
    const i = gi(x, y, W);
    if (occupied.has(i) || doorSet.has(i)) return true;
    for (const [dx, dy] of N4) {
      if (doorSet.has(gi(x + dx, y + dy, W))) return true;
    }
    return false;
  };

  const roomCells = (r: Room): Cell[] => {
    const cells: Cell[] = [];
    for (let j = 0; j < r.h; j++) {
      for (let i = 0; i < r.w; i++) {
        if (roomOf[gi(r.x0 + i, r.y0 + j, W)] === r.id) cells.push({ x: r.x0 + i, y: r.y0 + j });
      }
    }
    return cells;
  };

  for (const r of rooms) {
    const cells = roomCells(r);
    if (!cells.length) continue;
    const cx = roomCx(r);
    const cy = roomCy(r);

    // Colonnades: symmetric pillar rows in big rectangular halls.
    if (r.shape === 'rect' && r.w >= 9 && r.h >= 7) {
      const colL = r.x0 + 2;
      const colR = r.x0 + r.w - 3;
      for (let y = r.y0 + 2; y <= r.y0 + r.h - 3; y += 3) {
        for (const px of [colL, colR]) {
          if (blocked(px, y)) continue;
          occupied.add(gi(px, y, W));
          props.push({ kind: 'pillar', x: px, y, rot: 0, scale: 1, roomId: r.id });
        }
      }
    }

    // Torches: floor cells adjacent to a wall, min Chebyshev spacing 5.
    const torches: Cell[] = [];
    for (const c of cells) {
      let nearWall = false;
      for (const [dx, dy] of N8) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (grid[gi(nx, ny, W)] === CellKind.Wall) { nearWall = true; break; }
      }
      if (!nearWall) continue;
      if (torches.some((t) => Math.max(Math.abs(t.x - c.x), Math.abs(t.y - c.y)) < 5)) continue;
      torches.push(c);
    }
    for (const c of torches) {
      if (blocked(c.x, c.y)) continue;
      occupied.add(gi(c.x, c.y, W));
      props.push({ kind: 'torch', x: c.x, y: c.y, rot: 0, scale: 1, roomId: r.id });
    }

    // Set-piece props by room type (room centers are floor by construction for
    // rects; masks keep their centers too).
    const centerI = gi(cx, cy, W);
    if (r.type === 'treasure' && roomOf[centerI] === r.id && !doorSet.has(centerI)) {
      props.push({ kind: 'chest', x: cx, y: cy, rot: 0, scale: 1, roomId: r.id });
      occupied.add(centerI);
    }
    if (r.type === 'shrine' && roomOf[centerI] === r.id && !doorSet.has(centerI)) {
      props.push({ kind: 'crystal', x: cx, y: cy, rot: 0, scale: 1, roomId: r.id });
      occupied.add(centerI);
    }
    if (r.type === 'entrance' && roomOf[centerI] === r.id) {
      props.push({ kind: 'stairs', x: cx, y: cy, rot: 0, scale: 1, roomId: r.id });
      occupied.add(centerI);
    }

    // Traps: mid-to-deep rooms only, never the entrance or the boss arena.
    if (r.type !== 'entrance' && r.type !== 'boss' && r.difficulty >= 0.35 && rng.chance(0.22)) {
      const c = cells[rng.int(0, cells.length - 1)];
      if (!blocked(c.x, c.y)) {
        occupied.add(gi(c.x, c.y, W));
        traps.push({ x: c.x, y: c.y, kind: rng.pick(['pit', 'darts', 'snare'] as const), roomId: r.id });
      }
    }

    // Sparse debris, denser in shallow rooms; halls stay mostly open.
    const debrisTarget = Math.round(cells.length * 0.02 * decorDensity * (1.3 - r.difficulty));
    for (let k = 0; k < debrisTarget; k++) {
      const c = cells[rng.int(0, cells.length - 1)];
      if (blocked(c.x, c.y)) continue;
      occupied.add(gi(c.x, c.y, W));
      props.push({ kind: 'debris', x: c.x, y: c.y, rot: rng.pick([0, 90, 180, 270]) as 0 | 90 | 180 | 270, scale: rng.float(0.7, 1.1), roomId: r.id });
    }

    // Spawns: combat / elite / boss only, sized to the room's XP budget.
    if (r.type === 'combat' || r.type === 'elite' || r.type === 'boss') {
      const count = r.type === 'boss'
        ? 1
        : Math.max(1, Math.round((r.area / 24) * (0.5 + r.difficulty)));
      const tierBase = r.type === 'boss' ? 5 : Math.min(5, Math.floor(r.difficulty * (CR_TABLE.length - 1)));
      for (let k = 0; k < count; k++) {
        const c = cells[rng.int(0, cells.length - 1)];
        if (blocked(c.x, c.y)) continue;
        occupied.add(gi(c.x, c.y, W));
        const tier = CR_TABLE[Math.min(CR_TABLE.length - 1, tierBase + (r.type === 'elite' ? 1 : 0))];
        spawns.push({ x: c.x, y: c.y, cr: tier.cr, xp: tier.xp, monsterKey: tier.key, roomId: r.id });
      }
    }
  }
  return { props, spawns, traps };
}

// ─── Name generator ──────────────────────────────────────────────────────────

const NAME_ADJ = ['Ashen', 'Sunken', 'Forgotten', 'Weeping', 'Hollow', 'Shattered', 'Gloaming', 'Rotting'];
const NAME_NOUN = ['Vaults', 'Catacombs', 'Warrens', 'Crypts', 'Depths', 'Halls', 'Tombs', 'Oubliette'];
const NAME_PRE = ['Vor', 'Mor', 'Kal', 'Zeth', 'Ul', 'Grim', 'Thal', 'Nyx'];
const NAME_SUF = ["'gul", 'oth', 'reth', 'ashk', "'dur", 'vane', 'mir', 'gorn'];

function dungeonName(rng: Rng): string {
  return `The ${rng.pick(NAME_ADJ)} ${rng.pick(NAME_NOUN)} of ${rng.pick(NAME_PRE)}${rng.pick(NAME_SUF)}`;
}

// ─── Assembly + connectivity guard ───────────────────────────────────────────

function floodReaches(grid: Uint8Array, bfs: Int16Array): boolean {
  let floor = 0;
  let reached = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === CellKind.Floor) {
      floor++;
      if (bfs[i] >= 0) reached++;
    }
  }
  return floor > 0 && reached === floor;
}

function generateOnce(path: SeedPath, params: DungeonParams): DungeonPlan | null {
  const st = grow(makeRng(streamPath(path, 'grow')), params.roomCount);
  if (!st) return null;
  addLoops(st, makeRng(streamPath(path, 'loops')), params.loopChance);

  const { grid, corridor, roomOf, W, H, secretCells } = crop(st);
  const rooms = st.rooms;
  const edges = st.edges;

  const { entranceId, bossId, criticalRoomIds } = assignSemantics(
    makeRng(streamPath(path, 'semantics')), rooms, edges,
  );

  rasterizeWalls(grid, W, H);
  const entrance = rooms[entranceId];
  const bfs = distanceField(grid, W, H, roomCx(entrance), roomCy(entrance));
  if (!floodReaches(grid, bfs)) return null;

  const doorways = findDoorways(roomOf, W, H);
  const doorSet = new Set(doorways.map((d) => gi(d.x, d.y, W)));
  const corridorCells: Cell[] = [];
  for (let i = 0; i < corridor.length; i++) {
    if (corridor[i] === 1) corridorCells.push({ x: i % W, y: (i / W) | 0 });
  }
  const { props, spawns, traps } = decorate(
    makeRng(streamPath(path, 'decor')), rooms, grid, roomOf, W, H, doorSet, params.decorDensity,
  );

  let floorTiles = 0;
  let wallTiles = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === CellKind.Floor) floorTiles++;
    else if (grid[i] === CellKind.Wall) wallTiles++;
  }
  const loops = edges.filter((e) => e.isLoop).length;

  const outRooms: DungeonRoom[] = rooms.map((r) => ({
    id: r.id, cx: roomCx(r), cy: roomCy(r), w: r.w, h: r.h, shape: r.shape,
    type: r.type, depth: r.depth, difficulty: r.difficulty, degree: r.degree, area: r.area,
  }));

  return {
    params,
    seed: 0, // filled by caller
    name: dungeonName(makeRng(streamPath(path, 'name'))),
    W, H, cellFt: CELL_FT, widthFt: W * CELL_FT, depthFt: H * CELL_FT,
    grid, corridor, bfs,
    rooms: outRooms, edges,
    doorways, secretDoorCells: secretCells, corridorCells, props, spawns, traps,
    entranceId, bossId, criticalRoomIds,
    stats: {
      rooms: rooms.length,
      roomsRequested: params.roomCount,
      edges: edges.length,
      loops,
      cyclomatic: edges.length - rooms.length + 1,
      criticalLength: criticalRoomIds.length,
      floorTiles, wallTiles,
      props: props.length,
      spawns: spawns.length,
      encounterXp: spawns.reduce((s, sp) => s + sp.xp, 0),
      genMs: 0,
      attempts: 1,
    },
  };
}

/**
 * Generate a full dungeon plan. Deterministic in `input.seed` + params; re-rolls
 * internally (max 5 derived attempts) if a layout places too few rooms or fails
 * the 100% connectivity check, and throws honestly if none succeed.
 */
export function generateDungeon(input: DungeonInput): DungeonPlan {
  const params: DungeonParams = { ...DEFAULT_PARAMS, ...input.params };
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const base = rootSeedPath(input.seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const path = attempt === 0 ? childSeedPath(base, 'dungeon') : childSeedPath(base, `dungeon:retry:${attempt}`);
    const plan = generateOnce(path, params);
    if (plan) {
      plan.seed = input.seed;
      plan.stats.attempts = attempt + 1;
      plan.stats.genMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      return plan;
    }
  }
  throw new Error(
    `generateDungeon: no connected layout after ${MAX_ATTEMPTS} attempts (seed ${input.seed}, roomCount ${params.roomCount}).`,
  );
}
