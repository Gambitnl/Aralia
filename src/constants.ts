/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/constants.ts
 * This file (now at src/constants.ts) defines global constants and foundational game data
 * for the Aralia RPG application. It includes game phases, D&D related data
 * (ability scores, skills, spells, classes), initial game world data (items, NPCs, locations),
 * and TTS voice options.
 * It often aggregates or re-exports data from more specific data modules (e.g., from src/data/`).
 */

// All necessary types are now imported directly where needed (e.g., in App.tsx, mapService.ts, etc.)
// Previously this file imported many types that were never used here
// This import statement has been cleaned up to remove the unused type imports

// Import aggregated data from specialized modules
import { ALL_RACES_DATA, RACE_DATA_BUNDLE } from './data/races/index.ts';
import { BIOMES } from './data/biomes';
import { ALL_ITEMS, ITEMS as _BASE_ITEMS, WEAPONS_DATA } from './data/items';
import { MASTERY_DATA } from './data/masteryData';
import { CLASSES_DATA, AVAILABLE_CLASSES } from './data/classes';
import { XP_THRESHOLDS_BY_LEVEL, XP_BY_CR, ABILITY_SCORE_NAMES, RELEVANT_SPELLCASTING_ABILITIES } from './data/dndData';
import { MONSTERS_DATA } from './data/monsters';

// Import newly separated data modules
import { LOCATIONS, STARTING_LOCATION_ID } from './data/world/locations';
import { NPCS } from './data/world/npcs';
import { COMPANIONS } from './data/companions';
import { TTS_VOICE_OPTIONS } from './data/settings/ttsOptions';


// Define RACES_DATA using the imported ALL_RACES_DATA
const RACES_DATA = ALL_RACES_DATA;

const {
  dragonbornAncestries: DRAGONBORN_ANCESTRIES,
  goliathGiantAncestries: GIANT_ANCESTRIES,
  tieflingLegacies: TIEFLING_LEGACIES,
} = RACE_DATA_BUNDLE;

// Re-export data imported from specialized modules
export {
  RACES_DATA,
  DRAGONBORN_ANCESTRIES,
  GIANT_ANCESTRIES,
  TIEFLING_LEGACIES,
  CLASSES_DATA,
  AVAILABLE_CLASSES,
  ALL_ITEMS as ITEMS,
  WEAPONS_DATA,
  MASTERY_DATA,
  BIOMES,
  LOCATIONS, // Re-export from new location
  STARTING_LOCATION_ID, // Re-export from new location
  NPCS, // Re-export from new location
  COMPANIONS, // Re-export from new location
  TTS_VOICE_OPTIONS, // Re-export from new location
  XP_THRESHOLDS_BY_LEVEL, // Re-export from new dndData
  XP_BY_CR, // Re-export from new dndData
  MONSTERS_DATA, // Re-export from new monsterData
  ABILITY_SCORE_NAMES,
  RELEVANT_SPELLCASTING_ABILITIES,
};
