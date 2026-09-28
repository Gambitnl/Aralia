/**
 * This file proves Saving Throws & Half Damage follows canonical combat rules.
 *
 * The fixture matches the mounted caster, two targets, modifiers, HP, and board
 * positions. Assertions cover a failed save, successful odd-number halving,
 * exact-DC success, defense ordering, immunity, canonical downing, repeat
 * isolation, malformed no-ops, and bystander preservation.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import savingThrowsHalfDamageScenarioControls, {
  SAVING_THROWS_AGILE_TARGET_ID,
  SAVING_THROWS_AGILE_TARGET_START,
  SAVING_THROWS_CASTER_ID,
  SAVING_THROWS_CASTER_START,
  SAVING_THROWS_DAMAGE,
  SAVING_THROWS_DC,
  SAVING_THROWS_SLOW_TARGET_ID,
  SAVING_THROWS_SLOW_TARGET_START,
  SAVING_THROWS_TARGET_HP,
} from '../savingThrowsHalfDamageScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Scenario Snapshot
// ============================================================================
// The target Dexterity scores produce -1 and +3. Neither target is proficient
// in Dexterity saves, so the visible modifier comes only from that score.
// ============================================================================

function createTarget(
  id: string,
  name: string,
  dexterity: number,
  position: { x: number; y: number },
): CombatCharacter {
  return createMockCombatCharacter({
    id,
    name,
    team: 'enemy',
    position,
    currentHP: SAVING_THROWS_TARGET_HP,
    maxHP: SAVING_THROWS_TARGET_HP,
    savingThrowProficiencies: [],
    stats: {
      ...createMockCombatCharacter().stats,
      dexterity,
    },
  });
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: null,
    characters: [
      createMockCombatCharacter({
        id: SAVING_THROWS_CASTER_ID,
        name: 'Pyromancer (DC 15 · 4d6 = 15)',
        level: 5,
        team: 'player',
        position: { ...SAVING_THROWS_CASTER_START },
        stats: {
          ...createMockCombatCharacter().stats,
          intelligence: 18,
        },
      }),
      createTarget(
        SAVING_THROWS_SLOW_TARGET_ID,
        'Slow Guard (DEX -1 · 30 HP)',
        8,
        { ...SAVING_THROWS_SLOW_TARGET_START },
      ),
      createTarget(
        SAVING_THROWS_AGILE_TARGET_ID,
        'Agile Scout (DEX +3 · 30 HP)',
        16,
        { ...SAVING_THROWS_AGILE_TARGET_START },
      ),
      createMockCombatCharacter({
        id: 'saving-throws-bystander',
        name: 'Unrelated Bystander',
        team: 'neutral',
        position: { x: 2, y: 9 },
      }),
    ],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function runAction(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
) {
  return savingThrowsHalfDamageScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot,
  });
}

function findCharacter(
  characters: CombatCharacter[],
  characterId: string,
): CombatCharacter {
  const character = characters.find(candidate => candidate.id === characterId);
  if (!character) throw new Error(`Missing Saving Throws actor ${characterId}.`);
  return character;
}

// ============================================================================
// Canonical Outcomes
// ============================================================================
// HP and reasoned-log assertions prove that the rendered result and the shared
// engine arithmetic describe the same save and damage transition.
// ============================================================================

describe('savingThrowsHalfDamageScenarioControls', () => {
  it('registers six inert proof controls without claiming combat costs', () => {
    expect(savingThrowsHalfDamageScenarioControls.scenarioId)
      .toBe('saving_throws_half_damage');
    expect(savingThrowsHalfDamageScenarioControls.controls).toHaveLength(6);
    expect(savingThrowsHalfDamageScenarioControls.controls.every(control => (
      control.kind === 'action' && control.defaultValue === false
    ))).toBe(true);
  });

  it('applies the full 15 damage after a failed Dexterity save', () => {
    const snapshot = createSnapshot();
    const bystander = findCharacter(snapshot.characters, 'saving-throws-bystander');
    const result = runAction(snapshot, 'failed-save-full');
    const slowTarget = findCharacter(result.characters ?? [], SAVING_THROWS_SLOW_TARGET_ID);
    const agileTarget = findCharacter(result.characters ?? [], SAVING_THROWS_AGILE_TARGET_ID);

    expect(SAVING_THROWS_DAMAGE).toBe(15);
    expect(SAVING_THROWS_DC).toBe(15);
    expect(slowTarget.currentHP).toBe(15);
    expect(agileTarget.currentHP).toBe(SAVING_THROWS_TARGET_HP);
    expect(result.logMessage).toContain('d20 10 - 1 = 9 vs DC 15 fails');
    expect(result.logMessage).toContain('4d6 = 15 Fire stays full');
    expect(findCharacter(result.characters ?? [], bystander.id)).toBe(bystander);
  });

  it('rounds odd damage down after a successful save', () => {
    const result = runAction(createSnapshot(), 'successful-save-half');
    const agileTarget = findCharacter(result.characters ?? [], SAVING_THROWS_AGILE_TARGET_ID);

    expect(agileTarget.currentHP).toBe(23);
    expect(result.logMessage).toContain('d20 14 + 3 = 17 vs DC 15 succeeds');
    expect(result.logMessage).toContain('15 → 7 Fire after half damage, rounded down');
  });

  it('treats an exact-DC total as a successful save', () => {
    const result = runAction(createSnapshot(), 'exact-dc-success');
    const slowTarget = findCharacter(result.characters ?? [], SAVING_THROWS_SLOW_TARGET_ID);

    expect(slowTarget.currentHP).toBe(23);
    expect(result.logMessage).toContain('d20 16 - 1 = 15 vs DC 15 succeeds exactly');
  });

  it('applies resistance after save damage using both canonical rounding steps', () => {
    const result = runAction(createSnapshot(), 'save-then-resistance');
    const agileTarget = findCharacter(result.characters ?? [], SAVING_THROWS_AGILE_TARGET_ID);

    expect(agileTarget.currentHP).toBe(27);
    expect(agileTarget.resistances).toContain('Fire');
    expect(result.logMessage).toContain('d20 12 + 3 = 15 vs DC 15 succeeds exactly');
    expect(result.logMessage).toContain('15 → 7 after save (rounded down) → 3 after Fire resistance');
  });

  it('applies Fire immunity after the successful-save reduction', () => {
    const result = runAction(createSnapshot(), 'save-then-immunity');
    const agileTarget = findCharacter(result.characters ?? [], SAVING_THROWS_AGILE_TARGET_ID);

    expect(agileTarget.currentHP).toBe(SAVING_THROWS_TARGET_HP);
    expect(agileTarget.immunities).toContain('Fire');
    expect(result.logMessage).toContain('d20 12 + 3 = 15 vs DC 15 succeeds exactly');
    expect(result.logMessage).toContain('15 → 7 after save (rounded down) → 0 from Fire immunity');
  });

  it('routes a failed save at 15 HP through canonical player downing', () => {
    const result = runAction(createSnapshot(), 'failed-save-downing');
    const slowTarget = findCharacter(result.characters ?? [], SAVING_THROWS_SLOW_TARGET_ID);

    expect(slowTarget.currentHP).toBe(0);
    expect(slowTarget.team).toBe('player');
    expect(slowTarget.deathSaves).toEqual({
      successes: 0,
      failures: 0,
      isStable: false,
    });
    expect(slowTarget.statusEffects.map(effect => effect.name)).toContain('Unconscious');
    expect(slowTarget.conditions?.map(condition => condition.name)).toContain('Unconscious');
    expect(result.logMessage).toContain('15 → 0/30 HP');
    expect(result.logMessage).toContain('death saves 0S/0F and Unconscious applies');
  });

  it('repeats the downing proof from its authored baseline instead of adding a death failure', () => {
    const first = runAction(createSnapshot(), 'failed-save-downing');
    const second = runAction({
      ...createSnapshot(),
      characters: first.characters ?? [],
    }, 'failed-save-downing');
    const repeatedTarget = findCharacter(second.characters ?? [], SAVING_THROWS_SLOW_TARGET_ID);

    expect(repeatedTarget.currentHP).toBe(0);
    expect(repeatedTarget.deathSaves).toEqual({
      successes: 0,
      failures: 0,
      isStable: false,
    });
    expect(repeatedTarget.statusEffects.filter(effect => effect.name === 'Unconscious'))
      .toHaveLength(1);
  });

  it('keeps defaults and malformed controls state-preserving', () => {
    const snapshot = createSnapshot();
    const inert = savingThrowsHalfDamageScenarioControls.applyControl({
      controlId: 'failed-save-full',
      value: false,
      snapshot,
    });
    const malformed = savingThrowsHalfDamageScenarioControls.applyControl({
      controlId: 'failed-save-full',
      value: '10',
      snapshot,
    });

    expect(inert).toEqual({ logMessage: '' });
    expect(malformed.characters).toBeUndefined();
    expect(malformed.logMessage).toContain('requires an action trigger');
  });
});
