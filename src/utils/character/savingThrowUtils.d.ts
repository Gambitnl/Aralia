/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:30:59
 * Dependents: SkillSelection.tsx, character/index.ts, concentrationUtils.ts, savingThrowUtils.ts, skillModifierUtils.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/savingThrowUtils.ts
 * Utility functions for handling saving throws in D&D 5e combat.
 */
import { CombatCharacter } from '../../types/combat';
import { SavingThrowAbility } from '../../types/spells';
/**
 * Result of a saving throw roll.
 * Includes the raw roll, total after modifiers, and whether it succeeded.
 */
export interface SavingThrowResult {
    /** Whether the save was successful (total >= dc) */
    success: boolean;
    /** The raw d20 roll before modifiers */
    roll: number;
    /** Final total: roll + ability mod + proficiency + external modifiers */
    total: number;
    /** The difficulty class that needed to be met or exceeded */
    dc: number;
    /** True if the raw roll was 20 (auto-success in some contexts) */
    natural20: boolean;
    /** True if the raw roll was 1 (auto-fail in some contexts) */
    natural1: boolean;
    /** List of modifiers that were applied (e.g., Bless, Mind Sliver) */
    modifiersApplied?: {
        source: string;
        value: number;
    }[];
}
/**
 * Modifier to apply to a saving throw from external effects.
 * Supports both bonuses (Bless) and penalties (Mind Sliver).
 */
export interface SavingThrowModifier {
    dice?: string;
    flat?: number;
    source: string;
}
/**
 * Describes the incoming effect that a saving throw is being made against.
 *
 * Threading this into {@link rollSavingThrow} lets contextual advantage — such as
 * "advantage on saving throws against poison" — match ONLY the relevant effect
 * instead of applying to every save (see RM-SAVE-001).
 *
 * Backward-compatible: when omitted, contextual narrowing is skipped and the roll
 * behaves identically to the pre-context implementation.
 */
export interface SaveEffectContext {
    /** Damage type of the incoming effect, e.g. 'poison', 'fire', 'psychic'. */
    damageType?: string;
    /** Free-form descriptive tags for the effect, e.g. ['poison', 'magic', 'disease']. */
    tags?: string[];
}
/**
 * Structured saving-throw advantage/disadvantage modifier.
 *
 * Replaces brittle free-text strings ("advantage on Intelligence saving throws")
 * with an explicit, matchable shape so advantage applies precisely (see RM-SAVE-002).
 */
export interface SaveAdvantageModifier {
    /** Whether this grants advantage or imposes disadvantage. */
    type: 'advantage' | 'disadvantage';
    /**
     * The roll context this applies to. Fixed to 'saving_throw' today; present so a
     * single modifier list can later host attack/check contexts without a shape change.
     */
    context: 'saving_throw';
    /**
     * Ability names this applies to (e.g. ['Intelligence', 'Wisdom']).
     * Omitted or empty = every ability (e.g. "advantage on all saving throws").
     */
    abilities?: SavingThrowAbility[];
    /**
     * Effect tags / damage types this is limited to, e.g. ['poison'].
     * Omitted or empty = unconditional (applies regardless of effectContext).
     * When set, requires effectContext to carry a matching damageType or tag.
     */
    against?: string[];
    /** Optional label for logging/debugging. */
    source?: string;
}
/**
 * Calculates the proficiency bonus based on character level/CR.
 * Formula: 2 + floor((level - 1) / 4)
 * Level 1-4 = +2, 5-8 = +3, etc.
 */
export declare function calculateProficiencyBonus(level: number): number;
/**
 * Calculates the Spell Save DC for a character.
 * Formula: 8 + Proficiency Bonus + Spellcasting Ability Modifier
 */
export declare function calculateSpellDC(caster: CombatCharacter): number;
/**
 * Rolls a saving throw for a character against a target DC.
 * @param target The character making the save
 * @param ability The ability to use for the save
 * @param dc The difficulty class to beat
 * @param modifiers Optional array of modifiers from active effects (e.g., Mind Sliver's -1d4)
 * @param effectContext Optional description of the effect being saved against (damage type / tags).
 *   Enables contextual advantage (e.g. "against poison") to match only the relevant effect.
 *   Backward-compatible: when omitted, contextual narrowing is skipped.
 * @param structuredModifiers Optional structured advantage/disadvantage modifiers. These match
 *   precisely on ability and effect context, and are preferred over the legacy free-text strings.
 */
export declare function rollSavingThrow(target: CombatCharacter, ability: SavingThrowAbility, dc: number, modifiers?: SavingThrowModifier[], effectContext?: SaveEffectContext, structuredModifiers?: SaveAdvantageModifier[]): SavingThrowResult;
/**
 * Calculates final damage based on saving throw result.
 */
export type SaveEffectOutcome = 'none' | 'half' | 'negates_condition' | 'negates_effect' | 'negates';
export declare function calculateSaveDamage(initialDamage: number, saveResult: SavingThrowResult, effectType?: SaveEffectOutcome): number;
