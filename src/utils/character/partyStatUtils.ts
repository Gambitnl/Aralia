// @dependencies-start
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
// @dependencies-end

/**
 * @file partyStatUtils.ts
 * Utility functions for calculating derived combat stats for party member display.
 * These functions compute values like spell save DC, attack bonuses, and initiative
 * that are derived from a character's base stats, equipment, and class features.
 */

import { PlayerCharacter, AbilityScoreName } from '../../types';
import { getAbilityModifierValue, getAbilityModifierString } from './statUtils';

// -----------------------------------------------------------------------------
// Types for attack bonus display
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Spell Save DC Calculation
// -----------------------------------------------------------------------------

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
export function calculateSpellSaveDC(character: PlayerCharacter): number | null {
    // If the character doesn't have a spellcasting ability, they can't cast spells
    if (!character.spellcastingAbility) {
        return null;
    }

    // Get the proficiency bonus (defaults to +2 for level 1-4 characters)
    const profBonus = character.proficiencyBonus ?? 2;

    // Convert spellcasting ability string to proper AbilityScoreName format
    // e.g., "intelligence" -> "Intelligence"
    const abilityName = (character.spellcastingAbility.charAt(0).toUpperCase() +
        character.spellcastingAbility.slice(1)) as AbilityScoreName;

    // Get the ability score and calculate its modifier
    const abilityScore = character.finalAbilityScores[abilityName] ?? 10;
    const abilityMod = getAbilityModifierValue(abilityScore);

    // D&D 5e formula: 8 + proficiency + ability modifier
    return 8 + profBonus + abilityMod;
}

// -----------------------------------------------------------------------------
// Attack Bonus Calculations
// -----------------------------------------------------------------------------

/**
 * Calculates the spell attack bonus for a character.
 * Formula: Proficiency Bonus + Spellcasting Ability Modifier
 *
 * @param character - The player character
 * @returns AttackBonus object for spell attacks, or null if no spellcasting
 */
function calculateSpellAttackBonus(character: PlayerCharacter): AttackBonus | null {
    if (!character.spellcastingAbility) {
        return null;
    }

    const profBonus = character.proficiencyBonus ?? 2;

    // Convert ability name to proper case
    const abilityName = (character.spellcastingAbility.charAt(0).toUpperCase() +
        character.spellcastingAbility.slice(1)) as AbilityScoreName;

    const abilityScore = character.finalAbilityScores[abilityName] ?? 10;
    const abilityMod = getAbilityModifierValue(abilityScore);

    const bonus = profBonus + abilityMod;

    return {
        type: 'spell',
        bonus,
        bonusString: getAbilityModifierString(bonus + 10), // Trick to get +/- format
        source: 'Spell Attack',
        iconName: 'magic_staff'
    };
}

/**
 * Calculates the melee attack bonus for a character.
 * Uses STR by default, or DEX if the character has a finesse weapon equipped
 * or if their DEX is higher (assuming they might use finesse weapons).
 *
 * Formula: Proficiency Bonus + STR/DEX Modifier + Weapon Magic Bonus
 *
 * @param character - The player character
 * @returns AttackBonus object for melee attacks
 */
function calculateMeleeAttackBonus(character: PlayerCharacter): AttackBonus {
    const profBonus = character.proficiencyBonus ?? 2;

    // Get both STR and DEX modifiers
    const strMod = getAbilityModifierValue(character.finalAbilityScores.Strength ?? 10);
    const dexMod = getAbilityModifierValue(character.finalAbilityScores.Dexterity ?? 10);

    // Check for equipped melee weapon to determine if finesse applies
    const mainHandWeapon = character.equippedItems.MainHand;
    const isFinesse = mainHandWeapon?.properties?.includes('Finesse') ?? false;

    // Use the better modifier if finesse is available, otherwise use STR
    // For monks, rogues, etc. who typically use finesse, DEX will often be higher
    let abilityMod = strMod;
    let abilityUsed = 'STR';

    if (isFinesse && dexMod > strMod) {
        abilityMod = dexMod;
        abilityUsed = 'DEX';
    }

    // Check for magic weapon bonus
    const weaponMagicBonus = mainHandWeapon?.magicProperties?.magicalBonus ?? 0;

    const totalBonus = profBonus + abilityMod + weaponMagicBonus;

    // Determine the source name for display
    const sourceName = mainHandWeapon?.name ?? 'Unarmed';

    return {
        type: 'melee',
        bonus: totalBonus,
        bonusString: totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`,
        source: sourceName,
        iconName: 'sword'
    };
}

/**
 * Calculates the ranged attack bonus for a character.
 * Uses DEX modifier (standard for most ranged weapons).
 *
 * Formula: Proficiency Bonus + DEX Modifier + Weapon Magic Bonus
 *
 * @param character - The player character
 * @returns AttackBonus object for ranged attacks
 */
function calculateRangedAttackBonus(character: PlayerCharacter): AttackBonus {
    const profBonus = character.proficiencyBonus ?? 2;
    const dexMod = getAbilityModifierValue(character.finalAbilityScores.Dexterity ?? 10);

    // Check for equipped ranged weapon
    // Note: In D&D 5e, ranged weapons can be in MainHand or characters might have
    // a dedicated ranged weapon. For simplicity, we calculate based on stats.
    const mainHandWeapon = character.equippedItems.MainHand;

    // Check if it's actually a ranged weapon by looking at properties
    const isRangedWeapon = mainHandWeapon?.properties?.some(p =>
        p.toLowerCase().includes('range') ||
        p.toLowerCase().includes('ammunition') ||
        p.toLowerCase().includes('thrown')
    ) ?? false;

    // Get magic bonus if the equipped weapon is ranged
    const weaponMagicBonus = isRangedWeapon
        ? (mainHandWeapon?.magicProperties?.magicalBonus ?? 0)
        : 0;

    const totalBonus = profBonus + dexMod + weaponMagicBonus;

    // Determine source name
    const sourceName = isRangedWeapon ? (mainHandWeapon?.name ?? 'Ranged') : 'Ranged';

    return {
        type: 'ranged',
        bonus: totalBonus,
        bonusString: totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`,
        source: sourceName,
        iconName: 'bow_arrow'
    };
}

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
export function calculateAttackBonuses(character: PlayerCharacter): CharacterAttackBonuses {
    return {
        melee: calculateMeleeAttackBonus(character),
        ranged: calculateRangedAttackBonus(character),
        spell: calculateSpellAttackBonus(character)
    };
}

// -----------------------------------------------------------------------------
// Initiative Calculation
// -----------------------------------------------------------------------------

/**
 * Calculates the initiative modifier for a character.
 * Base formula: DEX Modifier + any bonuses from feats/items
 *
 * @param character - The player character
 * @returns The initiative modifier as a number
 */
export function calculateInitiativeModifier(character: PlayerCharacter): number {
    // If the character has a stored initiative bonus, use that
    // (it may include feat bonuses like Alert)
    if (character.initiativeBonus !== undefined) {
        return character.initiativeBonus;
    }

    // Otherwise, calculate from DEX
    const dexMod = getAbilityModifierValue(character.finalAbilityScores.Dexterity ?? 10);
    return dexMod;
}

/**
 * Formats an initiative modifier for display.
 *
 * @param modifier - The initiative modifier value
 * @returns Formatted string like "+3" or "-1"
 */
export function formatInitiativeModifier(modifier: number): string {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

// -----------------------------------------------------------------------------
// Movement Speed
// -----------------------------------------------------------------------------

/**
 * Gets the movement speed for a character, considering transport mode.
 *
 * @param character - The player character
 * @returns Movement speed in feet
 */
export function getMovementSpeed(character: PlayerCharacter): number {
    // Base speed from race/class (usually 30ft for most races)
    return character.speed ?? 30;
}

// -----------------------------------------------------------------------------
// Total Hit Dice Summary
// -----------------------------------------------------------------------------

/**
 * Calculates the total hit dice available across all pools.
 * Useful for a quick summary display.
 *
 * @param character - The player character
 * @returns Object with current and max total hit dice
 */
export function getTotalHitDice(character: PlayerCharacter): { current: number; max: number } {
    if (!character.hitPointDice || character.hitPointDice.length === 0) {
        // Default: at level 1, characters have 1 hit die
        const level = character.level ?? 1;
        return { current: level, max: level };
    }

    let current = 0;
    let max = 0;

    for (const pool of character.hitPointDice) {
        current += pool.current;
        max += pool.max;
    }

    return { current, max };
}

/**
 * Gets the primary hit die size for a character (for icon display).
 * For multiclass characters, returns the die from their primary class.
 *
 * @param character - The player character
 * @returns The die size (6, 8, 10, or 12)
 */
export function getPrimaryHitDieSize(character: PlayerCharacter): 6 | 8 | 10 | 12 {
    // Use the class hit die if available
    if (character.class?.hitDie) {
        return character.class.hitDie as 6 | 8 | 10 | 12;
    }

    // Fallback: check the hit point dice pools
    if (character.hitPointDice && character.hitPointDice.length > 0) {
        // Return the die from the first pool (usually primary class)
        return character.hitPointDice[0].die;
    }

    // Default to d8 (most common)
    return 8;
}
