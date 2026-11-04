// @dependencies-start
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
// @dependencies-end

import { CombatCharacter } from '../../types/combat'
import { rollSavingThrow } from './savingThrowUtils'
import { DEFAULT_RULES_EDITION, type RulesEdition } from '../../config/rulesEdition'

// ============================================================================
// Concentration DC Calculation
// ============================================================================
// Calculates the Difficulty Class (DC) for a Constitution saving throw whenever
// a creature concentrating on a spell takes damage in combat.
//
// In both 2014 and 2024 D&D rules, the baseline DC is 10 or half the damage taken
// (rounded down), whichever number is higher.
//
// In the 2024 Revised rules (PHB 2024 p. 238), concentration save DCs have an
// explicit maximum cap of 30, meaning extreme single-hit damage (e.g. 70+ damage)
// cannot exceed DC 30. Under 2014 rules, no such cap exists and the DC scales
// indefinitely with damage taken.
// ============================================================================

/**
 * Calculates the DC for a concentration saving throw based on damage taken.
 *
 * @param damageDealt Total damage taken in the hit.
 * @param rulesEdition Rules edition ('2014' or '2024'). Defaults to '2024'.
 * @returns The target DC (minimum 10; capped at 30 under 2024 rules).
 */
export function calculateConcentrationDC(
    damageDealt: number,
    rulesEdition: RulesEdition = DEFAULT_RULES_EDITION
): number {
    const rawDC = Math.max(10, Math.floor(damageDealt / 2));
    if (rulesEdition === '2024') {
        return Math.min(30, rawDC);
    }
    return rawDC;
}

// ============================================================================
// Concentration Roll & Check Resolution
// ============================================================================
// Rolls Constitution saving throws for characters concentrating on spells,
// comparing the rolled outcome against the edition-appropriate DC.
// ============================================================================

/**
 * Rolls a Constitution saving throw for the character without evaluating a DC.
 * Uses the centralized saving throw logic to respect proficiency, bonuses, and centralized RNG.
 */
export function rollConcentrationSave(character: CombatCharacter, rng?: () => number): number {
    // Constitution saving throw
    const result = rollSavingThrow(character, 'Constitution', 0, undefined, undefined, undefined, rng ? { rng } : undefined); // DC 0 as we just want the total
    return result.total;
}

/**
 * Checks if a character passes their concentration check after taking damage.
 *
 * @param character The character taking damage who is currently concentrating.
 * @param damageDealt The amount of damage taken (determines DC).
 * @param rulesEdition Rules edition governing whether the DC 30 cap applies.
 * @param rng Optional deterministic d20 source threaded from CommandContext or combat hooks (GG-261).
 * @returns Object containing success status, the calculated DC, and the actual roll total.
 */
export function checkConcentration(
    character: CombatCharacter,
    damageDealt: number,
    rulesEdition: RulesEdition = DEFAULT_RULES_EDITION,
    rng?: () => number,
): { success: boolean; dc: number; roll: number } {
    const dc = calculateConcentrationDC(damageDealt, rulesEdition)
    const result = rollSavingThrow(character, 'Constitution', dc, undefined, undefined, undefined, rng ? { rng } : undefined)

    return {
        success: result.success,
        dc,
        roll: result.total
    }
}
