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

  it('scales importance with the power swing between combatants', () => {
    const evenMatch = WorldHistoryService.createSkirmishEvent(
      withPower('a', 'House Even A', 50),
      withPower('b', 'House Even B', 48),
      gameTime,
    );
    const lopsided = WorldHistoryService.createSkirmishEvent(
      withPower('c', 'House Titan', 95),
      withPower('d', 'House Ember', 5),
      gameTime,
    );

    // High-disparity clash must register as more memorable than an even trade.
    expect(lopsided.importance).toBeGreaterThan(evenMatch.importance);
  });

  it('marks a major power swing as high importance for the retention pruner', () => {
    // Renamed from "upset": the winner here is the STRONGER faction (90 vs 20),
    // so this is a rout, not an upset. The old name implied the formula reads
    // the direction of the swing, which it does not (see the symmetry test).
    const rout = WorldHistoryService.createSkirmishEvent(
      withPower('e', 'House Dominant', 90),
      withPower('f', 'House Fallen', 20),
      gameTime,
    );

    // history G5 acceptance: major swings should survive importance-aware pruning.
    expect(rout.importance).toBeGreaterThanOrEqual(80);
  });

  it('keeps a near-even clash close to the base importance', () => {
    const evenMatch = WorldHistoryService.createSkirmishEvent(
      withPower('g', 'House Mirror A', 40),
      withPower('h', 'House Mirror B', 40),
      gameTime,
    );

    expect(evenMatch.importance).toBe(40);
  });

  it('clamps importance to the sane upper band on a total mismatch', () => {
    const rout = WorldHistoryService.createSkirmishEvent(
      withPower('i', 'House Apex', 100),
      withPower('j', 'House Ashes', 0),
      gameTime,
    );

    expect(rout.importance).toBeLessThanOrEqual(100);
    expect(rout.importance).toBeGreaterThanOrEqual(80);
  });

  // HIST-3 verification: the pre-existing tests only pinned inequalities and a
  // single exact value, so the formula could have drifted anywhere inside the
  // band without failing. These cases pin the whole documented mapping
  // (importance = clamp(20, 100, base 40 + |winnerPower - loserPower|)) so a
  // later tweak to the curve has to be a deliberate, visible edit.
  it.each([
    // [winner power, loser power, expected importance, battle outcome]
    [50, 50, 40, 'perfectly even trade of blows'],
    [55, 45, 50, 'slight edge'],
    [60, 35, 65, 'clear advantage'],
    [80, 20, 100, 'decisive rout (lands exactly on the ceiling)'],
    [100, 0, 100, 'total mismatch (clamped at the ceiling)'],
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

  it('never scores below the documented importance floor', () => {
    // The floor (20) is currently unreachable because base is 40 and disparity
    // is non-negative. Preserved as a guard so a future curve that can subtract
    // (e.g. a "mundane border scuffle" penalty) still cannot produce a value
    // the retention pruner would treat as noise-tier or negative.
    for (const [winnerPower, loserPower] of [[0, 0], [1, 0], [0, 100], [100, 100]]) {
      const event = WorldHistoryService.createSkirmishEvent(
        withPower('w', 'House Victor', winnerPower),
        withPower('l', 'House Vanquished', loserPower),
        gameTime,
      );

      expect(event.importance).toBeGreaterThanOrEqual(20);
      expect(event.importance).toBeLessThanOrEqual(100);
      expect(Number.isInteger(event.importance)).toBe(true);
    }
  });

  it('scores an upset the same as the mirrored rout (known formula limitation)', () => {
    // The formula reads the MAGNITUDE of the power gap, not its direction, so a
    // weak faction toppling a strong one is currently indistinguishable from
    // the strong faction winning as expected. Pinned deliberately: this records
    // present behavior rather than endorsing it, so if outcome-direction
    // weighting is added later this test fails and forces the intent to be
    // restated instead of silently changing the ledger.
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

    expect(upset.importance).toBe(rout.importance);
    expect(upset.importance).toBe(100);
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
      withPower('v', 'House Victor', 70),
      withPower('x', 'House Vanquished', 30),
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
