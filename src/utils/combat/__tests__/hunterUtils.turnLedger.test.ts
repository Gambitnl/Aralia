/**
 * This file proves the Hunter's Prey once-per-turn ledger and the two
 * state-level transactions attack resolution calls (Colossus Slayer on a hit,
 * Horde Breaker's extra attack).
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  applyHunterPreyChoice,
  clearHunterPreyTurnUsage,
  hasUsedHunterPreyThisTurn,
  HUNTER_PREY_FEATURE_ID,
  HUNTER_PREY_TURN_USAGE_KEY,
  markHunterPreyUsedThisTurn,
  resolveColossusSlayerOnHit,
  resolveHordeBreakerAttack,
} from '../hunterUtils';

function createHunter(choice: string): CombatCharacter {
  const base = createMockCombatCharacter({
    id: 'hunter',
    name: 'Hunter',
    team: 'player',
    position: { x: 0, y: 0 },
    abilities: [{
      id: HUNTER_PREY_FEATURE_ID,
      name: "Hunter's Prey",
      description: 'Choose Colossus Slayer, Giant Killer, or Horde Breaker.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'self',
      range: 0,
      effects: [],
    }],
  });
  return applyHunterPreyChoice(base, choice);
}

function createWoundedGoblin(id: string, x: number): CombatCharacter {
  return createMockCombatCharacter({
    id,
    name: 'Goblin',
    team: 'enemy',
    position: { x, y: 0 },
    currentHP: 5,
    maxHP: 10,
  });
}

describe('once-per-turn ledger', () => {
  it('marks, reads, and clears the shared feat usage key', () => {
    const hunter = createHunter('colossus_slayer');
    expect(hasUsedHunterPreyThisTurn(hunter)).toBe(false);

    const spent = markHunterPreyUsedThisTurn(hunter);
    expect(spent.featUsageThisTurn).toContain(HUNTER_PREY_TURN_USAGE_KEY);
    expect(hasUsedHunterPreyThisTurn(spent)).toBe(true);

    // Marking twice must not duplicate the entry.
    expect(markHunterPreyUsedThisTurn(spent).featUsageThisTurn)
      .toEqual([HUNTER_PREY_TURN_USAGE_KEY]);

    expect(hasUsedHunterPreyThisTurn(clearHunterPreyTurnUsage(spent))).toBe(false);
  });

  it('keeps other feat usage untouched when clearing', () => {
    const hunter = { ...createHunter('colossus_slayer'), featUsageThisTurn: ['sneak_attack'] };
    const cleared = clearHunterPreyTurnUsage(markHunterPreyUsedThisTurn(hunter));
    expect(cleared.featUsageThisTurn).toEqual(['sneak_attack']);
  });
});

describe('resolveColossusSlayerOnHit', () => {
  it('rolls the bonus damage once per turn and spends the ledger', () => {
    const hunter = createHunter('colossus_slayer');
    const state = createMockCombatState({ characters: [hunter, createWoundedGoblin('goblin', 1)] });

    const first = resolveColossusSlayerOnHit(state, {
      rangerId: 'hunter',
      targetId: 'goblin',
      rng: () => 0.999, // pins 1d8 at 8
    });
    expect(first.resolved).toBe(true);
    expect(first.bonusDamage).toBe(8);
    expect(hasUsedHunterPreyThisTurn(first.state.characters.find(c => c.id === 'hunter')!)).toBe(true);

    // The rider does not apply damage itself; the damage engine owns that.
    expect(first.state.characters.find(c => c.id === 'goblin')?.currentHP).toBe(5);

    const second = resolveColossusSlayerOnHit(first.state, { rangerId: 'hunter', targetId: 'goblin' });
    expect(second.resolved).toBe(false);
    expect(second.failure).toBe('already_used_this_turn');
    expect(second.bonusDamage).toBe(0);
  });

  it('refuses a full-health target, a missing combatant, and the wrong choice', () => {
    const hunter = createHunter('colossus_slayer');
    const healthy = createMockCombatCharacter({
      id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 1, y: 0 }, currentHP: 10, maxHP: 10,
    });
    const state = createMockCombatState({ characters: [hunter, healthy] });

    expect(resolveColossusSlayerOnHit(state, { rangerId: 'hunter', targetId: 'goblin' }).failure)
      .toBe('target_not_below_max');
    expect(resolveColossusSlayerOnHit(state, { rangerId: 'nobody', targetId: 'goblin' }).failure)
      .toBe('ranger_missing');
    expect(resolveColossusSlayerOnHit(state, { rangerId: 'hunter', targetId: 'nobody' }).failure)
      .toBe('target_missing');

    const hordeState = createMockCombatState({
      characters: [createHunter('horde_breaker'), createWoundedGoblin('goblin', 1)],
    });
    expect(resolveColossusSlayerOnHit(hordeState, { rangerId: 'hunter', targetId: 'goblin' }).failure)
      .toBe('wrong_choice');
  });
});

describe('resolveHordeBreakerAttack', () => {
  it('names the second target once per turn and spends the ledger', () => {
    const hunter = createHunter('horde_breaker');
    const state = createMockCombatState({
      characters: [hunter, createWoundedGoblin('goblin', 1), createWoundedGoblin('goblin-2', 2)],
    });

    const first = resolveHordeBreakerAttack(state, {
      rangerId: 'hunter',
      originalTargetId: 'goblin',
      secondaryTargetId: 'goblin-2',
    });
    expect(first.resolved).toBe(true);
    expect(first.secondaryTargetId).toBe('goblin-2');
    expect(hasUsedHunterPreyThisTurn(first.state.characters.find(c => c.id === 'hunter')!)).toBe(true);

    const second = resolveHordeBreakerAttack(first.state, {
      rangerId: 'hunter',
      originalTargetId: 'goblin',
      secondaryTargetId: 'goblin-2',
    });
    expect(second.failure).toBe('already_used_this_turn');
  });

  it('refuses a second target that is not within five feet of the first', () => {
    const hunter = createHunter('horde_breaker');
    const state = createMockCombatState({
      characters: [hunter, createWoundedGoblin('goblin', 1), createWoundedGoblin('goblin-2', 6)],
    });

    expect(resolveHordeBreakerAttack(state, {
      rangerId: 'hunter',
      originalTargetId: 'goblin',
      secondaryTargetId: 'goblin-2',
    }).failure).toBe('secondary_out_of_reach');
  });
});
