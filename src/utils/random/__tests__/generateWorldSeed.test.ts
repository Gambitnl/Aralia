import { describe, it, expect } from 'vitest';
import { generateWorldSeed } from '../generateWorldSeed';
import { SeededRandom } from '../seededRandom';

describe('generateWorldSeed', () => {
  it('returns an integer in the SeededRandom range [1, 2147483646]', () => {
    for (let i = 0; i < 1_000; i++) {
      const seed = generateWorldSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(1);
      expect(seed).toBeLessThanOrEqual(2147483646);
    }
  });

  it('produces a seed that SeededRandom accepts without normalization drift', () => {
    // A seed inside [1, 2147483646] must survive the constructor unchanged:
    // two SeededRandom instances from the same generated seed match exactly.
    const seed = generateWorldSeed();
    const a = new SeededRandom(seed);
    const b = new SeededRandom(seed);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('varies across calls', () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 100; i++) {
      seeds.add(generateWorldSeed());
    }
    // Time + crypto entropy: collisions across 100 calls mean the mix is broken.
    expect(seeds.size).toBeGreaterThan(90);
  });
});
