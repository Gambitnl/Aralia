/**
 * This file proves CS08 controls drive one canonical area-spell transaction.
 *
 * The tests use the same select/action contract as the mounted panel. They
 * inspect highlighted production geometry, exact boundary membership, saves,
 * defenses, Action/slot payment, blocker rejection, event replay, and Reset on
 * the real character/map patches rather than trusting labels alone.
 *
 * Called by: focused Vitest Tactical Sandbox acceptance.
 * Depends on: areaEffectScenarioControls and production combat fixtures.
 */

import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  TurnState,
} from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import areaEffectScenarioControls from '../areaEffectScenarioControls';
import {
  createPreviewCombatScenarioControlDefaults,
  type PreviewCombatScenarioControlSnapshot,
  type PreviewCombatScenarioControlValues,
} from '../PreviewCombatScenarioControlTypes';

const CASTER_ID = 'area_effect-tester';
const CENTER_ID = 'area_effect-target';
const BOUNDARY_ID = 'area-effect-boundary-target';
const OUTSIDE_ID = 'area-effect-outside-target';
const FRIENDLY_ID = 'area-effect-friendly-witness';

// ============================================================================
// Mounted-Contract Test Harness
// ============================================================================
// The board matches the 16x12 design-preview host. State application retains
// live turn/control facts exactly as React would while applying only the patch
// fields returned by the scenario module.
// ============================================================================

interface ScenarioState extends PreviewCombatScenarioControlSnapshot {
  mapData: BattleMapData;
  turnState: TurnState;
  controlValues: PreviewCombatScenarioControlValues;
  lastLog: string;
}

function createTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: 1,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 16; x += 1) {
    for (let y = 0; y < 12; y += 1) tiles.set(`${x}-${y}`, createTile(x, y));
  }
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 8 };
}

function createState(): ScenarioState {
  const caster = createMockCombatCharacter({
    id: CASTER_ID,
    team: 'player',
    position: { x: 3, y: 5 },
    abilities: [],
  });
  const target = createMockCombatCharacter({
    id: CENTER_ID,
    team: 'enemy',
    position: { x: 8, y: 5 },
    abilities: [],
  });
  return {
    mapData: createMap(),
    characters: [caster, target],
    activeLightSources: [],
    reactiveTriggers: [],
    spellZones: [],
    turnState: {
      currentTurn: 1,
      turnOrder: [CASTER_ID, CENTER_ID],
      currentCharacterId: CASTER_ID,
      phase: 'action',
      actionsThisTurn: [],
    },
    controlValues: createPreviewCombatScenarioControlDefaults(areaEffectScenarioControls),
    lastLog: '',
  };
}

function apply(
  state: ScenarioState,
  controlId: string,
  value: string | boolean,
): ScenarioState {
  const controlValues = { ...state.controlValues, [controlId]: value };
  const patch = areaEffectScenarioControls.applyControl({
    controlId,
    value,
    snapshot: { ...state, controlValues },
  });
  return {
    ...state,
    controlValues,
    mapData: patch.mapData ?? state.mapData,
    characters: patch.characters ?? state.characters,
    lastLog: patch.logMessage,
  };
}

function actor(state: ScenarioState, id: string): CombatCharacter {
  const found = state.characters.find(character => character.id === id);
  if (!found) throw new Error(`Missing CS08 actor ${id}.`);
  return found;
}

function prepareDefault(): ScenarioState {
  return apply(createState(), 'area-case', 'fireball_boundary');
}

function highlightedCells(state: ScenarioState): string[] {
  return [...state.mapData.tiles.entries()]
    .filter(([, tile]) => tile.effects.includes('area_effect'))
    .map(([key]) => key);
}

// ============================================================================
// Contract, Geometry, And Exact Boundary Membership
// ============================================================================
// The default sphere displays all 81 cells of the canonical 20-foot Chebyshev
// radius. Resolve includes center, exact boundary, and friendly boundary while
// the fifth cell remains untouched outside the template.
// ============================================================================

describe('areaEffectScenarioControls canonical sphere', () => {
  it('declares shape/outcome selects and resolve, replay, and exact reset actions', () => {
    expect(areaEffectScenarioControls.scenarioId).toBe('area_effect');
    expect(areaEffectScenarioControls.controls.map(control => [control.id, control.kind])).toEqual([
      ['area-case', 'select'],
      ['outcome-case', 'select'],
      ['resolve-area', 'action'],
      ['replay-area-event', 'action'],
      ['reset-area-board', 'action'],
    ]);
    expect(createPreviewCombatScenarioControlDefaults(areaEffectScenarioControls)).toMatchObject({
      'area-case': 'fireball_boundary',
      'outcome-case': 'mixed_saves',
    });
  });

  it('shows exact boundary cells and resolves each included creature once', () => {
    const prepared = prepareDefault();
    expect(highlightedCells(prepared)).toHaveLength(81);
    expect(highlightedCells(prepared)).toContain('12-5');
    expect(highlightedCells(prepared)).not.toContain('13-5');

    const resolved = apply(prepared, 'resolve-area', true);
    expect(resolved.lastLog).toContain('included [area_effect-target, area-effect-boundary-target, area-effect-friendly-witness]');
    expect(resolved.lastLog).toContain('excluded [area-effect-outside-target]');
    expect(actor(resolved, CENTER_ID).currentHP).toBe(28);
    expect(actor(resolved, BOUNDARY_ID).currentHP).toBe(44);
    expect(actor(resolved, FRIENDLY_ID).currentHP).toBe(28);
    expect(actor(resolved, OUTSIDE_ID).currentHP).toBe(60);
    expect(actor(resolved, CASTER_ID).actionEconomy.action.used).toBe(true);
    expect(actor(resolved, CASTER_ID).spellSlots?.level_3?.current).toBe(0);
    expect(actor(resolved, CASTER_ID).statusEffects.map(effect => effect.name)).toContain('AoE event claimed');
  });

  it('resolves one Large boundary creature once across several included cells', () => {
    let state = apply(createState(), 'area-case', 'fireball_large_boundary');
    expect(actor(state, BOUNDARY_ID).stats.size).toBe('Large');
    state = apply(state, 'resolve-area', true);
    expect(state.lastLog.match(/area-effect-boundary-target/g)).toHaveLength(2);
    expect(actor(state, BOUNDARY_ID).currentHP).toBe(44);
  });
});

// ============================================================================
// Shape Orientation And Current Blocker Rules
// ============================================================================
// East and north cones rotate the same 15-foot authored shape. Fireball rejects
// a wall before its origin, while a wall beyond the origin does not invent a
// per-target cover rule that is absent from current targeting data.
// ============================================================================

describe('areaEffectScenarioControls orientation and blockers', () => {
  it('rotates Burning Hands and preserves third-cell in, fourth-cell out membership', () => {
    const east = apply(apply(createState(), 'area-case', 'cone_east'), 'resolve-area', true);
    expect(east.lastLog).toContain('Cone origin 3,5 direction 90 size 15ft');
    expect(actor(east, BOUNDARY_ID).currentHP).toBe(54);
    expect(actor(east, OUTSIDE_ID).currentHP).toBe(60);

    const north = apply(apply(createState(), 'area-case', 'cone_north'), 'resolve-area', true);
    expect(north.lastLog).toContain('Cone origin 3,5 direction 0 size 15ft');
    expect(actor(north, BOUNDARY_ID).position).toEqual({ x: 3, y: 2 });
    expect(actor(north, OUTSIDE_ID).position).toEqual({ x: 3, y: 1 });
  });

  it('rejects blocked/off-map origins atomically and allows an internal wall without propagation', () => {
    const blocked = apply(createState(), 'area-case', 'placement_blocked');
    const blockedCaster = actor(blocked, CASTER_ID);
    const blockedResult = apply(blocked, 'resolve-area', true);
    expect(blockedResult.lastLog).toContain('invalid_placement:line_of_sight_blocked');
    expect(blockedResult.characters).toBe(blocked.characters);
    expect(actor(blockedResult, CASTER_ID)).toBe(blockedCaster);
    expect(blockedCaster.actionEconomy.action.used).toBe(false);
    expect(blockedCaster.spellSlots?.level_3?.current).toBe(1);

    const invalid = apply(apply(createState(), 'area-case', 'invalid_off_map'), 'resolve-area', true);
    expect(invalid.lastLog).toContain('invalid_placement:off_map');
    expect(actor(invalid, CENTER_ID).currentHP).toBe(60);

    const internal = apply(apply(createState(), 'area-case', 'internal_blocker'), 'resolve-area', true);
    expect(internal.lastLog).toContain('RESOLVED');
    expect(internal.lastLog).toContain(BOUNDARY_ID);
    expect(actor(internal, BOUNDARY_ID).currentHP).toBe(44);
  });
});

// ============================================================================
// Saves, Defenses, Downing, Replay, And Reset
// ============================================================================
// Outcome choices author only real target state. The shared resolver owns half
// damage, resistance/immunity, temporary HP, and Unconscious. Replay returns no
// patch, and Reset restores exact defaults including removed blocker cells.
// ============================================================================

describe('areaEffectScenarioControls outcomes and event lifecycle', () => {
  it('shows resistance, immunity, temporary HP, and lethal friendly downing', () => {
    const resistant = apply(
      apply(apply(createState(), 'area-case', 'fireball_boundary'), 'outcome-case', 'resistant_boundary'),
      'resolve-area',
      true,
    );
    expect(actor(resistant, BOUNDARY_ID).currentHP).toBe(52);

    const immune = apply(
      apply(apply(createState(), 'area-case', 'fireball_boundary'), 'outcome-case', 'immune_boundary'),
      'resolve-area',
      true,
    );
    expect(actor(immune, BOUNDARY_ID).currentHP).toBe(60);

    const temp = apply(
      apply(apply(createState(), 'area-case', 'fireball_boundary'), 'outcome-case', 'temporary_hp'),
      'resolve-area',
      true,
    );
    expect(actor(temp, BOUNDARY_ID)).toMatchObject({ currentHP: 54, tempHP: 0 });

    const lethal = apply(
      apply(apply(createState(), 'area-case', 'fireball_boundary'), 'outcome-case', 'lethal_friendly'),
      'resolve-area',
      true,
    );
    expect(actor(lethal, FRIENDLY_ID)).toMatchObject({ currentHP: 0, tempHP: 0 });
    expect(actor(lethal, FRIENDLY_ID).statusEffects.map(effect => effect.name)).toContain('Unconscious');
    expect(lethal.lastLog).toContain('DOWNED/Unconscious');
  });

  it('makes replay an atomic no-op and Reset restore every authored default', () => {
    const blocked = apply(createState(), 'area-case', 'placement_blocked');
    expect(blocked.mapData.tiles.get('6-5')?.blocksLoS).toBe(true);
    const prepared = apply(blocked, 'area-case', 'fireball_boundary');
    const resolved = apply(prepared, 'resolve-area', true);
    const replay = apply(resolved, 'replay-area-event', true);
    expect(replay.lastLog).toContain('replayed_event');
    expect(replay.characters).toBe(resolved.characters);
    expect(actor(replay, CENTER_ID).currentHP).toBe(28);
    expect(actor(replay, CASTER_ID).spellSlots?.level_3?.current).toBe(0);

    const reset = apply(replay, 'reset-area-board', true);
    expect(actor(reset, CENTER_ID).currentHP).toBe(60);
    expect(actor(reset, BOUNDARY_ID).currentHP).toBe(60);
    expect(actor(reset, CASTER_ID).actionEconomy.action.used).toBe(false);
    expect(actor(reset, CASTER_ID).spellSlots?.level_3?.current).toBe(1);
    expect(actor(reset, CASTER_ID).statusEffects.map(effect => effect.name)).not.toContain('AoE event claimed');
    expect(reset.mapData.tiles.get('6-5')?.blocksLoS).toBe(false);
    expect(reset.mapData.tiles.get('10-5')?.blocksLoS).toBe(false);
    expect(highlightedCells(reset)).toHaveLength(81);
  });
});
