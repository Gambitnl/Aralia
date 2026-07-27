/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 23/07/2026, 19:09:18
 * Dependents: commands/effects/AttackRollModifierCommand.ts, commands/effects/GrantedActionCommand.ts, commands/effects/ReactiveEffectCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file resolves damage applications on characters during combat.
 *
 * It is the core damage engine of the combat system. It handles applying damage numbers,
 * checking damage type resistances or vulnerabilities, rolling saving throws, running feat checks,
 * logging damage events, removing defeated summons, and prompting/checking spell concentration.
 *
 * Called by: useAbilitySystem.ts and various spell/ability command factories.
 * Depends on: deathSaveUtils for applying damage, resistanceUtils for resistances, and ConcentrationCommands to break spell maintenance.
 *
 * @file src/commands/effects/DamageCommand.ts
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CombatState, Position } from '../../types/combat';
import type { DamageEffect } from '../../types/spells';
/**
 * Command to apply damage to targets.
 * Handles damage calculation, HP reduction, and triggers concentration saves.
 */
export declare class DamageCommand extends BaseEffectCommand<DamageEffect> {
    execute(state: CombatState): Promise<CombatState>;
    private shouldRecordNegativeEnergyFloodRise;
    private recordNegativeEnergyFloodRise;
    private applyGuardianOfFaithState;
    private applyFaithfulHoundState;
    private applyConjureElementalState;
    private applyConjureMinorElementalsState;
    private applyConjureWoodlandBeingsState;
    private applyWrathOfNatureEnvironmentalControl;
    private resolveConjureElementalChoice;
    private resolveConjureMinorElementalsDamageType;
    private resolveConjureElementalDamageType;
    private normalizeFaithfulHoundVisibility;
    private getDamageDiceCount;
    private extractKeyedPlayerInput;
    private resolvePointTarget;
    private getEffectExpiryRound;
    private breakFriendsWhenTargetTakesDamage;
    get description(): string;
    private resolveHitPointStateDamageDice;
    /**
     * Grants the caster their Dark One's Blessing temporary hit points after they
     * reduce a creature to 0 HP.
     *
     * The amount was resolved once at combat-character construction
     * (Charisma modifier + warlock level, minimum 1) and stored on
     * `darkOnesBlessingTempHp`. Temporary hit points do not stack in 5e, so the
     * caster keeps the larger of their current temp HP and the fresh blessing
     * value rather than summing them.
     */
    private applyDarkOnesBlessing;
    /**
     * Applies the effects of the Slasher feat:
     * 1. Reduce speed by 10ft (at most once per turn).
     * 2. On critical hit, target has disadvantage on attacks until start of attacker's next turn.
     */
    private applySlasherFeat;
    /**
     * Maps the damage element to an elemental StateTag and resolves it against the
     * target's existing `stateTags` via the physics interaction engine.
     *
     * Damage types without an elemental meaning (bludgeoning, force, psychic, etc.)
     * map to nothing and leave state untouched. When a reaction occurs (e.g. a Wet
     * target struck by Cold becomes Frozen), the resolved interaction is logged so
     * the combat log surfaces the physics outcome.
     */
    private applyElementalState;
    private logDamage;
    /**
     * Spend the Resistance spell's flat 1d4 rider after normal resistance math
     * has resolved. The rider is tied to a single chosen damage type and only
     * applies once per turn, so the active effect keeps the last turn it fired.
     */
    private applyResistanceRider;
    /**
     * Removes a spell-created summon after it reaches 0 HP.
     *
     * Ordinary player and monster combatants remain in the roster so the death-save
     * and unconscious systems can handle them. Summons are different: familiar and
     * summon spell text usually says the created creature disappears at 0 HP, and
     * the map needs that cleanup immediately so 2D/3D tokens do not linger.
     */
    private removeDefeatedSummon;
    /**
     * Helper to parse dice string (e.g., "2d6+3") and roll damage.
     * Delegates to centralized combatUtils for consistent critical hit logic.
     */
    private rollDamage;
    /**
     * Publishes the structured attack fact for spell attacks that already reached
     * a hit-conditioned damage row.
     *
     * Weapon attacks emit their own hit/miss event at the attack-roll command.
     * Spell attack rolls do not have an equivalent command yet, so this bridge
     * records only confirmed spell hits without inventing miss rolls or changing
     * the damage model.
     */
    private emitSpellAttackHitEvent;
    /**
     * Builds the saving-throw modifier granted by map cover.
     *
     * Cover only affects Dexterity saves in the 5e rules this command is modeling.
     * The map already knows how to calculate half-cover and three-quarters-cover
     * bonuses for attacks, so this helper reuses that signal for spell saves.
     */
    private getCoverSaveModifier;
    /**
     * Converts the numeric cover bonus into the spell-data vocabulary.
     *
     * This bridge lets JSON metadata such as `ignoredCover: ["half"]` compare
     * against the existing combat utility without inventing a second cover model.
     */
    private getCoverGrade;
    /**
     * Checks whether this spell says to ignore the current cover grade.
     *
     * The modifier lives on effect condition metadata because it changes how the
     * saving throw is made, not how much damage the spell rolls afterward.
     */
    private isCoverBypassed;
}
export declare function recordGuardianOfFaithDamage(state: CombatState, guardianId: string, damageDealt: number, options?: {
    targetId?: string;
}): CombatState;
export declare function moveFaithfulHoundGuardian(state: CombatState, guardianId: string, nextPosition: Position, options: {
    casterPosition: Position;
}): CombatState;
export declare function recordConjureElementalRestraint(state: CombatState, guardianId: string, options: {
    targetId: string;
    failedSave: boolean;
}): CombatState;
export declare function resolveConjureElementalRepeatSave(state: CombatState, guardianId: string, options: {
    targetId: string;
    failedSave: boolean;
}): CombatState;
