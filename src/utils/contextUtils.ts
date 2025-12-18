
/**
 * @file src/utils/contextUtils.ts
 * Utility functions for generating rich narrative context for AI processing.
 */
import { GameState, PlayerCharacter, NPC, Location } from '../types';
import { BIOMES, ITEMS } from '../constants';
import { getSubmapTileInfo } from './submapUtils';
import { SUBMAP_DIMENSIONS } from '../config/mapConfig';
import { getTimeModifiers, formatGameTime } from './timeUtils';

interface ContextGenerationParams {
  gameState: GameState;
  playerCharacter: PlayerCharacter | undefined;
  currentLocation: Location;
  npcsInLocation: NPC[];
}

/**
 * Generates a comprehensive, structured context string for AI narrative generation.
 * Uses Markdown-style headers to organize player state, location details, items, NPCs, active quests, and recent history.
 */
export function generateGeneralActionContext({
  gameState,
  playerCharacter,
  currentLocation,
  npcsInLocation
}: ContextGenerationParams): string {
  const parts: string[] = [];

  // --- PLAYER ---
  if (playerCharacter) {
    const conditions = playerCharacter.conditions.length > 0
      ? playerCharacter.conditions.join(', ')
      : 'None';

    parts.push(`## PLAYER\nName: ${playerCharacter.name} (${playerCharacter.race.name} ${playerCharacter.class.name}) | HP: ${playerCharacter.hp}/${playerCharacter.maxHp} | Conditions: ${conditions}`);
  } else {
    parts.push(`## PLAYER\nAn unknown adventurer`);
  }

  // --- LOCATION ---
  const biomeName = BIOMES[currentLocation.biomeId]?.name || 'Unknown Biome';
  const timeDesc = formatGameTime(gameState.gameTime, { hour: '2-digit', minute: '2-digit', hour12: true });
  // Use time modifiers for atmospheric flavor
  const timeModifiers = getTimeModifiers(gameState.gameTime);
  const flavorTime = timeModifiers.description;

  let locationDetails = `${currentLocation.name} (${biomeName}) | Time: ${timeDesc} (${flavorTime})`;

  // Submap Context
  if (gameState.subMapCoordinates) {
    const submapTileInfo = getSubmapTileInfo(gameState.worldSeed, currentLocation.mapCoordinates, currentLocation.biomeId, SUBMAP_DIMENSIONS, gameState.subMapCoordinates);
    if (submapTileInfo) {
      locationDetails += `\nImmediate Terrain: ${submapTileInfo.effectiveTerrainType}`;
      if (submapTileInfo.activeFeatureConfig) {
         locationDetails += ` | Feature: ${submapTileInfo.activeFeatureConfig.name}`;
      }
    }
  }

  // Visible Items
  const itemsInLocationNames = currentLocation.itemIds?.map((id) => ITEMS[id]?.name).filter(Boolean).join(', ');
  if (itemsInLocationNames) {
      locationDetails += `\nVisible Items: ${itemsInLocationNames}`;
  }

  parts.push(`## LOCATION\n${locationDetails}`);

  // --- NPCS ---
  if (npcsInLocation.length > 0) {
    const npcLines = npcsInLocation.map(npc => {
      const memory = gameState.npcMemory[npc.id];
      let dispositionStr = 'Neutral';
      if (memory) {
         if (memory.disposition > 20) dispositionStr = 'Friendly';
         else if (memory.disposition < -20) dispositionStr = 'Hostile';
         else if (memory.disposition < -5) dispositionStr = 'Suspicious';
      }
      return `- ${npc.name} (${npc.role}): ${dispositionStr}`;
    });
    parts.push(`## NPCS\n${npcLines.join('\n')}`);
  }

  // --- ACTIVE QUESTS ---
  const activeQuests = gameState.questLog
    .filter(q => q.status === 'Active')
    .map(q => `- ${q.title}`);

  if (activeQuests.length > 0) {
    parts.push(`## ACTIVE QUESTS\n${activeQuests.join('\n')}`);
  }

  // --- RECENT HISTORY ---
  const recentHistory = gameState.messages
    .filter(m => m.sender === 'system' || m.sender === 'player' || m.sender === 'npc')
    .slice(-5) // Increased from 3 to 5 for better context
    .map(m => {
      const role = m.sender === 'player' ? 'Player' : (m.sender === 'npc' ? 'NPC' : 'Narrator');
      return `[${role}]: ${m.text}`;
    })
    .join('\n');

  if (recentHistory) {
    parts.push(`## RECENT HISTORY\n${recentHistory}`);
  }

  return parts.join('\n\n');
}
