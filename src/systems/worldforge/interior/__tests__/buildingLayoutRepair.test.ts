import {describe, expect, it} from 'vitest';
import {bedsideStorageMoves, applyFurnitureLayoutMoves, outsideLayoutRepairEnvelope, FURNITURE_REPAIR_RECIPE} from '../buildingLayoutRepair';
import {buildingPlanSignature, captureObservedBuildingSource, readObservedBuildingSource} from '../buildingSource';
import {furnishingFootprint} from '../householdFurnish';
import type {BlueprintPlan} from '../blueprintTypes';
import {townReducer} from '@/state/reducers/townReducer';
import {createMockGameState} from '@/utils/core';

function fixture() {
  const plan: BlueprintPlan = {buildingId: 35, type: 'inn', widthFt: 10, depthFt: 10,
    footprintCells: [{cx: 0, cy: 0}, {cx: 1, cy: 0}, {cx: 0, cy: 1}, {cx: 1, cy: 1}], masses: [], stairs: [],
    household: {homeId: 'b34', slots: [], trade: 'innkeeper', worksAtHome: true, residential: false, wealth: 'common'},
    floors: [{level: 1, rooms: [{id: 0, purpose: 'guest-room', isMain: true, isCorridor: false, area: 4,
      cells: [{cx: 0, cy: 0}, {cx: 1, cy: 0}, {cx: 0, cy: 1}, {cx: 1, cy: 1}], anchor: {cx: 0, cy: 0}, bbox: {x: 0, y: 0, w: 10, d: 10}}],
      doors: [{a: 0, b: 1, x: 10, y: 7.5, axis: 'y', isEntry: false, swingInto: 1, openDir: {nx: 1, ny: 0}}],
      windows: [], walls: [], wallRuns: [], furnishings: [
        {kind: 'bed', roomId: 0, x: 1.9404199475065615, y: 3.580839895013123, rotation: 0},
        {kind: 'chest', roomId: 0, x: 6.284251968503937, y: 1.9404199475065615, rotation: 90},
      ]}]};
  const position = {tileX: 4337, tileY: 0, xM: 0, zM: 0, yM: 3};
  const source = captureObservedBuildingSource({worldSeed: 17, burgId: 675, plotId: 35, cellId: 4337,
    observedAt: '0351-01-07T00:00:00.000Z', historySignature: 'null', plan, position,
    site: {xM: 0, zM: 0, surfaceY: 0, rotationY: 0, doorZSign: -1}, workplaceOnly: true,
    manifests: [{level: 1, furnishingIndex: 1, kind: 'chest', ownerHomeId: 'b34', entries: [{itemId: 'gold_piece', qty: 2}]}]}, buildingPlanSignature(plan));
  const state = createMockGameState({worldSeed: 17, party: [createMockGameState().party[0]], playerGroundPos: position, playerCell: {cellId: 4337, localeCoords: null},
    townSim: {675: {burgId: 675, villagers: {}, lastSimDay: 6, nextVillagerId: 1,
      chronicle: {burgId: 675, events: [], nextEventId: 1}, buildingSources: {35: source}}}});
  const action = {type: 'ADMIT_BUILDING_LAYOUT_REPAIR' as const, payload: {burgId: 675, plotId: 35, sourceSignature: source.planSignature}};
  return {plan, source, state, action};
}

describe('explicit bedside storage correction', () => {
  it('opens the played 0.52m gap beyond 0.8m without changing a bed, room, door or container reference', () => {
    const {plan} = fixture(), before = structuredClone(plan), moves = bedsideStorageMoves(plan);
    expect(moves).toHaveLength(1); expect(moves[0]).toMatchObject({level: 1, index: 1, roomId: 0, kind: 'chest'});
    const result = applyFurnitureLayoutMoves(plan, moves), bed = furnishingFootprint(result.floors[0].furnishings[0]);
    expect((furnishingFootprint(result.floors[0].furnishings[1]).left - bed.right) * .3048).toBeGreaterThan(1.2);
    expect(result.floors[0].furnishings[0]).toEqual(plan.floors[0].furnishings[0]);
    expect(result.floors[0].rooms).toEqual(plan.floors[0].rooms); expect(result.floors[0].doors).toEqual(plan.floors[0].doors);
    expect(plan).toEqual(before); expect(bedsideStorageMoves(result)).toEqual([]);
  });
  it('retains an unresolved layout when the opposite wall is a doorway or stair approach', () => {
    const {plan} = fixture();
    plan.floors[0].doors[0].y = 2.5;
    expect(bedsideStorageMoves(plan)).toEqual([]);
    plan.floors[0].doors[0].y = 7.5;
    plan.stairs = [{fromLevel: 0, x: 7.5, y: 2.5}];
    expect(bedsideStorageMoves(plan)).toEqual([]);
  });
  it('rejects a corrupted saved move rather than moving a different furnishing', () => {
    const {plan} = fixture(), moves = bedsideStorageMoves(plan); moves[0].index = 0;
    expect(() => applyFurnitureLayoutMoves(plan, moves)).toThrow('no longer matches');
  });
  it('does not treat an L-shaped room bounding box as usable furniture space', () => {
    const {plan} = fixture(), room = plan.floors[0].rooms[0];
    room.cells.push({cx: 2, cy: 1}); room.area = room.cells.length; room.bbox.w = 15;
    plan.widthFt = 15; plan.footprintCells = [...room.cells];
    expect(bedsideStorageMoves(plan)).toEqual([]);
  });
  it('keeps the protected envelope in the correct frame for rotated and reflected sites', () => {
    const {plan} = fixture();
    for (const rotationY of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const doorZSign of [-1, 1]) {
      const site = {xM: 100, zM: 200, rotationY, doorZSign};
      const world = (x: number, z: number) => ({xM: site.xM + x * Math.cos(rotationY) + z * Math.sin(rotationY),
        zM: site.zM - x * Math.sin(rotationY) + z * Math.cos(rotationY), yM: 4});
      expect(outsideLayoutRepairEnvelope(plan, site, world(0, 0))).toBe(false);
      expect(outsideLayoutRepairEnvelope(plan, site, world(2, 0))).toBe(false);
      expect(outsideLayoutRepairEnvelope(plan, site, world(5, 0))).toBe(true);
    }
  });
  it('defers inside, on stairs, near the exterior wall and without measured height', () => {
    const {plan, source, state, action} = fixture();
    for (const position of [state.playerGroundPos, {...state.playerGroundPos!, yM: 1.5},
      {...state.playerGroundPos!, xM: 3}, {...state.playerGroundPos!, xM: 20, yM: undefined}]) {
      expect(outsideLayoutRepairEnvelope(plan, source.site, position)).toBe(false);
      expect(townReducer({...state, playerGroundPos: position}, action)).toEqual({});
    }
  });
  it('records a once-only correction outside and preserves source evidence, player state and owned contents after JSON reload', () => {
    const {source, state, action} = fixture(), outside = {...state, playerGroundPos: {...state.playerGroundPos!, xM: 20}};
    const before = structuredClone(outside), result = townReducer(outside, action);
    expect(Object.keys(result)).toEqual(['townSim']); expect(outside).toEqual(before);
    const recorded = result.townSim![675].buildingSources![35];
    const {furnishingRepair, ...original} = recorded; expect(original).toEqual(source);
    expect(furnishingRepair?.recipe).toBe(FURNITURE_REPAIR_RECIPE);
    const loaded = {...outside, townSim: JSON.parse(JSON.stringify(result.townSim))};
    expect(townReducer(loaded, action)).toEqual({});
    const visit = readObservedBuildingSource({worldSeed: 17, burgId: 675, source: loaded.townSim[675].buildingSources[35]}, 35);
    expect(visit.manifests).toEqual(source.manifests); expect(visit.plan.floors[0].furnishings[1].x).toBeGreaterThan(8.7);
    expect(loaded.playerGroundPos).toEqual(outside.playerGroundPos);
  });
  it('refuses changed source/world and unadmitted multi-person party positions', () => {
    const {state, action} = fixture(), outside = {...state, playerGroundPos: {...state.playerGroundPos!, xM: 20}};
    expect(townReducer({...outside, worldSeed: 18}, action)).toEqual({});
    expect(townReducer(outside, {...action, payload: {...action.payload, sourceSignature: 'other'}})).toEqual({});
    expect(townReducer({...outside, party: [...state.party, state.party[0]]}, action)).toEqual({});
  });
});
