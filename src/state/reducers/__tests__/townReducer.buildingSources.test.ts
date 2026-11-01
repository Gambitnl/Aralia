import {describe, expect, it} from 'vitest';
import {townReducer} from '../townReducer';
import {createMockGameState} from '@/utils/core';
import {buildingPlanSignature, captureObservedBuildingSource} from '@/systems/worldforge/interior/buildingSource';
import {generateBuilding} from '@/systems/worldforge/interior/generateBuilding';
import {rootSeedPath} from '@/systems/worldforge/seedPath';
import {advanceTown} from '@/systems/worldforge/townsim/townSimRegistry';

function fixture() {
  const position = {tileX: 4337, tileY: 0, xM: 434, zM: 432, yM: 6.279};
  const town = {burgId: 675, villagers: {}, lastSimDay: 6, nextVillagerId: 1,
    chronicle: {burgId: 675, events: [], nextEventId: 1},
    buildingDoors: {35: {'0:0:x:0.0000:0.0000': false}}};
  const state = createMockGameState({worldSeed: 17, playerCell: {cellId: 4337, localeCoords: null},
    playerGroundPos: position, townSim: {675: town, 676: {...town, burgId: 676}}});
  const plan = generateBuilding({buildingId: 35, type: 'inn', seedPath: rootSeedPath(17), storeys: 2});
  const source = captureObservedBuildingSource({worldSeed: 17, burgId: 675, plotId: 35, cellId: 4337,
    observedAt: state.gameTime.toISOString(), position, historySignature: 'null', plan,
    workplaceOnly: true, manifests: [],
    site: {xM: 436, zM: 434, surfaceY: 3, rotationY: 0, doorZSign: -1}}, buildingPlanSignature(plan));
  return {state, source};
}

describe('observed building source in saved town state', () => {
  it('adds only the first selected plot observation and preserves every prior town/player field', () => {
    const {state, source} = fixture(), before = structuredClone(state);
    const result = townReducer(state, {type: 'RETAIN_OBSERVED_BUILDING_SOURCE', payload: source});
    expect(Object.keys(result)).toEqual(['townSim']);
    expect(state).toEqual(before);
    expect(result.townSim![676]).toBe(state.townSim[676]);
    const {buildingSources, ...oldTown} = result.townSim![675];
    expect(oldTown).toEqual(state.townSim[675]);
    expect(Object.keys(buildingSources!)).toEqual(['35']);
    expect(buildingSources![35]).toEqual(source);
    expect(buildingSources![35]).not.toBe(source);
    const loaded = {...state, townSim: JSON.parse(JSON.stringify(result.townSim))};
    const changed = structuredClone(source); changed.manifests.push({level: 0, furnishingIndex: 0,
      kind: 'chest', ownerHomeId: 'other', entries: [{itemId: 'gold_piece', qty: 900}]});
    expect(townReducer(loaded, {type: 'RETAIN_OBSERVED_BUILDING_SOURCE', payload: changed})).toEqual({});
    expect(loaded.townSim[675].buildingSources[35]).toEqual(source);
  });

  it('refuses stale world, cell, feet, history and untracked-town capture without changing anything', () => {
    const {state, source} = fixture();
    for (const modified of [
      {...state, worldSeed: 18}, {...state, playerCell: {cellId: 1, localeCoords: null}},
      {...state, playerGroundPos: {...state.playerGroundPos!, xM: 450}},
      {...state, playerGroundPos: {...state.playerGroundPos!, yM: undefined}},
      {...state, townSim: {}},
    ]) expect(townReducer(modified, {type: 'RETAIN_OBSERVED_BUILDING_SOURCE', payload: source})).toEqual({});
    expect(townReducer(state, {type: 'RETAIN_OBSERVED_BUILDING_SOURCE', payload: {...source, historySignature: 'changed'}})).toEqual({});
  });

  it('retains the observation while the existing daily town simulation continues', () => {
    const {state, source} = fixture();
    const captured = townReducer(state, {type: 'RETAIN_OBSERVED_BUILDING_SOURCE', payload: source}).townSim![675];
    const before = structuredClone(captured);
    const advanced = advanceTown(captured, state.worldSeed, 10);
    expect(advanced.lastSimDay).toBe(10);
    expect(advanced.buildingSources?.[35]).toEqual(source);
    expect(advanced.buildingDoors).toEqual(before.buildingDoors);
    expect(captured).toEqual(before);
  });
});
