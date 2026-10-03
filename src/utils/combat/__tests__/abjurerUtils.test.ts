/**
 * This file proves the Abjurer Arcane Ward max formula, creation, recharge, and
 * damage interception.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  ARCANE_WARD_FEATURE_ID,
  calculateArcaneWardMaxHp,
  createArcaneWard,
  rechargeArcaneWard,
  resolveArcaneWardAbsorption,
} from '../abjurerUtils';

function createAbjurer(level = 3, intelligence = 16): CombatCharacter {
  return createMockCombatCharacter({
    id: 'wizard',
    name: 'Wizard',
    team: 'player',
    level,
    stats: {
      strength: 8, dexterity: 12, constitution: 14, intelligence, wisdom: 12, charisma: 10,
      baseInitiative: 1, speed: 30, cr: '1/4',
    },
    abilities: [{
      id: ARCANE_WARD_FEATURE_ID, name: 'Arcane Ward',
      description: 'Create a ward that absorbs damage.',
      type: 'utility', cost: { type: 'free' }, targeting: 'self', range: 0, effects: [],
    }],
  });
}

describe('Arcane Ward', () => {
  it('computes max HP as 2×level + Intelligence modifier', () => {
    expect(calculateArcaneWardMaxHp(3, 3)).toBe(9); // 2*3 + 3
    expect(calculateArcaneWardMaxHp(5, 2)).toBe(12);
  });

  it('creates the ward at max and recharges 2×spell level, capped', () => {
    const wizard = createArcaneWard(createAbjurer(3, 16)); // max 9
    expect(wizard.arcaneWardHp).toBe(9);

    // Deplete partially then recharge by a level-2 spell (4 HP).
    const depleted = { ...wizard, arcaneWardHp: 3 };
    const recharged = rechargeArcaneWard(depleted, 2);
    expect(recharged.arcaneWardHp).toBe(7);

    // Recharge past max is capped.
    expect(rechargeArcaneWard({ ...wizard, arcaneWardHp: 8 }, 3).arcaneWardHp).toBe(9);
  });

  it('absorbs damage before hit points and reports the pass-through', () => {
    const wizard = createArcaneWard(createAbjurer(3, 16)); // ward 9
    const state = createMockCombatState({ characters: [wizard] });

    const result = resolveArcaneWardAbsorption(state, { targetId: 'wizard', damage: 12 });
    expect(result.resolved).toBe(true);
    expect(result.absorbedDamage).toBe(9);
    expect(result.remainingDamage).toBe(3);
    expect(result.remainingWardHp).toBe(0);
    expect(result.state.characters.find(c => c.id === 'wizard')?.arcaneWardHp).toBe(0);
  });

  it('rejects absorption with no active ward', () => {
    const plainWizard = createMockCombatCharacter({ id: 'wizard', name: 'Wizard' });
    const state = createMockCombatState({ characters: [plainWizard] });
    const result = resolveArcaneWardAbsorption(state, { targetId: 'wizard', damage: 5 });
    expect(result.failure).toBe('no_active_ward');
    expect(result.remainingDamage).toBe(5);
  });
});
