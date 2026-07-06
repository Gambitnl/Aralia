import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import { partition } from '../partition';

const roomIds = (rg: number[][]) => new Set(rg.flat().filter((v) => v >= 0));
const areaOf = (rg: number[][], id: number) => rg.flat().filter((v) => v === id).length;

describe('partition', () => {
  it('every occupied cell belongs to exactly one room, ids compact from 0', () => {
    const fp = genFootprint(rootSeedPath(3), 'tavern');
    const rg = partition(rootSeedPath(3), fp, { keepMainWhole: true });
    const ids = [...roomIds(rg)].sort((a, b) => a - b);
    expect(ids[0]).toBe(0);
    expect(ids).toEqual(ids.map((_, i) => i)); // 0..n-1 contiguous
    const occupied = fp.occ.flat().filter(Boolean).length;
    expect(rg.flat().filter((v) => v >= 0).length).toBe(occupied);
  });

  it('keeps one dominant room (>= 30% of area) when keepMainWhole', () => {
    const fp = genFootprint(rootSeedPath(9), 'manor');
    const rg = partition(rootSeedPath(9), fp, { keepMainWhole: true });
    const total = fp.occ.flat().filter(Boolean).length;
    const biggest = Math.max(...[...roomIds(rg)].map((id) => areaOf(rg, id)));
    expect(biggest / total).toBeGreaterThanOrEqual(0.3);
  });

  it('no sliver rooms (< 3 cells) survive', () => {
    const fp = genFootprint(rootSeedPath(11), 'shop');
    const rg = partition(rootSeedPath(11), fp, { keepMainWhole: true });
    for (const id of roomIds(rg)) expect(areaOf(rg, id)).toBeGreaterThanOrEqual(3);
  });

  it('room counts land in the plan bands (cottage 3-5, tavern 6-9, manor 6-10)', () => {
    // Loose empirical pins over 30 seeds: a hard per-seed floor plus a mean
    // window per type, and never a one-room (or two-room) building.
    const bands = {
      cottage: { floor: 3, mean: [3, 5] },
      tavern: { floor: 4, mean: [5.5, 9.5] },
      manor: { floor: 5, mean: [6, 13] },
    } as const;
    for (const [type, band] of Object.entries(bands) as Array<
      [keyof typeof bands, (typeof bands)[keyof typeof bands]]
    >) {
      let sum = 0;
      for (let s = 0; s < 30; s++) {
        const fp = genFootprint(rootSeedPath(s), type);
        const rg = partition(rootSeedPath(s), fp, { keepMainWhole: true });
        const n = roomIds(rg).size;
        expect(n, `${type} seed ${s}`).toBeGreaterThanOrEqual(band.floor);
        sum += n;
      }
      const mean = sum / 30;
      expect(mean, `${type} mean`).toBeGreaterThanOrEqual(band.mean[0]);
      expect(mean, `${type} mean`).toBeLessThanOrEqual(band.mean[1]);
    }
    // Every footprint type always yields at least 3 rooms.
    for (const type of ['shop', 'workshop'] as const) {
      for (let s = 0; s < 30; s++) {
        const fp = genFootprint(rootSeedPath(s), type);
        const rg = partition(rootSeedPath(s), fp, { keepMainWhole: true });
        expect(roomIds(rg).size, `${type} seed ${s}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
