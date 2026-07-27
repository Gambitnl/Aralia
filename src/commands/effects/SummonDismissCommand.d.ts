/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 30/06/2026, 02:41:57
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
 * This command removes a dismissable spell-created summon from combat state.
 *
 * The summon runtime already stores dismissAction and dismissable metadata on
 * the created actor. This bridge turns that metadata into an executable combat
 * action for non-Familiar summons such as Find Steed without reusing the
 * familiar pocket-dimension flow.
 *
 * Called by: AbilityCommandFactory for generated summon-dismiss abilities.
 * Depends on: summon metadata on the acting combat character and the source
 * spell id carried through the ability command context.
 */
export interface DismissSummonOptions {
    summonId?: string;
}
export declare class DismissSummonCommand extends BaseEffectCommand {
    protected context: CommandContext;
    private options;
    constructor(context: CommandContext, options?: DismissSummonOptions);
    execute(state: CombatState): CombatState;
    get description(): string;
    private findDismissableSummon;
}
