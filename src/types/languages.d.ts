/**
 * @file src/types/languages.ts
 * Defines the standardized taxonomy for D&D 5e Languages.
 */
/**
 * The standard and exotic languages spoken across the D&D multiverse.
 *
 * TAXONOMIST NOTE:
 * This enum replaces magic strings for languages.
 * Use this for character sheets, NPC stats, and deciphering mechanics.
 */
export declare enum Language {
    Common = "Common",
    Dwarvish = "Dwarvish",
    Elvish = "Elvish",
    Giant = "Giant",
    Gnomish = "Gnomish",
    Goblin = "Goblin",
    Halfling = "Halfling",
    Orc = "Orc",
    Abyssal = "Abyssal",
    Celestial = "Celestial",
    Draconic = "Draconic",
    DeepSpeech = "Deep Speech",
    Infernal = "Infernal",
    Primordial = "Primordial",
    Sylvan = "Sylvan",
    Undercommon = "Undercommon",
    Druidic = "Druidic",
    ThievesCant = "Thieves' Cant"
}
/**
 * The script used to write a language.
 */
export declare enum Script {
    Common = "Common",
    Dwarvish = "Dwarvish",
    Elvish = "Elvish",
    Infernal = "Infernal",
    Celestial = "Celestial",
    Draconic = "Draconic",
    None = "None"
}
/**
 * Rarity determines availability and typical knowledge.
 */
export declare enum LanguageRarity {
    Standard = "Standard",
    Exotic = "Exotic",
    Secret = "Secret"
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
export declare const LanguageDefinitions: Record<Language, LanguageTraits>;
