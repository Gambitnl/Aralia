import { describe, it, expect } from 'vitest';
import { reachableCellsByBurn, burnWeightedDayField } from '../provisionReach';
import type { TravelTerrain } from '../../../types/travel';

/**
 * E2: the reach horizon must account for terrain burn — harsh ground consumes
 * more supply per travel-day, so a cell reached through difficult terrain costs
 * more "resource-days" than its raw travel time implies, shrinking the ring.
 *
 * Synthetic shortest-path field: a chain origin(0) → 1 → 2 → 3, one travel-day
 * per hop (1440 min each). prev points each cell back toward the origin.
 */
const DAY = 1440;
function chainField() {
  return {
    origin: 0,
    dist: new Map<number, number>([[0, 0], [1, DAY], [2, 2 * DAY], [3, 3 * DAY]]),
    prev: new Map<number, number>([[1, 0], [2, 1], [3, 2]]),
  };
}

describe('burnWeightedDayField', () => {
  it('accumulates one resource-day per open-terrain hop', () => {
    const f = burnWeightedDayField({ ...chainField(), terrainOf: () => 'open' as TravelTerrain, resource: 'food' });
    expect(f.get(0)).toBe(0);
    expect(f.get(1)).toBeCloseTo(1, 5);
    expect(f.get(3)).toBeCloseTo(3, 5);
  });

  it('charges difficult terrain at its higher burn factor (food 1.5×)', () => {
    // cell 2 sits in difficult terrain → its hop costs 1.5 days, not 1.
    const terrainOf = (c: number): TravelTerrain => (c === 2 ? 'difficult' : 'open');
    const f = burnWeightedDayField({ ...chainField(), terrainOf, resource: 'food' });
    expect(f.get(1)).toBeCloseTo(1, 5);
    expect(f.get(2)).toBeCloseTo(2.5, 5); // 1 + 1.5
    expect(f.get(3)).toBeCloseTo(3.5, 5); // 2.5 + 1
  });
});

describe('reachableCellsByBurn', () => {
  it('includes cells whose burn-weighted cost is within the per-consumer budget', () => {
    const cells = reachableCellsByBurn({
      ...chainField(),
      terrainOf: () => 'open' as TravelTerrain,
      resource: 'food',
      maxBurnDays: 2,
    });
    expect(new Set(cells)).toEqual(new Set([0, 1, 2]));
  });

  it('excludes a cell pushed over budget by difficult terrain', () => {
    const terrainOf = (c: number): TravelTerrain => (c === 2 ? 'difficult' : 'open');
    const cells = reachableCellsByBurn({ ...chainField(), terrainOf, resource: 'food', maxBurnDays: 2 });
    // cell 2 now costs 2.5 > 2 → only origin + cell 1 remain in range.
    expect(new Set(cells)).toEqual(new Set([0, 1]));
  });

  it('returns an empty set for a non-positive budget', () => {
    const cells = reachableCellsByBurn({
      ...chainField(),
      terrainOf: () => 'open' as TravelTerrain,
      resource: 'food',
      maxBurnDays: 0,
    });
    // Only the origin (cost 0) qualifies at budget 0.
    expect(cells).toEqual([0]);
  });
});
