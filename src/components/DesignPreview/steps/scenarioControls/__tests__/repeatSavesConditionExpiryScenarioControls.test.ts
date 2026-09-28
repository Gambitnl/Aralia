/**
 * This file proves the Repeat Saves & Condition Expiry board uses canonical state.
 *
 * It checks Hold Person metadata, deterministic Wisdom-save math, retained
 * Paralyzed penalties on failure, source-linked cleanup on success, duration
 * cleanup without a save, unrelated-effect preservation, and baseline reset.
 *
 * Exercises: repeatSavesConditionExpiryScenarioControls.ts.
 * Depends on: the shared mock combat-character factory.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import repeatSavesConditionExpiryScenarioControls, {
  prepareRepeatSavesConditionExpiryCharacters,
  REPEAT_SAVES_CASTER_ID,
  REPEAT_SAVES_DC,
  REPEAT_SAVES_TARGET_ID,
} from '../repeatSavesConditionExpiryScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Rendered-Board Snapshot
// ============================================================================
// Tests and the host share this initializer, so state assertions describe the
// same caster, target, ownership links, and penalties visible in the browser.
// ============================================================================

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: null,
    characters: prepareRepeatSavesConditionExpiryCharacters([
      createMockCombatCharacter({ id: REPEAT_SAVES_CASTER_ID }),
      createMockCombatCharacter({ id: REPEAT_SAVES_TARGET_ID }),
      createMockCombatCharacter({ id: 'repeat-saves-bystander', name: 'Unrelated Bystander' }),
    ]),
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function runAction(controlId: string) {
  return repeatSavesConditionExpiryScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot: createSnapshot(),
  });
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Repeat Saves scenario actor ${id}.`);
  return character;
}

// ============================================================================
// Player-Facing Proof Actions
// ============================================================================
// Each control starts from baseline so its one rule boundary stays auditable.
// ============================================================================

describe('repeatSavesConditionExpiryScenarioControls', () => {
  it('registers three inert action controls', () => {
    expect(repeatSavesConditionExpiryScenarioControls.scenarioId)
      .toBe('repeat_saves_condition_expiry');
    expect(repeatSavesConditionExpiryScenarioControls.controls).toHaveLength(3);
    expect(repeatSavesConditionExpiryScenarioControls.controls.every(control => (
      control.kind === 'action' && control.defaultValue === false
    ))).toBe(true);
  });

  it('prepares canonical Hold Person ownership, timing, penalties, and unrelated effects', () => {
    const snapshot = createSnapshot();
    const caster = findCharacter(snapshot.characters, REPEAT_SAVES_CASTER_ID);
    const target = findCharacter(snapshot.characters, REPEAT_SAVES_TARGET_ID);
    const holdStatus = target.statusEffects.find(status => status.sourceSpellId === 'hold-person');

    expect(holdStatus).toMatchObject({
      name: 'Paralyzed',
      sourceCasterId: REPEAT_SAVES_CASTER_ID,
      repeatSave: {
        timing: 'turn_end',
        saveType: 'Wisdom',
        successEnds: true,
        dc: REPEAT_SAVES_DC,
      },
    });
    expect(target.actionEconomy.movement.total).toBe(0);
    expect(target.statusEffects.map(status => status.name)).toContain('Blessed');
    expect(target.activeEffects?.map(effect => effect.spellId)).toContain('mage-armor');
    expect(caster.stats.baseInitiative - target.stats.baseInitiative).toBeGreaterThan(20);
  });

  it('retains Hold Person and its penalties after the failed turn-end save', () => {
    const result = runAction('fail-repeat-save');
    const target = findCharacter(result.characters ?? [], REPEAT_SAVES_TARGET_ID);
    const caster = findCharacter(result.characters ?? [], REPEAT_SAVES_CASTER_ID);

    expect(target.statusEffects.map(status => status.name)).toEqual(['Paralyzed', 'Blessed']);
    expect(target.conditions?.map(condition => condition.name)).toEqual(['Paralyzed']);
    expect(target.actionEconomy.movement.total).toBe(0);
    expect(caster.concentratingOn?.spellId).toBe('hold-person');
    expect(result.logMessage).toContain('d20 5 + 0 = 5 vs DC 15 fails');
    expect(result.logMessage).toContain('Action blocked');
  });

  it('removes source-linked Hold Person on success and preserves unrelated effects', () => {
    const result = runAction('succeed-repeat-save');
    const target = findCharacter(result.characters ?? [], REPEAT_SAVES_TARGET_ID);
    const caster = findCharacter(result.characters ?? [], REPEAT_SAVES_CASTER_ID);

    expect(target.statusEffects.map(status => status.name)).toEqual(['Blessed']);
    expect(target.conditions).toEqual([]);
    expect(target.activeEffects?.map(effect => effect.spellId)).toEqual(['mage-armor']);
    expect(target.actionEconomy.movement.total).toBe(30);
    expect(caster.concentratingOn).toBeUndefined();
    expect(result.logMessage).toContain('d20 15 + 0 = 15 vs DC 15 succeeds');
    expect(result.logMessage).toContain('Blessed and Mage Armor remain');
  });

  it('expires both Hold Person mirrors without a save and restores movement', () => {
    const result = runAction('expire-duration');
    const target = findCharacter(result.characters ?? [], REPEAT_SAVES_TARGET_ID);

    expect(target.statusEffects.map(status => status.name)).toEqual(['Blessed']);
    expect(target.conditions).toEqual([]);
    expect(target.activeEffects?.map(effect => effect.spellId)).toEqual(['mage-armor']);
    expect(target.actionEconomy.movement.total).toBe(30);
    expect(result.logMessage).toContain('without another save');
    expect(result.logMessage).toContain('Paralyzed leaves both runtime mirrors');
  });

  it('restores the held baseline and preserves unrelated actors', () => {
    const resetCharacters = prepareRepeatSavesConditionExpiryCharacters(
      runAction('succeed-repeat-save').characters ?? [],
    );
    const resetTarget = findCharacter(resetCharacters, REPEAT_SAVES_TARGET_ID);

    expect(resetTarget.statusEffects.map(status => status.name)).toEqual(['Paralyzed', 'Blessed']);
    expect(resetTarget.conditions?.map(condition => condition.name)).toEqual(['Paralyzed']);
    expect(resetTarget.actionEconomy.movement.total).toBe(0);
    expect(resetCharacters.find(character => character.id === 'repeat-saves-bystander')?.name)
      .toBe('Unrelated Bystander');
  });
});
