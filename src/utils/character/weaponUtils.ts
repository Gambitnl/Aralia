// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 26/08/2026, 16:41:08
 * Dependents: commands/factory/boomingBladeAttackBridge.ts, commands/factory/greenFlameBladeAttackBridge.ts, commands/factory/trueStrikeAttackBridge.ts, utils/character/defense.ts, utils/character/index.ts, utils/combat/combatUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file handles weapon classifications and proficiency validation.
 *
 * In D&D 5e / Aralia, weapons belong to categories (Simple or Martial) and characters
 * gain training with weapons from their class, background, feats, or race. When a character
 * is proficient with a weapon, they add their proficiency bonus to attack rolls made with it
 * and can trigger weapon masteries. When not proficient, they can still swing or shoot the
 * weapon, but without their proficiency bonus.
 *
 * Called by: defense.ts (equip validation), combatUtils.ts (attack ability generation),
 *            AbilityCommandFactory.ts (attack roll resolution), and CharacterSheet mannequin.
 * Depends on: PlayerCharacter and Item type models.
 */
import { PlayerCharacter, Item } from '../../types';

// ============================================================================
// Weapon Category Classification
// ============================================================================
// Determines whether a given weapon is Martial or Simple. Martial weapons require
// specialized combat training (e.g. Greatsword, Longsword, Longbow), while Simple
// weapons are accessible to almost all adventurers (e.g. Club, Dagger, Shortbow).
// ============================================================================

/**
 * Determines if a weapon is Martial (vs Simple).
 * Uses category field as primary source, isMartial flag as fallback.
 *
 * @param weapon The weapon item to check
 * @returns true if Martial, false if Simple or unknown
 */
function isWeaponMartial(weapon: Item): boolean {
    // If there is no item or the item is not a weapon, it has no martial classification.
    if (!weapon || weapon.type !== 'weapon') {
        return false;
    }

    // Primary check: inspect the authored category description string.
    if (weapon.category) {
        const categoryLower = weapon.category.toLowerCase();
        // Martial classification takes precedence if both keywords appear in hybrid strings.
        if (categoryLower.includes('martial')) return true;
        if (categoryLower.includes('simple')) return false;
    }

    // Secondary fallback: check legacy boolean flag if present.
    if (weapon.isMartial !== undefined) {
        return weapon.isMartial;
    }

    // If weapon has no category info, default to Simple weapon training.
    return false;
}

// ============================================================================
// Weapon Proficiency Verification
// ============================================================================
// Checks whether a character has undergone training for a specific weapon.
// Checks blanket proficiencies ("Simple weapons", "Martial weapons", "All weapons"),
// racial modifiers (e.g. Elf / Dwarf weapon training), feat proficiencies, and
// specific weapon masteries/proficiencies (e.g. "Longsword", "Daggers").
// ============================================================================

/**
 * Checks if a character is proficient with a given weapon.
 *
 * Proficiency can come from:
 * - Primary class training (character.class.weaponProficiencies)
 * - Multiclass training (character.classes[].weaponProficiencies)
 * - Feats or custom training (character.weaponProficiencies)
 * - Racial traits and ancestral training (character.modifiers.weaponProficiencies)
 *
 * @param character The player character attempting to use the weapon
 * @param weapon The weapon item to evaluate
 * @returns true if proficient, false if non-proficient
 */
export function isWeaponProficient(
    character: PlayerCharacter,
    weapon: Item
): boolean {
    // Basic validity guard: non-character or non-weapon items cannot have weapon proficiency.
    if (!character || !weapon) return false;
    if (weapon.type !== 'weapon') return false;

    // Collect all granted weapon proficiencies across class, multiclasses, racial modifiers, and feats.
    const grantedProficiencies: string[] = [
        ...(character.class?.weaponProficiencies || []),
        ...(character.weaponProficiencies || []),
        ...(character.modifiers?.weaponProficiencies || []),
        ...(character.classes?.flatMap(c => c.weaponProficiencies || []) || []),
    ];

    // If the character has no weapon training from any source, they are not proficient.
    if (grantedProficiencies.length === 0) return false;

    const isMartial = isWeaponMartial(weapon);
    // Normalize all proficiencies to lowercase trimmed strings for comparison.
    const normalizedProfs = grantedProficiencies.map(p => p.toLowerCase().trim());

    // 1. Blanket "All Weapons" proficiency check.
    if (normalizedProfs.includes('all weapons') || normalizedProfs.includes('all')) {
        return true;
    }

    // 2. Blanket "Martial Weapons" proficiency check.
    if (isMartial && (normalizedProfs.includes('martial weapons') || normalizedProfs.includes('martial'))) {
        return true;
    }

    // 3. Blanket "Simple Weapons" proficiency check.
    if (!isMartial && (normalizedProfs.includes('simple weapons') || normalizedProfs.includes('simple'))) {
        return true;
    }

    // 4. Specific Weapon Proficiency Check (e.g., "Longsword", "Daggers", "Light Crossbows").
    // Normalize weapon names and identifiers (removing trailing 's' for singular/plural matching).
    const weaponNameLower = weapon.name ? weapon.name.toLowerCase().trim() : '';
    const weaponIdLower = weapon.id ? weapon.id.toLowerCase().replace(/_/g, ' ').trim() : '';
    const weaponCategoryLower = weapon.category ? weapon.category.toLowerCase().trim() : '';

    return normalizedProfs.some(prof => {
        const profSingular = prof.replace(/s$/, '');
        const weaponNameSingular = weaponNameLower.replace(/s$/, '');
        const weaponIdSingular = weaponIdLower.replace(/s$/, '');

        // Direct exact match on name, id, or singular root.
        if (prof === weaponNameLower || prof === weaponIdLower || prof === weaponCategoryLower) return true;
        if (profSingular === weaponNameSingular || profSingular === weaponIdSingular) return true;

        // Prefix and substring matching for named variants (e.g. "Longsword +1" or "Flaming Longsword").
        if (weaponNameSingular.startsWith(profSingular) || weaponNameLower.includes(profSingular)) {
            return true;
        }

        return false;
    });
}

// Export helper function for reuse across combat and character systems.
export { isWeaponMartial };
