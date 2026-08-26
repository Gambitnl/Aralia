import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { createMockGameState } from '../../utils/core';
import { getRulesEdition } from '../../config/rulesEdition';
import { GamePhase } from '../../types';

// agora-18ab (2026-09-21): Remy ruled "offer both editions by a rules-edition
// switch". The setting is global, persisted on GameState, and must survive the
// resets that start a new run — otherwise a choice made before character
// creation would be silently thrown away.
describe('rules edition setting', () => {
  it('SET_RULES_EDITION lands in state.rulesEdition', () => {
    const state = createMockGameState({ rulesEdition: '2024' });
    const next = appReducer(state, { type: 'SET_RULES_EDITION', payload: '2014' });
    expect(next.rulesEdition).toBe('2014');
    expect(getRulesEdition(next)).toBe('2014');
  });

  it('switches back to 2024', () => {
    const state = createMockGameState({ rulesEdition: '2014' });
    const next = appReducer(state, { type: 'SET_RULES_EDITION', payload: '2024' });
    expect(next.rulesEdition).toBe('2024');
  });

  it('reads as 2024 when a loaded save has no rulesEdition field', () => {
    const state = createMockGameState({});
    delete (state as { rulesEdition?: string }).rulesEdition;
    expect(getRulesEdition(state)).toBe('2024');
  });

  it('keeps the chosen edition across ABANDON_RUN', () => {
    const state = createMockGameState({ rulesEdition: '2014', phase: GamePhase.PLAYING });
    const next = appReducer(state, { type: 'ABANDON_RUN' });
    expect(next.phase).toBe(GamePhase.MAIN_MENU);
    expect(getRulesEdition(next)).toBe('2014');
  });
});
