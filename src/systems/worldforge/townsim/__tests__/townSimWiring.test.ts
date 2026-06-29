/**
 * Integration: the ADVANCE_TIME daily loop advances tracked towns (Plan C2).
 */
import { worldReducer } from '../../../../state/reducers/worldReducer';
import { createMockGameState } from '../../../../utils/core/factories';
import { getGameDay } from '../../../../utils/core';
import type { TownSimState, LivingVillager } from '../types';

function villager(p: Partial<LivingVillager> & { occupantId: number }): LivingVillager {
  return {
    name: `V${p.occupantId}`,
    race: 'Human',
    bornDay: -30 * 365,
    parentIds: [],
    childIds: [],
    homePlotId: 1,
    wealth: 50,
    ...p,
  };
}

function townState(burgId: number, lastSimDay: number): TownSimState {
  return {
    burgId,
    villagers: { 1: villager({ occupantId: 1 }), 2: villager({ occupantId: 2 }) },
    chronicle: { burgId, events: [], nextEventId: 1 },
    lastSimDay,
    nextVillagerId: 3,
  };
}

describe('ADVANCE_TIME town-sim wiring', () => {
  it('advances every tracked town to the new game day when days pass', () => {
    const base = createMockGameState();
    const startDay = getGameDay(base.gameTime);
    const state = { ...base, townSim: { 1: townState(1, startDay) } };

    const next = worldReducer(state, { type: 'ADVANCE_TIME', payload: { seconds: 3 * 86400 } } as never);

    const newDay = getGameDay(new Date(base.gameTime.getTime() + 3 * 86400 * 1000));
    expect(next.townSim).toBeDefined();
    expect(next.townSim![1].lastSimDay).toBe(newDay);
    expect(newDay - startDay).toBe(3);
  });

  it('is a no-op for an empty registry (no towns tracked yet)', () => {
    const base = createMockGameState();
    const next = worldReducer(base, { type: 'ADVANCE_TIME', payload: { seconds: 5 * 86400 } } as never);
    expect(next.townSim).toEqual({});
  });

  it('does not advance towns on a sub-day tick', () => {
    const base = createMockGameState();
    const startDay = getGameDay(base.gameTime);
    const state = { ...base, townSim: { 1: townState(1, startDay) } };
    const next = worldReducer(state, { type: 'ADVANCE_TIME', payload: { seconds: 60 } } as never);
    expect(next.townSim![1].lastSimDay).toBe(startDay); // no day crossed → untouched
  });
});
