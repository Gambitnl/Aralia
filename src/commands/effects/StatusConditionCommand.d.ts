/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 23/07/2026, 20:12:26
 * Dependents: commands/effects/AttackRollModifierCommand.ts, commands/effects/DamageCommand.ts, commands/effects/ReactiveEffectCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Applies spell status conditions to combat characters.
 *
 * The command writes both the newer `conditions` array and the legacy
 * `statusEffects` array because different combat systems still read different
 * mirrors. Metadata such as repeat saves must be copied to both mirrors so the
 * spell payload remains executable after application.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState } from '../../types/combat';
export declare class StatusConditionCommand extends BaseEffectCommand {
    execute(state: CombatState): Promise<CombatState>;
    /**
     * Apply or refresh a condition entry on the character. Re-applying the same condition name
     * refreshes duration/turn so downstream systems don't stack duplicates.
     */
    private applyCondition;
    /**
     * Mirror conditions into the legacy statusEffects array so current renderers and loggers
     * continue to behave while the new conditions field comes online.
     */
    private applyStatusEffect;
    private applyWrathOfNatureStatusMetadata;
    /**
     * Preserve status-condition metadata that comes from spell data.
     *
     * Repeat saves are already consumed by the combat engine from statusEffects,
     * while escape checks and break triggers are near-term execution metadata.
     * Keeping the helper local avoids rebuilding those optional copies in each
     * mirror and makes the lossy-bridge decision easy to audit.
     */
    private getStatusMetadata;
    /**
     * Bridge the source-shaped repeat-save record used by domination spells into
     * the existing combat-engine timing contract. Composite service and choice
     * labels stay untouched until their event-specific interaction exists.
     */
    private getSourceRepeatSave;
    /**
     * Preserve pre-cast save gates as status metadata so the casting orchestrator
     * can resolve them before it materializes the attempted spell's commands.
     */
    private getSpellcastingRestriction;
    /**
     * Some controlled-target spells still store a Charmed status payload inside a
     * utility/control row. Normalize that older shape here so Geas-style status
     * rows and Dominate Person-style utility rows both write the same live
     * condition mirrors.
     */
    private getStatusConditionPayload;
    /**
     * Geas and Planar Binding use the same spell-data bucket as summoned actors
     * because they create a control relationship, but the controlled creature is
     * already on the battlefield. This normalizes the source fields into a live
     * status payload so later systems can inspect the command, service, travel,
     * and early-ending facts without reparsing the original JSON effect.
     */
    private getBindingControlMetadata;
    /**
     * Domination spells control an existing Charmed target through telepathic
     * orders rather than creating a summon. Keep that relationship separate from
     * bindingControl because domination has same-plane command links, no-action
     * orders, and caster-Reaction spending that later UI/AI work must distinguish.
     */
    private getDominationControlMetadata;
    private isFriendsCharmedEffect;
    /** Fast Friends shares Friends' Charmed condition but owns a separate service-request lifecycle. */
    private isFastFriendsCharmedEffect;
    private isAwakenCharmedEffect;
    private getAwakenBreakTriggers;
    private resolveFriendsAutoSuccessReason;
    private rememberFriendsCast;
    private applyChillTouchUndeadAttackRider;
    private calculateDuration;
    /**
     * Convert authored turn language into a target-relative countdown.
     *
     * A condition applied during the target's own turn must pass the current
     * turn end before a "next turn" boundary. Conditions applied outside the
     * target's turn reach their next boundary at the target's first turn end.
     */
    private calculateTurnEndEventsRemaining;
    private getIconForCondition;
    get description(): string;
}
