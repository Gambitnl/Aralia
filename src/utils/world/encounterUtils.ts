// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:40:29
 * Dependents: encounterUtils.ts, world/index.ts
 * Imports: 3 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/encounterUtils.ts
 * This file contains utility functions for calculating encounter parameters.
 */
import type { GameMessage, Monster, TempPartyMember } from '../../types';
import { XP_THRESHOLDS_BY_LEVEL, XP_BY_CR } from '../../data/dndData';
import { LOCATIONS, BIOMES, MONSTERS_DATA } from '../../constants';

interface EncounterParameters {
  xpBudget: number;
  themeTags: string[];
}

/**
 * Calculates encounter parameters based on the current game state.
 * @param party - The array of temporary party members.
 * @param currentLocationId - The ID of the party's current location.
 * @param messages - A recent slice of the game message log.
 * @returns An object containing the calculated XP budget and thematic tags.
 */
export function calculateEncounterParameters(
  party: TempPartyMember[],
  currentLocationId: string,
  messages: GameMessage[]
): EncounterParameters {
  // 1. Calculate XP Budget
  const xpBudget = party.reduce((sum, member) => {
    const level = member.level || 1;
    const thresholds = XP_THRESHOLDS_BY_LEVEL[level] || XP_THRESHOLDS_BY_LEVEL[1];
    return sum + (thresholds?.medium || 50);
  }, 0);

  // 2. Derive Theme Tags
  const themeTags = new Set<string>();
  
  // Get tags from location/biome
  const location = LOCATIONS[currentLocationId];
  if (location?.biomeId) {
    const biome = BIOMES[location.biomeId];
    if (biome) {
      themeTags.add(biome.id); // e.g., 'forest', 'cave'
    }
  } else if(currentLocationId.startsWith('coord_')) {
      themeTags.add('wilderness');
  }

  // Analyze messages for thematic keywords
  const keywordMap: Record<string, string> = {
      'undead': 'undead', 'skeleton': 'undead', 'zombie': 'undead', 'ghost': 'undead', 'curse': 'undead', 'necrotic': 'undead',
      'beast': 'beast', 'wolf': 'beast', 'bear': 'beast', 'spider': 'beast', 'boar': 'beast',
      'goblin': 'goblinoid', 'orc': 'goblinoid', 'bugbear': 'goblinoid', 'hobgoblin': 'goblinoid',
      'ruins': 'ruins', 'ancient': 'ruins', 'crumbling': 'ruins',
      'cave': 'cave', 'cavern': 'cave', 'underdark': 'cave',
      'swamp': 'swamp', 'marsh': 'swamp', 'bog': 'swamp',
      'fire': 'fire', 'lava': 'fire', 'volcano': 'fire',
      'elemental': 'elemental',
  };
  
  messages.slice(0, 15).forEach(msg => {
      const text = msg.text.toLowerCase();
      for (const keyword in keywordMap) {
          if (text.includes(keyword)) {
              themeTags.add(keywordMap[keyword]);
          }
      }
  });
  
  if (themeTags.size === 0) {
      themeTags.add('general'); // Fallback tag
  }

  return {
    xpBudget,
    themeTags: Array.from(themeTags),
  };
}


const MAX_MONSTER_COUNT = 4; // Gameplay rule: max 4 monsters in an encounter

/**
 * Validates an AI-suggested encounter. If it's unreasonable (e.g., too many monsters),
 * it rebuilds a more appropriate encounter using the same XP budget.
 * @param aiSuggestions - The array of monster suggestions from the AI.
 * @param themeTags - The thematic tags for the encounter.
 * @returns A new, validated array of Monster objects for the encounter.
 */
export function processAndValidateEncounter(
    aiSuggestions: Monster[],
    themeTags: string[]
): Monster[] {
    const finalEncounter: Monster[] = [];
    const totalSuggestedQuantity = aiSuggestions.reduce((sum, s) => sum + (s.quantity || 0), 0);

    if (totalSuggestedQuantity > MAX_MONSTER_COUNT) {
        console.warn(`Gameplay Override: AI suggested ${totalSuggestedQuantity} monsters, which is too many. Rebuilding encounter...`);

        const totalXpBudget = aiSuggestions.reduce((sum, s) => {
            const xp = XP_BY_CR[s.cr] || 0;
            return sum + (xp * (s.quantity || 0));
        }, 0);

        let remainingXp = totalXpBudget;
        
        let potentialReplacements = Object.values(MONSTERS_DATA)
            .filter(m => (XP_BY_CR[m.baseStats.cr] || 0) >= 50 && themeTags.some(tag => m.tags?.includes(tag)))
            .sort((a, b) => (XP_BY_CR[b.baseStats.cr] || 0) - (XP_BY_CR[a.baseStats.cr] || 0));

        if (potentialReplacements.length === 0) {
            potentialReplacements = Object.values(MONSTERS_DATA)
                .filter(m => (XP_BY_CR[m.baseStats.cr] || 0) >= 50)
                .sort((a, b) => (XP_BY_CR[b.baseStats.cr] || 0) - (XP_BY_CR[a.baseStats.cr] || 0));
        }

        if (potentialReplacements.length === 0) {
            console.error("Failed to rebuild encounter: No suitable replacement monsters found in MONSTER_DATA.");
            return [];
        }

        const monsterCounts: Record<string, number> = {};
        while(remainingXp > 10 && Object.values(monsterCounts).reduce((s, c) => s + c, 0) < MAX_MONSTER_COUNT) {
            const monsterToAdd = potentialReplacements.find(m => (XP_BY_CR[m.baseStats.cr] || 0) <= remainingXp);
            if (monsterToAdd) {
                monsterCounts[monsterToAdd.id] = (monsterCounts[monsterToAdd.id] || 0) + 1;
                remainingXp -= (XP_BY_CR[monsterToAdd.baseStats.cr] || 0);
            } else {
                break;
            }
        }

        for (const id in monsterCounts) {
            const data = MONSTERS_DATA[id];
            if (data) {
                finalEncounter.push({
                    name: data.name,
                    quantity: monsterCounts[id],
                    cr: data.baseStats.cr,
                    description: `A formidable ${data.name.toLowerCase()} found in the ${themeTags.join(' or ')}.`
                });
            }
        }
        
        return finalEncounter;

    } else {
        // Quantity is fine, substitute unknown names if necessary
        for (const suggestion of aiSuggestions) {
            const monsterKey = suggestion.name.toLowerCase().replace(/\s+/g, '_');
            if (MONSTERS_DATA[monsterKey]) {
                finalEncounter.push(suggestion);
            } else {
                const suggestedXP = XP_BY_CR[suggestion.cr] || 0;
                const substitute = Object.values(MONSTERS_DATA)
                    .sort((a, b) => Math.abs((XP_BY_CR[a.baseStats.cr] || 0) - suggestedXP) - Math.abs((XP_BY_CR[b.baseStats.cr] || 0) - suggestedXP))[0];
                
                if (substitute) {
                    console.warn(`Substitution: AI suggested unknown monster "${suggestion.name}". Replacing with "${substitute.name}".`);
                    finalEncounter.push({
                        ...suggestion,
                        name: substitute.name,
                        cr: substitute.baseStats.cr,
                    });
                } else {
                    console.error(`Substitution failed for "${suggestion.name}". No suitable monsters in MONSTER_DATA.`);
                }
            }
        }
        return finalEncounter;
    }
}
