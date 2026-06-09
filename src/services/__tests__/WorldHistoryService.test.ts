import { describe, expect, it } from 'vitest';
import { WorldHistoryService, FirstBuildHistorySeed } from '../WorldHistoryService';
import { Faction } from '../../types';

function makeFaction(id: string, name: string): Faction {
  return {
    id,
    name,
    description: `${name} banner`,
    type: 'NOBLE_HOUSE',
    allies: [],
    enemies: [],
    rivals: [],
    relationships: {},
    values: [],
    hates: [],
    ranks: [],
    colors: { primary: '#000000', secondary: '#ffffff' },
    power: 50,
    assets: [],
    treasury: 0,
    taxRate: 5,
    controlledRegionIds: [],
    controlledRouteIds: [],
    economicPolicy: 'mercantile',
    tradeGoodPriorities: [],
  };
}

function seedInput(overrides: Partial<FirstBuildHistorySeed> = {}): FirstBuildHistorySeed {
  return {
    worldSeed: 20262026,
    factions: {
      houseAurum: makeFaction('houseA', 'House Aurum'),
      houseBronze: makeFaction('houseB', 'House Bronze'),
      houseCinder: makeFaction('houseC', 'House Cinder'),
    },
    settlingLocationHints: ['Northford', 'Grey Ford'],
    worldBirthTime: new Date(Date.UTC(1234, 0, 1)),
    ...overrides,
  };
}

describe('WorldHistoryService first-build history contract', () => {
  it('is deterministic for the same world seed', () => {
    const input = seedInput();
    const historyA = WorldHistoryService.createFirstBuildHistory(input);
    const historyB = WorldHistoryService.createFirstBuildHistory(input);

    expect(historyA).toEqual(historyB);
    expect(new Set(historyA.events.map(event => event.id)).size).toBe(historyA.events.length);
  });

  it('includes a seeded founding narrative when factions exist', () => {
    const history = WorldHistoryService.createFirstBuildHistory(seedInput());

    expect(history.events.map(event => event.type)).toEqual([
      'POLITICAL_SHIFT',
      'HEROIC_DEED',
      'MAJOR_BATTLE',
      'DISCOVERY',
    ]);

    expect(history.events[0]).toMatchObject({
      tags: expect.arrayContaining(['world_birth', 'founding']),
    });
    expect(history.events[0].participants).toHaveLength(2);
    expect(history.events.every(event => event.timestamp >= 450)).toBe(true);
  });

  it('falls back to a one-line discovery event when no factions are provided', () => {
    const history = WorldHistoryService.createFirstBuildHistory({
      worldSeed: 99,
      factions: {},
      worldBirthTime: new Date(Date.UTC(1234, 0, 1)),
    });

    expect(history.events).toHaveLength(1);
    expect(history.events[0].type).toBe('DISCOVERY');
    expect(history.events[0].tags).toContain('empty_faction_set');
  });

  it('does not mutate input factions', () => {
    const original = seedInput();
    const snapshot = structuredClone(original.factions);
    WorldHistoryService.createFirstBuildHistory(original);

    expect(original.factions).toEqual(snapshot);
  });
});
