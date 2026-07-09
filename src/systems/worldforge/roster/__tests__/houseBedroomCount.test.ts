/**
 * Regression: household capacity must count bedrooms on EVERY floor, not just
 * the ground floor. The legacy InteriorPlan splits floors — ground in `rooms`,
 * upper storeys in `upperFloors[]` — and the building generator puts most
 * bedrooms upstairs in multi-storey houses. Counting `rooms` alone sized
 * multi-storey households far below the beds the house was built and later
 * populated with (e.g. a 2-storey house with an empty ground floor was capped
 * at one resident despite a full upstairs of bedrooms).
 */

import { describe, expect, it } from 'vitest';
import { generateInterior, type InteriorPlotInput } from '../../interior/generateInterior';
import { rootSeedPath } from '../../seedPath';
import { houseBedroomCount } from '../generateTownRoster';

const SEED = rootSeedPath(42);

function house(id: number, storeys: number): InteriorPlotInput {
  return {
    id,
    footprint: [
      [1000, 2000],
      [1060, 2000],
      [1060, 2045],
      [1000, 2045],
    ],
    role: 'house',
    storeys,
  };
}

function groundOnlyBedrooms(id: number, storeys: number): number {
  return generateInterior(house(id, storeys), SEED).rooms.filter(
    (room) => room.role === 'bedroom',
  ).length;
}

describe('houseBedroomCount', () => {
  it('counts ground + every upper floor', () => {
    const plan = generateInterior(house(0, 2), SEED);
    const ground = plan.rooms.filter((r) => r.role === 'bedroom').length;
    const upper = plan.upperFloors.reduce(
      (n, f) => n + f.rooms.filter((r) => r.role === 'bedroom').length,
      0,
    );
    expect(houseBedroomCount(plan)).toBe(ground + upper);
  });

  it('single-storey houses are unaffected (no upper floors)', () => {
    const plan = generateInterior(house(3, 1), SEED);
    expect(houseBedroomCount(plan)).toBe(groundOnlyBedrooms(3, 1));
  });

  it('counts upstairs bedrooms that the ground-floor-only count misses', () => {
    // Prove the old bug is closed: at least one multi-storey house has more
    // total bedrooms than its ground floor alone reports.
    let sawUpstairsMiss = false;
    for (let id = 0; id < 6; id++) {
      const plan = generateInterior(house(id, 2), SEED);
      if (houseBedroomCount(plan) > groundOnlyBedrooms(id, 2)) {
        sawUpstairsMiss = true;
      }
      // Total is always at least the ground-floor count.
      expect(houseBedroomCount(plan)).toBeGreaterThanOrEqual(groundOnlyBedrooms(id, 2));
    }
    expect(sawUpstairsMiss).toBe(true);
  });
});
