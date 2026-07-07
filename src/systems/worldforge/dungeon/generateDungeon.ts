/**
 * @file generateDungeon.ts
 * @description Deterministic procedural dungeon generator — pure data, zero
 * THREE imports. Spec: docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md.
 *
 * HISTORY-FIRST PIPELINE (the growth-based "blob" layout Remy rejected is gone).
 * A dungeon is built INTACT for a purpose, then centuries of decay events are
 * simulated on that structure; the playable ruin is the OUTPUT of that history.
 * Every stage draws from its own named seed sub-stream so adding a draw to one
 * never perturbs another:
 *   1. buildIntact      → purpose-built room tree (entrance degree 1, per-room
 *                         `purpose`, waterworks built-wet cells). Stream
 *                         `build:<archetype>`.
 *   2. simulateHistory  → MUTATES the grid/edges to the (possibly cutoff) ruin:
 *                         seals, collapses, floods, robber tunnels + loops,
 *                         brick-offs, dens/awakenings. Returns the event log,
 *                         surface overlay, door states, evidence props, and
 *                         occupations (one flagged apex). Stream `history`.
 *   3. crop             → shrink the working grid to the used extent + margin,
 *                         remapping the overlay, door-state keys, evidence-prop
 *                         cells, and room boxes into cropped coordinates.
 *   4. assignSemantics  → entrance = builder's degree-1 entry; boss = deepest
 *                         room of the apex occupation; BFS depth/difficulty ramp
 *                         + entrance→boss critical path.
 *   5. rasterize        → walls (void touching floor) + BFS distance field, with
 *                         the 100%-reachability flood-fill guard retained.
 *   6. furnishAndStamp  → per-purpose built furniture + torches (eventRef-free),
 *                         event evidence props (eventRef'd), occupation-driven
 *                         spawns (apex → boss spawn), and traps (builder
 *                         defenses eventRef-free, decay hazards eventRef'd).
 *                         Stream `furnish`.
 *   7. deriveLore       → name/blurb/room notes/rumor hooks, every sentence a
 *                         true statement about a logged event. Stream `lore`.
 *
 * Determinism: every draw comes from `rngFromPath` over a `wf:<seed>/dungeon`
 * path. A layout that places too few rooms (buildIntact returns null) re-rolls
 * against a derived path (max 5 attempts) and fails honestly (no-fallback
 * directive). The final flood-fill guard is belt-and-braces over the reachability
 * assertion simulateHistory already makes.
 *
 * Feet-at-the-plan-boundary: the generator works in 5 ft cells throughout;
 * entity coordinates convert to plot-local feet exactly once, at the return.
 */

import { childSeedPath, rootSeedPath, streamPath, type SeedPath } from '../seedPath';
import {
  CELL_FT,
  CellKind,
  type Cell,
  type DoorState,
  type DungeonDoor,
  type DungeonEdge,
  type DungeonEvent,
  type DungeonInput,
  type DungeonParams,
  type DungeonPlan,
  type DungeonProp,
  type DungeonRoom,
  type DungeonSpawn,
  type DungeonTheme,
  type DungeonTrap,
  type WorldIdentity,
} from './types';
import { bestiaryForSite } from './world/bestiaryTable';
import { roomBudget, encounterMultiplier } from './encounterBudget';
// Shared grid/room/mask substrate lives in buildIntact.ts; re-imported here so
// nothing is duplicated between the builder and the assembly path.
import {
  buildIntact,
  gi,
  makeRng,
  roomCx,
  roomCy,
  type IntactState,
  type Rng,
  type Room,
} from './buildIntact';
import { ARCHETYPES, THEME_ARCHETYPE, FURNITURE } from './archetypes';
import { simulateHistory, type HistoryResult } from './simulateHistory';
import { deriveLore } from './lore';

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

/**
 * Per-archetype default sprawl (center ± half-jitter). The mausoleum crypt is
 * TIGHT (packed suites); the mine is the most SPRAWLING (rooms strung far along
 * drifts). When params.sprawl is not pinned, the resolved value is drawn from a
 * dedicated 'sprawl' seed stream so it never perturbs the build/circulation
 * streams' determinism.
 */
const SPRAWL_DEFAULTS: Record<string, { center: number; jitter: number }> = {
  mausoleum: { center: 0.15, jitter: 0.1 },
  fortress: { center: 0.25, jitter: 0.1 },
  waterworks: { center: 0.45, jitter: 0.15 },
  mine: { center: 0.6, jitter: 0.2 },
};

/**
 * Resolve the layout dial. If the caller pinned params.sprawl, honor it exactly
 * (clamped). Otherwise draw the archetype default ± jitter from the dedicated
 * 'sprawl' sub-stream, so the default's draw is isolated from every other stage.
 */
function resolveSprawl(path: SeedPath, params: DungeonParams, archetype: string): number {
  if (params.sprawl !== undefined) return Math.max(0, Math.min(1, params.sprawl));
  const def = SPRAWL_DEFAULTS[archetype] ?? { center: 0.3, jitter: 0.1 };
  const rng = makeRng(streamPath(path, 'sprawl'));
  const v = def.center + rng.float(-def.jitter, def.jitter);
  return Math.max(0, Math.min(1, v));
}

// ─── Stage 3: crop ───────────────────────────────────────────────────────────

interface Cropped {
  grid: Uint8Array;
  corridor: Uint8Array;
  roomOf: Int16Array;
  overlay: Uint8Array;
  W: number;
  H: number;
  /** Origin of the cropped window in working-grid coordinates + working side, so
   * a working-grid cell index re-bases to a cropped one by pure arithmetic (no
   * 70k-entry Map) via {@link remapCell}. */
  offX: number;
  offY: number;
  side: number;
}

/**
 * Shrink the working grid to the used extent + a fixed margin, mutating room
 * boxes to cropped coordinates in place. The overlay bitmap is cropped in
 * lockstep with the grid (waterworks built-water is already baked into it by
 * simulateHistory). The crop window origin is returned so door-state keys and
 * evidence-prop cells re-base by arithmetic (see {@link remapCell}).
 */
function crop(st: IntactState, overlayIn: Uint8Array): Cropped {
  const S = st.side;
  let minX = S;
  let minY = S;
  let maxX = 0;
  let maxY = 0;
  const g = st.grid;
  for (let i = 0; i < g.length; i++) {
    if (g[i] === CellKind.Void) continue;
    const x = i % S;
    const y = (i / S) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const W = maxX - minX + 1 + MARGIN * 2;
  const H = maxY - minY + 1 + MARGIN * 2;
  const grid = new Uint8Array(W * H);
  const corridor = new Uint8Array(W * H);
  const roomOf = new Int16Array(W * H).fill(-1);
  const overlay = new Uint8Array(W * H);
  const offX = minX - MARGIN;
  const offY = minY - MARGIN;
  for (let y = minY; y <= maxY; y++) {
    let from = gi(minX, y, S);
    let to = gi(minX - offX, y - offY, W);
    for (let x = minX; x <= maxX; x++, from++, to++) {
      grid[to] = st.grid[from];
      corridor[to] = st.corridor[from];
      roomOf[to] = st.roomOf[from];
      overlay[to] = overlayIn[from];
    }
  }
  for (const r of st.rooms) {
    r.x0 -= offX;
    r.y0 -= offY;
  }
  return { grid, corridor, roomOf, overlay, W, H, offX, offY, side: S };
}

/** Re-base a working-grid cell index into the cropped grid, or -1 if outside. */
function remapCell(cell: number, c: Cropped, W: number): number {
  const x = (cell % c.side) - c.offX;
  const y = ((cell / c.side) | 0) - c.offY;
  if (x < 0 || y < 0 || x >= W || y >= c.H) return -1;
  return y * W + x;
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

/**
 * Assign entrance / boss / critical path and the depth-difficulty ramp.
 *
 * ENTRANCE is the builder's degree-1 entry room (`st.entranceId`) — the intact
 * builder guarantees it sits at graph degree 1; we verify and throw if a rule
 * bug ever violated that (honest failure over a shipped-broken map).
 *
 * BOSS is the deepest room of the APEX occupation. simulateHistory already picks
 * the apex occupation's rooms at ≥60% of graph depth and never entrance-adjacent,
 * so the deepest of them satisfies the boss-depth and not-adjacent invariants by
 * construction. If a cutoff replay left NO apex occupation applied (the boss had
 * not moved in yet at that year), fall back to the deepest non-entrance,
 * non-adjacent room so the plan still has a climax tile.
 */
function assignSemantics(
  rooms: Room[],
  edges: DungeonEdge[],
  entranceId: number,
  history: HistoryResult,
): { bossId: number; criticalRoomIds: number[] } {
  const n = rooms.length;
  const adj = adjacency(n, edges);
  rooms.forEach((r, i) => { r.degree = adj[i].length; });

  if (rooms[entranceId].degree !== 1) {
    throw new Error(
      `generateDungeon: entrance room ${entranceId} has degree ${rooms[entranceId].degree}, expected 1`,
    );
  }

  const { dist: depth, parent } = bfsGraph(adj, entranceId);
  const maxDepth = Math.max(1, ...depth.filter((d) => d >= 0));

  // Boss = deepest room of the apex occupation. reassignApex made exactly one
  // occupation apex in the applied state (if any survived the cutoff).
  const apex = history.occupations.find((o) => o.isApex);
  const entranceAdj = new Set(adj[entranceId]);
  let bossId = -1;
  if (apex) {
    let bossDepth = -1;
    for (const rid of apex.roomIds) {
      if (rid === entranceId || entranceAdj.has(rid)) continue;
      if (depth[rid] > bossDepth) { bossDepth = depth[rid]; bossId = rid; }
    }
  }
  if (bossId === -1) {
    // No apex applied (deep cutoff) or its rooms were all filtered — deepest
    // eligible room stands in as the climax.
    let bossDepth = -1;
    for (let i = 0; i < n; i++) {
      if (i === entranceId || entranceAdj.has(i)) continue;
      if (depth[i] > bossDepth) { bossDepth = depth[i]; bossId = i; }
    }
  }
  if (bossId === -1) bossId = entranceId === 0 ? Math.min(1, n - 1) : 0; // degenerate tiny graph

  // Critical path entrance → boss.
  const criticalRoomIds: number[] = [];
  for (let v = bossId; v !== -1; v = parent[v]) criticalRoomIds.push(v);
  criticalRoomIds.reverse();
  for (const e of edges) {
    const ai = criticalRoomIds.indexOf(e.a);
    e.isCritical = ai !== -1 && (criticalRoomIds[ai + 1] === e.b || criticalRoomIds[ai - 1] === e.b);
  }

  // Depth + difficulty ramp (kept from the growth path).
  rooms.forEach((r, i) => {
    r.depth = Math.max(0, depth[i]);
    r.difficulty = 0.15 + 0.85 * (r.depth / maxDepth);
  });

  // Room types: entrance + boss first; combat elsewhere; then treasure leaves
  // (deepest dead ends off the critical path) and shrines (mid-depth, off path).
  const onCritical = new Set(criticalRoomIds);
  rooms.forEach((r) => { r.type = 'combat'; });
  rooms[bossId].type = 'boss';
  rooms[bossId].difficulty = 1.0;
  rooms[entranceId].type = 'entrance';
  rooms[entranceId].difficulty = 0;

  const leaves = rooms
    .filter((r) => r.degree === 1 && r.id !== entranceId && r.id !== bossId && !onCritical.has(r.id))
    .sort((a, b) => b.depth - a.depth);
  for (const r of leaves.slice(0, 4)) r.type = 'treasure';

  return { bossId, criticalRoomIds };
}

// ─── Stage 5: rasterize ──────────────────────────────────────────────────────

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]];

/** Mark VOID cells that touch a FLOOR cell (8-neighbor) as WALL; return the wall
 * count so callers need no separate tally pass. */
function rasterizeWalls(grid: Uint8Array, W: number, H: number): number {
  let walls = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = gi(x, y, W);
      if (grid[k] !== CellKind.Void) continue;
      for (const [dx, dy] of N8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (grid[gi(nx, ny, W)] === CellKind.Floor) {
          grid[k] = CellKind.Wall;
          walls++;
          break;
        }
      }
    }
  }
  return walls;
}

/** BFS distance field over FLOOR (4-connected) from a source cell; −1 elsewhere. */
function distanceField(grid: Uint8Array, W: number, H: number, sx: number, sy: number): Int16Array {
  const bfs = new Int16Array(W * H).fill(-1);
  if (grid[gi(sx, sy, W)] !== CellKind.Floor) {
    // Center can fall on a mask hole; seed from any floor cell in bounds.
    let seeded = false;
    for (let i = 0; i < grid.length && !seeded; i++) {
      if (grid[i] === CellKind.Floor) { sx = i % W; sy = (i / W) | 0; seeded = true; }
    }
    if (!seeded) return bfs;
  }
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

// ─── Stage 6: furnish + stamp ────────────────────────────────────────────────

interface FurnishResult {
  props: DungeonProp[];
  spawns: DungeonSpawn[];
  traps: DungeonTrap[];
}

// Monster tiers per theme live in world/bestiaryTable.ts (real bestiary ids;
// the occupation actor family decides the tier band, the room's XP budget
// decides the count). Resolved per site via bestiaryForSite(theme, biomeName).

/** Debris/torch/trap vocabularies per theme (built furniture flavor). */
const DEBRIS: Record<string, readonly string[]> = {
  crypt: ['bones', 'rubble', 'debris'],
  cavern: ['stalagmite', 'mushroom', 'rubble'],
  frost: ['iceshard', 'rubble', 'bones'],
  sewer: ['rubble', 'pool', 'bones'],
  fungal: ['mushroom', 'mushroom', 'rubble'],
};

/**
 * Furnish an intact-then-decayed dungeon and stamp every entity.
 *
 * (a) BUILT FURNITURE — per-purpose `FURNITURE`, placed by layout with the old
 *     blocked() guard (no eventRef). Torches hug walls (eventRef-free).
 * (b) EVIDENCE PROPS — the debris/nests/pried-vaults events left, carrying the
 *     causing eventRef, re-based to cropped cells.
 * (c) SPAWNS — ONLY from occupations. Each occupation's rooms are filled with
 *     monsters from the theme's CR band for the actor family (mostly the band
 *     tier, an occasional band-1 tier for variety, seeded), adding creatures
 *     until the room's MULTIPLIER-ADJUSTED XP would exceed its 5e encounter
 *     budget × 1.2 (roomBudget(partyLevel, difficulty); see encounterBudget.ts).
 *     Occupied combat rooms always get ≥1 spawn even when a single band monster
 *     already tops the budget (small shallow rooms). The apex occupation's
 *     deepest room (the boss room) gets EXACTLY ONE boss-tier spawn — that lone
 *     capstone CR may legally exceed the room budget at low partyLevel; it is the
 *     climax and is allowed by design.
 * (d) TRAPS — only in event-touched rooms or purpose ∈ {treasury, chapel}.
 *     Builder defenses (treasury/chapel) are eventRef-free; decay hazards
 *     (flood/collapse/fire-touched rooms) carry the touching event's ref.
 */
function furnishAndStamp(
  rng: Rng,
  rooms: Room[],
  grid: Uint8Array,
  roomOf: Int16Array,
  W: number,
  H: number,
  doorSet: Set<number>,
  overlay: Uint8Array,
  history: HistoryResult,
  cropped: Cropped,
  theme: DungeonTheme,
  bossId: number,
  decorDensity: number,
  partyLevel: number,
  biomeName?: string,
): FurnishResult {
  const props: DungeonProp[] = [];
  const spawns: DungeonSpawn[] = [];
  const traps: DungeonTrap[] = [];
  const occupied = new Set<number>();
  const crTable = bestiaryForSite(theme, biomeName);
  const debrisKinds = DEBRIS[theme] ?? DEBRIS.crypt;

  /** Blocked for placement: occupied, a doorway, or hugging a doorway. */
  const blocked = (x: number, y: number): boolean => {
    const i = gi(x, y, W);
    if (occupied.has(i) || doorSet.has(i)) return true;
    if (grid[i] !== CellKind.Floor) return true;
    for (const [dx, dy] of N4) {
      if (doorSet.has(gi(x + dx, y + dy, W))) return true;
    }
    return false;
  };

  // Per-room floor cells, computed once (avoids repeated O(area) scans).
  const cellsByRoom = new Map<number, Cell[]>();
  const roomCells = (r: Room): Cell[] => {
    let cells = cellsByRoom.get(r.id);
    if (cells) return cells;
    cells = [];
    for (let j = 0; j < r.h; j++) {
      for (let i = 0; i < r.w; i++) {
        if (roomOf[gi(r.x0 + i, r.y0 + j, W)] === r.id) cells.push({ x: r.x0 + i, y: r.y0 + j });
      }
    }
    cellsByRoom.set(r.id, cells);
    return cells;
  };

  const nearWall = (x: number, y: number): boolean => {
    for (const [dx, dy] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (grid[gi(nx, ny, W)] === CellKind.Wall) return true;
    }
    return false;
  };

  // ── (a) Built furniture + torches, per room ────────────────────────────────
  for (const r of rooms) {
    const cells = roomCells(r);
    if (!cells.length) continue;

    // Purpose-driven furniture.
    const furniture = FURNITURE[r.purpose];
    if (furniture) {
      for (const f of furniture) {
        const target = f.countPerCells === 0
          ? 1
          : Math.max(1, Math.floor(cells.length / f.countPerCells));
        placeByLayout(r, cells, f.kind, f.layout, target, W, grid, roomOf, nearWall, blocked, occupied, props);
      }
    }

    // Torches: floor cells adjacent to a wall, min Chebyshev spacing 5. Built,
    // eventRef-free.
    const torches: Cell[] = [];
    for (const c of cells) {
      if (!nearWall(c.x, c.y)) continue;
      if (torches.some((t) => Math.max(Math.abs(t.x - c.x), Math.abs(t.y - c.y)) < 5)) continue;
      torches.push(c);
    }
    for (const c of torches) {
      if (blocked(c.x, c.y)) continue;
      occupied.add(gi(c.x, c.y, W));
      props.push({ kind: 'torch', x: c.x, y: c.y, rot: 0, scale: 1, roomId: r.id });
    }

    // Sparse debris, denser in shallow rooms; halls stay mostly open. Built.
    const debrisTarget = Math.round(cells.length * 0.02 * decorDensity * (1.3 - r.difficulty));
    for (let k = 0; k < debrisTarget; k++) {
      const c = cells[rng.int(0, cells.length - 1)];
      if (blocked(c.x, c.y)) continue;
      occupied.add(gi(c.x, c.y, W));
      props.push({
        kind: rng.pick(debrisKinds), x: c.x, y: c.y,
        rot: rng.pick([0, 90, 180, 270]) as 0 | 90 | 180 | 270,
        scale: rng.float(0.7, 1.1), roomId: r.id,
      });
    }
  }

  // ── (b) Evidence props — re-based to cropped cells, carrying eventRef ───────
  for (const ep of history.evidenceProps) {
    const cell = remapCell(ep.cell, cropped, W);
    if (cell < 0) continue; // outside the used extent (defensive)
    if (grid[cell] !== CellKind.Floor) continue; // fell on a walled-off cell
    if (occupied.has(cell) || doorSet.has(cell)) continue;
    occupied.add(cell);
    props.push({
      kind: ep.kind, x: cell % W, y: (cell / W) | 0,
      rot: 0, scale: 1, roomId: ep.roomId, eventRef: ep.eventRef,
    });
  }

  // ── (c) Spawns — ONLY from occupations ─────────────────────────────────────
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  for (const occ of history.occupations) {
    const band = actorBand(occ.actorKey, crTable.length);
    for (const rid of occ.roomIds) {
      const r = roomById.get(rid);
      if (!r) continue;
      const cells = roomCells(r);
      if (!cells.length) continue;

      if (rid === bossId) {
        // The boss room gets EXACTLY ONE spawn total — the apex boss-tier spawn.
        // A non-apex occupation (den/bloom) whose cluster happens to include the
        // boss room must NOT stack its count-formula spawns on top; skip the boss
        // room in every non-apex path (the apex seats it below, and the deep-
        // cutoff guarantee at the end covers the "no apex applied" case).
        if (occ.isApex) {
          const c = pickFree(cells, rng, blocked);
          if (c) {
            occupied.add(gi(c.x, c.y, W));
            const tier = crTable[crTable.length - 1];
            spawns.push({ x: c.x, y: c.y, cr: tier.cr, xp: tier.xp, monsterKey: tier.monsterId, roomId: rid, eventRef: occ.eventRef });
          }
        }
        continue;
      }

      // Budget-driven fill. The room's 5e adjusted-XP budget (party of 4 at
      // partyLevel, interpolated by room difficulty) caps the encounter: keep
      // adding band-tier monsters (with an occasional band-1 for variety) while
      // the running MULTIPLIER-ADJUSTED total stays under budget × 1.2. Always
      // seat at least one — a small shallow room may already top its budget with
      // one monster, but an occupied combat room must still fight.
      const budget = roomBudget(partyLevel, r.difficulty);
      const bandIx = Math.min(crTable.length - 1, band);
      const lowerIx = Math.max(0, bandIx - 1);
      const roomSpawns: { c: Cell; tier: (typeof crTable)[number] }[] = [];
      let rawXp = 0;
      // Cap iterations by available free cells; pickFree returns null when full.
      for (let guard = 0; guard < cells.length; guard++) {
        const c = pickFree(cells, rng, blocked);
        if (!c) break;
        // Mostly band tier; a seeded ~1-in-4 draw dips to the adjacent band-1
        // tier for roster variety. First spawn is always band tier so the room's
        // theme reads clearly.
        const useLower = roomSpawns.length > 0 && lowerIx !== bandIx && rng.chance(0.25);
        const tier = crTable[useLower ? lowerIx : bandIx];
        const nextRaw = rawXp + tier.xp;
        const nextAdjusted = nextRaw * encounterMultiplier(roomSpawns.length + 1);
        // Stop before exceeding budget × 1.2 — but never leave the room empty.
        if (roomSpawns.length >= 1 && nextAdjusted > budget * 1.2) break;
        occupied.add(gi(c.x, c.y, W));
        roomSpawns.push({ c, tier });
        rawXp = nextRaw;
      }
      for (const s of roomSpawns) {
        spawns.push({ x: s.c.x, y: s.c.y, cr: s.tier.cr, xp: s.tier.xp, monsterKey: s.tier.monsterId, roomId: rid, eventRef: occ.eventRef });
      }
    }
  }
  // Guarantee at least one spawn in the boss room even if the apex occupation did
  // not list it (deep-cutoff replay): the boss tile is the climax and must fight.
  if (!spawns.some((s) => s.roomId === bossId)) {
    const boss = roomById.get(bossId);
    if (boss) {
      const c = pickFree(roomCells(boss), rng, blocked);
      if (c) {
        occupied.add(gi(c.x, c.y, W));
        const tier = crTable[crTable.length - 1];
        spawns.push({ x: c.x, y: c.y, cr: tier.cr, xp: tier.xp, monsterKey: tier.monsterId, roomId: bossId });
      }
    }
  }

  // ── (d) Traps — event-touched rooms (decay, eventRef'd) or treasury/chapel
  //        (builder defense, eventRef-free) ───────────────────────────────────
  // Map room → the (first) hazardous event that touched it.
  const hazardByRoom = new Map<number, number>();
  for (const ev of history.events) {
    if (ev.kind !== 'flood' && ev.kind !== 'collapse' && ev.kind !== 'fire') continue;
    for (const rid of ev.roomIds) if (!hazardByRoom.has(rid)) hazardByRoom.set(rid, ev.id);
  }
  for (const r of rooms) {
    if (r.type === 'entrance' || r.type === 'boss') continue;
    const cells = roomCells(r);
    if (!cells.length) continue;
    const builderTrap = r.purpose === 'treasury' || r.purpose === 'chapel';
    const hazardRef = hazardByRoom.get(r.id);
    if (!builderTrap && hazardRef === undefined) continue;
    if (!rng.chance(0.5)) continue; // not every eligible room is trapped
    const c = pickFree(cells, rng, blocked);
    if (!c) continue;
    occupied.add(gi(c.x, c.y, W));
    const trap: DungeonTrap = {
      x: c.x, y: c.y, kind: rng.pick(['pit', 'darts', 'snare'] as const), roomId: r.id,
    };
    if (hazardRef !== undefined) trap.eventRef = hazardRef;
    traps.push(trap);
  }

  return { props, spawns, traps };
}

/** First unblocked cell in a room-relative random walk, or null. */
function pickFree(cells: Cell[], rng: Rng, blocked: (x: number, y: number) => boolean): Cell | null {
  if (!cells.length) return null;
  const start = rng.int(0, cells.length - 1);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[(start + i) % cells.length];
    if (!blocked(c.x, c.y)) return c;
  }
  return null;
}

/** Map an occupation's actor family to a CR-band index (0 = weakest tier). */
function actorBand(actorKey: string, tiers: number): number {
  // Undead/faction hold the mid band; dens/broods sit a notch lower; the apex is
  // handled separately (top tier). Bounded to [1, tiers-2] so non-apex spawns
  // never accidentally hit the boss tier.
  const k = actorKey;
  let band = 2;
  if (k.includes('dead') || k.includes('cult') || k.includes('guild') || k.includes('reavers') || k.includes('smugglers')) band = 3;
  else if (k.includes('pack') || k.includes('brood') || k.includes('nest') || k.includes('ring')) band = 2;
  return Math.max(1, Math.min(tiers - 2, band));
}

/**
 * Place `target` items of `kind` inside room `r` by layout family:
 *  - center : one item at the room center (mask-checked).
 *  - walls  : items on wall-adjacent floor cells, evenly strided.
 *  - rows   : items on a coarse interior grid (Watabou colonnade feel).
 *  - scatter: items on random free interior cells.
 * All placements respect the `blocked` guard; no eventRef (built furniture).
 */
function placeByLayout(
  r: Room,
  cells: Cell[],
  kind: string,
  layout: 'rows' | 'walls' | 'center' | 'scatter',
  target: number,
  W: number,
  grid: Uint8Array,
  roomOf: Int16Array,
  nearWall: (x: number, y: number) => boolean,
  blocked: (x: number, y: number) => boolean,
  occupied: Set<number>,
  props: DungeonProp[],
): void {
  const push = (x: number, y: number): boolean => {
    if (blocked(x, y)) return false;
    occupied.add(gi(x, y, W));
    props.push({ kind, x, y, rot: 0, scale: 1, roomId: r.id });
    return true;
  };

  if (layout === 'center') {
    const cx = roomCx(r);
    const cy = roomCy(r);
    if (roomOf[gi(cx, cy, W)] === r.id && push(cx, cy)) return;
    // Center fell on a mask hole / doorway — fall back to any free cell.
    for (const c of cells) if (push(c.x, c.y)) return;
    return;
  }

  if (layout === 'walls') {
    const wallCells = cells.filter((c) => nearWall(c.x, c.y));
    let placed = 0;
    const stride = Math.max(1, Math.floor(wallCells.length / Math.max(1, target)));
    for (let i = 0; i < wallCells.length && placed < target; i += stride) {
      const c = wallCells[i];
      if (push(c.x, c.y)) placed++;
    }
    return;
  }

  if (layout === 'rows') {
    // Coarse interior grid, inset one cell from the box edge.
    let placed = 0;
    for (let y = r.y0 + 1; y <= r.y0 + r.h - 2 && placed < target; y += 2) {
      for (let x = r.x0 + 1; x <= r.x0 + r.w - 2 && placed < target; x += 2) {
        if (roomOf[gi(x, y, W)] !== r.id) continue;
        if (push(x, y)) placed++;
      }
    }
    return;
  }

  // scatter — deterministic walk over the room's cells at a fixed stride.
  let placed = 0;
  const stride = Math.max(1, Math.floor(cells.length / Math.max(1, target)));
  for (let i = 0; i < cells.length && placed < target; i += stride) {
    const c = cells[i];
    if (push(c.x, c.y)) placed++;
  }
}

// ─── Doors ───────────────────────────────────────────────────────────────────

/**
 * Build the door records. Every doorway cell becomes a `DungeonDoor` whose state
 * comes from the simulated `doorStates` (default 'open'). Bricked doors are Wall
 * cells — `findDoorways` (which only lists corridor cells) no longer sees them,
 * so we RECONSTRUCT any stateful door (bricked/secret) directly from the door-
 * state map, re-based to cropped coordinates, and merge it in. This keeps the
 * bricked/secret door records alive after the crop dropped their corridor cell.
 *
 * `secretDoorCells` is DERIVED (single source, no duplicated logic) from the
 * `doors[]` entries whose state is 'secret' — the hidden-until-searched doors the
 * masons left behind when they bricked off the back way. Secret doors sit on a
 * room-interior FLOOR cell (brick-off never writes the grid at the secret cell,
 * only at the bricked `mid`), so every secret cell is a passable Floor cell the
 * drawer renders as a searchable hidden door. Empty when no brick-off rolled its
 * 0.5 secret-door chance.
 */
function buildDoors(
  doorways: Cell[],
  W: number,
  doorStates: Map<number, { state: DoorState; eventRef: number }>,
  cropped: Cropped,
): { doors: DungeonDoor[]; secretDoorCells: Cell[] } {
  // Working-grid door-state cells → cropped cells with their state.
  const stateByCropped = new Map<number, { state: DoorState; eventRef: number }>();
  for (const [cell, s] of doorStates) {
    const rc = remapCell(cell, cropped, W);
    if (rc >= 0) stateByCropped.set(rc, s);
  }

  const doors: DungeonDoor[] = [];
  const covered = new Set<number>();
  for (const d of doorways) {
    const key = gi(d.x, d.y, W);
    const s = stateByCropped.get(key);
    covered.add(key);
    if (s) doors.push({ cell: d, state: s.state, eventRef: s.eventRef });
    else doors.push({ cell: d, state: 'open' });
  }
  // Stateful doors whose cell is NOT a listed doorway (bricked cells became walls
  // and dropped out of findDoorways; a secret cell on a spent tunnel too).
  for (const [cropped, s] of stateByCropped) {
    if (covered.has(cropped)) continue;
    doors.push({ cell: { x: cropped % W, y: (cropped / W) | 0 }, state: s.state, eventRef: s.eventRef });
  }

  // Derived from doors[]: every secret-state door's cell (single source of truth).
  const secretDoorCells: Cell[] = doors
    .filter((d) => d.state === 'secret')
    .map((d) => d.cell)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return { doors, secretDoorCells };
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

function generateOnce(
  path: SeedPath,
  params: DungeonParams,
  world?: WorldIdentity,
): DungeonPlan | null {
  const archetype = params.archetype ?? THEME_ARCHETYPE[params.theme];
  const archetypeData = ARCHETYPES[archetype];

  // Resolve the layout dial (tight ↔ sprawl). Pinned by the caller, else the
  // archetype default ± jitter from the dedicated 'sprawl' stream.
  const sprawl = resolveSprawl(path, params, archetype);

  // 1. Intact builder — now also opens BUILT circulation loops (DEFECT A) via a
  //    dedicated 'circulation' sub-stream so its draws never perturb the build
  //    stream. loopChance is the density control; sprawl is the layout dial.
  const st = buildIntact(
    makeRng(streamPath(path, `build:${archetype}`)),
    archetype,
    params.roomCount,
    params.loopChance,
    makeRng(streamPath(path, 'circulation')),
    sprawl,
  );
  if (!st) return null;

  // 2. Simulate history — MUTATES st.grid/corridor/roomOf/edges to the ruin.
  //    When the world supplies a chronicle (Pillar 2, Task 4), bind matching
  //    events to real world zones; the era jitter draws on a DEDICATED stream so
  //    a chronicled dungeon keeps the same grid/props/spawns as an un-chronicled
  //    one (only bound events' summaries + ages change).
  const history = simulateHistory(
    st, makeRng(streamPath(path, 'history')), archetype, params.theme, params.asOfYearsAgo ?? 0,
    world?.chronicle && world.chronicle.length > 0
      ? { chronicle: world.chronicle, jitter: makeRng(streamPath(path, 'chronicle')) }
      : undefined,
  );

  // 3. Crop the (mutated) working grid + overlay; door/evidence cells re-base by
  //    arithmetic (remapCell), no per-cell Map.
  const cropped = crop(st, history.overlay);
  const { grid, corridor, roomOf, overlay, W, H } = cropped;
  const rooms = st.rooms;
  const edges = st.edges;
  const entranceId = st.entranceId;

  // 4. Semantics: entrance (verify degree 1) + boss (apex deepest) + critical path.
  const { bossId, criticalRoomIds } = assignSemantics(rooms, edges, entranceId, history);

  // 5. Rasterize walls (returns the wall count so no extra tally pass) + the BFS
  //    distance field, with the 100%-reachability guard.
  const wallTiles = rasterizeWalls(grid, W, H);
  const entrance = rooms[entranceId];
  const bfs = distanceField(grid, W, H, roomCx(entrance), roomCy(entrance));
  if (!floodReaches(grid, bfs)) return null;

  // Single W*H pass for doorways, corridor cells, and the floor tally (fused to
  // avoid three separate O(W*H) scans over the large mausoleum grid).
  const doorways: Cell[] = [];
  const corridorCells: Cell[] = [];
  let floorTiles = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = gi(x, y, W);
      if (grid[i] === CellKind.Floor) floorTiles++;
      if (roomOf[i] !== -2) continue;
      corridorCells.push({ x, y });
      // Doorway = corridor cell 4-adjacent to a room-floor cell.
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (roomOf[gi(nx, ny, W)] >= 0) { doorways.push({ x, y }); break; }
      }
    }
  }
  const doorSet = new Set(doorways.map((d) => gi(d.x, d.y, W)));

  // 6. Furnish + stamp.
  const { props, spawns, traps } = furnishAndStamp(
    makeRng(streamPath(path, 'furnish')),
    rooms, grid, roomOf, W, H, doorSet, overlay, history, cropped,
    params.theme, bossId, params.decorDensity, params.partyLevel, params.biomeName,
  );

  // Doors (built + stateful).
  const { doors, secretDoorCells } = buildDoors(doorways, W, doorStatesToMap(history), cropped);

  // 7. Derive lore.
  const lore = deriveLore(makeRng(streamPath(path, 'lore')), archetypeData, history.events, rooms, world);

  const loops = edges.filter((e) => e.isLoop).length;

  // Feet-at-the-plan-boundary: convert every entity coordinate to plot-local
  // feet exactly ONCE, here. Room notes come from lore; entrance keeps its
  // builder purpose.
  const outRooms: DungeonRoom[] = rooms.map((r) => {
    const out: DungeonRoom = {
      id: r.id, x: r.x0 * CELL_FT, y: r.y0 * CELL_FT, w: r.w * CELL_FT, h: r.h * CELL_FT, shape: r.shape,
      type: r.type, depth: r.depth, difficulty: r.difficulty, degree: r.degree, area: r.area,
      purpose: r.purpose,
    };
    const note = lore.notes.get(r.id);
    if (note !== undefined) out.note = note;
    return out;
  });
  const ftProps = props.map((p) => ({ ...p, x: p.x * CELL_FT, y: p.y * CELL_FT }));
  const ftSpawns = spawns.map((s) => ({ ...s, x: s.x * CELL_FT, y: s.y * CELL_FT }));
  const ftTraps = traps.map((t) => ({ ...t, x: t.x * CELL_FT, y: t.y * CELL_FT }));

  return {
    params,
    seed: 0, // filled by caller
    name: lore.name,
    W, H, cellFt: CELL_FT, widthFt: W * CELL_FT, depthFt: H * CELL_FT,
    grid, corridor, bfs,
    rooms: outRooms, edges,
    doorways, secretDoorCells, corridorCells, props: ftProps, spawns: ftSpawns, traps: ftTraps,
    entranceId, bossId, criticalRoomIds,
    archetype,
    builderName: lore.builderName,
    blurb: lore.blurb,
    history: history.events,
    rumorHooks: lore.rumorHooks,
    overlay,
    doors,
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
      events: history.events.length,
      sprawl,
    },
  };
}

/** Narrow the HistoryResult door-state map (already the right shape). */
function doorStatesToMap(history: HistoryResult): Map<number, { state: DoorState; eventRef: number }> {
  return history.doorStates;
}

/**
 * Generate a full dungeon plan. Deterministic in `input.seed` + params; re-rolls
 * internally (max 5 derived attempts) if the builder places too few rooms or the
 * assembled layout fails the 100% connectivity check, and throws honestly if none
 * succeed (Aralia no-fallback directive).
 */
export function generateDungeon(input: DungeonInput): DungeonPlan {
  const params: DungeonParams = { ...DEFAULT_PARAMS, ...input.params };
  // Bake the resolved archetype into params so callers/consumers read a concrete
  // builder (the design preview and stats surface it).
  params.archetype = params.archetype ?? THEME_ARCHETYPE[params.theme];
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // A world-grown site seeds the dungeon from its own frozen sitePath
  // (input.basePath); the standalone preview keeps the historic wf:<seed> base.
  const base = input.basePath ?? rootSeedPath(input.seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const path = attempt === 0 ? childSeedPath(base, 'dungeon') : childSeedPath(base, `dungeon:retry:${attempt}`);
    const plan = generateOnce(path, params, input.world);
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
