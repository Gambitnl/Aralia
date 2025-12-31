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

import {
  // TODO(lint-intent): 'PlayerCharacter' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  PlayerCharacter as _PlayerCharacter,
  // TODO(lint-intent): 'Race' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  Race as _Race,
  // TODO(lint-intent): 'CharClass' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  Class as _CharClass,
  // TODO(lint-intent): 'AbilityScores' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  AbilityScores as _AbilityScores,
  // TODO(lint-intent): 'Skill' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  Skill as _Skill,
  // TODO(lint-intent): 'FightingStyle' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  FightingStyle as _FightingStyle,
  // TODO(lint-intent): 'AbilityScoreName' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  AbilityScoreName as _AbilityScoreName,
  // TODO(lint-intent): 'Spell' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  Spell as _Spell,
  // TODO(lint-intent): 'Location' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  Location as _Location,
  // TODO(lint-intent): 'Item' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  Item as _Item,
  // TODO(lint-intent): 'NPC' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  NPC as _NPC,
  // TODO(lint-intent): 'ClassFeature' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  ClassFeature as _ClassFeature,
  // TODO(lint-intent): 'DraconicAncestryInfo' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  DraconicAncestryInfo as _DraconicAncestryInfo,
  // TODO(lint-intent): 'ElvenLineage' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  ElvenLineage as _ElvenLineage,
  // TODO(lint-intent): 'ElvenLineageType' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  ElvenLineageType as _ElvenLineageType,
  // TODO(lint-intent): 'GnomeSubrace' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  GnomeSubrace as _GnomeSubrace,
  // TODO(lint-intent): 'GnomeSubraceType' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  GnomeSubraceType as _GnomeSubraceType,
  // TODO(lint-intent): 'TTSVoiceOption' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  TTSVoiceOption as _TTSVoiceOption,
  // TODO(lint-intent): 'GiantAncestryBenefit' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  GiantAncestryBenefit as _GiantAncestryBenefit,
  // TODO(lint-intent): 'GiantAncestryType' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  GiantAncestryType as _GiantAncestryType,
  // TODO(lint-intent): 'FiendishLegacy' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  FiendishLegacy as _FiendishLegacy,
  // TODO(lint-intent): 'FiendishLegacyType' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  FiendishLegacyType as _FiendishLegacyType,
  // TODO(lint-intent): 'Mastery' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  Mastery as _Mastery,
  // MapTile and Biome types are imported where needed (e.g. App.tsx, mapService.ts) directly from ../types
} from './types';

// Import aggregated data from specialized modules
import { ALL_RACES_DATA, RACE_DATA_BUNDLE } from './data/races/index.ts';
import { BIOMES } from './data/biomes';
import { ITEMS, WEAPONS_DATA } from './data/items';
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
  ITEMS,
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
