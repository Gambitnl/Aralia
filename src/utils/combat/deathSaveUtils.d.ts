/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/06/2026, 12:05:39
 * Dependents: commands/effects/DamageCommand.ts, commands/effects/HealingCommand.ts, hooks/combat/engine/useCombatEngine.ts, utils/combat/actionEconomyUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file utils/combat/deathSaveUtils.ts
 * Centralized utility functions for managing Downing states, Death Saving Throws,
 * unconsciousness conditions, and HP transition mutations for players at 0 HP.
 *
 * This system is built to strictly implement standard D&D 5e Rules:
 * - When a player drops to 0 HP, they gain the Unconscious condition and death save tracking initializes.
 * - Taking damage while at 0 HP inflicts death save failures (1 failure standard, 2 if critical).
 * - Receiving healing while downed immediately restores consciousness, clears saves, and removes Unconscious.
 * - Unconscious or incapacitated creatures are restricted from executing actions, reactions, or moving.
 *
 * DESIGN DECISIONS:
 * We decouple these helper calculations from the React hook state updates so that tests, commands,
 * and turn coordinators can execute pure HP transitions predictably and isolate state leaks.
 */
import { CombatCharacter } from '../../types/combat';
/**
 * Checks if a combat character possesses any incapacitating status conditions.
 * Standard D&D 5e rules state that incapacitated creatures cannot take actions or reactions.
 *
 * @param character The character to evaluate.
 * @returns True if the character is incapacitated, false otherwise.
 */
export declare function isIncapacitated(character: CombatCharacter | undefined): boolean;
/**
 * Checks if a character's movement is completely blocked by status conditions.
 * Unconscious, paralyzed, petrified, and restrained characters have their speed reduced to 0.
 *
 * @param character The character to evaluate.
 * @returns True if the character cannot move, false otherwise.
 */
export declare function isMovementBlocked(character: CombatCharacter | undefined): boolean;
/**
 * Safely adds the "Unconscious" condition to a character's statusEffects and conditions arrays.
 * Preserves existing status effects and prevents duplicate entries.
 *
 * @param character The character falling unconscious.
 * @returns An updated CombatCharacter with the Unconscious status applied.
 */
export declare function addUnconsciousCondition(character: CombatCharacter): CombatCharacter;
/**
 * Safely removes the "Unconscious" condition from a character's statusEffects and conditions arrays.
 * Used when a downed character is healed or revived.
 *
 * @param character The character regaining consciousness.
 * @returns An updated CombatCharacter with the Unconscious status removed.
 */
export declare function removeUnconsciousCondition(character: CombatCharacter): CombatCharacter;
/**
 * Deducts HP (applying Temporary HP first) and applies Downing / Death Save Failure transitions.
 * - Players reaching 0 HP are downed, starting death save tracking and falling unconscious.
 * - Players already at 0 HP suffer 1 death save failure (2 if a critical hit).
 *
 * @param character The character taking damage.
 * @param amount The raw amount of damage to deduct from HP.
 * @param isCritical Whether the source damage is a critical hit (inflicts 2 failures while downed).
 * @returns The mutated CombatCharacter state.
 */
export declare function applyDamageAndCheckDowned(character: CombatCharacter, amount: number, isCritical?: boolean): CombatCharacter;
/**
 * Standard healing helper that restores HP and manages downed recovery.
 * - Receives standard healing (HP > 0) restores consciousness, clears saves, and clears Unconscious status.
 *
 * @param character The character receiving healing.
 * @param amount The HP to restore.
 * @returns The mutated CombatCharacter state.
 */
export declare function applyHealingAndRestore(character: CombatCharacter, amount: number): CombatCharacter;
