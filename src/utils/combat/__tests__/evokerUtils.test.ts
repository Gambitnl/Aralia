/**
 * This file proves the Evoker Sculpt Spells creature limit and save override,
 * and the Potent Cantrip half-damage rule.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  calculateSculptSpellsCreatureLimit,
  POTENT_CANTRIP_FEATURE_ID,
  resolvePotentCantripDamage,
  resolveSculptedTargetSave,
  SCULPT_SPELLS_FEATURE_ID,
  selectSculptedCreatures,
} from '../evokerUtils';

function ability(id: string, name: string) {
  return { id, name, description: name, type: 'utility' as const, cost: { type: 'free' as const }, targeting: 'self' as const, range: 0, effects: [] };
}

function createEvoker(featureId: string): CombatCharacter {
  return createMockCombatCharacter({
    id: 'evoker',
    name: 'Evoker',
    team: 'player',
    abilities: [ability(featureId, featureId === SCULPT_SPELLS_FEATURE_ID ? 'Sculpt Spells' : 'Potent Cantrip')],
  });
}

describe('Sculpt Spells', () => {
  it('computes the 1 + spell level creature limit and selects candidates', () => {
    expect(calculateSculptSpellsCreatureLimit(3)).toBe(4);
    expect(calculateSculptSpellsCreatureLimit(1)).toBe(2);
    expect(selectSculptedCreatures(['a', 'b', 'c', 'd', 'e'], 2)).toEqual(['a', 'b']);
  });

  it('makes a sculpted target auto-succeed and take no half damage', () => {
    const evoker = createEvoker(SCULPT_SPELLS_FEATURE_ID);
    const result = resolveSculptedTargetSave(evoker, true, false, true);
    expect(result.saveSucceeds).toBe(true);
    expect(result.takesHalfDamage).toBe(false);
  });

  it('leaves a non-sculpted target or non-Evoker unchanged', () => {
    const evoker = createEvoker(SCULPT_SPELLS_FEATURE_ID);
    const saved = resolveSculptedTargetSave(evoker, false, true, true);
    expect(saved).toEqual({ saveSucceeds: true, takesHalfDamage: true });

    const wizard = createMockCombatCharacter({ id: 'wizard', name: 'Wizard' });
    expect(resolveSculptedTargetSave(wizard, true, false, true))
      .toEqual({ saveSucceeds: false, takesHalfDamage: false });
  });
});

describe('Potent Cantrip', () => {
  it('halves damage and negates extra effects on a miss or successful save', () => {
    const evoker = createEvoker(POTENT_CANTRIP_FEATURE_ID);
    expect(resolvePotentCantripDamage(evoker, { isCantrip: true, fullDamage: 9, missedOrSaved: true }))
      .toEqual({ damage: 4, negatesAdditionalEffects: true });
  });

  it('leaves a full hit, failed save, or non-cantrip unchanged', () => {
    const evoker = createEvoker(POTENT_CANTRIP_FEATURE_ID);
    expect(resolvePotentCantripDamage(evoker, { isCantrip: true, fullDamage: 9, missedOrSaved: false }))
      .toEqual({ damage: 9, negatesAdditionalEffects: false });
    expect(resolvePotentCantripDamage(evoker, { isCantrip: false, fullDamage: 9, missedOrSaved: true }))
      .toEqual({ damage: 9, negatesAdditionalEffects: false });

    const wizard = createMockCombatCharacter({ id: 'wizard', name: 'Wizard' });
    expect(resolvePotentCantripDamage(wizard, { isCantrip: true, fullDamage: 9, missedOrSaved: true }))
      .toEqual({ damage: 9, negatesAdditionalEffects: false });
  });
});
