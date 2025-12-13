/**
 * @file settlementGeneration.ts
 * Utilities for determining settlement characteristics based on race, background, and culture
 */

import { VillagePersonality } from '../services/villageGenerator';
import { Location, GameState } from '../types';

export interface SettlementType {
  name: string;
  description: string;
  dominantRace?: string;
  architecturalStyle: VillagePersonality['architecturalStyle'];
  governingBody: VillagePersonality['governingBody'];
  primaryIndustry: VillagePersonality['primaryIndustry'];
  culture: VillagePersonality['culture'];
  wealth: VillagePersonality['wealth'];
  population?: string;
}

// Race-appropriate settlement types
export const SETTLEMENT_TYPES: Record<string, SettlementType> = {
  // Human settlements
  human_town: {
    name: 'Human Town',
    description: 'A bustling human settlement with diverse architecture and commerce',
    dominantRace: 'human',
    architecturalStyle: 'colonial',
    governingBody: 'mayor',
    primaryIndustry: 'trade',
    culture: 'festive',
    wealth: 'comfortable'
  },

  // Elven settlements
  elven_glade: {
    name: 'Elven Glade',
    description: 'An ancient forest settlement with graceful tree-platform homes',
    dominantRace: 'elf',
    architecturalStyle: 'magical',
    governingBody: 'council',
    primaryIndustry: 'crafting',
    culture: 'scholarly',
    wealth: 'rich'
  },

  // Dwarven settlements
  dwarven_hold: {
    name: 'Dwarven Hold',
    description: 'A sturdy underground fortress with stone halls and forges',
    dominantRace: 'dwarf',
    architecturalStyle: 'industrial',
    governingBody: 'elder',
    primaryIndustry: 'mining',
    culture: 'stoic',
    wealth: 'rich'
  },

  // Orcish settlements
  orcish_camp: {
    name: 'Orcish War Camp',
    description: 'A martial encampment with hide tents and trophy displays',
    dominantRace: 'orc',
    architecturalStyle: 'tribal',
    governingBody: 'warlord',
    primaryIndustry: 'military',
    culture: 'martial',
    wealth: 'poor'
  },

  // Halfling settlements
  halfling_hamlet: {
    name: 'Halfling Hamlet',
    description: 'A cozy community of well-kept homes and abundant gardens',
    dominantRace: 'halfling',
    architecturalStyle: 'colonial',
    governingBody: 'mayor',
    primaryIndustry: 'agriculture',
    culture: 'festive',
    wealth: 'comfortable'
  },

  // Gnome settlements
  gnomish_workshop: {
    name: 'Gnomish Workshop',
    description: 'A cluttered district of workshops and experimental devices',
    dominantRace: 'gnome',
    architecturalStyle: 'magical',
    governingBody: 'guild',
    primaryIndustry: 'crafting',
    culture: 'scholarly',
    wealth: 'comfortable'
  },

  // Dragonborn settlements
  dragonborn_outpost: {
    name: 'Dragonborn Outpost',
    description: 'A fortified settlement honoring draconic traditions',
    dominantRace: 'dragonborn',
    architecturalStyle: 'martial',
    governingBody: 'council',
    primaryIndustry: 'military',
    culture: 'martial',
    wealth: 'comfortable'
  },

  // Tiefling settlements
  tiefling_enclave: {
    name: 'Tiefling Enclave',
    description: 'A shadowy district with infernal influences and guarded secrets',
    dominantRace: 'tiefling',
    architecturalStyle: 'magical',
    governingBody: 'council',
    primaryIndustry: 'trade',
    culture: 'stoic',
    wealth: 'comfortable'
  },

  // Generic settlements for mixed populations
  frontier_village: {
    name: 'Frontier Village',
    description: 'A rugged settlement on the edge of civilization',
    architecturalStyle: 'colonial',
    governingBody: 'mayor',
    primaryIndustry: 'agriculture',
    culture: 'stoic',
    wealth: 'poor'
  },

  port_city: {
    name: 'Port City',
    description: 'A maritime settlement with docks and shipyards',
    architecturalStyle: 'aquatic',
    governingBody: 'guild',
    primaryIndustry: 'fishing',
    culture: 'festive',
    wealth: 'comfortable'
  },

  magical_academy: {
    name: 'Magical Academy',
    description: 'A center of learning with towers and arcane workshops',
    architecturalStyle: 'magical',
    governingBody: 'council',
    primaryIndustry: 'scholarship',
    culture: 'scholarly',
    wealth: 'rich'
  }
};

/**
 * Determines the most appropriate settlement type for a given race and context
 */
export const getSettlementTypeForRace = (raceId?: string, biomeId: string = 'plains'): SettlementType => {
  // Direct race matches
  if (raceId === 'human') return SETTLEMENT_TYPES.human_town;
  if (raceId === 'elf') return SETTLEMENT_TYPES.elven_glade;
  if (raceId === 'dwarf') return SETTLEMENT_TYPES.dwarven_hold;
  if (raceId === 'orc') return SETTLEMENT_TYPES.orcish_camp;
  if (raceId === 'halfling') return SETTLEMENT_TYPES.halfling_hamlet;
  if (raceId === 'gnome') return SETTLEMENT_TYPES.gnomish_workshop;
  if (raceId === 'dragonborn') return SETTLEMENT_TYPES.dragonborn_outpost;
  if (raceId === 'tiefling') return SETTLEMENT_TYPES.tiefling_enclave;

  // Biome-based fallbacks
  if (biomeId === 'ocean') return SETTLEMENT_TYPES.port_city;
  if (biomeId === 'forest') return SETTLEMENT_TYPES.elven_glade;
  if (biomeId === 'mountain') return SETTLEMENT_TYPES.dwarven_hold;

  // Default
  return SETTLEMENT_TYPES.frontier_village;
};

/**
 * Creates a VillagePersonality based on settlement type
 */
export const createPersonalityFromSettlementType = (settlementType: SettlementType, biomeId: string): VillagePersonality => {
  return {
    wealth: settlementType.wealth,
    culture: settlementType.culture,
    biomeStyle: biomeId === 'desert' ? 'arid' : biomeId === 'ocean' ? 'coastal' : biomeId === 'swamp' ? 'swampy' : 'temperate',
    population: 'medium', // Default, can be overridden
    dominantRace: settlementType.dominantRace as VillagePersonality['dominantRace'],
    architecturalStyle: settlementType.architecturalStyle,
    governingBody: settlementType.governingBody,
    primaryIndustry: settlementType.primaryIndustry
  };
};

/**
 * Determines settlement information for town generation based on location
 */
export const determineSettlementInfo = (location: Location, gameState: GameState): SettlementType => {
  // For predefined town locations, determine settlement type based on location name/id
  if (!location.id.startsWith('coord_')) {
    const locationName = location.name.toLowerCase();
    const locationId = location.id.toLowerCase();

    // Check for specific known settlements
    if (locationId.includes('aralia_town') || locationName.includes('aralia')) {
      return SETTLEMENT_TYPES.human_town;
    }

    // Generic town detection based on keywords
    if (locationName.includes('town') || locationName.includes('city')) {
      return SETTLEMENT_TYPES.human_town;
    }

    if (locationName.includes('village') || locationName.includes('hamlet')) {
      // Smaller settlement
      const smallSettlement = { ...SETTLEMENT_TYPES.human_town };
      smallSettlement.population = 'small';
      smallSettlement.wealth = 'poor';
      return smallSettlement;
    }
  }

  // For coordinate-based locations (procedural settlements), use biome and character info
  const biomeId = location.biomeId || 'plains';
  const characterRace = gameState?.party?.[0]?.race?.id; // Get player's race id if available

  return getSettlementTypeForRace(characterRace, biomeId);
};

/**
 * Determines if a settlement should be character-driven based on location and context
 */
export const shouldGenerateCharacterDrivenSettlement = (
  worldX: number,
  worldY: number,
  isPlayerStartingArea: boolean = false,
  characterRace?: string
): boolean => {
  // Starting areas are always character-driven for engagement
  if (isPlayerStartingArea) return true;

  // Settlements near starting area have higher chance of character influence
  const distanceFromStart = Math.abs(worldX - 15) + Math.abs(worldY - 10); // Assuming starting coords
  const influenceChance = Math.max(0.1, 1 - (distanceFromStart / 50)); // Decreases with distance

  // Character race increases chance of culturally similar settlements
  const raceModifier = characterRace ? 0.2 : 0; // 20% bonus if character race is known

  return Math.random() < (influenceChance + raceModifier);
};

/**
 * Generates settlement parameters based on character influence level
 */
export const generateSettlementParameters = (
  worldX: number,
  worldY: number,
  biomeId: string,
  isStartingSettlement: boolean = false,
  characterRace?: string
): {
  dominantRace?: string;
  settlementType: SettlementType | null;
} => {
  if (isStartingSettlement && characterRace) {
    // Character-driven starting settlement
    const settlementType = getSettlementTypeForRace(characterRace, biomeId);
    return {
      dominantRace: characterRace,
      settlementType
    };
  }

  const isCharacterDriven = shouldGenerateCharacterDrivenSettlement(worldX, worldY, false, characterRace);

  if (isCharacterDriven && characterRace && Math.random() > 0.6) {
    // Occasionally generate character-race influenced settlements
    const settlementType = getSettlementTypeForRace(characterRace, biomeId);
    return {
      dominantRace: characterRace,
      settlementType
    };
  }

  // Natural settlement generation
  return {
    dominantRace: undefined,
    settlementType: null
  };
};
