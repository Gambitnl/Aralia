/**
 * GG-479 (audit 2026-10-25): crime heat cools down as world time passes.
 * CrimeSystem.decayHeat existed but had no production caller, so local heat
 * from Intimidate haggles and crimes stayed at its peak for the whole game.
 *
 * Exercises: src/state/reducers/crimeReducer.ts (ADVANCE_TIME),
 * src/systems/crime/CrimeSystem.ts (decayHeat)
 */
import { describe, expect, it } from 'vitest';
import { crimeReducer } from '../crimeReducer';
import { initialGameState } from '../../appState';
import type { GameState } from '../../../types';
import type { AppAction } from '../../actionTypes';

function heated(): GameState {
  return {
    ...initialGameState,
    notoriety: { ...initialGameState.notoriety, globalHeat: 60, localHeat: { town_a: 100 }, bounties: [] },
  } as GameState;
}

describe('crime heat decays with time (GG-479)', () => {
  it('cools local heat by 1 per hour and global heat by 0.1 per hour', () => {
    const patch = crimeReducer(heated(), { type: 'ADVANCE_TIME', payload: { seconds: 24 * 3600 } } as AppAction);
    expect(patch.notoriety?.localHeat.town_a).toBe(76);
    expect(patch.notoriety?.globalHeat).toBeCloseTo(57.6, 6);
  });

  it('never goes below zero', () => {
    const patch = crimeReducer(heated(), { type: 'ADVANCE_TIME', payload: { seconds: 30 * 24 * 3600 } } as AppAction);
    expect(patch.notoriety?.localHeat.town_a).toBe(0);
    expect(patch.notoriety?.globalHeat).toBe(0);
  });
});
