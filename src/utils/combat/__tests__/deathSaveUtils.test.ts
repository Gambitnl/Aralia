import { describe, expect, it } from 'vitest';
import {
  applyDamageAndCheckDowned,
  applyTemporaryHitPoints,
  resolveDeathSavingThrow,
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
  describe('Massive Damage Instant Death & Relentless Endurance (GG-448 / agora-6df5, GG-445 / agora-1d80)', () => {
    it('downs character normally when damage reduces HP to 0 but overflow is below max HP', () => {
      // maxHP 20, currentHP 12 -> damage 25 -> 12 consumed, overflow 13 < 20 (not instant death)
      const character = { ...makeCharacter(0), currentHP: 12, maxHP: 20 };
      const updated = applyDamageAndCheckDowned(character, 25);

      expect(updated.currentHP).toBe(0);
      expect(updated.deathSaves).toEqual({
        successes: 0,
        failures: 0,
        isStable: false,
      });
      expect(updated.statusEffects.some(se => se.name === 'Unconscious')).toBe(true);
    });

    it('instantly kills character when damage overflow equals max HP', () => {
      // maxHP 20, currentHP 12 -> damage 32 -> 12 consumed, overflow 20 >= 20 -> instant death!
      const character = { ...makeCharacter(0), currentHP: 12, maxHP: 20 };
      const updated = applyDamageAndCheckDowned(character, 32);

      expect(updated.currentHP).toBe(0);
      expect(updated.deathSaves).toEqual({
        successes: 0,
        failures: 3,
        isStable: false,
      });
      expect(updated.statusEffects.some(se => se.name === 'Unconscious')).toBe(true);
    });

    it('instantly kills character when damage overflow exceeds max HP', () => {
      // maxHP 20, currentHP 12 -> damage 40 -> 12 consumed, overflow 28 > 20 -> instant death!
      const character = { ...makeCharacter(0), currentHP: 12, maxHP: 20 };
      const updated = applyDamageAndCheckDowned(character, 40);

      expect(updated.currentHP).toBe(0);
      expect(updated.deathSaves?.failures).toBe(3);
    });

    it('absorbs damage through temporary HP before calculating massive damage overflow', () => {
      // maxHP 20, currentHP 12, tempHP 10 -> damage 35:
      // tempHP absorbs 10 (25 remains), 12 consumed, overflow 13 < 20 -> survives!
      const character = { ...makeCharacter(10), currentHP: 12, maxHP: 20 };
      const updated = applyDamageAndCheckDowned(character, 35);

      expect(updated.currentHP).toBe(0);
      expect(updated.tempHP).toBe(0);
      expect(updated.deathSaves?.failures).toBe(0);

      // Now with damage 45: tempHP absorbs 10 (35 remains), 12 consumed, overflow 23 >= 20 -> dies!
      const character2 = { ...makeCharacter(10), currentHP: 12, maxHP: 20 };
      const updated2 = applyDamageAndCheckDowned(character2, 45);

      expect(updated2.currentHP).toBe(0);
      expect(updated2.deathSaves?.failures).toBe(3);
    });

    it('triggers Relentless Endurance to drop to 1 HP when lethal damage does not kill outright', () => {
      const character: CombatCharacter = {
        ...makeCharacter(0),
        currentHP: 12,
        maxHP: 20,
        limitedUses: {
          'feature_orc__relentless_endurance__resource': {
            name: 'Relentless Endurance',
            current: 1,
            max: 1,
            resetOn: 'long_rest',
          },
        },
      };

      // Damage 25 would reduce to 0 (overflow 13 < 20). Relentless Endurance saves the character!
      const updated = applyDamageAndCheckDowned(character, 25);

      expect(updated.currentHP).toBe(1);
      expect(updated.limitedUses?.['feature_orc__relentless_endurance__resource'].current).toBe(0);
      expect(updated.deathSaves).toBeUndefined();
      expect(updated.statusEffects.some(se => se.name === 'Unconscious')).toBe(false);
    });

    it('does NOT trigger Relentless Endurance when damage kills outright from massive damage', () => {
      const character: CombatCharacter = {
        ...makeCharacter(0),
        currentHP: 12,
        maxHP: 20,
        limitedUses: {
          'feature_orc__relentless_endurance__resource': {
            name: 'Relentless Endurance',
            current: 1,
            max: 1,
            resetOn: 'long_rest',
          },
        },
      };

      // Damage 35 produces overflow 23 >= 20 -> killed outright, so Relentless Endurance does NOT apply!
      const updated = applyDamageAndCheckDowned(character, 35);

      expect(updated.currentHP).toBe(0);
      expect(updated.deathSaves?.failures).toBe(3);
      // Resource is not spent when killed outright
      expect(updated.limitedUses?.['feature_orc__relentless_endurance__resource'].current).toBe(1);
    });

    it('preserves existing successes and breaks stability when a stable character takes non-lethal damage', () => {
      const stableCharacter: CombatCharacter = {
        ...makeCharacter(0),
        currentHP: 0,
        maxHP: 20,
        deathSaves: {
          successes: 3,
          failures: 1,
          isStable: true,
        },
      };

      // Taking non-critical damage at 0 HP breaks stability, resets successes to 0, and adds 1 failure
      const updated = applyDamageAndCheckDowned(stableCharacter, 5, false);

      expect(updated.deathSaves).toEqual({
        successes: 0,
        failures: 2,
        isStable: false,
      });

      // Taking critical damage at 0 HP inflicts 2 failures and resets successes
      const updatedCrit = applyDamageAndCheckDowned(stableCharacter, 5, true);
      expect(updatedCrit.deathSaves).toEqual({
        successes: 0,
        failures: 3,
        isStable: false,
      });
    });

    it('preserves successes when an unstable character takes damage at 0 HP', () => {
      const unstableCharacter: CombatCharacter = {
        ...makeCharacter(0),
        currentHP: 0,
        maxHP: 20,
        deathSaves: {
          successes: 2,
          failures: 0,
          isStable: false,
        },
      };

      const updated = applyDamageAndCheckDowned(unstableCharacter, 4, false);
      expect(updated.deathSaves).toEqual({
        successes: 2,
        failures: 1,
        isStable: false,
      });
    });

    it('handles transition from stabilized to taking damage then rolling new death saves', () => {
      // 1. Stabilize character via 3 successes
      const dyingChar: CombatCharacter = {
        ...makeCharacter(0),
        currentHP: 0,
        maxHP: 20,
        deathSaves: {
          successes: 2,
          failures: 1,
          isStable: false,
        },
      };

      const stabilizedResult = resolveDeathSavingThrow(dyingChar, 12);
      expect(stabilizedResult.outcome).toBe('stable');
      expect(stabilizedResult.character.deathSaves).toEqual({
        successes: 3,
        failures: 1,
        isStable: true,
      });

      // 2. Character takes damage while stable -> stability breaks, successes reset to 0, failures increment to 2
      const damagedChar = applyDamageAndCheckDowned(stabilizedResult.character, 5, false);
      expect(damagedChar.deathSaves).toEqual({
        successes: 0,
        failures: 2,
        isStable: false,
      });

      // 3. Character rolls a success -> successes becomes 1, failures remains 2, still not stable
      const nextSaveResult = resolveDeathSavingThrow(damagedChar, 14);
      expect(nextSaveResult.outcome).toBe('success');
      expect(nextSaveResult.character.deathSaves).toEqual({
        successes: 1,
        failures: 2,
        isStable: false,
      });

      // 4. If character rolls a 20 -> revived to 1 HP, death saves cleared
      const nat20Result = resolveDeathSavingThrow(damagedChar, 20);
      expect(nat20Result.outcome).toBe('revived');
      expect(nat20Result.character.currentHP).toBe(1);
      expect(nat20Result.character.deathSaves).toBeUndefined();
    });

    it('instantly kills character at 0 HP if single damage hit meets or exceeds max HP', () => {
      const downedCharacter: CombatCharacter = {
        ...makeCharacter(0),
        currentHP: 0,
        maxHP: 20,
        deathSaves: {
          successes: 0,
          failures: 1,
          isStable: false,
        },
      };

      const updated = applyDamageAndCheckDowned(downedCharacter, 20);
      expect(updated.deathSaves?.failures).toBe(3);
    });
  });
});