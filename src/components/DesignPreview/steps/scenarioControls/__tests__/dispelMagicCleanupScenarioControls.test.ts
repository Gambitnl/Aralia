/**
 * This file proves the Dispel Magic & Effect Cleanup scenario uses live state.
 *
 * Assertions cover the four player-facing actions, exact Action and slot costs,
 * canonical ability-check math, removal of mechanical and visible records,
 * preservation of unrelated Mage Armor, invalid-target rejection, and an
 * unrelated bystander that the scenario must never rewrite.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import dispelMagicCleanupScenarioControls, {
  DISPEL_MAGIC_CLEANUP_BLESSED_TARGET_ID,
  DISPEL_MAGIC_CLEANUP_DISPELLER_ID,
  DISPEL_MAGIC_CLEANUP_FAILURE_D20,
  DISPEL_MAGIC_CLEANUP_HIGHER_DC,
  DISPEL_MAGIC_CLEANUP_SUCCESS_D20,
  DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID,
  prepareDispelMagicCleanupCharacters,
} from '../dispelMagicCleanupScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Rendered-Board Snapshot
// ============================================================================
// The initializer is shared with the host so tests start with exactly the spell
// records, ownership links, positions, and resources visible in 2D and 3D.
// ============================================================================

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const characters = prepareDispelMagicCleanupCharacters([
    createMockCombatCharacter({ id: DISPEL_MAGIC_CLEANUP_DISPELLER_ID }),
    createMockCombatCharacter({ id: DISPEL_MAGIC_CLEANUP_BLESSED_TARGET_ID }),
    createMockCombatCharacter({ id: DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID }),
    createMockCombatCharacter({ id: 'dispel-cleanup-bystander', name: 'Unrelated Bystander' }),
  ]);

  return {
    mapData: null,
    characters,
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function runAction(controlId: string) {
  return dispelMagicCleanupScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot: createSnapshot(),
  });
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Dispel Magic scenario actor ${id}.`);
  return character;
}

// ============================================================================
// Player-Facing Proof Actions
// ============================================================================
// Each action is isolated. The state and reasoned log must agree about costs,
// checks, cleanup, and the unrelated effect that remains.
// ============================================================================

describe('dispelMagicCleanupScenarioControls', () => {
  it('registers four inert action controls', () => {
    expect(dispelMagicCleanupScenarioControls.scenarioId).toBe('dispel_magic_cleanup');
    expect(dispelMagicCleanupScenarioControls.controls).toHaveLength(4);
    expect(dispelMagicCleanupScenarioControls.controls.every(control => (
      control.kind === 'action' && control.defaultValue === false
    ))).toBe(true);
  });

  it('automatically removes lower-level Bless and keeps Mage Armor', () => {
    const result = runAction('dispel-lower-level');
    const characters = result.characters ?? [];
    const dispeller = findCharacter(characters, DISPEL_MAGIC_CLEANUP_DISPELLER_ID);
    const target = findCharacter(characters, DISPEL_MAGIC_CLEANUP_BLESSED_TARGET_ID);

    expect(dispeller.actionEconomy.action.used).toBe(true);
    expect(dispeller.spellSlots?.level_3.current).toBe(0);
    expect(target.statusEffects).toHaveLength(0);
    expect(target.conditions).toHaveLength(0);
    expect(target.concentratingOn).toBeUndefined();
    expect(target.activeEffects?.map(effect => effect.spellId)).toEqual(['mage-armor']);
    expect(target.name).toContain('Bless removed');
    expect(target.name).toContain('Mage Armor kept');
    expect(result.logMessage).toContain('ends automatically after payment');
    expect(result.logMessage).toContain('1 mechanical status');
  });

  it('cleans Greater Invisibility after the deterministic successful check', () => {
    const result = runAction('dispel-higher-success');
    const characters = result.characters ?? [];
    const target = findCharacter(characters, DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID);

    expect(target.statusEffects).toHaveLength(0);
    expect(target.conditions).toHaveLength(0);
    expect(target.concentratingOn).toBeUndefined();
    expect(target.activeEffects?.map(effect => effect.spellId)).toEqual(['mage-armor']);
    expect(target.name).toContain('Visible');
    expect(result.logMessage).toContain(`d20 ${DISPEL_MAGIC_CLEANUP_SUCCESS_D20} + 4 = 20`);
    expect(result.logMessage).toContain(`DC ${DISPEL_MAGIC_CLEANUP_HIGHER_DC} succeeds`);
  });

  it('retains Greater Invisibility after the deterministic failed check', () => {
    const result = runAction('dispel-higher-failure');
    const characters = result.characters ?? [];
    const dispeller = findCharacter(characters, DISPEL_MAGIC_CLEANUP_DISPELLER_ID);
    const target = findCharacter(characters, DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID);

    expect(dispeller.actionEconomy.action.used).toBe(true);
    expect(dispeller.spellSlots?.level_3.current).toBe(0);
    expect(target.statusEffects.map(status => status.name)).toContain('Invisible');
    expect(target.conditions?.map(condition => condition.name)).toContain('Invisible');
    expect(target.concentratingOn?.spellId).toBe('greater-invisibility');
    expect(result.logMessage).toContain(`d20 ${DISPEL_MAGIC_CLEANUP_FAILURE_D20} + 4 = 9`);
    expect(result.logMessage).toContain(`DC ${DISPEL_MAGIC_CLEANUP_HIGHER_DC} fails`);
  });

  it('rejects instantaneous Fireball aftermath without paying or changing effects', () => {
    const result = runAction('reject-instantaneous');
    const characters = result.characters ?? [];
    const dispeller = findCharacter(characters, DISPEL_MAGIC_CLEANUP_DISPELLER_ID);
    const blessedTarget = findCharacter(characters, DISPEL_MAGIC_CLEANUP_BLESSED_TARGET_ID);

    expect(dispeller.actionEconomy.action.used).toBe(false);
    expect(dispeller.spellSlots?.level_3.current).toBe(1);
    expect(blessedTarget.statusEffects.map(status => status.name)).toContain('Blessed');
    expect(result.logMessage).toContain('instantaneous');
    expect(result.logMessage).toContain('Rejected before payment');
  });

  it('preserves actors outside the three scenario identities', () => {
    const result = runAction('dispel-higher-success');
    expect(result.characters?.find(character => character.id === 'dispel-cleanup-bystander')?.name)
      .toBe('Unrelated Bystander');
  });
});

