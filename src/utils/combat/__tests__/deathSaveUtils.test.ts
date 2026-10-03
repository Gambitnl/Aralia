import { describe, expect, it } from 'vitest';
import {
  applyDamageAndCheckDowned,
  applyTemporaryHitPoints,
} from '../deathSaveUtils';
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

  // The grant helper is the shared authority used by healing and defensive
  // spell commands. These checks pin replacement, non-stacking, and provenance
  // before the scenario layer relies on those facts for visible proof.
  describe('applyTemporaryHitPoints', () => {
    it('keeps a larger existing pool and its source when offered fewer points', () => {
      const original = makeCharacter(8);
      const updated = applyTemporaryHitPoints(original, 5, {
        spellId: 'heroism',
        spellName: 'Heroism',
        casterId: 'support-caster',
      });

      expect(updated).not.toBe(original);
      expect(updated.tempHP).toBe(8);
      expect(updated.temporaryHitPointSource).toEqual(original.temporaryHitPointSource);
    });

    it('replaces a smaller pool and its source when offered more points', () => {
      const updated = applyTemporaryHitPoints(makeCharacter(8), 12, {
        spellId: 'heroism',
        spellName: 'Heroism',
        casterId: 'support-caster',
      });

      expect(updated.tempHP).toBe(12);
      expect(updated.temporaryHitPointSource).toEqual({
        spellId: 'heroism',
        spellName: 'Heroism',
        casterId: 'support-caster',
      });
    });

    it('clears stale spell ownership when a larger source-less pool replaces it', () => {
      const updated = applyTemporaryHitPoints(makeCharacter(5), 10);

      expect(updated.tempHP).toBe(10);
      expect(updated.temporaryHitPointSource).toBeUndefined();
    });
  });
});
