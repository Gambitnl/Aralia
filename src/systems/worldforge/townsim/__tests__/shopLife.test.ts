/**
 * NPC lives (2026-11-02): shop succession, closure, reopening and personal
 * fortune in the living-world sim. See shopLife.ts for the rules.
 */
import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../../../../utils/random/seededRandom';
import { DAYS_PER_YEAR } from '../constants';
import { advanceTownDays, rollTownDay } from '../townSim';
import { advanceRegistry, type TownSimRegistry } from '../townSimRegistry';
import {
  applyPersonalFortune,
  DRIFT_FORTUNE_RANGE,
  fortuneStream,
  KEEPER_FORTUNE_RANGE,
  POOR_WEALTH,
  reopenClosedShops,
  RICH_WEALTH,
  seedShopsFromRoster,
  shopKeeperAt,
  transferShopOnDeath,
} from '../shopLife';
import { selectTownNews } from '../townNews';
import { summarizeChronicle } from '../chronicle';
import { chronicleNewsToRumors } from '../../../../utils/world/chronicleNewsToRumors';
import type { LivingVillager, TownShopRecord, TownSimState } from '../types';
import type { TownPlan } from '../../artifacts';
import type { TownRoster } from '../../roster/types';

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

function town(vs: LivingVillager[], shops?: Record<number, TownShopRecord>, lastSimDay = 0): TownSimState {
  const villagers: Record<number, LivingVillager> = {};
  for (const v of vs) villagers[v.occupantId] = v;
  return {
    burgId: 7,
    villagers,
    chronicle: { burgId: 7, events: [], nextEventId: 1 },
    ...(shops ? { shops } : {}),
    lastSimDay,
    nextVillagerId: Math.max(...vs.map((v) => v.occupantId)) + 1,
  };
}

/** Mark a villager dead and run the shop rule, as killVillager does. */
function die(s: TownSimState, id: number, day: number): void {
  s.villagers[id].diedDay = day;
  transferShopOnDeath(s, s.villagers[id], day);
}

describe('seedShopsFromRoster', () => {
  it('seeds one record per market or workshop plot from the occupant work plot', () => {
    const plan = { plots: [
      { id: 10, role: 'workshop', pop: { buildingType: 'smithy' } },
      { id: 11, role: 'market' },
      { id: 12, role: 'house' },
    ] } as unknown as Pick<TownPlan, 'plots'>;
    const roster = { burgId: 7, occupants: [{ id: 3, workPlotId: 10 }, { id: 4 }] } as unknown as TownRoster;
    const shops = seedShopsFromRoster(plan, roster, -100);
    expect(shops[10]).toEqual({ keeperId: 3, sinceDay: -100, trade: 'smithy' });
    expect(shops[11]).toMatchObject({ keeperId: null, closedDay: -100 });
    expect(shops[12]).toBeUndefined();
  });
});

describe('shop succession on death', () => {
  it('passes the shop to the eldest living adult child', () => {
    const s = town([
      villager({ occupantId: 1, name: 'Bram Stone', childIds: [2, 3], spouseId: 4, bornDay: -60 * DAYS_PER_YEAR }),
      villager({ occupantId: 2, name: 'Mara Stone', parentIds: [1], bornDay: -25 * DAYS_PER_YEAR }),
      villager({ occupantId: 3, name: 'Tib Stone', parentIds: [1], bornDay: -28 * DAYS_PER_YEAR }),
      villager({ occupantId: 4, name: 'Edda Stone', spouseId: 1 }),
    ], { 10: { keeperId: 1, sinceDay: 0, trade: 'smithy' } });
    die(s, 1, 50);
    expect(s.shops![10]).toEqual({ keeperId: 3, sinceDay: 50, trade: 'smithy' });
    const e = s.chronicle.events.at(-1)!;
    expect(e).toMatchObject({ kind: 'shop_succession', subjectId: 3, relatedIds: [1], day: 50 });
    expect(e.summary).toBe('Tib Stone took over the smithy after the death of their parent Bram Stone.');
  });

  it('skips a minor child and a child who keeps another shop, then falls back to the spouse', () => {
    const s = town([
      villager({ occupantId: 1, name: 'Bram Stone', childIds: [2, 3], spouseId: 4 }),
      villager({ occupantId: 2, parentIds: [1], bornDay: -5 * DAYS_PER_YEAR }), // a minor
      villager({ occupantId: 3, parentIds: [1] }), // keeps plot 11
      villager({ occupantId: 4, name: 'Edda Stone', spouseId: 1 }),
    ], {
      10: { keeperId: 1, sinceDay: 0, trade: 'general store' },
      11: { keeperId: 3, sinceDay: 0, trade: 'smithy' },
    });
    die(s, 1, 50);
    expect(s.shops![10].keeperId).toBe(4);
    expect(s.chronicle.events.at(-1)!.summary)
      .toBe('Edda Stone took over the general store after the death of their spouse Bram Stone.');
  });

  it('closes the shop when no heir exists, and names living kin as related', () => {
    const s = town([
      villager({ occupantId: 1, name: 'Bram Stone', childIds: [2] }),
      villager({ occupantId: 2, parentIds: [1], bornDay: -3 * DAYS_PER_YEAR }),
    ], { 10: { keeperId: 1, sinceDay: 0, trade: 'smithy' } });
    die(s, 1, 50);
    expect(s.shops![10]).toEqual({ keeperId: null, sinceDay: 0, closedDay: 50, trade: 'smithy' });
    expect(s.chronicle.events.at(-1)).toMatchObject({ kind: 'shop_closed', subjectId: 1, relatedIds: [2] });
    expect(shopKeeperAt(s, 10, 51)).toEqual({ status: 'closed', closedDay: 50 });
  });

  it('runs through killVillager: a natural death in rollTownDay passes the shop', () => {
    let s = town([
      villager({ occupantId: 1, name: 'Old Keeper', bornDay: -120 * DAYS_PER_YEAR, childIds: [2] }),
      villager({ occupantId: 2, name: 'Young Keeper', parentIds: [1] }),
    ], { 10: { keeperId: 1, sinceDay: 0, trade: 'smithy' } });
    const rng = new SeededRandom(5);
    for (let day = 1; day <= 3000 && s.villagers[1].diedDay === undefined; day++) s = rollTownDay(s, day, rng);
    const diedDay = s.villagers[1].diedDay!;
    expect(diedDay).toBeDefined();
    expect(s.shops![10]).toMatchObject({ keeperId: 2, sinceDay: diedDay });
    const kinds = s.chronicle.events.filter((e) => e.day === diedDay).map((e) => e.kind);
    expect(kinds.indexOf('death')).toBeLessThan(kinds.indexOf('shop_succession'));
  });

  it('does not touch the input state (rollTownDay clones the shop records)', () => {
    const s = town([villager({ occupantId: 1, bornDay: -120 * DAYS_PER_YEAR })],
      { 10: { keeperId: 1, sinceDay: 0 } });
    const before = JSON.stringify(s);
    advanceTownDays(s, 0, 2000, new SeededRandom(9));
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('shop reopening at a year boundary', () => {
  it('reopens a shop closed for a year under the wealthiest roleless adult without a shop', () => {
    const s = town([
      villager({ occupantId: 1, name: 'Lord', wealth: 500, role: 'lord' }),
      villager({ occupantId: 2, name: 'Rich Keeper', wealth: 400 }),
      villager({ occupantId: 3, name: 'Tam Reed', wealth: 90 }),
      villager({ occupantId: 4, name: 'Ana Reed', wealth: 90 }),
      villager({ occupantId: 5, name: 'Rich Child', wealth: 900, bornDay: -4 * DAYS_PER_YEAR }),
    ], {
      10: { keeperId: null, sinceDay: 0, closedDay: 0, trade: 'smithy' },
      11: { keeperId: 2, sinceDay: 0 },
    });
    reopenClosedShops(s, DAYS_PER_YEAR);
    expect(s.shops![10]).toEqual({ keeperId: 3, sinceDay: DAYS_PER_YEAR, trade: 'smithy' });
    expect(s.chronicle.events.at(-1)).toMatchObject({ kind: 'shop_opened', subjectId: 3 });
    expect(s.chronicle.events.at(-1)!.summary).toBe('Tam Reed reopened the smithy, which had stood closed for 1 year.');
  });

  it('keeps a shop closed for less than a year closed', () => {
    const s = town([villager({ occupantId: 3 })], { 10: { keeperId: null, sinceDay: 0, closedDay: 10 } });
    reopenClosedShops(s, DAYS_PER_YEAR);
    expect(s.shops![10].keeperId).toBeNull();
    expect(s.chronicle.events).toHaveLength(0);
  });

  it('rollTownDay reopens on the year-boundary day only', () => {
    const s = town([villager({ occupantId: 3, name: 'Tam Reed' })],
      { 10: { keeperId: null, sinceDay: 0, closedDay: -400 } }, DAYS_PER_YEAR - 2);
    const mid = rollTownDay(s, DAYS_PER_YEAR - 1, new SeededRandom(424242));
    expect(mid.shops![10].keeperId).toBeNull();
    const boundary = rollTownDay(mid, DAYS_PER_YEAR, new SeededRandom(424242));
    expect(boundary.shops![10]).toMatchObject({ keeperId: 3, sinceDay: DAYS_PER_YEAR });
  });
});

describe('personal fortune', () => {
  const day = 2 * DAYS_PER_YEAR;

  it('draws each delta from the derived per-villager stream and clamps at 0', () => {
    const vs = Array.from({ length: 30 }, (_, i) => villager({ occupantId: i + 1, wealth: i < 15 ? 0 : 50 }));
    const s = town(vs, { 10: { keeperId: 20, sinceDay: 0 } });
    const before = new Map(vs.map((v) => [v.occupantId, v.wealth]));
    applyPersonalFortune(s, day, 4242, before);
    for (const v of vs) {
      const [min, max] = v.occupantId === 20 ? KEEPER_FORTUNE_RANGE : DRIFT_FORTUNE_RANGE;
      const delta = fortuneStream(4242, 7, day, v.occupantId).nextInt(min, max + 1);
      expect(s.villagers[v.occupantId].wealth).toBe(Math.max(0, before.get(v.occupantId)! + delta));
    }
  });

  it('emits fortune_fell and fortune_rose exactly when a threshold is crossed', () => {
    const vs = [
      ...Array.from({ length: 20 }, (_, i) => villager({ occupantId: i + 1, name: `Poor${i + 1}`, wealth: POOR_WEALTH + 1 })),
      ...Array.from({ length: 20 }, (_, i) => villager({ occupantId: i + 21, name: `Rich${i + 21}`, wealth: RICH_WEALTH - 1 })),
    ];
    const shops: Record<number, TownShopRecord> = {};
    for (let i = 21; i <= 40; i++) shops[100 + i] = { keeperId: i, sinceDay: 0 };
    const s = town(vs, shops);
    applyPersonalFortune(s, day, 77, new Map(vs.map((v) => [v.occupantId, v.wealth])));
    const fell = s.chronicle.events.filter((e) => e.kind === 'fortune_fell').map((e) => e.subjectId);
    const rose = s.chronicle.events.filter((e) => e.kind === 'fortune_rose').map((e) => e.subjectId);
    const expectedFell = vs.slice(0, 20).filter((v) => fortuneStream(77, 7, day, v.occupantId)
      .nextInt(DRIFT_FORTUNE_RANGE[0], DRIFT_FORTUNE_RANGE[1] + 1) <= -1).map((v) => v.occupantId);
    const expectedRose = vs.slice(20).filter((v) => fortuneStream(77, 7, day, v.occupantId)
      .nextInt(KEEPER_FORTUNE_RANGE[0], KEEPER_FORTUNE_RANGE[1] + 1) >= 1).map((v) => v.occupantId);
    expect(fell).toEqual(expectedFell);
    expect(rose).toEqual(expectedRose);
    expect(fell.length).toBeGreaterThan(0);
    expect(rose.length).toBeGreaterThan(0);
    expect(s.chronicle.events.find((e) => e.kind === 'fortune_fell')!.summary).toMatch(/^Poor\d+ has fallen on hard times\.$/);
  });

  it('keepers trend up over many years; other adults drift around zero', () => {
    let keeperSum = 0;
    let driftSum = 0;
    for (let id = 1; id <= 400; id++) {
      keeperSum += fortuneStream(1, 7, day, id).nextInt(KEEPER_FORTUNE_RANGE[0], KEEPER_FORTUNE_RANGE[1] + 1);
      driftSum += fortuneStream(1, 7, day, id + 1000).nextInt(DRIFT_FORTUNE_RANGE[0], DRIFT_FORTUNE_RANGE[1] + 1);
    }
    expect(keeperSum / 400).toBeGreaterThan(3);
    expect(Math.abs(driftSum / 400)).toBeLessThan(2.5);
  });

  it('leaves the main rng stream untouched (same deaths and births with or without a world seed)', () => {
    const make = () => town([
      villager({ occupantId: 1, spouseId: 2, bornDay: -25 * DAYS_PER_YEAR }),
      villager({ occupantId: 2, spouseId: 1, bornDay: -24 * DAYS_PER_YEAR }),
      villager({ occupantId: 3, bornDay: -70 * DAYS_PER_YEAR }),
    ]);
    const strip = (s: TownSimState) => ({
      lives: Object.values(s.villagers).map((v) => [v.occupantId, v.diedDay, v.childIds.length]),
      kinds: s.chronicle.events.filter((e) => !e.kind.startsWith('fortune')).map((e) => [e.day, e.kind, e.subjectId]),
    });
    let a = make();
    let b = make();
    const ra = new SeededRandom(31);
    const rb = new SeededRandom(31);
    for (let d = 1; d <= 3 * DAYS_PER_YEAR; d++) {
      a = rollTownDay(a, d, ra, { worldSeed: 1 });
      b = rollTownDay(b, d, rb, { worldSeed: 999 });
    }
    expect(strip(a)).toEqual(strip(b));
    expect(ra.next()).toBe(rb.next());
  });
});

describe('registry contracts with the new rules', () => {
  const make = (): TownSimRegistry => ({
    7: town([
      villager({ occupantId: 1, name: 'Old Keeper', bornDay: -75 * DAYS_PER_YEAR, childIds: [2], wealth: 95 }),
      villager({ occupantId: 2, name: 'Heir', parentIds: [1], wealth: 22 }),
      villager({ occupantId: 3, name: 'Lone Keeper', bornDay: -78 * DAYS_PER_YEAR, wealth: 30 }),
      villager({ occupantId: 4, name: 'Spare Adult', wealth: 60 }),
    ], {
      10: { keeperId: 1, sinceDay: 0, trade: 'smithy' },
      11: { keeperId: 3, sinceDay: 0, trade: 'tavern' },
      12: { keeperId: null, sinceDay: 0, closedDay: -500, trade: 'apothecary' },
    }),
  });

  it('is chunking-independent: one 400-day advance equals 200 + 200', () => {
    const oneShot = advanceRegistry(make(), 2024, 400);
    const stepped = advanceRegistry(advanceRegistry(make(), 2024, 200), 2024, 400);
    expect(JSON.stringify(stepped)).toBe(JSON.stringify(oneShot));
    // The year boundary inside the span ran the new rules.
    expect(oneShot[7].shops![12].keeperId).not.toBeNull();
  });

  it('stays chunking-independent across a long span with deaths and successions', () => {
    const oneShot = advanceRegistry(make(), 7, 6 * DAYS_PER_YEAR);
    let stepped = make();
    for (const target of [100, 365, 900, 1500, 6 * DAYS_PER_YEAR]) stepped = advanceRegistry(stepped, 7, target);
    expect(JSON.stringify(stepped)).toBe(JSON.stringify(oneShot));
  });

  it('an old save without shop records still loads and ticks', () => {
    const old = make();
    delete old[7].shops;
    const out = advanceRegistry(old, 2024, 3 * DAYS_PER_YEAR);
    expect(out[7].lastSimDay).toBe(3 * DAYS_PER_YEAR);
    expect(out[7].shops).toBeUndefined();
    expect(out[7].chronicle.events.some((e) => e.kind.startsWith('shop_'))).toBe(false);
    expect(shopKeeperAt(out[7], 10, 3 * DAYS_PER_YEAR)).toEqual({ status: 'untracked' });
  });
});

describe('news surfaces pick up the new kinds', () => {
  it('ranks shop changes as notices and fortune as gossip, maps rumors, and summarizes the year', () => {
    const s = town([villager({ occupantId: 1 }), villager({ occupantId: 2 })]);
    s.chronicle.events.push(
      { id: 1, day: 400, kind: 'shop_succession', subjectId: 2, relatedIds: [1], summary: 'V2 took over the smithy after the death of their parent V1.' },
      { id: 2, day: 401, kind: 'shop_closed', subjectId: 1, relatedIds: [], summary: 'The tavern closed after V1 died with no heir to keep it.' },
      { id: 3, day: 402, kind: 'shop_opened', subjectId: 2, relatedIds: [], summary: 'V2 reopened the tavern, which had stood closed for 1 year.' },
      { id: 4, day: 403, kind: 'fortune_rose', subjectId: 2, relatedIds: [], summary: 'V2 has grown prosperous.' },
      { id: 5, day: 404, kind: 'fortune_fell', subjectId: 1, relatedIds: [], summary: 'V1 has fallen on hard times.' },
    );
    s.chronicle.nextEventId = 6;
    const news = selectTownNews(s, 410);
    const tier = Object.fromEntries(news.map((n) => [n.kind, n.prominence]));
    expect(tier).toEqual({
      shop_succession: 'notice', shop_closed: 'notice', shop_opened: 'notice',
      fortune_rose: 'gossip', fortune_fell: 'gossip',
    });
    const rumorTypes = Object.fromEntries(chronicleNewsToRumors(news, 410, 'loc').map((r, i) => [news[i].kind, r.type]));
    expect(rumorTypes).toMatchObject({ shop_succession: 'market', shop_closed: 'market', shop_opened: 'market', fortune_rose: 'misc' });
    const [line] = summarizeChronicle(s);
    expect(line).toContain('V2 took over the smithy');
    expect(line).toContain('The tavern closed');
    expect(line).toContain('V2 reopened the tavern');
    expect(line).toContain('1 grew prosperous, 1 fell on hard times.');
  });
});
