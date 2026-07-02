/**
 * @file src/systems/gameEntry/runDeEscalationCheck.ts
 * Pure resolution + modifier composition for an opening de-escalation check.
 * The visible player roll is supplied by the caller (from useDice), so this
 * stays deterministic and unit-testable.
 */
import type { PlayerCharacter, AbilityScoreName } from '../../types';
import { calculateTotalSkillModifier } from '../../utils/character/skillModifierUtils';
// The character-side StatusEffect (types/effects.ts) — what PlayerCharacter
// actually carries; it shares the check-rider fields with the combat type.
import type { StatusEffect } from '../../types/effects';

export interface CheckResolution {
  success: boolean;
  total: number;
  d20: number;
  modifier: number;
  dc: number;
}

export function resolveCheck(args: { d20: number; modifier: number; dc: number }): CheckResolution {
  const total = args.d20 + args.modifier;
  return { success: total >= args.dc, total, d20: args.d20, modifier: args.modifier, dc: args.dc };
}

/**
 * Compose the non-d20 modifier for a character's skill check: ability mod +
 * proficiency (if the character has the skill). Spell bonus DICE (Guidance 1d4)
 * are applied through the existing rollAbilityCheck plumbing when the buff is
 * present; this returns the flat, deterministic part.
 */
export function computeSkillModifier(
  character: PlayerCharacter,
  ability: AbilityScoreName,
  skillName: string,
): number {
  const abilityScore = character.finalAbilityScores[ability];
  const proficient = (character.skills ?? []).some(
    (s) => s.name.toLowerCase() === skillName.toLowerCase(),
  );
  return calculateTotalSkillModifier({
    abilityScore,
    hasProficiency: proficient,
    level: character.level ?? 1,
  });
}

export interface CheckBoost { source: string; bonusDice?: string; advantage: boolean; }

/**
 * Active roll-boosting effects that apply to THIS skill: Guidance/Bless-style
 * bonus dice, and advantage from Enhance Ability. Mirrors the matching rules in
 * checkUtils.collectStructuredAbilityCheckBonuses so the two never disagree.
 */
export function getActiveCheckBoosts(
  character: { statusEffects?: StatusEffect[] },
  skillName: string,
): CheckBoost[] {
  const out: CheckBoost[] = [];
  for (const eff of character.statusEffects ?? []) {
    const mod = eff.abilityCheckModifier;
    if (mod && mod.appliesTo === 'ability_check') {
      if (mod.skillSelection === 'chosen_skill') {
        const chosen = eff.modifiers?.skill?.trim().toLowerCase();
        if (!chosen || chosen !== skillName.toLowerCase()) continue;
      }
      out.push({ source: eff.source || eff.name, bonusDice: mod.bonusDice, advantage: false });
    }
    const advList = eff.modifiers?.advantage;
    if (Array.isArray(advList) && advList.includes('check')) {
      const chosen = eff.modifiers?.skill?.trim().toLowerCase();
      if (!chosen || chosen === skillName.toLowerCase()) {
        out.push({ source: eff.source || eff.name, advantage: true });
      }
    }
  }
  return out;
}
