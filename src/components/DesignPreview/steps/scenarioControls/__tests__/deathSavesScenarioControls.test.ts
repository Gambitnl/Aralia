/**
 * This file proves the complete Death Saves & Downed State control sequence.
 *
 * Each test calls the scenario module with production-shaped combatants, just
 * as the shared Tactical Sandbox host does. The expectations cover turn-start
 * roll faces, damage failures, healing recovery, Stable/dead replay safety, and
 * the exact authored state restored by Reset Board.
 *
 * Called by: focused Vitest acceptance for CS17.
 * Depends on: the death-save scenario adapter and shared combat-state types.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../../types/combat';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValues,
} from '../PreviewCombatScenarioControlTypes';
import deathSavesScenarioControlModule from '../deathSavesScenarioControls';

// ============================================================================
// Authored Reset Fixture
// ============================================================================
// The live scenario opens at 0 HP with Unconscious and one pip in each column.
// Every helper returns fresh objects so a prior action cannot leak into Reset.
// ============================================================================

const TESTER_ID = 'death_saves-tester';

function makeCharacter(
  id: string,
  overrides: Partial<CombatCharacter> = {},
): CombatCharacter {
  return {
    id,
    name: id === TESTER_ID ? 'Death Saves & Downed State Tester' : 'Training Target',
    level: 5,
    class: {
      id: 'fighter', name: 'Fighter', description: 'A martial combatant.', hitDie: 10,
      primaryAbility: ['Strength'], savingThrowProficiencies: ['Strength', 'Constitution'],
      skillProficienciesAvailable: [], numberOfSkillProficiencies: 2,
      armorProficiencies: [], weaponProficiencies: [], features: [],
    },
    position: { x: id === TESTER_ID ? 3 : 10, y: 5 },
    stats: {
      strength: 16, dexterity: 12, constitution: 14, intelligence: 10,
      wisdom: 10, charisma: 8, baseInitiative: 1, speed: 30, cr: '0',
    },
    abilities: [],
    team: id === TESTER_ID ? 'player' : 'enemy',
    currentHP: 0,
    maxHP: 20,
    initiative: 10,
    statusEffects: [{
      id: 'opening-unconscious', name: 'Unconscious', type: 'debuff',
      description: 'The tester is downed at 0 HP.', duration: 999,
      source: 'death-saves-scenario',
    }],
    conditions: [{
      name: 'Unconscious', duration: { type: 'permanent' }, appliedTurn: 0,
      source: 'death-saves-scenario',
    }],
    deathSaves: { successes: 1, failures: 1, isStable: false },
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: { used: 0, total: 0 },
      movement: { used: 0, total: 30 },
      freeActions: 1,
    },
    ...overrides,
  };
}

function makeSnapshot(
  characters = [makeCharacter(TESTER_ID), makeCharacter('training-target')],
  controlValues: PreviewCombatScenarioControlValues = {},
): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: null,
    characters,
    activeLightSources: [],
    reactiveTriggers: [],
    controlValues,
  };
}

// ============================================================================
// Host-Like Action Helpers
// ============================================================================
// A selector value travels in snapshot.controlValues. The action itself is the
// only true trigger, matching the mounted control panel and its reset defaults.
// ============================================================================

function applyAction(
  controlId: string,
  controlValues: PreviewCombatScenarioControlValues = {},
  characters?: CombatCharacter[],
): PreviewCombatScenarioControlPatch {
  return deathSavesScenarioControlModule.applyControl({
    controlId,
    value: true,
    snapshot: makeSnapshot(characters, controlValues),
  });
}

function tester(patch: PreviewCombatScenarioControlPatch): CombatCharacter {
  const found = patch.characters?.find(character => character.id === TESTER_ID);
  if (!found) throw new Error('Expected the CS17 tester in the returned character patch.');
  return found;
}

// ============================================================================
// Control Contract and Exact Reset
// ============================================================================
// Reset Board rebuilds the fixture, then applies every default. Selectors and
// false action defaults must therefore be inert and preserve 0 HP, 1S/1F.
// ============================================================================

describe('deathSavesScenarioControlModule contract', () => {
  it('exports deterministic roll, damage, and healing controls', () => {
    expect(deathSavesScenarioControlModule.scenarioId).toBe('death_saves');
    expect(deathSavesScenarioControlModule.controls.map(control => [
      control.id, control.kind, control.defaultValue,
    ])).toEqual([
      ['death-save-roll', 'select', '10'],
      ['resolve-death-save', 'action', false],
      ['downed-damage', 'select', 'normal'],
      ['apply-downed-damage', 'action', false],
      ['apply-healing', 'action', false],
    ]);
  });

  it('keeps every default inert so Reset Board restores the exact authored state', () => {
    const resetCharacters = makeSnapshot().characters;
    const defaults = Object.fromEntries(
      deathSavesScenarioControlModule.controls.map(control => [control.id, control.defaultValue]),
    );

    for (const control of deathSavesScenarioControlModule.controls) {
      const patch = deathSavesScenarioControlModule.applyControl({
        controlId: control.id,
        value: control.defaultValue,
        snapshot: makeSnapshot(resetCharacters, defaults),
      });
      expect(patch.characters).toBeUndefined();
    }

    expect(resetCharacters[0]).toMatchObject({
      currentHP: 0,
      deathSaves: { successes: 1, failures: 1, isStable: false },
    });
    expect(resetCharacters[0].conditions?.map(condition => condition.name)).toContain('Unconscious');
  });
});

// ============================================================================
// Turn-Start Roll Outcomes
// ============================================================================
// These sequences prove ordinary pips, natural 1, natural 20, stabilization,
// death, and replay without replacing the shared production transaction.
// ============================================================================

describe('turn-start death-save resolution', () => {
  it('tracks one success on 10 and one failure on 9', () => {
    const success = applyAction('resolve-death-save', { 'death-save-roll': '10' });
    expect(tester(success).deathSaves).toEqual({ successes: 2, failures: 1, isStable: false });

    const failure = applyAction(
      'resolve-death-save',
      { 'death-save-roll': '9' },
      success.characters,
    );
    expect(tester(failure).deathSaves).toEqual({ successes: 2, failures: 2, isStable: false });
  });

  it('counts a natural 1 as two failures, reaches death, and replays exactly', () => {
    const result = applyAction('resolve-death-save', { 'death-save-roll': '1' });
    expect(tester(result).deathSaves).toEqual({ successes: 1, failures: 3, isStable: false });
    expect(result.logMessage).toContain('Dead after three failures');

    const replay = applyAction('resolve-death-save', { 'death-save-roll': '10' }, result.characters);
    expect(tester(replay)).toBe(result.characters?.[0]);
    expect(replay.logMessage).toContain('exact no-op');
  });

  it('uses a natural 20 to regain exactly 1 HP and clear downed state', () => {
    const result = applyAction('resolve-death-save', { 'death-save-roll': '20' });
    const recovered = tester(result);

    expect(recovered.currentHP).toBe(1);
    expect(recovered.deathSaves).toBeUndefined();
    expect(recovered.statusEffects.map(effect => effect.name)).not.toContain('Unconscious');
    expect(recovered.conditions?.map(condition => condition.name)).not.toContain('Unconscious');
  });

  it('stabilizes on a third success and makes Stable replay an exact no-op', () => {
    const almostStable = makeCharacter(TESTER_ID, {
      deathSaves: { successes: 2, failures: 0, isStable: false },
    });
    const result = applyAction(
      'resolve-death-save',
      { 'death-save-roll': '10' },
      [almostStable, makeCharacter('training-target')],
    );
    expect(tester(result).deathSaves).toEqual({ successes: 3, failures: 0, isStable: true });

    const replay = applyAction('resolve-death-save', { 'death-save-roll': '1' }, result.characters);
    expect(tester(replay)).toBe(result.characters?.[0]);
    expect(replay.logMessage).toContain('Stable; replay makes no death save');
  });
});

// ============================================================================
// Downed Damage and Healing
// ============================================================================
// Damage proves one versus two failures and stability loss. Healing proves the
// canonical recovery cleanup and a repeat-safe teaching action.
// ============================================================================

describe('downed damage and healing', () => {
  it('adds one normal failure, two critical failures, and breaks stabilization', () => {
    const normal = applyAction('apply-downed-damage', { 'downed-damage': 'normal' });
    expect(tester(normal).deathSaves).toEqual({ successes: 1, failures: 2, isStable: false });

    const critical = applyAction('apply-downed-damage', { 'downed-damage': 'critical' });
    expect(tester(critical).deathSaves).toEqual({ successes: 1, failures: 3, isStable: false });

    const stable = makeCharacter(TESTER_ID, {
      deathSaves: { successes: 3, failures: 0, isStable: true },
    });
    const broken = applyAction(
      'apply-downed-damage',
      { 'downed-damage': 'normal' },
      [stable, makeCharacter('training-target')],
    );
    expect(tester(broken).deathSaves).toEqual({ successes: 3, failures: 1, isStable: false });
  });

  it('heals 5 HP, clears death saves and Unconscious, then replays safely', () => {
    const result = applyAction('apply-healing');
    const recovered = tester(result);
    expect(recovered.currentHP).toBe(5);
    expect(recovered.deathSaves).toBeUndefined();
    expect(recovered.statusEffects.map(effect => effect.name)).not.toContain('Unconscious');
    expect(recovered.conditions?.map(condition => condition.name)).not.toContain('Unconscious');

    const replay = applyAction('apply-healing', {}, result.characters);
    expect(tester(replay)).toBe(result.characters?.[0]);
    expect(replay.logMessage).toContain('exact no-op');
  });
});

// ============================================================================
// Safe Rejection
// ============================================================================
// Registry drift and a missing fixture must remain visible without mutating a
// substitute actor or throwing inside the mounted preview.
// ============================================================================

describe('safe control rejection', () => {
  it('rejects unknown controls and missing testers without a character patch', () => {
    const unknown = applyAction('not-a-death-save-control');
    expect(unknown).toEqual({
      logMessage: 'Unknown death-save scenario control: not-a-death-save-control.',
    });

    const missing = applyAction(
      'apply-healing',
      {},
      [makeCharacter('training-target')],
    );
    expect(missing.characters).toBeUndefined();
    expect(missing.logMessage).toContain('scenario tester is unavailable');
  });
});
