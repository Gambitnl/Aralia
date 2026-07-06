import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';

const build = (type: any, seed: number) => {
  const p = rootSeedPath(seed);
  const fp = genFootprint(p, type);
  const rg = partition(p, fp, { keepMainWhole: true });
  return assignPurposes(p, type, rg);
};

describe('assignPurposes', () => {
  it('exactly one main room, and it is the largest non-corridor', () => {
    const rooms = build('tavern', 5);
    expect(rooms.filter((r) => r.isMain)).toHaveLength(1);
    const main = rooms.find((r) => r.isMain)!;
    const nonCorridorAreas = rooms.filter((r) => !r.isCorridor).map((r) => r.cells.length);
    expect(main.cells.length).toBe(Math.max(...nonCorridorAreas));
  });

  it('the main room carries the type headline purpose', () => {
    expect(build('tavern', 5).find((r) => r.isMain)!.purpose).toBe('common-room');
    expect(build('manor', 6).find((r) => r.isMain)!.purpose).toBe('great-hall');
  });

  it('no building is half storeroom (storage rooms <= 1)', () => {
    for (let s = 0; s < 100; s++) {
      const rooms = build('tavern', s);
      expect(rooms.filter((r) => r.purpose === 'storage').length).toBeLessThanOrEqual(1);
    }
  });
});
