/**
 * This file proves the Damage Over Time board is built from canonical spells.
 *
 * It checks actor ownership, stable initiative, target HP, future-turn timing,
 * dice and damage types, deterministic replay totals, defense/save controls,
 * lifecycle ownership, selective removal, and the ten-round expiry boundary.
 *
 * Exercises: damageOverTimeScheduledEffectsScenarioControls.ts.
 * Depends on: the shared mock combat-character factory and canonical spell JSON.
 */

import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter } from '../../../../../utils/core';
import damageOverTimeScheduledEffectsScenarioControls, {
  createDamageOverTimeScheduledEffects,
  DAMAGE_OVER_TIME_ACID_ROLL,
  DAMAGE_OVER_TIME_ACID_SCHEDULE_ID,
  DAMAGE_OVER_TIME_DEFENSE_CONTROL_ID,
  DAMAGE_OVER_TIME_LIFECYCLE_CONTROL_ID,
  DAMAGE_OVER_TIME_SEARING_ROLL,
  DAMAGE_OVER_TIME_SEARING_FAILED_SAVE_FACE,
  DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID,
  DAMAGE_OVER_TIME_SEARING_SAVE_DC,
  DAMAGE_OVER_TIME_SEARING_SUCCESS_SAVE_FACE,
  DAMAGE_OVER_TIME_SAVE_OUTCOME_CONTROL_ID,
  DAMAGE_OVER_TIME_SOURCE_ID,
  DAMAGE_OVER_TIME_SOURCE_INITIATIVE,
  DAMAGE_OVER_TIME_TARGET_ID,
  DAMAGE_OVER_TIME_TARGET_INITIATIVE,
  DAMAGE_OVER_TIME_TARGET_MAX_HP,
  describeDamageOverTimeSchedule,
  getDamageOverTimeScheduledEffectsInitiativeTotal,
  prepareDamageOverTimeScheduledEffectsCharacters,
  rollDamageOverTimeScheduledEffect,
  rollDamageOverTimeScheduledSave,
  SEARING_SMITE_DURATION_ROUNDS,
} from '../damageOverTimeScheduledEffectsScenarioControls';

// ============================================================================
// Shared Board Fixture
// ============================================================================
// The same preparer used by the mounted host creates both actors here, keeping
// visible names, HP, source links, and initiative facts under one contract.
// ============================================================================

function createCharacters() {
  return prepareDamageOverTimeScheduledEffectsCharacters([
    createMockCombatCharacter({ id: DAMAGE_OVER_TIME_SOURCE_ID }),
    createMockCombatCharacter({ id: DAMAGE_OVER_TIME_TARGET_ID }),
    createMockCombatCharacter({ id: 'damage-over-time-unrelated' }),
  ]);
}

function runControl(controlId: string, value: string | boolean = true) {
  return damageOverTimeScheduledEffectsScenarioControls.applyControl({
    controlId,
    value,
    snapshot: {
      mapData: null,
      characters: createCharacters(),
      activeLightSources: [],
      reactiveTriggers: [],
      scheduledSpellEffects: createDamageOverTimeScheduledEffects(),
      turnState: {
        currentTurn: 1,
        currentCharacterId: DAMAGE_OVER_TIME_SOURCE_ID,
        turnOrder: [DAMAGE_OVER_TIME_SOURCE_ID, DAMAGE_OVER_TIME_TARGET_ID],
        phase: 'action',
        actionsThisTurn: [],
      },
    },
  });
}

// ============================================================================
// Canonical Queue And Control Proof
// ============================================================================
// Each assertion protects a player-visible claim made by the CS35 schedule
// strip or its controls; no test-only duplicate payload is introduced.
// ============================================================================

describe('damageOverTimeScheduledEffectsScenarioControls', () => {
  it('prepares exact source, target, HP, initiative, and Ignited ownership', () => {
    const characters = createCharacters();
    const source = characters.find(character => character.id === DAMAGE_OVER_TIME_SOURCE_ID);
    const target = characters.find(character => character.id === DAMAGE_OVER_TIME_TARGET_ID);

    expect(source).toMatchObject({
      initiative: DAMAGE_OVER_TIME_SOURCE_INITIATIVE,
      concentratingOn: undefined,
    });
    expect(target).toMatchObject({
      currentHP: DAMAGE_OVER_TIME_TARGET_MAX_HP,
      maxHP: DAMAGE_OVER_TIME_TARGET_MAX_HP,
      initiative: DAMAGE_OVER_TIME_TARGET_INITIATIVE,
    });
    expect(target?.statusEffects).toEqual([
      expect.objectContaining({
        name: 'Ignited',
        sourceSpellId: 'searing-smite',
        sourceCasterId: DAMAGE_OVER_TIME_SOURCE_ID,
      }),
    ]);
    expect(getDamageOverTimeScheduledEffectsInitiativeTotal(source!))
      .toBe(DAMAGE_OVER_TIME_SOURCE_INITIATIVE);
    expect(getDamageOverTimeScheduledEffectsInitiativeTotal(target!))
      .toBe(DAMAGE_OVER_TIME_TARGET_INITIATIVE);
  });

  it('derives ordered start/every-time and end/once schedules from spell data', () => {
    const schedules = createDamageOverTimeScheduledEffects();
    const displays = schedules.map(describeDamageOverTimeSchedule);

    expect(displays).toEqual([
      expect.objectContaining({
        id: DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID,
        spellId: 'searing-smite',
        nextTrigger: 'start of target turn',
        damage: '1d6',
        damageType: 'Fire',
        frequency: 'every_time',
        expiresAtRound: 1 + SEARING_SMITE_DURATION_ROUNDS,
        saveType: 'Constitution',
        saveDC: DAMAGE_OVER_TIME_SEARING_SAVE_DC,
      }),
      expect.objectContaining({
        id: DAMAGE_OVER_TIME_ACID_SCHEDULE_ID,
        spellId: 'melfs-acid-arrow',
        nextTrigger: 'end of target turn',
        damage: '2d4',
        damageType: 'Acid',
        frequency: 'once',
        expiresAtRound: 2,
      }),
    ]);
    expect(displays.every(display => (
      display.sourceId === DAMAGE_OVER_TIME_SOURCE_ID
      && display.targetId === DAMAGE_OVER_TIME_TARGET_ID
    ))).toBe(true);
  });

  it('pins legal deterministic totals without changing canonical dice strings', () => {
    const [searing, acid] = createDamageOverTimeScheduledEffects();

    expect(rollDamageOverTimeScheduledEffect('1d6', searing))
      .toBe(DAMAGE_OVER_TIME_SEARING_ROLL);
    expect(rollDamageOverTimeScheduledEffect('2d4', acid))
      .toBe(DAMAGE_OVER_TIME_ACID_ROLL);
    expect(() => rollDamageOverTimeScheduledEffect('9d9', searing))
      .toThrow(/no deterministic roll/i);
    expect(Math.floor(rollDamageOverTimeScheduledSave('failure') * 20) + 1)
      .toBe(DAMAGE_OVER_TIME_SEARING_FAILED_SAVE_FACE);
    expect(Math.floor(rollDamageOverTimeScheduledSave('success') * 20) + 1)
      .toBe(DAMAGE_OVER_TIME_SEARING_SUCCESS_SAVE_FACE);
  });

  it('requests selective Acid schedule removal while leaving Fire untouched', () => {
    const patch = runControl('remove-acid-schedule');

    expect(patch.scheduledSpellEffectIdsToRemove)
      .toEqual([DAMAGE_OVER_TIME_ACID_SCHEDULE_ID]);
    expect(patch.scheduledSpellEffectIdsToRemove)
      .not.toContain(DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID);
    expect(patch.logMessage).toContain('later target turn ends cannot fire');
  });

  it('writes canonical defense facts for resistance, immunity, temp HP, and downing proof', () => {
    const resistance = runControl(DAMAGE_OVER_TIME_DEFENSE_CONTROL_ID, 'resistance');
    const immunity = runControl(DAMAGE_OVER_TIME_DEFENSE_CONTROL_ID, 'immunity');
    const warded = runControl(DAMAGE_OVER_TIME_DEFENSE_CONTROL_ID, 'temporary_hit_points');
    const lethal = runControl(DAMAGE_OVER_TIME_DEFENSE_CONTROL_ID, 'lethal');
    const findTarget = (characters = createCharacters()) => characters.find(character => (
      character.id === DAMAGE_OVER_TIME_TARGET_ID
    ));

    expect(findTarget(resistance.characters)?.resistances).toEqual(['Fire']);
    expect(findTarget(immunity.characters)?.immunities).toEqual(['Fire']);
    expect(findTarget(warded.characters)).toMatchObject({ tempHP: 3 });
    expect(findTarget(lethal.characters)).toMatchObject({ currentHP: 3, team: 'player' });
  });

  it('selects deterministic save results without calculating the canonical save in the adapter', () => {
    const failure = runControl(DAMAGE_OVER_TIME_SAVE_OUTCOME_CONTROL_ID, 'failure');
    const success = runControl(DAMAGE_OVER_TIME_SAVE_OUTCOME_CONTROL_ID, 'success');

    expect(failure.characters).toBeUndefined();
    expect(failure.logMessage).toContain(`d20 ${DAMAGE_OVER_TIME_SEARING_FAILED_SAVE_FACE}`);
    expect(success.characters).toBeUndefined();
    expect(success.logMessage).toContain(`d20 ${DAMAGE_OVER_TIME_SEARING_SUCCESS_SAVE_FACE}`);
  });

  it('primes exclusive expiry and distinguishes source retention from target removal', () => {
    const nearExpiry = runControl(DAMAGE_OVER_TIME_LIFECYCLE_CONTROL_ID, 'near_expiry');
    const sourceRemoved = runControl(DAMAGE_OVER_TIME_LIFECYCLE_CONTROL_ID, 'source_removed');
    const targetRemoved = runControl(DAMAGE_OVER_TIME_LIFECYCLE_CONTROL_ID, 'target_removed');

    expect(nearExpiry.scheduledSpellEffectsToReplace?.find(effect => (
      effect.id === DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID
    ))?.expiresAtRound).toBe(2);
    expect(sourceRemoved.characters?.some(character => (
      character.id === DAMAGE_OVER_TIME_SOURCE_ID
    ))).toBe(false);
    expect(sourceRemoved.removeCharacterFromCombatId).toBe(DAMAGE_OVER_TIME_SOURCE_ID);
    expect(sourceRemoved.logMessage).toContain('retain their captured owner id and save DC');
    expect(targetRemoved.characters?.some(character => (
      character.id === DAMAGE_OVER_TIME_TARGET_ID
    ))).toBe(false);
    expect(targetRemoved.removeCharacterFromCombatId).toBe(DAMAGE_OVER_TIME_TARGET_ID);
  });
});
