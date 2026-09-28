/**
 * This file proves the Teleportation & Occupied Spaces controls stay engine-backed.
 *
 * The fixture mirrors the mounted 16-by-12 board. Assertions cover the Large
 * source and destination footprints, canonical Misty Step payment, visible cue
 * lights, occupied and blocked far squares, board bounds, sight, range, ignored
 * path cost, opportunity-attack exclusion, reset preparation, and bystanders.
 */

// ============================================================================
// Test Inputs
// ============================================================================
// The suite uses real combat fixtures and the scenario's mounted-board helpers.
// ============================================================================

import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import teleportationOccupiedSpacesScenarioControls, {
  prepareTeleportationOccupiedSpacesCharacters,
  prepareTeleportationOccupiedSpacesMapData,
  TELEPORTATION_BLOCKED_FOOTPRINT_TILE,
  TELEPORTATION_BOUNDARY_START,
  TELEPORTATION_CASTER_ID,
  TELEPORTATION_CASTER_START,
  TELEPORTATION_LEGAL_DESTINATION,
  TELEPORTATION_OCCUPIED_DESTINATION,
  TELEPORTATION_OUT_OF_BOUNDS_DESTINATION,
  TELEPORTATION_PATH_OBSTACLE_TILE,
  TELEPORTATION_SIGHT_BLOCKER_TILE,
  TELEPORTATION_WARDEN_ID,
  TELEPORTATION_WARDEN_START,
} from '../teleportationOccupiedSpacesScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Mounted Board Snapshot
// ============================================================================
// Host construction starts with ordinary floor. The scenario-owned initializer
// adds all rule-bearing obstacles and visual lanes so focused and rendered proof
// consume the same authored facts.
// ============================================================================

function createRawMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 5,
        blocksMovement: false,
        blocksLoS: false,
        decoration: null,
        effects: [],
      });
    }
  }
  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 13,
  };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const characters = prepareTeleportationOccupiedSpacesCharacters([
    createMockCombatCharacter({
      id: TELEPORTATION_CASTER_ID,
      name: 'Misty Vanguard',
      position: TELEPORTATION_CASTER_START,
      spellSlots: { level_2: { current: 1, max: 1 } },
    }),
    createMockCombatCharacter({
      id: TELEPORTATION_WARDEN_ID,
      name: 'Space Warden',
      position: TELEPORTATION_WARDEN_START,
      team: 'enemy',
    }),
    createMockCombatCharacter({
      id: 'teleportation-bystander',
      name: 'Unrelated Bystander',
      position: { x: 1, y: 10 },
    }),
  ]);

  return {
    mapData: prepareTeleportationOccupiedSpacesMapData(createRawMap()),
    characters,
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function apply(controlId: string, value: boolean | string = true) {
  return teleportationOccupiedSpacesScenarioControls.applyControl({
    controlId,
    value,
    snapshot: createSnapshot(),
  });
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Teleportation scenario actor ${id}.`);
  return character;
}

// ============================================================================
// Registration, Board Preparation, And Successful Teleport
// ============================================================================
// State and log assertions travel together. The control labels cannot claim a
// success unless position, resources, reactions, lights, and map facts agree.
// ============================================================================

describe('teleportationOccupiedSpacesScenarioControls', () => {
  it('registers two inert actions and one invalid-destination selector', () => {
    expect(teleportationOccupiedSpacesScenarioControls.scenarioId)
      .toBe('teleportation_occupied_spaces');
    expect(teleportationOccupiedSpacesScenarioControls.controls.map(control => control.kind))
      .toEqual(['action', 'action', 'select']);
    expect(teleportationOccupiedSpacesScenarioControls.controls[2].options?.map(option => option.value))
      .toEqual(['blocked', 'out_of_bounds', 'hidden', 'out_of_range']);
  });

  it('prepares the reset actors and every visible rule-bearing map boundary', () => {
    const snapshot = createSnapshot();
    const caster = findCharacter(snapshot.characters, TELEPORTATION_CASTER_ID);
    const warden = findCharacter(snapshot.characters, TELEPORTATION_WARDEN_ID);

    expect(caster.position).toEqual(TELEPORTATION_CASTER_START);
    expect(caster.stats.size).toBe('Large');
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.actionEconomy.movement).toEqual({ used: 0, total: 30 });
    expect(caster.spellSlots?.level_2).toEqual({ current: 1, max: 1 });
    expect(warden.position).toEqual(TELEPORTATION_WARDEN_START);
    expect(warden.actionEconomy.reaction.used).toBe(false);
    expect(snapshot.mapData?.tiles.get('4-3')).toMatchObject({
      terrain: 'mud',
      movementCost: 10,
    });
    expect(snapshot.mapData?.tiles.get(`${TELEPORTATION_PATH_OBSTACLE_TILE.x}-${TELEPORTATION_PATH_OBSTACLE_TILE.y}`))
      .toMatchObject({ blocksMovement: true, blocksLoS: false });
    expect(snapshot.mapData?.tiles.get(`${TELEPORTATION_SIGHT_BLOCKER_TILE.x}-${TELEPORTATION_SIGHT_BLOCKER_TILE.y}`))
      .toMatchObject({ blocksMovement: true, blocksLoS: true });
    expect(snapshot.mapData?.tiles.get(`${TELEPORTATION_BLOCKED_FOOTPRINT_TILE.x}-${TELEPORTATION_BLOCKED_FOOTPRINT_TILE.y}`))
      .toMatchObject({ blocksMovement: true, blocksLoS: false });
  });

  it('teleports to free space, pays cost, and leaves movement and Reaction untouched', () => {
    const result = apply('teleport-free-space');
    const characters = result.characters ?? [];
    const caster = findCharacter(characters, TELEPORTATION_CASTER_ID);
    const warden = findCharacter(characters, TELEPORTATION_WARDEN_ID);

    expect(caster.position).toEqual(TELEPORTATION_LEGAL_DESTINATION);
    expect(caster.actionEconomy.bonusAction.used).toBe(true);
    expect(caster.actionEconomy.movement.used).toBe(0);
    expect(caster.spellSlots?.level_2.current).toBe(0);
    expect(warden.actionEconomy.reaction.used).toBe(false);
    expect(result.activeLightSources?.map(light => light.id)).toEqual([
      'teleportation-source-cue',
      'teleportation-destination-cue',
    ]);
    expect(result.logMessage).toContain('Misty Step SUCCESS');
    expect(result.logMessage).toContain('movement stayed 0/30');
    expect(result.logMessage).toContain('path tiles entered 0');
    expect(result.logMessage).toContain('opportunity attacks triggered 0');
    expect(findCharacter(characters, 'teleportation-bystander').name)
      .toBe('Unrelated Bystander');
  });

  it('rejects the open anchor whose far footprint overlaps the warden', () => {
    const result = apply('teleport-occupied-space');
    const caster = findCharacter(result.characters ?? [], TELEPORTATION_CASTER_ID);

    expect(caster.position).toEqual(TELEPORTATION_CASTER_START);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.spellSlots?.level_2.current).toBe(1);
    expect(result.activeLightSources).toEqual([]);
    expect(result.logMessage).toContain('Misty Step REJECTED before cost or effect');
    expect(result.logMessage).toContain('far 2×2 footprint square');
    expect(result.logMessage).toContain('overlaps Space Warden');
    expect(TELEPORTATION_OCCUPIED_DESTINATION).toEqual({ x: 3, y: 6 });
  });

  it('keeps false action defaults and malformed values state-preserving', () => {
    const snapshot = createSnapshot();
    const inert = teleportationOccupiedSpacesScenarioControls.applyControl({
      controlId: 'teleport-free-space',
      value: false,
      snapshot,
    });
    const malformed = teleportationOccupiedSpacesScenarioControls.applyControl({
      controlId: 'teleport-free-space',
      value: 'true',
      snapshot,
    });

    expect(inert).toEqual({ logMessage: '' });
    expect(malformed.characters).toBeUndefined();
    expect(malformed.logMessage).toContain('requires an action trigger');
  });
});

// ============================================================================
// Invalid Destination Selector
// ============================================================================
// Each option returns a distinct production reason before payment. The boundary
// case deliberately moves the starting footprint near the edge so an otherwise
// in-range anchor can expose full-footprint overflow.
// ============================================================================

describe('teleportationOccupiedSpacesScenarioControls invalid destinations', () => {
  it.each([
    ['blocked', 'blocked at 6,9'],
    ['hidden', 'hidden behind the opaque wall'],
    ['out_of_range', '40 feet away'],
  ])('rejects %s before cost with its exact reason', (choice, expectedReason) => {
    const result = apply('invalid-destination', choice);
    const caster = findCharacter(result.characters ?? [], TELEPORTATION_CASTER_ID);

    expect(caster.position).toEqual(TELEPORTATION_CASTER_START);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.spellSlots?.level_2.current).toBe(1);
    expect(result.logMessage).toContain(expectedReason);
    expect(result.logMessage).toContain('before cost or effect');
  });

  it('rejects an in-range anchor whose Large footprint crosses the board edge', () => {
    const result = apply('invalid-destination', 'out_of_bounds');
    const caster = findCharacter(result.characters ?? [], TELEPORTATION_CASTER_ID);

    expect(caster.position).toEqual(TELEPORTATION_BOUNDARY_START);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.spellSlots?.level_2.current).toBe(1);
    expect(result.logMessage).toContain('Large footprint leaves the battle map');
    expect(result.logMessage).toContain('leaves the battle map at 16,10');
    expect(TELEPORTATION_OUT_OF_BOUNDS_DESTINATION).toEqual({ x: 15, y: 10 });
  });
});
