import { advanceRegistry, advanceTown, ensureTown, type TownSimRegistry } from '../townSimRegistry';
import type { TownSimState, LivingVillager } from '../types';
import { DAYS_PER_YEAR } from '../constants';

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

function townState(burgId: number, vs: LivingVillager[]): TownSimState {
  const villagers: Record<number, LivingVillager> = {};
  for (const v of vs) villagers[v.occupantId] = v;
  return {
    burgId,
    villagers,
    chronicle: { burgId, events: [], nextEventId: 1 },
    lastSimDay: 0,
    nextVillagerId: Math.max(...vs.map((v) => v.occupantId)) + 1,
  };
}

describe('advanceTown / advanceRegistry', () => {
  it('advances a town up to the target day', () => {
    const reg: TownSimRegistry = {
      7: townState(7, [villager({ occupantId: 1, spouseId: 2 }), villager({ occupantId: 2, spouseId: 1 })]),
    };
    const out = advanceRegistry(reg, 123, 200);
    expect(out[7].lastSimDay).toBe(200);
  });

  it('is chunking-independent: one big advance == several small ones', () => {
    const make = (): TownSimRegistry => ({
      7: townState(7, [
        villager({ occupantId: 1, bornDay: -28 * DAYS_PER_YEAR, spouseId: 2 }),
        villager({ occupantId: 2, bornDay: -27 * DAYS_PER_YEAR, spouseId: 1 }),
        villager({ occupantId: 3, bornDay: -90 * DAYS_PER_YEAR, role: 'lord', childIds: [1] }),
      ]),
    });
    const oneShot = advanceRegistry(make(), 999, 365);
    let stepped = make();
    for (const target of [50, 120, 200, 300, 365]) stepped = advanceRegistry(stepped, 999, target);
    expect(JSON.stringify(stepped)).toBe(JSON.stringify(oneShot));
  });

  it('an empty registry advances to an empty registry', () => {
    expect(advanceRegistry({}, 1, 1000)).toEqual({});
  });

  it('advanceTown is a no-op when already at/after target', () => {
    const s = townState(7, [villager({ occupantId: 1 })]);
    const advanced = advanceTown(s, 1, 100);
    const again = advanceTown(advanced, 1, 100);
    expect(JSON.stringify(again)).toBe(JSON.stringify(advanced));
  });
});

describe('ensureTown', () => {
  it('adds an absent town and is idempotent for a present one', () => {
    let reg: TownSimRegistry = {};
    const init = () => townState(5, [villager({ occupantId: 1 })]);
    reg = ensureTown(reg, 5, init);
    expect(reg[5]).toBeDefined();
    const same = ensureTown(reg, 5, () => {
      throw new Error('init should not be called for a present town');
    });
    expect(same).toBe(reg); // unchanged reference
  });
});
