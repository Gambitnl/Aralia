
/**
 * @file src/utils/contextUtils.ts
 * Utility functions for generating rich narrative context for AI processing.
 */
import { GameState, PlayerCharacter, NPC, Location } from '../types';
import { BIOMES, ITEMS } from '../constants';
import { getSubmapTileInfo } from './submapUtils';
import { SUBMAP_DIMENSIONS } from '../config/mapConfig';

interface ContextGenerationParams {
  gameState: GameState;
  playerCharacter: PlayerCharacter | undefined;
  currentLocation: Location;
  npcsInLocation: NPC[];
}

/**
 * Generates a comprehensive context string for AI narrative generation.
 * Includes player state, location details, items, NPCs, active quests, and recent history.
 */
export function generateGeneralActionContext({
  gameState,
  playerCharacter,
  currentLocation,
  npcsInLocation
}: ContextGenerationParams): string {
  // Player Context
  let playerContext = 'An adventurer';
  let playerHealthStatus = '';
  if (playerCharacter) {
    playerContext = `${playerCharacter.name}, a ${playerCharacter.race.name} ${playerCharacter.class.name}`;
    playerHealthStatus = ` (HP: ${playerCharacter.hp}/${playerCharacter.maxHp})`;
  }

  // Location Context
  const itemsInLocationNames = currentLocation.itemIds?.map((id) => ITEMS[id]?.name).filter(Boolean).join(', ') || 'nothing special';

  const submapTileInfo = gameState.subMapCoordinates
    ? getSubmapTileInfo(gameState.worldSeed, currentLocation.mapCoordinates, currentLocation.biomeId, SUBMAP_DIMENSIONS, gameState.subMapCoordinates)
    : null;

  const subMapCtx = submapTileInfo ? `You are standing on a '${submapTileInfo.effectiveTerrainType}' tile. ` : '';
  const detailedLocationContext = `${subMapCtx}The location is ${currentLocation.name}. Biome: ${BIOMES[currentLocation.biomeId]?.name || 'Unknown'}. Game Time: ${gameState.gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;

  // Narrative Context (History & Quests)
  // We grab the last few messages to give the AI continuity
  const recentHistory = gameState.messages
    .filter(m => m.sender === 'system' || m.sender === 'player' || m.sender === 'npc')
    .slice(-3)
    .map(m => {
      const role = m.sender === 'player' ? 'Player' : (m.sender === 'npc' ? 'NPC' : 'Narrator');
      return `[${role}]: ${m.text}`;
    })
    .join(' | ');

  const activeQuests = gameState.questLog
    .filter(q => q.status === 'Active')
    .map(q => q.title)
    .join(', ');

  // Assemble the rich context
  const parts = [
    `Player: ${playerContext}${playerHealthStatus}`,
    `Location: ${detailedLocationContext}`,
    `NPCs Present: ${npcsInLocation.map((n) => n.name).join(', ') || 'none'}`,
    `Visible Items: ${itemsInLocationNames}`,
    activeQuests ? `Active Quests: ${activeQuests}` : null,
    recentHistory ? `Recent Events: ${recentHistory}` : null
  ].filter(Boolean);

  return parts.join('. ') + '.';
}
