import { describe, expect, it } from 'vitest';
import { characterReducer } from '../characterReducer';
import type { GameState } from '../../../types';
import type { AppAction } from '../../actionTypes';

const EFFECT = {
  id: 'se-guidance-1',
  name: 'Guidance (Stealth)',
  type: 'buff' as const,
  duration: 10,
  source: 'Guidance',
  sourceCasterId: 'pc-1',
  effect: { type: 'condition' as const },
  modifiers: { skill: 'Stealth' },
  abilityCheckModifier: { appliesTo: 'ability_check', bonusDice: '1d4' },
};

const stateWith = (statusEffects: object[]) => ({
  party: [
    { id: 'pc-1', name: 'Hero', statusEffects },
    { id: 'pc-2', name: 'Friend', statusEffects: [] },
  ],
} as unknown as GameState);

const apply = (state: GameState, statusEffect: object = EFFECT) =>
  characterReducer(state, {
    type: 'APPLY_CHARACTER_STATUS_EFFECT',
    payload: { characterId: 'pc-1', statusEffect },
  } as AppAction);

describe('APPLY_CHARACTER_STATUS_EFFECT', () => {
  it('appends the effect to the matching party member only', () => {
    const next = apply(stateWith([]));
    expect(next.party?.[0].statusEffects).toHaveLength(1);
    expect(next.party?.[0].statusEffects?.[0].id).toBe('se-guidance-1');
    expect(next.party?.[1].statusEffects).toHaveLength(0);
  });

  it('replaces an existing effect from the same source+caster instead of stacking', () => {
    const prior = { ...EFFECT, id: 'se-old', modifiers: { skill: 'Athletics' } };
    const next = apply(stateWith([prior]));
    expect(next.party?.[0].statusEffects).toHaveLength(1);
    expect(next.party?.[0].statusEffects?.[0].id).toBe('se-guidance-1');
  });

  it('keeps effects from other sources', () => {
    const other = { ...EFFECT, id: 'se-other', source: 'Bless' };
    const next = apply(stateWith([other]));
    expect(next.party?.[0].statusEffects?.map((e: { id: string }) => e.id)).toEqual(['se-other', 'se-guidance-1']);
  });
});
