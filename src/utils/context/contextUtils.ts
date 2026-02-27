// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:45
 * Dependents: context/index.ts, contextUtils.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/contextUtils.ts
 * Utility functions for generating rich narrative context for AI processing.
 */
import { GameState, PlayerCharacter, NPC, Location } from '../../types';
import { QuestObjective } from '../../types/quests';
import { BIOMES, ITEMS } from '../../constants';
import { getSubmapTileInfo } from '../spatial/submapUtils';
import { SUBMAP_DIMENSIONS } from '../../config/mapConfig';
import { getTimeModifiers, formatGameTime } from '../core/timeUtils';
import { BACKGROUNDS } from '../../data/backgrounds';
import { CLASSES_DATA } from '../../data/classes';

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
    // Defensive: playerCharacter.conditions can be undefined in some entry points; default to empty array.
    const conditionsList = Array.isArray((playerCharacter as any).conditions) ? (playerCharacter as any).conditions : [];
    const conditions = conditionsList.length > 0
      ? conditionsList.join(', ')
      : 'None';

    let playerHeader = `## PLAYER\nName: ${playerCharacter.name} | HP: ${playerCharacter.hp}/${playerCharacter.maxHp} | Conditions: ${conditions}`;

    // Add Age if available
    if (playerCharacter.age) {
        playerHeader += ` | Age: ${playerCharacter.age}`;
    }

    // Add detailed Race/Class string
    const classData = CLASSES_DATA[playerCharacter.class.id];
    const classFlavor = classData ? `\nClass Flavor: ${classData.description}` : '';
    playerHeader += `\nRace: ${playerCharacter.race.name}\nClass: ${playerCharacter.class.name}${classFlavor}`;

    parts.push(playerHeader);

    // --- CHARACTER DETAILS ---
    // Enriched context from Background data to give the AI a sense of the character's "vibe"
    if (playerCharacter.background) {
      const bg = BACKGROUNDS[playerCharacter.background];
      if (bg) {
        let details = `Background: ${bg.name}\nArchetype: ${bg.description}`;

        // Add Background Feature for specific narrative leverage
        if (bg.feature) {
             details += `\nBackground Feature: "${bg.feature.name}" - ${bg.feature.description}`;
        }

        // Visual description logic
        if (playerCharacter.visualDescription) {
             details += `\nAppearance: ${playerCharacter.visualDescription}`;
        } else if (playerCharacter.visuals) {
            // Implicit fallback based on gender/race
            details += `\nAppearance: A ${playerCharacter.visuals.gender} ${playerCharacter.race.name}.`;
        }

        parts.push(`## CHARACTER DETAILS\n${details}`);
      }
    }
  } else {
    parts.push(`## PLAYER\nAn unknown adventurer`);
  }

  // --- ATMOSPHERE & ENVIRONMENT ---
  // Moved time/weather here for better organization
  const timeDesc = formatGameTime(gameState.gameTime, { hour: '2-digit', minute: '2-digit', hour12: true });
  // Use time modifiers for atmospheric flavor
  const timeModifiers = getTimeModifiers(gameState.gameTime);
  let atmosphereDetails = `Time: ${timeDesc}`;

  const environment = (gameState as any).environment;
  if (environment && environment.currentCondition) {        
     // If rich weather state exists
     atmosphereDetails += ` | Weather: ${environment.currentCondition.name} (Temp: ${environment.temperature ?? 'n/a'}°F)`;
     if (environment.windSpeed !== undefined) {
        atmosphereDetails += `, Wind: ${environment.windSpeed} mph`;
     }
     if (environment.currentCondition.description) {
         atmosphereDetails += `\nLook/Feel: ${environment.currentCondition.description}`;
     }
  } else {
     // Fallback to simple description
     atmosphereDetails += ` (${timeModifiers.description})`;
  }

  parts.push(`## ATMOSPHERE & ENVIRONMENT\n${atmosphereDetails}`);


  // --- LOCATION ---
  const biomeName = BIOMES[currentLocation.biomeId]?.name || 'Unknown Biome';
  let locationDetails = `${currentLocation.name} (${biomeName})`;

  // Submap Context
  if (gameState.subMapCoordinates) {
    const submapTileInfo = getSubmapTileInfo(gameState.worldSeed, currentLocation.mapCoordinates, currentLocation.biomeId, SUBMAP_DIMENSIONS, gameState.subMapCoordinates);
    if (submapTileInfo) {
      locationDetails += `\nImmediate Terrain: ${submapTileInfo.effectiveTerrainType}`;
      const activeFeatureConfig = (submapTileInfo as any).activeFeatureConfig;
      if (activeFeatureConfig) {
         locationDetails += ` | Feature: ${activeFeatureConfig.name}`;
      }
    }
  }

  // Visible Items
  const itemsInLocationNames = currentLocation.itemIds?.map((id) => ITEMS[id]?.name).filter(Boolean).join(', ');
  if (itemsInLocationNames) {
      locationDetails += `\nVisible Items: ${itemsInLocationNames}`;
  }

  parts.push(`## LOCATION\n${locationDetails}`);

  // --- WORLD RUMORS & NEWS ---
  // Filter active rumors to show relevant ones.
  // 1. Sort by recency (newest first)
  // 2. Prioritize local rumors if we had region data
  // 3. Take top 3
  if (gameState.activeRumors && gameState.activeRumors.length > 0) {
      // Simple sort by timestamp descending
      const sortedRumors = [...gameState.activeRumors].sort((a, b) => b.timestamp - a.timestamp);
      const topRumors = sortedRumors.slice(0, 3);

      const rumorLines = topRumors.map(r => {
          let prefix = "Rumor:";
          if (r.type === 'skirmish') prefix = "War News:";
          if (r.type === 'market') prefix = "Economy:";

          return `- ${prefix} "${r.text}"`;
      });

      parts.push(`## WORLD RUMORS & NEWS\n${rumorLines.join('\n')}`);
  }

  // --- FACTIONS & POLITICS ---
  // Identify factions present in the location via NPCs
  const presentFactions = new Set<string>();
  npcsInLocation.forEach(npc => {
    if (npc.faction) {
      presentFactions.add(npc.faction);
    }
  });

  if (presentFactions.size > 0 && gameState.factions && gameState.playerFactionStandings) {
    const factionDetails: string[] = [];

    presentFactions.forEach(factionId => {
      const faction = gameState.factions[factionId];
      const standing = gameState.playerFactionStandings[factionId];

      if (faction) {
        let details = `- ${faction.name}: ${faction.description}`;
        if (standing) {
          details += ` | Standing: ${standing.publicStanding} (Rank: ${standing.rankId})`;
        } else {
            details += ` | Standing: Unknown`;
        }
        factionDetails.push(details);
      }
    });

    if (factionDetails.length > 0) {
      parts.push(`## FACTIONS & POLITICS\n${factionDetails.join('\n')}`);
    }
  }

  // --- NOTORIETY ---
  // Include if there's any global heat or significant local heat
  const globalHeat = gameState.notoriety?.globalHeat || 0;
  const localHeat = gameState.notoriety?.localHeat?.[currentLocation.id] || 0;

  if (globalHeat > 0 || localHeat > 0) {
      parts.push(`## NOTORIETY\nGlobal Heat: ${globalHeat} | Local Heat: ${localHeat}`);
  }


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
  // Enriched Quest Context: Includes descriptions and current objectives
  // TODO: Add defensive fallbacks for `gameState.questLog` and `gameState.messages` so
  // this generator keeps working even when a minimal game state arrives (e.g., tests or resets).
  const activeQuests = (gameState.questLog ?? [])
    .filter(q => q.status === 'Active');

  if (activeQuests.length > 0) {
    const questLines = activeQuests.map(q => {
        let line = `- **${q.title}**: ${q.description}`;
        const objectives: QuestObjective[] = (q as any).objectives || [];
        const activeObjectives = objectives.filter((objective: QuestObjective) => !objective.isCompleted);

        if (activeObjectives.length > 0) {
            const objectiveList = activeObjectives.map((objective: QuestObjective) => `  - [ ] ${objective.description}`).join('\n');
            line += `\n  *Current Objectives:*\n${objectiveList}`;
        }
        return line;
    });
    parts.push(`## ACTIVE QUESTS\n${questLines.join('\n')}`);

    // --- QUEST RELEVANCE ---
    // Highlight if the current location or NPCs are relevant to any active quests
    const relevantNotes: string[] = [];
        activeQuests.forEach(q => {
          // Check Objectives for location name match
          const objectives = (q.objectives || []) as any[];
          const relevantObjectives = objectives.filter((objective: any) => {
            const desc = (objective.description || '').toLowerCase();
            return !objective.isCompleted && (
              desc.includes(currentLocation.name.toLowerCase()) ||
              npcsInLocation.some(npc => desc.includes(npc.name.toLowerCase()))
            );
      });

      if (relevantObjectives.length > 0) {
        relevantNotes.push(`- Quest "${q.title}" is relevant here: ${relevantObjectives.map((objective) => objective.description).join('; ')}`);
      }
    });

    if (relevantNotes.length > 0) {
      parts.push(`## QUEST RELEVANCE (CRITICAL)\n${relevantNotes.join('\n')}\n*Narrator Note: Prioritize these elements in your description.*`);
    }
  }

  // --- RECENT HISTORY ---
  const recentHistory = (gameState.messages ?? [])
    .filter(m => m.sender === 'system' || m.sender === 'player' || m.sender === 'npc')
    .slice(-10) // Increased from 5 to 10 for better narrative continuity
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
