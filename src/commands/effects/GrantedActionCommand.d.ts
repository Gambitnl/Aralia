/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 20:12:56
 * Dependents: commands/factory/AbilityCommandFactory.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { CombatState } from '../../types/combat';
import type { DamageType } from '../../types/spells';
/**
 * This command records a spell-granted follow-up action being used.
 *
 * Several spells create later player options after the initial cast, such as
 * manipulating an illusion or firing a sustained beam. The exact spell-specific
 * payload still belongs to later runtime slices, but this command makes the
 * granted action a real executable combat action instead of a JSON-only note.
 *
 * Called by: AbilityCommandFactory for generated granted-action abilities.
 * Depends on: AbilityPalette creating a temporary ability from Ability.grantedActions.
 */
export interface GrantedActionCommandOptions {
    actionLabel?: string;
    actionCost?: 'action' | 'bonus_action' | 'reaction';
    frequency?: 'once' | 'each_turn' | 'while_active';
    rangeLimit?: number;
    prerequisites?: ('target_object_within_spell_range' | 'target_within_spell_range' | 'not_applicable')[];
    attackType?: 'ranged_spell_attack' | 'melee_spell_attack' | 'not_applicable';
    areaShape?: 'Cone' | 'Line' | 'Sphere' | 'Cube' | 'Cylinder' | 'not_applicable';
    areaSize?: number | 'not_applicable';
    areaSizeUnit?: 'feet' | 'miles' | 'not_applicable';
    damageDice?: string;
    damageType?: DamageType;
    saveType?: 'Strength' | 'Dexterity' | 'Constitution' | 'Intelligence' | 'Wisdom' | 'Charisma';
    saveEffect?: 'none' | 'half' | 'negates_condition';
    damageAbilityModifier?: 'spellcasting_ability' | 'not_applicable';
    wallLengthReduction?: number;
    endsWhenLengthZero?: boolean;
    socialServiceRequest?: 'fast_friends' | string;
    notes?: string;
}
export declare class GrantedActionCommand extends BaseEffectCommand {
    protected context: CommandContext;
    private options;
    constructor(context: CommandContext, options?: GrantedActionCommandOptions);
    execute(state: CombatState): Promise<CombatState>;
    private executeConjureFeyTeleport;
    get description(): string;
    private hasAttackDamagePayload;
    private resolveAttackTarget;
    private executeDancingLightsMove;
    private translateDancingLightsCluster;
    private positionsSatisfyDancingLightsLeash;
    private distanceFeet;
    private executeAttackDamagePayload;
    private calculateSpellAttackModifier;
    private calculateSpellcastingAbilityModifier;
    private addWallLengthReductionLog;
    private createLogData;
    private reduceSpellZoneWallLength;
    private resolveDamageDice;
    private clearMatchingConcentrationForEndedWall;
}
