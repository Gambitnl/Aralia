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
import { BIOMES } from './data/biomes';
import { ALL_ITEMS, WEAPONS_DATA } from './data/items';
import { MASTERY_DATA } from './data/masteryData';
import { CLASSES_DATA, AVAILABLE_CLASSES } from './data/classes';
import { XP_THRESHOLDS_BY_LEVEL, XP_BY_CR, ABILITY_SCORE_NAMES, RELEVANT_SPELLCASTING_ABILITIES } from './data/dndData';
import { LOCATIONS, STARTING_LOCATION_ID } from './data/world/locations';
import { NPCS } from './data/world/npcs';
import { COMPANIONS } from './data/companions';
import { TTS_VOICE_OPTIONS } from './data/settings/ttsOptions';
declare const RACES_DATA: Record<string, import("./types/character.ts").Race>;
declare const DRAGONBORN_ANCESTRIES: Record<import("./types/character.ts").DraconicAncestorType, import("./types/character.ts").DraconicAncestryInfo>, GIANT_ANCESTRIES: import("./types/character.ts").GiantAncestryBenefit[], TIEFLING_LEGACIES: import("./types/character.ts").FiendishLegacy[];
export { RACES_DATA, DRAGONBORN_ANCESTRIES, GIANT_ANCESTRIES, TIEFLING_LEGACIES, CLASSES_DATA, AVAILABLE_CLASSES, ALL_ITEMS as ITEMS, WEAPONS_DATA, MASTERY_DATA, BIOMES, LOCATIONS, // Re-export from new location
STARTING_LOCATION_ID, // Re-export from new location
NPCS, // Re-export from new location
COMPANIONS, // Re-export from new location
TTS_VOICE_OPTIONS, // Re-export from new location
XP_THRESHOLDS_BY_LEVEL, // Re-export from new dndData
XP_BY_CR, // Re-export from new dndData
ABILITY_SCORE_NAMES, RELEVANT_SPELLCASTING_ABILITIES, };
