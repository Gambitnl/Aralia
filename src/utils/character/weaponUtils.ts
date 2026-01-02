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
    // REVIEW Q1: What happens if weapon is null but not undefined? 
    // The check `!weapon` handles both, but is there a case where weapon could be an empty object {}?
    // ANSWER: An empty object {} would pass the !weapon check but fail weapon.type !== 'weapon'. Safe.
    if (!weapon || weapon.type !== 'weapon') {
        return false;
    }

    // Primary: Check category field
    if (weapon.category) {
        const categoryLower = weapon.category.toLowerCase();
        // REVIEW Q2: What if category is something like "MartialSimple" or contains both words?
        // The order of checks means 'martial' wins. Is this intentional?
        // ANSWER: Edge case unlikely in D&D data, but yes - "Martial" takes precedence. Document this assumption.
        if (categoryLower.includes('martial')) return true;
        if (categoryLower.includes('simple')) return false;
    }

    // Fallback: Check isMartial boolean
    // REVIEW Q3: We removed isMartial from weapon data in Task 08. Is this fallback now dead code?
    // ANSWER: Yes, this is now dead code since all weapons rely on category. Consider removing in future cleanup.
    if (weapon.isMartial !== undefined) {
        return weapon.isMartial;
    }

    // Default: Assume Simple if no data
    // REVIEW Q4: This console.warn will fire in production. Is this acceptable noise or should it be conditional?
    // ANSWER: Could be noisy. Consider wrapping with `if (process.env.NODE_ENV !== 'production')` or removing.
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

    // REVIEW Q5: What about multiclassing? Does character.class represent only the primary class?
    // If a Fighter/Wizard multiclass exists, do we check both classes' proficiencies?
    // ANSWER: Current implementation only checks character.class (single). Multiclass support would require
    // iterating over an array of classes or a combined proficiency set. This is a known limitation.
    if (!character.class || !character.class.weaponProficiencies) return false;

    const proficiencies = character.class.weaponProficiencies;
    const isMartial = isWeaponMartial(weapon);

    // Check for blanket proficiency
    // Fix Q6: Case-insensitive check for weapon categories
    const normalizedProfs = proficiencies.map(p => p.toLowerCase());
    if (isMartial && normalizedProfs.includes('martial weapons')) {
        return true;
    }
    if (!isMartial && normalizedProfs.includes('simple weapons')) {
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

        // Fix Q7: Removed redundant check
        // Check for exact match or if one includes the other
        return profLower === weaponNameSingular ||
            profLower === weaponNameLower;
    });
}

// Export helper function for reuse
export { isWeaponMartial };
