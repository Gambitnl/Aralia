// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/06/2026, 02:34:59
 * Dependents: hooks/actions/actionHandlers.ts
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/actions/handleMovement.ts
 * Handles player movement across local submap tiles, world-map cells, and named
 * destinations.
 *
 * This file is the bridge between player intent ("move north", "enter town")
 * and the world state update that follows. It checks terrain blockers, advances
 * in-game time, generates travel narration, records discoveries, and dispatches
 * the final `MOVE_PLAYER` action. World-map discovery/current-marker writes now
 * pass through the World geography adapter so the legacy tile-grid can remain
 * compatible while the newer Azgaar/worldSim geography model is phased in.
 */
import React from 'react';
import { GameState, Action, Location, MapData, PlayerCharacter, GamePhase } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as OllamaTextService from '../../services/ollamaTextService';
import { AddMessageFn, AddGeminiLogFn, LogDiscoveryFn, GetTileTooltipTextFn } from './actionHandlerTypes';
import { LOCATIONS, BIOMES } from '../../constants';
import { DIRECTION_VECTORS, SUBMAP_DIMENSIONS } from '../../config/mapConfig';
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';
import { handleGossipEvent } from './handleWorldEvents';
import { getSubmapTileInfo } from '../../utils/submapUtils';
import { INITIAL_QUESTS } from '../../data/quests';
import { generateTravelEvent } from '../../services/travelEventService';
import { getSeasonalEffects } from '../../systems/time/SeasonalSystem';
import { getTimeModifiers } from '../../utils/core';
import {
  applyMutationsToMapData,
  buildLegacyDiscoveryMutations,
  createLegacyTileId,
  createSetCurrentMutation,
  type LegacyTileCoordinates,
  type WorldGeographyMutation,
} from '../../utils/world/worldGeographyAdapter';
// TODO(lint-intent): 'TravelEvent' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { DiscoveryConsequence, TravelEvent, TravelEventEffect } from '../../types/exploration';
import { BanterManager } from '../../systems/companions/BanterManager';
import { resolveAndRegisterEntities } from '../../utils/entityIntegrationUtils';

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

// -----------------------------------------------------------------------------
// Legacy world-map marker updates
// -----------------------------------------------------------------------------
// These helpers keep the old movement behavior in one place while routing the
// actual discovery/current marker writes through the world geography adapter.
// The movement handler still dispatches legacy `MapData` because save/load,
// MapPane, and 3D entry have not been migrated yet.
// -----------------------------------------------------------------------------

function applyLegacyWorldMapMutations(
  mapData: MapData,
  mutations: readonly WorldGeographyMutation[],
): MapData {
  return applyMutationsToMapData(mapData, mutations).mapData;
}

function applyCurrentWorldTileReveal(
  mapData: MapData,
  center: LegacyTileCoordinates,
  radius = 1,
): MapData {
  const mutations = [
    createSetCurrentMutation(createLegacyTileId(center.x, center.y)),
    ...buildLegacyDiscoveryMutations(mapData, center, radius),
  ];
  return applyLegacyWorldMapMutations(mapData, mutations);
}

/**
 * Helper to apply consequences from meaningful discoveries.
 */
function applyDiscoveryConsequences(
  consequences: DiscoveryConsequence[],
  dispatch: React.Dispatch<AppAction>,
  addMessage: AddMessageFn,
  mapData: MapData,
  currentX: number,
  currentY: number
) {
  consequences.forEach(consequence => {
    switch (consequence.type) {
      case 'map_reveal':
        if (consequence.value) {
          const radius = consequence.value;
          const result = applyMutationsToMapData(
            mapData,
            buildLegacyDiscoveryMutations(mapData, { x: currentX, y: currentY }, radius),
          );
          const revealedCount = result.changedLegacyTiles.length;

          if (revealedCount > 0) {
            // Preserve the legacy map object that movement dispatch already
            // passes along, but let the adapter own the copied tile updates.
            mapData.tiles = result.mapData.tiles;
            addMessage(`[Effect] Map Revealed (Radius: ${radius}) - ${revealedCount} new tiles charted.`, 'system');
          } else {
            addMessage(`[Effect] Map Revealed - No new areas found.`, 'system');
          }
        }
        break;
      case 'reputation':
        if (consequence.targetId && consequence.value) {
          // TODO(preserve-lint): route reputation changes through a dedicated reputation action once available.
          dispatch({
            type: 'ADD_DISCOVERY_ENTRY' as any,
            payload: {
              factionId: consequence.targetId,
              change: consequence.value,
              source: 'discovery'
            } as any
          });
          addMessage(`[Effect] Reputation Updated: ${consequence.targetId} ${consequence.value > 0 ? '+' : ''}${consequence.value}`, 'system');
        }
        break;
    }
  });
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
  const targetId = 'targetId' in action ? (action as any).targetId : undefined;

  if (!targetId || !gameState.subMapCoordinates || !gameState.mapData) {
    addMessage("Cannot determine movement destination.", "system");
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
    return;
  }

  const directionKey = targetId as keyof typeof DIRECTION_VECTORS;

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
  const seasonalEffects = getSeasonalEffects(gameState.gameTime);

  // TODO(lint-intent): Gemini service typings are still evolving; keep loose until the response envelope stabilizes.
  let descriptionGenerationFn: (() => Promise<any>) | null = null;
  let geminiFunctionName = '';
  let baseDescriptionForFallback = "You arrive at the new location.";
  let travelEvent: TravelEvent | null = null;
  let travelEffect: TravelEvent['effect'] | null = null;
  let travelDescription: string | null = null;
  let travelEventHandled = false;

  const processTravelEvent = (
    event: TravelEvent,
    biomeForContext: typeof BIOMES[keyof typeof BIOMES] | undefined,
    worldX: number,
    worldY: number
  ) => {
    let finalEffect = event.effect;
    let finalDescription = event.description;

    if (event.skillCheck) {
      const { check, successEffect, successDescription, failureEffect, failureDescription } = event.skillCheck;

      const hasSkill = playerCharacter.skills.some(s => s.id === check.skill || s.name.toLowerCase() === check.skill.toLowerCase());
      const d20 = Math.floor(Math.random() * 20) + 1;
      const pb = playerCharacter.proficiencyBonus || 2;

      const skillToAbility: Record<string, string> = {
        'athletics': 'strength',
        'acrobatics': 'dexterity', 'sleight_of_hand': 'dexterity', 'stealth': 'dexterity',
        'arcana': 'intelligence', 'history': 'intelligence', 'investigation': 'intelligence', 'nature': 'intelligence', 'religion': 'intelligence',
        'animal_handling': 'wisdom', 'insight': 'wisdom', 'medicine': 'wisdom', 'perception': 'wisdom', 'survival': 'wisdom',
        'deception': 'charisma', 'intimidation': 'charisma', 'performance': 'charisma', 'persuasion': 'charisma'
      };

      const abilityName = skillToAbility[check.skill] || 'wisdom';
      const score = (playerCharacter.abilityScores as any)[abilityName] || 10;
      const mod = Math.floor((score - 10) / 2);

      const totalBonus = mod + (hasSkill ? pb : 0);
      const totalRoll = d20 + totalBonus;
      const passed = totalRoll >= check.dc;

      addMessage(`[Skill Check] ${check.skill.charAt(0).toUpperCase() + check.skill.slice(1)}: Rolled ${totalRoll} (DC ${check.dc}) - ${passed ? 'Success' : 'Failure'}`, 'system');

      if (passed) {
        finalDescription = `${event.description} ${successDescription}`;
        if (successEffect) finalEffect = successEffect;
      } else {
        finalDescription = `${event.description} ${failureDescription || ''}`;
        if (failureEffect) finalEffect = failureEffect;
      }
    }

    addMessage(finalDescription, 'system');

    if (finalEffect) {
      switch (finalEffect.type) {
        case 'delay': {
          const delaySeconds = finalEffect.amount * 3600;
          timeToAdvanceSeconds += delaySeconds;
          addMessage(`(Travel delayed by ${finalEffect.amount} hours)`, 'system');
          break;
        }
        case 'health_change': {
          dispatch({
            type: 'MODIFY_PARTY_HEALTH',
            payload: { amount: finalEffect.amount }
          });
          const hpChangeText = finalEffect.amount > 0 ? 'healed' : 'damaged';
          addMessage(`Party ${hpChangeText} by ${Math.abs(finalEffect.amount)} HP.`, 'system');
          break;
        }
        case 'item_gain':
          if (finalEffect.itemId) {
            dispatch({ type: 'ADD_ITEM', payload: { itemId: finalEffect.itemId, count: finalEffect.amount } });
            const itemGainMsg = finalEffect.description || `You found ${finalEffect.amount} item(s).`;
            addMessage(itemGainMsg, 'system');
          }
          break;
        case 'gold_gain':
          dispatch({
            type: 'MODIFY_GOLD',
            payload: { amount: finalEffect.amount }
          });
          addMessage(finalEffect.description || `You found ${finalEffect.amount} gold pieces.`, 'system');
          break;
        case 'xp_gain':
          dispatch({
            type: 'GRANT_EXPERIENCE',
            payload: { amount: finalEffect.amount }
          });
          addMessage(finalEffect.description || `Party gained ${finalEffect.amount} XP.`, 'system');
          break;
        case 'discovery':
          if (finalEffect.data) {
            const discoveryLocation: Location = {
              id: finalEffect.data.id,
              name: finalEffect.data.name,
              baseDescription: finalEffect.data.description,
              biomeId: biomeForContext?.id || currentLoc.biomeId,
              mapCoordinates: { x: worldX, y: worldY },
              exits: {},
            };
            logDiscovery(discoveryLocation);
            addMessage(`Map updated: ${finalEffect.data.name} recorded.`, 'system');

            if (finalEffect.data.rewards) {
              finalEffect.data.rewards.forEach(reward => {
                switch (reward.type) {
                  case 'item':
                    if (reward.resourceId) {
                      dispatch({ type: 'ADD_ITEM', payload: { itemId: reward.resourceId, count: reward.amount } });
                      addMessage(`Gained ${reward.amount}x ${reward.description || 'Items'}`, 'system');
                    }
                    break;
                  case 'gold':
                    dispatch({ type: 'MODIFY_GOLD', payload: { amount: reward.amount } });
                    addMessage(`Gained ${reward.amount} Gold`, 'system');
                    break;
                  case 'xp':
                    dispatch({ type: 'GRANT_EXPERIENCE', payload: { amount: reward.amount } });
                    addMessage(`Party gained ${reward.amount} XP`, 'system');
                    break;
                  case 'health': {
                    dispatch({ type: 'MODIFY_PARTY_HEALTH', payload: { amount: reward.amount } });
                    const hpText = reward.amount > 0 ? 'Healed' : 'Took damage';
                    addMessage(`${hpText} ${Math.abs(reward.amount)} HP`, 'system');
                    break;
                  }
                }
              });
            }

            if (finalEffect.data.consequences && newMapDataForDispatch) {
              applyDiscoveryConsequences(
                finalEffect.data.consequences,
                dispatch,
                addMessage,
                newMapDataForDispatch,
                worldX,
                worldY
              );
            }
          }
          break;
        default:
          break;
      }
    }
  };

  if (!DIRECTION_VECTORS[directionKey]) { // Moving to a named exit (or teleporting)
    // Handle named exits or direct teleports
    // The targetId is the ID of the destination location.
    // We need to find if this targetId corresponds to an exit in the current location to check for travel time/description/etc.
    // But standard 'move' action usually just passes the destination ID as targetId.

    const targetLocation = LOCATIONS[targetId];
    if (targetLocation) {
      if (targetId === 'aralia_town_center') {
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

      newLocationId = targetId;
      newSubMapCoordinates = { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) };
      activeDynamicNpcIdsForNewLocation = determineActiveDynamicNpcsForLocation(newLocationId, LOCATIONS);
      timeToAdvanceSeconds = (action.label || '').toLowerCase().includes('teleport') ? 0 : 3600;
      movedToNewNamedLocation = targetLocation;
      baseDescriptionForFallback = targetLocation.baseDescription;

      if (newMapDataForDispatch) {
        newMapDataForDispatch = applyCurrentWorldTileReveal(
          newMapDataForDispatch,
          targetLocation.mapCoordinates,
        );
      }
      geminiFunctionName = 'generateLocationDescription';
      descriptionGenerationFn = () => OllamaTextService.generateLocationDescription(targetLocation.name, playerContext);

      // TODO(FEATURES): Replace hardcoded quest triggers with data-driven location metadata so quests can be discovered from any map tile (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
      // Quest Triggers for named locations
      if (targetId === 'ancient_ruins_entrance' || targetId === 'ruins_courtyard') {
        const questId = 'explore_ruins';
        const quest = INITIAL_QUESTS[questId];
        // Auto-accept if not present
        if (quest && !gameState.questLog.some(q => q.id === questId)) {
          dispatch({ type: 'ACCEPT_QUEST', payload: quest });
        }

        if (targetId === 'ancient_ruins_entrance') {
          dispatch({ type: 'UPDATE_QUEST_OBJECTIVE', payload: { questId, objectiveId: 'find_ruins', isCompleted: true } });
        } else if (targetId === 'ruins_courtyard') {
          dispatch({ type: 'UPDATE_QUEST_OBJECTIVE', payload: { questId, objectiveId: 'enter_courtyard', isCompleted: true } });
        }
      }

    } else {
      addMessage(`Cannot move to ${targetId}. Location does not exist.`, 'system');
      dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
      return;
    }
  } else { // Moving via compass direction
    const { dx, dy } = DIRECTION_VECTORS[directionKey];
    const nextSubMapX = gameState.subMapCoordinates.x + dx;
    const nextSubMapY = gameState.subMapCoordinates.y + dy;
    newSubMapCoordinates = { x: nextSubMapX, y: nextSubMapY };

    if (nextSubMapX >= 0 && nextSubMapX < SUBMAP_DIMENSIONS.cols && nextSubMapY >= 0 && nextSubMapY < SUBMAP_DIMENSIONS.rows) {
      newLocationId = gameState.currentLocationId;
      activeDynamicNpcIdsForNewLocation = gameState.currentLocationActiveDynamicNpcIds;

      const { effectiveTerrainType, isImpassable } = getSubmapTileInfo(
        gameState.worldSeed,
        currentLoc.mapCoordinates,
        currentLoc.biomeId,
        SUBMAP_DIMENSIONS,
        { x: nextSubMapX, y: nextSubMapY }
      );

      // Block movement into impassable terrain (water, village tiles, etc.)
      if (isImpassable) {
        if (effectiveTerrainType === 'village_area') {
          addMessage("You cannot walk through the village. Move to an adjacent tile and use the Enter Village action.", "system");
        } else if (effectiveTerrainType === 'water') {
          addMessage("You cannot cross the water here.", "system");
        } else {
          addMessage("You cannot pass through here.", "system");
        }
        dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
        return;
      }

      if (playerCharacter.transportMode === 'foot') {
        timeToAdvanceSeconds = effectiveTerrainType === 'path' ? 15 * 60 : 30 * 60;
      }

      const biome = BIOMES[currentLoc.biomeId];
      const currentWorldTile = gameState.mapData?.tiles[currentWorldY]?.[currentWorldX];
      const tooltip = currentWorldTile ? getTileTooltipText(currentWorldTile) : null;
      geminiFunctionName = 'generateWildernessLocationDescription';
      descriptionGenerationFn = () => OllamaTextService.generateWildernessLocationDescription(biome?.name || 'Unknown Biome', { x: currentWorldX, y: currentWorldY }, newSubMapCoordinates, playerContext, tooltip);
      travelEvent = generateTravelEvent(biome?.id || currentLoc.biomeId, undefined, { worldSeed: gameState.worldSeed, x: currentWorldX, y: currentWorldY });
      if (travelEvent) {
        travelEffect = travelEvent.effect;
        travelDescription = travelEvent.description;
      }
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

      // TODO(Navigator): Use `calculateForcedMarchStatus` from `src/systems/travel/TravelCalculations.ts` to check if the party has traveled > 8 hours and apply exhaustion risks.
      travelEvent = generateTravelEvent(targetBiome.id, undefined, { worldSeed: gameState.worldSeed, x: targetWorldMapX, y: targetWorldMapY });
      if (travelEvent) {
        travelEffect = travelEvent.effect;
        travelDescription = travelEvent.description;
        processTravelEvent(travelEvent as TravelEvent, targetBiome, targetWorldMapX, targetWorldMapY);
        travelEventHandled = true;
      }

      // The entered world tile becomes current and the surrounding legacy
      // cells are revealed exactly as before, but the mutation itself is now
      // expressed through the World geography adapter contract.
      newMapDataForDispatch = applyCurrentWorldTileReveal(
        newMapDataForDispatch,
        { x: targetWorldMapX, y: targetWorldMapY },
      );

      if (LOCATIONS[newLocationId]) {
        const targetDefLocation = LOCATIONS[newLocationId];
        geminiFunctionName = 'generateLocationDescription (world move)';
        descriptionGenerationFn = () => OllamaTextService.generateLocationDescription(targetDefLocation.name, playerContext);
        movedToNewNamedLocation = targetDefLocation;
        baseDescriptionForFallback = targetDefLocation.baseDescription;
      } else {
        geminiFunctionName = 'generateWildernessLocationDescription (world move)';
        descriptionGenerationFn = () => OllamaTextService.generateWildernessLocationDescription(targetBiome?.name || 'Unknown Biome', { x: targetWorldMapX, y: targetWorldMapY }, newSubMapCoordinates, playerContext, getTileTooltipText(targetWorldTile));
      }
    }
  }

  if (travelEvent && !travelEventHandled) {
    const biomeForEvent = BIOMES[currentLoc.biomeId];
    processTravelEvent(travelEvent as TravelEvent, biomeForEvent, currentWorldX, currentWorldY);
    travelEventHandled = true;
  }

  let newDescription = baseDescriptionForFallback;

  if (descriptionGenerationFn) {
    const result: any = await descriptionGenerationFn();

    // Use optional chaining or fallback if data is null due to hard failure
    const promptSent = result.data?.promptSent || result.metadata?.promptSent || 'Unknown prompt';
    const rawResponse = result.data?.rawResponse || result.metadata?.rawResponse || result.error || 'No response';

    addGeminiLog(geminiFunctionName, promptSent, rawResponse);

    if (result.data?.rateLimitHit || result.metadata?.rateLimitHit) {
      dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }

    if (result.data?.text) {
      newDescription = result.data.text;

      // Linker Coherence Check: Ensure any mentioned entities exist
      await resolveAndRegisterEntities(newDescription, gameState, dispatch, addGeminiLog);

      // TODO(Linker): Enhance entity generation for wilderness travel by creating specific entity types (e.g. Landmarks, Ruins) based on the current biome and adding them to the submap.

    } else if (result.error) {
      addMessage("There was an issue describing your new surroundings.", 'system');
      console.error("Gemini Error during movement description:", result.error);
    }
  }

  // Apply Time/Season modifiers to travel time
  if (timeToAdvanceSeconds > 0) {
    // Combine day/night multiplier with seasonal multiplier
    timeToAdvanceSeconds = Math.round(timeToAdvanceSeconds * timeModifiers.travelCostMultiplier * seasonalEffects.travelCostMultiplier);
  }

  if (timeModifiers.description && timeModifiers.travelCostMultiplier > 1.0 && timeToAdvanceSeconds > 0) {
    // Only show the description occasionally to avoid spamming.
    if (Math.random() < 0.2) {
      addMessage(timeModifiers.description, 'system');
    }
  }

  // Show seasonal description occasionally if it has a significant effect
  if (seasonalEffects.travelCostMultiplier > 1.0 && timeToAdvanceSeconds > 0) {
    if (Math.random() < 0.2) {
      addMessage(seasonalEffects.description, 'system');
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

  // Trigger Banter (Contextual Companion Dialogue)
  // Heartkeeper: Companions should speak up during travel to feel alive.
  // Use BanterDisplayService to manage queues and prevent overlapping dialogue.
  const banter = BanterManager.selectBanter(gameState);
  if (banter) {
    dispatch({
      type: 'UPDATE_BANTER_COOLDOWN',
      payload: { banterId: banter.id, timestamp: Date.now() }
    });
    const { BanterDisplayService } = await import('../../services/BanterDisplayService');
    BanterDisplayService.queueBanter(banter.lines, addMessage as any, gameState.companions);
  }
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
  const sleep = (ms: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

  const payload = (action as any).payload;
  if (!payload?.quickTravel) {
    addMessage("Quick travel failed: missing data.", 'system');
    return;
  }

  const {
    destination,
    durationSeconds,
    orderedPath,
    stepDurationsSeconds,
    encounterChancePerStep,
    stepDelayMs,
  } = payload.quickTravel;

  if (!gameState.subMapCoordinates) {
    addMessage("Quick travel failed: no current submap position.", 'system');
    return;
  }

  // Calculate tile info for the destination to check for special terrain types (like villages)
  // TODO[LOCATION-PARSING]: Consolidate coord_X_Y parsing into a shared utility
  // (e.g., parseCoordinateLocationId() in locationUtils.ts). This pattern is duplicated in ActionPane.tsx.
  const currentLoc = LOCATIONS[gameState.currentLocationId] || {
    id: gameState.currentLocationId,
    mapCoordinates: {
      x: parseInt(gameState.currentLocationId.split('_')[1], 10),
      y: parseInt(gameState.currentLocationId.split('_')[2], 10),
    },
    biomeId: gameState.mapData?.tiles[parseInt(gameState.currentLocationId.split('_')[2], 10)][parseInt(gameState.currentLocationId.split('_')[1], 10)].biomeId || 'plains',
  };

  const pathFromPayload: Array<{ x: number; y: number }> =
    Array.isArray(orderedPath) && orderedPath.length > 0
      ? orderedPath
      : [gameState.subMapCoordinates, destination];
  const routeSteps = pathFromPayload.slice(1);

  if (routeSteps.length === 0) {
    addMessage("You are already at that location.", "system");
    return;
  }

  const safeEncounterChance = Math.max(0, Math.min(1, Number(encounterChancePerStep ?? 0.16)));
  const safeStepDelayMs = Math.max(0, Number(stepDelayMs ?? 3000));
  const defaultStepDurationSeconds = routeSteps.length > 0
    ? Math.max(1, Math.round(Number(durationSeconds || 0) / routeSteps.length))
    : 0;

  let wasInterruptedByEncounter = false;
  let reachedStepCount = 0;
  for (let stepIndex = 0; stepIndex < routeSteps.length; stepIndex++) {
    const stepDestination = routeSteps[stepIndex];
    const { effectiveTerrainType, isImpassable } = getSubmapTileInfo(
      gameState.worldSeed,
      currentLoc.mapCoordinates,
      currentLoc.biomeId,
      SUBMAP_DIMENSIONS,
      stepDestination
    );

    // Block quick travel to impassable terrain (water, village tiles, etc.)
    if (isImpassable) {
      if (effectiveTerrainType === 'village_area') {
        addMessage("You cannot travel directly onto the village. Move to an adjacent tile and use the Enter Village action.", "system");
      } else if (effectiveTerrainType === 'water') {
        addMessage("You cannot travel across the water.", "system");
      } else {
        addMessage("You cannot travel to that location.", "system");
      }
      return;
    }

    dispatch({
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId: gameState.currentLocationId,
        newSubMapCoordinates: stepDestination,
        mapData: gameState.mapData || undefined,
        activeDynamicNpcIds: gameState.currentLocationActiveDynamicNpcIds
      }
    });

    const stepDuration = Math.max(
      1,
      Math.round(
        Number(stepDurationsSeconds?.[stepIndex] ?? defaultStepDurationSeconds)
      )
    );
    if (stepDuration > 0) {
      dispatch({ type: 'ADVANCE_TIME', payload: { seconds: stepDuration } });
    }

    reachedStepCount++;

    const isFinalStep = stepIndex === routeSteps.length - 1;
    if (!isFinalStep && safeStepDelayMs > 0) {
      await sleep(safeStepDelayMs);
    }

    const encounterTriggered = !isFinalStep && Math.random() < safeEncounterChance;
    if (encounterTriggered) {
      addMessage("Travel interrupted: your party notices signs of danger nearby.", "system");
      wasInterruptedByEncounter = true;
      break;
    }
  }

  if (wasInterruptedByEncounter) {
    addMessage(`You covered ${reachedStepCount} step${reachedStepCount === 1 ? '' : 's'} before stopping.`, "system");
    return;
  }

  addMessage(`You travel quickly across the terrain and reach your destination.`, 'system');
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

  // TODO(FEATURES): Hook proximity checks into town metadata/description loading when approaching settlements (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).

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
    if (!gameState.subMapCoordinates) continue;
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
  // TODO(lint-intent): 'gameState' is an unused parameter, which suggests a planned input for this flow.
  // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
  // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
  gameState: _gameState,
  // TODO(lint-intent): 'dispatch' is an unused parameter, which suggests a planned input for this flow.
  // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
  // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
  dispatch: _dispatch,
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

  addGeminiLog('observeSettlement', observationPrompt, 'Observation logged - AI description pending implementation');
}
