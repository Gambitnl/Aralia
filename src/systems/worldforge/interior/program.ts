/**
 * @file program.ts — assign a purpose to every room on a floor.
 *
 * Task 4 of the Building Blueprint Pipeline. Detects corridors (a room whose
 * cells form a straight 1-cell-wide run of length >= 3), marks the largest
 * non-corridor room as the main room with the building type's headline
 * purpose, then hands the remaining rooms (largest first) purposes drawn
 * from a per-type program: required slots, optional slots decided by the
 * RNG, then a filler purpose. Storage is capped at 1 per building — no
 * plan is half storeroom.
 *
 * Deterministic: all randomness derives from the 'program' stream of the
 * given seed path. Pure data — no three.js, no rendering concerns.
 */
import type { BuildingType, RoomPurpose, Cell, BlueprintRoom } from './blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';

const CELL_FT = 5;

const HEADLINE: Record<BuildingType, RoomPurpose> = {
  cottage: 'hall',
  tavern: 'common-room',
  manor: 'great-hall',
  shop: 'shopfront',
  workshop: 'workshop',
};

/** One slot in a room program: min required, max allowed. */
interface ProgramSlot { purpose: RoomPurpose; min: number; max: number; }

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

/**
 * Assign purposes to the rooms of a partitioned floor.
 *
 * @param path room-id grid from partition(): rg[y][x], -1 outside, ids
 *   compact from 0.
 * @returns one BlueprintRoom per id, ordered by id.
 */
export function assignPurposes(
  path: SeedPath,
  type: BuildingType,
  rg: number[][],
): BlueprintRoom[] {
  const rng = rngFromPath(streamPath(path, 'program'));

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
  const corridor = new Set<number>();
  for (const id of ids) {
    if (isCorridorShape(cellsById.get(id) as Cell[])) corridor.add(id);
  }
  // A floor must keep at least one real room; if everything reads as a
  // corridor (degenerate skinny footprint), the largest run is the room.
  if (corridor.size === ids.length) {
    const biggest = [...ids].sort(
      (a, b) =>
        (cellsById.get(b) as Cell[]).length - (cellsById.get(a) as Cell[]).length || a - b,
    )[0];
    corridor.delete(biggest);
  }

  // Main room: largest non-corridor (ties broken by lowest id).
  const mainId = ids
    .filter((id) => !corridor.has(id))
    .sort(
      (a, b) =>
        (cellsById.get(b) as Cell[]).length - (cellsById.get(a) as Cell[]).length || a - b,
    )[0];

  // Build the purpose queue for the remaining rooms: required slots first,
  // RNG-decided optional extras, then filler. One rng draw per slot keeps
  // the stream consumption independent of room count.
  const program = PROGRAMS[type];
  const queue: RoomPurpose[] = [];
  for (const slot of program.slots) {
    const extra = slot.max > slot.min ? rng.nextInt(0, slot.max - slot.min + 1) : 0;
    for (let i = 0; i < slot.min + extra; i++) queue.push(slot.purpose);
  }

  // Hand purposes to the remaining rooms, largest first, so important
  // program rooms (kitchen before pantry) land in the roomier spaces.
  const rest = ids
    .filter((id) => id !== mainId && !corridor.has(id))
    .sort(
      (a, b) =>
        (cellsById.get(b) as Cell[]).length - (cellsById.get(a) as Cell[]).length || a - b,
    );
  const purposeById = new Map<number, RoomPurpose>();
  let storageCount = 0;
  let qi = 0;
  for (const id of rest) {
    let purpose: RoomPurpose = program.filler;
    while (qi < queue.length) {
      const candidate = queue[qi++];
      if (candidate === 'storage' && storageCount >= 1) continue;
      purpose = candidate;
      break;
    }
    if (purpose === 'storage') {
      if (storageCount >= 1) purpose = program.filler; // hard cap
      else storageCount++;
    }
    purposeById.set(id, purpose);
  }

  return ids.map((id) => {
    const cells = cellsById.get(id) as Cell[];
    const isMain = id === mainId;
    const isCorridor = corridor.has(id);
    const purpose: RoomPurpose = isMain
      ? HEADLINE[type]
      : isCorridor
        ? 'corridor'
        : (purposeById.get(id) as RoomPurpose);
    return { id, purpose, cells, bbox: bboxFeet(cells), isMain, isCorridor };
  });
}
