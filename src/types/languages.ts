/**
 * @file src/types/languages.ts
 * Defines the standardized taxonomy for D&D 5e Languages.
 * Source: Player's Handbook (2014/2024)
 */

/**
 * The standard and exotic languages spoken across the D&D multiverse.
 *
 * TAXONOMIST NOTE:
 * This enum replaces magic strings for languages.
 * Use this for character sheets, NPC stats, and deciphering mechanics.
 */
export enum Language {
  // Standard Languages
  Common = 'Common',
  Dwarvish = 'Dwarvish',
  Elvish = 'Elvish',
  Giant = 'Giant',
  Gnomish = 'Gnomish',
  Goblin = 'Goblin',
  Halfling = 'Halfling',
  Orc = 'Orc',

  // Exotic Languages
  Abyssal = 'Abyssal',
  Celestial = 'Celestial',
  Draconic = 'Draconic',
  DeepSpeech = 'Deep Speech',
  Infernal = 'Infernal',
  Primordial = 'Primordial',
  Sylvan = 'Sylvan',
  Undercommon = 'Undercommon',

  // Class/Secret Languages
  Druidic = 'Druidic',
  ThievesCant = 'Thieves\' Cant',
}

/**
 * The script used to write a language.
 */
export enum Script {
  Common = 'Common',
  Dwarvish = 'Dwarvish',
  Elvish = 'Elvish',
  Infernal = 'Infernal',
  Celestial = 'Celestial',
  Draconic = 'Draconic',
  None = 'None',
}

/**
 * Rarity determines availability and typical knowledge.
 */
export enum LanguageRarity {
  Standard = 'Standard',
  Exotic = 'Exotic',
  Secret = 'Secret',
}

/**
 * Mechanical and lore traits associated with a language.
 */
export interface LanguageTraits {
  script: Script;
  rarity: LanguageRarity;
  typicalSpeakers: string[];
  description?: string;
}

/**
 * Complete definitions for all supported languages.
 */
export const LanguageDefinitions: Record<Language, LanguageTraits> = {
  // Standard
  [Language.Common]: {
    script: Script.Common,
    rarity: LanguageRarity.Standard,
    typicalSpeakers: ['Humans'],
  },
  [Language.Dwarvish]: {
    script: Script.Dwarvish,
    rarity: LanguageRarity.Standard,
    typicalSpeakers: ['Dwarves'],
  },
  [Language.Elvish]: {
    script: Script.Elvish,
    rarity: LanguageRarity.Standard,
    typicalSpeakers: ['Elves'],
  },
  [Language.Giant]: {
    script: Script.Dwarvish,
    rarity: LanguageRarity.Standard,
    typicalSpeakers: ['Ogres', 'Giants'],
  },
  [Language.Gnomish]: {
    script: Script.Dwarvish,
    rarity: LanguageRarity.Standard,
    typicalSpeakers: ['Gnomes'],
  },
  [Language.Goblin]: {
    script: Script.Dwarvish,
    rarity: LanguageRarity.Standard,
    typicalSpeakers: ['Goblinoids'],
  },
  [Language.Halfling]: {
    script: Script.Common,
    rarity: LanguageRarity.Standard,
    typicalSpeakers: ['Halflings'],
  },
  [Language.Orc]: {
    script: Script.Dwarvish,
    rarity: LanguageRarity.Standard,
    typicalSpeakers: ['Orcs'],
  },

  // Exotic
  [Language.Abyssal]: {
    script: Script.Infernal,
    rarity: LanguageRarity.Exotic,
    typicalSpeakers: ['Demons'],
  },
  [Language.Celestial]: {
    script: Script.Celestial,
    rarity: LanguageRarity.Exotic,
    typicalSpeakers: ['Celestials'],
  },
  [Language.Draconic]: {
    script: Script.Draconic,
    rarity: LanguageRarity.Exotic,
    typicalSpeakers: ['Dragons', 'Dragonborn'],
  },
  [Language.DeepSpeech]: {
    script: Script.None,
    rarity: LanguageRarity.Exotic,
    typicalSpeakers: ['Aboleths', 'Cloakers'],
  },
  [Language.Infernal]: {
    script: Script.Infernal,
    rarity: LanguageRarity.Exotic,
    typicalSpeakers: ['Devils'],
  },
  [Language.Primordial]: {
    script: Script.Dwarvish,
    rarity: LanguageRarity.Exotic,
    typicalSpeakers: ['Elementals'],
  },
  [Language.Sylvan]: {
    script: Script.Elvish,
    rarity: LanguageRarity.Exotic,
    typicalSpeakers: ['Fey creatures'],
  },
  [Language.Undercommon]: {
    script: Script.Elvish,
    rarity: LanguageRarity.Exotic,
    typicalSpeakers: ['Underworld traders'],
  },

  // Secret
  [Language.Druidic]: {
    script: Script.None, // Has its own script usually, but handled as secret/none for generic purposes unless adding Druidic script
    rarity: LanguageRarity.Secret,
    typicalSpeakers: ['Druids'],
  },
  [Language.ThievesCant]: {
    script: Script.None, // Spoken code mixed with other languages
    rarity: LanguageRarity.Secret,
    typicalSpeakers: ['Rogues'],
  },
};
