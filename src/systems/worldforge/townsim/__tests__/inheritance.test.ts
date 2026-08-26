/**
 * Inheritance ladder tests: spouse > child > sibling > unrelated housemate.
 *
 * The first four cases pin each rung in isolation (pure `resolveHeirs`), the
 * split cases pin the conservation promise (shares always sum to the estate),
 * and the last case drives a real death through `advanceTownDays` so the ladder
 * is proven through the live sim path and not only through the pure helper.
 */
import { SeededRandom } from '../../../../utils/random/seededRandom';
import { resolveHeirs, splitEstate, HEIR_TIERS } from '../inheritance';
import { advanceTownDays } from '../townSim';
import { DAYS_PER_YEAR } from '../constants';
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

function table(vs: LivingVillager[]): Record<number, LivingVillager> {
  const out: Record<number, LivingVillager> = {};
  for (const v of vs) out[v.occupantId] = v;
  return out;
}

function stateOf(vs: LivingVillager[], startDay = 0): TownSimState {
  return {
    burgId: 1,
    villagers: table(vs),
    chronicle: { burgId: 1, events: [], nextEventId: 1 },
    lastSimDay: startDay,
    nextVillagerId: Math.max(...vs.map((v) => v.occupantId)) + 1,
  };
}

describe('resolveHeirs ladder', () => {
  it('exposes the ladder order it implements', () => {
    expect(HEIR_TIERS).toEqual(['spouse', 'child', 'sibling', 'housemate']);
  });

  it('a living spouse inherits ahead of the children', () => {
    const dead = villager({ occupantId: 1, diedDay: 10, spouseId: 2, childIds: [3, 4] });
    const spouse = villager({ occupantId: 2, spouseId: 1, childIds: [3, 4] });
    const kidA = villager({ occupantId: 3, parentIds: [1, 2] });
    const kidB = villager({ occupantId: 4, parentIds: [1, 2] });
    const claims = resolveHeirs(table([dead, spouse, kidA, kidB]), dead);
    expect(claims).toEqual([{ heirId: 2, tier: 'spouse' }]);
  });

  it('children inherit when the spouse is already dead, eldest first', () => {
    const dead = villager({ occupantId: 1, diedDay: 10, spouseId: 2, childIds: [3, 4] });
    const spouse = villager({ occupantId: 2, diedDay: 5, spouseId: 1 });
    const younger = villager({ occupantId: 3, parentIds: [1, 2], bornDay: -10 * DAYS_PER_YEAR });
    const elder = villager({ occupantId: 4, parentIds: [1, 2], bornDay: -20 * DAYS_PER_YEAR });
    const claims = resolveHeirs(table([dead, spouse, younger, elder]), dead);
    expect(claims).toEqual([
      { heirId: 4, tier: 'child' },
      { heirId: 3, tier: 'child' },
    ]);
  });

  it('a sibling inherits when there is no spouse and no child', () => {
    // Siblings are derived from the shared parent link, not stored.
    const dead = villager({ occupantId: 1, diedDay: 10, parentIds: [9] });
    const sibling = villager({ occupantId: 2, parentIds: [9] });
    const stranger = villager({ occupantId: 3, parentIds: [8], homePlotId: 7 });
    const claims = resolveHeirs(table([dead, sibling, stranger]), dead);
    expect(claims).toEqual([{ heirId: 2, tier: 'sibling' }]);
  });

  it('an unrelated housemate is the last rung before the estate is lost', () => {
    const dead = villager({ occupantId: 1, diedDay: 10, homePlotId: 4 });
    const lodger = villager({ occupantId: 2, homePlotId: 4 });
    const neighbor = villager({ occupantId: 3, homePlotId: 5 });
    const claims = resolveHeirs(table([dead, lodger, neighbor]), dead);
    expect(claims).toEqual([{ heirId: 2, tier: 'housemate' }]);
  });

  it('skips dead relatives at every rung and reports no heir for an empty house', () => {
    const dead = villager({ occupantId: 1, diedDay: 10, spouseId: 2, childIds: [3], parentIds: [9] });
    const spouse = villager({ occupantId: 2, diedDay: 4, spouseId: 1 });
    const child = villager({ occupantId: 3, diedDay: 6, parentIds: [1, 2] });
    const sibling = villager({ occupantId: 4, diedDay: 2, parentIds: [9] });
    expect(resolveHeirs(table([dead, spouse, child, sibling]), dead)).toEqual([]);
  });
});

describe('splitEstate', () => {
  it('splits evenly and hands the remainder out in claim order', () => {
    expect(splitEstate(100, 3)).toEqual([34, 33, 33]);
    expect(splitEstate(9, 3)).toEqual([3, 3, 3]);
    expect(splitEstate(0, 2)).toEqual([0, 0]);
    expect(splitEstate(5, 0)).toEqual([]);
  });

  it('never creates or destroys wealth', () => {
    for (const amount of [1, 7, 50, 101, 999]) {
      for (const count of [1, 2, 3, 4, 6]) {
        expect(splitEstate(amount, count).reduce((a, b) => a + b, 0)).toBe(amount);
      }
    }
  });
});

describe('inheritance through the live sim', () => {
  it('a childless widower leaves his estate to his brother, not the void', () => {
    // Regression: before the ladder existed this estate evaporated, because the
    // old rule only knew about children and a living spouse.
    const ancient = villager({
      occupantId: 1,
      bornDay: -95 * DAYS_PER_YEAR,
      parentIds: [9],
      wealth: 120,
    });
    const brother = villager({
      occupantId: 2,
      bornDay: -40 * DAYS_PER_YEAR,
      parentIds: [9],
      wealth: 10,
    });
    const parent = villager({ occupantId: 9, diedDay: -1, childIds: [1, 2] });
    const before = 120 + 10;

    const s = advanceTownDays(stateOf([ancient, brother, parent]), 0, 400, new SeededRandom(42));

    expect(s.villagers[1].diedDay).toBeDefined();
    expect(s.villagers[1].wealth).toBe(0);
    // The brother is the only living kin, so the whole estate lands on him.
    // (Sim wealth can also drift from other rules, so assert the floor.)
    expect(s.villagers[2].wealth).toBeGreaterThanOrEqual(before);
    const inheritance = s.chronicle.events.filter((e) => e.kind === 'inheritance');
    expect(inheritance.length).toBeGreaterThan(0);
    expect(inheritance[0].subjectId).toBe(2);
    expect(inheritance[0].relatedIds).toContain(1);
  });
});
