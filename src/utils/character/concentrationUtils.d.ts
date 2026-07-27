/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:48
 * Dependents: character/index.ts, concentrationUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatCharacter } from '../../types/combat';
/**
 * Calculates the DC for a concentration saving throw based on damage taken.
 * Rule: DC is 10 or half the damage taken, whichever is higher.
 */
export declare function calculateConcentrationDC(damageDealt: number): number;
/**
 * Rolls a Constitution saving throw for the character.
 * Uses the centralized saving throw logic to respect proficiency, bonuses, and centralized RNG.
 */
export declare function rollConcentrationSave(character: CombatCharacter): number;
/**
 * Checks if a character passes their concentration check after taking damage.
 *
 * @param character The character taking damage who is currently concentrating.
 * @param damageDealt The amount of damage taken (determines DC).
 * @returns Object containing success status, the calculated DC, and the actual roll total.
 */
export declare function checkConcentration(character: CombatCharacter, damageDealt: number): {
    success: boolean;
    dc: number;
    roll: number;
};
