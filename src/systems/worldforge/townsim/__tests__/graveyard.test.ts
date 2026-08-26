/**
 * Graveyard projection tests.
 *
 * The graveyard stores nothing of its own, so these tests prove two things:
 * that it reads the sim's retained dead faithfully (relation, age, ordering),
 * and that "forgotten" agrees with the retention rule in `pruneTownState` —
 * a grave is tended exactly while a living relative still anchors the record.
 */
import { SeededRandom } from '../../../../utils/random/seededRandom';
import { buildGraveyard, gravesTendedBy, graveyardSummary } from '../graveyard';
import { advanceTownDays } from '../townSim';
import { pruneTownState } from '../townSimRegistry';
import { DAYS_PER_YEAR, RETENTION_YEARS } from '../constants';
import type { LivingVillager, TownSimState } from '../types';

function villager(p: Partial<LivingVillager> & { occupantId: number }): LivingVillager {
  return {
    name: `V${p.occupantId}`,
    race: 'Human',
    bornDay: -30 * DAYS_PER_YEAR,
    parentIds: [],
    childIds: [],
    homePlotId: 1,
    wealth: 50,
    ...p,
  };
}

function stateOf(vs: LivingVillager[], startDay = 0): TownSimState {
  const villagers: Record<number, LivingVillager> = {};
  for (const v of vs) villagers[v.occupantId] = v;
  return {
    burgId: 1,
    villagers,
    chronicle: { burgId: 1, events: [], nextEventId: 1 },
    lastSimDay: startDay,
    nextVillagerId: Math.max(...vs.map((v) => v.occupantId)) + 1,
  };
}

describe('buildGraveyard', () => {
  it('lists only the dead, newest burial first', () => {
    const s = stateOf([
      villager({ occupantId: 1, diedDay: 10 }),
      villager({ occupantId: 2, diedDay: 40 }),
      villager({ occupantId: 3 }), // alive
    ]);
    expect(buildGraveyard(s).map((g) => g.occupantId)).toEqual([2, 1]);
  });

  it('records age at death from the villager, not from the reading day', () => {
    const s = stateOf([
      villager({ occupantId: 1, bornDay: 0, diedDay: 62 * DAYS_PER_YEAR + 100 }),
    ]);
    expect(buildGraveyard(s)[0].ageAtDeath).toBe(62);
  });

  it('reads an infant death as age 0 rather than a negative age', () => {
    const s = stateOf([
      villager({ occupantId: 1, bornDay: 100, diedDay: 140, parentIds: [2] }),
      villager({ occupantId: 2, childIds: [1] }),
    ]);
    expect(buildGraveyard(s)[0].ageAtDeath).toBe(0);
  });

  it('names every living relation and orders mourners by closeness', () => {
    // Dead: 1. Living kin: spouse 2, child 3, parent 4, sibling 5, grandchild 6.
    const s = stateOf([
      villager({ occupantId: 1, diedDay: 50, spouseId: 2, childIds: [3], parentIds: [4, 9] }),
      villager({ occupantId: 2, spouseId: 1 }),
      villager({ occupantId: 3, parentIds: [1, 2], childIds: [6] }),
      villager({ occupantId: 4, childIds: [1, 5] }),
      villager({ occupantId: 5, parentIds: [4, 9] }),
      villager({ occupantId: 6, parentIds: [3] }),
      villager({ occupantId: 7, homePlotId: 8 }), // unrelated neighbor
    ]);
    const grave = buildGraveyard(s)[0];
    expect(grave.mourners.map((m) => m.relation)).toEqual([
      'spouse',
      'child',
      'parent',
      'sibling',
      'grandchild',
    ]);
    expect(grave.mourners.map((m) => m.occupantId)).toEqual([2, 3, 4, 5, 6]);
    expect(grave.forgotten).toBe(false);
    expect(grave.epitaph).toContain('Remembered by V2 (spouse)');
  });

  it('marks a grave forgotten once no living kin remain, and says so', () => {
    const s = stateOf([
      villager({ occupantId: 1, diedDay: 50, spouseId: 2 }),
      villager({ occupantId: 2, diedDay: 60, spouseId: 1 }),
      villager({ occupantId: 3, homePlotId: 9 }), // alive but unrelated
    ]);
    const graves = buildGraveyard(s);
    expect(graves.every((g) => g.forgotten)).toBe(true);
    expect(graves[0].epitaph).toContain('No kin remain');
  });

  it('names the institution a role-holder carried to the grave', () => {
    const s = stateOf([
      villager({ occupantId: 1, diedDay: 50, role: 'lord', bornDay: -70 * DAYS_PER_YEAR }),
    ]);
    expect(buildGraveyard(s)[0].epitaph).toContain('lord of this town');
  });
});

describe('gravesTendedBy', () => {
  it('returns one villager’s own dead, closest tie first', () => {
    const s = stateOf([
      villager({ occupantId: 1, diedDay: 10, spouseId: 3 }), // spouse of 3
      villager({ occupantId: 2, diedDay: 80, childIds: [3] }), // parent of 3
      villager({ occupantId: 3, spouseId: 1, parentIds: [2] }),
      villager({ occupantId: 4, diedDay: 90, homePlotId: 9 }), // stranger
    ]);
    // 4 is buried most recently but is nobody's kin, so it must not appear.
    expect(gravesTendedBy(s, 3).map((g) => g.occupantId)).toEqual([1, 2]);
    expect(gravesTendedBy(s, 4)).toEqual([]);
  });
});

describe('graveyard vs retention', () => {
  it('summary counts tended and forgotten graves', () => {
    const s = stateOf([
      villager({ occupantId: 1, diedDay: 10, childIds: [3] }),
      villager({ occupantId: 2, diedDay: 20, homePlotId: 9 }),
      villager({ occupantId: 3, parentIds: [1] }),
    ]);
    expect(graveyardSummary(s)).toEqual({ graves: 2, tended: 1, forgotten: 1 });
  });

  it('a tended grave survives pruning; a forgotten old one does not', () => {
    // Both died long before the retention cutoff. Only the one with a living
    // child is anchored, which is exactly the rule pruneTownState applies.
    const currentDay = (RETENTION_YEARS + 5) * DAYS_PER_YEAR;
    const s = stateOf([
      villager({ occupantId: 1, diedDay: 100, childIds: [3] }),
      villager({ occupantId: 2, diedDay: 100, homePlotId: 9 }),
      villager({ occupantId: 3, parentIds: [1] }),
    ]);
    expect(buildGraveyard(s).map((g) => g.occupantId).sort()).toEqual([1, 2]);

    const pruned = pruneTownState(s, currentDay);
    const kept = buildGraveyard(pruned);
    expect(kept.map((g) => g.occupantId)).toEqual([1]);
    expect(kept[0].forgotten).toBe(false);
  });

  it('fills as the sim runs: a simulated death produces a grave with mourners', () => {
    const ancient = villager({
      occupantId: 1,
      bornDay: -95 * DAYS_PER_YEAR,
      childIds: [2],
    });
    const child = villager({ occupantId: 2, bornDay: -30 * DAYS_PER_YEAR, parentIds: [1] });
    const start = stateOf([ancient, child]);
    expect(buildGraveyard(start)).toEqual([]);

    const s = advanceTownDays(start, 0, 400, new SeededRandom(42));
    const graves = buildGraveyard(s);
    expect(graves.length).toBeGreaterThan(0);
    const elder = graves.find((g) => g.occupantId === 1);
    expect(elder).toBeDefined();
    expect(elder!.mourners.some((m) => m.occupantId === 2 && m.relation === 'child')).toBe(true);
    expect(elder!.ageAtDeath).toBeGreaterThanOrEqual(95);
  });
});
