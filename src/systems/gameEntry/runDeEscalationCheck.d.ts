/**
 * @file src/systems/gameEntry/runDeEscalationCheck.ts
 * Pure resolution + modifier composition for an opening de-escalation check.
 * The visible player roll is supplied by the caller (from useDice), so this
 * stays deterministic and unit-testable.
 */
import type { PlayerCharacter, AbilityScoreName } from '../../types';
import type { StatusEffect } from '../../types/effects';
export interface CheckResolution {
    success: boolean;
    total: number;
    d20: number;
    modifier: number;
    dc: number;
}
export declare function resolveCheck(args: {
    d20: number;
    modifier: number;
    dc: number;
}): CheckResolution;
/**
 * Compose the non-d20 modifier for a character's skill check: ability mod +
 * proficiency (if the character has the skill). Spell bonus DICE (Guidance 1d4)
 * are applied through the existing rollAbilityCheck plumbing when the buff is
 * present; this returns the flat, deterministic part.
 */
export declare function computeSkillModifier(character: PlayerCharacter, ability: AbilityScoreName, skillName: string): number;
export interface CheckBoost {
    source: string;
    bonusDice?: string;
    advantage: boolean;
}
/**
 * Active roll-boosting effects that apply to THIS skill: Guidance/Bless-style
 * bonus dice, and advantage from Enhance Ability. Mirrors the matching rules in
 * checkUtils.collectStructuredAbilityCheckBonuses so the two never disagree.
 */
export declare function getActiveCheckBoosts(character: {
    statusEffects?: StatusEffect[];
}, skillName: string): CheckBoost[];
