
/**
 * @file src/hooks/useGameInitialization.ts
 * Custom hook for managing game initialization, new game setup, and loading games.
 */
import React, { useCallback } from 'react';
import { GameState, GamePhase, PlayerCharacter, MapData, Location, Item, StartGameSuccessPayload } from '../types';
import { AppAction } from '../state/actionTypes';
import { STARTING_LOCATION_ID, LOCATIONS, BIOMES } from '../constants';
import { getDummyParty } from '../data/dev/dummyCharacter';
import { MAP_GRID_SIZE, SUBMAP_DIMENSIONS } from '../config/mapConfig';
import { generateMap } from '../services/mapService';
import * as SaveLoadService from '../services/saveLoadService';
import * as GeminiService from '../services/geminiService';
import { determineActiveDynamicNpcsForLocation } from '../utils/locationUtils';
import { SeededRandom } from '../utils/seededRandom';

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
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Generating adventurous names..." } });

    const newWorldSeed = new SeededRandom(Date.now()).next() * 1000000;
    const dummyParty = getDummyParty();
    const baseFighter = dummyParty.find(c => c.class.id === 'fighter');
    const baseCleric = dummyParty.find(c => c.class.id === 'cleric');

    if (!baseFighter || !baseCleric) {
        dispatch({ type: 'SET_ERROR', payload: "Dummy character data is missing." });
        return;
    }

    try {
        const [fighterNameResult, clericNameResult] = await Promise.all([
            GeminiService.generateCharacterName(baseFighter.race.name, baseFighter.class.name, 'Male', 'Dragonlance', null),
            GeminiService.generateCharacterName(baseCleric.race.name, baseCleric.class.name, 'Female', 'Forgotten Realms', null)
        ]);
        
        if (fighterNameResult.data?.rateLimitHit || clericNameResult.data?.rateLimitHit) {
            dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
        }

        const fighterName = fighterNameResult.data?.name || "Valerius";
        const clericName = clericNameResult.data?.name || "Helga Stonebraid";
        
        const generatedParty = dummyParty.map(p => {
            if (p.class.id === 'fighter') return { ...p, name: fighterName };
            if (p.class.id === 'cleric') return { ...p, name: clericName };
            return p;
        });
        
        const initialDynamicItems: Record<string, string[]> = {};
        Object.values(LOCATIONS).forEach(loc => {
            initialDynamicItems[loc.id] = loc.itemIds ? [...loc.itemIds] : [];
        });
        const newMapData = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES, newWorldSeed);
        dispatch({ type: 'START_GAME_FOR_DUMMY', payload: { mapData: newMapData, dynamicLocationItemIds: initialDynamicItems, generatedParty, worldSeed: newWorldSeed }});

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to generate character names:", error);
        dispatch({ type: 'SET_ERROR', payload: `Failed to generate character names: ${errorMessage}` });
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
