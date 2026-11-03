/**
 * This file tests `WorldHistoryService` (`src/services/WorldHistoryService.ts`).
 *
 * It verifies deterministic first-build world history seeding and directional
 * skirmish importance derivation (`upset > even fight > expected rout` across
 * the full `20..100` band, GG-172).
 *
 * Called by: Vitest test runner.
 * Depends on: `WorldHistoryService` and `Faction` types.
 */
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

describe('WorldHistoryService.createSkirmishEvent importance', () => {
  const gameTime = new Date(Date.UTC(1234, 0, 1));

  function withPower(id: string, name: string, power: number): Faction {
    return { ...makeFaction(id, name), power };
  }

  // ============================================================================
  // Skirmish Importance Directional Curve (GG-172)
  // ============================================================================
  // Verifies `importance = clamp(20, 100, Math.round(40 + (loserPower - winnerPower)))`
  // so that upsets score higher than even matches, which score higher than expected routs,
  // and that the floor (20) is reached on expected routs.
  // ============================================================================

  it('orders importance as upset > even fight > expected rout', () => {
    const evenMatch = WorldHistoryService.createSkirmishEvent(
      withPower('a', 'House Even A', 50),
      withPower('b', 'House Even B', 50),
      gameTime,
    );
    const upset = WorldHistoryService.createSkirmishEvent(
      withPower('c', 'House Ember', 5),
      withPower('d', 'House Titan', 95),
      gameTime,
    );
    const expectedRout = WorldHistoryService.createSkirmishEvent(
      withPower('c', 'House Titan', 95),
      withPower('d', 'House Ember', 5),
      gameTime,
    );

    expect(upset.importance).toBeGreaterThan(evenMatch.importance);
    expect(evenMatch.importance).toBeGreaterThan(expectedRout.importance);
  });

  it('marks a major upset as high importance for the retention pruner', () => {
    const upset = WorldHistoryService.createSkirmishEvent(
      withPower('e', 'House Underdog', 20),
      withPower('f', 'House Dominant', 90),
      gameTime,
    );

    // history G5 acceptance: major upsets should survive importance-aware pruning.
    expect(upset.importance).toBeGreaterThanOrEqual(80);
  });

  it('keeps a near-even clash close to the base importance', () => {
    const evenMatch = WorldHistoryService.createSkirmishEvent(
      withPower('g', 'House Mirror A', 40),
      withPower('h', 'House Mirror B', 40),
      gameTime,
    );

    expect(evenMatch.importance).toBe(40);
  });

  it('clamps importance to the sane upper band on a total upset', () => {
    const upset = WorldHistoryService.createSkirmishEvent(
      withPower('i', 'House Ashes', 0),
      withPower('j', 'House Apex', 100),
      gameTime,
    );

    expect(upset.importance).toBe(100);
  });

  // Pins the directional mapping:
  //   importance = clamp(20, 100, Math.round(40 + (loserPower - winnerPower)))
  it.each([
    // [winner power, loser power, expected importance, battle outcome]
    [90, 20, 20, 'decisive expected rout (reaches the 20 floor)'],
    [55, 45, 30, 'expected win with slight edge'],
    [50, 50, 40, 'perfectly even trade of blows'],
    [45, 55, 50, 'slight upset'],
    [35, 60, 65, 'clear upset'],
    [20, 80, 100, 'decisive upset (lands exactly on the ceiling)'],
    [0, 100, 100, 'total upset (clamped at the ceiling)'],
  ])(
    'scores a %i vs %i skirmish at importance %i (%s)',
    (winnerPower, loserPower, expected) => {
      const event = WorldHistoryService.createSkirmishEvent(
        withPower('w', 'House Victor', winnerPower as number),
        withPower('l', 'House Vanquished', loserPower as number),
        gameTime,
      );

      expect(event.importance).toBe(expected);
    },
  );

  it('reaches and never scores below the documented importance floor (20)', () => {
    for (const [winnerPower, loserPower] of [[0, 0], [1, 0], [100, 0], [0, 100], [100, 100]]) {
      const event = WorldHistoryService.createSkirmishEvent(
        withPower('w', 'House Victor', winnerPower),
        withPower('l', 'House Vanquished', loserPower),
        gameTime,
      );

      expect(event.importance).toBeGreaterThanOrEqual(20);
      expect(event.importance).toBeLessThanOrEqual(100);
      expect(Number.isInteger(event.importance)).toBe(true);
    }

    const floorRout = WorldHistoryService.createSkirmishEvent(
      withPower('w', 'House Victor', 80),
      withPower('l', 'House Vanquished', 20),
      gameTime,
    );
    expect(floorRout.importance).toBe(20);
  });

  it('scores an upset higher than the mirrored expected rout (GG-172)', () => {
    const upset = WorldHistoryService.createSkirmishEvent(
      withPower('u1', 'House Underdog', 20),
      withPower('u2', 'House Toppled', 90),
      gameTime,
    );
    const rout = WorldHistoryService.createSkirmishEvent(
      withPower('r1', 'House Toppled', 90),
      withPower('r2', 'House Underdog', 20),
      gameTime,
    );

    expect(upset.importance).toBe(100);
    expect(rout.importance).toBe(20);
    expect(upset.importance).toBeGreaterThan(rout.importance);
  });

  it('falls back to the base importance when power is not a usable number', () => {
    // Defensive branch in deriveSkirmishImportance: Faction.power is typed
    // required, but save migrations and hand-authored faction data have shipped
    // undefined/NaN before, and a NaN importance would poison the pruner's sort.
    const missingPower = { ...makeFaction('m', 'House Unknown') } as Faction;
    delete (missingPower as Partial<Faction>).power;
    const nanPower = { ...makeFaction('n', 'House Broken'), power: Number.NaN };

    const fromMissing = WorldHistoryService.createSkirmishEvent(
      missingPower,
      withPower('o', 'House Ordinary', 50),
      gameTime,
    );
    const fromNaN = WorldHistoryService.createSkirmishEvent(
      withPower('p', 'House Ordinary', 50),
      nanPower,
      gameTime,
    );

    expect(fromMissing.importance).toBe(40);
    expect(fromNaN.importance).toBe(40);
  });

  it('records the skirmish as a MAJOR_BATTLE with both combatants tagged', () => {
    // Importance is only useful to the pruner alongside the event shape it
    // rides on; pin the fields the history ledger and its filters read.
    const event = WorldHistoryService.createSkirmishEvent(
      withPower('v', 'House Victor', 30),
      withPower('x', 'House Vanquished', 70),
      gameTime,
    );

    expect(event.type).toBe('MAJOR_BATTLE');
    expect(event.importance).toBe(80);
    expect(event.participants.map(participant => participant.role)).toEqual([
      'instigator',
      'victim',
    ]);
    expect(event.tags).toEqual(expect.arrayContaining(['war', 'faction_conflict', 'v', 'x']));
  });
});
