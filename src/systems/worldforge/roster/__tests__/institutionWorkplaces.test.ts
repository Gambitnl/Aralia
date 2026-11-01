/** Saved succession, physical workplace support and memory-safe identity must
 * agree before an institution holder acquires a daily duty destination. */
import { describe, expect, it } from 'vitest';
import { institutionWorkplaceRoster } from '../institutionWorkplaces';
import { occupantLocationAt } from '../occupantSchedule';
import type { TownPlan } from '../../artifacts';
import type { Occupant, TownRoster } from '../types';
import type { TownLifeState } from '../agentLife';

const plot = (id: number, role: string, x: number) => ({
  id, role, footprint: [[x, 0], [x + 4, 0], [x + 4, 4], [x, 4]],
});
const plan = {plots: [plot(54, 'house', 0), plot(112, 'house', 5),
  plot(49, 'temple', -100), plot(168, 'temple', 10), plot(7, 'market', 20)]} as unknown as TownPlan;
const person = (): Occupant => ({id: 145, name: 'Faelan Ironsmith', homePlotId: 54,
  householdMemberId: 'b54:spouse', ageBand: 'elder', occupation: 'resident'});
const roster = (): TownRoster => ({burgId: 675, occupants: [person(),
  {id: 141, name: 'Another Resident', homePlotId: 112, householdMemberId: 'b112:head',
    ageBand: 'adult', occupation: 'resident'}]});
const life = (): {villagers: Record<number, TownLifeState['villagers'][number]>} => ({villagers: {
  141: {occupantId: 141, name: 'Faelan Ironsmith', homePlotId: 54, bornDay: -31388, role: 'priest'},
  288: {occupantId: 288, name: 'Senna Ironstead', homePlotId: 112, bornDay: -40000,
    diedDay: -372, role: 'priest'},
}});
const supported = new Set([168]);

describe('source-backed institution workplaces', () => {
  it('gives the living saved successor a qualified temple without turning them into a merchant', () => {
    const source = roster(), history = life();
    const before = JSON.stringify({plan, source, history});
    const projected = institutionWorkplaceRoster(plan, source, history, 5, supported);
    expect(projected.occupants[0]).toEqual({...source.occupants[0],
      civicWorkplace: {role: 'priest', plotId: 168}});
    expect(projected.occupants[0].workPlotId).toBeUndefined();
    expect(projected.occupants[1]).toBe(source.occupants[1]);
    expect(JSON.stringify({plan, source, history})).toBe(before);
    expect(occupantLocationAt(projected.occupants[0], 14)).toMatchObject({activity: 'working', plotId: 168});
  });

  it('does not equate a changed roster number with the saved office holder', () => {
    const projected = institutionWorkplaceRoster(plan, roster(), life(), 5, supported);
    expect(projected.occupants[0].id).toBe(145);
    expect(projected.occupants[1]).not.toHaveProperty('civicWorkplace');
  });

  it('prefers the exact household key over a legacy name when the saved person was renamed', () => {
    const history = life();
    history.villagers[141] = {...history.villagers[141],
      householdMemberId: 'b54:spouse', name: 'Faelan Newname'};
    expect(institutionWorkplaceRoster(plan, roster(), history, 5, supported).occupants[0])
      .toHaveProperty('civicWorkplace.plotId', 168);
  });

  it('refuses ambiguous legacy names and duplicate saved household identities', () => {
    const source = roster(), history = life();
    source.occupants.push({...person(), id: 146, householdMemberId: 'b54:lodger:2'});
    expect(institutionWorkplaceRoster(plan, source, history, 5, supported)).toBe(source);
    const exact = life();
    exact.villagers[141] = {...exact.villagers[141], householdMemberId: 'b54:spouse'};
    exact.villagers[400] = {...exact.villagers[141], occupantId: 400, role: undefined};
    const clean = roster();
    expect(institutionWorkplaceRoster(plan, clean, exact, 5, supported)).toBe(clean);
  });

  it('does not choose a new priest from proximity when the living office is missing or disputed', () => {
    const source = roster(), disputed = life();
    disputed.villagers[300] = {occupantId: 300, name: 'Another Resident', homePlotId: 112,
      bornDay: -10000, role: 'priest'};
    for (const history of [undefined, {villagers: {}}, disputed]) {
      expect(institutionWorkplaceRoster(plan, source, history, 5, supported)).toBe(source);
    }
  });

  it.each(['dead', 'future'] as const)('does not schedule a %s holder', condition => {
    const source = roster(), history = life();
    history.villagers[141] = {...history.villagers[141],
      ...(condition === 'dead' ? {diedDay: 4} : {bornDay: 6})};
    expect(institutionWorkplaceRoster(plan, source, history, 5, supported)).toBe(source);
  });

  it('requires the selected source temple and a physically supported station', () => {
    const source = roster();
    expect(institutionWorkplaceRoster(plan, source, life(), 5, new Set())).toBe(source);
    expect(institutionWorkplaceRoster(plan, source, life(), 5, new Set([49]))).toBe(source);
    const noTemple = {...plan, plots: plan.plots.filter(p => p.role !== 'temple')};
    expect(institutionWorkplaceRoster(noTemple, source, life(), 5, supported)).toBe(source);
  });

  it.each(['retired', 'child', 'merchant', 'homecraft'] as const)('preserves an existing %s responsibility', condition => {
    const source = roster();
    Object.assign(source.occupants[0], condition === 'retired' ? {retired: true}
      : condition === 'child' ? {ageBand: 'child'} : condition === 'homecraft' ? {occupation: 'artisan'}
        : {workPlotId: 7, occupation: 'shopkeeper'});
    expect(institutionWorkplaceRoster(plan, source, life(), 5, supported)).toBe(source);
  });

  it('withdraws only a previous derived duty after succession or loss of physical support', () => {
    const source = roster();
    Object.assign(source.occupants[0], {civicWorkplace: {role: 'priest', plotId: 168}});
    const projected = institutionWorkplaceRoster(plan, source, undefined, 5, supported);
    expect(projected.occupants[0]).toEqual(person());
    expect(projected.occupants[1]).toBe(source.occupants[1]);
    expect(source.occupants[0]).toHaveProperty('civicWorkplace');
  });

  it('is stable across serialization and repeated projection', () => {
    const initial = institutionWorkplaceRoster(plan, roster(), life(), 5, supported);
    expect(institutionWorkplaceRoster(plan, initial, life(), 5, supported)).toBe(initial);
    expect(institutionWorkplaceRoster(plan, JSON.parse(JSON.stringify(initial)), life(), 5, supported))
      .toEqual(initial);
    expect(initial.occupants[0]).toHaveProperty('civicWorkplace.plotId', 168);
  });
});

describe('authored library proprietor workplace', () => {
  // The actual Rosa closing watch exposed this reciprocal source link, while
  // the broad street occupation remained resident and jumped straight home.
  const libraryPlan = (): TownPlan => ({plots: [
    {...plot(30, 'civic', 30), pop: {homeId: 'b30', buildingType: 'library',
      residential: false, proprietorHomeId: 'b80'}},
    {...plot(80, 'house', 0), pop: {homeId: 'b80', buildingType: 'townhouse',
      residential: true, workplaceId: 'b30', workRole: 'proprietor'}},
  ]} as unknown as TownPlan);
  const residents = (): TownRoster => ({burgId: 675, occupants: [{id: 209,
    name: 'Rosa Colewick', homePlotId: 80, householdMemberId: 'b80:head',
    ageBand: 'adult', occupation: 'resident'}]});
  const qualify = (p = libraryPlan(), r = residents(), supportedIds = new Set([30]), history?: TownLifeState) =>
    institutionWorkplaceRoster(p, r, history, 8, supportedIds);

  it('joins the real library duty to the same household person without granting merchant identity', () => {
    const p = libraryPlan(), r = residents(), before = JSON.stringify({p, r});
    const result = qualify(p, r), worker = result.occupants[0];
    expect(worker).toEqual({...r.occupants[0], civicWorkplace: {role: 'librarian', plotId: 30}});
    expect(worker.workPlotId).toBeUndefined();
    expect(occupantLocationAt(worker, 17)).toMatchObject({activity: 'working', plotId: 30});
    expect(occupantLocationAt(worker, 18)).toMatchObject({activity: 'home', plotId: 80});
    expect(JSON.stringify({p, r})).toBe(before);
  });

  it.each(['station', 'reciprocal', 'public role', 'building type'] as const)(
    'requires the actual qualified source %s', issue => {
      const p = libraryPlan(), r = residents();
      if (issue === 'reciprocal') p.plots[1].pop!.workplaceId = 'other';
      if (issue === 'public role') p.plots[0].role = 'house';
      if (issue === 'building type') p.plots[0].pop!.buildingType = 'townhouse';
      expect(qualify(p, r, issue === 'station' ? new Set() : new Set([30]))).toBe(r);
    });

  it.each(['child', 'retired', 'merchant', 'artisan', 'spouse'] as const)(
    'does not replace an existing %s responsibility', issue => {
      const r = residents();
      Object.assign(r.occupants[0], issue === 'child' ? {ageBand: 'child'}
        : issue === 'retired' ? {retired: true}
        : issue === 'merchant' ? {occupation: 'shopkeeper', workPlotId: 7}
        : issue === 'artisan' ? {occupation: 'artisan'}
        : {householdMemberId: 'b80:spouse'});
      expect(qualify(libraryPlan(), r)).toBe(r);
    });

  it('refuses duplicate source people or competing library links', () => {
    const r = residents(); r.occupants.push({...r.occupants[0], id: 210});
    expect(qualify(libraryPlan(), r)).toBe(r);
    const p = libraryPlan(), single = residents();
    p.plots.push({...p.plots[0], id: 31});
    expect(qualify(p, single, new Set([30, 31]))).toBe(single);
  });

  it('preserves a current saved priest duty when the same household also owns a library', () => {
    const p = libraryPlan(), r = residents();
    p.plots.push(plot(168, 'temple', 60) as TownPlan['plots'][number]);
    const history = {villagers: {209: {occupantId: 209, householdMemberId: 'b80:head',
      name: 'Rosa Colewick', homePlotId: 80, bornDay: -10000, role: 'priest'}}} as TownLifeState;
    expect(qualify(p, r, new Set([30, 168]), history).occupants[0].civicWorkplace)
      .toEqual({role: 'priest', plotId: 168});
  });

  it.each(['dead', 'future'] as const)('retains the %s proprietor without inventing an active duty', issue => {
    const r = residents();
    const history = {villagers: {209: {occupantId: 209, householdMemberId: 'b80:head',
      name: 'Rosa Colewick', homePlotId: 80, bornDay: issue === 'future' ? 9 : -10000,
      ...(issue === 'dead' ? {diedDay: 7} : {})}}} as TownLifeState;
    expect(qualify(libraryPlan(), r, new Set([30]), history)).toBe(r);
  });

  it('keeps repeated projection stable and withdraws only a lost derived duty', () => {
    const p = libraryPlan(), initial = qualify(p);
    expect(qualify(p, initial)).toBe(initial);
    expect(initial.occupants[0]).toHaveProperty('civicWorkplace.role', 'librarian');
    const withdrawn = qualify(p, initial, new Set());
    expect(withdrawn).toEqual(residents());
    expect(initial.occupants[0]).toHaveProperty('civicWorkplace.role', 'librarian');
  });
});
