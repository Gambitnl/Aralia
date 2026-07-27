/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:50:22
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand';
import { CombatState } from '../../types/combat';
import { DefensiveEffect } from '../../types/spells';
/**
 * Handles defensive buffs like AC bonuses, Temporary HP, and base AC setting (Mage Armor).
 * The command keeps the immediate combat-facing AC value in sync while also
 * preserving structured mechanics on the ActiveEffect so later recalculation,
 * cleanup, and UI proof can reason about which defensive rule is active.
 */
export declare class DefensiveCommand implements SpellCommand {
    private effect;
    private context;
    readonly id: string;
    readonly description: string;
    readonly metadata: CommandMetadata;
    constructor(effect: DefensiveEffect, context: CommandContext);
    execute(state: CombatState): CombatState;
    private getStructuredDefenseValue;
    private getChosenDamageType;
    private createActiveEffect;
}
