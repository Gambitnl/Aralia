/**
 * This file proves the CS09 Forced Movement adapter and canonical command path.
 *
 * The tests apply the same selectors as the mounted panel, execute the authored
 * spell through SpellCommandFactory, and inspect positions, target movement,
 * collision rejection, boundary hazards, OA comparison, stable event identity,
 * and exact Reset Board defaults.
 *
 * Called by: focused Tactical Sandbox Vitest acceptance runs.
 * Depends on: forcedMovementScenarioControls, SpellCommandFactory, and combat factories.
 */

import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  CombatState,
} from '../../../../../types/combat';
import type { Spell } from '../../../../../types/spells';
import { SpellCommandFactory } from '../../../../../commands/factory/SpellCommandFactory';
import {
  createMockCombatCharacter,
  createMockCombatState,
  createMockGameState,
} from '../../../../../utils/core/factories';
import forcedMovementScenarioControls, {
  FORCED_MOVEMENT_ABILITY_ID,
  FORCED_MOVEMENT_CASTER_ID,
  FORCED_MOVEMENT_COLLISION_ID,
  FORCED_MOVEMENT_EVENT_ID,
  FORCED_MOVEMENT_GUARD_ID,
  FORCED_MOVEMENT_TARGET_ID,
} from '../forcedMovementScenarioControls';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
} from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Complete Mounted-Shape Fixtures
// ============================================================================
// The rectangular map keeps bounds, walls, occupancy, and spell zones on their
// production paths. Three unrelated actors also prove CS09 only replaces its
// owned fixtures.
// ============================================================================

function createTile(x: number, y: number): BattleMapTile {
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
    environmentalEffects: [],
  };
}

function createScenarioMap(): BattleMapData {
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
    seed: 209,
  };
}

function createScenarioCharacters(): CombatCharacter[] {
  const caster = createMockCombatCharacter({
    id: FORCED_MOVEMENT_CASTER_ID,
    name: 'Generated Tester',
    team: 'player',
    position: { x: 3, y: 5 },
  });
  const target = createMockCombatCharacter({
    id: FORCED_MOVEMENT_TARGET_ID,
    name: 'Generated Target',
    team: 'enemy',
    position: { x: 10, y: 5 },
  });
  const bystander = createMockCombatCharacter({
    id: 'cs09-unrelated-bystander',
    name: 'Unrelated Bystander',
    team: 'neutral',
    position: { x: 2, y: 2 },
  });

  return [caster, target, bystander];
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: createScenarioMap(),
    characters: createScenarioCharacters(),
    activeLightSources: [],
    reactiveTriggers: [],
    spellZones: [],
    controlValues: {},
  };
}

interface ScenarioHarness extends PreviewCombatScenarioControlSnapshot {
  mapData: BattleMapData;
  spellZones: NonNullable<PreviewCombatScenarioControlSnapshot['spellZones']>;
  lastLog: string;
}

function harnessFromSnapshot(snapshot: PreviewCombatScenarioControlSnapshot): ScenarioHarness {
  if (!snapshot.mapData) {
    throw new Error('CS09 test map is missing.');
  }

  return {
    ...snapshot,
    mapData: snapshot.mapData,
    spellZones: snapshot.spellZones ?? [],
    lastLog: '',
  };
}

function mergePatch(
  harness: ScenarioHarness,
  controlId: string,
  value: boolean | number | string,
  patch: PreviewCombatScenarioControlPatch,
): ScenarioHarness {
  const definition = forcedMovementScenarioControls.controls.find(control => control.id === controlId);

  return {
    ...harness,
    mapData: patch.mapData ?? harness.mapData,
    characters: patch.characters ?? harness.characters,
    activeLightSources: patch.activeLightSources ?? harness.activeLightSources,
    reactiveTriggers: patch.reactiveTriggers ?? harness.reactiveTriggers,
    spellZones: patch.spellZones ?? harness.spellZones,
    controlValues: {
      ...harness.controlValues,
      [controlId]: definition?.kind === 'action' ? definition.defaultValue : value,
    },
    lastLog: patch.logMessage,
  };
}

function apply(
  harness: ScenarioHarness,
  controlId: string,
  value: boolean | number | string,
): ScenarioHarness {
  const patch = forcedMovementScenarioControls.applyControl({
    controlId,
    value,
    snapshot: harness,
  });
  return mergePatch(harness, controlId, value, patch);
}

function applyDefaults(): ScenarioHarness {
  return forcedMovementScenarioControls.controls.reduce((harness, control) => (
    apply(harness, control.id, control.defaultValue)
  ), harnessFromSnapshot(createSnapshot()));
}

function actor(characters: CombatCharacter[], id: string): CombatCharacter {
  const found = characters.find(character => character.id === id);
  if (!found) {
    throw new Error(`CS09 actor ${id} is missing.`);
  }
  return found;
}

function forceSpell(characters: CombatCharacter[]): Spell {
  const ability = actor(characters, FORCED_MOVEMENT_CASTER_ID)
    .abilities.find(candidate => candidate.id === FORCED_MOVEMENT_ABILITY_ID);
  if (!ability || typeof ability.spell !== 'object' || ability.spell === null) {
    throw new Error('CS09 spell-backed force ability is missing.');
  }
  return ability.spell as Spell;
}

async function executeForce(harness: ScenarioHarness): Promise<CombatState> {
  const caster = actor(harness.characters, FORCED_MOVEMENT_CASTER_ID);
  const target = actor(harness.characters, FORCED_MOVEMENT_TARGET_ID);
  const commands = await SpellCommandFactory.createCommands(
    forceSpell(harness.characters),
    caster,
    [target],
    1,
    createMockGameState(),
  );
  let state = createMockCombatState({
    characters: harness.characters,
    mapData: harness.mapData,
    spellZones: harness.spellZones,
    combatLog: [],
  });

  // Execute the complete factory result so the test follows the same command
  // composition as the mounted ability transaction.
  for (const command of commands) {
    state = await command.execute(state);
  }
  return state;
}

// ============================================================================
// Control Surface And Exact Defaults
// ============================================================================
// Reset Board applies these defaults in declared order. Its final state is the
// clear ten-foot push with ready source resources and no boundary hazard.
// ============================================================================

describe('forcedMovementScenarioControls contract', () => {
  it('declares direction, distance, obstruction, hazard, resolve, comparison, and replay controls', () => {
    expect(forcedMovementScenarioControls.scenarioId).toBe('forced_movement');
    expect(forcedMovementScenarioControls.controls.map(control => [control.id, control.kind])).toEqual([
      ['force-direction', 'select'],
      ['force-distance', 'select'],
      ['obstruction-case', 'select'],
      ['hazard-boundary', 'select'],
      ['resolve-force', 'action'],
      ['voluntary-oa-comparison', 'action'],
      ['replay-force-event', 'action'],
    ]);
  });

  it('restores the exact default board without mutating the authored snapshot', () => {
    const original = createSnapshot();
    const originalCharacters = original.characters;
    const reset = applyDefaults();
    const caster = actor(reset.characters, FORCED_MOVEMENT_CASTER_ID);
    const target = actor(reset.characters, FORCED_MOVEMENT_TARGET_ID);
    const movementEffect = forceSpell(reset.characters).effects.find(effect => effect.type === 'MOVEMENT');

    expect(reset.characters).not.toBe(originalCharacters);
    expect(caster.position).toEqual({ x: 3, y: 5 });
    expect(caster.actionEconomy.action.used).toBe(false);
    expect(caster.spellSlots?.level_1).toEqual({ current: 1, max: 1 });
    expect(target.position).toEqual({ x: 6, y: 5 });
    expect(target.name).toContain('movement unspent');
    expect(movementEffect).toMatchObject({ movementType: 'push', distance: 10 });
    expect(reset.mapData.tiles.get('7-5')).toMatchObject({ terrain: 'floor', blocksMovement: false });
    expect(reset.characters.some(character => character.id === FORCED_MOVEMENT_COLLISION_ID)).toBe(false);
    expect(reset.spellZones).toEqual([]);
    expect(original.characters).toBe(originalCharacters);
    expect(original.characters[1].position).toEqual({ x: 10, y: 5 });
  });
});

// ============================================================================
// Canonical Push, Pull, Atomic Rejection, And Hazards
// ============================================================================
// Each result comes from SpellCommandFactory and MovementCommand. Selectors do
// not author an outcome, so position, logs, and boundary damage remain normal
// runtime evidence rather than a UI-only imitation.
// ============================================================================

describe('forcedMovementScenarioControls canonical outcomes', () => {
  it('pushes and pulls the full distance without spending target movement', async () => {
    const pushBoard = applyDefaults();
    const pushMovementBefore = actor(pushBoard.characters, FORCED_MOVEMENT_TARGET_ID).actionEconomy.movement;
    const pushResult = await executeForce(pushBoard);
    expect(actor(pushResult.characters, FORCED_MOVEMENT_TARGET_ID).position).toEqual({ x: 8, y: 5 });
    expect(actor(pushResult.characters, FORCED_MOVEMENT_TARGET_ID).actionEconomy.movement).toBe(pushMovementBefore);

    const pullBoard = apply(applyDefaults(), 'force-direction', 'pull');
    const pullResult = await executeForce(pullBoard);
    expect(actor(pullResult.characters, FORCED_MOVEMENT_TARGET_ID).position).toEqual({ x: 4, y: 5 });
    expect(pullResult.combatLog.at(-1)?.message).toContain('pulled 10 feet');
  });

  it.each([
    ['blocked', { x: 6, y: 5 }],
    ['occupied', { x: 6, y: 5 }],
    ['off_board', { x: 15, y: 5 }],
    ['invalid_vector', { x: 6, y: 5 }],
  ] as const)('rejects the %s case atomically', async (obstruction, expectedPosition) => {
    const board = apply(applyDefaults(), 'obstruction-case', obstruction);
    const movementBefore = actor(board.characters, FORCED_MOVEMENT_TARGET_ID).actionEconomy.movement;
    const result = await executeForce(board);
    const target = actor(result.characters, FORCED_MOVEMENT_TARGET_ID);

    expect(target.position).toEqual(expectedPosition);
    expect(target.actionEconomy.movement).toBe(movementBefore);
    expect(result.combatLog.at(-1)?.message).toMatch(/cannot be pushed/);
  });

  it.each(['entry', 'exit'] as const)('fires the authored %s boundary exactly once', async boundary => {
    const board = apply(applyDefaults(), 'hazard-boundary', boundary);
    const result = await executeForce(board);
    const target = actor(result.characters, FORCED_MOVEMENT_TARGET_ID);
    const boundaryLogs = result.combatLog.filter(entry => entry.type === 'damage');

    expect(target.position).toEqual({ x: 8, y: 5 });
    expect(target.currentHP).toBe(19);
    expect(boundaryLogs).toHaveLength(1);
    expect(boundaryLogs[0].data?.trigger).toBe(
      boundary === 'entry' ? 'on_enter_area' : 'on_exit_area',
    );
  });
});

// ============================================================================
// OA Boundary, Stable Replay, And Resource Ownership
// ============================================================================
// The adapter asks the production OA detector for comparison facts and hands a
// level-1 Action spell plus one stable id to useAbilitySystem. The hook's own
// focused replay gate proves repeated delivery cannot pay or execute twice.
// ============================================================================

describe('forcedMovementScenarioControls mounted transaction requests', () => {
  it('reports zero forced OA windows and one voluntary comparison window', () => {
    const board = applyDefaults();
    const forcedPatch = forcedMovementScenarioControls.applyControl({
      controlId: 'resolve-force', value: true, snapshot: board,
    });
    const voluntaryPatch = forcedMovementScenarioControls.applyControl({
      controlId: 'voluntary-oa-comparison', value: true, snapshot: board,
    });

    expect(forcedPatch.logMessage).toContain('forced Opportunity Attack windows 0');
    expect(voluntaryPatch.logMessage).toContain('Opportunity Attack windows 1');
    expect(voluntaryPatch.characters).toBeUndefined();
  });

  it('delivers one Action/L1 spell under the same stable id for resolve and replay', () => {
    const board = applyDefaults();
    const resolvePatch = forcedMovementScenarioControls.applyControl({
      controlId: 'resolve-force', value: true, snapshot: board,
    });
    const replayPatch = forcedMovementScenarioControls.applyControl({
      controlId: 'replay-force-event', value: true, snapshot: board,
    });

    expect(resolvePatch.abilityExecution).toMatchObject({
      casterId: FORCED_MOVEMENT_CASTER_ID,
      targetId: FORCED_MOVEMENT_TARGET_ID,
      executionEventId: FORCED_MOVEMENT_EVENT_ID,
      executionDecision: 'accept',
      ability: {
        id: FORCED_MOVEMENT_ABILITY_ID,
        cost: { type: 'action' },
        spell: { level: 1 },
      },
    });
    expect(replayPatch.abilityExecution?.executionEventId).toBe(FORCED_MOVEMENT_EVENT_ID);
    expect(resolvePatch.characters).toBeUndefined();
    expect(replayPatch.characters).toBeUndefined();
  });

  it('keeps the Boundary Guard visible, hostile, and reaction-ready', () => {
    const guard = actor(applyDefaults().characters, FORCED_MOVEMENT_GUARD_ID);
    expect(guard).toMatchObject({
      team: 'enemy',
      position: { x: 6, y: 4 },
      actionEconomy: { reaction: { used: false, remaining: 1 } },
    });
    expect(guard.abilities.map(ability => ability.name)).toContain('Boundary Strike');
  });
});

// ============================================================================
// Defensive No-Op Behavior
// ============================================================================
// Stale action values and old control ids can survive hot reload. They stay
// observable without altering combat state or inventing a transaction.
// ============================================================================

describe('forcedMovementScenarioControls invalid input', () => {
  it('returns log-only no-ops for a false action and unknown id', () => {
    const board = applyDefaults();
    const falseAction = forcedMovementScenarioControls.applyControl({
      controlId: 'resolve-force', value: false, snapshot: board,
    });
    const unknown = forcedMovementScenarioControls.applyControl({
      controlId: 'old-forced-toggle', value: true, snapshot: board,
    });

    expect(falseAction).toEqual({ logMessage: '' });
    expect(unknown).toEqual({ logMessage: 'CS09 ignored unknown control old-forced-toggle.' });
  });
});
