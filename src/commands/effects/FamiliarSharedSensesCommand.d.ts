/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:38:43
 * Dependents: commands/factory/AbilityCommandFactory.ts
 * Imports: 5 files
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
 * Activates Find Familiar-style shared senses as a structured caster effect.
 *
 * This command intentionally stops at the runtime-state boundary. It records
 * which familiar should act as the observer and how far the telepathic link can
 * reach, but it does not directly switch the 2D or 3D camera/visibility system.
 * Keeping that visual handoff separate makes the remaining combat-map gap
 * explicit instead of hiding it inside a utility action.
 */
export interface FamiliarSharedSensesOptions {
    familiarId?: string;
}
export declare class FamiliarSharedSensesCommand extends BaseEffectCommand {
    protected context: CommandContext;
    private options;
    constructor(context: CommandContext, options?: FamiliarSharedSensesOptions);
    execute(state: CombatState): CombatState;
    get description(): string;
    private createActiveEffect;
    private findSharedSensesFamiliar;
    private isFamiliar;
}
