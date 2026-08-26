/**
 * This file proves the Assassinate turn-order derivation: the advantage half of
 * the feature is read from the initiative order rather than handed in by the
 * caller, while surprise stays an explicit fact because the engine carries no
 * surprise state.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter, CombatState } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  ASSASSINATE_FEATURE_ID,
  hasActedThisRound,
  resolveAssassinateAgainstTarget,
} from '../assassinUtils';

function createAssassin(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'assassin',
    name: 'Assassin',
    team: 'player',
    abilities: [{
      id: ASSASSINATE_FEATURE_ID,
      name: 'Assassinate',
      description: 'Advantage against foes who have not acted; a hit against a surprised creature is critical.',
      type: 'utility',
      cost: { type: 'free' },
      targeting: 'self',
      range: 0,
      effects: [],
    }],
  });
}

function createEnemy(id: string): CombatCharacter {
  return createMockCombatCharacter({ id, name: 'Bandit', team: 'enemy' });
}

/** The assassin acts second: the first bandit has gone, the second has not. */
function createRoundState(characters: CombatCharacter[]): CombatState {
  return createMockCombatState({
    characters,
    turnState: {
      currentTurn: 1,
      turnOrder: ['early-bandit', 'assassin', 'late-bandit'],
      currentCharacterId: 'assassin',
      phase: 'action',
      actionsThisTurn: [],
    },
  });
}

describe('hasActedThisRound', () => {
  it('reads the initiative order and reports an unknown creature as undefined', () => {
    const state = createRoundState([createAssassin(), createEnemy('early-bandit'), createEnemy('late-bandit')]);

    expect(hasActedThisRound(state, 'early-bandit')).toBe(true);
    expect(hasActedThisRound(state, 'assassin')).toBe(false);
    expect(hasActedThisRound(state, 'late-bandit')).toBe(false);
    expect(hasActedThisRound(state, 'bystander')).toBeUndefined();
  });
});

describe('resolveAssassinateAgainstTarget', () => {
  it('grants advantage against a target that has not taken its turn', () => {
    const state = createRoundState([createAssassin(), createEnemy('early-bandit'), createEnemy('late-bandit')]);

    const result = resolveAssassinateAgainstTarget(state, {
      assassinId: 'assassin',
      targetId: 'late-bandit',
      targetIsSurprised: false,
    });
    expect(result.resolved).toBe(true);
    expect(result.targetHasActedThisRound).toBe(false);
    expect(result.modifiers).toEqual({ advantage: true, criticalOnHit: false });
  });

  it('withholds advantage from a target that has already acted', () => {
    const state = createRoundState([createAssassin(), createEnemy('early-bandit'), createEnemy('late-bandit')]);

    const result = resolveAssassinateAgainstTarget(state, {
      assassinId: 'assassin',
      targetId: 'early-bandit',
      targetIsSurprised: false,
    });
    expect(result.modifiers).toEqual({ advantage: false, criticalOnHit: false });
  });

  it('turns a hit against a surprised target into a critical', () => {
    const state = createRoundState([createAssassin(), createEnemy('early-bandit'), createEnemy('late-bandit')]);

    const result = resolveAssassinateAgainstTarget(state, {
      assassinId: 'assassin',
      targetId: 'early-bandit',
      targetIsSurprised: true,
    });
    expect(result.modifiers).toEqual({ advantage: false, criticalOnHit: true });
  });

  it('fails by name for a non-Assassin, a missing combatant, and a target outside the order', () => {
    const rogue = createMockCombatCharacter({ id: 'rogue', name: 'Rogue', team: 'player' });
    const bystander = createEnemy('bystander');
    const state = createRoundState([
      createAssassin(), rogue, bystander, createEnemy('early-bandit'), createEnemy('late-bandit'),
    ]);

    expect(resolveAssassinateAgainstTarget(state, {
      assassinId: 'rogue', targetId: 'late-bandit', targetIsSurprised: false,
    }).failure).toBe('missing_assassinate');

    expect(resolveAssassinateAgainstTarget(state, {
      assassinId: 'nobody', targetId: 'late-bandit', targetIsSurprised: false,
    }).failure).toBe('assassin_missing');

    expect(resolveAssassinateAgainstTarget(state, {
      assassinId: 'assassin', targetId: 'nobody', targetIsSurprised: false,
    }).failure).toBe('target_missing');

    expect(resolveAssassinateAgainstTarget(state, {
      assassinId: 'assassin', targetId: 'bystander', targetIsSurprised: false,
    }).failure).toBe('target_not_in_turn_order');
  });
});
