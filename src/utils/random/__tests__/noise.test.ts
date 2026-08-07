import { describe, it, expect } from 'vitest';
import { PerlinNoise } from '../perlinNoise';
import { NoiseGenerator, RNG } from '../realmsmithRng';
import { SimplexNoise } from '../simplexNoise';

describe('PerlinNoise', () => {
  it('is deterministic for the same seed', () => {
    const a = new PerlinNoise(12345);
    const b = new PerlinNoise(12345);
    for (let i = 0; i < 50; i++) {
      const x = i * 0.137;
      const y = i * 0.291;
      expect(a.get(x, y)).toBe(b.get(x, y));
    }
  });

  it('changes with the seed', () => {
    const a = new PerlinNoise(1);
    const b = new PerlinNoise(2);
    const samplesA = Array.from({ length: 10 }, (_, i) => a.get(i * 0.13, i * 0.29));
    const samplesB = Array.from({ length: 10 }, (_, i) => b.get(i * 0.13, i * 0.29));
    expect(samplesA).not.toEqual(samplesB);
  });

  it('stays inside [-1, 1] over a dense sample grid', () => {
    const noise = new PerlinNoise(777);
    for (let ix = 0; ix < 64; ix++) {
      for (let iy = 0; iy < 64; iy++) {
        const v = noise.get(ix * 0.173, iy * 0.311);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('returns 0 at integer lattice points', () => {
    const noise = new PerlinNoise(5);
    expect(noise.get(3, 7)).toBe(0);
    expect(noise.get(0, 0)).toBe(0);
  });

  it('is continuous: nearby inputs give nearby outputs', () => {
    const noise = new PerlinNoise(99);
    const eps = 0.001;
    for (let i = 0; i < 20; i++) {
      const x = 0.5 + i * 0.37;
      const y = 0.5 + i * 0.53;
      const delta = Math.abs(noise.get(x, y) - noise.get(x + eps, y + eps));
      expect(delta).toBeLessThan(0.05);
    }
  });
});

describe('RNG (mulberry32)', () => {
  it('is deterministic for the same seed', () => {
    const a = new RNG(42);
    const b = new RNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('next() stays in [0, 1)', () => {
    const rng = new RNG(7);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range() stays in [min, max)', () => {
    const rng = new RNG(3);
    for (let i = 0; i < 5_000; i++) {
      const v = rng.range(-2, 5);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(5);
    }
  });

  it('rangeInt() is inclusive on BOTH ends (unlike SeededRandom.nextInt)', () => {
    const rng = new RNG(11);
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i++) {
      const v = rng.rangeInt(1, 4);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(4);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('chance() respects the extremes', () => {
    const rng = new RNG(13);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(1.01)).toBe(true);
      expect(rng.chance(0)).toBe(false);
    }
  });

  it('pick() returns only elements of the array', () => {
    const rng = new RNG(17);
    const items = [10, 20, 30];
    for (let i = 0; i < 500; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });
});

describe('NoiseGenerator (realmsmith perlin)', () => {
  it('is deterministic for the same seed', () => {
    const a = new NoiseGenerator(555);
    const b = new NoiseGenerator(555);
    for (let i = 0; i < 50; i++) {
      const x = i * 0.171;
      const y = i * 0.253;
      expect(a.noise(x, y)).toBe(b.noise(x, y));
    }
  });

  it('stays inside [0, 1] (normalized output)', () => {
    const noise = new NoiseGenerator(321);
    for (let ix = 0; ix < 64; ix++) {
      for (let iy = 0; iy < 64; iy++) {
        const v = noise.noise(ix * 0.191, iy * 0.277);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('SimplexNoise', () => {
  it('is deterministic for the same seed', () => {
    const a = new SimplexNoise(42);
    const first = Array.from({ length: 20 }, (_, i) =>
      a.noise3D(i * 0.17, i * 0.23, i * 0.31)
    );
    const b = new SimplexNoise(42);
    const second = Array.from({ length: 20 }, (_, i) =>
      b.noise3D(i * 0.17, i * 0.23, i * 0.31)
    );
    expect(first).toEqual(second);
  });

  it('changes with the seed', () => {
    const a = new SimplexNoise(1);
    const samplesA = Array.from({ length: 10 }, (_, i) =>
      a.noise3D(i * 0.17, i * 0.23, i * 0.31)
    );
    const b = new SimplexNoise(2);
    const samplesB = Array.from({ length: 10 }, (_, i) =>
      b.noise3D(i * 0.17, i * 0.23, i * 0.31)
    );
    expect(samplesA).not.toEqual(samplesB);
  });

  it('stays inside [-1, 1] over a dense 3D sample', () => {
    const noise = new SimplexNoise(2026);
    for (let i = 0; i < 4_000; i++) {
      const v = noise.noise3D(i * 0.113, i * 0.157, i * 0.199);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  // KNOWN HAZARD: the permutation tables are module-level, so a second live
  // instance re-seeds them and corrupts the first instance's output. Do not
  // hold two SimplexNoise instances at once. This test documents the trap.
  it('module-level tables: a later instance re-seeds an earlier one', () => {
    const points = Array.from({ length: 20 }, (_, i) => [
      i * 0.17,
      i * 0.23,
      i * 0.31,
    ]);
    const first = new SimplexNoise(42);
    const before = points.map(([x, y, z]) => first.noise3D(x, y, z));
    new SimplexNoise(9999);
    const after = points.map(([x, y, z]) => first.noise3D(x, y, z));
    expect(after).not.toEqual(before);
  });
});
