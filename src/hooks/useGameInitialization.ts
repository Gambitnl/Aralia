// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 02:40:30
 * Dependents: App.tsx
 * Imports: 11 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/useGameInitialization.ts
 * Central hook for all game-start flows. Provides callbacks for:
 *  - handleNewGame:                Opens the character creator wizard for a fresh game.
 *  - handleSkipCharacterCreator:   Dev/quick-start that auto-generates a full party and jumps straight into gameplay.
 *  - handleLoadGameFlow:           Loads a saved game from local storage.
 *  - startGame:                    Finalizes a player-created character and boots into the world.
 *  - initializeDummyPlayerState:   Sets up world state without a character (used for UI/design previews).
 *
 * Each flow assembles the required world data (map, dynamic items, NPC placement)
 * and dispatches the appropriate action to the game state reducer.
 *
 * IMPORTANT: Inline comments in this file should NOT be removed.
 * If the code they describe is modified, update the comment with a new date/time
 * and an explanation of what changed.
 *
 * @updated 2026-02-09 23:37
 */

// -- Imports --
// React core: useCallback memoizes the callbacks so they don't re-create on every render.
import React, { useCallback } from 'react';
// Game types used across this hook for typing characters, maps, items, and payloads.
import { GamePhase, PlayerCharacter, MapData, Item, StartGameSuccessPayload } from '../types';
// Union type of all actions the game state reducer can handle.
import { AppAction } from '../state/actionTypes';
// Static game world data: the spawn location ID, all location definitions, and biome definitions.
import { STARTING_LOCATION_ID, LOCATIONS, BIOMES } from '../constants';
// Pre-built dummy party used by the legacy dummy start path (not the quick-start).
import { getDummyParty } from '../data/dev/dummyCharacter';
// Grid dimensions for the world map and the sub-map (local tile grid within a location).
import { MAP_GRID_SIZE, SUBMAP_DIMENSIONS } from '../config/mapConfig';
// Procedural map generator that produces the world grid from locations, biomes, and a seed.
import { generateMap } from '../services/mapService';
// Save/load service for persisting and restoring game state from local storage.
import * as SaveLoadService from '../services/saveLoadService';
// Utility that determines which dynamic NPCs should be active at a given location.
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';
import { generateWorldSeed } from '../utils/random/generateWorldSeed';
// Generates a full companion character (stats + AI-driven backstory) from a race/class config.
import { generateCompanion } from '../services/CompanionGenerator';
import { generateId } from '../utils/core/idGenerator';

// Shorthand type for the chat message function passed in from the parent component.
// Accepts message text and an optional sender tag for styling in the chat log.
type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;

// Props interface for the hook. All three are provided by the consuming component (App.tsx).
//  - dispatch:       Sends actions to the game state reducer.
//  - addMessage:     Appends a message to the in-game chat/log.
//  - currentMapData: The map generated during character creation (if any), so we don't regenerate it.
interface UseGameInitializationProps {
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  currentMapData: MapData | null;
  worldSeed: number;
}

export function useGameInitialization({
  dispatch,
  addMessage,
  currentMapData,
  worldSeed: currentWorldSeed,
}: UseGameInitializationProps) {

  // ── handleNewGame ──────────────────────────────────────────────────────
  // Triggered when the player clicks "New Game" from the main menu.
  // Generates a fresh world seed, snapshots each location's starting items,
  // builds the procedural map, and dispatches to transition into the character creator.
  const handleNewGame = useCallback(() => {
    // Each new game gets a fresh seed (time + entropy) so the world changes per run.
    const newWorldSeed = generateWorldSeed();

    // Snapshot each location's default item list so items can be added/removed
    // at runtime without mutating the static LOCATIONS data.
    const initialDynamicItems: Record<string, string[]> = {};
    Object.values(LOCATIONS).forEach(loc => {
      initialDynamicItems[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
    });

    // Generate the world map grid using the seed for reproducibility.
    const newMapData = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, newWorldSeed);

    // Dispatch transitions the game phase to the character creator,
    // passing along the pre-built map and item snapshot so they're ready when the player finishes.
    dispatch({ type: 'START_NEW_GAME_SETUP', payload: { mapData: newMapData, dynamicLocationItemIds: initialDynamicItems, worldSeed: newWorldSeed } });
  }, [dispatch]);

  // ── handleSkipCharacterCreator ─────────────────────────────────────────
  // Dev/quick-start flow. Bypasses the character creation wizard entirely
  // and generates a pre-configured "Classic Party" (Fighter, Cleric, Rogue).
  // Each party member gets full mechanical stats AND an AI-generated backstory
  // via the CompanionGenerator pipeline (skeleton + soul).
  const handleSkipCharacterCreator = useCallback(async () => {
    // Show a loading overlay while the async generation runs.
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Generating party with full backstories..." } });

    // World seed for this quick-start session.
    const newWorldSeed = generateWorldSeed();

    // Party blueprint: each entry maps to a CompanionSkeletonConfig.
    // Race IDs must match entries in ALL_RACES_DATA (e.g. 'hill_dwarf', not 'dwarf').
    // Class IDs must match entries in CLASSES_DATA.
    const partyConfigs = [
      { level: 1, classId: 'fighter', raceId: 'human', gender: 'male' as const },
      { level: 1, classId: 'cleric', raceId: 'hill_dwarf', gender: 'female' as const },
      { level: 1, classId: 'rogue', raceId: 'tiefling', gender: 'male' as const },
    ];

    try {
      const generatedParty: PlayerCharacter[] = [];

      // Generate each companion sequentially (Ollama calls are async and resource-heavy).
      for (const config of partyConfigs) {
        const companion = await generateCompanion(config);
        if (companion) {
          // The first successfully generated member is designated as the player character.
          // All subsequent members become AI-controlled party companions.
          if (generatedParty.length === 0) {
            companion.id = 'player';
          } else {
            // Ensure non-player companions have a unique ID (generateCompanion usually provides one).
            companion.id = companion.id || generateId();
          }
          generatedParty.push(companion);
        }
      }

      // All members must generate successfully; a partial party is not playable.
      if (generatedParty.length !== partyConfigs.length) {
        throw new Error(`Failed to generate all party members. Generated ${generatedParty.length}/${partyConfigs.length}.`);
      }

      // Build the same world data as handleNewGame: item snapshots + procedural map.
      const initialDynamicItems: Record<string, string[]> = {};
      Object.values(LOCATIONS).forEach(loc => {
        initialDynamicItems[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
      });
      const newMapData = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, newWorldSeed);

      // Dispatch jumps straight into gameplay, skipping the character creator entirely.
      dispatch({ type: 'START_GAME_FOR_DUMMY', payload: { mapData: newMapData, dynamicLocationItemIds: initialDynamicItems, generatedParty, worldSeed: newWorldSeed } });

    } catch (error) {
      // Surface the error to both the console and the UI error state.
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to generate party:", error);
      dispatch({ type: 'SET_ERROR', payload: `Failed to generate party: ${errorMessage}` });
    } finally {
      // Always clear the loading overlay, whether generation succeeded or failed.
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch]);

  // ── handleLoadGameFlow ─────────────────────────────────────────────────
  // Triggered when the player clicks "Load Game" from the main menu.
  // Reads saved state from local storage and either restores the full game
  // or falls back to the main menu with an error notification.
  const handleLoadGameFlow = useCallback(async () => {
    // Show loading overlay while the save file is read and parsed.
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });

    // Attempt to load the saved game data from local storage.
    const result = await SaveLoadService.loadGame();

    if (result.success && result.data) {
      // Restore the entire game state from the save file.
      dispatch({ type: 'LOAD_GAME_SUCCESS', payload: result.data });
      // Confirm success in both the chat log and a toast notification.
      addMessage("Game loaded successfully.", "system");
      dispatch({ type: 'ADD_NOTIFICATION', payload: { type: 'success', message: result.message || "Game loaded successfully." } });
    } else {
      // Load failed: notify the player and return them to the main menu.
      addMessage(result.message || "Failed to load game.", "system");
      dispatch({ type: 'ADD_NOTIFICATION', payload: { type: 'error', message: result.message || "Failed to load game." } });
      dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
    }

    // Clear the loading overlay.
    dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
  }, [addMessage, dispatch]);

  // ── startGame ──────────────────────────────────────────────────────────
  // Called after the player finishes the character creation wizard.
  // Takes the fully built character, their chosen starting inventory,
  // and the world seed, then assembles all the data needed to boot into gameplay.
  const startGame = useCallback(
    async (character: PlayerCharacter, startingInventory: Item[], worldSeed: number) => {
      // Look up the starting location (e.g. the town square) for its description text.
      const initialLocation = LOCATIONS[STARTING_LOCATION_ID];

      // Snapshot dynamic items for every location.
      const initialDynamicItems: Record<string, string[]> = {};
      Object.values(LOCATIONS).forEach(loc => {
        initialDynamicItems[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
      });

      // Re-use the map from character creation if it was already generated,
      // otherwise generate a new one (e.g. if the flow skipped map pre-generation).
      const mapDataToUse = currentMapData || generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, worldSeed);

      // Place the player at the center of the starting location's sub-map grid.
      const initialSubMapCoords = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };

      // Determine which dynamic NPCs should be present at the starting location.
      const initialActiveDynamicNpcs = determineActiveDynamicNpcsForLocation(STARTING_LOCATION_ID, LOCATIONS);

      // Bundle everything into the payload the reducer expects.
      const payload: StartGameSuccessPayload = {
        character,
        startingInventory,
        mapData: mapDataToUse,
        dynamicLocationItemIds: initialDynamicItems,
        initialLocationDescription: initialLocation.baseDescription,
        initialSubMapCoordinates: initialSubMapCoords,
        initialActiveDynamicNpcIds: initialActiveDynamicNpcs,
      };

      // Dispatch transitions the game phase from character creation into active gameplay.
      dispatch({
        type: 'START_GAME_SUCCESS',
        payload: payload
      });
    },
    [currentMapData, dispatch],
  );

  // ── initializeDummyPlayerState ─────────────────────────────────────────
  // Sets up a fully functional world WITHOUT a real player character.
  // Used for UI/design preview screens (e.g. the DesignPreview page)
  // where you need a map, locations, and NPCs rendered but no actual player.
  const initializeDummyPlayerState = useCallback(() => {
    // Look up the starting location for its description.
    const initialLocation = LOCATIONS[STARTING_LOCATION_ID];

    // Keep world generation and procedural systems aligned. If we already have a map,
    // re-use its seed; otherwise generate a throwaway seed for previews.
    const worldSeed = currentMapData ? currentWorldSeed : generateWorldSeed();

    // Re-use existing map data if available, otherwise generate a throwaway one.
    const mapToUse = currentMapData || generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, worldSeed);

    // Center the viewport on the sub-map.
    const initialSubMapCoords = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };

    // Determine active NPCs at the starting location.
    const initialActiveDynamicNpcs = determineActiveDynamicNpcsForLocation(STARTING_LOCATION_ID, LOCATIONS);

    // Snapshot dynamic items.
    const dynamicItemsToUse: Record<string, string[]> = {};
    Object.values(LOCATIONS).forEach(loc => {
      dynamicItemsToUse[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
    });

    // Dispatch sets up the world state for preview mode (no player character attached).
    dispatch({
      type: 'INITIALIZE_DUMMY_PLAYER_STATE',
      payload: {
        worldSeed,
        mapData: mapToUse,
        dynamicLocationItemIds: dynamicItemsToUse,
        initialLocationDescription: initialLocation.baseDescription,
        initialSubMapCoordinates: initialSubMapCoords,
        initialActiveDynamicNpcIds: initialActiveDynamicNpcs,
      }
    });
  }, [currentMapData, currentWorldSeed, dispatch]);

  // Expose all five flows to the consuming component.
  return {
    handleNewGame,
    handleSkipCharacterCreator,
    handleLoadGameFlow,
    startGame,
    initializeDummyPlayerState,
  };
}
