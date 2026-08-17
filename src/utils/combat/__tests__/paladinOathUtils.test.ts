/**
 * This file proves the Oath of Devotion Sacred Weapon and Oath of Vengeance
 * Vow of Enmity Channel Divinity transactions.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  calculateSacredWeaponAttackBonus,
  resolveSacredWeapon,
  SACRED_WEAPON_FEATURE_ID,
} from '../oathOfDevotionUtils';
import {
  hasVowAdvantageAgainst,
  resolveVowOfEnmity,
  VOW_OF_ENMITY_FEATURE_ID,
} from '../oathOfVengeanceUtils';

function ability(id: string, name: string) {
  return { id, name, description: name, type: 'utility' as const, cost: { type: 'bonus' as const }, targeting: 'self' as const, range: 0, effects: [] };
}

function createPaladin(abilityId: string, charisma = 16): CombatCharacter {
  return createMockCombatCharacter({
    id: 'paladin',
    name: 'Paladin',
    team: 'player',
    position: { x: 0, y: 0 },
    stats: {
      strength: 16, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 12, charisma,
      baseInitiative: 0, speed: 30, cr: '1/4',
    },
    limitedUses: {
      channel_divinity: { name: 'Channel Divinity', current: 1, max: 1, resetOn: 'short_rest' },
    },
    abilities: [ability(abilityId, abilityId === SACRED_WEAPON_FEATURE_ID ? 'Sacred Weapon' : 'Vow of Enmity')],
  });
}

describe('Sacred Weapon', () => {
  it('computes the Charisma modifier attack bonus', () => {
    expect(calculateSacredWeaponAttackBonus(16)).toBe(3);
    expect(calculateSacredWeaponAttackBonus(8)).toBe(-1);
  });

  it('spends Channel Divinity and applies the Sacred Weapon buff', () => {
    const paladin = createPaladin(SACRED_WEAPON_FEATURE_ID);
    const state = createMockCombatState({ characters: [paladin] });

    const result = resolveSacredWeapon(state, { paladinId: 'paladin' });
    expect(result.resolved).toBe(true);
    expect(result.attackBonus).toBe(3);
    expect(result.remainingChannelDivinityUses).toBe(0);

    const next = result.state.characters.find(c => c.id === 'paladin');
    expect(next?.statusEffects.some(e => e.name === 'Sacred Weapon')).toBe(true);

    // No Channel Divinity remaining → second activation fails.
    expect(resolveSacredWeapon(result.state, { paladinId: 'paladin' }).failure)
      .toBe('no_channel_divinity');
  });

  it('rejects a non-Devotion paladin', () => {
    const other = createMockCombatCharacter({ id: 'paladin', name: 'Paladin', team: 'player' });
    const state = createMockCombatState({ characters: [other] });
    expect(resolveSacredWeapon(state, { paladinId: 'paladin' }).failure)
      .toBe('missing_sacred_weapon');
  });
});

describe('Vow of Enmity', () => {
  it('binds the vow to one target and grants advantage only against it', () => {
    const paladin = createPaladin(VOW_OF_ENMITY_FEATURE_ID);
    const target = createMockCombatCharacter({ id: 'dragon', name: 'Dragon', team: 'enemy', position: { x: 1, y: 0 } });
    const bystander = createMockCombatCharacter({ id: 'bystander', name: 'Bystander', team: 'enemy', position: { x: 2, y: 0 } });
    const state = createMockCombatState({ characters: [paladin, target, bystander] });

    const result = resolveVowOfEnmity(state, { paladinId: 'paladin', targetId: 'dragon' });
    expect(result.resolved).toBe(true);
    expect(result.swornTargetId).toBe('dragon');

    const sworn = result.state.characters.find(c => c.id === 'paladin')!;
    expect(hasVowAdvantageAgainst(sworn, 'dragon')).toBe(true);
    expect(hasVowAdvantageAgainst(sworn, 'bystander')).toBe(false);
  });

  it('rejects a missing target or exhausted Channel Divinity', () => {
    const paladin = createPaladin(VOW_OF_ENMITY_FEATURE_ID);
    const state = createMockCombatState({ characters: [paladin] });
    expect(resolveVowOfEnmity(state, { paladinId: 'paladin', targetId: 'ghost' }).failure)
      .toBe('target_missing');

    const empty = createMockCombatCharacter({
      ...createPaladin(VOW_OF_ENMITY_FEATURE_ID),
      id: 'paladin',
      limitedUses: { channel_divinity: { name: 'Channel Divinity', current: 0, max: 1, resetOn: 'short_rest' } },
    });
    const emptyState = createMockCombatState({
      characters: [empty, createMockCombatCharacter({ id: 'dragon', name: 'Dragon', team: 'enemy' })],
    });
    expect(resolveVowOfEnmity(emptyState, { paladinId: 'paladin', targetId: 'dragon' }).failure)
      .toBe('no_channel_divinity');
  });
});
