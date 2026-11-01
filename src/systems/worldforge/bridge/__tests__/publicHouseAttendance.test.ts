/** Regression from Gwyn's native Golden Raven bench observation. The retained
 * inn belongs to the Hartbourne household in another building. Working later
 * must move its existing proprietor, never recruit his family or rename guests.
 * The home plan is a source lookup, not evidence that Gwyn entered that home. */
import {describe, expect, it} from 'vitest';
import fixture from './fixtures/goldenRavenWorkHours.json';
import type {TownPlan} from '../../artifacts';
import type {BlueprintPlan} from '../../interior/blueprintTypes';
import type {InteriorPlotInput} from '../../interior/generateInterior';
import {computeOccupancy} from '../../interior/occupancy';
import {generateTownRoster} from '../../roster/generateTownRoster';
import {occupantLocationAt} from '../../roster/occupantSchedule';
import {publicHouseWorkRoleForOwner} from '../../roster/workHours';
import {rootSeedPath, childSeedPath, streamPath} from '../../seedPath';
import {householdPopulationForPlot, householdPopulationsForPlan} from '../../town/householdBrief';
import {occupancyScheduleForPlot} from '../buildingOccupancy';
import {townBuildingVisit} from '../../../../components/Worldforge/townBuildingVisit';
import {attendanceForVisit} from '../../../economy/businessAttendance';
import type {ObservedBuildingSource} from '../../interior/buildingSource';

const town = fixture.townPlan as unknown as TownPlan;
const plan = fixture.source.plan as unknown as BlueprintPlan;
const homePlan = fixture.homePlan as unknown as BlueprintPlan;
const seed = streamPath(childSeedPath(rootSeedPath(fixture.provenance.worldSeed), 'burg:188'), 'town');
const plots = householdPopulationsForPlan(town);
function schedule(id: number) {
  const plot = town.plots.find(p => p.id === id)!;
  const blueprint = id === 8 ? plan : homePlan;
  const input = {id, footprint: plot.footprint, role: plot.role,
    storeys: blueprint.floors.filter(f => f.level >= 0).length,
    buildingType: blueprint.type,
    ...(id === 8 ? {retainedSource: {worldSeed: fixture.provenance.worldSeed,
      burgId: 188, source: fixture.source}} : {}),
  } as unknown as InteriorPlotInput;
  return occupancyScheduleForPlot(householdPopulationForPlot(plot)!, plots, input, seed, seed, blueprint)!;
}

describe('Golden Raven household and street attendance', () => {
  it('posts the same evening service hours through the real saved-layout visit', () => {
    const visit = townBuildingVisit(fixture.provenance.worldSeed, 188, 8, undefined,
      fixture.source as unknown as ObservedBuildingSource, 1);
    expect(visit.household).toEqual(fixture.source.household);
    expect(visit.manifests).toEqual(fixture.source.manifests);
    expect(visit.plan).toEqual(plan);
    expect(attendanceForVisit(visit, 19)).toMatchObject({open: true, hours: '12:00–23:00'});
    expect(attendanceForVisit(visit, 11).open).toBe(false);
    expect(attendanceForVisit(visit, 23).open).toBe(false);
  }, 60000);
  it('qualifies the recorded proprietor without changing the original people or property', () => {
    const before = JSON.stringify(fixture);
    const roster = generateTownRoster(town, seed, {nameFor: () => 'Fallback resident'});
    const keeper = roster.occupants.find(p => p.householdMemberId === 'b9:head')!;
    expect(keeper).toMatchObject({id: 29, name: 'Bryn Hartbourne', homePlotId: 9,
      workPlotId: 8, publicHouseWorkRole: 'taverner'});
    const old = fixture.roster.occupants.find(p => p.householdMemberId === 'b9:head')!;
    expect(keeper).toMatchObject({id: old.id, name: old.name, homePlotId: old.homePlotId,
      workPlotId: old.workPlotId, householdMemberId: old.householdMemberId});
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('keeps street, retained counter and real home in agreement for all 24 hours', () => {
    const work = schedule(8), home = schedule(9);
    const keeper = generateTownRoster(town, seed, {nameFor: () => 'Fallback resident'})
      .occupants.find(p => p.householdMemberId === 'b9:head')!;
    expect(work.household).toEqual(fixture.source.household);
    expect(home.household).toEqual(work.household);
    for (let hour = 0; hour < 24; hour++) {
      const onDuty = hour >= 12 && hour < 23;
      const workStation = work.occupants.find(p => p.memberIndex === 0)!.stationsByHour[hour];
      const homeStation = home.occupants.find(p => p.memberIndex === 0)!.stationsByHour[hour];
      expect(occupantLocationAt(keeper, hour).plotId, `street at ${hour}`).toBe(onDuty ? 8 : 9);
      if (onDuty) {
        expect(workStation, `counter at ${hour}`).toMatchObject({activity: 'work'});
        expect(homeStation, `home at ${hour}`).toBeNull();
      } else {
        expect(workStation, `counter at ${hour}`).toBeNull();
        expect(homeStation, `home at ${hour}`).not.toBeNull();
      }
      for (const relative of work.occupants.filter(p => !p.visitor && p.memberIndex !== 0)) {
        expect(relative.stationsByHour[hour], `relative ${relative.memberIndex} at ${hour}`).toBeNull();
      }
    }
    expect(home.occupants[0].stationsByHour[23]).toMatchObject({activity: 'sleeping'});
  });

  it('preserves family routines, visitors and every furnishing when extending the owner shift', () => {
    const household = fixture.source.household as Parameters<typeof computeOccupancy>[1];
    const before = JSON.stringify({plan, household});
    const baseline = computeOccupancy(plan, household, {worksAtHome: true, workplaceOnly: true});
    const revised = computeOccupancy(plan, household, {worksAtHome: true, workplaceOnly: true,
      publicHouseWorkRole: 'taverner'});
    expect(revised.visitors).toEqual(baseline.visitors);
    expect(revised.visitorStationsByHour).toEqual(baseline.visitorStationsByHour);
    expect(revised.stationsByHour[19][0]).toMatchObject({activity: 'work', where: 'home'});
    expect(revised.stationsByHour[19][0].standingPosition).toBeDefined();
    expect(revised.stationsByHour[19][0].standingIssue).toBeUndefined();
    for (let h = 0; h < 24; h++) {
      expect(revised.stationsByHour[h].slice(1)).toEqual(baseline.stationsByHour[h].slice(1));
    }
    expect(JSON.stringify({plan, household})).toBe(before);
    const homeBaseline = computeOccupancy(homePlan, household, {worksAtHome: false});
    const homeRevised = computeOccupancy(homePlan, household, {worksAtHome: false, publicHouseWorkRole: 'taverner'});
    // An absent diner frees space, so the existing collision-aware allocator
    // may reseat relatives. Their activities and furniture targets stay intact;
    // requiring the old body coordinates would reserve space for an absent head.
    const routine = (row: typeof homeBaseline.stationsByHour[number]) => row.slice(1)
      .map(({standingPosition: _position, standingIssue: _issue, ...activity}) => activity);
    for (let h = 0; h < 24; h++) {
      expect(routine(homeRevised.stationsByHour[h])).toEqual(routine(homeBaseline.stationsByHour[h]));
    }
  });

  it('requires an actual ownership join and a public-house business', () => {
    expect(publicHouseWorkRoleForOwner({buildingType: 'inn', proprietorHomeId: 'b9'}, 'b9')).toBe('innkeeper');
    expect(publicHouseWorkRoleForOwner({buildingType: 'tavern', proprietorHomeId: 'other'}, 'b9')).toBeUndefined();
    expect(publicHouseWorkRoleForOwner({buildingType: 'smithy', proprietorHomeId: 'b9'}, 'b9')).toBeUndefined();
    expect(publicHouseWorkRoleForOwner({buildingType: 'tavern'}, 'b9')).toBeUndefined();
  });
});
