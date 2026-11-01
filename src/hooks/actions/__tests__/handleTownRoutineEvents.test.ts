/**
 * @file handleTownRoutineEvents.test.ts
 * Acceptance for the Worldforge routine bridge (agora-13a9.1): advancing the
 * world clock across an hour boundary in a town WITH a roster must emit at
 * least one NPC location event.
 *
 * The burg resolver is stubbed because the real one reads the FMG atlas; the
 * roster is injected for the same reason. Everything under test — the schedule
 * diff and the event emission — is the real code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTownRoutineEvents, townRoutineChanges } from '../handleWorldEvents';
import type React from 'react';
import type { GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import type { TownRoster } from '../../../systems/worldforge/roster/types';

vi.mock('../../../systems/worldforge/townsim/chronicleForLocation', () => ({
  burgIdForLocation: (input: { cellId?: number | null }) =>
    input.cellId === 42 ? 7 : undefined,
}));

const ROSTER: TownRoster = {
  burgId: 7,
  occupants: [
    { id: 1, name: 'Hedda Barrow', ageBand: 'adult', homePlotId: 3, workPlotId: 11, occupation: 'shopkeeper' },
    { id: 2, name: 'Orin Fell', ageBand: 'adult', homePlotId: 4, workPlotId: 12, occupation: 'artisan' },
    { id: 3, name: 'Bess Tully', ageBand: 'child', homePlotId: 3, occupation: 'resident' },
  ],
};

function stateAt(hour: number, cellId: number | null): GameState {
  const gameTime = new Date(2024, 0, 1, hour, 0, 0);
  return {
    gameTime,
    worldSeed: 1234,
    playerCell: cellId === null ? null : { cellId, localeCoords: null },
  } as unknown as GameState;
}

describe('handleTownRoutineEvents', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  const dispatchFn = () => dispatch as unknown as React.Dispatch<AppAction>;

  beforeEach(() => {
    dispatch = vi.fn();
  });

  it('emits at least one NPC location event when an hour passes in a town with a roster', async () => {
    // 03:00 (everyone asleep at home) -> 04:00 is still night, so advance into
    // the working day: 11:00, one hour on from 10:00.
    const changes = await handleTownRoutineEvents(stateAt(12, 42), dispatchFn(), {
      hoursAdvanced: 8,
      resolveRoster: () => ROSTER,
    });

    expect(changes.length).toBeGreaterThan(0);
    expect(dispatch).toHaveBeenCalled();

    const entry = dispatch.mock.calls[0][0];
    expect(entry.type).toBe('ADD_DISCOVERY_ENTRY');
    expect(entry.payload.title).toBe('Town Routine');
    // The event carries the concrete plot the NPC moved to.
    const plotFlag = entry.payload.flags.find((f: { key: string }) => f.key === 'plotId');
    expect(typeof plotFlag.value).toBe('number');
    const occupantFlag = entry.payload.flags.find((f: { key: string }) => f.key === 'occupantId');
    expect(ROSTER.occupants.some(o => o.id === occupantFlag.value)).toBe(true);
  });

  it('retains the complete year351 observation date across an overnight schedule change', async () => {
    const state=stateAt(3,42);state.gameTime=new Date('0351-01-04T03:39:16.000Z');
    const changes=await handleTownRoutineEvents(state,dispatchFn(),{hoursAdvanced:8,resolveRoster:()=>ROSTER});
    expect(changes.length).toBeGreaterThan(0);
    for(const [action]of dispatch.mock.calls){
      expect(action.payload.gameTime).toBe('0351-01-04T03:39:16.000Z');
      expect(action.payload.source.id).toBe('burg_7');
    }
    expect(state.gameTime.toISOString()).toBe('0351-01-04T03:39:16.000Z');
  });
  it('emits nothing when the player is not standing in a burg', async () => {
    const changes = await handleTownRoutineEvents(stateAt(12, null), dispatchFn(), {
      hoursAdvanced: 8,
      resolveRoster: () => ROSTER,
    });
    expect(changes).toEqual([]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('emits nothing when the advance stays inside one hour', async () => {
    // 12:15 -> 12:30: the clock moved but never crossed an hour boundary, so no
    // schedule block can have changed.
    const inHour = stateAt(12, 42);
    (inHour as { gameTime: Date }).gameTime = new Date(2024, 0, 1, 12, 30, 0);
    const changes = await handleTownRoutineEvents(inHour, dispatchFn(), {
      hoursAdvanced: 0.25,
      resolveRoster: () => ROSTER,
    });
    expect(changes).toEqual([]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  // GG-515: the log read left.getHours() / arrived.getHours(), the host's
  // timezone, while the game clock is UTC (gameClock.ts, timeUtils.ts). On a
  // UTC-5 host a 06:30 -> 07:30 game advance was read as 01 -> 02 and the
  // morning work starts were lost.
  it('reads the game clock in UTC whatever the host timezone', async () => {
    const savedTz = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const state = stateAt(12, 42);
      (state as { gameTime: Date }).gameTime = new Date(Date.UTC(2024, 0, 1, 7, 30, 0));
      const changes = await handleTownRoutineEvents(state, dispatchFn(), {
        hoursAdvanced: 1,
        resolveRoster: () => ROSTER,
      });
      expect(changes).toEqual(townRoutineChanges(ROSTER, 6, 7));
    } finally {
      if (savedTz === undefined) delete process.env.TZ;
      else process.env.TZ = savedTz;
    }
  });

  it('townRoutineChanges is pure, deterministic and capped', () => {
    const a = townRoutineChanges(ROSTER, 4, 12);
    const b = townRoutineChanges(ROSTER, 4, 12);
    expect(a).toEqual(b);
    expect(townRoutineChanges(ROSTER, 4, 12, 1).length).toBe(1);
    expect(townRoutineChanges(ROSTER, 12, 12)).toEqual([]);
  });
});


describe('saved town routine source and life continuity', () => {
  function savedState(){
    const state=stateAt(12,42);
    state.gameTime=new Date('0351-01-04T12:00:00.000Z');
    state.townSim={7:{burgId:7,layoutRevision:1,villagers:{},chronicle:{burgId:7,events:[],nextEventId:1},lastSimDay:3,nextVillagerId:9}};
    return state;
  }
  it('asks for the saved revision and publishes its original people and workplaces', async () => {
    const state=savedState(),dispatch=vi.fn();
    const resolve=vi.fn((_seed:number,_burg:number,revision?:number)=>revision===1?ROSTER:{...ROSTER,occupants:[]});
    const before=JSON.stringify({state,ROSTER});
    const changes=await handleTownRoutineEvents(state,dispatch,{hoursAdvanced:8,resolveRoster:resolve});
    expect(resolve).toHaveBeenCalledWith(1234,7,1);
    expect(changes.some(change=>change.name==='Hedda Barrow'&&change.to.plotId===11)).toBe(true);
    expect(JSON.stringify({state,ROSTER})).toBe(before);
  });
  it('keeps the earlier callback shape for an unregistered town without assigning a revision', async () => {
    const state=stateAt(12,42),resolve=vi.fn(()=>ROSTER);
    await handleTownRoutineEvents(state,vi.fn(),{hoursAdvanced:8,resolveRoster:resolve});
    expect(resolve).toHaveBeenCalledWith(1234,7);
    expect(state.townSim).toBeUndefined();
  });
  it('defers reports for an existing unversioned town without inventing journal memories',async()=>{
    const state=savedState();delete state.townSim![7].layoutRevision;
    const resolve=vi.fn(()=>ROSTER),dispatch=vi.fn(),before=JSON.stringify(state);
    expect(await handleTownRoutineEvents(state,dispatch,{hoursAdvanced:8,resolveRoster:resolve})).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each(['deceased','not-born'] as const)('does not report a %s resident, and applies the cap after life checks',async status=>{
    const state=savedState();
    const {getGameDay}=await import('../../../utils/core');
    const day=getGameDay(state.gameTime);
    state.townSim![7].villagers[1]={occupantId:1,name:'Hedda Barrow',homePlotId:3,race:'Human',
      bornDay:status==='not-born'?day+1:day-10000,...(status==='deceased'?{diedDay:day-1}:{}),
      parentIds:[],childIds:[],wealth:50};
    const before=JSON.stringify({state,ROSTER}),dispatch=vi.fn();
    const changes=await handleTownRoutineEvents(state,dispatch,{hoursAdvanced:8,resolveRoster:()=>ROSTER,max:1});
    expect(changes).toHaveLength(1);
    expect(changes[0].name).toBe('Orin Fell');
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain('Hedda Barrow');
    expect(JSON.stringify({state,ROSTER})).toBe(before);
  });
  it('does not attach a reused numeric slot death to an unrelated resident',async()=>{
    const state=savedState();
    state.townSim![7].villagers[1]={occupantId:1,name:'Different old resident',homePlotId:99,race:'Human',
      bornDay:-10000,diedDay:-1,parentIds:[],childIds:[],wealth:50};
    const changes=await handleTownRoutineEvents(state,vi.fn(),{hoursAdvanced:8,resolveRoster:()=>ROSTER});
    expect(changes.some(change=>change.name==='Hedda Barrow')).toBe(true);
  });
  it('preserves uncertainty for two legacy residents sharing the same home and name',async()=>{
    const state=savedState();
    state.townSim![7].villagers[1]={occupantId:1,name:'Hedda Barrow',homePlotId:3,race:'Human',
      bornDay:-10000,diedDay:-1,parentIds:[],childIds:[],wealth:50};
    const roster={...ROSTER,occupants:[ROSTER.occupants[0],{...ROSTER.occupants[0],id:9}]};
    const changes=await handleTownRoutineEvents(state,vi.fn(),{hoursAdvanced:8,resolveRoster:()=>roster,max:4});
    expect(changes.map(change=>change.occupantId)).toEqual([1,9]);
  });
});
