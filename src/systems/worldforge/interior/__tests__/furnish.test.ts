import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';
import { wireDoors } from '../doors';
import { furnishRooms } from '../furnish';
import { cellKey, type BuildingType, type Cell } from '../blueprintTypes';

const TYPES: BuildingType[] = ['cottage', 'shop', 'tavern', 'workshop', 'manor'];
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Generate one furnished floor plus everything a test oracle needs. */
function gen(seed: number, type: BuildingType) {
  const p = rootSeedPath(seed);
  const fp = genFootprint(p, type);
  const rg = partition(p, fp, { keepMainWhole: true });
  const rooms = assignPurposes(p, type, rg);
  const { doors } = wireDoors(p, rg, rooms);
  const furn = furnishRooms(p, rooms, doors, new Set());
  // Independent exterior-adjacency oracle: from the FOOTPRINT cells, not from
  // anything furnish.ts computes internally.
  const fpSet = new Set(fp.cells.map((c) => cellKey(c.cx, c.cy)));
  const extAdj = (c: Cell) =>
    N4.some(([dx, dy]) => !fpSet.has(cellKey(c.cx + dx, c.cy + dy)));
  return { p, fp, rg, rooms, doors, furn, fpSet, extAdj };
}

const toCell = (f: { x: number; y: number }): Cell => ({
  cx: Math.floor(f.x / 5),
  cy: Math.floor(f.y / 5),
});

describe('furnishRooms', () => {
  it('every furnishing sits on a cell owned by its room', () => {
    const p = rootSeedPath(15);
    const fp = genFootprint(p, 'tavern');
    const rg = partition(p, fp, { keepMainWhole: true });
    const rooms = assignPurposes(p, 'tavern', rg);
    const { doors } = wireDoors(p, rg, rooms);
    const furn = furnishRooms(p, rooms, doors, new Set());
    const cellsById = new Map(rooms.map((r) => [r.id, new Set(r.cells.map((c) => cellKey(c.cx, c.cy)))]));
    for (const f of furn) {
      const cx = Math.floor(f.x / 5), cy = Math.floor(f.y / 5);
      expect(cellsById.get(f.roomId)!.has(cellKey(cx, cy))).toBe(true);
    }
  });

  it('corridors get no furniture', () => {
    const p = rootSeedPath(21);
    const fp = genFootprint(p, 'manor');
    const rg = partition(p, fp, { keepMainWhole: true });
    const rooms = assignPurposes(p, 'manor', rg);
    const { doors } = wireDoors(p, rg, rooms);
    const furn = furnishRooms(p, rooms, doors, new Set());
    const corridorIds = new Set(rooms.filter((r) => r.isCorridor).map((r) => r.id));
    expect(furn.some((f) => corridorIds.has(f.roomId))).toBe(false);
  });

  it('sweep: ownership, blocked and door-halo invariants hold everywhere', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const { p, rooms, doors } = gen(seed, type);
        // Re-run with a blocked cell (each room's first cell) to exercise `blocked`.
        const blocked = new Set(rooms.map((r) => cellKey(r.cells[0].cx, r.cells[0].cy)));
        const furn = furnishRooms(p, rooms, doors, blocked);
        const cellsById = new Map(rooms.map((r) => [r.id, new Set(r.cells.map((c) => cellKey(c.cx, c.cy)))]));
        // Door halo: cells within Chebyshev 1 of any door-flanking cell.
        const halo = new Set<string>();
        for (const door of doors) {
          const cx = Math.floor(door.x / 5), cy = Math.floor(door.y / 5);
          const flank: Cell[] = door.axis === 'x'
            ? [{ cx, cy: Math.round(door.y / 5) - 1 }, { cx, cy: Math.round(door.y / 5) }]
            : [{ cx: Math.round(door.x / 5) - 1, cy }, { cx: Math.round(door.x / 5), cy }];
          for (const c of flank) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) halo.add(cellKey(c.cx + dx, c.cy + dy));
            }
          }
        }
        const seen = new Set<string>();
        for (const f of furn) {
          const c = toCell(f);
          const key = cellKey(c.cx, c.cy);
          expect(cellsById.get(f.roomId)!.has(key)).toBe(true); // ownership
          expect(blocked.has(key)).toBe(false);                  // blocked
          expect(halo.has(key)).toBe(false);                     // door halo
          expect(seen.has(key)).toBe(false);                     // no stacking
          seen.add(key);
        }
      }
    }
  });

  it('sweep: 100% of placed hearths abut an exterior wall (footprint oracle)', () => {
    let hearths = 0;
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const { furn, extAdj } = gen(seed, type);
        for (const f of furn) {
          if (f.kind !== 'hearth') continue;
          hearths++;
          expect(extAdj(toCell(f))).toBe(true);
        }
      }
    }
    expect(hearths).toBeGreaterThan(100); // the sweep actually exercises hearths
  });

  it('sweep: wall-hint items (bed/counter/shelf) are wall-adjacent >= 95%', () => {
    let wallItems = 0;
    let onWall = 0;
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const { rooms, furn } = gen(seed, type);
        const roomSets = new Map(rooms.map((r) => [r.id, new Set(r.cells.map((c) => cellKey(c.cx, c.cy)))]));
        for (const f of furn) {
          if (!['bed', 'counter', 'shelf'].includes(f.kind)) continue;
          const c = toCell(f);
          const rs = roomSets.get(f.roomId)!;
          wallItems++;
          if (N4.some(([dx, dy]) => !rs.has(cellKey(c.cx + dx, c.cy + dy)))) onWall++;
        }
      }
    }
    expect(wallItems).toBeGreaterThan(100);
    expect(onWall / wallItems).toBeGreaterThanOrEqual(0.95);
  });

  it('sweep: recipe kinds are unchanged — non-hearth core items still appear', () => {
    // A11 must not alter counts/kinds beyond the explicit hearth skip.
    const kinds = new Set<string>();
    for (const type of TYPES) {
      for (const seed of SEEDS.slice(0, 10)) {
        for (const f of gen(seed, type).furn) kinds.add(f.kind);
      }
    }
    for (const k of ['table', 'bed', 'chest', 'counter', 'shelf', 'crate', 'barrel', 'workbench']) {
      expect(kinds.has(k)).toBe(true);
    }
  });

  it('deterministic: same seed path reproduces the identical layout', () => {
    for (const type of TYPES) {
      for (const seed of [3, 7, 19]) {
        const a = gen(seed, type).furn;
        const b = gen(seed, type).furn;
        expect(b).toEqual(a);
      }
    }
  });
});
