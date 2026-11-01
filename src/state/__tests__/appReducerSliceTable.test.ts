/**
 * The table-driven slice pipeline in appReducer (C6, agora-9ed9.6).
 *
 * The table must run the same slices in the same order with the same
 * spread-merge and the same ritual skip as the hand-written lines it replaced.
 * `oldPipeline` below is a copy of those lines, so each action is checked
 * against the previous behavior directly.
 *
 * Exercises: src/state/appState.ts (SLICE_PIPELINE, appReducer default branch)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { appReducer, SLICE_PIPELINE } from '../appState';
import { initialGameState } from '../initialState';
import type { GameState } from '../../types';
import type { AppAction } from '../actionTypes';
import { uiReducer } from '../reducers/uiReducer';
import { religionReducer } from '../reducers/religionReducer';
import { characterReducer } from '../reducers/characterReducer';
import { worldReducer } from '../reducers/worldReducer';
import { ritualReducer } from '../reducers/ritualReducer';
import { logReducer } from '../reducers/logReducer';
import { encounterReducer } from '../reducers/encounterReducer';
import { npcReducer } from '../reducers/npcReducer';
import { factReducer } from '../reducers/factReducer';
import { questReducer } from '../reducers/questReducer';
import { townReducer } from '../reducers/townReducer';
import { crimeReducer } from '../reducers/crimeReducer';
import { companionReducer } from '../reducers/companionReducer';
import { identityReducer } from '../reducers/identityReducer';
import { dialogueReducer } from '../reducers/dialogueReducer';
import { craftingReducer } from '../reducers/craftingReducer';
import { conversationReducer } from '../reducers/conversationReducer';
import { journalReducer } from '../reducers/journalReducer';
import { legacyReducer } from '../reducers/legacyReducer';
import { economyReducer } from '../reducers/economyReducer';
import { gameEntryReducer } from '../reducers/gameEntryReducer';
import { navalReducer } from '../reducers/navalReducer';

/** The hand-written default branch before C6, kept verbatim as the oracle. */
function oldPipeline(state: GameState, action: AppAction): GameState {
  let nextState = { ...state };
  nextState = { ...nextState, ...uiReducer(nextState, action) };
  nextState = { ...nextState, ...religionReducer(nextState, action) };
  nextState = { ...nextState, ...characterReducer(nextState, action) };
  nextState = { ...nextState, ...worldReducer(nextState, action) };
  if (action.type !== 'ADVANCE_TIME') {
    nextState = { ...nextState, ...ritualReducer(nextState, action) };
  }
  nextState = { ...nextState, ...logReducer(nextState, action) };
  nextState = { ...nextState, ...encounterReducer(nextState, action) };
  nextState = { ...nextState, ...npcReducer(nextState, action) };
  nextState = { ...nextState, ...factReducer(nextState, action) };
  nextState = { ...nextState, ...questReducer(nextState, action) };
  nextState = { ...nextState, ...townReducer(nextState, action) };
  nextState = { ...nextState, ...crimeReducer(nextState, action) };
  nextState = { ...nextState, ...companionReducer(nextState, action) };
  nextState = { ...nextState, ...identityReducer(nextState, action) };
  nextState = { ...nextState, ...dialogueReducer(nextState, action) };
  nextState = { ...nextState, ...craftingReducer(nextState, action) };
  nextState = { ...nextState, ...conversationReducer(nextState, action) };
  nextState = { ...nextState, ...journalReducer(nextState, action) };
  nextState = { ...nextState, ...legacyReducer(nextState, action) };
  nextState = { ...nextState, ...economyReducer(nextState, action) };
  nextState = { ...nextState, ...gameEntryReducer(nextState, action) };
  nextState = { ...nextState, ...navalReducer(nextState, action) };
  return nextState;
}

describe('SLICE_PIPELINE', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('lists the 22 slices in the original order', () => {
    expect(SLICE_PIPELINE.map((slice) => slice.name)).toEqual([
      'ui', 'religion', 'character', 'world', 'ritual', 'log',
      'encounter', 'npc', 'fact', 'quest', 'town', 'crime', 'companion', 'identity',
      'dialogue', 'crafting', 'conversation', 'journal', 'legacy', 'economy', 'gameEntry', 'naval',
    ]);
  });

  it('skips only the ritual slice, and only for ADVANCE_TIME', () => {
    const skipping = (type: string) => SLICE_PIPELINE
      .filter((slice) => slice.skip?.({ type } as AppAction))
      .map((slice) => slice.name);
    expect(skipping('ADVANCE_TIME')).toEqual(['ritual']);
    expect(skipping('START_RITUAL')).toEqual([]);
  });

  it('gives the same state as the old hand-written pipeline for slice-handled actions', () => {
    // Each action reaches the default branch: none has its own case in appReducer.
    const actions = [
      { type: 'ADD_NOTIFICATION', payload: { type: 'info', message: 'hello' } },
      { type: 'TOGGLE_MAP_VISIBILITY' },
      { type: 'ADVANCE_TIME', payload: { seconds: 60 } },
      { type: 'NAVAL_SET_KNOWN_PORTS', payload: { ports: ['1', '3'] } },
      { type: 'SOME_UNKNOWN_ACTION' },
    ] as unknown as AppAction[];
    // Pin generated ids and the clock so both pipelines see the same values.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
    for (const action of actions) {
      expect(appReducer(initialGameState, action), action.type).toEqual(oldPipeline(initialGameState, action));
    }
  });
});
