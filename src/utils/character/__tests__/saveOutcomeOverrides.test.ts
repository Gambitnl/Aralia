/**
 * This file verifies save-outcome override resolution across creature traits and context.
 *
 * D&D 5e rules include several traits and conditions that override normal saving throw rolls:
 * - Plant creatures automatically fail against Blight.
 * - Non-humanoids automatically succeed on humanoid-only constraints.
 * - Huge or larger creatures automatically succeed on Watery Sphere Strength saves.
 * - Targets fighting the caster/allies automatically succeed against Friends.
 * - Creatures can choose voluntary failure where authored (e.g. Watery Sphere, Scrying).
 *
 * Called by: Vitest
 * Depends on: savingThrowUtils.ts
 */
import { describe, expect, it } from 'vitest';
import { resolveSaveOutcomeOverride } from '../savingThrowUtils';
import { createMockCombatCharacter, type MockCombatCharacterOverrides } from '@/utils/core/factories';
import type { SaveOutcomeOverride } from '@/types/spells';

const createMockCharacter = (overrides: MockCombatCharacterOverrides = {}) => createMockCombatCharacter({
  id: 'char_test',
  name: 'Test Character',
  team: 'enemy',
  level: 5,
  currentHP: 50,
  maxHP: 50,
  stats: {
    strength: 14,
    dexterity: 12,
    constitution: 14,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    size: 'Medium',
    speed: 30,
    baseInitiative: 0,
    cr: '5',
    creatureTypes: ['Humanoid']
  },
  position: { x: 0, y: 0 },
  ...overrides
});

describe('resolveSaveOutcomeOverride', () => {
  it('resolves auto_failure for plant creatures against plant-specific overrides (Blight)', () => {
    const plantTarget = createMockCharacter({
      creatureTypes: ['Plant']
    });
    const nonPlantTarget = createMockCharacter({
      creatureTypes: ['Humanoid']
    });

    const overrides: SaveOutcomeOverride[] = [{ effect: 'no_additional_effect', outcome: 'auto_failure', condition: 'is_plant_creature' }];

    const plantResult = resolveSaveOutcomeOverride(overrides, plantTarget, 15);
    expect(plantResult).toBeDefined();
    expect(plantResult?.success).toBe(false);
    expect(plantResult?.total).toBe(0);

    const nonPlantResult = resolveSaveOutcomeOverride(overrides, nonPlantTarget, 15);
    expect(nonPlantResult).toBeUndefined();
  });

  it('resolves auto_success for non-humanoids when not_humanoid override is present', () => {
    const beastTarget = createMockCharacter({
      creatureTypes: ['Beast']
    });
    const humanoidTarget = createMockCharacter({
      creatureTypes: ['Humanoid']
    });

    const overrides: SaveOutcomeOverride[] = [{ effect: 'no_additional_effect', outcome: 'auto_success', condition: 'not_humanoid' }];

    const beastResult = resolveSaveOutcomeOverride(overrides, beastTarget, 14);
    expect(beastResult).toBeDefined();
    expect(beastResult?.success).toBe(true);
    expect(beastResult?.total).toBe(14);

    const humanoidResult = resolveSaveOutcomeOverride(overrides, humanoidTarget, 14);
    expect(humanoidResult).toBeUndefined();
  });

  it('resolves auto_success for Huge or larger creatures (Watery Sphere)', () => {
    const hugeTarget = createMockCharacter({
      stats: {
        ...createMockCharacter().stats,
        size: 'Huge'
      }
    });
    const gargantuanTarget = createMockCharacter({
      stats: {
        ...createMockCharacter().stats,
        size: 'Gargantuan'
      }
    });
    const mediumTarget = createMockCharacter({
      stats: {
        ...createMockCharacter().stats,
        size: 'Medium'
      }
    });

    const overrides: SaveOutcomeOverride[] = [
      { effect: 'no_additional_effect', outcome: 'auto_success', condition: 'target_size_huge_or_larger' }
    ];

    const hugeResult = resolveSaveOutcomeOverride(overrides, hugeTarget, 16);
    expect(hugeResult).toBeDefined();
    expect(hugeResult?.success).toBe(true);

    const gargantuanResult = resolveSaveOutcomeOverride(overrides, gargantuanTarget, 16);
    expect(gargantuanResult).toBeDefined();
    expect(gargantuanResult?.success).toBe(true);

    const mediumResult = resolveSaveOutcomeOverride(overrides, mediumTarget, 16);
    expect(mediumResult).toBeUndefined();
  });

  it('resolves auto_success when fighting caster or allies (Friends)', () => {
    const enemyTarget = createMockCharacter({
      team: 'enemy'
    });
    const allyTarget = createMockCharacter({
      team: 'player'
    });

    const overrides: SaveOutcomeOverride[] = [
      { effect: 'no_additional_effect', outcome: 'auto_success', condition: 'fighting_caster_or_allies' }
    ];

    // Enemy is fighting player team -> auto-success
    const enemyResult = resolveSaveOutcomeOverride(overrides, enemyTarget, 13, 'player');
    expect(enemyResult).toBeDefined();
    expect(enemyResult?.success).toBe(true);

    // Ally is on same team as player -> does not trigger hostility auto-success
    const allyResult = resolveSaveOutcomeOverride(overrides, allyTarget, 13, 'player');
    expect(allyResult).toBeUndefined();
  });

  it('resolves voluntary_failure when voluntary failure flag is active', () => {
    const consentingTarget = createMockCharacter({
      voluntaryFailure: true,
      stats: {
        ...createMockCharacter().stats,
        size: 'Medium'
      }
    });
    const normalTarget = createMockCharacter({
      voluntaryFailure: false
    });

    const overrides: SaveOutcomeOverride[] = [
      { effect: 'no_additional_effect', outcome: 'voluntary_failure_allowed', condition: 'target_size_large_or_smaller' }
    ];

    const consentingResult = resolveSaveOutcomeOverride(overrides, consentingTarget, 15);
    expect(consentingResult).toBeDefined();
    expect(consentingResult?.success).toBe(false);
    expect(consentingResult?.total).toBe(0);

    const normalResult = resolveSaveOutcomeOverride(overrides, normalTarget, 15);
    expect(normalResult).toBeUndefined();
  });

  it('resolves condition immunities for charmed and frightened', () => {
    const charmedImmune = createMockCharacter({
      conditionImmunities: ['Charmed']
    });
    const normal = createMockCharacter({
      conditionImmunities: []
    });

    const charmedOverrides: SaveOutcomeOverride[] = [{ effect: 'no_additional_effect', outcome: 'auto_success', condition: 'immune_to_charmed' }];

    expect(resolveSaveOutcomeOverride(charmedOverrides, charmedImmune, 15)?.success).toBe(true);
    expect(resolveSaveOutcomeOverride(charmedOverrides, normal, 15)).toBeUndefined();
  });
});
