import { describe, it, expect } from 'vitest';
import { characterReducer } from '../characterReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core';

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
describe('SET_CHARACTER_CONDITION', () => {
  it('adds the condition only to the matching party member', () => {
    const next = characterReducer(stateWithParty(3), {
      type: 'SET_CHARACTER_CONDITION',
      payload: { characterId: 'c1', condition: 'exhaustion' },
    } as AppAction);
    expect(next.party![0].conditions ?? []).not.toContain('exhaustion');
    expect(next.party![1].conditions).toContain('exhaustion');
    expect(next.party![2].conditions ?? []).not.toContain('exhaustion');
  });

  it('does not duplicate an already-present condition on the character', () => {
    const once = characterReducer(stateWithParty(2), {
      type: 'SET_CHARACTER_CONDITION',
      payload: { characterId: 'c0', condition: 'exhaustion' },
    } as AppAction);
    const twice = characterReducer(
      { ...stateWithParty(2), party: once.party! },
      { type: 'SET_CHARACTER_CONDITION', payload: { characterId: 'c0', condition: 'exhaustion' } } as AppAction,
    );
    expect(twice.party![0].conditions!.filter((c) => c === 'exhaustion')).toHaveLength(1);
  });

  it('leaves party unchanged if characterId is not found', () => {
    const initial = stateWithParty(2);
    const next = characterReducer(initial, {
      type: 'SET_CHARACTER_CONDITION',
      payload: { characterId: 'non-existent', condition: 'exhaustion' },
    } as AppAction);
    expect(next.party![0].conditions ?? []).not.toContain('exhaustion');
    expect(next.party![1].conditions ?? []).not.toContain('exhaustion');
  });
});

describe('CLEAR_CHARACTER_CONDITION', () => {
  it('removes the condition only from the matching party member', () => {
    const withCondition = characterReducer(stateWithParty(2), {
      type: 'SET_PARTY_CONDITION',
      payload: { condition: 'exhaustion' },
    } as AppAction);
    const clearedOne = characterReducer(
      { ...stateWithParty(2), party: withCondition.party! },
      { type: 'CLEAR_CHARACTER_CONDITION', payload: { characterId: 'c0', condition: 'exhaustion' } } as AppAction,
    );
    expect(clearedOne.party![0].conditions ?? []).not.toContain('exhaustion');
    expect(clearedOne.party![1].conditions).toContain('exhaustion');
  });
});

describe('Forced march save outcome on party conditions (GG-473)', () => {
  it('applies exhaustion only to party members who failed the save', () => {
    // 4-member party where only c2 failed the save
    const partyState = stateWithParty(4);
    const outcomeResults = [
      { id: 'c0', failed: false },
      { id: 'c1', failed: false },
      { id: 'c2', failed: true },
      { id: 'c3', failed: false },
    ];

    let currentParty = partyState.party!;
    for (const res of outcomeResults) {
      if (res.failed) {
        const next = characterReducer(
          { ...partyState, party: currentParty },
          {
            type: 'SET_CHARACTER_CONDITION',
            payload: { characterId: res.id, condition: 'exhaustion' },
          } as AppAction,
        );
        currentParty = next.party!;
      }
    }

    expect(currentParty[0].conditions ?? []).not.toContain('exhaustion');
    expect(currentParty[1].conditions ?? []).not.toContain('exhaustion');
    expect(currentParty[2].conditions).toContain('exhaustion');
    expect(currentParty[3].conditions ?? []).not.toContain('exhaustion');
    expect(currentParty.filter(p => (p.conditions ?? []).includes('exhaustion'))).toHaveLength(1);
  });
});
