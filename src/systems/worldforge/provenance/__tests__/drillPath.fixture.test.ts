/**
 * @file Sanity test for the golden drill-path fixture: confirms it drills a
 * settlement cell into a populated ground world and is deterministic.
 */
import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';

describe('golden drill path fixture', () => {
  it('drills a settlement cell into a ground world with a town', () => {
    const path = buildGoldenDrillPath();
    expect(path.burgId).toBeGreaterThan(0);
    expect(path.cellId).toBeGreaterThanOrEqual(0);
    expect(path.ground.towns.length).toBeGreaterThan(0);
    expect(path.ground.buildings.length).toBeGreaterThan(0);
  }, 30_000); // first test pays the full drill-path fixture build

  it('is deterministic across two builds', () => {
    const a = buildGoldenDrillPath();
    const b = buildGoldenDrillPath();
    expect(b.cellId).toBe(a.cellId);
    expect(b.burgId).toBe(a.burgId);
    expect(b.biomeIdUsed).toBe(a.biomeIdUsed);
    expect(b.ground.buildings.length).toBe(a.ground.buildings.length);
    expect(b.ground.towns).toEqual(a.ground.towns);
  });
});
