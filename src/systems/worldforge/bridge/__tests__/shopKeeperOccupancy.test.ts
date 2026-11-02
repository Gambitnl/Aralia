/**
 * NPC lives (GG-595 item 4, 2026-11-02): the 3D shop occupants follow the town
 * sim's current keeper. Pure joins first, then one real town bake: a founder
 * dies, the sim names a keeper from another household, and the shop's packet,
 * the keeper's home packet and the roster all agree.
 */
import { describe, it, expect } from 'vitest';
import { keeperIndexIn, rowsWithKeeperAway, shopRowsWithKeeper, shopTakeoversAt } from '../shopKeeperOccupancy';
import type { OccupantDaySchedule, StationFeetPoint } from '../buildingOccupancy';
import type { Household } from '../../town/household';
import type { TownLifeVillager } from '../../roster/agentLife';
import { householdMemberIdentity } from '../../town/householdBrief';
import { getWorldforgeLocalForLocation } from '../legacySubmapBridge';
import { makeGroundWorld } from '../groundChunkLoader';

const at = (activity: StationFeetPoint['activity'], x = 1): StationFeetPoint => ({ xFt: x, yFt: 2, level: 0, activity });
const day24 = (fill: (h: number) => StationFeetPoint | null) => Array.from({ length: 24 }, (_, h) => fill(h));
const WORK = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const household = {
  homeId: 'b20', surname: 'Stone', dwelling: 'townhouse', ancestry: 'Human', occupation: 'smith', summary: '',
  members: [
    { name: 'Bram Stone', role: 'head', ageBand: 'adult' },
    { name: 'Edith Stone', role: 'spouse', ageBand: 'adult' },
    { name: 'Tib Stone', role: 'child', ageBand: 'adult' },
  ],
} as unknown as Household;

const founderRow: OccupantDaySchedule = {
  memberIndex: 0, name: 'Bram', ageBand: 'adult', occupation: 'artisan',
  stationsByHour: day24((h) => (WORK.includes(h) ? at('work', 9) : h < 7 || h >= 22 ? at('sleeping') : at('hearthside'))),
};
const childRow: OccupantDaySchedule = {
  memberIndex: 2, name: 'Tib', ageBand: 'adult', occupation: 'resident',
  stationsByHour: day24((h) => (h < 7 || h >= 22 ? at('sleeping') : at('chores', 3))),
};

const villager = (over: Partial<TownLifeVillager> & { occupantId: number }): TownLifeVillager =>
  ({ name: 'X', homePlotId: 20, bornDay: -9000, ...over }) as TownLifeVillager;

describe('shopTakeoversAt', () => {
  const founders = new Map([[20, { founder: { id: 1, householdMemberId: 'b20:head' }, hours: WORK }]]);

  it('names a takeover only when the sim keeper is not the founder', () => {
    const heir = villager({ occupantId: 3, householdMemberId: 'b20:child:0', name: 'Tib Stone' });
    const life = { villagers: { 3: heir }, shops: { 20: { keeperId: 3, sinceDay: 40 } } };
    const t = shopTakeoversAt(life, founders, 50);
    expect(t.get(20)).toMatchObject({ plotId: 20, keeper: heir, hours: WORK });
    // The founder still keeps it: nothing changes.
    const own = { villagers: { 1: villager({ occupantId: 1, householdMemberId: 'b20:head' }) }, shops: { 20: { keeperId: 1, sinceDay: 0 } } };
    expect(shopTakeoversAt(own, founders, 50).size).toBe(0);
  });

  it('leaves untracked towns and closed shops alone', () => {
    expect(shopTakeoversAt(undefined, founders, 5).size).toBe(0);
    expect(shopTakeoversAt({ villagers: {} }, founders, 5).size).toBe(0);
    expect(shopTakeoversAt({ villagers: {}, shops: { 20: { keeperId: null, sinceDay: 0, closedDay: 3 } } }, founders, 5).size).toBe(0);
  });
});

describe('shop packet rows', () => {
  it('puts an heir from the household at the counter, and keeps their own rows otherwise', () => {
    const takeover = { plotId: 20, keeper: villager({ occupantId: 3, householdMemberId: householdMemberIdentity(household, 2) }), hours: WORK };
    const index = keeperIndexIn(household, takeover.keeper);
    expect(index).toBe(2);
    const { rows, outsideRow } = shopRowsWithKeeper([founderRow, childRow], takeover, index, 3);
    expect(outsideRow).toBeUndefined();
    expect(rows.map((r) => r.memberIndex)).toEqual([2]); // the founder's row is gone
    const heir = rows[0];
    for (const h of WORK) expect(heir.stationsByHour[h]).toEqual(at('work', 9));
    expect(heir.stationsByHour[3]).toEqual(at('sleeping')); // own night rows stay
    expect(heir.stationsByHour[19]).toEqual(at('chores', 3));
    expect(heir.occupation).toBe('artisan');
    expect(childRow.stationsByHour[9]).toEqual(at('chores', 3)); // input not mutated
  });

  it('adds a counter-only row for a keeper from another household', () => {
    const takeover = { plotId: 20, keeper: villager({ occupantId: 9, householdMemberId: 'b44:head', name: 'Cora Marsh' }), hours: WORK };
    expect(keeperIndexIn(household, takeover.keeper)).toBeUndefined();
    const { rows, outsideRow } = shopRowsWithKeeper([founderRow, childRow], takeover, undefined, 3);
    expect(outsideRow).toBeDefined();
    expect(rows).toHaveLength(2);
    expect(outsideRow!.memberIndex).toBe(3);
    expect(outsideRow!.stationsByHour.filter(Boolean)).toHaveLength(WORK.length);
    expect(outsideRow!.stationsByHour[20]).toBeNull();
  });

  it('sends the keeper away from their own home at the counter hours', () => {
    const takeover = { plotId: 99, keeper: villager({ occupantId: 3, householdMemberId: householdMemberIdentity(household, 2) }), hours: WORK };
    const rows = rowsWithKeeperAway([founderRow, childRow], household, takeover);
    expect(rows[0]).toBe(founderRow); // other members untouched
    for (const h of WORK) expect(rows[1].stationsByHour[h]).toBeNull();
    expect(rows[1].stationsByHour[3]).toEqual(at('sleeping'));
  });
});

describe('a real town bake follows the sim keeper', () => {
  it('moves the counter to the new keeper and keeps one body per person', () => {
    const seed = 42;
    const b = getWorldforgeLocalForLocation(seed, 16, 4, 25, 16);
    const base = makeGroundWorld(b.local, seed, b.region, { hour: 12, anchorCellId: b.anchorCellId, skipProps: true });
    const { burgId } = base.townPlans![0];
    const roster = base.rosters.find((r) => r.burgId === burgId)!;
    const shopOf = (plotId: number) => base.buildings.find((x) => x.id === `wf-plot-${burgId}-${plotId}`);
    // A founder whose shop packet draws them, and an adult from another home.
    const founder = roster.occupants.find((o) => o.workPlotId !== undefined && o.householdMemberId
      && shopOf(o.workPlotId)?.occupants?.some((r) => r.householdMemberId === o.householdMemberId))!;
    expect(founder).toBeDefined();
    const shopPlot = founder.workPlotId!;
    const keeper = roster.occupants.find((o) => o.householdMemberId && o.workPlotId === undefined && o.ageBand === 'adult'
      && o.homePlotId !== shopPlot && o.homePlotId !== founder.homePlotId
      && shopOf(o.homePlotId)?.occupants?.some((r) => r.householdMemberId === o.householdMemberId))!;
    expect(keeper).toBeDefined();

    const life = {
      villagers: {
        [founder.id]: { occupantId: founder.id, householdMemberId: founder.householdMemberId, name: founder.name, homePlotId: founder.homePlotId, bornDay: -15000, diedDay: 0 },
        [keeper.id]: { occupantId: keeper.id, householdMemberId: keeper.householdMemberId, name: keeper.name, homePlotId: keeper.homePlotId, bornDay: -12000 },
      },
      shops: { [shopPlot]: { keeperId: keeper.id, sinceDay: 0 } },
    };
    const after = makeGroundWorld(b.local, seed, b.region, {
      hour: 12, anchorCellId: b.anchorCellId, skipProps: true, townLife: { [burgId]: life }, day: 1,
    });
    const shop = after.buildings.find((x) => x.id === `wf-plot-${burgId}-${shopPlot}`)!;
    const home = after.buildings.find((x) => x.id === `wf-plot-${burgId}-${keeper.homePlotId}`)!;
    expect(shop.occupants!.some((r) => r.householdMemberId === founder.householdMemberId)).toBe(false);
    const atCounter = shop.occupants!.filter((r) => r.householdMemberId === keeper.householdMemberId);
    expect(atCounter).toHaveLength(1);
    const counterHours = atCounter[0].stationsByHour.map((s, h) => (s ? h : -1)).filter((h) => h >= 0);
    expect(counterHours.length).toBeGreaterThan(4);
    expect(atCounter[0].stationsByHour[3]).toBeNull(); // asleep at home, not at the counter
    // One body per person: the keeper is away from home exactly at the counter hours.
    const atHome = home.occupants!.find((r) => r.householdMemberId === keeper.householdMemberId)!;
    for (const h of counterHours) expect(atHome.stationsByHour[h]).toBeNull();
    expect(atHome.stationsByHour[3]).not.toBeNull();
    // The street motion walks the keeper to the shop.
    const keeperNow = after.rosters.find((r) => r.burgId === burgId)!.occupants.find((o) => o.householdMemberId === keeper.householdMemberId)!;
    expect(keeperNow.workPlotId).toBe(shopPlot);
    expect(keeperNow.name).toBe(keeper.name);
    // The same body: the counter row uses the keeper's home body seed.
    expect(atCounter[0].body).toEqual(atHome.body);
  }, 240_000);
});
