/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:57
 * Dependents: PartyMemberCard.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file partyStatUtils.ts
 * Utility functions for calculating derived combat stats for party member display.
 * These functions compute values like spell save DC, attack bonuses, and initiative
 * that are derived from a character's base stats, equipment, and class features.
 */
import { PlayerCharacter } from '../../types/index.js';
/**
 * Represents a single attack bonus with its source and value.
 * Used to display melee, ranged, and spell attack bonuses on party cards.
 */
export interface AttackBonus {
    /** Type of attack: melee weapon, ranged weapon, or spell */
    type: 'melee' | 'ranged' | 'spell';
    /** The total attack bonus (proficiency + ability mod + magic bonuses) */
    bonus: number;
    /** Formatted string like "+5" or "-1" for display */
    bonusString: string;
    /** Source of the bonus (e.g., "Longsword", "Longbow", "Spell Attack") */
    source: string;
    /** Icon name from IconRegistry to display (e.g., "sword", "bow_arrow", "magic_staff") */
    iconName: string;
}
/**
 * Collection of all attack bonuses for a character.
 * Characters may have multiple attack types available.
 */
export interface CharacterAttackBonuses {
    /** Best melee attack bonus (usually STR-based, or DEX for finesse) */
    melee: AttackBonus | null;
    /** Best ranged attack bonus (usually DEX-based) */
    ranged: AttackBonus | null;
    /** Spell attack bonus (if character has spellcasting) */
    spell: AttackBonus | null;
}
/**
 * Calculates the spell save DC for a character.
 * Formula: 8 + Proficiency Bonus + Spellcasting Ability Modifier
 *
 * @param character - The player character to calculate DC for
 * @returns The spell save DC, or null if the character has no spellcasting ability
 *
 * @example
 * // A level 5 Wizard with 16 Intelligence
 * // Proficiency: +3, Int Mod: +3
 * // DC = 8 + 3 + 3 = 14
 * const dc = calculateSpellSaveDC(wizard);
 */
export declare function calculateSpellSaveDC(character: PlayerCharacter): number | null;
/**
 * Calculates all attack bonuses for a character.
 * Returns melee, ranged, and spell attack bonuses where applicable.
 *
 * @param character - The player character
 * @returns Object containing all attack bonuses
 *
 * @example
 * const bonuses = calculateAttackBonuses(myFighter);
 * // bonuses.melee.bonusString === "+7"
 * // bonuses.ranged.bonusString === "+5"
 * // bonuses.spell === null (fighters don't have spellcasting by default)
 */
export declare function calculateAttackBonuses(character: PlayerCharacter): CharacterAttackBonuses;
/**
 * Calculates the initiative modifier for a character.
 * Base formula: DEX Modifier + any bonuses from feats/items
 *
 * @param character - The player character
 * @returns The initiative modifier as a number
 */
export declare function calculateInitiativeModifier(character: PlayerCharacter): number;
/**
 * Formats an initiative modifier for display.
 *
 * @param modifier - The initiative modifier value
 * @returns Formatted string like "+3" or "-1"
 */
export declare function formatInitiativeModifier(modifier: number): string;
/**
 * Gets the movement speed for a character, considering transport mode.
 *
 * @param character - The player character
 * @returns Movement speed in feet
 */
export declare function getMovementSpeed(character: PlayerCharacter): number;
/**
 * Calculates the total hit dice available across all pools.
 * Useful for a quick summary display.
 *
 * @param character - The player character
 * @returns Object with current and max total hit dice
 */
export declare function getTotalHitDice(character: PlayerCharacter): {
    current: number;
    max: number;
};
/**
 * Gets the primary hit die size for a character (for icon display).
 * For multiclass characters, returns the die from their primary class.
 *
 * @param character - The player character
 * @returns The die size (6, 8, 10, or 12)
 */
export declare function getPrimaryHitDieSize(character: PlayerCharacter): 6 | 8 | 10 | 12;
