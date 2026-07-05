import { describe, it, expect } from 'vitest';
import { pickTravelEncounterMonsters } from '../travelEncounterMonsters';
import type { RoutePlan } from '../routePlanning';
import { rootSeedPath } from '../../worldforge/seedPath';

const route = (cells: number[], danger: number): RoutePlan =>
  ({ cells, danger } as unknown as RoutePlan);

const seed = rootSeedPath(12345);

describe('pickTravelEncounterMonsters', () => {
  it('returns a valid, non-empty monster group', () => {
    const group = pickTravelEncounterMonsters(route([0, 1, 2, 3], 0.5), seed);
    expect(group.length).toBeGreaterThan(0);
    for (const m of group) {
      expect(m.name).toBeTruthy();
      expect(m.cr).toBeTruthy();
      expect(m.quantity).toBeGreaterThanOrEqual(1);
      expect(m.quantity).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic for the same trip', () => {
    const a = pickTravelEncounterMonsters(route([0, 1, 2, 3, 4], 0.6), seed);
    const b = pickTravelEncounterMonsters(route([0, 1, 2, 3, 4], 0.6), seed);
    expect(a).toEqual(b);
  });

  it('caps the group so an early party can win even on a dangerous road', () => {
    const group = pickTravelEncounterMonsters(route(Array.from({ length: 40 }, (_, i) => i), 1), seed);
    const total = group.reduce((n, m) => n + m.quantity, 0);
    expect(total).toBeLessThanOrEqual(3);
  });
});
