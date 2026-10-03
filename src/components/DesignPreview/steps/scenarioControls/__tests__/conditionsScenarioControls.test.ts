/**
 * This file proves the Conditions adapter delegates to canonical runtime mechanics.
 *
 * The checks run selector and action sequences in mounted-control order. They
 * cover exact Reset, apply/remove, same-source replacement, independent stacking,
 * target turn-end expiry, source loss, mechanical consequences, and stable replay.
 *
 * Exercises: conditionsScenarioControls.
 * Depends on: paired condition helpers and the production grid/action/reaction rules.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGridMovement } from '../../../../../hooks/combat/useGridMovement';
import type {
  BattleMapData,
  BattleMapTile,
  CharacterPosition,
  CombatCharacter,
} from '../../../../../types/combat';
import { canAffordActionCost } from '../../../../../utils/combat/actionEconomyUtils';
import { canTakeReaction } from '../../../../../utils/combat/combatUtils';
import { createMockCombatCharacter } from '../../../../../utils/core';
import conditionsScenarioControlModule, {
  CONDITIONS_TARGET_ID,
  CONDITIONS_TESTER_ID,
  prepareConditionsCharacters,
} from '../conditionsScenarioControls';
import type {
  PreviewCombatScenarioControlValues,
  PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Mounted-Control Style Fixture
// ============================================================================
// The state carries selector values into later action buttons exactly as the
// shared preview host does. A third actor proves Reset and events stay scoped.
// ============================================================================

interface ScenarioState {
  characters: CombatCharacter[];
  controlValues: PreviewCombatScenarioControlValues;
  logMessage: string;
}

function createCharacters(): CombatCharacter[] {
  return [
    createMockCombatCharacter({
      id: CONDITIONS_TESTER_ID,
      name: 'Conditions Tester',
      team: 'player',
      position: { x: 3, y: 5 },
      stats: { speed: 30 },
    }),
    createMockCombatCharacter({
      id: CONDITIONS_TARGET_ID,
      name: 'Conditions Target',
      team: 'enemy',
      position: { x: 10, y: 5 },
      stats: { speed: 30 },
      conditions: [{
        name: 'Restrained',
        duration: { type: 'rounds', value: 10 },
        appliedTurn: 0,
        source: 'legacy-conditions-scenario',
      }],
    }),
    createMockCombatCharacter({
      id: 'conditions-bystander',
      name: 'Conditions Bystander',
      team: 'neutral',
      position: { x: 14, y: 5 },
      conditions: [{
        name: 'Charmed',
        duration: { type: 'rounds', value: 3 },
        appliedTurn: 0,
        source: 'unrelated-bystander-effect',
      }],
    }),
  ];
}

function initialState(): ScenarioState {
  return {
    characters: prepareConditionsCharacters(createCharacters()),
    controlValues: {
      condition_case: 'restrained',
      lifecycle_case: 'apply_owned',
      resolve_condition: false,
      replay_condition: false,
    },
    logMessage: '',
  };
}

function apply(
  state: ScenarioState,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): ScenarioState {
  const controlValues = { ...state.controlValues, [controlId]: value };
  const patch = conditionsScenarioControlModule.applyControl({
    controlId,
    value,
    snapshot: {
      mapData: null,
      characters: state.characters,
      activeLightSources: [],
      reactiveTriggers: [],
      controlValues,
    },
  });

  return {
    characters: patch.characters ?? state.characters,
    controlValues: {
      ...controlValues,
      [controlId]: conditionsScenarioControlModule.controls.find(control => control.id === controlId)?.kind === 'action'
        ? false
        : value,
    },
    logMessage: patch.logMessage,
  };
}

function actor(state: ScenarioState, id: string): CombatCharacter {
  const character = state.characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Conditions actor ${id}.`);
  return character;
}

function ids(character: CombatCharacter): string[] {
  return character.statusEffects.map(status => status.id);
}

function createOpenCorridor(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 8; x += 1) {
    tiles.set(`${x}-0`, {
      id: `${x}-0`,
      coordinates: { x, y: 0 },
      terrain: 'floor',
      elevation: 0,
      movementCost: 5,
      blocksLoS: false,
      blocksMovement: false,
      decoration: null,
      effects: [],
    });
  }
  return { dimensions: { width: 8, height: 1 }, tiles, theme: 'dungeon', seed: 10 };
}

// ============================================================================
// Registration And Exact Reset
// ============================================================================
// The visible contract exposes condition, ownership/lifecycle, resolution, and
// replay. Reset removes legacy state and restores only the authored baseline.
// ============================================================================

describe('Conditions scenario registration and Reset', () => {
  it('registers the four deterministic controls and their exact defaults', () => {
    expect(conditionsScenarioControlModule.scenarioId).toBe('conditions');
    expect(conditionsScenarioControlModule.controls.map(control => ({
      id: control.id,
      kind: control.kind,
      defaultValue: control.defaultValue,
    }))).toEqual([
      { id: 'condition_case', kind: 'select', defaultValue: 'restrained' },
      { id: 'lifecycle_case', kind: 'select', defaultValue: 'apply_owned' },
      { id: 'resolve_condition', kind: 'action', defaultValue: false },
      { id: 'replay_condition', kind: 'action', defaultValue: false },
    ]);
  });

  it('restores exact actors, economy, unrelated Poisoned, and bystander state', () => {
    const baseline = initialState();
    const changed = apply(baseline, 'resolve_condition', true);
    const resetCharacters = prepareConditionsCharacters(changed.characters);
    const target = resetCharacters.find(character => character.id === CONDITIONS_TARGET_ID)!;
    const tester = resetCharacters.find(character => character.id === CONDITIONS_TESTER_ID)!;
    const bystander = resetCharacters.find(character => character.id === 'conditions-bystander')!;

    expect(ids(target)).toEqual(['conditions-baseline-poisoned']);
    expect(target.conditions?.map(condition => condition.name)).toEqual(['Poisoned']);
    expect(target.actionEconomy).toMatchObject({
      action: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: 30 },
    });
    expect(tester.statusEffects).toEqual([]);
    expect(tester.conditions).toEqual([]);
    expect(bystander.conditions?.map(condition => condition.name)).toEqual(['Charmed']);
  });
});

// ============================================================================
// Exact Apply, Remove, Replacement, And Ownership
// ============================================================================
// These sequences protect the source-aware behavior that the earlier toggle
// implementation could not prove without deleting all same-named conditions.
// ============================================================================

describe('Conditions scenario owned lifecycle', () => {
  it('applies and removes only the exact owned Restrained pair', () => {
    const applied = apply(initialState(), 'resolve_condition', true);
    const restrained = actor(applied, CONDITIONS_TARGET_ID);

    expect(ids(restrained)).toEqual([
      'conditions-baseline-poisoned',
      'conditions-control-restrained-status',
    ]);
    expect(restrained.actionEconomy.movement.total).toBe(0);
    expect(applied.logMessage).toContain('APPLY applied');
    expect(applied.logMessage).toContain('unrelated Poisoned=preserved');

    const removeCase = apply(applied, 'lifecycle_case', 'remove_owned');
    const reapplied = apply(
      { ...removeCase, characters: restrained ? applied.characters : removeCase.characters },
      'resolve_condition',
      true,
    );
    const removed = actor(reapplied, CONDITIONS_TARGET_ID);

    expect(ids(removed)).toEqual(['conditions-baseline-poisoned']);
    expect(removed.conditions?.map(condition => condition.name)).toEqual(['Poisoned']);
    expect(removed.actionEconomy.movement.total).toBe(30);
    expect(reapplied.logMessage).toContain('REMOVE status=1; condition=1');
  });

  it('replaces the same source once and replays without duplicates', () => {
    const selected = apply(initialState(), 'lifecycle_case', 'replace_owned');
    const replaced = apply(selected, 'resolve_condition', true);
    const target = actor(replaced, CONDITIONS_TARGET_ID);

    expect(target.statusEffects.filter(status => status.name === 'Restrained')).toHaveLength(1);
    expect(target.statusEffects.find(status => status.id === 'conditions-control-restrained-status')?.duration).toBe(5);
    expect(target.conditions?.find(condition => condition.source === 'conditions-control-restrained')?.duration)
      .toEqual({ type: 'rounds', value: 5 });

    const replayed = apply(replaced, 'replay_condition', true);
    expect(replayed.characters).toBe(replaced.characters);
    expect(replayed.logMessage).toContain('REPLAY STABLE');
    expect(actor(replayed, CONDITIONS_TARGET_ID).statusEffects.filter(status => status.name === 'Restrained'))
      .toHaveLength(1);
  });

  it('stacks another owner and removes only the tester-owned same-name pair', () => {
    const selected = apply(initialState(), 'lifecycle_case', 'stack_then_remove_owned');
    const resolved = apply(selected, 'resolve_condition', true);
    const target = actor(resolved, CONDITIONS_TARGET_ID);

    expect(ids(target)).toEqual([
      'conditions-baseline-poisoned',
      'conditions-unrelated-restrained-status',
    ]);
    expect(target.conditions?.filter(condition => condition.name === 'Restrained')).toHaveLength(1);
    expect(target.conditions?.find(condition => condition.name === 'Restrained')?.sourceCasterId)
      .toBe(CONDITIONS_TARGET_ID);
    expect(target.actionEconomy.movement.total).toBe(0);
    expect(resolved.logMessage).toContain('unrelated same-name owner remains=1');
  });
});

// ============================================================================
// Expiry, Source Loss, And Mechanical Consequences
// ============================================================================
// Turn-end processing happens once, source cleanup removes its exact owner, and
// the resulting records are consumed by production movement/action helpers.
// ============================================================================

describe('Conditions scenario expiry, source loss, and mechanics', () => {
  it('expires the owned Blinded pair at one target turn end and preserves Poisoned', () => {
    const blinded = apply(initialState(), 'condition_case', 'blinded');
    const selected = apply(blinded, 'lifecycle_case', 'expire_at_turn_end');
    const expired = apply(selected, 'resolve_condition', true);
    const target = actor(expired, CONDITIONS_TARGET_ID);

    expect(ids(target)).toEqual(['conditions-baseline-poisoned']);
    expect(target.conditions?.map(condition => condition.name)).toEqual(['Poisoned']);
    expect(expired.logMessage).toContain('TURN END once; expired=Blinded');
    expect(expired.logMessage).toContain('Blinded=false');

    const replayed = apply(expired, 'replay_condition', true);
    expect(replayed.characters).toBe(expired.characters);
    expect(replayed.logMessage).toContain('REPLAY STABLE');
  });

  it('removes the source and only its owned condition while preserving target-owned state', () => {
    const selected = apply(initialState(), 'lifecycle_case', 'source_loss_cleanup');
    const cleaned = apply(selected, 'resolve_condition', true);
    const target = actor(cleaned, CONDITIONS_TARGET_ID);

    expect(cleaned.characters.some(character => character.id === CONDITIONS_TESTER_ID)).toBe(false);
    expect(ids(target)).toEqual(['conditions-baseline-poisoned']);
    expect(target.conditions?.map(condition => condition.name)).toEqual(['Poisoned']);
    expect(cleaned.logMessage).toContain('SOURCE LOSS cleanup status=1; condition=1');
  });

  it('feeds Prone, Incapacitated, and Restrained into their real rule consumers', () => {
    const proneSelected = apply(initialState(), 'condition_case', 'prone');
    const proneState = apply(proneSelected, 'resolve_condition', true);
    const proneTarget = actor(proneState, CONDITIONS_TARGET_ID);
    const positions = new Map<string, CharacterPosition>([[proneTarget.id, {
      characterId: proneTarget.id,
      coordinates: { x: 0, y: 0 },
    }]]);
    const { result } = renderHook(() => useGridMovement({
      mapData: createOpenCorridor(),
      characterPositions: positions,
      selectedCharacter: { ...proneTarget, position: { x: 0, y: 0 } },
    }));

    expect(result.current.validMoves.has('3-0')).toBe(true);
    expect(result.current.validMoves.has('4-0')).toBe(false);

    const incapacitatedSelected = apply(initialState(), 'condition_case', 'incapacitated');
    const incapacitatedState = apply(incapacitatedSelected, 'resolve_condition', true);
    const incapacitatedTarget = actor(incapacitatedState, CONDITIONS_TARGET_ID);
    expect(canAffordActionCost(incapacitatedTarget, { type: 'action' })).toBe(false);
    expect(canTakeReaction(incapacitatedTarget)).toBe(false);

    const restrainedState = apply(initialState(), 'resolve_condition', true);
    expect(actor(restrainedState, CONDITIONS_TARGET_ID).actionEconomy.movement.total).toBe(0);
  });
});
