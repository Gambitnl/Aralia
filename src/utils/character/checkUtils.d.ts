/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/06/2026, 02:45:39
 * Dependents: systems/crafting/batchCrafting.ts, systems/crafting/craftingEngine.ts, systems/puzzles/mechanism.ts, utils/character/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/character/checkUtils.ts
 * Utility functions for handling ability checks and skill checks in D&D 5e.
 */
import { PlayerCharacter } from '../../types/character';
import { CombatCharacter } from '../../types/combat';
import { AbilityScoreName } from '../../types/core';
/**
 * Result of an ability or skill check.
 */
export interface CheckResult {
    /** The raw d20 roll before modifiers */
    roll: number;
    /** Final total after all modifiers and bonuses */
    total: number;
    /** List of modifiers that were applied (e.g., Guidance, Racial Intuition) */
    modifiersApplied?: {
        source: string;
        value: number;
    }[];
}
/**
 * Rolls an ability check or skill check for a character (Player or Combatant).
 */
export declare function rollAbilityCheck(character: PlayerCharacter | CombatCharacter, ability: AbilityScoreName, skill?: string, options?: {
    advantage?: boolean;
    disadvantage?: boolean;
    externalModifier?: number;
}): CheckResult;
