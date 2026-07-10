import { describe, it, expect } from 'vitest';
import { SeededRandom } from '@/utils/random';
import { deriveNavDrift, bearingToDirection } from '../navDrift';
import type { TravelTerrain } from '../../../types/travel';

// A straight due-East route across four cells; geometry gives an 'E' intended heading.
const CELLS = [0, 1, 2, 3];
const POINTS: Array<[number, number]> = [[0, 0], [10, 0], [20, 0], [30, 0]];
const allDifficult = (): TravelTerrain => 'difficult';
const allOpen = (): TravelTerrain => 'open';
const allRoad = (): TravelTerrain => 'road';

describe('bearingToDirection (graph space, y grows down)', () => {
  it('maps the cardinal + diagonal headings', () => {
    expect(bearingToDirection(10, 0)).toBe('E');
    expect(bearingToDirection(-10, 0)).toBe('W');
    expect(bearingToDirection(0, -10)).toBe('N'); // −y is north
    expect(bearingToDirection(0, 10)).toBe('S');
    expect(bearingToDirection(10, -10)).toBe('NE');
    expect(bearingToDirection(10, 10)).toBe('SE');
    expect(bearingToDirection(-10, -10)).toBe('NW');
    expect(bearingToDirection(-10, 10)).toBe('SW');
  });
  it('defaults a zero-length route to N without NaN', () => {
    expect(bearingToDirection(0, 0)).toBe('N');
  });
});

describe('deriveNavDrift — road exemption', () => {
  it('never gets lost on a road, for any seed (DMG: roads are exempt)', () => {
    for (const seed of [1, 2, 3, 7, 42, 100, 999]) {
      // A very low survival modifier would fail any real check — but an all-road
      // route yields terrain DC 0, so checkNavigation auto-succeeds regardless.
      const r = deriveNavDrift(allRoad, CELLS, POINTS, -30, new SeededRandom(seed));
      expect(r).toBeUndefined();
    }
  });
});

describe('deriveNavDrift — successful navigation adds no penalty', () => {
  it('returns undefined when the Survival check clears the DC', () => {
    // +30 survival guarantees a d20 roll beats the difficult-terrain DC 15.
    for (const seed of [1, 2, 3, 7, 42, 100]) {
      const r = deriveNavDrift(allDifficult, CELLS, POINTS, 30, new SeededRandom(seed));
      expect(r).toBeUndefined();
    }
  });
});

describe('deriveNavDrift — getting lost (deterministic)', () => {
  it('a failed check drifts a WRONG direction and costs 1..6 hours', () => {
    // −30 survival guarantees the check fails DC 15 (open) → the party is lost.
    const r = deriveNavDrift(allOpen, CELLS, POINTS, -30, new SeededRandom(42));
    expect(r).toBeDefined();
    expect(r!.lost).toBe(true);
    // Drift is never the intended heading (E).
    expect(r!.driftDirection).not.toBe('E');
    // DMG time cost is a true 1d6: 1..6 whole hours (nextInt(1,7) is max-exclusive).
    expect(r!.extraSeconds % 3600).toBe(0);
    expect(r!.extraSeconds).toBeGreaterThanOrEqual(3600);
    expect(r!.extraSeconds).toBeLessThanOrEqual(6 * 3600);
  });

  it('is fully deterministic: the same seed reproduces the same drift + penalty', () => {
    const a = deriveNavDrift(allDifficult, CELLS, POINTS, -30, new SeededRandom(42));
    const b = deriveNavDrift(allDifficult, CELLS, POINTS, -30, new SeededRandom(42));
    expect(a).toEqual(b);
    // Pinned regression: seed 42 on difficult terrain (E heading) drifts South,
    // 5 hours lost. A change here means the seeding or roll wiring shifted.
    expect(a).toEqual({ lost: true, driftDirection: 'S', extraSeconds: 18000 });
  });

  it('different seeds can produce different drifts (RNG is actually consumed)', () => {
    const seen = new Set<string>();
    for (const seed of [1, 5, 11, 23, 42, 77, 128, 256, 512, 1024]) {
      const r = deriveNavDrift(allDifficult, CELLS, POINTS, -30, new SeededRandom(seed));
      expect(r).toBeDefined();
      seen.add(`${r!.driftDirection}:${r!.extraSeconds}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

// Governing-terrain rule: a mostly-road route with one difficult cell is still
// exposed to getting lost at the difficult stretch (roads don't shield the whole
// leg — only an ALL-road route is exempt).
describe('deriveNavDrift — governing terrain is the hardest crossed', () => {
  it('one off-road difficult cell makes an otherwise-road route roll (and here, lost)', () => {
    const mixed = (c: number): TravelTerrain => (c === 2 ? 'difficult' : 'road');
    const r = deriveNavDrift(mixed, CELLS, POINTS, -30, new SeededRandom(42));
    expect(r).toBeDefined();
    expect(r!.lost).toBe(true);
  });
});
