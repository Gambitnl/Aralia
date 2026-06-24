import { describe, it, expect } from 'vitest';
import { rollTravelEncounter } from '../travelEncounter';
import type { RoutePlan } from '../routePlanning';
import { rootSeedPath } from '../../worldforge/seedPath';

const seed = rootSeedPath(42);
const route = (cells: number[], danger: number): RoutePlan => ({
  cells, points: cells.map((c) => [c, 0] as [number, number]), miles: cells.length, minutes: cells.length * 20, danger,
});

describe('rollTravelEncounter', () => {
  it('a zero-length / single-cell trip never has an encounter', () => {
    const r = rollTravelEncounter(route([5], 0.9), seed);
    expect(r.encounter).toBe(false);
    expect(r.chance).toBe(0);
  });

  it('chance rises with danger and route length', () => {
    const shortSafe = rollTravelEncounter(route([0, 1, 2], 0.1), seed).chance;
    const longDangerous = rollTravelEncounter(route(Array.from({ length: 60 }, (_, i) => i), 0.6), seed).chance;
    expect(longDangerous).toBeGreaterThan(shortSafe);
    expect(longDangerous).toBeLessThanOrEqual(0.95);
  });

  it('is deterministic for the same route + seed', () => {
    const a = rollTravelEncounter(route([0, 1, 2, 3, 4], 0.5), seed);
    const b = rollTravelEncounter(route([0, 1, 2, 3, 4], 0.5), seed);
    expect(a).toEqual(b);
  });

  it('when an encounter fires, it is placed along the route (not the start)', () => {
    // A long, very dangerous route makes an encounter near-certain.
    const r = rollTravelEncounter(route(Array.from({ length: 80 }, (_, i) => i), 0.9), seed);
    expect(r.encounter).toBe(true);
    expect(r.atCellIndex).not.toBeNull();
    expect(r.atCellIndex!).toBeGreaterThanOrEqual(1);
    expect(r.atCellIndex!).toBeLessThanOrEqual(79);
  });
});
