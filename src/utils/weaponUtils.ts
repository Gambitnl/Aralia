/**
 * @file weaponUtils.ts
 * Utility functions for weapon proficiency and weapon-related calculations.
 */
import { PlayerCharacter, Item } from '../types';

/**
 * Determines if a weapon is Martial (vs Simple).
 * Uses category field as primary source, isMartial flag as fallback.
 *
 * @param weapon The weapon item to check
 * @returns true if Martial, false if Simple or unknown
 */
function isWeaponMartial(weapon: Item): boolean {
    if (!weapon || weapon.type !== 'weapon') {
        return false;
    }

    // Primary: Check category field
    if (weapon.category) {
        const categoryLower = weapon.category.toLowerCase();
        if (categoryLower.includes('martial')) return true;
        if (categoryLower.includes('simple')) return false;
    }

    // Fallback: Check isMartial boolean
    if (weapon.isMartial !== undefined) {
        return weapon.isMartial;
    }

    // Default: Assume Simple if no data
    // Using warn only in dev/test to avoid console spam in prod, or could remove entirely if noise is too high
    console.warn(`Weapon "${weapon.name}" has no martial/simple data, assuming Simple`);
    return false;
}

/**
 * Checks if a character is proficient with a given weapon.
 *
 * Proficiency can come from:
 * - "Simple weapons" (covers all simple weapons)
 * - "Martial weapons" (covers all martial weapons)
 * - Specific weapon name (e.g., "Longsword")
 *
 * @param character The player character
 * @param weapon The weapon item to check
 * @returns true if proficient, false otherwise
 *
 * @example
 * const fighter = { class: { weaponProficiencies: ['Simple weapons', 'Martial weapons'] } };
 * const longsword = { name: 'Longsword', isMartial: true, type: 'weapon' };
 * isWeaponProficient(fighter, longsword); // true
 *
 * @example
 * const wizard = { class: { weaponProficiencies: ['Simple weapons'] } };
 * const longsword = { name: 'Longsword', isMartial: true, type: 'weapon' };
 * isWeaponProficient(wizard, longsword); // false
 */
export function isWeaponProficient(
    character: PlayerCharacter,
    weapon: Item
): boolean {
    // Validate inputs
    if (!character || !weapon) return false;
    if (weapon.type !== 'weapon') return false;

    // Safety check for class data (handle missing class or proficiencies gracefully)
    if (!character.class || !character.class.weaponProficiencies) return false;

    const proficiencies = character.class.weaponProficiencies;
    const isMartial = isWeaponMartial(weapon);

    // Check for blanket proficiency
    if (isMartial && proficiencies.includes('Martial weapons')) {
        return true;
    }
    if (!isMartial && proficiencies.includes('Simple weapons')) {
        return true;
    }

    // Check for specific weapon proficiency
    // Handle both singular and plural forms (e.g., "Longsword" matches "Longswords")
    const weaponNameLower = weapon.name.toLowerCase();
    return proficiencies.some(prof => {
        // Normalize proficiency string: lowercase and remove trailing 's'
        const profLower = prof.toLowerCase().replace(/s$/, '');
        // Normalize weapon name: lowercase and remove trailing 's'
        const weaponNameSingular = weaponNameLower.replace(/s$/, '');

        // Check for exact match or if one includes the other (e.g. "Longsword" matches "Longsword +1")
        return profLower === weaponNameSingular ||
            profLower === weaponNameLower ||
            weaponNameSingular === profLower;
    });
}

// Export helper function for reuse
export { isWeaponMartial };
