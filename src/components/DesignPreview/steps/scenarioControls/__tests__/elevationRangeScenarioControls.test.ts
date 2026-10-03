/**
 * This file proves CS12 prepares canonical elevation, range, sight, and movement facts.
 *
 * Every selector rebuilds one complete production map/actor snapshot. Focused
 * assertions ask the ordinary target validator, elevated sight ray, and A*
 * movement path for outcomes; action buttons remain result-free requests for
 * the mounted stable-id combat transaction.
 *
 * Exercises: elevationRangeScenarioControls.ts.
 * Depends on: production targeting, elevation geometry, sight, and pathfinding.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTargetValidator } from '../../../../../hooks/combat/useTargetValidator';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import elevationRangeScenarioControls, {
  ELEVATION_RANGE_CLIMBER_ID,
  ELEVATION_RANGE_PROBE,
  ELEVATION_RANGE_PROBE_EVENT_ID,
  ELEVATION_RANGE_TARGET_ID,
  ELEVATION_RANGE_TESTER_ID,
  getElevationRangeInitiativeTotal,
  getElevationRangeScenarioReadout,
} from '../elevationRangeScenarioControls';
import {
  createPreviewCombatScenarioControlDefaults,
  type PreviewCombatScenarioControlPatch,
  type PreviewCombatScenarioControlSnapshot,
  type PreviewCombatScenarioControlValue,
  type PreviewCombatScenarioControlValues,
} from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Complete Mounted-Shape Fixture
// ============================================================================
// The raw map matches the expanded scenario's two rock tiers. The adapter adds
// its target pedestal, finite blocker, and designated transition from defaults.
// ============================================================================

interface ScenarioState extends PreviewCombatScenarioControlSnapshot {
  mapData: BattleMapData;
  controlValues: PreviewCombatScenarioControlValues;
  logMessage: string;
}

function createTile(x: number, y: number): BattleMapTile {
  const isRaised = x >= 8;
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: isRaised ? 'rock' : 'floor',
    elevation: x >= 12 ? 20 : isRaised ? 10 : 0,
    movementCost: 5,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    effects: [],
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
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 12 };
}

function createCharacters(): CombatCharacter[] {
  const tester = createMockCombatCharacter({
    id: ELEVATION_RANGE_TESTER_ID,
    name: 'Raw Tester',
    team: 'player',
    position: { x: 3, y: 5 },
  });
  const target = createMockCombatCharacter({
    id: ELEVATION_RANGE_TARGET_ID,
    name: 'Raw Target',
    team: 'enemy',
    position: { x: 10, y: 5 },
  });
  return [tester, target];
}

function rawState(): ScenarioState {
  return {
    mapData: createMap(),
    characters: createCharacters(),
    activeLightSources: [],
    reactiveTriggers: [],
    controlValues: createPreviewCombatScenarioControlDefaults(elevationRangeScenarioControls),
    logMessage: '',
  };
}

function applyPatch(state: ScenarioState, patch: PreviewCombatScenarioControlPatch): ScenarioState {
  return {
    ...state,
    mapData: patch.mapData ?? state.mapData,
    characters: patch.characters ?? state.characters,
    logMessage: patch.logMessage,
  };
}

function apply(
  state: ScenarioState,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): ScenarioState {
  const controlValues = { ...state.controlValues, [controlId]: value };
  const patch = elevationRangeScenarioControls.applyControl({
    controlId,
    value,
    snapshot: { ...state, controlValues },
  });
  return { ...applyPatch(state, patch), controlValues };
}

function applyDefaults(state: ScenarioState = rawState()): ScenarioState {
  return elevationRangeScenarioControls.controls.reduce((current, control) => (
    apply(current, control.id, control.defaultValue)
  ), state);
}

function actor(state: ScenarioState, actorId: string): CombatCharacter {
  const character = state.characters.find(candidate => candidate.id === actorId);
  if (!character) throw new Error(`Missing CS12 actor ${actorId}.`);
  return character;
}

function validation(state: ScenarioState) {
  const tester = actor(state, ELEVATION_RANGE_TESTER_ID);
  const target = actor(state, ELEVATION_RANGE_TARGET_ID);
  const { result } = renderHook(() => useTargetValidator({
    characters: state.characters,
    mapData: state.mapData,
  }));
  return result.current.getTargetValidation(ELEVATION_RANGE_PROBE, tester, target.position);
}

// ============================================================================
// Visible Contract And Exact Reset
// ============================================================================
// These assertions protect all requested controls, deterministic turn order,
// and byte-equivalent fresh defaults without adding a high-ground attack bonus.
// ============================================================================

describe('elevationRangeScenarioControls contract and reset', () => {
  it('exposes elevation, range, sight, movement, resolve, and replay controls', () => {
    expect(elevationRangeScenarioControls.scenarioId).toBe('elevation_range');
    expect(elevationRangeScenarioControls.controls.map(control => [
      control.id,
      control.kind,
      control.defaultValue,
    ])).toEqual([
      ['elevation_case', 'select', 'target_10'],
      ['range_boundary', 'select', 'exactly_in_range'],
      ['los_blocker', 'select', 'clear'],
      ['movement_case', 'select', 'ascent_open'],
      ['resolve_range_probe', 'action', false],
      ['replay_range_probe', 'action', false],
    ]);
  });

  it('rebuilds the exact raised in-range open-ascent fixture on fresh Reset', () => {
    const first = applyDefaults();
    const second = applyDefaults();

    expect(first.mapData).toEqual(second.mapData);
    expect(first.characters).toEqual(second.characters);
    expect(getElevationRangeScenarioReadout(first)).toEqual({
      testerAltitudeFeet: 0,
      targetAltitudeFeet: 10,
      distanceFeet: 30,
      rangeFeet: 30,
      lineOfSight: true,
      targetEligible: true,
      movementPathExists: true,
      movementCostFeet: 15,
      attackBonus: 5,
    });
    expect(actor(first, ELEVATION_RANGE_TARGET_ID).name).toContain('10 ft · 30 ft · IN RANGE');
    expect(actor(first, ELEVATION_RANGE_CLIMBER_ID).name).toContain('ascent · 15 ft');
    expect([
      getElevationRangeInitiativeTotal(actor(first, ELEVATION_RANGE_TESTER_ID)),
      getElevationRangeInitiativeTotal(actor(first, ELEVATION_RANGE_CLIMBER_ID)),
      getElevationRangeInitiativeTotal(actor(first, ELEVATION_RANGE_TARGET_ID)),
    ]).toEqual([30, 20, 10]);
  });
});

// ============================================================================
// Canonical 3D Range And Altitude
// ============================================================================
// Horizontal placement changes with height so every elevation can prove the
// exact thirty-foot edge and five-foot invalid boundary through production.
// ============================================================================

describe('elevationRangeScenarioControls 3D range', () => {
  it.each([
    ['level', 0],
    ['target_10', 10],
    ['target_20', 20],
  ] as const)('%s stays exactly at the 30-foot boundary', (elevationCase, altitudeFeet) => {
    const state = apply(applyDefaults(), 'elevation_case', elevationCase);
    const readout = getElevationRangeScenarioReadout(state);

    expect(readout).toMatchObject({
      targetAltitudeFeet: altitudeFeet,
      distanceFeet: 30,
      targetEligible: true,
      attackBonus: 5,
    });
    expect(validation(state)).toEqual({ isValid: true });
    expect(ELEVATION_RANGE_PROBE.attackBonus).toBe(5);
  });

  it('rejects the 35-foot target before any combat result is authored', () => {
    const state = apply(applyDefaults(), 'range_boundary', 'five_feet_out');

    expect(getElevationRangeScenarioReadout(state)).toMatchObject({
      distanceFeet: 35,
      targetEligible: false,
    });
    expect(validation(state)).toEqual({
      isValid: false,
      reason: expect.stringMatching(/too far away.*30 ft.*35 ft/i),
    });
    expect(actor(state, ELEVATION_RANGE_TESTER_ID).actionEconomy.action)
      .toEqual({ used: false, remaining: 1 });
  });
});

// ============================================================================
// Elevation-Aware Blockers
// ============================================================================
// A finite blocker below the ray is visible but does not grant an invented
// attack bonus. Raising its top to the eye ray makes the target illegal.
// ============================================================================

describe('elevationRangeScenarioControls line of sight', () => {
  it('sees over the low blocker and rejects the taller blocker', () => {
    const low = apply(applyDefaults(), 'los_blocker', 'low_clear');
    const tall = apply(low, 'los_blocker', 'tall_blocked');

    expect(getElevationRangeScenarioReadout(low)).toMatchObject({
      lineOfSight: true,
      targetEligible: true,
      attackBonus: 5,
    });
    expect(validation(low)).toEqual({ isValid: true });
    expect(getElevationRangeScenarioReadout(tall)).toMatchObject({
      lineOfSight: false,
      targetEligible: false,
      attackBonus: 5,
    });
    expect(validation(tall).reason).toMatch(/line of sight/i);
  });
});

// ============================================================================
// Climb, Descent, And Blocking
// ============================================================================
// Open transitions cost five horizontal plus ten vertical feet. Closing the
// sole crossing produces no path; controlled descent does not invent a fall.
// ============================================================================

describe('elevationRangeScenarioControls height movement', () => {
  it.each([
    ['ascent_open', true, 15, 'ascent'],
    ['ascent_blocked', false, null, 'blocked ascent'],
    ['descent_open', true, 15, 'descent'],
  ] as const)('%s exposes the production path result', (
    movementCase,
    movementPathExists,
    movementCostFeet,
    label,
  ) => {
    const state = apply(applyDefaults(), 'movement_case', movementCase);

    expect(getElevationRangeScenarioReadout(state)).toMatchObject({
      movementPathExists,
      movementCostFeet,
    });
    expect(actor(state, ELEVATION_RANGE_CLIMBER_ID).name).toContain(label);
  });
});

// ============================================================================
// Atomic Resolve And Replay Requests
// ============================================================================
// Both buttons request one identical production event. Invalid values and stale
// ids cannot mutate characters, tiles, resources, rolls, or HP in the adapter.
// ============================================================================

describe('elevationRangeScenarioControls action boundary', () => {
  it('requests one stable production probe for Resolve and Replay', () => {
    const state = applyDefaults();
    const resolvePatch = elevationRangeScenarioControls.applyControl({
      controlId: 'resolve_range_probe', value: true, snapshot: state,
    });
    const replayPatch = elevationRangeScenarioControls.applyControl({
      controlId: 'replay_range_probe', value: true, snapshot: state,
    });

    for (const patch of [resolvePatch, replayPatch]) {
      expect(patch.mapData).toBeUndefined();
      expect(patch.characters).toBeUndefined();
      expect(patch.logMessage).toBe('');
      expect(patch.abilityExecution).toMatchObject({
        casterId: ELEVATION_RANGE_TESTER_ID,
        targetId: ELEVATION_RANGE_TARGET_ID,
        executionEventId: ELEVATION_RANGE_PROBE_EVENT_ID,
        ability: expect.objectContaining({ id: ELEVATION_RANGE_PROBE.id, range: 6 }),
      });
      expect(patch.abilityExecution?.attackRollRng?.()).toBeCloseTo((12 - 0.5) / 20);
      expect(patch.abilityExecution?.damageRng?.()).toBe(0.5);
    }
  });

  it('preserves spent Action and damaged HP while selectors change', () => {
    const initial = applyDefaults();
    const spent: ScenarioState = {
      ...initial,
      characters: initial.characters.map(character => {
        if (character.id === ELEVATION_RANGE_TESTER_ID) {
          return {
            ...character,
            actionEconomy: {
              ...character.actionEconomy,
              action: { used: true, remaining: 0 },
            },
          };
        }
        return character.id === ELEVATION_RANGE_TARGET_ID
          ? { ...character, currentHP: 21 }
          : character;
      }),
    };
    const changed = apply(spent, 'elevation_case', 'target_20');

    expect(actor(changed, ELEVATION_RANGE_TESTER_ID).actionEconomy.action)
      .toEqual({ used: true, remaining: 0 });
    expect(actor(changed, ELEVATION_RANGE_TARGET_ID).currentHP).toBe(21);
  });

  it('keeps invalid values and stale ids atomic', () => {
    const state = applyDefaults();
    const invalidAction = elevationRangeScenarioControls.applyControl({
      controlId: 'resolve_range_probe', value: 'go', snapshot: state,
    });
    const stale = elevationRangeScenarioControls.applyControl({
      controlId: 'old_raised_toggle', value: true, snapshot: state,
    });

    expect(invalidAction).toEqual({ logMessage: '' });
    expect(stale.mapData).toBeUndefined();
    expect(stale.characters).toBeUndefined();
    expect(stale.abilityExecution).toBeUndefined();
    expect(stale.logMessage).toMatch(/ignored/i);
  });
});
