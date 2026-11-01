/**
 * @file partyStatUtils.ts
 * Utility functions for calculating derived combat stats for party member display.
 * These functions compute values like spell save DC, attack bonuses, and initiative
 * that are derived from a character's base stats, equipment, and class features.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 12:21:46
 * Dependents: components/CharacterSheet/Overview/CharacterOverview.tsx, components/Party/PartyPane/PartyMemberCard.tsx, components/World3D/groundLocomotion.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { PlayerCharacter, AbilityScoreName } from '../../types/index.js';
import { sumMovementSpeedEffects } from './movementSpeedEffects';
import { exhaustionLevelFromConditions, calculateExhaustionEffects, getExhaustionD20Penalty } from '../combat/physicsUtils';
import { getAbilityModifierValue } from './statUtils.js';
import { isWeaponProficient, hasTavernBrawler, isImprovisedWeapon } from './weaponUtils';
import { isRangedWeapon, isThrownMeleeWeapon, hasWeaponProperty } from '../combat/weaponRange';

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

    const bonus = profBonus + abilityMod - getExhaustionD20Penalty(character);

    return {
        type: 'spell',
        bonus,
        // This is already a modifier total, not an ability score.
        bonusString: bonus >= 0 ? `+${bonus}` : `${bonus}`,
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
function calculateMeleeAttackBonus(character: PlayerCharacter): AttackBonus | null {
    const profBonus = character.proficiencyBonus ?? 2;

    // Get both STR and DEX modifiers
    const strMod = getAbilityModifierValue(character.finalAbilityScores.Strength ?? 10);
    const dexMod = getAbilityModifierValue(character.finalAbilityScores.Dexterity ?? 10);

    // Check for equipped melee weapon to determine if finesse applies
    const mainHandWeapon = character.equippedItems.MainHand;
    // A bow's existing combat ability is ranged; do not invent a melee option.
    if (isRangedWeapon(mainHandWeapon)) return null;
    const isFinesse = hasWeaponProperty(mainHandWeapon, 'finesse');

    // Use the better modifier if finesse is available, otherwise use STR
    // For monks, rogues, etc. who typically use finesse, DEX will often be higher
    let abilityMod = strMod;
    let _abilityUsed = 'STR';

    if (isFinesse && dexMod > strMod) {
        abilityMod = dexMod;
        _abilityUsed = 'DEX';
    }

    // Check for magic weapon bonus
    const weaponMagicBonus = mainHandWeapon?.magicProperties?.magicalBonus ?? 0;

    // Equipment stays usable without training, but only trained attacks gain PB.
    // Unarmed strikes and the existing Tavern Brawler exception keep their benefits.
    const proficient = !mainHandWeapon || isWeaponProficient(character, mainHandWeapon)
        || (hasTavernBrawler(character) && isImprovisedWeapon(mainHandWeapon));
    const totalBonus = (proficient ? profBonus : 0) + abilityMod + weaponMagicBonus - getExhaustionD20Penalty(character);

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
 * Uses DEX for ranged weapons and STR/better finesse modifier for thrown melee weapons.
 *
 * Formula: Trained Proficiency Bonus + Attack Ability Modifier + Weapon Magic Bonus
 *
 * @param character - The player character
 * @returns AttackBonus object for ranged attacks
 */
function calculateRangedAttackBonus(character: PlayerCharacter): AttackBonus | null {
    const weapon = character.equippedItems.MainHand;
    // The card reports the equipped combat option, not an imaginary trained bow.
    // Thrown melee weapons retain Strength, or the better finesse modifier.
    if (!weapon || (!isRangedWeapon(weapon) && !isThrownMeleeWeapon(weapon))) return null;
    const dexMod = getAbilityModifierValue(character.finalAbilityScores.Dexterity ?? 10);
    const strMod = getAbilityModifierValue(character.finalAbilityScores.Strength ?? 10);
    const abilityMod = isRangedWeapon(weapon) ? dexMod
        : hasWeaponProperty(weapon, 'finesse') ? Math.max(strMod, dexMod) : strMod;
    const proficient = isWeaponProficient(character, weapon)
        || (hasTavernBrawler(character) && isImprovisedWeapon(weapon));
    const totalBonus = (proficient ? (character.proficiencyBonus ?? 2) : 0)
        + abilityMod + (weapon.magicProperties?.magicalBonus ?? 0) - getExhaustionD20Penalty(character);
    return {
        type: 'ranged',
        bonus: totalBonus,
        bonusString: totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`,
        source: weapon.name,
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
    const dexMod = getAbilityModifierValue(character.finalAbilityScores?.Dexterity ?? 10);
    const pb = character.initiativeProficiency
        ? (character.proficiencyBonus ?? (2 + Math.floor(Math.max(0, (character.level ?? 1) - 1) / 4)))
        : 0;
    const flatBonus = character.initiativeBonus ?? 0;
    return dexMod + pb + flatBonus - getExhaustionD20Penalty(character);
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
 * Gets the walking allowance shown when planning combat.
 *
 * @param character - The player character
 * @returns Movement speed in feet
 */
/** The same flat status riders used by combat, before exhaustion applies. */
export function getMovementSpeedBeforeExhaustion(character: PlayerCharacter): number {
    // World-paced spell records have an explicit lifetime. Untagged combat
    // turn riders retain their existing owner rather than becoming permanent
    // exploration modifiers when a battle ends.
    const timed = (character.statusEffects ?? []).filter(effect => effect.duration > 0 && effect.worldTime
        && Number.isFinite(effect.worldTime.appliedAtMs) && Number.isFinite(effect.worldTime.expiresAtMs)
        && effect.worldTime.expiresAtMs > effect.worldTime.appliedAtMs);
    return Math.max(0, (character.speed ?? 30) + sumMovementSpeedEffects(timed));
}

export function getMovementSpeed(character: PlayerCharacter): number {
    // Match the existing persistent-to-combat projection. Keep the saved speed
    // intact: armor/equipment changes already update that base value elsewhere.
    // Like combat entry, cap exhaustion at five here; death remains a separate
    // lifecycle transition, not something a stat display may apply.
    const level = exhaustionLevelFromConditions(character.conditions);
    const penalty = calculateExhaustionEffects(Math.min(level, 5)).speedPenalty;
    return Math.max(0, getMovementSpeedBeforeExhaustion(character) - penalty);
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
