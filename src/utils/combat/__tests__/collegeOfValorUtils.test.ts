/**
 * This file proves the College of Valor Combat Inspiration hand-off/spend and
 * the Martial Training proficiency merge.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  applyValorMartialTraining,
  grantCombatInspiration,
  hasCombatInspiration,
  resolveCombatInspirationSpend,
} from '../collegeOfValorUtils';

function createValorBard(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'valor-bard',
    name: 'Valor Bard',
    team: 'player',
    limitedUses: {
      bardic_inspiration: { name: 'Bardic Inspiration', current: 3, max: 3, resetOn: 'long_rest' },
    },
  });
}

function createAlly(): CombatCharacter {
  return createMockCombatCharacter({ id: 'ally', name: 'Ally', team: 'player' });
}

describe('grantCombatInspiration', () => {
  it('debits the bard and hands one inspiration to the ally', () => {
    const bard = createValorBard();
    const ally = createAlly();

    const result = grantCombatInspiration(bard, ally);

    expect(result.granted).toBe(true);
    expect(result.bard.limitedUses?.bardic_inspiration.current).toBe(2);
    expect(hasCombatInspiration(result.ally)).toBe(true);
    expect(result.ally.statusEffects.some(effect => effect.sourceCasterId === 'valor-bard')).toBe(true);
  });

  it('refuses the hand-off when the bard has no inspiration dice left', () => {
    const bard = {
      ...createValorBard(),
      limitedUses: { bardic_inspiration: { name: 'Bardic Inspiration', current: 0, max: 3, resetOn: 'long_rest' as const } },
    };
    const ally = createAlly();

    const result = grantCombatInspiration(bard, ally);

    expect(result.granted).toBe(false);
    expect(result.failure).toBe('no_bardic_inspiration');
    expect(hasCombatInspiration(result.ally)).toBe(false);
  });
});

describe('resolveCombatInspirationSpend', () => {
  it('consumes the inspiration and returns the deterministic d6 bonus for damage', () => {
    const granted = grantCombatInspiration(createValorBard(), createAlly());
    const result = resolveCombatInspirationSpend(granted.ally, 'damage', () => 0.5);

    expect(result.resolved).toBe(true);
    expect(result.dieRolled).toBe(4);
    expect(result.bonus).toBe(4);
    expect(hasCombatInspiration(result.ally)).toBe(false);
  });

  it('supports the AC outcome with the same die', () => {
    const granted = grantCombatInspiration(createValorBard(), createAlly());
    const result = resolveCombatInspirationSpend(granted.ally, 'ac', () => 0.5);

    expect(result.resolved).toBe(true);
    expect(result.bonus).toBe(4);
    expect(hasCombatInspiration(result.ally)).toBe(false);
  });

  it('rejects a spend when the ally holds no inspiration', () => {
    const result = resolveCombatInspirationSpend(createAlly(), 'damage');

    expect(result.resolved).toBe(false);
    expect(result.failure).toBe('no_combat_inspiration');
  });
});

describe('applyValorMartialTraining', () => {
  it('adds medium armor, shields, and martial weapons to the proficiency lists', () => {
    const result = applyValorMartialTraining({
      armorProficiencies: ['light'],
      weaponProficiencies: ['dagger'],
    });

    expect(result.armorProficiencies).toEqual(expect.arrayContaining(['medium', 'shield']));
    expect(result.weaponProficiencies).toEqual(expect.arrayContaining(['longsword', 'greatsword', 'rapier']));
  });

  it('preserves existing proficiencies and dedupes by lowercase', () => {
    const result = applyValorMartialTraining({
      armorProficiencies: ['Light', 'medium'],
      weaponProficiencies: ['Longsword'],
    });

    expect(result.armorProficiencies).toEqual(expect.arrayContaining(['light', 'medium', 'shield']));
    expect(result.weaponProficiencies).toEqual(expect.arrayContaining(['longsword']));
  });
});
