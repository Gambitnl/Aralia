/**
 * @file generateBuilding.ts — assemble a full multi-floor BlueprintPlan.
 *
 * Task 8 of the Building Blueprint Pipeline. Composes the Task 2–7 modules
 * (footprint → partition → program → doors → walls → furnish) per floor:
 *   - all floors share the SAME footprint
 *   - ground floor (level 0) partitions with keepMainWhole: true
 *   - upper floors are sleeping quarters (bedrooms / guest rooms)
 *   - the basement (level -1) is cellars / storage, keepMainWhole: false
 *   - ONE stair shaft at the ground main room's center cell, same (x, y) on
 *     every level; the shaft cell is passed to furnishRooms as blocked on
 *     every floor it touches
 *   - basement floors get NO windows (underground)
 *
 * Deterministic: each floor seeds from childSeedPath(path, 'floor:<level>').
 * Memoized per (seedPath, type, storeys, basement) exactly as
 * generateInterior memoizes per plot key. Pure data — no three.js.
 */
import type {
  BlueprintFloor,
  BlueprintPlan,
  BlueprintRoom,
  BlueprintStair,
  BuildingType,
  RoomPurpose,
} from './blueprintTypes';
import { cellKey } from './blueprintTypes';
import { genFootprint, type Footprint } from './footprint';
import { partition } from './partition';
import { assignPurposes } from './program';
import { wireDoors } from './doors';
import { buildWalls } from './walls';
import { furnishRooms } from './furnish';
import { childSeedPath, type SeedPath } from '../seedPath';

const CELL_FT = 5;

export interface GenerateBuildingInput {
  buildingId: number;
  type: BuildingType;
  seedPath: SeedPath;
  storeys?: number;
  basement?: boolean;
}

// Bounded memo: identical inputs reproduce byte-for-byte, so regeneration is
// cheap; clearing on cap keeps long sessions from growing without bound.
const buildingMemo = new Map<string, BlueprintPlan>();
const BUILDING_MEMO_CAP = 50_000;

/** Re-purpose a floor's rooms for a non-ground level, keeping geometry. */
function repurpose(
  rooms: BlueprintRoom[],
  level: number,
): BlueprintRoom[] {
  return rooms.map((room) => {
    if (room.isCorridor) return room;
    let purpose: RoomPurpose;
    if (level < 0) {
      // Basement: cellars and storage only.
      purpose = room.id % 2 === 0 ? 'cellar' : 'storage';
    } else {
      // Upper floors: sleeping quarters. The main room stays a bedroom too —
      // upstairs has no hall.
      purpose = room.isMain || room.id % 3 !== 2 ? 'bedroom' : 'guest-room';
    }
    return { ...room, purpose };
  });
}

/** Build one floor of the shared footprint at the given level. */
function buildFloor(
  buildingPath: SeedPath,
  type: BuildingType,
  fp: Footprint,
  level: number,
  blocked: Set<string>,
  ground?: { rg: number[][]; rooms: BlueprintRoom[] },
): BlueprintFloor {
  const floorPath = childSeedPath(buildingPath, `floor:${level}`);
  // Ground reuses the partition/purposes already computed for stair anchoring.
  const rg = ground?.rg ?? partition(floorPath, fp, { keepMainWhole: level === 0 });
  let rooms = ground?.rooms ?? assignPurposes(floorPath, type, rg);
  if (level !== 0) rooms = repurpose(rooms, level);
  // Only the ground floor opens onto the street; upper floors and basements
  // are reached by the stair shaft, never through an exterior door.
  const { doors } = wireDoors(floorPath, rg, rooms, { streetEntry: level === 0 });
  const { walls, windows } = buildWalls(floorPath, rg, doors);
  const furnishings = furnishRooms(floorPath, rooms, doors, blocked);
  return {
    level,
    rooms,
    doors,
    // Basements are underground: no windows.
    windows: level < 0 ? [] : windows,
    furnishings,
    walls,
  };
}

/** Center cell of the ground floor's main room (closest cell to centroid). */
function mainRoomCenterCell(rooms: BlueprintRoom[]): { cx: number; cy: number } {
  const main = rooms.find((r) => r.isMain) ?? rooms[0];
  let sx = 0, sy = 0;
  for (const c of main.cells) { sx += c.cx; sy += c.cy; }
  const mx = sx / main.cells.length;
  const my = sy / main.cells.length;
  let best = main.cells[0];
  let bestD = Infinity;
  for (const c of main.cells) {
    const d = (c.cx - mx) * (c.cx - mx) + (c.cy - my) * (c.cy - my);
    if (d < bestD) { bestD = d; best = c; }
  }
  return { cx: best.cx, cy: best.cy };
}

export function generateBuilding(input: GenerateBuildingInput): BlueprintPlan {
  const { buildingId, type, seedPath } = input;
  const storeys = Math.max(1, Math.floor(input.storeys ?? 1));
  const basement = input.basement === true;

  const buildingPath = childSeedPath(seedPath, `building:${buildingId}`);
  const memoKey = `${buildingPath}|${type}|${storeys}|${basement}`;
  const cached = buildingMemo.get(memoKey);
  if (cached) return cached;

  // One footprint shared by every floor.
  const fp = genFootprint(buildingPath, type);

  // Ground floor first: the stair shaft anchors at its main room's center.
  // Every occupied footprint cell belongs to a room on every level (partition
  // covers the footprint), so the same shaft cell lands inside a room on the
  // basement and each upper floor too.
  const groundPath = childSeedPath(buildingPath, 'floor:0');
  const groundRg = partition(groundPath, fp, { keepMainWhole: true });
  const groundRooms = assignPurposes(groundPath, type, groundRg);
  const joins = storeys - 1 + (basement ? 1 : 0);
  const stairCell = joins > 0 ? mainRoomCenterCell(groundRooms) : null;
  const blocked = new Set<string>();
  if (stairCell) blocked.add(cellKey(stairCell.cx, stairCell.cy));

  const levels: number[] = [];
  if (basement) levels.push(-1);
  for (let level = 0; level < storeys; level++) levels.push(level);

  const floors: BlueprintFloor[] = levels.map((level) =>
    buildFloor(
      buildingPath, type, fp, level, blocked,
      level === 0 ? { rg: groundRg, rooms: groundRooms } : undefined,
    ),
  );

  const stairs: BlueprintStair[] = [];
  if (stairCell) {
    const x = stairCell.cx * CELL_FT + CELL_FT / 2;
    const y = stairCell.cy * CELL_FT + CELL_FT / 2;
    for (const level of levels) {
      if (levels.includes(level + 1)) stairs.push({ fromLevel: level, x, y });
    }
  }

  const result: BlueprintPlan = {
    buildingId,
    type,
    footprintCells: fp.cells,
    widthFt: fp.cols * CELL_FT,
    depthFt: fp.rows * CELL_FT,
    floors,
    stairs,
  };
  if (buildingMemo.size >= BUILDING_MEMO_CAP) buildingMemo.clear();
  buildingMemo.set(memoKey, result);
  return result;
}
