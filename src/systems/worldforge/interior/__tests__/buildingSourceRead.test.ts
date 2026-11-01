import {afterEach, describe, expect, it, vi} from 'vitest';
import {captureObservedBuildingSource, buildingPlanSignature, readObservedBuildingSource} from '../buildingSource';
import * as generator from '../generateBuilding';
import {blueprintForPlot, type InteriorPlotInput} from '../generateInterior';
import {rootSeedPath, childSeedPath, streamPath} from '../../seedPath';
import {applyHistory, snapshotBuildingHistory} from '../buildingEventHistory';
import type {BuildingEvent} from '../blueprintTypes';
import {generateHousehold} from '../../town/household';
import {occupancyScheduleForPlot} from '../../bridge/buildingOccupancy';
import {buildInteriorParts} from '../../bridge/interiorParts';
import {townBuildingVisit} from '../../../../components/Worldforge/townBuildingVisit';
import {compactTownBuildingHistories} from '../../townsim/buildingHistoryCompaction';
import type {TownSimState} from '../../townsim/types';
import {briefFromHousehold} from '../../town/householdBrief';

function fixture(history: BuildingEvent[] = [], worldSeed = 17) {
  const burgId = 675, plotId = 35;
  const townSeed = streamPath(childSeedPath(rootSeedPath(worldSeed), `burg:${burgId}`), 'town');
  const owner = 'home-34', household = generateHousehold(townSeed, owner, 4, 'townhouse', {role: 'proprietor', workplaceType: 'inn'});
  const plot: InteriorPlotInput = {id: plotId, role: 'inn', buildingType: 'inn', storeys: 2,
    footprint: [[0, 0], [35, 0], [35, 30], [0, 30]], eventLog: history,
    household: {...briefFromHousehold(household, {wealth: 'common', worksAtHome: true}), residential: false}};
  const plan = structuredClone(blueprintForPlot(plot, townSeed));
  const containers = plan.floors.flatMap(f => f.furnishings.flatMap((p, i) => p.kind === 'chest'
    ? [{level: f.level, furnishingIndex: i, kind: p.kind, ownerHomeId: owner, entries: [{itemId: 'silver_piece', qty: 3}]}] : []));
  const source = captureObservedBuildingSource({worldSeed, burgId, plotId, cellId: 4337,
    observedAt: '0351-01-07T00:11:23.000Z', position: {tileX: 4337, tileY: 0, xM: 434, zM: 432, yM: 6.279},
    site: {xM: 436, zM: 434, surfaceY: 3, rotationY: 0, doorZSign: -1},
    historySignature: JSON.stringify(history), plan, household, workplaceOnly: true, manifests: containers}, buildingPlanSignature(plan));
  return {source, context: {worldSeed, burgId, source}, plot, townSeed, plotId};
}
afterEach(() => vi.restoreAllMocks());

describe('retained building readers', () => {
  it('keeps physical schedules, inspected ownership and projected furniture on the same retained plan', () => {
    const f = fixture([], 1793146029630), input = {...f.plot, retainedSource: f.context};
    const population = {buildingType: 'inn' as const, residential: false, occupants: 4, homeId: 'home-34', district: 'common' as const};
    const schedule = occupancyScheduleForPlot(population, [population], input, f.townSeed, f.townSeed, f.source.plan)!;
    expect(schedule.household).toEqual(f.source.household);
    const visit = townBuildingVisit(f.context.worldSeed, f.context.burgId, f.plotId, [], f.source);
    expect(visit.plan).toEqual(f.source.plan); expect(visit.manifests).toEqual(f.source.manifests);
    expect(visit.household).toEqual(schedule.household); expect(visit.workplaceOnly).toBe(true);
    expect(buildInteriorParts(input, f.townSeed, 6, [], f.source.plan).length).toBeGreaterThan(0);
    const wrong = structuredClone(f.source.plan); wrong.widthFt += 5;
    expect(() => occupancyScheduleForPlot(population, [population], input, f.townSeed, f.townSeed, wrong)).toThrow('same building source');
    expect(() => buildInteriorParts(input, f.townSeed, 6, [], wrong)).toThrow('same building source');
  });

  it('defers a fold before the observation and retains pending structural intent', () => {
    const events: BuildingEvent[] = Array.from({length: 30}, (_, i) => ({day: i, kind: 'abandonment'}));
    const f = fixture(events, 1793146029630);
    const state: TownSimState = {burgId: f.context.burgId, villagers: {}, chronicle: {burgId: f.context.burgId, events: [], nextEventId: 1},
      lastSimDay: 30, nextVillagerId: 1, buildingEvents: {[f.plotId]: events}, buildingSources: {[f.plotId]: f.source}};
    expect(compactTownBuildingHistories(state, f.context.worldSeed).buildingEvents).toEqual(state.buildingEvents);
    const extended: BuildingEvent[] = [...events, {day: 31, kind: 'extension', payload: {phase: 1, mass: {kind: 'wing', x: 7, y: 0, w: 2, h: 2}}},
      ...Array.from({length: 17}, (_, i) => ({day: 32 + i, kind: 'reoccupation' as const}))];
    const pending = {...state, buildingEvents: {[f.plotId]: extended}};
    const before = structuredClone(pending);
    expect(compactTownBuildingHistories(pending, f.context.worldSeed)).toEqual(before);
    expect(pending).toEqual(before);
  });

  it('keeps the played plan when a newer generator would return a different layout', () => {
    const f = fixture(), candidate = structuredClone(f.source.plan);
    candidate.widthFt += 5; candidate.floors[0].furnishings.reverse();
    const generate = vi.spyOn(generator, 'generateBuilding').mockReturnValue(candidate);
    const retained = blueprintForPlot({...f.plot, retainedSource: f.context}, f.townSeed);
    expect(retained).toEqual(f.source.plan); expect(generate).not.toHaveBeenCalled();
    expect(blueprintForPlot(f.plot, f.townSeed)).toBe(candidate);
  });

  it('returns independent copies of the original geometry and owned contents', () => {
    const f = fixture(), before = structuredClone(f.source);
    const read = readObservedBuildingSource(f.context, f.plotId, [], f.townSeed);
    expect(read.plan).toEqual(before.plan); expect(read.manifests).toEqual(before.manifests);
    expect(read.household).toEqual(before.household);
    read.plan.widthFt += 5; read.manifests[0].entries[0].qty = 999;
    expect(f.source).toEqual(before);
  });

  it('replays appended condition events once, preserving rooms, furniture and goods', () => {
    const fire: BuildingEvent = {day: 6, kind: 'fire-damage', payload: {incidentId: 'fire-1', severity: 1}};
    const f = fixture([fire]), current: BuildingEvent[] = [fire, {day: 7, kind: 'abandonment', payload: {boardedFraction: .5}}];
    const before = structuredClone(f.source), read = readObservedBuildingSource(f.context, f.plotId, current);
    const expected = applyHistory(f.source.plan, current);
    expect(read.plan.liveHistory).toEqual(expected.liveHistory);
    expect(read.plan.liveHistory?.eventsApplied).toBe(2);
    expect(read.plan.floors).toEqual(before.plan.floors); expect(read.manifests).toEqual(before.manifests);
    expect(f.source).toEqual(before);
  });

  it('accepts equivalent history compaction without replacing the observed source', () => {
    const events: BuildingEvent[] = [{day: 6, kind: 'abandonment'}];
    const f = fixture(events), folded = snapshotBuildingHistory(f.source.plan, events);
    expect(readObservedBuildingSource(f.context, f.plotId, folded).plan).toEqual(f.source.plan);
  });

  it('refuses a new structural mass and leaves its event and the retained source intact', () => {
    const f = fixture(), current: BuildingEvent[] = [{day: 7, kind: 'extension', payload: {
      phase: 1, mass: {kind: 'wing', x: 7, y: 0, w: 2, h: 2}}}];
    const before = structuredClone({source: f.source, current});
    expect(() => readObservedBuildingSource(f.context, f.plotId, current)).toThrow('compatible retained-source migration');
    expect({source: f.source, current}).toEqual(before);
  });

  it('refuses other worlds even with aliased 32-bit seed paths, changed places and corrupted records', () => {
    const f = fixture();
    expect(() => readObservedBuildingSource({...f.context, worldSeed: 17 + 2 ** 32}, f.plotId, [])).toThrow('does not match');
    expect(() => readObservedBuildingSource(f.context, 36, [])).toThrow('does not match');
    expect(() => readObservedBuildingSource(f.context, f.plotId, [], rootSeedPath(17))).toThrow('does not match');
    const bad = structuredClone(f.source); bad.manifests[0].furnishingIndex = 999;
    expect(() => readObservedBuildingSource({...f.context, source: bad}, f.plotId, [])).toThrow('contents no longer match');
  });

  it('refuses removal or replacement of previously observed history', () => {
    const f = fixture([{day: 6, kind: 'abandonment'}]);
    expect(() => readObservedBuildingSource(f.context, f.plotId, [])).toThrow('history has been replaced');
    expect(() => readObservedBuildingSource(f.context, f.plotId, [{day: 6, kind: 'renovation'}])).toThrow('history has been replaced');
  });
});
