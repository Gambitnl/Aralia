/**
 * @file furnish.ts — Task 7 of the Building Blueprint Pipeline: room-clipped
 * furniture placement, wall-aware (Wave A fix A11).
 *
 * One recipe per RoomPurpose. Every item lands on a cell the room actually
 * OWNS (`room.cells`) — never the bounding box — so L-shaped rooms don't leak
 * furniture through their notches. Cells within one cell (Chebyshev) of a
 * door, and cells in the `blocked` set (stair reservations), are never used.
 * Corridors get nothing.
 *
 * Each recipe item carries a placement hint the placer honors:
 *   - 'exterior-wall': hearths must sit on a cell adjacent to the footprint
 *     boundary (a chimney needs an outer wall). If the room owns no such
 *     cell the item is SKIPPED — honest omission, no substitute.
 *   - 'wall': shelves and counters prefer any wall-adjacent cell (interior
 *     or exterior); relaxed to any free cell if none remain.
 *   - 'wall-away-from-door': beds — wall-adjacent AND, when available,
 *     farther from doors than the mandatory 1-cell door halo.
 *   - 'center': tables prefer non-wall cells; relaxed if none.
 *   - 'any': no preference.
 *
 * The footprint boundary is recovered from the rooms themselves: partition
 * covers the footprint, so the union of all rooms' cells IS the footprint,
 * and a cell with a 4-neighbor outside that union abuts an exterior wall.
 *
 * Item count scales with room area but is density-capped so small rooms stay
 * walkable. Deterministic: all randomness comes from the 'furnish' sub-stream
 * of the caller's seed path; candidate pools are filtered in stable
 * room-cell order so identical seeds reproduce identical layouts.
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

export type PlacementHint =
  | 'exterior-wall'
  | 'wall'
  | 'wall-away-from-door'
  | 'center'
  | 'any';

export interface RecipeItem { kind: string; hint: PlacementHint; }

/** Default hint per furniture kind — applied when building recipe items. */
const KIND_HINTS: Record<string, PlacementHint> = {
  'hearth': 'exterior-wall',
  'counter': 'wall',
  'shelf': 'wall',
  'bed': 'wall-away-from-door',
  'table': 'center',
  'forge-hearth': 'exterior-wall',
  'anvil': 'center',
  'loom': 'wall',
  'strongbox': 'wall',
  'writing-desk': 'wall',
};

const hintFor = (kind: string): PlacementHint => KIND_HINTS[kind] ?? 'any';
const item = (kind: string): RecipeItem => ({ kind, hint: hintFor(kind) });

/** Recipe: `core` items placed first (the room's identity pieces), then
 *  `filler` items cycled to fill larger rooms. Kinds and counts are identical
 *  to the pre-A11 table; only the placement hints are new. */
interface Recipe { core: RecipeItem[]; filler: RecipeItem[]; }

const recipe = (core: string[], filler: string[]): Recipe => ({
  core: core.map(item),
  filler: filler.map(item),
});

const RECIPES: Record<RoomPurpose, Recipe> = {
  'hall':         recipe(['hearth', 'table'], ['table', 'bench']),
  'common-room':  recipe(['hearth', 'table'], ['table', 'bench', 'barrel']),
  'great-hall':   recipe(['hearth', 'table', 'table'], ['table', 'bench']),
  'nave':         recipe(['altar', 'bench'], ['bench']),
  'sanctuary':    recipe(['altar'], ['bench']),
  'vestry':       recipe(['chest', 'shelf'], ['shelf']),
  'kitchen':      recipe(['hearth', 'table'], ['barrel', 'shelf']),
  'bedroom':      recipe(['bed', 'chest'], ['chest']),
  'guest-room':   recipe(['bed', 'chest'], ['bed']),
  'private-room': recipe(['bed', 'chest'], ['chair']),
  'solar':        recipe(['bed', 'desk'], ['chest', 'chair']),
  'shopfront':    recipe(['counter', 'shelf'], ['shelf', 'crate']),
  'workshop':     recipe(['workbench'], ['crate', 'barrel', 'shelf']),
  'storage':      recipe(['crate', 'barrel'], ['crate', 'barrel']),
  'pantry':       recipe(['shelf', 'barrel'], ['crate']),
  'cellar':       recipe(['barrel', 'barrel'], ['crate', 'barrel']),
  'armory':       recipe(['weapon-rack', 'chest'], ['weapon-rack', 'crate']),
  'study':        recipe(['desk', 'shelf'], ['chair', 'shelf']),
  'guard-room':   recipe(['table', 'weapon-rack'], ['bench']),
  'corridor':     recipe([], []),
  'forge':          recipe(['forge-hearth', 'anvil'], ['barrel', 'workbench']),
  'counting-room':  recipe(['writing-desk', 'strongbox'], ['shelf', 'chair']),
  'servant-room':   recipe(['bed', 'chest'], ['bed']),
  'stockroom':      recipe(['crate', 'crate'], ['barrel', 'crate', 'shelf']),
  'brewhouse':      recipe(['barrel', 'workbench'], ['barrel', 'crate']),
};

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

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
 * cells, keeping door approaches and stair-reserved cells clear, honoring
 * per-item placement hints (see file header).
 */
export function furnishRooms(
  path: SeedPath,
  rooms: BlueprintRoom[],
  doors: BlueprintDoor[],
  blocked: Set<string>,
): BlueprintFurnishing[] {
  const rng = rngFromPath(streamPath(path, 'furnish'));
  const out: BlueprintFurnishing[] = [];

  // Footprint = union of every room's cells (partition covers the footprint).
  // A cell with a 4-neighbor outside the union abuts an EXTERIOR wall.
  const footprint = new Set<string>();
  for (const room of rooms) {
    for (const c of room.cells) footprint.add(cellKey(c.cx, c.cy));
  }
  const exteriorAdjacent = (c: Cell): boolean =>
    N4.some(([dx, dy]) => !footprint.has(cellKey(c.cx + dx, c.cy + dy)));

  // Every cell within one cell (Chebyshev) of any door cell is off-limits.
  const nearDoor = new Set<string>();
  const allDoorCells: Cell[] = [];
  for (const door of doors) {
    for (const c of doorCells(door)) {
      allDoorCells.push(c);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          nearDoor.add(cellKey(c.cx + dx, c.cy + dy));
        }
      }
    }
  }
  const doorDist = (c: Cell): number => {
    let best = Infinity;
    for (const d of allDoorCells) {
      const dist = Math.max(Math.abs(c.cx - d.cx), Math.abs(c.cy - d.cy));
      if (dist < best) best = dist;
    }
    return best;
  };

  for (const room of rooms) {
    if (room.isCorridor || room.purpose === 'corridor') continue;
    const rec = RECIPES[room.purpose];
    if (rec.core.length === 0 && rec.filler.length === 0) continue;

    const roomSet = new Set(room.cells.map((c) => cellKey(c.cx, c.cy)));
    // Wall-adjacent = on the room's boundary (a 4-neighbor outside the room:
    // either open air or another room across an interior wall).
    const wallAdjacent = (c: Cell): boolean =>
      N4.some(([dx, dy]) => !roomSet.has(cellKey(c.cx + dx, c.cy + dy)));

    const candidates = room.cells.filter((c) => {
      const key = cellKey(c.cx, c.cy);
      return !blocked.has(key) && !nearDoor.has(key);
    });
    if (candidates.length === 0) continue;

    // Count scales with area (one item per ~3 cells beyond the core set) but
    // never fills more than half the usable cells — rooms stay walkable.
    const area = room.cells.length;
    const wanted = rec.core.length + Math.floor(Math.max(0, area - rec.core.length * 2) / 3);
    const cap = Math.max(1, Math.floor(candidates.length / 2));
    const count = Math.min(wanted, cap, candidates.length);

    for (let i = 0; i < count && candidates.length > 0; i++) {
      const it = i < rec.core.length
        ? rec.core[i]
        : rec.filler[(i - rec.core.length) % rec.filler.length];

      // Build the hint-filtered pool in stable room-cell order.
      let pool: Cell[];
      if (it.hint === 'exterior-wall') {
        pool = candidates.filter(exteriorAdjacent);
        // No outer-wall cell in this room ⇒ no chimney possible: skip the
        // item entirely (honest omission — no interior-wall hearth).
        if (pool.length === 0) continue;
      } else if (it.hint === 'wall' || it.hint === 'wall-away-from-door') {
        pool = candidates.filter(wallAdjacent);
        if (pool.length === 0) pool = candidates; // relax: any free cell
        if (it.hint === 'wall-away-from-door') {
          // The door halo already guarantees distance >= 2 from door cells;
          // prefer cells not touching the halo either (distance >= 3).
          const far = pool.filter((c) => doorDist(c) >= 3);
          if (far.length > 0) pool = far;
        }
      } else if (it.hint === 'center') {
        pool = candidates.filter((c) => !wallAdjacent(c));
        if (pool.length === 0) pool = candidates; // relax: small rooms are all wall
      } else {
        pool = candidates;
      }

      const cell = pool[rng.nextInt(0, pool.length)]; // max-EXCLUSIVE
      // Remove it from the master candidate list so items never stack.
      candidates.splice(candidates.indexOf(cell), 1);
      out.push({
        kind: it.kind,
        roomId: room.id,
        x: cell.cx * CELL_FT + CELL_FT / 2,
        y: cell.cy * CELL_FT + CELL_FT / 2,
        rotation: ROTATIONS[rng.nextInt(0, ROTATIONS.length)],
      });
    }
  }

  return out;
}
