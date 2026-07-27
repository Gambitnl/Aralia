/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 30/06/2026, 13:25:12
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
export interface ReturnHomeSummonOptions {
    summonId?: string;
    summonReturnHomeAction?: 'no_agreement' | 'service_complete';
}
export declare class SummonReturnHomeCommand extends BaseEffectCommand {
    protected context: CommandContext;
    private options;
    constructor(context: CommandContext, options?: ReturnHomeSummonOptions);
    execute(state: CombatState): CombatState;
    get description(): string;
    private findReturningSummon;
}
