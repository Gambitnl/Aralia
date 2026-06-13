import { describe, expect, it } from 'vitest';
import { applyDamageAndCheckDowned } from '../deathSaveUtils';
import type { CombatCharacter } from '../../../types/combat';

/**
 * This file protects the shared combat damage helper.
 *
 * Many commands and reducers rely on this helper to subtract damage from
 * temporary hit points before normal hit points. These tests keep that shared
 * behavior aligned with spell lifecycle rules, especially Armor of Agathys
 * needing to know when its own temporary hit points have been depleted.
 *
 * Called by: focused Vitest combat utility checks
 * Depends on: deathSaveUtils.ts and the CombatCharacter temp-HP fields
 */

describe('applyDamageAndCheckDowned', () => {
  const makeCharacter = (tempHP: number): CombatCharacter => ({
    id: 'protected-caster',
    name: 'Protected Caster',
    level: 3,
    class: {
      id: 'warlock',
      name: 'Warlock',
      description: 'A pact caster.',
      hitDie: 8,
      primaryAbility: ['Charisma'],
      savingThrowProficiencies: [],
      skillProficienciesAvailable: [],
      numberOfSkillProficiencies: 0,
      armorProficiencies: [],
      weaponProficiencies: [],
      features: []
    },
    stats: {
      strength: 10,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 16,
      baseInitiative: 0,
      speed: 30,
      cr: '1'
    },
    currentHP: 20,
    maxHP: 20,
    position: { x: 0, y: 0 },
    initiative: 10,
    abilities: [],
    statusEffects: [],
    team: 'player',
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: 30 },
      freeActions: 1,
      legendary: { used: 0, total: 0 }
    },
    tempHP,
    temporaryHitPointSource: {
      spellId: 'armor-of-agathys',
      spellName: 'Armor of Agathys',
      casterId: 'protected-caster'
    }
  });

  it('keeps temporary HP source while some of that pool remains', () => {
    // A small hit should reduce the Armor temporary HP but keep the source
    // marker because the spell-owned pool still exists.
    const updated = applyDamageAndCheckDowned(makeCharacter(5), 2);

    expect(updated.tempHP).toBe(3);
    expect(updated.temporaryHitPointSource?.spellId).toBe('armor-of-agathys');
  });

  it('clears temporary HP source when that pool is fully depleted', () => {
    // Once damage consumes the whole temporary HP pool, Armor-style reactive
    // effects must no longer see this character as protected by that spell.
    const updated = applyDamageAndCheckDowned(makeCharacter(5), 5);

    expect(updated.tempHP).toBe(0);
    expect(updated.temporaryHitPointSource).toBeUndefined();
  });
});
