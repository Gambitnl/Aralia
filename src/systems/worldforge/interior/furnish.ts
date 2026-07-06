/**
 * @file furnish.ts — Task 7 of the Building Blueprint Pipeline: room-clipped
 * furniture placement.
 *
 * One recipe per RoomPurpose. Every item lands on a cell the room actually
 * OWNS (`room.cells`) — never the bounding box — so L-shaped rooms don't leak
 * furniture through their notches. Cells within one cell (Chebyshev) of a
 * door, and cells in the `blocked` set (stair reservations), are never used.
 * Corridors get nothing.
 *
 * Item count scales with room area but is density-capped so small rooms stay
 * walkable. Deterministic: all randomness comes from the 'furnish' sub-stream
 * of the caller's seed path.
 *
 * Kind strings reuse the vocabulary generateInterior.ts already renders in 3D
 * (table, hearth, counter, shelf, barrel, crate, bed, chest, workbench) plus
 * a few new ones (bench, altar, desk, chair, weapon-rack) for purposes the
 * legacy generator never had.
 */
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import {
  cellKey,
  type BlueprintDoor,
  type BlueprintFurnishing,
  type BlueprintRoom,
  type Cell,
  type RoomPurpose,
} from './blueprintTypes';

const CELL_FT = 5;

const ROTATIONS: ReadonlyArray<0 | 90 | 180 | 270> = [0, 90, 180, 270];

/** Recipe: `core` items placed first (the room's identity pieces), then
 *  `filler` items cycled to fill larger rooms. */
interface Recipe { core: string[]; filler: string[]; }

const RECIPES: Record<RoomPurpose, Recipe> = {
  'hall':         { core: ['hearth', 'table'], filler: ['table', 'bench'] },
  'common-room':  { core: ['hearth', 'table'], filler: ['table', 'bench', 'barrel'] },
  'great-hall':   { core: ['hearth', 'table', 'table'], filler: ['table', 'bench'] },
  'nave':         { core: ['altar', 'bench'], filler: ['bench'] },
  'sanctuary':    { core: ['altar'], filler: ['bench'] },
  'vestry':       { core: ['chest', 'shelf'], filler: ['shelf'] },
  'kitchen':      { core: ['hearth', 'table'], filler: ['barrel', 'shelf'] },
  'bedroom':      { core: ['bed', 'chest'], filler: ['chest'] },
  'guest-room':   { core: ['bed', 'chest'], filler: ['bed'] },
  'private-room': { core: ['bed', 'chest'], filler: ['chair'] },
  'solar':        { core: ['bed', 'desk'], filler: ['chest', 'chair'] },
  'shopfront':    { core: ['counter', 'shelf'], filler: ['shelf', 'crate'] },
  'workshop':     { core: ['workbench'], filler: ['crate', 'barrel', 'shelf'] },
  'storage':      { core: ['crate', 'barrel'], filler: ['crate', 'barrel'] },
  'pantry':       { core: ['shelf', 'barrel'], filler: ['crate'] },
  'cellar':       { core: ['barrel', 'barrel'], filler: ['crate', 'barrel'] },
  'armory':       { core: ['weapon-rack', 'chest'], filler: ['weapon-rack', 'crate'] },
  'study':        { core: ['desk', 'shelf'], filler: ['chair', 'shelf'] },
  'guard-room':   { core: ['table', 'weapon-rack'], filler: ['bench'] },
  'corridor':     { core: [], filler: [] },
};

/** Cells a door touches: the two cells flanking its wall edge. */
function doorCells(door: BlueprintDoor): Cell[] {
  const cx = Math.floor(door.x / CELL_FT);
  const cy = Math.floor(door.y / CELL_FT);
  if (door.axis === 'x') {
    // Horizontal wall: door.y sits ON a cell boundary; flanking cells above/below.
    const by = Math.round(door.y / CELL_FT);
    return [{ cx, cy: by - 1 }, { cx, cy: by }];
  }
  // Vertical wall: door.x sits ON a cell boundary; flanking cells left/right.
  const bx = Math.round(door.x / CELL_FT);
  return [{ cx: bx - 1, cy }, { cx: bx, cy }];
}

/**
 * Place furniture in every non-corridor room, clipped to the room's own
 * cells, keeping door approaches and stair-reserved cells clear.
 */
export function furnishRooms(
  path: SeedPath,
  rooms: BlueprintRoom[],
  doors: BlueprintDoor[],
  blocked: Set<string>,
): BlueprintFurnishing[] {
  const rng = rngFromPath(streamPath(path, 'furnish'));
  const out: BlueprintFurnishing[] = [];

  // Every cell within one cell (Chebyshev) of any door cell is off-limits.
  const nearDoor = new Set<string>();
  for (const door of doors) {
    for (const c of doorCells(door)) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          nearDoor.add(cellKey(c.cx + dx, c.cy + dy));
        }
      }
    }
  }

  for (const room of rooms) {
    if (room.isCorridor || room.purpose === 'corridor') continue;
    const recipe = RECIPES[room.purpose];
    if (recipe.core.length === 0 && recipe.filler.length === 0) continue;

    const candidates = room.cells.filter((c) => {
      const key = cellKey(c.cx, c.cy);
      return !blocked.has(key) && !nearDoor.has(key);
    });
    if (candidates.length === 0) continue;

    // Count scales with area (one item per ~3 cells beyond the core set) but
    // never fills more than half the usable cells — rooms stay walkable.
    const area = room.cells.length;
    const wanted = recipe.core.length + Math.floor(Math.max(0, area - recipe.core.length * 2) / 3);
    const cap = Math.max(1, Math.floor(candidates.length / 2));
    const count = Math.min(wanted, cap, candidates.length);

    for (let i = 0; i < count; i++) {
      // Draw a random free cell (remove it so items never stack).
      const pick = rng.nextInt(0, candidates.length); // max-EXCLUSIVE
      const cell = candidates.splice(pick, 1)[0];
      const kind = i < recipe.core.length
        ? recipe.core[i]
        : recipe.filler[(i - recipe.core.length) % recipe.filler.length];
      out.push({
        kind,
        roomId: room.id,
        x: cell.cx * CELL_FT + CELL_FT / 2,
        y: cell.cy * CELL_FT + CELL_FT / 2,
        rotation: ROTATIONS[rng.nextInt(0, ROTATIONS.length)],
      });
      if (candidates.length === 0) break;
    }
  }

  return out;
}
