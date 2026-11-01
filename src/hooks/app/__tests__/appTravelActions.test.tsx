/** Travel hook checks protect reducer action order, destination identity and honest zero-distance/blocked trips. They never start a real encounter or generate a world. */
import { describe, expect, it, vi } from 'vitest';
import { handleStartBattleMapEncounter } from '../../actions/handleEncounter';

vi.mock('../../actions/handleEncounter', () => ({
  handleStartBattleMapEncounter: vi.fn(),
}));
import { renderHook } from '@testing-library/react';
import { CLASSES_DATA } from '../../../data/classes';
import type { WorldCellView } from '../../../types';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core/factories';
import * as rollers from '../../../systems/dice/rollers';
import { makeCellLocationId } from '../../../utils/location/cellLocationId';
import { useAppTravelActions } from '../useAppTravelActions';

const cell: WorldCellView = { cellId: 42, x: 0, y: 0, biomeId: 'plains', discovered: true, isPlayerCurrent: false };

describe('App travel commit boundary', () => {
  it('carries actual arrival time through the full hook and reducer journal chain', async () => {
    const {appReducer}=await import('../../../state/appState');
    const departure=createMockGameState({currentLocationId:makeCellLocationId(1),gameTime:new Date('0351-01-01T23:00:00Z'),discoveryLog:[],adventureLog:[]});
    let reached=departure;
    const dispatch=vi.fn(action=>{reached=appReducer(reached,action);});
    const {result}=renderHook(()=>useAppTravelActions(departure,dispatch,vi.fn()));
    result.current.handleTileClick(0,0,cell,{seconds:13620,destinationCell:{cellId:42,anchor:{cellId:42}}});
    expect(reached.gameTime.toISOString()).toBe('0351-01-02T02:47:00.000Z');
    expect(reached.discoveryLog[0].gameTime).toBe(reached.gameTime.toISOString());
    expect(reached.adventureLog.map(e=>({kind:e.kind,time:e.time}))).toEqual([{kind:'travel',time:'02:47'},{kind:'discovery',time:'02:47'}]);
    expect(dispatch.mock.calls.map(([a])=>a.type)).toEqual(['MOVE_PLAYER','ADD_DISCOVERY_ENTRY','ADVANCE_TIME','TOGGLE_MAP_VISIBILITY']);
    const loaded=appReducer(createMockGameState(),{type:'LOAD_GAME_SUCCESS',payload:reached});
    expect(loaded.adventureLog).toEqual(reached.adventureLog);
    expect(loaded.discoveryLog).toEqual(reached.discoveryLog);
    expect(departure.adventureLog).toEqual([]);
  });

  it('keeps arrival, discovery, time, map closure and fare in the original order', () => {
    const dispatch = vi.fn(); const message = vi.fn();
    const state = createMockGameState({ currentLocationId: makeCellLocationId(1), discoveryLog: [] });
    const { result } = renderHook(() => useAppTravelActions(state, dispatch, message));
    const destinationCell = { cellId: 42, anchor: { cellId: 42 } };
    result.current.handleTileClick(0, 0, cell, { seconds: 90, destinationCell, ferryFareGp: 3 });
    expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual(['MOVE_PLAYER', 'ADD_DISCOVERY_ENTRY', 'ADVANCE_TIME', 'TOGGLE_MAP_VISIBILITY', 'MODIFY_GOLD']);
    expect(dispatch.mock.calls[0][0].payload.destinationCell).toBe(destinationCell);
    expect(dispatch.mock.calls[2][0].payload).toEqual({ seconds: 90 });
    expect(dispatch.mock.calls[4][0].payload).toEqual({ amount: -3 });
    expect(message).toHaveBeenCalledWith('You pay the ferry master 3 gp for passage.', 'system');
  });

  it('does not grant movement, discovery or time for a zero-distance halt', () => {
    const dispatch = vi.fn(); const message = vi.fn();
    const state = createMockGameState({ currentLocationId: makeCellLocationId(42) });
    const { result } = renderHook(() => useAppTravelActions(state, dispatch, message));
    result.current.handleTileClick(0, 0, cell, { seconds: 0, destinationCell: { cellId: 42, anchor: { cellId: 42 } } });
    expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual(['TOGGLE_MAP_VISIBILITY']);
    expect(message).toHaveBeenCalledWith('You remain in prairie country.', 'system');
  });

  it('dates a reached-place account at arrival including navigation and event delays', () => {
    const dispatch=vi.fn();
    const departure=new Date('0351-01-01T07:00:00.000Z');
    const state=createMockGameState({currentLocationId:makeCellLocationId(1),gameTime:departure,discoveryLog:[]});
    const {result}=renderHook(()=>useAppTravelActions(state,dispatch,vi.fn()));
    result.current.handleTileClick(0,0,cell,{
      seconds:3600,destinationCell:{cellId:42,anchor:{cellId:42}},
      navDrift:{lost:true,extraSeconds:1800,driftDirection:'north',cause:'wilds'},
      tripEvent:{extraSeconds:900,message:'Weather delays your arrival.'},
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type:'ADD_DISCOVERY_ENTRY',payload:expect.objectContaining({gameTime:'0351-01-01T08:45:00.000Z'})}));
    expect(dispatch).toHaveBeenCalledWith({type:'ADVANCE_TIME',payload:{seconds:6300}});
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type:'MOVE_PLAYER',payload:expect.objectContaining({arrivalGameTime:'0351-01-01T08:45:00.000Z'})}));
  });

  it('rejects unexplored or unknown terrain before spending time or fare', () => {
    const dispatch = vi.fn(); const message = vi.fn();
    const { result } = renderHook(() => useAppTravelActions(createMockGameState(), dispatch, message));
    result.current.handleTileClick(0, 0, { ...cell, discovered: false }, { seconds: 90, ferryFareGp: 3 });
    result.current.handleTileClick(0, 0, { ...cell, biomeId: 'missing-fixture-biome' }, { seconds: 90, ferryFareGp: 3 });
    expect(dispatch).not.toHaveBeenCalled();
    expect(message.mock.calls).toEqual([
      ['That place lies beyond the known map — scout closer before you can travel there.', 'system'],
      ['The nature of this terrain is unknown.', 'system'],
    ]);
  });

  it('surfaces a player-visible system message when battle-start rejects (agora-d761)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(handleStartBattleMapEncounter).mockRejectedValueOnce(new Error('simulated combat crash'));
    try {
      const dispatch = vi.fn();
      const message = vi.fn();
      const state = createMockGameState({ currentLocationId: makeCellLocationId(1), discoveryLog: [] });
      const { result } = renderHook(() => useAppTravelActions(state, dispatch, message));
      const destinationCell = { cellId: 42, anchor: { cellId: 42 } };

      result.current.handleTileClick(0, 0, cell, {
        seconds: 90,
        destinationCell,
        encounter: {
          kind: 'sea-hostile',
          monsters: [{ name: 'Wolf', quantity: 1, cr: '1/4', description: 'A lone wolf' }],
          routeCells: [42],
        },
      });

      // Normal movement commits
      expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual([
        'MOVE_PLAYER',
        'ADD_DISCOVERY_ENTRY',
        'ADVANCE_TIME',
        'TOGGLE_MAP_VISIBILITY',
      ]);

      // Wait for the async encounter startup to settle
      await vi.waitFor(() => {
        expect(message).toHaveBeenCalledWith('Tactical encounter failed to start.', 'system');
      });
    } finally {
      consoleError.mockRestore();
    }
  });
  // The actual 11h46 Olaspi journey must not claim the party passed 12 hours.
  // Both save outcomes retain their one roll, exact clock cost and condition gate.
  it.each([
    { roll: 1, failed: true, text: 'After 11h 46m of travel, the forced march takes its toll — Perrin fail a DC 13 Constitution save and grow exhausted.' },
    { roll: 20, failed: false, text: 'After 11h 46m of travel, the party endures the forced march (DC 13 Constitution saves).' },
  ])('reports the committed fractional duration when failed=$failed', ({ roll, failed, text }) => {
    const dice = vi.spyOn(rollers, 'rollD20').mockReturnValue(roll);
    try {
      const dispatch = vi.fn(); const message = vi.fn();
      const hero = createMockPlayerCharacter({
        id: 'marcher', name: 'Perrin',
        finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      });
      const state = createMockGameState({ currentLocationId: makeCellLocationId(1), party: [hero], discoveryLog: [] });
      const { result } = renderHook(() => useAppTravelActions(state, dispatch, message));
      result.current.handleTileClick(0, 0, cell, {
        seconds: 42360, destinationCell: { cellId: 42, anchor: { cellId: 42 } },
        forcedMarch: { hours: 11 + 46 / 60, saveDC: 13 },
      });
      expect(message).toHaveBeenCalledWith(text, 'system');
      expect(dice).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({ type: 'ADVANCE_TIME', payload: { seconds: 42360 } });
      const conditions = dispatch.mock.calls.map(([action]) => action).filter(action => action.type === 'SET_CHARACTER_CONDITION');
      expect(conditions).toEqual(failed ? [{ type: 'SET_CHARACTER_CONDITION', payload: { characterId: 'marcher', condition: 'exhaustion' } }] : []);
    } finally { dice.mockRestore(); }
  });

  it.each([
    { roll: 16, con: 14, proficient: true, dc: 21, total: 20, bonus: '+ 4', result: 'failed' },
    { roll: 17, con: 14, proficient: true, dc: 21, total: 21, bonus: '+ 4', result: 'passed' },
    { roll: 8, con: 8, proficient: false, dc: 12, total: 7, bonus: '- 1', result: 'failed' },
    { roll: 20, con: 14, proficient: true, dc: 25, total: 24, bonus: '+ 4', result: 'failed' },
  ])('shows the existing resolved save: $roll $bonus vs $dc is $result', ({ roll, con, proficient, dc, total, bonus, result: saveResult }) => {
    const dice = vi.spyOn(rollers, 'rollD20').mockReturnValue(roll);
    try {
      const dispatch = vi.fn(); const message = vi.fn();
      const hero = createMockPlayerCharacter({
        id: 'marcher', name: 'Perrin', level: 1,
        // The factory defaults to Fighter, whose actual class grants Con saves.
        // Use a real Wizard for the explicitly nonproficient branch.
        class: CLASSES_DATA[proficient ? 'fighter' : 'wizard'],
        finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: con, Intelligence: 10, Wisdom: 10, Charisma: 10 },
        savingThrowProficiencies: proficient ? ['Constitution'] : [],
      });
      const state = createMockGameState({ currentLocationId: makeCellLocationId(1), party: [hero], discoveryLog: [] });
      const { result } = renderHook(() => useAppTravelActions(state, dispatch, message));
      result.current.handleTileClick(0, 0, cell, {
        seconds: 71880, destinationCell: { cellId: 42, anchor: { cellId: 42 } },
        forcedMarch: { hours: 19 + 58 / 60, saveDC: dc },
      });
      expect(message).toHaveBeenCalledWith(`Perrin: Constitution save — d20 ${roll} ${bonus} = ${total} vs DC ${dc} — ${saveResult}.`, 'system');
      expect(dice).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({ type: 'ADVANCE_TIME', payload: { seconds: 71880 } });
      const conditions = dispatch.mock.calls.map(([action]) => action).filter(action => action.type === 'SET_CHARACTER_CONDITION');
      expect(conditions).toEqual(saveResult === 'failed' ? [{ type: 'SET_CHARACTER_CONDITION', payload: { characterId: 'marcher', condition: 'exhaustion' } }] : []);
    } finally { dice.mockRestore(); }
  });

  it('dispatches SET_CHARACTER_CONDITION only for members who failed the forced march save (GG-473)', () => {
    vi.spyOn(rollers, 'rollD20').mockReturnValue(8);
    const dispatch = vi.fn();
    const message = vi.fn();
    const c1 = createMockPlayerCharacter({
      id: 'hero-1',
      name: 'Hero1',
      finalAbilityScores: { Constitution: 20 } as any,
    });
    const c2 = createMockPlayerCharacter({
      id: 'hero-2',
      name: 'Hero2',
      finalAbilityScores: { Constitution: 6 } as any,
    });
    const state = createMockGameState({
      currentLocationId: makeCellLocationId(1),
      party: [c1, c2],
      discoveryLog: [],
    });
    const { result } = renderHook(() => useAppTravelActions(state, dispatch, message));
    const destinationCell = { cellId: 42, anchor: { cellId: 42 } };

    result.current.handleTileClick(0, 0, cell, {
      seconds: 90,
      destinationCell,
      forcedMarch: { hours: 10, saveDC: 12 },
    });

    const setConditionCalls = dispatch.mock.calls
      .map(([action]) => action)
      .filter((action) => action.type === 'SET_CHARACTER_CONDITION');

    expect(setConditionCalls).toEqual([
      {
        type: 'SET_CHARACTER_CONDITION',
        payload: { characterId: 'hero-2', condition: 'exhaustion' },
      },
    ]);
    expect(message).toHaveBeenCalledWith(
      expect.stringContaining('Hero2 fail a DC 12 Constitution save and grow exhausted'),
      'system',
    );
  });
});
