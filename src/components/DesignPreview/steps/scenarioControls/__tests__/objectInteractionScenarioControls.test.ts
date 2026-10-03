/**
 * This file proves CS15 through the registered adapter and production resolver.
 *
 * Expected cases cover free interaction, Action fallback, object state changes,
 * range, LoS, ownership, invalid targets, stable replay, atomic rejection, and
 * exact reset. Fixtures use real combat types and shared action-economy state.
 *
 * Covers: objectInteractionScenarioControls and objectInteractionResolution.
 */

import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter } from '../../../../../utils/core/factories';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import {
  OBJECT_INTERACTION_CRATE_ID,
  createObjectInteractionCrate,
} from '../../PreviewCombatScenarioObjects';
import {
  OBJECT_INTERACTION_TESTER_ID,
  objectInteractionScenarioControls,
} from '../objectInteractionScenarioControls';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValues,
} from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Deterministic Mounted-State Fixtures
// ============================================================================

function tile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createSnapshot(
  controlValues: PreviewCombatScenarioControlValues = {
    operation: 'open',
    interaction_case: 'legal',
    resolve_interaction: false,
  },
): PreviewCombatScenarioControlSnapshot {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 2; x <= 7; x += 1) tiles.set(`${x}-5`, tile(x, 5));
  const tester = createMockCombatCharacter({
    id: OBJECT_INTERACTION_TESTER_ID,
    name: 'Object Interaction Tester',
    position: { x: 5, y: 5 },
    team: 'player',
  });
  const other = createMockCombatCharacter({
    id: 'object_interaction-target',
    name: 'Other Owner',
    position: { x: 10, y: 5 },
    team: 'enemy',
  });
  const mapData: BattleMapData = {
    dimensions: { width: 16, height: 12 },
    tiles,
    targetableObjects: [createObjectInteractionCrate()],
    theme: 'dungeon',
    seed: 15,
  };
  return {
    mapData,
    characters: [tester, other],
    activeLightSources: [],
    reactiveTriggers: [],
    turnState: {
      currentTurn: 1,
      turnOrder: [tester.id, other.id],
      currentCharacterId: tester.id,
      phase: 'action',
      actionsThisTurn: [],
    },
    controlValues,
  };
}

function apply(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: string | boolean,
): PreviewCombatScenarioControlPatch {
  return objectInteractionScenarioControls.applyControl({ controlId, value, snapshot });
}

function merge(
  snapshot: PreviewCombatScenarioControlSnapshot,
  patch: PreviewCombatScenarioControlPatch,
  controlValues = snapshot.controlValues,
): PreviewCombatScenarioControlSnapshot {
  return {
    ...snapshot,
    mapData: patch.mapData ?? snapshot.mapData,
    characters: patch.characters ?? snapshot.characters,
    controlValues,
  };
}

function crate(snapshot: PreviewCombatScenarioControlSnapshot) {
  return snapshot.mapData?.targetableObjects?.find(object => object.id === OBJECT_INTERACTION_CRATE_ID);
}

function tester(snapshot: PreviewCombatScenarioControlSnapshot): CombatCharacter {
  return snapshot.characters.find(character => character.id === OBJECT_INTERACTION_TESTER_ID)!;
}

// ============================================================================
// Expected-First CS15 Contract
// ============================================================================

describe('objectInteractionScenarioControls', () => {
  it('publishes operation, validation/economy, and production action controls', () => {
    expect(objectInteractionScenarioControls.scenarioId).toBe('object_interaction');
    expect(objectInteractionScenarioControls.controls.map(control => control.id)).toEqual([
      'operation',
      'interaction_case',
      'resolve_interaction',
    ]);
  });

  it('opens and uses the container with one free interaction, then falls back to Action', () => {
    let state = createSnapshot();
    state = merge(state, apply(state, 'resolve_interaction', true));
    expect(crate(state)?.interactionState).toMatchObject({ isOpen: true, useCount: 0 });
    expect(tester(state).actionEconomy.freeActions).toBe(0);
    expect(tester(state).actionEconomy.action.used).toBe(false);

    const useValues = { ...state.controlValues, operation: 'use', interaction_case: 'free_used' };
    state = merge(state, apply({ ...state, controlValues: useValues }, 'operation', 'use'), useValues);
    state = merge(state, apply(state, 'interaction_case', 'free_used'));
    const result = apply(state, 'resolve_interaction', true);
    state = merge(state, result);

    expect(result.logMessage).toContain('ACCEPTED');
    expect(result.logMessage).toContain('action spent');
    expect(crate(state)?.interactionState).toMatchObject({ isOpen: true, useCount: 1 });
    expect(tester(state).actionEconomy.action).toMatchObject({ used: true, remaining: 0 });
  });

  it('damages finite object state while always spending Action', () => {
    const values = { operation: 'damage', interaction_case: 'legal', resolve_interaction: false };
    let state = createSnapshot(values);
    state = merge(state, apply(state, 'operation', 'damage'));
    state = merge(state, apply(state, 'resolve_interaction', true));

    expect(crate(state)?.interactionState).toMatchObject({ hitPoints: 6, maxHitPoints: 10, destroyed: false });
    expect(tester(state).actionEconomy.action.used).toBe(true);
    expect(tester(state).actionEconomy.freeActions).toBe(1);

  });

  it('destroys the object through the same damage transaction', () => {
    const values = { operation: 'destroy', interaction_case: 'legal', resolve_interaction: false };
    let state = createSnapshot(values);
    state = merge(state, apply(state, 'operation', 'destroy'));
    state = merge(state, apply(state, 'resolve_interaction', true));

    expect(crate(state)?.interactionState).toMatchObject({ hitPoints: 0, maxHitPoints: 10, destroyed: true });
    expect(tester(state).actionEconomy.action.used).toBe(true);
    expect(tester(state).actionEconomy.freeActions).toBe(1);
  });

  it.each([
    ['all_spent', 'No free interaction or Action remains.'],
    ['out_of_range', 'interaction range is 5 feet'],
    ['total_cover', 'Line of sight'],
    ['wrong_owner', 'does not own'],
    ['missing_target', 'unavailable'],
  ])('rejects %s atomically before object or resource mutation', (interactionCase, reason) => {
    const values = { operation: 'open', interaction_case: interactionCase, resolve_interaction: false };
    let state = createSnapshot(values);
    state = merge(state, apply(state, 'interaction_case', interactionCase));
    const beforeMap = state.mapData;
    const beforeCharacters = state.characters;
    const result = apply(state, 'resolve_interaction', true);

    expect(result.logMessage).toContain('REJECTED');
    expect(result.logMessage).toContain(reason);
    expect(result.mapData).toBe(beforeMap);
    expect(result.characters).toBe(beforeCharacters);
  });

  it('prepares and rejects a stable replay without a second state or economy change', () => {
    const values = { operation: 'open', interaction_case: 'replay', resolve_interaction: false };
    let state = createSnapshot(values);
    state = merge(state, apply(state, 'interaction_case', 'replay'));
    const beforeMap = state.mapData;
    const beforeCharacters = state.characters;
    const replay = apply(state, 'resolve_interaction', true);

    expect(crate(state)?.interactionState).toMatchObject({
      isOpen: true,
      resolvedEventIds: ['cs15-object-event-001'],
    });
    expect(replay.logMessage).toContain('Duplicate interaction event ignored');
    expect(replay.mapData).toBe(beforeMap);
    expect(replay.characters).toBe(beforeCharacters);
  });

  it('restores the exact crate and ready economy through declared defaults', () => {
    let state = createSnapshot({ operation: 'damage', interaction_case: 'all_spent', resolve_interaction: false });
    state = merge(state, apply(state, 'operation', 'damage'));
    state = merge(state, apply(state, 'interaction_case', 'all_spent'));

    const defaults = { operation: 'open', interaction_case: 'legal', resolve_interaction: false };
    state = merge({ ...state, controlValues: defaults }, apply({ ...state, controlValues: defaults }, 'operation', 'open'), defaults);
    state = merge(state, apply(state, 'interaction_case', 'legal'));

    expect(crate(state)).toEqual(createObjectInteractionCrate());
    expect(tester(state).position).toEqual({ x: 5, y: 5 });
    expect(tester(state).actionEconomy.freeActions).toBe(1);
    expect(tester(state).actionEconomy.action).toMatchObject({ used: false, remaining: 1 });
  });
});
