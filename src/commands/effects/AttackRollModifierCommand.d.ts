/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 14:00:03
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file applies spell riders that change how attack rolls work without
 * pretending the spell created a real condition.
 *
 * Why it exists:
 * Frostbite, Bane, and similar spells need to do two things at once:
 * damage the target if it fails a save, and leave behind a rule change that
 * affects future attack rolls. That rule change needs its own runtime home so
 * the combat engine can read it when an attack is actually rolled.
 *
 * Called by: SpellCommandFactory.ts when a spell effect is marked as an
 * ATTACK_ROLL_MODIFIER.
 * Depends on: DamageCommand for any bundled damage payload, saving throw tools,
 * and the shared active-effect storage on combat characters.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState } from '../../types/combat';
export declare class AttackRollModifierCommand extends BaseEffectCommand {
    execute(state: CombatState): Promise<CombatState>;
    /**
     * Build the combat effect that gets read later when an attack roll happens.
     * The effect is stored on the target, not on the spell card, because combat
     * needs a live record it can update and eventually expire.
     */
    private createAttackRollActiveEffect;
    private applyAttackRollLightSource;
    private applyAttackRollActiveEffect;
    private describeRider;
    get description(): string;
}
