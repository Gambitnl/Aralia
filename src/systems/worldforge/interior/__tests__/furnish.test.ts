import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';
import { wireDoors } from '../doors';
import { furnishRooms } from '../furnish';
import { cellKey } from '../blueprintTypes';

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
});
