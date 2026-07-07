import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import { partition, roomCapFor } from '../partition';

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

  it('per-seed hard caps: every type, every seed, rooms in [3, cap]', () => {
    // Hard per-seed regression net (not a mean window): the merge-down pass
    // must hold the ceiling on EVERY seed — no 17-room manor survives.
    const types = ['cottage', 'shop', 'workshop', 'tavern', 'manor'] as const;
    for (const type of types) {
      const cap = roomCapFor(type);
      for (let s = 0; s < 50; s++) {
        const fp = genFootprint(rootSeedPath(s), type);
        const rg = partition(rootSeedPath(s), fp, {
          keepMainWhole: true,
          maxRooms: cap,
        });
        const n = roomIds(rg).size;
        expect(n, `${type} seed ${s}`).toBeLessThanOrEqual(cap);
        expect(n, `${type} seed ${s}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('per-seed hard floors without a cap: every type yields >= 3 rooms', () => {
    for (const type of ['cottage', 'shop', 'workshop', 'tavern', 'manor'] as const) {
      for (let s = 0; s < 30; s++) {
        const fp = genFootprint(rootSeedPath(s), type);
        const rg = partition(rootSeedPath(s), fp, { keepMainWhole: true });
        expect(roomIds(rg).size, `${type} seed ${s}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('merge-down preserves coverage, compact ids, no slivers, dominant main >= 30%', () => {
    for (const type of ['cottage', 'shop', 'workshop', 'tavern', 'manor'] as const) {
      const cap = roomCapFor(type);
      for (let s = 0; s < 50; s++) {
        const fp = genFootprint(rootSeedPath(s), type);
        const rg = partition(rootSeedPath(s), fp, {
          keepMainWhole: true,
          maxRooms: cap,
        });
        // Full coverage: exactly the occupied cells carry room ids.
        const occupied = fp.occ.flat().filter(Boolean).length;
        expect(rg.flat().filter((v) => v >= 0).length, `${type} seed ${s} coverage`)
          .toBe(occupied);
        // Ids compact 0..n-1.
        const ids = [...roomIds(rg)].sort((a, b) => a - b);
        expect(ids, `${type} seed ${s} ids`).toEqual(ids.map((_, i) => i));
        // No slivers; dominant room stays >= 30% of the floor.
        let biggest = 0;
        for (const id of ids) {
          const a = areaOf(rg, id);
          expect(a, `${type} seed ${s} room ${id} sliver`).toBeGreaterThanOrEqual(3);
          biggest = Math.max(biggest, a);
        }
        expect(biggest / occupied, `${type} seed ${s} dominance`)
          .toBeGreaterThanOrEqual(0.3);
      }
    }
  });

  it('id allocation stays compact across split+merge passes (200 seeds, keepMainWhole off too)', () => {
    for (const keepMainWhole of [true, false]) {
      for (let s = 0; s < 200; s++) {
        const type = (['cottage', 'shop', 'workshop', 'tavern', 'manor'] as const)[s % 5];
        const fp = genFootprint(rootSeedPath(s), type);
        const rg = partition(rootSeedPath(s), fp, {
          keepMainWhole,
          maxRooms: roomCapFor(type),
        });
        const ids = [...roomIds(rg)].sort((a, b) => a - b);
        expect(ids[0], `${type} seed ${s} kmw=${keepMainWhole}`).toBe(0);
        expect(ids, `${type} seed ${s} kmw=${keepMainWhole}`)
          .toEqual(ids.map((_, i) => i));
      }
    }
  });
});
