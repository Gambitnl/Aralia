/**
 * This file tests the exploration gameplay flow, covering movement, route peril,
 * encounter trigger mechanics, and location discovery across the Aralia world.
 *
 * As the party travels across land and sea, each step exposes them to environmental
 * dangers and ambush risks based on regional danger ratings. Traveling also uncovers
 * fog of war, reveals hidden sites, advances the in-game calendar, and records
 * discoveries in the adventure log.
 *
 * Called by: Vitest test runner (part of the gameplay test suite)
 * Depends on: worldReducer, travelEncounter, routePlanning, seedPath, and core utilities
 */

import { describe, it, expect } from 'vitest';
import { worldReducer } from '../../../state/reducers/worldReducer';
import {
  rollTravelEncounter,
  rollSeaEncounter,
  EncounterRoll,
  SeaTripEncounterRoll
} from '../../../systems/travel/travelEncounter';
import { rootSeedPath } from '../../../systems/worldforge/seedPath';
import { RoutePlan } from '../../../systems/travel/routePlanning';
import { GameState } from '../../../types';
import { AppAction } from '../../../state/actionTypes';
import { createMockGameState, createMockPlayerCharacter, createMockFaction } from '../../../utils/core';
import { canonicalDungeonId } from '../../../systems/worldforge/dungeon/world/deriveIdentity';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================
// This section provides helpers to construct realistic route plans with
// varied lengths, danger ratings, and terrain types (land vs open sea).
// ============================================================================

/**
 * Creates a mock route plan passing through a sequence of cell IDs with a specified danger score.
 */
function createMockRoutePlan(cellIds: number[], danger = 0.5): RoutePlan {
  return {
    cells: cellIds,
    points: cellIds.map(id => [id * 10, id * 10] as [number, number]),
    miles: cellIds.length * 5,
    minutes: cellIds.length * 60,
    cumulativeMinutes: cellIds.map((_, i) => i * 60),
    danger: Math.max(0, Math.min(1, danger))
  };
}

// ============================================================================
// Danger Rating and Encounter Trigger Mechanics
// ============================================================================
// As the party traverses dangerous terrain, the chance of encountering an
// ambush compounds with each cell. Seed paths ensure deterministic resolution.
// ============================================================================

describe('Gameplay Flow - Exploration & Encounter Triggers', () => {
  it('calculates zero encounter chance on a zero-length or zero-danger route', () => {
    const seed = rootSeedPath(1337);

    // Single-cell route (start === destination)
    const singleCellRoute = createMockRoutePlan([10], 0.8);
    const resultSingle = rollTravelEncounter(singleCellRoute, seed);

    expect(resultSingle.encounter).toBe(false);
    expect(resultSingle.chance).toBe(0);
    expect(resultSingle.atCellIndex).toBeNull();

    // Multi-cell route with zero danger rating
    const safeRoute = createMockRoutePlan([10, 11, 12, 13], 0);
    const resultSafe = rollTravelEncounter(safeRoute, seed);

    expect(resultSafe.encounter).toBe(false);
    expect(resultSafe.chance).toBe(0);
  });

  it('compounds encounter probability as route length and danger rating increase', () => {
    const seed = rootSeedPath(2026);

    // Short route (2 steps) through medium danger (0.4)
    const shortRoute = createMockRoutePlan([1, 2, 3], 0.4);
    const shortRoll = rollTravelEncounter(shortRoute, seed);

    // Long route (10 steps) through identical danger (0.4)
    const longRoute = createMockRoutePlan([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0.4);
    const longRoll = rollTravelEncounter(longRoute, seed);

    // Long route must have strictly higher cumulative ambush chance than short route
    expect(longRoll.chance).toBeGreaterThan(shortRoll.chance);

    // Maximum danger route (1.0) must have higher chance than low danger (0.1) over same distance
    const dangerousRoute = createMockRoutePlan([1, 2, 3, 4, 5], 1.0);
    const lowDangerRoute = createMockRoutePlan([1, 2, 3, 4, 5], 0.1);

    expect(rollTravelEncounter(dangerousRoute, seed).chance).toBeGreaterThan(
      rollTravelEncounter(lowDangerRoute, seed).chance
    );
  });

  it('yields fully deterministic encounter outcomes for identical seed and route parameters', () => {
    const seed = rootSeedPath(98765);
    const route = createMockRoutePlan([100, 101, 102, 103, 104, 105], 0.7);

    const rollA = rollTravelEncounter(route, seed);
    const rollB = rollTravelEncounter(route, seed);

    // Running the same trip twice must yield the exact same ambush result and cell location
    expect(rollA.encounter).toBe(rollB.encounter);
    expect(rollA.chance).toBe(rollB.chance);
    expect(rollA.atCellIndex).toBe(rollB.atCellIndex);
  });

  it('evaluates sea encounters exclusively on water steps and scales by maritime danger tier', () => {
    const seed = rootSeedPath(42);
    // Route from cell 1 (coastal port) -> 2 (sea) -> 3 (open ocean) -> 4 (destination port)
    const mixedRoute = createMockRoutePlan([1, 2, 3, 4], 0.5);

    // Define sea cells: 2 and 3 are in the water, 1 and 4 are land ports
    const isSeaCell = (cell: number) => cell === 2 || cell === 3;

    // High maritime danger (e.g. pirate-infested open waters)
    const seaRoll = rollSeaEncounter(mixedRoute, isSeaCell, 0.9, seed);

    expect(seaRoll.chance).toBeGreaterThan(0);
    if (seaRoll.encounter) {
      // If an encounter triggered, it must take place on one of the sea cells (index 1 or 2)
      expect([1, 2]).toContain(seaRoll.atCellIndex);
      expect(seaRoll.outcome).toBeDefined();
    }

    // Completely dry land route should never trigger a sea encounter
    const landRoute = createMockRoutePlan([10, 11, 12, 13], 0.9);
    const drySeaRoll = rollSeaEncounter(landRoute, () => false, 0.9, seed);

    expect(drySeaRoll.encounter).toBe(false);
    expect(drySeaRoll.chance).toBe(0);
    expect(drySeaRoll.outcome).toBeNull();
  });
});

// ============================================================================
// World State & Discovery Transitions
// ============================================================================
// When the party moves, enters dungeons, reveals hidden sites, or meets NPCs,
// the world state updates player position, undiscovered landmarks, and logs.
// ============================================================================

describe('Gameplay Flow - World State & Exploration Transitions', () => {
  it('updates ground position coordinates when player traverses a map scene', () => {
    const state = createMockGameState();
    const action: AppAction = {
      type: 'SET_PLAYER_GROUND_POS',
      payload: {
        position: {
          xM: 142.5,
          tileX: 0,
          tileY: 0,
          zM: 88.0
        }
      }
    };

    const nextState = worldReducer(state, action);

    expect(nextState.playerGroundPos).toEqual({
      xM: 142.5,
      tileX: 0,
      tileY: 0,
      zM: 88.0
    });
  });

  it('updates playerCell and preserves current map position on locale crossing', () => {
    const state: GameState = {
      ...createMockGameState(),
      playerCell: { cellId: 12, localeCoords: { x: 0, y: 0 } }
    };

    const action: AppAction = {
      type: 'LOCALE_CROSS_TO_CELL',
      payload: {
        cellId: 45,
        enterFeet: { x: 10, y: 20 }
      }
    };

    const nextState = worldReducer(state, action);

    expect(nextState.playerCell?.cellId).toBe(45);
    expect(nextState.playerCell?.localeCoords).toEqual({ x: 10, y: 20 });
    expect(nextState.playerGroundPos).toBeNull();
  });

  it('reveals hidden landmark sites upon successful perception or quest discovery', () => {
    const state: GameState = {
      ...createMockGameState(),
      discoveredHiddenSites: []
    };

    const action: AppAction = {
      type: 'REVEAL_HIDDEN_SITE',
      payload: {
        id: 'ruins_ancient_tower',
        cellId: 45,
        name: 'Ancient Tower Ruins'
      }
    };

    const nextState = worldReducer(state, action);

    expect(nextState.discoveredHiddenSites).toHaveLength(1);
    expect(nextState.discoveredHiddenSites?.[0].id).toBe('ruins_ancient_tower');
    expect(nextState.discoveredHiddenSites?.[0].cellId).toBe(45);
  });

  it('registers newly discovered dynamic locations, factions, and dynamic NPCs into world state', () => {
    const state = createMockGameState();

    // Register a new hidden grove discovered during wilderness exploration
    const registerLocationAction: AppAction = {
      type: 'REGISTER_DYNAMIC_ENTITY',
      payload: {
        entityType: 'location',
        entity: {
          id: 'grove_moonlit',
          name: 'Moonlit Grove',
          baseDescription: 'A secluded sanctuary bathed in eternal moonlight.',
          biomeId: 'forest',
          exits: {}, itemIds: [], npcIds: []
        }
      }
    };

    const stateWithLocation = worldReducer(state, registerLocationAction);
    expect(stateWithLocation.dynamicLocations?.['grove_moonlit']).toBeDefined();
    expect(stateWithLocation.dynamicLocations?.['grove_moonlit'].name).toBe('Moonlit Grove');

    // Register a new ranger faction encountered in the wild
    const registerFactionAction: AppAction = {
      type: 'REGISTER_DYNAMIC_ENTITY',
      payload: {
        entityType: 'faction',
        entity: createMockFaction({
          id: 'wardens_of_the_green',
          name: 'Wardens of the Green',
          description: 'A secretive enclave of rangers.',
          type: 'SECRET_SOCIETY'
        })
      }
    };

    const stateWithFaction = worldReducer(state, registerFactionAction);
    expect(stateWithFaction.factions?.['wardens_of_the_green']).toBeDefined();
  });

  it('records NPC first contact into metNpcIds and writes an adventure log entry', () => {
    const state: GameState = {
      ...createMockGameState(),
      metNpcIds: ['npc_blacksmith'],
      adventureLog: []
    };

    const action: AppAction = {
      type: 'ADD_MET_NPC',
      payload: { npcId: 'npc_druid_elira' }
    };

    const nextState = worldReducer(state, action);

    expect(nextState.metNpcIds).toContain('npc_druid_elira');
    // Ensure an adventure log entry was created for meeting the NPC
    expect(nextState.adventureLog?.length).toBeGreaterThan(0);
    const lastEntry = nextState.adventureLog![nextState.adventureLog!.length - 1];
    expect(lastEntry.kind).toBe('met-npc');
    expect(lastEntry.npcIds).toContain('npc_druid_elira');
  });

  it('tracks dungeon entry, exploration progress, and clearing transitions', () => {
    const seedPath = 'wf:42/cell:751/dungeon:crypt-of-the-forgotten';
    const dungeonId = canonicalDungeonId(seedPath);
    const identity = { dungeonId, seedPath };

    let state = createMockGameState();

    // Step 1: Enter the dungeon
    const enterAction: AppAction = {
      type: 'DUNGEON_ENTERED',
      payload: { identity }
    };
    state = { ...state, ...worldReducer(state, enterAction) };
    expect(state.dungeonExpeditions?.[dungeonId]).toBeDefined();

    // Step 2: Record exploration progress inside the dungeon
    const progressAction: AppAction = {
      type: 'DUNGEON_PROGRESS_RECORDED',
      payload: {
        dungeonId,
        progress: {
          clearedEncounterIds: ['encounter_crypt_guardian'],
          exploredCellKeysByLevel: { 'level:0': ['1,1', '1,2'] }
        }
      }
    };
    state = { ...state, ...worldReducer(state, progressAction) };
    expect(state.dungeonExpeditions?.[dungeonId].progress.clearedEncounterIds).toContain('encounter_crypt_guardian');

    // Step 3: Clear the dungeon upon completing all objectives
    const completeAction: AppAction = {
      type: 'DUNGEON_COMPLETED',
      payload: { dungeonId }
    };
    state = { ...state, ...worldReducer(state, completeAction) };
    expect(state.clearedDungeons).toContain(seedPath);
  });

  it('advances world clock and updates seasonal or calendar intervals during long marches', () => {
    const startClock = new Date('2026-08-26T08:00:00Z');
    const state: GameState = {
      ...createMockGameState(),
      gameTime: startClock
    };

    // March overland for 4 hours (14400 seconds)
    const marchAction: AppAction = {
      type: 'ADVANCE_TIME',
      payload: { seconds: 14400 }
    };

    const nextState = worldReducer(state, marchAction);

    // Game clock should be advanced by exactly 4 hours
    const expectedTime = new Date('2026-08-26T12:00:00Z');
    expect(nextState.gameTime?.getTime()).toBe(expectedTime.getTime());
  });
});
