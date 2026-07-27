import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { UtilityEffect } from '@/types/spells';
import { CombatState } from '@/types/combat';
/**
 * This file applies the mechanical part of the Enhance Ability spell.
 *
 * Enhance Ability is stored as a utility spell because the spell asks the
 * caster to choose a different ability for each touched target. The normal
 * utility command can describe that choice, but it cannot change ability-check
 * rolls. This command bridges the selected per-target choices into the existing
 * character modifier channel that ability checks already read, while also
 * leaving a visible status effect for combat-map and character-sheet surfaces.
 *
 * Called by: SpellCommandFactory when an Enhance Ability cast carries
 * target-indexed choices from the combat input flow.
 * Depends on: CombatCharacter.modifiers.advantage and StatusEffect.modifiers.
 */
export type EnhanceAbilityChoiceMap = Record<string, string>;
export declare class EnhanceAbilityCommand extends BaseEffectCommand {
    private readonly choicesByTargetId;
    constructor(effect: UtilityEffect, context: CommandContext, choicesByTargetId: EnhanceAbilityChoiceMap);
    execute(state: CombatState): CombatState;
    get description(): string;
    private applyChosenAbility;
    private createStatusEffect;
    private createAdvantageText;
    private getDurationRounds;
}
