/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:31:13
 * Dependents: character/index.ts, characterUtils.ts, combatUtils.ts, weaponUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file weaponUtils.ts
 * Utility functions for weapon proficiency and weapon-related calculations.
 */
import { PlayerCharacter, Item } from '../../types';
/**
 * Determines if a weapon is Martial (vs Simple).
 * Uses category field as primary source, isMartial flag as fallback.
 *
 * @param weapon The weapon item to check
 * @returns true if Martial, false if Simple or unknown
 */
declare function isWeaponMartial(weapon: Item): boolean;
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
export declare function isWeaponProficient(character: PlayerCharacter, weapon: Item): boolean;
export { isWeaponMartial };
