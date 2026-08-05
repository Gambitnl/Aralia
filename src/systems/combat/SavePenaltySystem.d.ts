/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:29:24
 * Dependents: DamageCommand.ts, StatusConditionCommand.ts, UtilityCommand.ts, useCombatEngine.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/combat/SavePenaltySystem.ts
 *
 * System for managing save penalty riders on combat characters.
 * Similar to AttackRiderSystem but for penalties that affect saving throws.
 *
 * Used by spells like Mind Sliver that impose "subtract 1d4 from next saving throw".
 */
import { CombatState, CombatCharacter } from '@/types/combat';
import { SavingThrowModifier } from '@/utils/character';
/**
 * System for registering, consuming, and expiring save penalty riders.
 */
export declare class SavePenaltySystem {
    /**
     * Register a save penalty rider on a target character.
     * @param state Current combat state
     * @param targetId ID of the target character receiving the penalty
     * @param casterId ID of the character who cast the spell
     * @param sourceName Name of the spell or source
     * @param data Raw penalty data from the spell effect
     * @param spellId Optional spell ID for tracking
     * @returns Updated combat state
     */
    registerPenalty(state: CombatState, targetId: string, casterId: string, sourceName: string, data: any, spellId?: string): CombatState;
    /**
     * Get all active save penalty modifiers for a target.
     * Converts SavePenaltyRider[] to SavingThrowModifier[] for easy use in rollSavingThrow.
     * Ensures penalties are formatted as negative strings (e.g. "-1d4") if not already.
     * @param target The target character
     * @returns Array of modifiers to apply
     */
    getActivePenalties(target: CombatCharacter): SavingThrowModifier[];
    /**
     * Consume "next_save" penalties after a saving throw is rolled.
     * Called after each saving throw for the target.
     * @param state Current combat state
     * @param targetId ID of the target who just made a save
     * @returns Updated combat state with next_save riders removed
     */
    consumeNextSavePenalties(state: CombatState, targetId: string): CombatState;
    /**
     * Remove all save penalty riders from a specific spell (e.g., when concentration breaks).
     * @param state Current combat state
     * @param spellId The spell whose penalties should be removed
     * @param targetId The target character to clean up
     * @returns Updated combat state
     */
    removePenaltiesBySpell(state: CombatState, spellId: string, targetId: string): CombatState;
    /**
     * Expire duration-based save penalties when a character's turn ends.
     * Supports caster-turn-relative durations (e.g. "until the end of your next turn").
     * @param state Current combat state
     * @param endingCharacterId The ID of the character whose turn is ending
     * @returns Updated combat state with expired riders removed
     */
    expirePenalties(state: CombatState, endingCharacterId: string): CombatState;
    /**
     * Calculate the total modifier value from all active penalties.
     * Rolls any dice penalties and sums with flat penalties.
     * @param modifiers The modifiers to calculate
     * @returns Total negative modifier value and details for logging
     */
    calculateTotalPenalty(modifiers: SavingThrowModifier[]): {
        total: number;
        details: string[];
    };
}
