/**
 * This file proves CS07 prepares canonical target, geometry, cover, and visibility facts.
 *
 * Every selector changes a complete production map/actor snapshot and then asks
 * the real target, range, sight, cover, and visibility helpers for the result.
 * Action controls are verified as result-free requests for the mounted combat
 * transaction, including their shared replay identity.
 *
 * Exercises: lineOfSightScenarioControls.
 * Depends on: useTargetValidator, VisibilitySystem, cover, and sight helpers.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTargetValidator } from '../../../../../hooks/combat/useTargetValidator';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import { calculateCover } from '../../../../../utils/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import {
  createPreviewCombatScenarioControlDefaults,
  type PreviewCombatScenarioControlPatch,
  type PreviewCombatScenarioControlSnapshot,
  type PreviewCombatScenarioControlValue,
  type PreviewCombatScenarioControlValues,
} from '../PreviewCombatScenarioControlTypes';
import lineOfSightScenarioControls, {
  getLineOfSightScenarioReadout,
  LINE_OF_SIGHT_PROBE_EVENT_ID,
  LINE_OF_SIGHT_TARGET_AC,
  LINE_OF_SIGHT_TARGET_HP,
  LINE_OF_SIGHT_TARGET_ID,
  LINE_OF_SIGHT_TESTER_ID,
  LINE_OF_SIGHT_TESTER_START,
  SIGHTLINE_PROBE,
} from '../lineOfSightScenarioControls';

// ============================================================================
// Complete Mounted-Shape Fixture
// ============================================================================
// The raw board includes the original wall column. Applying CS07 defaults must
// normalize it before placing one exact controlled blocker.
// ============================================================================

interface ScenarioState extends PreviewCombatScenarioControlSnapshot {
  mapData: BattleMapData;
  controlValues: PreviewCombatScenarioControlValues;
  logMessage: string;
}

function createTile(x: number, y: number): BattleMapTile {
  const isLegacyWall = x === 7 && y >= 2 && y <= 9;
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: isLegacyWall ? 'wall' : 'floor',
    elevation: 0,
    movementCost: isLegacyWall ? 0 : 5,
    blocksLoS: isLegacyWall,
    blocksMovement: isLegacyWall,
    decoration: null,
    effects: [],
    environmentalEffects: [],
  };
}

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const tile = createTile(x, y);
      tiles.set(tile.id, tile);
    }
  }
  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 7,
  };
}

function createCharacters(): CombatCharacter[] {
  const tester = createMockCombatCharacter({
    id: LINE_OF_SIGHT_TESTER_ID,
    name: 'Raw Tester',
    team: 'player',
    position: { x: 3, y: 5 },
  });
  const target = createMockCombatCharacter({
    id: LINE_OF_SIGHT_TARGET_ID,
    name: 'Raw Target',
    team: 'enemy',
    position: { x: 11, y: 5 },
  });

  tester.abilities = [];
  return [tester, target];
}

function rawState(): ScenarioState {
  return {
    mapData: createMap(),
    characters: createCharacters(),
    activeLightSources: [],
    reactiveTriggers: [],
    controlValues: createPreviewCombatScenarioControlDefaults(lineOfSightScenarioControls),
    logMessage: '',
  };
}

function applyPatch(state: ScenarioState, patch: PreviewCombatScenarioControlPatch): ScenarioState {
  return {
    ...state,
    mapData: patch.mapData ?? state.mapData,
    characters: patch.characters ?? state.characters,
    activeLightSources: patch.activeLightSources ?? state.activeLightSources,
    reactiveTriggers: patch.reactiveTriggers ?? state.reactiveTriggers,
    logMessage: patch.logMessage,
  };
}

function apply(
  state: ScenarioState,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): ScenarioState {
  const controlValues = { ...state.controlValues, [controlId]: value };
  const patch = lineOfSightScenarioControls.applyControl({
    controlId,
    value,
    snapshot: { ...state, controlValues },
  });
  return {
    ...applyPatch(state, patch),
    controlValues,
  };
}

function applyDefaults(state: ScenarioState = rawState()): ScenarioState {
  return lineOfSightScenarioControls.controls.reduce((current, control) => (
    apply(current, control.id, control.defaultValue)
  ), state);
}

function actor(state: ScenarioState, actorId: string): CombatCharacter {
  const found = state.characters.find(character => character.id === actorId);
  if (!found) throw new Error(`Missing CS07 actor ${actorId}.`);
  return found;
}

function validation(state: ScenarioState) {
  const tester = actor(state, LINE_OF_SIGHT_TESTER_ID);
  const target = actor(state, LINE_OF_SIGHT_TARGET_ID);
  const { result } = renderHook(() => useTargetValidator({
    characters: state.characters,
    mapData: state.mapData,
  }));
  return result.current.getTargetValidation(SIGHTLINE_PROBE, tester, target.position);
}

// ============================================================================
// Visible Control And Reset Contract
// ============================================================================
// These assertions protect registry labels, the fixed production request, and
// byte-for-byte repeatability of a fresh Reset Board fixture.
// ============================================================================

describe('lineOfSightScenarioControls contract and reset', () => {
  it('exposes geometry, cover, visibility, resolve, and replay controls', () => {
    expect(lineOfSightScenarioControls.scenarioId).toBe('line_of_sight');
    expect(lineOfSightScenarioControls.controls.map(control => [
      control.id,
      control.kind,
      control.defaultValue,
    ])).toEqual([
      ['sightline_case', 'select', 'blocked_center'],
      ['cover_case', 'select', 'none'],
      ['visibility_case', 'select', 'bright_normal'],
      ['resolve_probe', 'action', false],
      ['replay_probe', 'action', false],
    ]);
  });

  it('rebuilds the same blocked baseline and fixed probe on every fresh reset', () => {
    const first = applyDefaults();
    const second = applyDefaults();
    const tester = actor(first, LINE_OF_SIGHT_TESTER_ID);
    const target = actor(first, LINE_OF_SIGHT_TARGET_ID);

    expect(first.mapData).toEqual(second.mapData);
    expect(first.characters).toEqual(second.characters);
    expect(first.activeLightSources).toEqual(second.activeLightSources);
    expect(tester).toMatchObject({
      position: LINE_OF_SIGHT_TESTER_START,
      team: 'player',
      actionEconomy: { action: { used: false, remaining: 1 } },
    });
    expect(tester.abilities.find(ability => ability.id === SIGHTLINE_PROBE.id)).toMatchObject({
      range: 12,
      attackBonus: 5,
      cost: { type: 'action' },
    });
    expect(target).toMatchObject({
      position: { x: 10, y: 5 },
      currentHP: LINE_OF_SIGHT_TARGET_HP,
      maxHP: LINE_OF_SIGHT_TARGET_HP,
      armorClass: LINE_OF_SIGHT_TARGET_AC,
    });
    expect(validation(first).reason).toMatch(/line of sight/i);
  });
});

// ============================================================================
// Range, Corner, And Endpoint Legality
// ============================================================================
// Every case asks the ordinary target validator for its precise result. The
// module supplies positions and tiles only; it does not author these reasons.
// ============================================================================

describe('lineOfSightScenarioControls canonical geometry', () => {
  it.each([
    ['clear_in_range', true, undefined, { x: 10, y: 5 }],
    ['blocked_center', false, /line of sight/i, { x: 10, y: 5 }],
    ['corner_clear', true, undefined, { x: 5, y: 2 }],
    ['corner_blocked', false, /line of sight/i, { x: 5, y: 2 }],
    ['endpoint_clear', true, undefined, { x: 10, y: 5 }],
    ['endpoint_blocked', false, /line of sight/i, { x: 10, y: 5 }],
    ['range_edge', true, undefined, { x: 14, y: 5 }],
    ['out_of_range', false, /too far away.*60 ft.*65 ft/i, { x: 15, y: 11 }],
  ] as const)('%s produces its canonical target result', (
    pathCase,
    expectedValid,
    reason,
    position,
  ) => {
    const state = apply(applyDefaults(), 'sightline_case', pathCase);
    const result = validation(state);

    expect(actor(state, LINE_OF_SIGHT_TARGET_ID).position).toEqual(position);
    expect(result.isValid).toBe(expectedValid);
    if (reason) expect(result.reason).toMatch(reason);
  });
});

// ============================================================================
// Partial And Total Cover
// ============================================================================
// Partial cover stays targetable and changes AC. Total Cover changes legality,
// proving it never degrades into a large numeric attack modifier.
// ============================================================================

describe('lineOfSightScenarioControls cover ladder', () => {
  it.each([
    ['none', 0, true],
    ['half', 2, true],
    ['three_quarters', 5, true],
    ['total', 0, false],
  ] as const)('%s exposes the production cover and legality result', (
    coverCase,
    expectedBonus,
    expectedValid,
  ) => {
    const clear = apply(applyDefaults(), 'sightline_case', 'clear_in_range');
    const state = apply(clear, 'cover_case', coverCase);
    const tester = actor(state, LINE_OF_SIGHT_TESTER_ID);
    const target = actor(state, LINE_OF_SIGHT_TARGET_ID);

    expect(calculateCover(tester.position, target.position, state.mapData)).toBe(expectedBonus);
    expect(validation(state).isValid).toBe(expectedValid);
    if (coverCase === 'total') expect(validation(state).reason).toMatch(/line of sight/i);
  });
});

// ============================================================================
// Production Visibility Inputs
// ============================================================================
// Light, senses, and Invisible use VisibilitySystem and attack-condition facts;
// no selector writes a final normal/disadvantage label into game state.
// ============================================================================

describe('lineOfSightScenarioControls visibility', () => {
  it.each([
    ['bright_normal', 'visible', false, 'normal'],
    ['darkness_normal', 'hidden', false, 'disadvantage'],
    ['darkvision_60', 'dim', false, 'normal'],
    ['blindsight_60', 'visible', false, 'normal'],
    ['invisible_target', 'visible', true, 'disadvantage'],
  ] as const)('%s produces the production visibility receipt', (
    visibilityCase,
    tier,
    invisible,
    attackRollMode,
  ) => {
    const clear = apply(applyDefaults(), 'sightline_case', 'clear_in_range');
    const state = apply(clear, 'visibility_case', visibilityCase);
    const readout = getLineOfSightScenarioReadout(state);

    expect(readout).toMatchObject({
      distanceFeet: 40,
      rangeFeet: 60,
      lineOfSight: true,
      visibilityTier: tier,
      invisibleTarget: invisible,
      targetEligible: true,
      attackRollMode,
      actionState: 'ready',
      targetHP: LINE_OF_SIGHT_TARGET_HP,
    });
  });
});

// ============================================================================
// Atomic Production Request Boundary
// ============================================================================
// The adapter requests one stable event but never changes a character, tile,
// Action, roll, log result, or HP itself.
// ============================================================================

describe('lineOfSightScenarioControls action requests', () => {
  it('requests the same deterministic event for resolve and replay without authoring results', () => {
    const state = apply(applyDefaults(), 'sightline_case', 'clear_in_range');
    const resolvePatch = lineOfSightScenarioControls.applyControl({
      controlId: 'resolve_probe',
      value: true,
      snapshot: state,
    });
    const replayPatch = lineOfSightScenarioControls.applyControl({
      controlId: 'replay_probe',
      value: true,
      snapshot: state,
    });

    for (const patch of [resolvePatch, replayPatch]) {
      expect(patch.mapData).toBeUndefined();
      expect(patch.characters).toBeUndefined();
      expect(patch.activeLightSources).toBeUndefined();
      expect(patch.logMessage).toBe('');
      expect(patch.abilityExecution).toMatchObject({
        casterId: LINE_OF_SIGHT_TESTER_ID,
        targetId: LINE_OF_SIGHT_TARGET_ID,
        executionEventId: LINE_OF_SIGHT_PROBE_EVENT_ID,
        ability: expect.objectContaining({ id: SIGHTLINE_PROBE.id }),
      });
      expect(patch.abilityExecution?.attackRollRng?.()).toBeCloseTo((12 - 0.5) / 20);
      expect(patch.abilityExecution?.damageRng?.()).toBe(0.5);
    }
  });

  it('preserves live Action and HP while moving between cases', () => {
    const initial = apply(applyDefaults(), 'sightline_case', 'clear_in_range');
    const spent: ScenarioState = {
      ...initial,
      characters: initial.characters.map(character => {
        if (character.id === LINE_OF_SIGHT_TESTER_ID) {
          return {
            ...character,
            actionEconomy: {
              ...character.actionEconomy,
              action: { used: true, remaining: 0 },
            },
          };
        }
        return character.id === LINE_OF_SIGHT_TARGET_ID
          ? { ...character, currentHP: 25 }
          : character;
      }),
    };
    const moved = apply(spent, 'sightline_case', 'corner_blocked');

    expect(actor(moved, LINE_OF_SIGHT_TESTER_ID).actionEconomy.action)
      .toEqual({ used: true, remaining: 0 });
    expect(actor(moved, LINE_OF_SIGHT_TARGET_ID).currentHP).toBe(25);
  });

  it('keeps invalid action values and stale ids as atomic no-ops', () => {
    const state = applyDefaults();
    const invalidAction = lineOfSightScenarioControls.applyControl({
      controlId: 'resolve_probe',
      value: 'go',
      snapshot: state,
    });
    const stale = lineOfSightScenarioControls.applyControl({
      controlId: 'old_wall_toggle',
      value: true,
      snapshot: state,
    });

    expect(invalidAction).toEqual({ logMessage: '' });
    expect(stale.abilityExecution).toBeUndefined();
    expect(stale.characters).toBeUndefined();
    expect(stale.mapData).toBeUndefined();
    expect(stale.logMessage).toMatch(/ignored/i);
  });
});
