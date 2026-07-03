import { describe, it, expect } from 'vitest';
import { buildGoldenDrillPath } from './fixtures/drillPath';
import { readWorldCell } from '../worldCell';
import { classifyTerrainBiome, classifyTownsAndBuildings } from '../groundProvenance';

describe('terrain-biome provenance', () => {
  it('marks terrain inherited when the submap biome equals the cell biome', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    const v = classifyTerrainBiome(facts, path.biomeIdUsed);
    expect(v.kind).toBe('terrain-biome');
    expect(v.state).toBe('inherited');
    expect(v.severity).toBe('ok');
  }, 30_000); // first test pays the full drill-path fixture build

  it('marks terrain orphaned when the submap biome differs from the cell biome', () => {
    const path = buildGoldenDrillPath();
    const facts = readWorldCell(path.pack, path.cellId);
    const wrong = facts.biomeId + 99;
    const v = classifyTerrainBiome(facts, wrong);
    expect(v.state).toBe('orphaned');
    expect(v.severity).toBe('fail');
  });
});

describe('town/building provenance', () => {
  it('marks the town inherited and each building elaborated', () => {
    const path = buildGoldenDrillPath();
    const verdicts = classifyTownsAndBuildings(path.burgId, path.ground);
    const town = verdicts.find((v) => v.kind === 'town');
    expect(town?.state).toBe('inherited');
    const buildings = verdicts.filter((v) => v.kind === 'building');
    expect(buildings.length).toBe(path.ground.buildings.length);
    expect(buildings.every((b) => b.state === 'elaborated')).toBe(true);
    expect(buildings.every((b) => b.severity === 'ok')).toBe(true);
  });
});
