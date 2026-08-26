import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { createMockGameState } from '../../utils/core';
import { COMBAT_DIFFICULTIES, isCombatDifficulty, nextCombatDifficulty } from '../../config/combatConfig';

// agora-a46a.1 (2026-09-13): combat difficulty is a real, persisted setting.
describe('combat difficulty setting', () => {
  it('SET_COMBAT_DIFFICULTY lands in state.combatDifficulty', () => {
    const state = createMockGameState({ combatDifficulty: 'normal' });
    const next = appReducer(state, { type: 'SET_COMBAT_DIFFICULTY', payload: 'hard' });
    expect(next.combatDifficulty).toBe('hard');
  });

  it('cycles easy -> normal -> hard -> easy', () => {
    expect(nextCombatDifficulty('easy')).toBe('normal');
    expect(nextCombatDifficulty('normal')).toBe('hard');
    expect(nextCombatDifficulty('hard')).toBe('easy');
    expect(COMBAT_DIFFICULTIES).toEqual(['easy', 'normal', 'hard']);
  });

  it('rejects a stored value outside the union', () => {
    expect(isCombatDifficulty('brutal')).toBe(false);
    expect(isCombatDifficulty(null)).toBe(false);
    expect(isCombatDifficulty('easy')).toBe(true);
  });
});
