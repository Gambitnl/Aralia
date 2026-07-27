/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:31
 * Dependents: combat/index.ts, mechanicsUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Lock, LockpickResult, Trap } from '../../types/mechanics';
/**
 * Attempts to pick a lock.
 * @param dexMod The character's Dexterity modifier
 * @param proficiencyBonus The character's proficiency bonus (if proficient in Thieves' Tools)
 * @param lock The lock being attempted
 * @returns Result of the attempt
 */
export declare function attemptLockpick(dexMod: number, proficiencyBonus: number, lock: Lock): LockpickResult;
/**
 * Checks if a character can force a lock open (Strength check).
 */
export declare function attemptForceLock(strMod: number, lock: Lock): {
    success: boolean;
    details: string;
};
/**
 * Calculates the damage or effect of a triggered trap.
 * Does NOT apply the effect, just resolves the roll.
 */
export declare function resolveTrapEffect(trap: Trap): {
    damageValue: number;
    description: string;
};
