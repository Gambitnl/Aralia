/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 19:32:43
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { SummoningEffect } from '@/types/spells';
import { CombatState } from '@/types/combat';
/**
 * This command creates temporary combat characters for spells that summon a creature,
 * object, mount, or familiar onto the battle map.
 *
 * The spell data can still arrive in two shapes: older flat fields such as
 * `summonType` and newer nested `summon` fields used by the spell validator. This
 * command bridges both shapes so older spell data keeps working while Package 15
 * begins moving summon spells toward structured stat blocks.
 *
 * Called by: SpellCommandFactory when a spell effect has type `SUMMONING`.
 * Depends on: combat state placement rules, the monster registry, and summon templates.
 * Monster data is imported directly instead of through the central constants barrel so
 * the main menu does not download the full bestiary before combat or summoning needs it.
 */
export declare class SummoningCommand extends BaseEffectCommand {
    constructor(effect: SummoningEffect, context: CommandContext);
    execute(state: CombatState): CombatState;
    private isFamiliarSummon;
    private shouldReplaceExistingPersistentSummon;
    private hasPlanarReturnHomeContract;
    private removeExistingFamiliar;
    private removeExistingPersistentSummon;
    private findSpawnPosition;
    private isOccupied;
    private isWithinBounds;
    private ensureFamiliarPocketAbilities;
    private createFamiliarPocketAbilities;
    private ensureFamiliarSharedSensesAbility;
    private getSharedSensesActionCost;
    private ensureGenericDismissAbility;
    private ensurePlanarReturnHomeAbilities;
    private createPlanarReturnHomeAbilities;
    private createSummonedCharacter;
    private getSummonDurationValue;
    private createSummonSpecialActionAbilities;
    private createSummonCommandAbility;
    private getSelectedFormMovementSpeeds;
    private toAbilityCostType;
    get description(): string;
}
