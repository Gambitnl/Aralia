import { describe, it, expect } from 'vitest';
import { characterReducer } from '../characterReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/factories';

/**
 * Starvation (and half-rations fatigue) mark a status on every party member via a
 * single party-wide action. SET must be idempotent (no duplicate conditions) so a
 * second starving day doesn't stack 'starving' twice; CLEAR removes it on resupply.
 */
function stateWithParty(n: number): GameState {
  return {
    ...createMockGameState(),
    party: Array.from({ length: n }, (_, i) =>
      createMockPlayerCharacter({ id: `c${i}`, name: `Char${i}` }),
    ),
  };
}

describe('SET_PARTY_CONDITION', () => {
  it('adds the condition to every party member', () => {
    const next = characterReducer(stateWithParty(2), {
      type: 'SET_PARTY_CONDITION',
      payload: { condition: 'starving' },
    } as AppAction);
    for (const pc of next.party!) expect(pc.conditions).toContain('starving');
  });

  it('does not duplicate an already-present condition', () => {
    const once = characterReducer(stateWithParty(2), {
      type: 'SET_PARTY_CONDITION',
      payload: { condition: 'starving' },
    } as AppAction);
    const twice = characterReducer(
      { ...stateWithParty(2), party: once.party! },
      { type: 'SET_PARTY_CONDITION', payload: { condition: 'starving' } } as AppAction,
    );
    expect(twice.party![0].conditions!.filter((c) => c === 'starving')).toHaveLength(1);
  });
});

describe('CLEAR_PARTY_CONDITION', () => {
  it('removes the condition from every party member', () => {
    const set = characterReducer(stateWithParty(2), {
      type: 'SET_PARTY_CONDITION',
      payload: { condition: 'starving' },
    } as AppAction);
    const cleared = characterReducer(
      { ...stateWithParty(2), party: set.party! },
      { type: 'CLEAR_PARTY_CONDITION', payload: { condition: 'starving' } } as AppAction,
    );
    for (const pc of cleared.party!) expect(pc.conditions ?? []).not.toContain('starving');
  });
});
