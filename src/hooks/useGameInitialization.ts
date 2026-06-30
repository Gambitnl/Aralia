// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:33:58
 * Dependents: App.tsx
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL CONTEXT:
 * This hook is the 'bootloader' for the Aralia engine. It handles all entrance 
 * vectors into the game world: New Game, Quick Start (Skip), and Loading Saves.
 *
 * It acts as a bridge between high-level UI intents and the low-level procedural 
 * generation services (map generation, character generation).
 *
 * Called by: App.tsx
 * Use cases: 
 * - Standard flow (New Game -> Character Creator -> Gameplay)
 * - Dev flow (Skip Character Creator -> Direct Gameplay)
 * - Persistence (Load Game)
 */

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
import { GamePhase, PlayerCharacter, Item, StartGameSuccessPayload } from '../types';
// Union type of all actions the game state reducer can handle.
import { AppAction } from '../state/actionTypes';
// Static game world data: the spawn location ID, all location definitions, and biome definitions.
import { STARTING_LOCATION_ID, LOCATIONS } from '../data/world/locations';
import { BIOMES } from '../data/biomes';
// Grid dimensions for the world map and the sub-map (local tile grid within a location).
import { MAP_GRID_SIZE, SUBMAP_DIMENSIONS } from '../config/mapConfig';
// Procedural map generator that produces the world grid from locations, biomes, and a seed.
// WF-derived spawn: place the player where the generated FMG world says, not a hardcoded tile.
import { applyWfSpawnToMap } from '../systems/worldforge/local/resolveSpawn';
import { wfBiomeIndexToLegacyId } from '../systems/worldforge/local/wfBiomeToLegacy';
import { WorldHistoryService } from '../services/WorldHistoryService';
// Save/load service for persisting and restoring game state from local storage.
import * as SaveLoadService from '../services/saveLoadService';
// Utility that determines which dynamic NPCs should be active at a given location.
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';
import { getAllFactions } from '../utils/factionUtils';
import { generateWorldSeed } from '../utils/random/generateWorldSeed';
import { generateId } from '../utils/core/idGenerator';
import { makeCellLocationId } from '../utils/location/cellLocationId';

// Shorthand type for the chat message function passed in from the parent component.
// Accepts message text and an optional sender tag for styling in the chat log.
type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;

// First-build history is attached at bootstrap time so new games and quick starts
// carry the same seeded founding story into the save lifecycle.
function createBootstrapWorldHistory(worldSeed: number) {
  return WorldHistoryService.createFirstBuildHistory({
    worldSeed,
    factions: getAllFactions(worldSeed),
  });
}

// Props interface for the hook. Provided by the consuming component (App.tsx).
//  - dispatch:   Sends actions to the game state reducer.
//  - addMessage: Appends a message to the in-game chat/log.
//  - worldSeed:  The current world seed (the world IS the atlas derived from it;
//                grid retirement removed the pre-generated mapData grid).
interface UseGameInitializationProps {
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  worldSeed: number;
}

export function useGameInitialization({
  dispatch,
  addMessage,
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

    // Grid retirement: no 30x20 mapData grid — the world is the atlas from the
    // seed. Dispatch transitions to the character creator with the seed + item
    // snapshot ready.
    dispatch({ type: 'START_NEW_GAME_SETUP', payload: { dynamicLocationItemIds: initialDynamicItems, worldSeed: newWorldSeed } });
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
      // This dev-only shortcut needs the procedural companion pipeline, but the
      // main menu does not. Dynamic import keeps that heavier AI/character
      // generation path out of the initial page load.
      const { generateCompanion } = await import('../services/CompanionGenerator');
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

      // Item snapshots (grid retirement: no procedural map — world = atlas from seed).
      const initialDynamicItems: Record<string, string[]> = {};
      Object.values(LOCATIONS).forEach(loc => {
        initialDynamicItems[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
      });

      // Dev inventory pulls in the generated item registry, so load it inside
      // this dev-only quick-start path instead of the main reducer startup.
      const { initialInventoryForDummyCharacter } = await import('../data/dev/dummyCharacter');

      // Dispatch jumps straight into gameplay, skipping the character creator entirely.
      dispatch({
        type: 'START_GAME_FOR_DUMMY',
        payload: {
          dynamicLocationItemIds: initialDynamicItems,
          generatedParty,
          worldSeed: newWorldSeed,
          initialInventory: initialInventoryForDummyCharacter,
          worldHistory: createBootstrapWorldHistory(newWorldSeed),
        }
      });

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
  const handleLoadGameFlow = useCallback(async (slotId?: string) => {
    // Show loading overlay while the save file is read and parsed.
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });

    // Attempt to load the saved game data from local storage.
    // WHAT CHANGED: Added optional slotId parameter.
    // WHY IT CHANGED: Previously, the engine always tried to load from the 
    // 'DEFAULT' slot. To support multiple characters and manual saves, the 
    // load flow now specifically targets a slot identifier, allowing the 
    // "Load Game" UI to pass in the selected save index.
    const result = await SaveLoadService.loadGame(slotId);

    if (result.success && result.data) {
      // Restore the entire game state from the save file.
      dispatch({ type: 'LOAD_GAME_SUCCESS', payload: result.data });
      // Confirm success via toast only. Do NOT append to the persistent
      // message log: `messages` is serialized into save slots, so a chat
      // entry here would accumulate one duplicate per load cycle.
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
    async (
      character: PlayerCharacter,
      startingInventory: Item[],
      worldSeed: number,
      // When the player picked a start town (Start Point Selection), spawn there
      // instead of the auto capital/burg. Omitted ⇒ auto spawn (dev skip path).
      // `centerPx` is the burg's atlas/graph pixel position — carried into the
      // entry3DAnchor so 3D entry frames the chosen town (cell-native world).
      startTown?: { atlasCellId: number; name?: string; region?: string; centerPx?: readonly [number, number] },
    ) => {
      // Look up the starting location (e.g. the town square) for its description text.
      const initialLocation = LOCATIONS[STARTING_LOCATION_ID];

      // Snapshot dynamic items for every location.
      const initialDynamicItems: Record<string, string[]> = {};
      Object.values(LOCATIONS).forEach(loc => {
        initialDynamicItems[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
      });

      // WF-derived spawn: pick the FMG world's capital/burg cell (or the chosen
      // start town). Grid retirement: no 30x20 mapData is generated — the world is
      // the atlas (getBridgeAtlas(seed)); the spawn returns a cell + a grid-coord
      // bookkeeping id. The logical location defaults to 'clearing' and is upgraded
      // to the spawn's coord id below. Guarded so a hiccup never bricks new-game boot.
      let spawnLocationId: string = STARTING_LOCATION_ID;

      try {
        const spawn = applyWfSpawnToMap(
          worldSeed,
          { cols: MAP_GRID_SIZE.cols, rows: MAP_GRID_SIZE.rows },
          {
            spawnAtlasCellId: startTown?.atlasCellId,
            spawnBurgName: startTown?.name,
          },
        );

        // Grid retirement: the logical location is the cell-native id of the
        // resolved atlas cell. The canonical position is playerCell (the same cell).
        spawnLocationId = makeCellLocationId(spawn.atlasCellId);
      } catch (err) {
        console.error('[startGame] WF spawn resolution failed; using legacy start tile.', err);
      }

      // Local position within the starting cell (vestigial submap center for now).
      const initialSubMapCoords = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };

      // Determine which dynamic NPCs should be present at the resolved spawn
      // location (coord_ tiles carry none statically; situation NPCs are added
      // afterward via PLACE_SITUATION_NPCS).
      const initialActiveDynamicNpcs = determineActiveDynamicNpcsForLocation(spawnLocationId, LOCATIONS);

      // Bundle everything into the payload the reducer expects.
      const payload: StartGameSuccessPayload = {
        character,
        startingInventory,
        dynamicLocationItemIds: initialDynamicItems,
        initialLocationDescription: initialLocation.baseDescription,
        initialLocationId: spawnLocationId,
        initialSubMapCoordinates: initialSubMapCoords,
        initialActiveDynamicNpcIds: initialActiveDynamicNpcs,
        worldHistory: createBootstrapWorldHistory(worldSeed),
        worldSeed,
        startTownName: startTown?.name,
        startTownRegion: startTown?.region,
        // Cell-native 3D entry anchor: the chosen burg's cell + position, so the
        // first 3D entry frames the town (set atomically with the spawn so the
        // reducer's state rebuild can't clobber it).
        entry3DAnchor: startTown?.centerPx
          ? { cellId: startTown.atlasCellId, centerPx: startTown.centerPx }
          : null,
        // Canonical player presence (cell-native world, Stage 2): the chosen
        // start town's cell when picked (so the source of truth agrees with the
        // entry3DAnchor), else the reducer derives it from the spawn tile. The
        // Locale-local position mirrors the legacy submap center for now.
        playerCell: startTown
          ? { cellId: startTown.atlasCellId, localeCoords: initialSubMapCoords }
          : null,
      };

      // Dispatch transitions the game phase from character creation into active gameplay.
      dispatch({
        type: 'START_GAME_SUCCESS',
        payload: payload
      });

      // GAME-ENTRY-SITUATION (additive, 2026-06-16): a brand-new game does not
      // spawn into the static clearing description — it kicks off generation of a
      // fresh, Ollama-written opening predicament. The entry state machine moves
      // idle → generating; useOpeningSituation (mounted in App) runs the model and
      // drops the player into a live conversation. Load/dummy flows never dispatch
      // this, so resumed saves are untouched.
      dispatch({ type: 'BEGIN_OPENING_SITUATION' });
    },
    [dispatch],
  );

  // ── initializeDummyPlayerState ─────────────────────────────────────────
  // Sets up a fully functional world WITHOUT a real player character.
  // Used for UI/design preview screens (e.g. the DesignPreview page)
  // where you need a map, locations, and NPCs rendered but no actual player.
  const initializeDummyPlayerState = useCallback(async () => {
    // Look up the starting location for its description.
    const initialLocation = LOCATIONS[STARTING_LOCATION_ID];

    // Re-use the current world seed if one is set, else a throwaway preview seed.
    const worldSeed = currentWorldSeed && currentWorldSeed > 0 ? currentWorldSeed : generateWorldSeed();

    // Center the viewport on the sub-map.
    const initialSubMapCoords = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };

    // Determine active NPCs at the starting location.
    const initialActiveDynamicNpcs = determineActiveDynamicNpcsForLocation(STARTING_LOCATION_ID, LOCATIONS);

    // Snapshot dynamic items.
    const dynamicItemsToUse: Record<string, string[]> = {};
    Object.values(LOCATIONS).forEach(loc => {
      dynamicItemsToUse[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
    });

    // Dev inventory pulls in the generated item registry; keep that import
    // scoped to this preview/dev initializer so the main menu remains light.
    const { initialInventoryForDummyCharacter } = await import('../data/dev/dummyCharacter');

    // Dispatch sets up the world state for preview mode (no player character attached).
    dispatch({
      type: 'INITIALIZE_DUMMY_PLAYER_STATE',
      payload: {
        worldSeed,
        dynamicLocationItemIds: dynamicItemsToUse,
        initialLocationDescription: initialLocation.baseDescription,
        initialSubMapCoordinates: initialSubMapCoords,
        initialActiveDynamicNpcIds: initialActiveDynamicNpcs,
        initialInventory: initialInventoryForDummyCharacter,
      }
    });
  }, [currentWorldSeed, dispatch]);

  const handleLegacyDummyAutoStart = useCallback(async () => {
    // Legacy dev auto-start still exists, but the dummy party and its large
    // generated inventory are loaded only when that dev-only path is eligible.
    const { getDummyParty, initialInventoryForDummyCharacter } = await import('../data/dev/dummyCharacter');
    const generatedParty = getDummyParty();
    if (!generatedParty || generatedParty.length === 0) return;

    const dynamicItemsToUse: Record<string, string[]> = {};
    Object.values(LOCATIONS).forEach(loc => {
      dynamicItemsToUse[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
    });

    const worldSeed = currentWorldSeed && currentWorldSeed > 0 ? currentWorldSeed : generateWorldSeed();

    dispatch({
      type: 'START_GAME_FOR_DUMMY',
      payload: {
        dynamicLocationItemIds: dynamicItemsToUse,
        generatedParty,
        worldSeed,
        initialInventory: initialInventoryForDummyCharacter,
        worldHistory: createBootstrapWorldHistory(worldSeed),
      }
    });
  }, [currentWorldSeed, dispatch]);

  // Expose all five flows to the consuming component.
  return {
    handleNewGame,
    handleSkipCharacterCreator,
    handleLoadGameFlow,
    startGame,
    initializeDummyPlayerState,
    handleLegacyDummyAutoStart,
  };
}
