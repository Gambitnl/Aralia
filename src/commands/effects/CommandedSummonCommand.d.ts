/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/07/2026, 14:29:58
 * Dependents: commands/factory/AbilityCommandFactory.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { CombatState } from '../../types/combat';
/**
 * This command records a generic order being given to a controlled summon.
 *
 * Some spells create helpers that can be commanded but do not have a bespoke
 * attack, damage roll, or stat block action yet. The summon runtime gives those
 * helpers a normal ability button, and this command makes that button execute
 * through the same combat log and command pipeline as other spell-created
 * actions. It intentionally does not invent task completion, pathing, servant
 * chores, or structure behavior; those remain owned by later spell-specific
 * runtime slices.
 *
 * Called by: AbilityCommandFactory for generated commanded-summon abilities.
 * Depends on: summon metadata on the acting combat character.
 */
export interface CommandedSummonOptions {
    description?: string;
}
export interface AnimateDeadControlWindowAdvance {
    elapsedHours: number;
}
export declare class CommandedSummonCommand extends BaseEffectCommand {
    protected context: CommandContext;
    private options;
    constructor(context: CommandContext, options?: CommandedSummonOptions);
    execute(state: CombatState): CombatState;
    get description(): string;
}
export declare function advanceAnimateDeadControlWindows(state: CombatState, advance: AnimateDeadControlWindowAdvance): CombatState;
