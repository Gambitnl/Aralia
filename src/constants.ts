/**
 * @file src/constants.ts
 * This file (now at src/constants.ts) defines global constants and foundational game data
 * for the Aralia RPG application. It includes game phases, D&D related data
 * (ability scores, skills, spells, classes), initial game world data (items, NPCs, locations),
 * and TTS voice options.
 * It often aggregates or re-exports data from more specific data modules (e.g., from src/data/`).
 */

import {
  PlayerCharacter,
  Race,
  Class as CharClass,
  AbilityScores,
  Skill,
  FightingStyle,
  AbilityScoreName,
  Spell,
  Location,
  Item,
  NPC,
  ClassFeature,
  DraconicAncestryInfo,
  ElvenLineage,
  ElvenLineageType,
  GnomeSubrace,
  GnomeSubraceType,
  TTSVoiceOption,
  GiantAncestryBenefit, 
  GiantAncestryType,
  FiendishLegacy, 
  FiendishLegacyType,
  Mastery,
  // MapTile and Biome types are imported where needed (e.g. App.tsx, mapService.ts) directly from ../types
} from './types'; 

// Import aggregated data from specialized modules
import { ALL_RACES_DATA, RACE_DATA_BUNDLE } from './data/races/index.ts';
import { BIOMES } from './data/biomes';
import { ITEMS, WEAPONS_DATA } from './data/items';
import { MASTERY_DATA } from './data/masteryData';
import { SKILLS_DATA } from './data/skills';
import { CLASSES_DATA, AVAILABLE_CLASSES } from './data/classes';
import { XP_THRESHOLDS_BY_LEVEL, XP_BY_CR } from './data/dndData';
import { MONSTERS_DATA } from './data/monsters';

// Import newly separated data modules
import { LOCATIONS, STARTING_LOCATION_ID } from './data/world/locations';
import { NPCS } from './data/world/npcs';
import { TTS_VOICE_OPTIONS } from './data/settings/ttsOptions';
import { USE_DUMMY_CHARACTER_FOR_DEV, initializeDummyCharacterData, getDummyInitialInventory, setInitializedDummyCharacter } from './data/dev/dummyCharacter';


// Define RACES_DATA using the imported ALL_RACES_DATA
const RACES_DATA = ALL_RACES_DATA;

// D&D Data
export const ABILITY_SCORE_NAMES: AbilityScoreName[] = [
  'Strength',
  'Dexterity',
  'Constitution',
  'Intelligence',
  'Wisdom',
  'Charisma',
];
export const RELEVANT_SPELLCASTING_ABILITIES: AbilityScoreName[] = [
  'Intelligence',
  'Wisdom',
  'Charisma',
];

// Initialize DUMMY_PARTY_FOR_DEV after all its dependencies (RACES_DATA, etc.) are defined.
const initializedDummyParty = initializeDummyCharacterData(RACES_DATA, CLASSES_DATA, SKILLS_DATA);
setInitializedDummyCharacter(initializedDummyParty);
export const initialInventoryForDummyCharacter = getDummyInitialInventory(ITEMS);
// Now DUMMY_PARTY_FOR_DEV is populated in dummyCharacter.ts and can be re-exported.
export { DUMMY_PARTY_FOR_DEV } from './data/dev/dummyCharacter';


const {
  dragonbornAncestries: DRAGONBORN_ANCESTRIES,
  goliathGiantAncestries: GIANT_ANCESTRIES,
  tieflingLegacies: TIEFLING_LEGACIES,
} = RACE_DATA_BUNDLE;

// Re-export data imported from specialized modules
export {
  SKILLS_DATA,
  RACES_DATA,
  DRAGONBORN_ANCESTRIES,
  GIANT_ANCESTRIES,
  TIEFLING_LEGACIES,
  CLASSES_DATA,
  AVAILABLE_CLASSES,
  ITEMS,
  WEAPONS_DATA,
  MASTERY_DATA,
  BIOMES,
  LOCATIONS, // Re-export from new location
  STARTING_LOCATION_ID, // Re-export from new location
  NPCS, // Re-export from new location
  TTS_VOICE_OPTIONS, // Re-export from new location
  USE_DUMMY_CHARACTER_FOR_DEV, // Re-export from new location
  XP_THRESHOLDS_BY_LEVEL, // Re-export from new dndData
  XP_BY_CR, // Re-export from new dndData
  MONSTERS_DATA, // Re-export from new monsterData
};
