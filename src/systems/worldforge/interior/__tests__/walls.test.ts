import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';
import { assignPurposes } from '../program';
import { wireDoors } from '../doors';
import { buildWalls } from '../walls';

const build = (type: any, seed: number) => {
  const p = rootSeedPath(seed);
  const fp = genFootprint(p, type);
  const rg = partition(p, fp, { keepMainWhole: true });
  const rooms = assignPurposes(p, type, rg);
  const { doors } = wireDoors(p, rg, rooms);
  return { fp, ...buildWalls(p, rg, doors), doors };
};

describe('buildWalls', () => {
  it('outer walls are thicker than inner walls', () => {
    const { walls } = build('manor', 2);
    const outer = walls.find((w) => w.kind === 'outer')!;
    const inner = walls.find((w) => w.kind === 'inner')!;
    expect(outer.thicknessFt).toBeGreaterThan(inner.thicknessFt);
  });

  it('no wall edge coincides with a door', () => {
    const { walls, doors } = build('tavern', 6);
    for (const d of doors) {
      const clash = walls.some((w) => w.axis === d.axis && w.x === d.x && w.y === d.y);
      expect(clash).toBe(false);
    }
  });

  it('windows only sit on outer walls', () => {
    const { walls, windows } = build('shop', 1);
    const outerSet = new Set(walls.filter((w) => w.kind === 'outer').map((w) => `${w.axis}:${w.x}:${w.y}`));
    for (const win of windows) expect(outerSet.has(`${win.axis}:${win.x}:${win.y}`)).toBe(true);
  });
});
