import { describe, it, expect } from 'vitest';
import { SeededRandom, createSeededRandom } from '../seededRandom';

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(54321);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('matches golden values for seed 12345 (Park-Miller minstd)', () => {
    // Lock the exact sequence. A drift here breaks every saved world.
    const rng = new SeededRandom(12345);
    const golden = [rng.next(), rng.next(), rng.next(), rng.next()];
    expect(golden).toEqual([
      0.09661652808693845,
      0.8339946273099581,
      0.9477024976608367,
      0.035878594532495915,
    ]);
  });

  it('normalizes zero and negative seeds instead of degenerating', () => {
    // seed <= 0 would lock the Park-Miller stream at 0 forever.
    for (const seed of [0, -1, -2147483647]) {
      const rng = new SeededRandom(seed);
      const first = rng.next();
      const second = rng.next();
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThan(1);
      expect(second).not.toBe(first);
    }
  });

  it('treats congruent seeds (mod 2147483647) as the same stream', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(1 + 2147483647);
    expect(a.next()).toBe(b.next());
  });

  describe('next()', () => {
    it('stays in [0, 1) over many draws', () => {
      const rng = new SeededRandom(999);
      for (let i = 0; i < 10_000; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('nextInt()', () => {
    it('is min-inclusive and MAX-EXCLUSIVE', () => {
      // Contract regression guard: callers that pass array.length rely on this.
      const rng = new SeededRandom(42);
      const seen = new Set<number>();
      for (let i = 0; i < 5_000; i++) {
        const v = rng.nextInt(3, 7);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThan(7);
        seen.add(v);
      }
      expect([...seen].sort()).toEqual([3, 4, 5, 6]);
    });

    it('returns min when max equals min + 1', () => {
      const rng = new SeededRandom(7);
      for (let i = 0; i < 100; i++) {
        expect(rng.nextInt(5, 6)).toBe(5);
      }
    });

    it('reaches every bucket of a large range', () => {
      const rng = new SeededRandom(1);
      const seen = new Set<number>();
      for (let i = 0; i < 20_000; i++) {
        seen.add(rng.nextInt(0, 100));
      }
      expect(seen.size).toBe(100);
      expect(seen.has(100)).toBe(false);
    });
  });

  describe('pick()', () => {
    it('returns only elements of the array and hits all of them', () => {
      const rng = new SeededRandom(2024);
      const items = ['a', 'b', 'c', 'd'];
      const seen = new Set<string>();
      for (let i = 0; i < 1_000; i++) {
        const v = rng.pick(items);
        expect(items).toContain(v);
        seen.add(v);
      }
      expect(seen.size).toBe(items.length);
    });
  });
});

describe('createSeededRandom', () => {
  it('is deterministic for the same inputs', () => {
    const a = createSeededRandom(100, { x: 3, y: 4 }, 'village', 'salt');
    const b = createSeededRandom(100, { x: 3, y: 4 }, 'village', 'salt');
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });

  it('varies with coordinates', () => {
    const a = createSeededRandom(100, { x: 1, y: 1 });
    const b = createSeededRandom(100, { x: 2, y: 1 });
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('varies with the context string', () => {
    const a = createSeededRandom(100, undefined, 'village');
    const b = createSeededRandom(100, undefined, 'temple');
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('varies with the salt', () => {
    const a = createSeededRandom(100, undefined, 'village', 's1');
    const b = createSeededRandom(100, undefined, 'village', 's2');
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('returns values in [0, 1)', () => {
    const rng = createSeededRandom(77);
    for (let i = 0; i < 5_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
