import { describe, expect, it } from 'vitest';
import { townReducer } from '../townReducer';
import { createMockGameState } from '@/utils/core';
import type { AppAction } from '../../actionTypes';

const id = '0:0:x:-3.8100:-2.2860';
const command = (open: boolean): Extract<AppAction, { type: 'SET_TOWN_BUILDING_DOOR' }> => ({ type: 'SET_TOWN_BUILDING_DOOR', payload: { burgId: 10, plotId: 1, doorId: id, open } });
function fixture() {
  return createMockGameState({ townSim: {
    10: { burgId: 10, villagers: {}, lastSimDay: 0, nextVillagerId: 1, chronicle: { burgId: 10, events: [], nextEventId: 1 } },
    11: { burgId: 11, villagers: {}, lastSimDay: 0, nextVillagerId: 1, chronicle: { burgId: 11, events: [], nextEventId: 1 } },
  } });
}
describe('saved town door state', () => {
  it('starts old saves closed, changes only the selected town/plot/door, and closes after a round trip', () => {
    const state = fixture(), result = townReducer(state, command(true));
    expect(state.townSim[10].buildingDoors).toBeUndefined();
    expect(result.townSim![10].buildingDoors?.[1]?.[id]).toBe(true);
    expect(result.townSim![11]).toBe(state.townSim[11]);
    expect(result.townSim![10].villagers).toBe(state.townSim[10].villagers);
    const loaded = { ...state, ...JSON.parse(JSON.stringify(result)) };
    expect(townReducer(loaded, command(true))).toEqual({});
    const closed = townReducer(loaded, command(false));
    expect(closed.townSim![10].buildingDoors?.[1]?.[id]).toBe(false);
    expect(loaded.townSim[10].buildingDoors[1][id]).toBe(true);
  });
  it('rejects unknown towns and malformed identities without modifying state', () => {
    const state = fixture();
    expect(townReducer(state, command(false))).toEqual({});
    for (const override of [{ burgId: 99 }, { plotId: -1 }, { doorId: '__proto__' }, { doorId: 'not-a-door' }]) {
      const action = command(true);
      expect(townReducer(state, { ...action, payload: { ...action.payload, ...override } })).toEqual({});
    }
  });
});
