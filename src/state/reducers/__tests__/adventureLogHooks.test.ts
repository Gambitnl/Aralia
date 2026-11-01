/**
 * Proves the reducer append points feed the runtime adventure log (the Oracle
 * DM substrate). Pure-reducer level: dispatch the event, assert an entry lands.
 */
import { describe, expect, it } from 'vitest';
import { questReducer } from '../questReducer';
import { worldReducer } from '../worldReducer';
import { Quest, QuestStatus } from '../../../types';
import { createMockGameState } from '../../../utils/core';

describe('adventure log append hooks', () => {
  it('records an "opening" entry when the Main opening quest completes', () => {
    const openingQuest: Quest = {
      id: 'q-open',
      title: 'A Situation in Stren',
      description: 'Defuse the standoff at the market.',
      giverId: 'npc-mira',
      status: QuestStatus.Active,
      questType: 'Main',
      objectives: [{ id: 'o1', description: 'Resolve it', isCompleted: false }],
    };
    const state = createMockGameState({ adventureLog: [], questLog: [openingQuest] });

    const next = questReducer(state, { type: 'COMPLETE_QUEST', payload: { questId: 'q-open' } });

    expect(next.adventureLog).toBeDefined();
    const entry = next.adventureLog![next.adventureLog!.length - 1];
    expect(entry.kind).toBe('opening');
    expect(entry.summary).toBe('Completed the quest "A Situation in Stren".');
    expect(entry.npcIds).toEqual(['npc-mira']);
  });

  it('records a plain "quest" entry for a non-main quest', () => {
    const sideQuest: Quest = {
      id: 'q-side',
      title: 'Rat Cellar',
      description: 'Clear the cellar.',
      status: QuestStatus.Active,
      questType: 'Side',
      objectives: [{ id: 'o1', description: 'Clear it', isCompleted: false }],
    };
    const state = createMockGameState({ adventureLog: [], questLog: [sideQuest] });
    const next = questReducer(state, { type: 'COMPLETE_QUEST', payload: { questId: 'q-side' } });
    const entry = next.adventureLog![next.adventureLog!.length - 1];
    expect(entry.kind).toBe('quest');
  });

  it('records a "met-npc" entry the first time an NPC is met', () => {
    const state = createMockGameState({ adventureLog: [], metNpcIds: [] });
    const next = worldReducer(state, { type: 'ADD_MET_NPC', payload: { npcId: 'npc-xyz' } });
    expect(next.metNpcIds).toContain('npc-xyz');
    const entry = next.adventureLog![next.adventureLog!.length - 1];
    expect(entry.kind).toBe('met-npc');
    expect(entry.npcIds).toEqual(['npc-xyz']);
  });

  it('does not double-log an already-met NPC', () => {
    const state = createMockGameState({ adventureLog: [], metNpcIds: ['npc-xyz'] });
    const next = worldReducer(state, { type: 'ADD_MET_NPC', payload: { npcId: 'npc-xyz' } });
    // No state change → no adventureLog key returned.
    expect(next.adventureLog).toBeUndefined();
  });
});


// Arrival summaries must use the reached time even while travel's original
// MOVE/discovery/time action order still holds the departure clock.
describe('arrival journal chronology', () => {
  it('dates travel at arrival across midnight without advancing the reducer clock', async () => {
    const {appReducer}=await import('../../appState');
    const state=createMockGameState({gameTime:new Date('0351-01-01T23:00:00Z'),adventureLog:[{id:'earned',day:1,time:'10:32',timestamp:1,kind:'travel',summary:'Earlier earned arrival.'}]});
    const before=JSON.stringify(state);
    const next=appReducer(state,{type:'MOVE_PLAYER',payload:{newLocationId:'cell_42',activeDynamicNpcIds:null,arrivalGameTime:'0351-01-02T02:47:00Z'}});
    expect(next.adventureLog.at(-1)?.time).toBe('02:47');
    expect(next.adventureLog.at(-1)?.day).toBe(Math.floor(Date.parse('0351-01-02T02:47:00Z')/86400000));
    expect(next.gameTime).toEqual(state.gameTime);
    expect(next.adventureLog[0]).toEqual(state.adventureLog[0]);
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each([undefined,'invalid-date'])('preserves ordinary movement timing for %s',async arrivalGameTime=>{
    const {appReducer}=await import('../../appState');
    const state=createMockGameState({gameTime:new Date('0351-01-01T23:00:00Z'),adventureLog:[]});
    const next=appReducer(state,{type:'MOVE_PLAYER',payload:{newLocationId:'cell_42',activeDynamicNpcIds:null,arrivalGameTime}});
    expect(next.adventureLog.at(-1)?.time).toBe('23:00');
  });
  it('mirrors the source discovery time and preserves earlier earned entries',async()=>{
    const {logReducer}=await import('../logReducer');
    const {DiscoveryType}=await import('../../../types');
    const state=createMockGameState({gameTime:new Date('0351-01-01T23:00:00Z'),adventureLog:[]});
    const next=logReducer(state,{type:'ADD_DISCOVERY_ENTRY',payload:{type:DiscoveryType.LOCATION_DISCOVERY,title:'Location Discovered: Stamstad',gameTime:'0351-01-02T02:47:00Z',flags:[{key:'locationId',value:'cell_42',label:'Stamstad'}]}});
    expect(next.adventureLog?.at(-1)?.time).toBe('02:47');
    expect(state.adventureLog).toEqual([]);
    expect(next.discoveryLog?.[0].gameTime).toBe('0351-01-02T02:47:00Z');
  });
});
