import {describe, expect, it, vi} from 'vitest';
import observedJson from './fixtures/observedBuildingSources.json';
import type {ObservedBuildingSource} from '../buildingSource';
// The recorded JSON is validated by capture/read and the signature assertions.
const observed = observedJson as unknown as {inn: ObservedBuildingSource};
import {canonicalTownSeedPath} from '../../town/canonicalTown';
import {applyFurnitureLayoutMoves, bedsideStorageMoves, roomFurnishingsReachable} from '../buildingLayoutRepair';
import {guestCirculationDoorMoves, guestCirculationReferencesAgree, planGuestCirculation} from '../guestCirculation';
import {planeZAt} from '../roofPlan';
import type {BlueprintPlan} from '../blueprintTypes';
import {buildingPlanSignature, captureObservedBuildingSource, readObservedBuildingSource} from '../buildingSource';
import {townReducer} from '@/state/reducers/townReducer';
import {createMockGameState} from '@/utils/core';
import * as generator from '../generateBuilding';
import * as historyProjection from '../../bridge/buildingHistoryParts';
import {buildInteriorParts} from '../../bridge/interiorParts';

function savedFixture() {
  const visit = observed.inn, plan = fixture();
  const position = {tileX: 4337, tileY: 0, xM: 433.757, zM: 431.55, yM: 6.279};
  const source = captureObservedBuildingSource({worldSeed: world, burgId: burg, plotId: 35, cellId: 4337,
    observedAt: '0351-01-07T01:00:00.000Z', position, historySignature: 'null', plan, household: visit.household,
    workplaceOnly: visit.workplaceOnly, manifests: visit.manifests,
    site: {xM: 436.42978683284485, zM: 433.71809859731644, surfaceY: 3.1092616601541345, rotationY: 0, doorZSign: -1}}, buildingPlanSignature(plan));
  const state = createMockGameState({worldSeed: world, playerCell: {cellId: 4337, localeCoords: null},
    party: [createMockGameState().party[0]], playerGroundPos: position,
    townSim: {[burg]: {burgId: burg, villagers: {}, lastSimDay: 6, nextVillagerId: 1,
      chronicle: {burgId: burg, events: [], nextEventId: 1}, buildingSources: {35: source},
      buildingDoors: {35: {'0:2:x:2.2860:-3.8100': false, '1:0:x:-3.8100:-0.7620': true}}}}});
  const action = {type: 'ADMIT_GUEST_CIRCULATION_REPAIR' as const,
    payload: {burgId: burg, plotId: 35, sourceSignature: source.planSignature, mountedSignature: source.planSignature}};
  return {source, state, action};
}

const world = 1793146029630, burg = 675;
function fixture() {
  const original = observed.inn.plan as BlueprintPlan;
  return applyFurnitureLayoutMoves(original, bedsideStorageMoves(original));
}
function publicRoute(plan: BlueprintPlan, target: number): boolean {
  const floor = plan.floors.find(f => f.level === 1)!;
  const allowed = new Set(floor.rooms.filter(r => r.purpose === 'corridor' || r.id === target).map(r => r.id));
  const landing = floor.rooms.find(r => r.cells.some(c => c.cx === 3 && c.cy === 2))!.id;
  if (!allowed.has(landing)) return false;
  const queue = [landing], seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) for (const d of floor.doors) {
    const next = d.a === queue[i] ? d.b : d.b === queue[i] ? d.a : -1;
    if (allowed.has(next) && !seen.has(next)) {seen.add(next); queue.push(next);}
  }
  return seen.has(target);
}
describe('retained left-return guest circulation', () => {
  it('provides a public landing route to every original guest room with all five beds and three chests retained', () => {
    const before = fixture(), original = structuredClone(before);
    expect(buildingPlanSignature(observed.inn.plan as BlueprintPlan)).toBe('blueprint-v1:d64zsi');
    expect(publicRoute(before, 0)).toBe(false);
    const reasons: string[] = [];
    const after = planGuestCirculation(before, canonicalTownSeedPath(world, burg), reason => reasons.push(reason));
    expect(after, reasons.join('; ')).toBeDefined();
    expect(guestCirculationReferencesAgree(before, after!)).toBe(true);
    for (const id of [0, 1, 2, 3]) {
      expect(publicRoute(after!, id)).toBe(true);
      expect(roomFurnishingsReachable(after!.floors.find(f => f.level === 1)!, id, .5)).toBe(true);
    }
    expect(after!.floors.find(f => f.level === 1)!.furnishings.filter(p => p.kind === 'bed')).toHaveLength(5);
    expect(before).toEqual(original);
  }, 60000);
  it('widens only two rear cells inside the original envelope while preserving stairs, entry and corrected room zero', () => {
    const before = fixture(), after = planGuestCirculation(before, canonicalTownSeedPath(world, burg))!;
    expect(after.footprintCells).toHaveLength(26);
    expect(after.widthFt).toBe(before.widthFt); expect(after.depthFt).toBe(before.depthFt);
    expect(after.footprintCells.some(c => c.cx === 4 && c.cy === 3)).toBe(false);
    expect(after.stairs).toEqual(before.stairs);
    expect(after.floors.find(f => f.level === 1)!.furnishings.slice(0, 2)).toEqual(before.floors.find(f => f.level === 1)!.furnishings.slice(0, 2));
    const moves = guestCirculationDoorMoves(before, after);
    const entry = moves.find(m => m.from.startsWith('0:2:'))!;
    expect(entry.to).toBe(entry.from);
  });
  it('keeps the saved wall patch at its exact physical line and the old reroofed region on the same roof surface', () => {
    const before = fixture(), after = planGuestCirculation(before, canonicalTownSeedPath(world, burg))!;
    expect(after.backstory!.historySignature).toBe(before.backstory!.historySignature);
    // Native rebuilding formerly threw here: the old patch now decorates an
    // internal masonry wall. Exercise the complete production parts bridge.
    const parts = buildInteriorParts({id: 35, role: 'inn', storeys: 2,
      footprint: [[0, 0], [30, 0], [30, 25], [0, 25]]}, canonicalTownSeedPath(world, burg), 6.096, [], after);
    expect(parts.filter(p => p.historyKind === 'patched-wall')).toHaveLength(3);
    expect(parts.every(p => [p.x, p.z, p.w, p.d, p.h].every(Number.isFinite))).toBe(true);
    before.backstory!.features.forEach((old, i) => {
      const next = after.backstory!.features[i];
      expect(next.kind).toBe(old.kind);
      if ('wallRunIndex' in old && 'wallRunIndex' in next) {
        const a = before.floors.find(f => f.level === old.floorLevel)!.wallRuns[old.wallRunIndex];
        const b = after.floors.find(f => f.level === next.floorLevel)!.wallRuns[next.wallRunIndex];
        expect([b.x1, b.y1, b.x2, b.y2, b.nx, b.ny, b.thicknessFt]).toEqual([a.x1, a.y1, a.x2, a.y2, a.nx, a.ny, a.thicknessFt]);
      } else if (old.kind === 're-roofed' && next.kind === 're-roofed') {
        for (const [x, y, z] of before.roof!.planes[old.planeIndex].pts)
          expect(planeZAt(after.roof!.planes[next.planeIndex], x, y)).toBeCloseTo(z);
      }
    });
  });
  it('rejects unsupported shapes, attached sides, history and lost furnishing references rather than applying a generic house', () => {
    const before = fixture(), seed = canonicalTownSeedPath(world, burg);
    const other = structuredClone(before); other.widthFt += 5;
    expect(planGuestCirculation(other, seed)).toBeUndefined();
    other.widthFt = 30; other.ensemble!.partyWallLeft = true;
    expect(planGuestCirculation(other, seed)).toBeUndefined();
    const corrupt = structuredClone(before); corrupt.floors[0].furnishings.reverse();
    expect(guestCirculationReferencesAgree(before, corrupt)).toBe(false);
  });
  it('defers inside and preserves all original source/household/goods and coordinates on outside adoption', () => {
    const {source, state, action} = savedFixture(), before = structuredClone(state);
    expect(townReducer(state, action)).toEqual({});
    expect(state).toEqual(before);
    const outside = {...state, playerGroundPos: {...state.playerGroundPos!, zM: 426}};
    const result = townReducer(outside, action);
    expect(Object.keys(result)).toEqual(['townSim']);
    const recorded = result.townSim![burg].buildingSources![35];
    const {circulationRepair, ...original} = recorded;
    expect(original).toEqual(source); expect(circulationRepair).toBeDefined();
    const loaded = {...outside, townSim: JSON.parse(JSON.stringify(result.townSim))};
    const visit = readObservedBuildingSource({worldSeed: world, burgId: burg, source: loaded.townSim[burg].buildingSources[35]}, 35);
    expect(visit.manifests).toEqual(source.manifests); expect(visit.household).toEqual(source.household);
    expect(loaded.playerGroundPos).toEqual(outside.playerGroundPos);
    expect(loaded.townSim[burg].buildingDoors[35]['1:0:x:-3.8100:-0.7620']).toBe(true);
    const moved = circulationRepair!.doorMoves.find(d => d.from === '1:0:x:-3.8100:-0.7620')!;
    expect(loaded.townSim[burg].buildingDoors[35][moved.to]).toBe(true);
    expect(townReducer(loaded, action)).toEqual({});
    expect(outside.townSim[burg].buildingSources![35]).toEqual(source);
  });
  it('refuses a proposal the production history projector cannot draw before changing the save', () => {
    const {state, action} = savedFixture(), outside = {...state, playerGroundPos: {...state.playerGroundPos!, zM: 426}};
    const original = structuredClone(outside);
    const projection = vi.spyOn(historyProjection, 'buildBuildingHistoryParts').mockImplementation(() => {throw new Error('unsupported history surface');});
    try { expect(townReducer(outside, action)).toEqual({}); expect(outside).toEqual(original); }
    finally { projection.mockRestore(); }
  });
  it('reads the frozen admitted plan even if a future generator would replace the entire interior', () => {
    const {state, action} = savedFixture(), outside = {...state, playerGroundPos: {...state.playerGroundPos!, zM: 426}};
    const source = townReducer(outside, action).townSim![burg].buildingSources![35];
    const generate = vi.spyOn(generator, 'generateBuilding').mockImplementation(() => {throw new Error('new generator must not run');});
    try {
      expect(readObservedBuildingSource({worldSeed: world, burgId: burg, source}, 35).plan).toEqual(source.circulationRepair!.plan);
      expect(generate).not.toHaveBeenCalled();
    } finally {generate.mockRestore();}
    const bad = structuredClone(source); bad.circulationRepair!.plan.floors[2].furnishings[0].kind = 'chest';
    bad.circulationRepair!.planSignature = buildingPlanSignature(bad.circulationRepair!.plan);
    expect(() => readObservedBuildingSource({worldSeed: world, burgId: burg, source: bad}, 35)).toThrow('original references');
  });
  it('refuses stale source or mounted signatures, missing height and unadmitted companion positions', () => {
    const {state, action} = savedFixture(), outside = {...state, playerGroundPos: {...state.playerGroundPos!, zM: 426}};
    for (const other of [{...outside, worldSeed: 18}, {...outside, party: [...state.party, state.party[0]]},
      {...outside, playerGroundPos: {...outside.playerGroundPos, yM: undefined}}]) expect(townReducer(other, action)).toEqual({});
    expect(townReducer(outside, {...action, payload: {...action.payload, mountedSignature: 'different'}})).toEqual({});
  });
});
