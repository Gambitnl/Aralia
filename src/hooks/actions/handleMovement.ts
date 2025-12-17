
/**
 * @file src/hooks/actions/handleMovement.ts
 * Handles 'move' actions for the game.
 */
import React from 'react';
import { GameState, Action, Location, MapData, PlayerCharacter, GamePhase } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { AddMessageFn, AddGeminiLogFn, LogDiscoveryFn, GetTileTooltipTextFn } from './actionHandlerTypes';
import { LOCATIONS, BIOMES, STARTING_LOCATION_ID } from '../../constants';
import { DIRECTION_VECTORS, SUBMAP_DIMENSIONS } from '../../config/mapConfig';
import { determineActiveDynamicNpcsForLocation } from '../../utils/locationUtils';
import { handleGossipEvent } from './handleWorldEvents';
import { getSubmapTileInfo } from '../../utils/submapUtils';
import { INITIAL_QUESTS } from '../../data/quests';
import { generateTravelEvent } from '../../services/travelEventService';
import { getTimeModifiers } from '../../utils/timeUtils';

interface HandleMovementProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  logDiscovery: LogDiscoveryFn;
  getTileTooltipText: GetTileTooltipTextFn;
  playerContext: string;
  playerCharacter: PlayerCharacter;
}

export async function handleMovement({
  action,
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
  logDiscovery,
  getTileTooltipText,
  playerContext,
  playerCharacter,
}: HandleMovementProps): Promise<void> {
  if (!action.targetId || !gameState.subMapCoordinates || !gameState.mapData) {
    addMessage("Cannot determine movement destination.", "system");
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
    return;
  }

  const directionKey = action.targetId as keyof typeof DIRECTION_VECTORS;

  const currentLocData = LOCATIONS[gameState.currentLocationId];
  const currentLoc = currentLocData || {
    id: gameState.currentLocationId,
    name: 'Wilderness',
    mapCoordinates: {
      x: parseInt(gameState.currentLocationId.split('_')[1], 10),
      y: parseInt(gameState.currentLocationId.split('_')[2], 10),
    },
    biomeId: gameState.mapData.tiles[parseInt(gameState.currentLocationId.split('_')[2], 10)][parseInt(gameState.currentLocationId.split('_')[1], 10)].biomeId,
    exits: {},
  };


  const currentWorldX = currentLoc.mapCoordinates.x;
  const currentWorldY = currentLoc.mapCoordinates.y;

  let newLocationId = gameState.currentLocationId;
  let newSubMapCoordinates = { ...gameState.subMapCoordinates };
  let newMapDataForDispatch: MapData | undefined = gameState.mapData ? { ...gameState.mapData, tiles: gameState.mapData.tiles.map(row => row.map(tile => ({ ...tile }))) } : undefined;
  let activeDynamicNpcIdsForNewLocation: string[] | null = null;
  let timeToAdvanceSeconds = 0;
  let movedToNewNamedLocation: Location | null = null;

  const timeModifiers = getTimeModifiers(gameState.gameTime);

  let descriptionGenerationFn: (() => Promise<GeminiService.StandardizedResult<GeminiService.GeminiTextData>>) | null = null;
  let geminiFunctionName = '';
  let baseDescriptionForFallback = "You arrive at the new location.";

  if (!DIRECTION_VECTORS[directionKey]) { // Moving to a named exit (or teleporting)
    // Handle named exits or direct teleports
    // The targetId is the ID of the destination location.
    // We need to find if this targetId corresponds to an exit in the current location to check for travel time/description/etc.
    // But standard 'move' action usually just passes the destination ID as targetId.

    const targetLocation = LOCATIONS[action.targetId];
    if (targetLocation) {
      if (action.targetId === 'aralia_town_center') {
        const villageLocationId = 'aralia_town_center';
        activeDynamicNpcIdsForNewLocation = determineActiveDynamicNpcsForLocation(villageLocationId, LOCATIONS);

        dispatch({
          type: 'MOVE_PLAYER',
          payload: {
            newLocationId: villageLocationId,
            newSubMapCoordinates: { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) },
            mapData: gameState.mapData, // Preserve map state
            activeDynamicNpcIds: activeDynamicNpcIdsForNewLocation
          }
        });

        dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 1800 } });
        dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.VILLAGE_VIEW });

        addMessage("You enter Aralia Town Center.", "system");
        return;
      }

      newLocationId = action.targetId;
      newSubMapCoordinates = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };
      activeDynamicNpcIdsForNewLocation = determineActiveDynamicNpcsForLocation(newLocationId, LOCATIONS);
      timeToAdvanceSeconds = action.label.toLowerCase().includes('teleport') ? 0 : 3600;
      movedToNewNamedLocation = targetLocation;
      baseDescriptionForFallback = targetLocation.baseDescription;

      if (newMapDataForDispatch) {
        const newTiles = newMapDataForDispatch.tiles.map(row => row.map(t => ({ ...t, isPlayerCurrent: false })));
        if (newTiles[targetLocation.mapCoordinates.y]?.[targetLocation.mapCoordinates.x]) {
          newTiles[targetLocation.mapCoordinates.y][targetLocation.mapCoordinates.x].isPlayerCurrent = true;
          newTiles[targetLocation.mapCoordinates.y][targetLocation.mapCoordinates.x].discovered = true;
          for (let y_offset = -1; y_offset <= 1; y_offset++) {
            for (let x_offset = -1; x_offset <= 1; x_offset++) {
              const adjY = targetLocation.mapCoordinates.y + y_offset;
              const adjX = targetLocation.mapCoordinates.x + x_offset;
              if (adjY >= 0 && adjY < newMapDataForDispatch.gridSize.rows && adjX >= 0 && adjX < newMapDataForDispatch.gridSize.cols) {
                newTiles[adjY][adjX].discovered = true;
              }
            }
          }
        }
        newMapDataForDispatch.tiles = newTiles;
      }
      geminiFunctionName = 'generateLocationDescription';
      descriptionGenerationFn = () => GeminiService.generateLocationDescription(targetLocation.name, `Player (${playerContext}) enters ${targetLocation.name}.`, gameState.devModelOverride);

      // Quest Triggers for named locations
      if (action.targetId === 'ancient_ruins_entrance' || action.targetId === 'ruins_courtyard') {
        const questId = 'explore_ruins';
        const quest = INITIAL_QUESTS[questId];
        // Auto-accept if not present
        if (quest && !gameState.questLog.some(q => q.id === questId)) {
          dispatch({ type: 'ACCEPT_QUEST', payload: quest });
        }

        if (action.targetId === 'ancient_ruins_entrance') {
          dispatch({ type: 'UPDATE_QUEST_OBJECTIVE', payload: { questId, objectiveId: 'find_ruins', isCompleted: true } });
        } else if (action.targetId === 'ruins_courtyard') {
          dispatch({ type: 'UPDATE_QUEST_OBJECTIVE', payload: { questId, objectiveId: 'enter_courtyard', isCompleted: true } });
        }
      }

    } else {
      addMessage(`Cannot move to ${action.targetId}. Location does not exist.`, 'system');
      dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
      return;
    }
  } else { // Moving via compass direction
    const { dx, dy } = DIRECTION_VECTORS[directionKey];
    let nextSubMapX = gameState.subMapCoordinates.x + dx;
    let nextSubMapY = gameState.subMapCoordinates.y + dy;
    newSubMapCoordinates = { x: nextSubMapX, y: nextSubMapY };

    if (nextSubMapX >= 0 && nextSubMapX < SUBMAP_DIMENSIONS.cols && nextSubMapY >= 0 && nextSubMapY < SUBMAP_DIMENSIONS.rows) {
      newLocationId = gameState.currentLocationId;
      activeDynamicNpcIdsForNewLocation = gameState.currentLocationActiveDynamicNpcIds;

      const { effectiveTerrainType } = getSubmapTileInfo(
        gameState.worldSeed,
        currentLoc.mapCoordinates,
        currentLoc.biomeId,
        SUBMAP_DIMENSIONS,
        { x: nextSubMapX, y: nextSubMapY }
      );

      if (effectiveTerrainType === 'village_area') {
        addMessage("You stand before a village. You can enter if you wish.", "system");
      }

      if (playerCharacter.transportMode === 'foot') {
        timeToAdvanceSeconds = effectiveTerrainType === 'path' ? 15 * 60 : 30 * 60;
      }

      const biome = BIOMES[currentLoc.biomeId];
      const currentWorldTile = gameState.mapData?.tiles[currentWorldY]?.[currentWorldX];
      const tooltip = currentWorldTile ? getTileTooltipText(currentWorldTile) : null;
      geminiFunctionName = 'generateWildernessLocationDescription';
      descriptionGenerationFn = () => GeminiService.generateWildernessLocationDescription(biome?.name || 'Unknown Biome', { x: currentWorldX, y: currentWorldY }, newSubMapCoordinates, playerContext, tooltip, gameState.devModelOverride);
    } else {
      const targetWorldMapX = currentWorldX + dx;
      const targetWorldMapY = currentWorldY + dy;

      if (!newMapDataForDispatch || targetWorldMapY < 0 || targetWorldMapY >= newMapDataForDispatch.gridSize.rows ||
        targetWorldMapX < 0 || targetWorldMapX >= newMapDataForDispatch.gridSize.cols) {
        addMessage("You can't go that way; it's the edge of the known world.", "system");
        dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
        return;
      }

      const targetWorldTile = newMapDataForDispatch.tiles[targetWorldMapY][targetWorldMapX];
      const targetBiome = BIOMES[targetWorldTile.biomeId];

      if (!targetBiome?.passable) {
        addMessage(targetBiome.impassableReason || `You cannot enter the ${targetBiome.name}.`, "system");
        dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
        return;
      }

      addMessage("As you travel, you get the sense that tales of your deeds precede you...", "system");
      await handleGossipEvent(gameState, addGeminiLog, dispatch);

      newLocationId = targetWorldTile.locationId || `coord_${targetWorldMapX}_${targetWorldMapY}`;
      activeDynamicNpcIdsForNewLocation = determineActiveDynamicNpcsForLocation(newLocationId, LOCATIONS);

      if (nextSubMapX < 0) newSubMapCoordinates.x = SUBMAP_DIMENSIONS.cols - 1;
      else if (nextSubMapX >= SUBMAP_DIMENSIONS.cols) newSubMapCoordinates.x = 0;

      if (nextSubMapY < 0) newSubMapCoordinates.y = SUBMAP_DIMENSIONS.rows - 1;
      else if (nextSubMapY >= SUBMAP_DIMENSIONS.rows) newSubMapCoordinates.y = 0;

      const entryTileInfo = getSubmapTileInfo(
        gameState.worldSeed,
        { x: targetWorldMapX, y: targetWorldMapY },
        targetBiome.id,
        SUBMAP_DIMENSIONS,
        newSubMapCoordinates
      );

      if (entryTileInfo.effectiveTerrainType === 'village_area') {
        addMessage("You stand before a village. You can enter if you wish.", "system");
      }

      if (playerCharacter.transportMode === 'foot') {
        timeToAdvanceSeconds = entryTileInfo.effectiveTerrainType === 'path' ? 15 * 60 : 30 * 60;
      } else {
        timeToAdvanceSeconds = 3600;
      }

      const travelEvent = generateTravelEvent(targetBiome.id);
      if (travelEvent) {
        addMessage(travelEvent.description, 'system');
        if (travelEvent.effect?.type === 'delay') {
          timeToAdvanceSeconds += (travelEvent.effect.amount * 60);
          addMessage(`(Travel delayed by ${travelEvent.effect.amount} minutes)`, 'system');
        }
      }

      const newTiles = newMapDataForDispatch.tiles.map(row => row.map(tile => ({ ...tile, isPlayerCurrent: false })));
      if (newTiles[targetWorldMapY]?.[targetWorldMapX]) {
        newTiles[targetWorldMapY][targetWorldMapX].isPlayerCurrent = true;
        newTiles[targetWorldMapY][targetWorldMapX].discovered = true;
        for (let y_offset = -1; y_offset <= 1; y_offset++) {
          for (let x_offset = -1; x_offset <= 1; x_offset++) {
            const adjY = targetWorldMapY + y_offset;
            const adjX = targetWorldMapX + x_offset;
            if (adjY >= 0 && adjY < newMapDataForDispatch.gridSize.rows && adjX >= 0 && adjX < newMapDataForDispatch.gridSize.cols) {
              newTiles[adjY][adjX].discovered = true;
            }
          }
        }
      }
      newMapDataForDispatch.tiles = newTiles;

      if (LOCATIONS[newLocationId]) {
        const targetDefLocation = LOCATIONS[newLocationId];
        geminiFunctionName = 'generateLocationDescription (world move)';
        descriptionGenerationFn = () => GeminiService.generateLocationDescription(targetDefLocation.name, `Player (${playerContext}) enters ${targetDefLocation.name}.`, gameState.devModelOverride);
        movedToNewNamedLocation = targetDefLocation;
        baseDescriptionForFallback = targetDefLocation.baseDescription;
      } else {
        geminiFunctionName = 'generateWildernessLocationDescription (world move)';
        descriptionGenerationFn = () => GeminiService.generateWildernessLocationDescription(targetBiome?.name || 'Unknown Biome', { x: targetWorldMapX, y: targetWorldMapY }, newSubMapCoordinates, playerContext, getTileTooltipText(targetWorldTile), gameState.devModelOverride);
      }
    }
  }

  let newDescription = baseDescriptionForFallback;

  if (descriptionGenerationFn) {
    const result = await descriptionGenerationFn();

    // Use optional chaining or fallback if data is null due to hard failure
    const promptSent = result.data?.promptSent || result.metadata?.promptSent || 'Unknown prompt';
    const rawResponse = result.data?.rawResponse || result.metadata?.rawResponse || result.error || 'No response';

    addGeminiLog(geminiFunctionName, promptSent, rawResponse);

    if (result.data?.rateLimitHit || result.metadata?.rateLimitHit) {
      dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }

    if (result.data?.text) {
      newDescription = result.data.text;
    } else if (result.error) {
      addMessage("There was an issue describing your new surroundings.", 'system');
      console.error("Gemini Error during movement description:", result.error);
    }
  }

  // Apply Time/Season modifiers to travel time
  if (timeToAdvanceSeconds > 0) {
    timeToAdvanceSeconds = Math.round(timeToAdvanceSeconds * timeModifiers.travelCostMultiplier);
  }

  if (timeModifiers.description && timeModifiers.travelCostMultiplier > 1.0 && timeToAdvanceSeconds > 0) {
    // Only show the description occasionally to avoid spamming.
    if (Math.random() < 0.2) {
      addMessage(timeModifiers.description, 'system');
    }
  }

  if (timeToAdvanceSeconds > 0) {
    dispatch({ type: 'ADVANCE_TIME', payload: { seconds: timeToAdvanceSeconds } });
  }

  dispatch({ type: 'MOVE_PLAYER', payload: { newLocationId, newSubMapCoordinates, mapData: newMapDataForDispatch, activeDynamicNpcIds: activeDynamicNpcIdsForNewLocation } });

  if (movedToNewNamedLocation) {
    logDiscovery(movedToNewNamedLocation);
  }

  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });

  addMessage(newDescription, 'system');
}

interface HandleQuickTravelProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
}

export async function handleQuickTravel({
  action,
  gameState,
  dispatch,
  addMessage,
}: HandleQuickTravelProps): Promise<void> {
  if (!action.payload?.quickTravel) {
    addMessage("Quick travel failed: missing data.", 'system');
    return;
  }

  const { destination, durationSeconds } = action.payload.quickTravel;

  // Calculate tile info for the destination to check for special terrain types (like villages)
  const currentLoc = LOCATIONS[gameState.currentLocationId] || {
    id: gameState.currentLocationId,
    mapCoordinates: {
      x: parseInt(gameState.currentLocationId.split('_')[1], 10),
      y: parseInt(gameState.currentLocationId.split('_')[2], 10),
    },
    biomeId: gameState.mapData?.tiles[parseInt(gameState.currentLocationId.split('_')[2], 10)][parseInt(gameState.currentLocationId.split('_')[1], 10)].biomeId || 'plains',
  };

  const { effectiveTerrainType } = getSubmapTileInfo(
    gameState.worldSeed,
    currentLoc.mapCoordinates,
    currentLoc.biomeId,
    SUBMAP_DIMENSIONS,
    destination
  );

  // Dispatch move
  dispatch({
    type: 'MOVE_PLAYER',
    payload: {
      newLocationId: gameState.currentLocationId,
      newSubMapCoordinates: destination,
      mapData: gameState.mapData || undefined,
      activeDynamicNpcIds: gameState.currentLocationActiveDynamicNpcIds
    }
  });

  // Advance time
  if (durationSeconds > 0) {
    dispatch({ type: 'ADVANCE_TIME', payload: { seconds: durationSeconds } });
  }

  addMessage(`You travel quickly across the terrain.`, 'system');

  // Check for Village Entry
  if (effectiveTerrainType === 'village_area') {
    addMessage("You stand before a village. You can enter if you wish.", "system");
  }
}

interface HandleApproachSettlementProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  action: Action;
}

export async function handleApproachSettlement({
  gameState,
  dispatch,
  addMessage,
  action,
}: HandleApproachSettlementProps): Promise<void> {
  const isVillage = action.type === 'APPROACH_VILLAGE';
  const settlementType = isVillage ? 'village' : 'town';

  // Find the nearest village/town tile
  const currentLoc = LOCATIONS[gameState.currentLocationId] || {
    id: gameState.currentLocationId,
    mapCoordinates: {
      x: parseInt(gameState.currentLocationId.split('_')[1], 10),
      y: parseInt(gameState.currentLocationId.split('_')[2], 10),
    },
    biomeId: gameState.mapData?.tiles[parseInt(gameState.currentLocationId.split('_')[2], 10)][parseInt(gameState.currentLocationId.split('_')[1], 10)].biomeId || 'plains',
  };

  const checkOffsets = [
    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 1, y: 1 }
  ];

  let nearestVillageTile = null;
  let minDistance = Infinity;

  for (const offset of checkOffsets) {
    const checkX = gameState.subMapCoordinates.x + offset.x;
    const checkY = gameState.subMapCoordinates.y + offset.y;

    if (checkX >= 0 && checkX < SUBMAP_DIMENSIONS.cols &&
        checkY >= 0 && checkY < SUBMAP_DIMENSIONS.rows) {
      const { effectiveTerrainType } = getSubmapTileInfo(
        gameState.worldSeed,
        currentLoc.mapCoordinates,
        currentLoc.biomeId,
        SUBMAP_DIMENSIONS,
        { x: checkX, y: checkY }
      );

      if (effectiveTerrainType === 'village_area') {
        const distance = Math.abs(offset.x) + Math.abs(offset.y);
        if (distance < minDistance) {
          minDistance = distance;
          nearestVillageTile = { x: checkX, y: checkY };
        }
      }
    }
  }

  if (nearestVillageTile) {
    // Move to the village tile
    dispatch({
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId: gameState.currentLocationId,
        newSubMapCoordinates: nearestVillageTile,
        mapData: gameState.mapData || undefined,
        activeDynamicNpcIds: gameState.currentLocationActiveDynamicNpcIds
      }
    });

    addMessage(`You approach the nearby ${settlementType} and arrive at its outskirts.`, 'system');
  } else {
    addMessage(`You cautiously approach the area, but can't find the ${settlementType} you thought you saw.`, 'system');
  }
}

interface HandleObserveSettlementProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  action: Action;
}

export async function handleObserveSettlement({
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
  action,
}: HandleObserveSettlementProps): Promise<void> {
  const isVillage = action.type === 'OBSERVE_VILLAGE';
  const settlementType = isVillage ? 'village' : 'town';

  addMessage(`You take a moment to observe the ${settlementType} from a distance, noting its layout and activity.`, 'system');

  // This could trigger Gemini to generate descriptions of what the player sees
  // For now, just provide basic feedback
  const observationPrompt = `The player is observing a ${settlementType} from a distance. Generate a brief description of what they might see based on the settlement type and surroundings.`;

  addGeminiLog({
    type: 'system',
    content: observationPrompt,
    timestamp: new Date(),
    context: 'settlement_observation'
  });
}
