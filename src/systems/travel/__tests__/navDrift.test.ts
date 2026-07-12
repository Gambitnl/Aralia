import { describe, it, expect } from 'vitest';
import { SeededRandom } from '@/utils/random';
import { deriveNavDrift, bearingToDirection } from '../navDrift';

// A straight due-East route across four cells; geometry gives an 'E' intended heading.
const CELLS = [0, 1, 2, 3];
const POINTS: Array<[number, number]> = [[0, 0], [10, 0], [20, 0], [30, 0]];
// Nav-info fns matching the DC ladder: off-road difficult 15, off-road open 5, maintained 0.
const allDifficult = () => ({ dc: 15, cause: 'wilds' as const });
const allOpen = () => ({ dc: 5, cause: 'wilds' as const });
const allRoad = () => ({ dc: 0, cause: 'road' as const });

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
      // route grades to DC 0, so deriveNavDrift is exempt and never rolls.
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
    // −30 survival guarantees the check fails DC 5 (off-road open) → the party is lost.
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
    expect(a).toEqual({ lost: true, driftDirection: 'S', extraSeconds: 18000, cause: 'wilds' });
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

// Governing-DC rule: a mostly-road route with one difficult cell is still
// exposed to getting lost at the difficult stretch (roads don't shield the whole
// leg — only an ALL-maintained route is exempt).
describe('deriveNavDrift — governing DC is the worst cell crossed', () => {
  it('one off-road difficult cell makes an otherwise-road route roll (and here, lost)', () => {
    const mixed = (c: number) => (c === 2 ? allDifficult() : allRoad());
    const r = deriveNavDrift(mixed, CELLS, POINTS, -30, new SeededRandom(42));
    expect(r).toBeDefined();
    expect(r!.lost).toBe(true);
    expect(r!.cause).toBe('wilds');
  });
});

const pts: Array<[number, number]> = [[0, 0], [10, 0]];
const info = (dc: number, cause: 'road' | 'wilds' | 'faint-path') => () => ({ dc, cause });

describe('deriveNavDrift DC ladder (faint forest paths)', () => {
  it('never rolls on maintained routes (dc 0 auto-success)', () => {
    // Any rng: dc 0 must short-circuit before consuming randomness.
    expect(deriveNavDrift(info(0, 'road'), [1, 2], pts, -5, new SeededRandom(1))).toBeUndefined();
  });
  it('governs by the WORST cell: one overgrown path cell forces DC 12', () => {
    const navInfo = (cell: number) =>
      cell === 2 ? { dc: 12 as const, cause: 'faint-path' as const } : { dc: 0 as const, cause: 'road' as const };
    // Find a seed that rolls low enough to fail DC 12 with +0 Survival:
    // seed 3 → first nextInt(1,21) is deterministic; scan a few seeds in the test.
    let sawLost = false;
    for (let seed = 1; seed <= 40 && !sawLost; seed++) {
      const drift = deriveNavDrift(navInfo, [1, 2, 3], pts, 0, new SeededRandom(seed));
      if (drift) {
        sawLost = true;
        expect(drift.cause).toBe('faint-path');
        expect(drift.extraSeconds).toBeGreaterThanOrEqual(3600);
        expect(drift.extraSeconds).toBeLessThanOrEqual(6 * 3600);
      }
    }
    expect(sawLost).toBe(true); // DC 12 with +0 must fail for SOME seed in 40
  });
  it('a high Survival modifier keeps the party found on the same seeds', () => {
    const navInfo = info(8, 'faint-path');
    for (let seed = 1; seed <= 40; seed++) {
      // +19 makes 1+19 = 20 ≥ 8: can never fail.
      expect(deriveNavDrift(navInfo, [1, 2], pts, 19, new SeededRandom(seed))).toBeUndefined();
    }
  });
});
