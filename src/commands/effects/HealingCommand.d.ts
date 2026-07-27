/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 18:56:16
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState } from '@/types/combat';
/**
 * Command to apply healing to targets.
 * Handles healing calculation, HP restoration (capped at maxHP), and combat log entries.
 */
export declare class HealingCommand extends BaseEffectCommand {
    execute(state: CombatState): CombatState;
    get description(): string;
    /**
     * Helper to parse dice or flat-number healing formulas.
     *
     * Simple battle-map abilities such as Second Wind can arrive as a flat value
     * while spell data usually arrives as dice. Reusing the shared formula roller
     * keeps both shapes working through the same command pipeline.
     *
     * @param diceString The dice notation string.
     * @returns The total calculated healing.
     */
    private rollHealing;
}
