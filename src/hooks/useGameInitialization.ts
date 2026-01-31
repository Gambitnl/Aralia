
/**
 * @file src/hooks/useGameInitialization.ts
 * Custom hook for managing game initialization, new game setup, and loading games.
 */
import React, { useCallback } from 'react';
// TODO(lint-intent): 'GameState' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState as _GameState, GamePhase, PlayerCharacter, MapData, Location as _Location, Item, StartGameSuccessPayload } from '../types';
import { AppAction } from '../state/actionTypes';
import { STARTING_LOCATION_ID, LOCATIONS, BIOMES } from '../constants';
import { getDummyParty } from '../data/dev/dummyCharacter';
import { MAP_GRID_SIZE, SUBMAP_DIMENSIONS } from '../config/mapConfig';
import { generateMap } from '../services/mapService';
import * as SaveLoadService from '../services/saveLoadService';
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';
import { SeededRandom } from '@/utils/random';
import { generateCompanion } from '../services/CompanionGenerator';

type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;

interface UseGameInitializationProps {
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  currentMapData: MapData | null;
}

export function useGameInitialization({
  dispatch,
  addMessage,
  currentMapData,
}: UseGameInitializationProps) {

  const handleNewGame = useCallback(() => {
    const newWorldSeed = new SeededRandom(Date.now()).next() * 1000000;
    const initialDynamicItems: Record<string, string[]> = {};
    Object.values(LOCATIONS).forEach(loc => {
      initialDynamicItems[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
    });
    const newMapData = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, newWorldSeed);
    dispatch({ type: 'START_NEW_GAME_SETUP', payload: { mapData: newMapData, dynamicLocationItemIds: initialDynamicItems, worldSeed: newWorldSeed } });
  }, [dispatch]);

  const handleSkipCharacterCreator = useCallback(async () => {
    // RALPH: Dev/Fast-Start Flow.
    // bypasses the UI wizard to generate a predefined "Classic Party" (Fighter, Cleric, Rogue).
    // Uses `generateCompanion` to hydrate them with full stats/backstory as if they were real companions.
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Generating party with full backstories..." } });

    const newWorldSeed = new SeededRandom(Date.now()).next() * 1000000;

    // Define party composition - each member will get full NPC-style details
    const partyConfigs = [
      { level: 1, classId: 'fighter', raceId: 'human', gender: 'male' as const },
      { level: 1, classId: 'cleric', raceId: 'dwarf', gender: 'female' as const },
      { level: 1, classId: 'rogue', raceId: 'tiefling', gender: 'male' as const },
    ];

    try {
      const generatedParty: PlayerCharacter[] = [];

      for (const config of partyConfigs) {
        const companion = await generateCompanion(config);
        if (companion) {
          // Mark the first member as the player
          // RALPH: The first generated NPC becomes the "Main Character" (Player ID).
          if (generatedParty.length === 0) {
            companion.id = 'player';
          } else {
            companion.id = companion.id || crypto.randomUUID();
          }
          generatedParty.push(companion);
        }
      }

      if (generatedParty.length !== partyConfigs.length) {
        throw new Error(`Failed to generate all party members. Generated ${generatedParty.length}/${partyConfigs.length}.`);
      }

      const initialDynamicItems: Record<string, string[]> = {};
      Object.values(LOCATIONS).forEach(loc => {
        initialDynamicItems[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
      });
      const newMapData = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, newWorldSeed);
      dispatch({ type: 'START_GAME_FOR_DUMMY', payload: { mapData: newMapData, dynamicLocationItemIds: initialDynamicItems, generatedParty, worldSeed: newWorldSeed } });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to generate party:", error);
      dispatch({ type: 'SET_ERROR', payload: `Failed to generate party: ${errorMessage}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch]);

  const handleLoadGameFlow = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
    const result = await SaveLoadService.loadGame();
    if (result.success && result.data) {
      dispatch({ type: 'LOAD_GAME_SUCCESS', payload: result.data });
      addMessage("Game loaded successfully.", "system");
      dispatch({ type: 'ADD_NOTIFICATION', payload: { type: 'success', message: result.message || "Game loaded successfully." } });
    } else {
      addMessage(result.message || "Failed to load game.", "system");
      dispatch({ type: 'ADD_NOTIFICATION', payload: { type: 'error', message: result.message || "Failed to load game." } });
      dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
    }
    dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
  }, [addMessage, dispatch]);

  const startGame = useCallback(
    async (character: PlayerCharacter, startingInventory: Item[], worldSeed: number) => {
      const initialLocation = LOCATIONS[STARTING_LOCATION_ID];
      const initialDynamicItems: Record<string, string[]> = {};
      Object.values(LOCATIONS).forEach(loc => {
        initialDynamicItems[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
      });
      const mapDataToUse = currentMapData || generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, worldSeed);
      const initialSubMapCoords = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };
      const initialActiveDynamicNpcs = determineActiveDynamicNpcsForLocation(STARTING_LOCATION_ID, LOCATIONS);

      const payload: StartGameSuccessPayload = {
        character,
        startingInventory,
        mapData: mapDataToUse,
        dynamicLocationItemIds: initialDynamicItems,
        initialLocationDescription: initialLocation.baseDescription,
        initialSubMapCoordinates: initialSubMapCoords,
        initialActiveDynamicNpcIds: initialActiveDynamicNpcs,
      };

      dispatch({
        type: 'START_GAME_SUCCESS',
        payload: payload
      });
    },
    [currentMapData, dispatch],
  );

  const initializeDummyPlayerState = useCallback(() => {
    const initialLocation = LOCATIONS[STARTING_LOCATION_ID];
    const worldSeed = Date.now(); // Generate a seed for the dummy start
    const mapToUse = currentMapData || generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, worldSeed);
    const initialSubMapCoords = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };
    const initialActiveDynamicNpcs = determineActiveDynamicNpcsForLocation(STARTING_LOCATION_ID, LOCATIONS);

    const dynamicItemsToUse: Record<string, string[]> = {};
    Object.values(LOCATIONS).forEach(loc => {
      dynamicItemsToUse[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
    });
    dispatch({
      type: 'INITIALIZE_DUMMY_PLAYER_STATE',
      payload: {
        mapData: mapToUse,
        dynamicLocationItemIds: dynamicItemsToUse,
        initialLocationDescription: initialLocation.baseDescription,
        initialSubMapCoordinates: initialSubMapCoords,
        initialActiveDynamicNpcIds: initialActiveDynamicNpcs,
      }
    });
  }, [currentMapData, dispatch]);

  return {
    handleNewGame,
    handleSkipCharacterCreator,
    handleLoadGameFlow,
    startGame,
    initializeDummyPlayerState,
  };
}
