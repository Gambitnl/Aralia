import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  LightSource,
} from '../../../../../types/combat';
import darkvisionScenarioControls, {
  DARKVISION_LANTERN_ID,
  DARKVISION_SIGHT_BLOCKER,
  DARKVISION_TARGET_ID,
  DARKVISION_TEST_FIRE_BOLT,
  DARKVISION_WIZARD_ID,
  getDarkvisionInitiativeTotal,
  getDarkvisionScenarioReadout,
} from '../darkvisionScenarioControls';
import {
  createPreviewCombatScenarioControlDefaults,
  type PreviewCombatScenarioControlSnapshot,
  type PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';

/**
 * This file proves the complete Darkvision & Senses teaching transaction.
 *
 * It applies controls through the public adapter, then asks the production
 * visibility and line-of-sight helpers through the adapter readout. The tests
 * cover exact sense boundaries, movable real light, blocked geometry, pure
 * repeat behavior, deterministic Fire Bolt inputs, and Reset defaults without
 * replacing production attack or Action ownership with test-only outcomes.
 *
 * Covers: darkvisionScenarioControls.ts.
 * Depends on: the shared control contract and production visibility helpers.
 */

// ============================================================================
// Deterministic Cave Fixture
// ============================================================================
// The live scenario is sixteen by twelve. Every ordinary tile is dark cave
// floor until the target-case control raises its one authored sight blocker.
// ============================================================================

function createFloorTile(x: number, y: number): BattleMapTile {
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

function createCaveMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const tile = createFloorTile(x, y);
      tiles.set(tile.id, tile);
    }
  }
  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'cave',
    seed: 101,
  };
}

function createCharacter(
  id: string,
  position: { x: number; y: number },
  team: 'player' | 'enemy',
): CombatCharacter {
  return {
    id,
    name: id,
    level: 5,
    class: {} as CombatCharacter['class'],
    position,
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 16,
      wisdom: 10,
      charisma: 10,
      baseInitiative: 0,
      speed: 30,
      cr: 'N/A',
      senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 },
    },
    abilities: [],
    team,
    currentHP: 20,
    maxHP: 20,
    armorClass: 12,
    baseAC: 12,
    initiative: 0,
    statusEffects: [],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: { used: 0, total: 0 },
      movement: { used: 0, total: 30 },
      freeActions: 1,
    },
  };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: createCaveMap(),
    characters: [
      createCharacter(DARKVISION_WIZARD_ID, { x: 2, y: 5 }, 'player'),
      createCharacter('elf-cleric', { x: 4, y: 5 }, 'player'),
      createCharacter('blind-dweller', { x: 8, y: 8 }, 'enemy'),
      createCharacter(DARKVISION_TARGET_ID, { x: 13, y: 5 }, 'enemy'),
    ],
    activeLightSources: [],
    reactiveTriggers: [],
    controlValues: createPreviewCombatScenarioControlDefaults(darkvisionScenarioControls),
  };
}

function applyControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): PreviewCombatScenarioControlSnapshot & { logMessage: string } {
  const controlValues = { ...snapshot.controlValues, [controlId]: value };
  const patch = darkvisionScenarioControls.applyControl({
    controlId,
    value,
    snapshot: { ...snapshot, controlValues },
  });
  return {
    ...snapshot,
    mapData: patch.mapData ?? snapshot.mapData,
    characters: patch.characters ?? snapshot.characters,
    activeLightSources: patch.activeLightSources ?? snapshot.activeLightSources,
    reactiveTriggers: patch.reactiveTriggers ?? snapshot.reactiveTriggers,
    controlValues,
    logMessage: patch.logMessage,
  };
}

function applyDefaults(
  snapshot: PreviewCombatScenarioControlSnapshot = createSnapshot(),
): PreviewCombatScenarioControlSnapshot {
  const defaults = createPreviewCombatScenarioControlDefaults(darkvisionScenarioControls);
  return darkvisionScenarioControls.controls.reduce<PreviewCombatScenarioControlSnapshot>(
    (current, control) => applyControl(current, control.id, defaults[control.id]),
    { ...snapshot, controlValues: defaults },
  );
}

function read(snapshot: PreviewCombatScenarioControlSnapshot) {
  const receipt = getDarkvisionScenarioReadout(snapshot);
  expect(receipt).not.toBeNull();
  return receipt!;
}

function findCharacter(
  snapshot: PreviewCombatScenarioControlSnapshot,
  characterId: string,
): CombatCharacter {
  const character = snapshot.characters.find(candidate => candidate.id === characterId);
  expect(character).toBeDefined();
  return character!;
}

// ============================================================================
// Public Contract and Reset
// ============================================================================

describe('darkvisionScenarioControls', () => {
  it('publishes four controls covering senses, range/geometry, movable light, and one real attack', () => {
    expect(darkvisionScenarioControls.scenarioId).toBe('darkvision');
    expect(darkvisionScenarioControls.controls).toEqual([
      expect.objectContaining({ id: 'observer-sense-mode', kind: 'select', defaultValue: 'normal' }),
      expect.objectContaining({ id: 'target-case', kind: 'select', defaultValue: 'darkvision_inside_60' }),
      expect.objectContaining({ id: 'lantern-position', kind: 'select', defaultValue: 'off' }),
      expect.objectContaining({ id: 'resolve-fire-bolt', kind: 'action', defaultValue: false }),
    ]);
  });

  it('replays Reset as normal vision, 60 ft darkness, clear sight, no light, and a ready Action', () => {
    let changed = applyDefaults();
    changed = applyControl(changed, 'observer-sense-mode', 'blindsight_30');
    changed = applyControl(changed, 'target-case', 'blocked_line_of_sight');
    changed = applyControl(changed, 'lantern-position', 'on_target');
    changed = {
      ...changed,
      characters: changed.characters.map(character => character.id === DARKVISION_WIZARD_ID
        ? {
            ...character,
            actionEconomy: {
              ...character.actionEconomy,
              action: { used: true, remaining: 0 },
            },
          }
        : character),
    };

    // The adapter defaults restore authored inputs but deliberately do not
    // refund Action. The mounted Reset delegates that final refresh to the
    // production combat initializer.
    const resetInputs = applyDefaults(changed);
    const receipt = read(resetInputs);
    expect(receipt).toMatchObject({
      observerSense: 'Normal vision',
      distanceFeet: 60,
      lightLevel: 'darkness',
      visibilityTier: 'hidden',
      lineOfSight: true,
      attackRollMode: 'disadvantage',
      actionState: 'spent',
    });
    expect(resetInputs.activeLightSources).toHaveLength(0);
    expect(findCharacter(resetInputs, DARKVISION_WIZARD_ID).actionEconomy.action)
      .toEqual({ used: true, remaining: 0 });
  });

  // ========================================================================
  // Exact Sense and Geometry Boundaries
  // ========================================================================

  it('keeps 60 ft Darkvision dim at its exact edge and hidden at 65 ft', () => {
    let snapshot = applyDefaults();
    snapshot = applyControl(snapshot, 'observer-sense-mode', 'darkvision_60');
    expect(read(snapshot)).toMatchObject({
      distanceFeet: 60,
      lightLevel: 'darkness',
      visibilityTier: 'dim',
      attackRollMode: 'normal',
    });

    snapshot = applyControl(snapshot, 'target-case', 'darkvision_outside_65');
    expect(read(snapshot)).toMatchObject({
      distanceFeet: 65,
      lightLevel: 'darkness',
      visibilityTier: 'hidden',
      attackRollMode: 'disadvantage',
    });
  });

  it('keeps 30 ft Blindsight visible at its exact edge and hidden at 35 ft', () => {
    let snapshot = applyDefaults();
    snapshot = applyControl(snapshot, 'observer-sense-mode', 'blindsight_30');
    snapshot = applyControl(snapshot, 'target-case', 'blindsight_inside_30');
    expect(read(snapshot)).toMatchObject({
      distanceFeet: 30,
      lightLevel: 'darkness',
      visibilityTier: 'visible',
      attackRollMode: 'normal',
    });

    snapshot = applyControl(snapshot, 'target-case', 'blindsight_outside_35');
    expect(read(snapshot)).toMatchObject({
      distanceFeet: 35,
      visibilityTier: 'hidden',
      attackRollMode: 'disadvantage',
    });
  });

  it('lets Total Cover block Blindsight and restores the exact wall on repeat', () => {
    let snapshot = applyDefaults();
    snapshot = applyControl(snapshot, 'observer-sense-mode', 'blindsight_30');
    snapshot = applyControl(snapshot, 'target-case', 'blocked_line_of_sight');
    const firstMap = snapshot.mapData!;
    const blockerId = `${DARKVISION_SIGHT_BLOCKER.x}-${DARKVISION_SIGHT_BLOCKER.y}`;

    expect(firstMap.tiles.get(blockerId)).toMatchObject({ blocksLoS: true, blocksMovement: true });
    expect(read(snapshot)).toMatchObject({ lineOfSight: false, visibilityTier: 'hidden', attackRollMode: 'blocked' });

    snapshot = applyControl(snapshot, 'target-case', 'blocked_line_of_sight');
    expect(snapshot.mapData?.tiles.get(blockerId)).toMatchObject({ blocksLoS: true, blocksMovement: true });
    expect(read(snapshot).attackRollMode).toBe('blocked');
  });

  // ========================================================================
  // Production Light Source
  // ========================================================================

  it('moves one idempotent lantern and changes target illumination through VisibilitySystem', () => {
    let snapshot = applyDefaults();
    const unrelatedLight: LightSource = {
      id: 'unrelated-light',
      sourceSpellId: 'light',
      casterId: 'elf-cleric',
      attachedTo: 'point',
      position: { x: 0, y: 0 },
      brightRadius: 5,
      dimRadius: 0,
      createdTurn: 0,
    };
    snapshot = { ...snapshot, activeLightSources: [unrelatedLight] };
    snapshot = applyControl(snapshot, 'lantern-position', 'near_observer');

    expect(snapshot.activeLightSources.filter(source => source.id === DARKVISION_LANTERN_ID)).toHaveLength(1);
    expect(read(snapshot)).toMatchObject({ lightLevel: 'darkness', visibilityTier: 'hidden' });

    // Moving the same target to 30 feet places it 25 feet from the lantern:
    // outside the 15-foot bright radius but inside its additional dim radius.
    snapshot = applyControl(snapshot, 'target-case', 'blindsight_inside_30');
    expect(read(snapshot)).toMatchObject({ lightLevel: 'dim', visibilityTier: 'dim' });

    snapshot = applyControl(snapshot, 'lantern-position', 'on_target');
    snapshot = applyControl(snapshot, 'lantern-position', 'on_target');
    expect(snapshot.activeLightSources.filter(source => source.id === DARKVISION_LANTERN_ID)).toHaveLength(1);
    expect(snapshot.activeLightSources).toContain(unrelatedLight);
    expect(read(snapshot)).toMatchObject({ lightLevel: 'bright', visibilityTier: 'visible', attackRollMode: 'normal' });

    snapshot = applyControl(snapshot, 'target-case', 'darkvision_outside_65');
    expect(snapshot.activeLightSources.find(source => source.id === DARKVISION_LANTERN_ID)?.position)
      .toEqual({ x: 15, y: 5 });
    expect(read(snapshot).lightLevel).toBe('bright');

    snapshot = applyControl(snapshot, 'lantern-position', 'off');
    expect(snapshot.activeLightSources).toEqual([unrelatedLight]);
  });

  // ========================================================================
  // Production Action Request and Defensive No-Ops
  // ========================================================================

  it('requests deterministic Fire Bolt without paying or mutating state inside the adapter', () => {
    const snapshot = applyDefaults();
    const patch = darkvisionScenarioControls.applyControl({
      controlId: 'resolve-fire-bolt',
      value: true,
      snapshot,
    });

    expect(patch.abilityExecution).toMatchObject({
      casterId: DARKVISION_WIZARD_ID,
      targetId: DARKVISION_TARGET_ID,
      ability: DARKVISION_TEST_FIRE_BOLT,
    });
    expect(patch.abilityExecution?.attackRollRng?.()).toBeCloseTo(0.575);
    expect(patch.abilityExecution?.damageRng?.()).toBe(0.5);
    expect(patch.characters).toBeUndefined();
    expect(findCharacter(snapshot, DARKVISION_WIZARD_ID).actionEconomy.action)
      .toEqual({ used: false, remaining: 1 });

    const resetActionPatch = darkvisionScenarioControls.applyControl({
      controlId: 'resolve-fire-bolt',
      value: false,
      snapshot,
    });
    expect(resetActionPatch.abilityExecution).toBeUndefined();
  });

  it('keeps invalid, unknown, and missing-actor events as explicit no-ops', () => {
    const snapshot = createSnapshot();
    const invalid = darkvisionScenarioControls.applyControl({
      controlId: 'observer-sense-mode',
      value: 'truesight_unlimited',
      snapshot,
    });
    const unknown = darkvisionScenarioControls.applyControl({
      controlId: 'stale-control',
      value: true,
      snapshot,
    });
    const missing = darkvisionScenarioControls.applyControl({
      controlId: 'observer-sense-mode',
      value: 'darkvision_60',
      snapshot: {
        ...snapshot,
        characters: snapshot.characters.filter(character => character.id !== DARKVISION_WIZARD_ID),
      },
    });

    expect(invalid.characters).toBeUndefined();
    expect(invalid.logMessage).toContain('not supported');
    expect(unknown.characters).toBeUndefined();
    expect(unknown.logMessage).toContain('Unknown Darkvision control');
    expect(missing.characters).toBeUndefined();
    expect(missing.logMessage).toContain('Human Wizard is not on this map');
    expect(findCharacter(snapshot, DARKVISION_WIZARD_ID).stats.senses?.darkvision).toBe(0);
  });

  it('pins the wizard as first turn while preserving stable authored order', () => {
    const snapshot = createSnapshot();
    expect([...snapshot.characters]
      .sort((left, right) => getDarkvisionInitiativeTotal(right) - getDarkvisionInitiativeTotal(left))
      .map(character => character.id))
      .toEqual([DARKVISION_WIZARD_ID, DARKVISION_TARGET_ID, 'elf-cleric', 'blind-dweller']);
  });
});
