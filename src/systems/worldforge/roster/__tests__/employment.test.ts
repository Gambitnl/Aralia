/**
 * NPC lives (GG-600, 2026-11-02): the town's earners take the town engine's
 * home-to-work links. Pure rules first, then one real town: more people work,
 * the keepers are unchanged, and every new worker is also away from their home
 * room packet during the shift, so the street walk and the house agree.
 */
import { describe, it, expect } from 'vitest';
import { assignEmployment, memberEarnsLiving } from '../employment';
import { generateTownRoster } from '../generateTownRoster';
import { occupantLocationAt } from '../occupantSchedule';
import type { Occupant } from '../types';
import type { TownPlan } from '../../artifacts';
import type { HouseholdMember } from '../../town/household';
import { getWorldforgeLocalForLocation } from '../../bridge/legacySubmapBridge';
import { canonicalTownSeedPath } from '../../town/canonicalTown';
import { householdForPlot, householdMemberIdentity, householdPopulationForPlot, householdPopulationsForPlan } from '../../town/householdBrief';
import { blueprintForPlot } from '../../interior/generateInterior';
import { computeOccupancy } from '../../interior/occupancy';

const square = (x: number, y: number, s = 20): Array<[number, number]> => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
type Plot = TownPlan['plots'][number];
const plot = (id: number, role: string, x: number, pop?: Plot['pop']): Plot => ({ id, role, storeys: 1, footprint: square(x, 0), ...(pop ? { pop } : {}) });
const home = (id: number, x: number, workRole: 'proprietor' | 'staff' | 'labourer', workplaceId?: string) =>
  plot(id, 'house', x, { residential: true, homeId: `b${id}`, occupants: 4, buildingType: 'cottage', workRole, ...(workplaceId ? { workplaceId } : {}) });
const planOf = (plots: Plot[]) => ({ burgId: 1, plots, streets: [] } as unknown as TownPlan);
const member = (role: HouseholdMember['role'], over: Partial<HouseholdMember> = {}): HouseholdMember =>
  ({ name: role, ageBand: 'adult', age: 30, race: 'Human', role, occupation: role === 'head' ? 'labourer' : 'keeps the household', ...over });
const person = (id: number, homePlotId: number, over: Partial<Occupant> = {}): Occupant =>
  ({ id, name: `p${id}`, ageBand: 'adult', homePlotId, occupation: 'resident', householdMemberId: `b${homePlotId}:${id}`, ...over });

describe('memberEarnsLiving', () => {
  it('names the head and lodgers, and family helpers only in a family business', () => {
    expect(memberEarnsLiving(member('head'), false)).toBe(true);
    expect(memberEarnsLiving(member('lodger', { occupation: 'lodger' }), false)).toBe(true);
    expect(memberEarnsLiving(member('spouse'), false)).toBe(false); // keeps the household
    expect(memberEarnsLiving(member('spouse'), true)).toBe(true); // helps at the family shop
    expect(memberEarnsLiving(member('kin', { occupation: 'helps the household' }), true)).toBe(true);
    expect(memberEarnsLiving(member('child', { ageBand: 'child' }), true)).toBe(false);
    expect(memberEarnsLiving(member('servant', { occupation: 'household servant' }), true)).toBe(false);
    expect(memberEarnsLiving(member('head', { ageBand: 'elder', occupation: 'retired labourer' }), false)).toBe(false);
  });
});

describe('assignEmployment', () => {
  const plots = [
    home(1, 0, 'proprietor', 'b10'), home(2, 30, 'staff', 'b10'), home(3, 200, 'labourer'),
    plot(10, 'market', 60, { residential: false, homeId: 'b10', buildingType: 'shop', proprietorHomeId: 'b1' }),
    plot(11, 'workshop', 230, { residential: false, homeId: 'b11', buildingType: 'storehouse' }),
  ];

  it('follows each home link and keeps the keeper on workPlotId', () => {
    const keeper = person(1, 1, { workPlotId: 10, occupation: 'shopkeeper' });
    const people = [keeper, person(2, 1), person(3, 1, { ageBand: 'child' }),
      person(4, 2), person(5, 2), person(6, 2), person(7, 3), person(8, 3, { householdMemberId: undefined })];
    const members = new Map<number, HouseholdMember>([
      [1, member('head')], [2, member('spouse')], [3, member('child', { ageBand: 'child' })],
      [4, member('head', { occupation: 'shop assistant' })], [5, member('spouse')], [6, member('lodger', { occupation: 'lodger' })],
      [7, member('head')],
    ]);
    assignEmployment(planOf(plots), people, members);
    const job = (id: number) => people.find((p) => p.id === id)!.employment;
    expect(keeper.employment).toBeUndefined(); // the keeper stays the keeper
    expect(keeper.workPlotId).toBe(10);
    expect(job(2)).toEqual({ plotId: 10, role: 'proprietor' }); // family helps at the shop
    expect(job(3)).toBeUndefined(); // a child does not work
    expect(job(4)).toEqual({ plotId: 10, role: 'staff' });
    expect(job(5)).toBeUndefined(); // keeps the household
    // A lodger takes day labour, not the family's job: a porter at the near shop.
    expect(job(6)).toEqual({ plotId: 10, role: 'labourer' });
    expect(job(7)).toEqual({ plotId: 11, role: 'labourer' });
    expect(job(8)).toEqual({ plotId: 11, role: 'labourer' }); // a surplus adult slot
    for (const p of people) {
      expect(p.workPlotId === undefined || p === keeper).toBe(true);
      expect(p.occupation).toBe(p === keeper ? 'shopkeeper' : 'resident');
    }
  });

  it('gives a worker the day shift and leaves an unlinked town alone', () => {
    const worker = person(4, 2);
    assignEmployment(planOf(plots), [worker], new Map([[4, member('head')]]));
    expect(occupantLocationAt(worker, 10)).toMatchObject({ activity: 'working', plotId: 10 });
    expect(occupantLocationAt(worker, 19).activity).toBe('home');
    const bare = planOf(plots.map(({ pop: _pop, ...rest }) => rest as Plot));
    const idle = person(4, 2);
    assignEmployment(bare, [idle], new Map([[4, member('head')]]));
    expect(idle.employment).toBeUndefined();
  });

  it('spreads day labour over sites by their weight', () => {
    const many = [home(3, 200, 'labourer'), home(4, 210, 'labourer'), home(5, 220, 'labourer'),
      plot(11, 'workshop', 230, { residential: false, homeId: 'b11', buildingType: 'storehouse' }),
      plot(12, 'workshop', 600, { residential: false, homeId: 'b12', buildingType: 'bakery' })];
    const people = [3, 4, 5].flatMap((h) => [person(h * 10, h), person(h * 10 + 1, h, { householdMemberId: undefined })]);
    const members = new Map<number, HouseholdMember>([[30, member('head')], [40, member('head')], [50, member('head')]]);
    assignEmployment(planOf(many), people, members);
    const at = (site: number) => people.filter((p) => p.employment?.plotId === site).length;
    // Six labourers, weights 4 : 2 -> capacity 4 and 2. The third household
    // finds the near storehouse full and walks to the far bakery.
    expect(at(11)).toBe(4);
    expect(at(12)).toBe(2);
    for (const h of [3, 4, 5]) expect(new Set(people.filter((p) => p.homePlotId === h).map((p) => p.employment?.plotId)).size).toBe(1);
  });
});

describe('a real town', () => {
  it('puts the earners to work, keeps the keepers, and agrees with the house packets', () => {
    const seed = 42;
    const b = getWorldforgeLocalForLocation(seed, 16, 4, 25, 16);
    const plan = b.local.townPlan!;
    const townSeed = canonicalTownSeedPath(seed, plan.burgId);
    const roster = generateTownRoster(plan, townSeed, { nameFor: () => 'Name' });
    const again = generateTownRoster(plan, townSeed, { nameFor: () => 'Name' });
    expect(again).toEqual(roster); // deterministic per seed

    const workers = roster.occupants.filter((o) => o.workPlotId !== undefined || o.employment);
    const keepers = roster.occupants.filter((o) => o.workPlotId !== undefined);
    expect(workers.length).toBeGreaterThan(roster.occupants.length * 0.2);
    expect(new Set(keepers.map((o) => o.workPlotId)).size).toBe(keepers.length); // one keeper per business
    const plotIds = new Set(plan.plots.map((p) => p.id));
    for (const o of workers) {
      expect(o.workPlotId === undefined || o.employment === undefined).toBe(true);
      if (o.employment) expect(plotIds.has(o.employment.plotId)).toBe(true);
    }

    // Every employed named person in a house is out of the house packet during
    // the shift and in bed at night, so the street walk does not double them.
    const pops = householdPopulationsForPlan(plan);
    const byPlot = new Map(plan.plots.map((p) => [p.id, p]));
    let checked = 0;
    for (const o of roster.occupants.filter((p) => p.employment && p.householdMemberId).slice(0, 40)) {
      const homePlot = byPlot.get(o.homePlotId)!;
      const household = householdForPlot(householdPopulationForPlot(homePlot)!, pops, townSeed)!.household;
      const index = household.members.findIndex((_, i) => householdMemberIdentity(household, i) === o.householdMemberId);
      expect(index).toBeGreaterThanOrEqual(0);
      const occ = computeOccupancy(blueprintForPlot(homePlot, townSeed), household, { worksAtHome: false });
      const stationAt = (h: number) => occ.stationsByHour[h].find((st) => st.memberIndex === index);
      for (const h of [8, 10, 12, 15, 17]) {
        expect(occupantLocationAt(o, h).activity).toBe('working');
        expect(stationAt(h)?.where).not.toBe('home');
      }
      expect(stationAt(3)?.where).toBe('home');
      checked++;
    }
    expect(checked).toBe(40);
  }, 240_000);
});
