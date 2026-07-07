/**
 * @file program.ts — assign a purpose to every room on a floor.
 *
 * Task 4 of the Building Blueprint Pipeline. Detects corridors (a room whose
 * cells form a straight 1-cell-wide run of length >= 3), marks the largest
 * non-corridor room as the main room with the building type's headline
 * purpose, then fills the remaining rooms from a per-type program: required
 * slots, optional slots decided by the RNG, then a filler purpose. Slots
 * with a placement preference are adjacency-aware — the kitchen prefers a
 * room sharing a wall with the main room (or a main-touching corridor),
 * and pantry/cellar prefer a room touching the kitchen; other slots go
 * largest-room-first. Storage is capped at 1 per building — no plan is
 * half storeroom.
 *
 * Deterministic: all randomness derives from the 'program' stream of the
 * given seed path. Pure data — no three.js, no rendering concerns.
 */
import type { BuildingType, RoomPurpose, Cell, BlueprintRoom } from './blueprintTypes';
import type { BedroomAssignment } from './briefProgram';
import type { TradeRoomDemand } from './tradeRooms';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';

const CELL_FT = 5;

/** The main-room purpose per building type — the headline the largest room
 *  gets. Exported so briefProgram can drop a trade demand the headline already
 *  satisfies (e.g. a smithy's forge). */
export const HEADLINE: Record<BuildingType, RoomPurpose> = {
  cottage: 'hall',
  tavern: 'common-room',
  manor: 'great-hall',
  shop: 'shopfront',
  workshop: 'workshop',
  townhouse: 'hall',
  tenement: 'hall',
  farmstead: 'hall',
  smithy: 'forge',
  inn: 'common-room',
  storehouse: 'storage',
  temple: 'nave',
  keep: 'great-hall',
  civic: 'hall',
};

/** One slot in a room program: min required, max allowed. */
export interface ProgramSlot { purpose: RoomPurpose; min: number; max: number; }

/** Optional household-brief inputs for {@link assignPurposes}. Every field is
 *  optional; passing none (or `{}`) reproduces the v1 program byte-for-byte. */
export interface AssignOptions {
  /** Extra slots appended AFTER the type program's slots. MUST arrive
   *  min === max (Task 6 guarantees this) so no extra 'program'-stream draws
   *  happen and optless calls stay byte-stable. */
  extraSlots?: ProgramSlot[];
  /** Trade-room placement constraints (street-facing / adjacency). */
  tradeDemands?: TradeRoomDemand[];
  /** Bedrooms to hand out ON THIS FLOOR. MUTATED: consumed entries are
   *  removed so a caller can thread one queue across floors. */
  bedroomQueue?: BedroomAssignment[];
}

/** Ordered slots (bigger rooms are assigned first), then a filler purpose. */
interface RoomProgram { slots: ProgramSlot[]; filler: RoomPurpose; }

const PROGRAMS: Record<BuildingType, RoomProgram> = {
  cottage: {
    slots: [
      { purpose: 'kitchen', min: 1, max: 1 },
      { purpose: 'bedroom', min: 1, max: 2 },
      { purpose: 'pantry', min: 0, max: 1 },
      { purpose: 'storage', min: 0, max: 1 },
    ],
    filler: 'bedroom',
  },
  tavern: {
    slots: [
      { purpose: 'kitchen', min: 1, max: 1 },
      { purpose: 'cellar', min: 0, max: 1 },
      { purpose: 'storage', min: 0, max: 1 },
    ],
    filler: 'guest-room',
  },
  manor: {
    slots: [
      { purpose: 'kitchen', min: 1, max: 1 },
      { purpose: 'solar', min: 1, max: 1 },
      { purpose: 'study', min: 0, max: 1 },
      { purpose: 'guard-room', min: 0, max: 1 },
      { purpose: 'storage', min: 0, max: 1 },
    ],
    filler: 'bedroom',
  },
  shop: {
    slots: [
      { purpose: 'workshop', min: 1, max: 1 },
      { purpose: 'storage', min: 0, max: 1 },
      { purpose: 'kitchen', min: 0, max: 1 },
    ],
    filler: 'bedroom',
  },
  workshop: {
    slots: [
      { purpose: 'storage', min: 0, max: 1 },
      { purpose: 'private-room', min: 1, max: 1 },
    ],
    filler: 'workshop',
  },
  townhouse: {
    slots: [
      { purpose: 'kitchen', min: 1, max: 1 },
      { purpose: 'bedroom', min: 1, max: 2 },
      { purpose: 'pantry', min: 0, max: 1 },
    ],
    filler: 'bedroom',
  },
  tenement: {
    slots: [
      { purpose: 'kitchen', min: 1, max: 1 },
    ],
    filler: 'private-room',
  },
  farmstead: {
    slots: [
      { purpose: 'kitchen', min: 1, max: 1 },
      { purpose: 'bedroom', min: 1, max: 2 },
      { purpose: 'pantry', min: 1, max: 1 },
      { purpose: 'storage', min: 0, max: 1 },
    ],
    filler: 'bedroom',
  },
  smithy: {
    slots: [
      { purpose: 'workshop', min: 1, max: 1 },
      { purpose: 'storage', min: 0, max: 1 },
      { purpose: 'bedroom', min: 0, max: 1 },
    ],
    filler: 'storage',
  },
  inn: {
    slots: [
      { purpose: 'kitchen', min: 1, max: 1 },
      { purpose: 'cellar', min: 0, max: 1 },
      { purpose: 'storage', min: 0, max: 1 },
    ],
    filler: 'guest-room',
  },
  storehouse: {
    slots: [
      { purpose: 'stockroom', min: 1, max: 1 },
    ],
    filler: 'storage',
  },
  temple: {
    slots: [
      { purpose: 'sanctuary', min: 1, max: 1 },
      { purpose: 'vestry', min: 1, max: 1 },
      { purpose: 'private-room', min: 0, max: 1 },
    ],
    filler: 'private-room',
  },
  keep: {
    slots: [
      { purpose: 'guard-room', min: 1, max: 1 },
      { purpose: 'armory', min: 1, max: 1 },
      { purpose: 'kitchen', min: 1, max: 1 },
      { purpose: 'solar', min: 0, max: 1 },
    ],
    filler: 'bedroom',
  },
  civic: {
    slots: [
      { purpose: 'study', min: 1, max: 1 },
      { purpose: 'storage', min: 0, max: 1 },
    ],
    filler: 'private-room',
  },
};

/** True when the cells form a straight 1-cell-wide run of length >= 3. */
function isCorridorShape(cells: Cell[]): boolean {
  if (cells.length < 3) return false;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.cx); maxX = Math.max(maxX, c.cx);
    minY = Math.min(minY, c.cy); maxY = Math.max(maxY, c.cy);
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w !== 1 && h !== 1) return false;
  const len = Math.max(w, h);
  return len >= 3 && cells.length === w * h; // straight, gapless run
}

function bboxFeet(cells: Cell[]): BlueprintRoom['bbox'] {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.cx); maxX = Math.max(maxX, c.cx);
    minY = Math.min(minY, c.cy); maxY = Math.max(maxY, c.cy);
  }
  return {
    x: minX * CELL_FT,
    y: minY * CELL_FT,
    w: (maxX - minX + 1) * CELL_FT,
    d: (maxY - minY + 1) * CELL_FT,
  };
}

/** Shared-edge counts between room ids: adj.get(a).get(b) = number of
 *  orthogonal cell pairs on the a|b boundary. Built once from rg; RNG-free. */
function buildAdjacency(rg: number[][]): Map<number, Map<number, number>> {
  const adj = new Map<number, Map<number, number>>();
  const bump = (a: number, b: number) => {
    let row = adj.get(a);
    if (!row) { row = new Map(); adj.set(a, row); }
    row.set(b, (row.get(b) ?? 0) + 1);
  };
  for (let y = 0; y < rg.length; y++) {
    for (let x = 0; x < rg[y].length; x++) {
      const id = rg[y][x];
      if (id < 0) continue;
      const right = x + 1 < rg[y].length ? rg[y][x + 1] : -1;
      const down = y + 1 < rg.length ? rg[y + 1][x] : -1;
      if (right >= 0 && right !== id) { bump(id, right); bump(right, id); }
      if (down >= 0 && down !== id) { bump(id, down); bump(down, id); }
    }
  }
  return adj;
}

/** The room cell closest to the room's centroid (ties: row-major first —
 *  cells arrive in row-major order and strict `<` keeps the first winner).
 *  Guaranteed to be a member of `cells`, unlike a bbox center. RNG-free. */
function anchorCell(cells: Cell[]): Cell {
  let sx = 0, sy = 0;
  for (const c of cells) { sx += c.cx; sy += c.cy; }
  const mx = sx / cells.length;
  const my = sy / cells.length;
  let best = cells[0];
  let bestD = Infinity;
  for (const c of cells) {
    const d = (c.cx - mx) * (c.cx - mx) + (c.cy - my) * (c.cy - my);
    if (d < bestD) { bestD = d; best = c; }
  }
  return { cx: best.cx, cy: best.cy };
}

/** Room ids, cells-by-id, corridor set and main room — the geometry analysis
 *  both {@link assignPurposes} and {@link assignUpperPurposes} share. RNG-free:
 *  the room grid alone determines every field. */
interface FloorRooms {
  ids: number[];
  cellsById: Map<number, Cell[]>;
  corridor: Set<number>;
  mainId: number;
}

/** Collect cells per room id, detect corridors and pick the main room. */
function analyzeFloor(path: SeedPath, rg: number[][]): FloorRooms {
  // Collect cells per room id (row-major, so cell order is deterministic).
  const cellsById = new Map<number, Cell[]>();
  for (let y = 0; y < rg.length; y++) {
    for (let x = 0; x < rg[y].length; x++) {
      const id = rg[y][x];
      if (id < 0) continue;
      let cells = cellsById.get(id);
      if (!cells) { cells = []; cellsById.set(id, cells); }
      cells.push({ cx: x, cy: y });
    }
  }
  if (cellsById.size === 0) {
    throw new Error(`program: empty room grid at ${path}`);
  }

  const ids = [...cellsById.keys()].sort((a, b) => a - b);
  const bySize = (a: number, b: number) =>
    (cellsById.get(b) as Cell[]).length - (cellsById.get(a) as Cell[]).length || a - b;
  const corridor = new Set<number>();
  for (const id of ids) {
    if (isCorridorShape(cellsById.get(id) as Cell[])) corridor.add(id);
  }
  // A floor must keep at least one real room; if everything reads as a
  // corridor (degenerate skinny footprint), the largest run is the room.
  if (corridor.size === ids.length) {
    corridor.delete([...ids].sort(bySize)[0]);
  }
  // Main room: largest non-corridor (ties broken by lowest id).
  const mainId = ids.filter((id) => !corridor.has(id)).sort(bySize)[0];
  return { ids, cellsById, corridor, mainId };
}

/** Ids of rooms that own a street-facing outer edge: a cell on the min-y
 *  boundary of its column whose north neighbor is outside. RNG-free. */
function streetRoomsOf(rg: number[][]): Set<number> {
  const cols = rg.reduce((m, row) => Math.max(m, row.length), 0);
  const minCyOfColumn = (cx: number): number => {
    for (let cy = 0; cy < rg.length; cy++) if ((rg[cy]?.[cx] ?? -1) >= 0) return cy;
    return Infinity;
  };
  const street = new Set<number>();
  for (let cx = 0; cx < cols; cx++) {
    const minCy = minCyOfColumn(cx);
    if (!Number.isFinite(minCy)) continue;
    const id = rg[minCy]?.[cx] ?? -1;
    // North neighbor of the top occupied cell is outside by construction.
    if (id >= 0 && (rg[minCy - 1]?.[cx] ?? -1) < 0) street.add(id);
  }
  return street;
}

/** Materialize a BlueprintRoom for one id from the shared floor analysis. */
function buildRoom(
  id: number,
  purpose: RoomPurpose,
  cells: Cell[],
  isMain: boolean,
  isCorridor: boolean,
  forSlot?: string,
): BlueprintRoom {
  const room: BlueprintRoom = {
    id,
    purpose,
    cells,
    area: cells.length,
    anchor: anchorCell(cells),
    bbox: bboxFeet(cells),
    isMain,
    isCorridor,
  };
  if (forSlot !== undefined) room.forSlot = forSlot;
  return room;
}

/**
 * Assign purposes to the rooms of a partitioned floor.
 *
 * @param path room-id grid from partition(): rg[y][x], -1 outside, ids
 *   compact from 0.
 * @param opts optional household-brief inputs (extra slots, trade demands,
 *   bedroom queue). Omitted or `{}` reproduces the v1 program byte-for-byte.
 * @returns one BlueprintRoom per id, ordered by id.
 */
export function assignPurposes(
  path: SeedPath,
  type: BuildingType,
  rg: number[][],
  opts?: AssignOptions,
): BlueprintRoom[] {
  const rng = rngFromPath(streamPath(path, 'program'));

  const { ids, cellsById, corridor } = analyzeFloor(path, rg);
  const cellsOf = (id: number) => cellsById.get(id) as Cell[];
  const bySize = (a: number, b: number) =>
    cellsOf(b).length - cellsOf(a).length || a - b;

  // Street ownership (RNG-free): rooms with a min-y outer edge front the road.
  const streetRooms = streetRoomsOf(rg);
  // Trade-room placement constraints, keyed by demanded purpose.
  const tradeByPurpose = new Map<RoomPurpose, TradeRoomDemand>();
  for (const d of opts?.tradeDemands ?? []) tradeByPurpose.set(d.purpose, d);

  // Main room: normally the largest non-corridor (size order). But when a
  // street-facing trade demand targets the HEADLINE purpose (e.g. a smithy's
  // forge), the headline IS the main room, so bias main selection to the
  // largest STREET-FACING candidate — an honest constraint, relaxed to size
  // order when no candidate fronts the street.
  const headlineDemand = tradeByPurpose.get(HEADLINE[type]);
  const nonCorridor = ids.filter((id) => !corridor.has(id)).sort(bySize);
  const mainId =
    headlineDemand?.streetFacing
      ? nonCorridor.find((id) => streetRooms.has(id)) ?? nonCorridor[0]
      : nonCorridor[0];

  // Build the purpose queue for the remaining rooms: required slots first,
  // RNG-decided optional extras, then filler. One rng draw per slot keeps
  // the stream consumption independent of room count.
  const program = PROGRAMS[type];
  const queue: RoomPurpose[] = [];
  for (const slot of program.slots) {
    const extra = slot.max > slot.min ? rng.nextInt(0, slot.max - slot.min + 1) : 0;
    for (let i = 0; i < slot.min + extra; i++) queue.push(slot.purpose);
  }
  // Brief extras append AFTER the type program. INVARIANT: every extra slot
  // arrives min === max (Task 6 emits only fixed slots), so no rng.nextInt
  // fires here — the 'program' stream stays byte-identical to the optless
  // path. A max > min extra would silently shift every downstream draw.
  const extraSlots = opts?.extraSlots ?? [];
  for (const slot of extraSlots) {
    if (slot.max !== slot.min) {
      throw new Error(
        `program: extra slot '${slot.purpose}' must be min===max (got ${slot.min}..${slot.max})`,
      );
    }
    for (let i = 0; i < slot.min; i++) queue.push(slot.purpose);
  }

  // Hand purposes to the remaining rooms. Base order is largest first, so
  // important program rooms (kitchen before pantry) land in the roomier
  // spaces — but kitchen prefers a room touching the main room (or, second
  // choice, a corridor that touches main), and pantry/cellar prefer a room
  // touching the kitchen. Selection is pure deterministic scoring over the
  // size-sorted list: no RNG draws, so the 'program' stream consumption is
  // unchanged. When no adjacent room is free we relax to the size-order
  // pick — a legitimate constraint relaxation, not a silent fallback.
  const rest = ids
    .filter((id) => id !== mainId && !corridor.has(id))
    .sort(bySize);
  const adj = buildAdjacency(rg);
  const sharedEdges = (a: number, b: number): number => adj.get(a)?.get(b) ?? 0;
  // Corridors that touch the main room: a kitchen off one of these still
  // "serves" the hall through the corridor (second-choice placement).
  const mainCorridors = [...corridor].filter((c) => sharedEdges(c, mainId) > 0);

  const unassigned = new Set(rest);
  /** Best unassigned room by score tier; ties resolve to the earliest entry
   *  in `rest` (largest room, then lowest id) via strict `>`. Score 0 for
   *  everything degrades to exactly the old size-order pick. */
  const pickBest = (score: (id: number) => number): number => {
    let best = -1;
    let bestScore = -1;
    for (const id of rest) {
      if (!unassigned.has(id)) continue;
      const s = score(id);
      if (s > bestScore) { bestScore = s; best = id; }
    }
    return best;
  };
  /** Kitchen placement score. Adjacency to main dominates; when a pantry or
   *  cellar is waiting in the program, a kitchen spot that still has a free
   *  neighbor for it outranks one boxed in by main/corridors/outside. */
  const kitchenScore = (id: number, wantsNeighbor: boolean): number => {
    const base =
      sharedEdges(id, mainId) > 0 ? 2 // shares a wall with main
      : mainCorridors.some((c) => sharedEdges(id, c) > 0) ? 1 // via corridor
      : 0;
    const neighborBonus =
      wantsNeighbor &&
      rest.some((r) => r !== id && unassigned.has(r) && sharedEdges(id, r) > 0)
        ? 1 : 0;
    return base * 2 + neighborBonus;
  };

  // Assignment order: pantry/cellar move directly after the kitchen so
  // earlier plain slots (bedrooms) don't use up the kitchen-adjacent rooms
  // before the pantry gets its pick. Stable otherwise.
  const pantryLike = queue.filter((p) => p === 'pantry' || p === 'cellar');
  const others = queue.filter((p) => p !== 'pantry' && p !== 'cellar');
  const order: RoomPurpose[] = [];
  for (const p of others) {
    order.push(p);
    if (p === 'kitchen') { order.push(...pantryLike); pantryLike.length = 0; }
  }
  order.push(...pantryLike); // no kitchen in the queue: keep original spot

  const purposeById = new Map<number, RoomPurpose>();
  const forSlotById = new Map<number, string>();
  let storageCount = 0;
  let kitchenId = -1;
  // Already-placed room per purpose, for a demand's `adjacentTo` scoring.
  const placedByPurpose = new Map<RoomPurpose, number>();
  // Bedroom tags to hand out in order (mutated: consumed entries removed).
  const bedroomQueue = opts?.bedroomQueue;
  /** Trade-demand bonus: +4 street when demanded street-facing, +1 per shared
   *  edge with the already-placed `adjacentTo` room. Dominates kitchen scores.*/
  const tradeScore = (id: number, purpose: RoomPurpose): number => {
    const demand = tradeByPurpose.get(purpose);
    if (!demand) return 0;
    let s = 0;
    if (demand.streetFacing && streetRooms.has(id)) s += 4;
    if (demand.adjacentTo !== undefined) {
      const anchorId = placedByPurpose.get(demand.adjacentTo);
      if (anchorId !== undefined) s += sharedEdges(id, anchorId);
    }
    return s;
  };
  for (const purpose of order) {
    if (unassigned.size === 0) break;
    // Storage hard cap: no plan is half storeroom from its SLOT list. This
    // only guards slot-driven storage; the filler pass below is deliberately
    // exempt, so storehouse/smithy (`filler: 'storage'`) legitimately fill
    // their remaining rooms with storage.
    if (purpose === 'storage' && storageCount >= 1) continue;
    let id: number;
    if (tradeByPurpose.has(purpose)) {
      // Trade rooms lead with their brief constraint; relaxation stays honest
      // (no candidate scores > 0 → size-order pick).
      id = pickBest((r) => tradeScore(r, purpose));
      // A kitchen demanded as a trade room still anchors pantry/cellar.
      if (purpose === 'kitchen') kitchenId = id;
    } else if (purpose === 'kitchen') {
      const wantsNeighbor = order.some((p) => p === 'pantry' || p === 'cellar');
      id = pickBest((r) => kitchenScore(r, wantsNeighbor));
      kitchenId = id;
    } else if ((purpose === 'pantry' || purpose === 'cellar') && kitchenId >= 0) {
      id = pickBest((r) => (sharedEdges(r, kitchenId) > 0 ? 1 : 0));
    } else {
      id = pickBest(() => 0); // plain size order
    }
    if (purpose === 'storage') storageCount++;
    // A briefed bedroom consumes the next queue entry, stamping its tags.
    if (purpose === 'bedroom' && bedroomQueue && bedroomQueue.length > 0) {
      const next = bedroomQueue.shift() as BedroomAssignment;
      forSlotById.set(id, next.slotTags.join(','));
    }
    purposeById.set(id, purpose);
    placedByPurpose.set(purpose, id);
    unassigned.delete(id);
  }
  for (const id of unassigned) purposeById.set(id, program.filler);

  return ids.map((id) => {
    const isMain = id === mainId;
    const isCorridor = corridor.has(id);
    const purpose: RoomPurpose = isMain
      ? HEADLINE[type]
      : isCorridor
        ? 'corridor'
        : (purposeById.get(id) as RoomPurpose);
    return buildRoom(id, purpose, cellsOf(id), isMain, isCorridor, forSlotById.get(id));
  });
}

/**
 * Assign purposes for a NON-ground floor (upper storey or basement).
 *
 * With an EMPTY `bedroomQueue` this reproduces the v1 `repurpose()` rule
 * exactly (upper: main/`id%3!==2` → bedroom, else guest-room; basement:
 * `id%2` cellar/storage; corridors stay corridors) so the briefless golden
 * never shifts. With a non-empty queue the largest rooms first each take one
 * queue entry (purpose 'bedroom', `forSlot` stamped); leftovers fall back to
 * the empty-queue rule. The queue is MUTATED — consumed entries are removed
 * so one queue can be threaded across floors.
 *
 * @param level floor level (> 0 upper, < 0 basement; never 0).
 * @param bedroomQueue tagged bedrooms to place here (consumed in place).
 */
export function assignUpperPurposes(
  path: SeedPath,
  _type: BuildingType,
  rg: number[][],
  level: number,
  bedroomQueue: BedroomAssignment[],
): BlueprintRoom[] {
  const { ids, cellsById, corridor, mainId } = analyzeFloor(path, rg);
  const cellsOf = (id: number) => cellsById.get(id) as Cell[];

  // v1 repurpose rule for a single non-corridor room.
  const fillerPurpose = (id: number, isMain: boolean): RoomPurpose =>
    level < 0
      ? id % 2 === 0 ? 'cellar' : 'storage'
      : isMain || id % 3 !== 2 ? 'bedroom' : 'guest-room';

  // Briefed bedrooms take the largest rooms first (ties: lowest id), one each.
  const forSlotById = new Map<number, string>();
  if (bedroomQueue.length > 0) {
    const bySize = (a: number, b: number) =>
      cellsOf(b).length - cellsOf(a).length || a - b;
    const candidates = ids.filter((id) => !corridor.has(id)).sort(bySize);
    for (const id of candidates) {
      if (bedroomQueue.length === 0) break;
      const next = bedroomQueue.shift() as BedroomAssignment;
      forSlotById.set(id, next.slotTags.join(','));
    }
  }

  return ids.map((id) => {
    const isMain = id === mainId;
    const isCorridor = corridor.has(id);
    const tagged = forSlotById.get(id);
    const purpose: RoomPurpose = isCorridor
      ? 'corridor'
      : tagged !== undefined
        ? 'bedroom'
        : fillerPurpose(id, isMain);
    return buildRoom(id, purpose, cellsOf(id), isMain, isCorridor, tagged);
  });
}
