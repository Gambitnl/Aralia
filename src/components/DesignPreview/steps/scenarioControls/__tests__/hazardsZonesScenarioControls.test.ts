/**
 * This file proves the Hazards & Zones adapter authors real deterministic combat inputs.
 *
 * The tests exercise every phase through ActiveSpellZone and AreaEffectTracker,
 * inspect the stable production action envelope, and verify source removal and
 * Reset rebuild exact state. Runtime HP, defenses, and downing are covered in
 * the combat-engine test because this adapter is intentionally not a rules engine.
 *
 * Called by: focused Vitest CS13 verification.
 * Depends on: hazardsZonesScenarioControls and the production area tracker.
 */

import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import type { ActiveSpellZone } from '../../../../../systems/spells/effects';
import { AreaEffectTracker } from '../../../../../systems/spells/effects/AreaEffectTracker';
import { createMockCombatCharacter } from '../../../../../utils/core';
import hazardsZonesScenarioControls from '../hazardsZonesScenarioControls';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValue,
  PreviewCombatScenarioControlValues,
} from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Production-Shaped Board and Actors
// ============================================================================
// The complete 16-by-12 board matches the scenario host closely enough to prove
// exact footprint edits and route costs without fabricating any combat outcome.
// ============================================================================

function createTile(x: number, y: number): BattleMapTile {
  const insideHazard = x >= 6 && x <= 10 && y >= 3 && y <= 7;
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: insideHazard ? 'difficult' : 'floor',
    elevation: 0,
    movementCost: insideHazard ? 10 : 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: insideHazard ? ['hazards_zones'] : [],
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
    seed: 221,
  };
}

function createCharacter(id: string, position: { x: number; y: number }): CombatCharacter {
  return createMockCombatCharacter({
    id,
    name: id === 'hazards_zones-tester' ? 'Hazard Tester' : 'Hazard Target',
    team: id === 'hazards_zones-tester' ? 'player' : 'enemy',
    position,
    currentHP: 20,
    maxHP: 20,
  });
}

function createSnapshot(
  controlValues: PreviewCombatScenarioControlValues = {},
): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: createMap(),
    characters: [
      createCharacter('hazards_zones-tester', { x: 3, y: 5 }),
      createCharacter('hazards_zones-target', { x: 5, y: 5 }),
    ],
    activeLightSources: [],
    reactiveTriggers: [],
    spellZones: [],
    controlValues,
  };
}

// ============================================================================
// Shared Host Merge Helpers
// ============================================================================
// These helpers reproduce the host's one-patch-at-a-time merge. Action requests
// are returned for inspection rather than executed by this pure adapter test.
// ============================================================================

function mergePatch(
  snapshot: PreviewCombatScenarioControlSnapshot,
  patch: PreviewCombatScenarioControlPatch,
): PreviewCombatScenarioControlSnapshot {
  return {
    ...snapshot,
    mapData: patch.mapData ?? snapshot.mapData,
    characters: patch.characters ?? snapshot.characters,
    activeLightSources: patch.activeLightSources ?? snapshot.activeLightSources,
    reactiveTriggers: patch.reactiveTriggers ?? snapshot.reactiveTriggers,
    spellZones: patch.spellZones ?? snapshot.spellZones,
  };
}

function applyControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): { snapshot: PreviewCombatScenarioControlSnapshot; patch: PreviewCombatScenarioControlPatch } {
  const controlValues = { ...snapshot.controlValues, [controlId]: value };
  const applicationSnapshot = { ...snapshot, controlValues };
  const patch = hazardsZonesScenarioControls.applyControl({
    controlId,
    value,
    snapshot: applicationSnapshot,
  });
  return {
    snapshot: { ...mergePatch(applicationSnapshot, patch), controlValues },
    patch,
  };
}

function applyDefaults(): PreviewCombatScenarioControlSnapshot {
  let snapshot = createSnapshot();
  for (const control of hazardsZonesScenarioControls.controls) {
    snapshot = applyControl(snapshot, control.id, control.defaultValue).snapshot;
  }
  return snapshot;
}

function getZone(snapshot: PreviewCombatScenarioControlSnapshot): ActiveSpellZone {
  const zone = snapshot.spellZones?.find(candidate => candidate.id === 'hazards-zones-burning-ground');
  expect(zone).toBeDefined();
  return zone!;
}

function getTarget(snapshot: PreviewCombatScenarioControlSnapshot): CombatCharacter {
  const target = snapshot.characters.find(character => character.id === 'hazards_zones-target');
  expect(target).toBeDefined();
  return target!;
}

// ============================================================================
// Contract, Phase, Replay, and Reset Proof
// ============================================================================

describe('hazardsZonesScenarioControls', () => {
  it('publishes the bounded CS13 controls with exact Reset defaults', () => {
    expect(hazardsZonesScenarioControls.scenarioId).toBe('hazards_zones');
    expect(hazardsZonesScenarioControls.controls.map(control => [
      control.id,
      control.kind,
      control.defaultValue,
    ])).toEqual([
      ['hazard-zone-active', 'toggle', true],
      ['difficult-terrain', 'toggle', true],
      ['trigger-phase', 'select', 'enter'],
      ['save-outcome', 'select', 'fail'],
      ['defenses', 'select', 'none'],
      ['resolve-trigger', 'action', false],
      ['replay-trigger', 'action', false],
    ]);
  });

  it('rebuilds a fresh 25-tile source and frequency ledger on Reset', () => {
    const first = applyDefaults();
    const second = applyDefaults();
    const firstZone = getZone(first);
    const secondZone = getZone(second);

    expect(firstZone).toMatchObject({
      spellId: 'sandbox-burning-ground',
      casterId: 'hazards_zones-tester',
      areaOfEffect: { shape: 'cube', size: 25 },
      saveDC: 30,
      expiresAtRound: 4,
    });
    expect(firstZone.triggeredThisTurn).not.toBe(secondZone.triggeredThisTurn);
    expect(firstZone.triggeredEver).not.toBe(secondZone.triggeredEver);
    expect([...first.mapData!.tiles.values()].filter(tile => (
      tile.coordinates.x >= 6 && tile.coordinates.x <= 10
      && tile.coordinates.y >= 3 && tile.coordinates.y <= 7
      && tile.movementCost === 10
    ))).toHaveLength(25);
  });

  it.each([
    ['enter', 'on_enter_area'],
    ['start', 'on_start_turn_in_area'],
    ['end', 'on_end_turn_in_area'],
    ['leave', 'on_exit_area'],
  ] as const)('authors the %s phase through the real area tracker', (phase, triggerType) => {
    const phased = applyControl(applyDefaults(), 'trigger-phase', phase).snapshot;
    const zone = getZone(phased);
    const target = getTarget(phased);
    const tracker = new AreaEffectTracker([zone]);

    const results = phase === 'enter'
      ? tracker.handleMovement(target, { x: 6, y: 5 }, { x: 5, y: 5 }, 1)
      : phase === 'leave'
        ? tracker.handleMovement(target, { x: 5, y: 5 }, { x: 6, y: 5 }, 1)
        : phase === 'start'
          ? tracker.processStartTurn(target, 1)
          : tracker.processEndTurn(target, 1);

    expect(results).toHaveLength(phase === 'enter' || phase === 'leave' ? 2 : 1);
    expect(results[0]).toMatchObject({ triggered: true, triggerType });
    expect(results[0].effects[0]).toMatchObject({
      type: 'damage',
      dice: '1d1',
      damageType: 'fire',
      requiresSave: true,
      saveType: 'Dexterity',
      saveEffect: 'half',
    });
    expect(results.flatMap(result => result.effects).some(effect => effect.statusName === 'Ignited')).toBe(
      phase === 'enter' || phase === 'leave',
    );
  });

  it('preserves both authored crossing payloads for each real boundary event', () => {
    const snapshot = applyDefaults();
    const zone = getZone(snapshot);
    const target = getTarget(snapshot);
    const tracker = new AreaEffectTracker([zone]);

    const results = tracker.handleMovement(target, { x: 6, y: 5 }, { x: 5, y: 5 }, 1);
    // The tracker keeps a receipt per source effect so their frequency claims
    // stay independent. Both authored payloads still cross this boundary.
    expect(results.flatMap(result => result.effects)).toEqual([
      expect.objectContaining({ type: 'damage', damageType: 'fire' }),
      expect.objectContaining({ type: 'status_condition', statusName: 'Ignited' }),
    ]);
  });

  it('authors deterministic save and defense facts without applying an outcome in the adapter', () => {
    let snapshot = applyDefaults();
    snapshot = applyControl(snapshot, 'save-outcome', 'succeed').snapshot;
    snapshot = applyControl(snapshot, 'defenses', 'temporary_hp').snapshot;
    const target = getTarget(snapshot);

    expect(getZone(snapshot).saveDC).toBe(5);
    expect(target.stats.dexterity).toBe(30);
    expect(target.tempHP).toBe(1);
    expect(target.currentHP).toBeGreaterThan(1);
    expect(snapshot.characters[0].stats.baseInitiative).toBe(-100);
    expect(target.stats.baseInitiative).toBe(100);
  });

  it('delivers one stable production Move envelope for resolve and replay', () => {
    const snapshot = applyDefaults();
    const first = applyControl(snapshot, 'resolve-trigger', true).patch.combatActionExecution;
    const replay = applyControl(snapshot, 'replay-trigger', true).patch.combatActionExecution;

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      id: 'cs13-hazard-trigger-event-001',
      characterId: 'hazards_zones-target',
      type: 'move',
      targetPosition: { x: 6, y: 5 },
      movementPath: [{ x: 5, y: 5 }, { x: 6, y: 5 }],
      cost: { type: 'movement-only', movementCost: 10 },
    });
    expect(first).not.toHaveProperty('damage');
  });

  it('removes only the owned source and leaves independent lingering state untouched', () => {
    const defaults = applyDefaults();
    const target = getTarget(defaults);
    target.conditions = [{
      name: 'Ignited',
      duration: { type: 'rounds', value: 1 },
      appliedTurn: 1,
      source: 'zone_effect',
    }];
    const unrelatedZone: ActiveSpellZone = {
      id: 'unrelated-zone',
      spellId: 'fog-cloud',
      casterId: 'other',
      position: { x: 0, y: 0 },
      effects: [],
      triggeredThisTurn: new Set(),
      triggeredEver: new Set(),
    };
    defaults.spellZones = [...(defaults.spellZones ?? []), unrelatedZone];

    const removed = applyControl(defaults, 'hazard-zone-active', false).snapshot;
    expect(removed.spellZones).toEqual([unrelatedZone]);
    expect(getTarget(removed).conditions).toEqual(target.conditions);
  });
});
