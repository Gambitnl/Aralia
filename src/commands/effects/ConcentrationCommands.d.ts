/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 19/07/2026, 23:21:31
 * Dependents: commands/effects/DamageCommand.ts, commands/effects/GrantedActionCommand.ts, commands/effects/StatusConditionCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, hooks/useAbilitySystem.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { CombatCharacter, CombatState } from '../../types/combat';
import type { Spell } from '../../types/spells';
/**
 * Command to initiate concentration on a spell.
 * Sets the 'concentratingOn' state on the caster.
 */
export declare class StartConcentrationCommand extends BaseEffectCommand {
    private spell;
    protected context: CommandContext;
    constructor(spell: Spell, context: CommandContext);
    /**
     * Executes the command:
     * 1. Creates the concentration state object.
     * 2. Scans logs to find IDs of effects created by this spell.
     * 3. Updates the caster's character record.
     * 4. Logs the event.
     */
    execute(state: CombatState): CombatState;
    get description(): string;
}
/**
 * Command to break existing concentration.
 * Clears the 'concentratingOn' state and removes linked effects (status, riders, summons, light).
 */
export declare class BreakConcentrationCommand extends BaseEffectCommand {
    protected context: CommandContext;
    constructor(context: CommandContext);
    /**
     * Executes the command:
     * 1. Checks if the caster is actually concentrating.
     * 2. Removes associated effects (riders, status effects, summons, light sources).
     * 3. Clears the concentration state.
     * 4. Logs the event.
     */
    execute(state: CombatState): CombatState;
    get description(): string;
}
export declare function breakFriendsConcentrationForCaster(state: CombatState, caster: CombatCharacter, context: CommandContext, reason: 'caster_makes_attack_roll' | 'caster_deals_damage' | 'caster_forces_saving_throw' | 'target_takes_damage', detail?: string): Promise<CombatState>;
