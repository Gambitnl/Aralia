// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:01
 * Dependents: SkillSelection.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/character/skillModifierUtils.ts
 * Shared skill modifier math: ability modifier, proficiency, and expertise.
 *
 * Expertise doubles the proficiency bonus on a chosen skill. The choice itself
 * is per-character data, so this module reads it from the one place the game
 * already stores per-feature selections: `PlayerCharacter.featChoices`. Each
 * entry is keyed by the granting feature id (the `skill_expert` feat, the bard
 * `expertise` feature, the wizard `scholar` feature) and carries the chosen
 * skill ids under `selectedExpertiseSkills`. `FeatChoice` already declares an
 * index signature, so no new character field is needed to record a pick.
 *
 * Called by: CharacterCreator/SkillSelection.tsx, CharacterSheet/Skills/SkillsTab.tsx,
 * utils/character/checkUtils.ts, systems/perception/stealthResolution.ts,
 * systems/gameEntry/runDeEscalationCheck.ts.
 */

import { calculateProficiencyBonus } from './savingThrowUtils';
import { getAbilityModifierValue } from './statUtils';
import type { PlayerCharacter } from '../../types/character';
import type { AbilityScoreName } from '../../types/core';
import { SKILLS_DATA } from '../../data/skills';
import { classFeaturesForLevel } from '../../data/classes/classFeatureProgression';

/**
 * Key that a feature's `FeatChoice` entry uses to record the skills it granted
 * expertise in. One key for every expertise source keeps the reader below from
 * having to know which features exist.
 */
export const EXPERTISE_CHOICE_KEY = 'selectedExpertiseSkills';

/** Minimum shape this module needs. Keeps the helpers usable from test fixtures. */
export interface ExpertiseSource {
  featChoices?: Record<string, Record<string, unknown> | undefined>;
}

/**
 * Normalizes a skill label to the id form used by SKILLS_DATA
 * ("Sleight of Hand" and "sleight_of_hand" both become "sleight_of_hand").
 */
export function normalizeSkillId(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Returns every skill id this character has expertise in, normalized and deduped.
 * Reads each `featChoices` entry, so a feat and a class feature that both grant
 * expertise contribute without either one knowing about the other.
 */
export function getExpertiseSkillIds(character: ExpertiseSource | undefined | null): string[] {
  const choices = character?.featChoices;
  if (!choices) {
    return [];
  }

  const found = new Set<string>();
  for (const choice of Object.values(choices)) {
    const selected = choice?.[EXPERTISE_CHOICE_KEY];
    if (!Array.isArray(selected)) {
      continue;
    }
    for (const entry of selected) {
      if (typeof entry === 'string' && entry.trim()) {
        found.add(normalizeSkillId(entry));
      }
    }
  }

  return [...found];
}

/** True when the character has recorded expertise in the named skill. */
export function hasExpertiseInSkill(
  character: ExpertiseSource | undefined | null,
  skill: string
): boolean {
  return getExpertiseSkillIds(character).includes(normalizeSkillId(skill));
}

/**
 * The extra bonus expertise adds on top of the proficiency bonus already counted.
 * Expertise doubles proficiency, so it is worth one more proficiency bonus, and
 * only for a skill the character is actually proficient in.
 */
export function calculateExpertiseBonus(params: {
  hasProficiency: boolean;
  hasExpertise: boolean;
  proficiencyBonus: number;
}): number {
  const { hasProficiency, hasExpertise, proficiencyBonus } = params;
  return hasProficiency && hasExpertise ? proficiencyBonus : 0;
}

/**
 * Detects whether a character has the Bard feature Jack of All Trades:
 * "Starting at 2nd level, you can add half your proficiency bonus, rounded down,
 * to any ability check you make that doesn't already include your proficiency bonus."
 */
export function hasJackOfAllTrades(character: unknown): boolean {
  if (!character || typeof character !== 'object') return false;
  const c = character as Record<string, any>;
  const level = (typeof c.level === 'number' && c.level > 0) ? c.level : 1;

  // 1. Direct class check for Bard at level 2+
  const classId = typeof c.class === 'string' ? c.class : c.class?.id;
  if (typeof classId === 'string' && classId.toLowerCase() === 'bard' && level >= 2) {
    return true;
  }

  // 2. Class features progression check
  if (c.class && typeof c.class === 'object') {
    try {
      const features = classFeaturesForLevel(c.class, level, c.subclassId);
      if (features.some(f => f.id === 'jack_of_all_trades')) {
        return true;
      }
    } catch {
      // In case of incomplete test mocks, ignore error
    }
  }

  // 3. Fallback: direct feature lists or traits or modifiers
  if (Array.isArray(c.features) && c.features.some((f: any) => f?.id === 'jack_of_all_trades' || f === 'jack_of_all_trades')) {
    return true;
  }
  if (c.modifiers?.traits?.includes('jack_of_all_trades')) {
    return true;
  }
  if (Array.isArray(c.traits) && c.traits.includes('jack_of_all_trades')) {
    return true;
  }

  return false;
}

/**
 * Calculates the Jack of All Trades bonus: half proficiency bonus rounded down,
 * applied only when the check does NOT already include proficiency bonus.
 */
export function calculateJackOfAllTradesBonus(params: {
  hasProficiency: boolean;
  hasJackOfAllTrades: boolean;
  proficiencyBonus: number;
}): number {
  const { hasProficiency, hasJackOfAllTrades, proficiencyBonus } = params;
  return !hasProficiency && hasJackOfAllTrades ? Math.floor(proficiencyBonus / 2) : 0;
}

export function calculateTotalSkillModifier(params: {
  abilityScore: number;
  hasProficiency: boolean;
  level: number;
  /** Doubles the proficiency bonus. Ignored when the character is not proficient. */
  hasExpertise?: boolean;
  /** Adds half proficiency bonus (rounded down) if not proficient. */
  hasJackOfAllTrades?: boolean;
}): number {
  const { abilityScore, hasProficiency, level, hasExpertise = false, hasJackOfAllTrades = false } = params;
  const abilityMod = getAbilityModifierValue(abilityScore);
  const proficiencyBonus = calculateProficiencyBonus(level);
  const profBonusApplied = hasProficiency ? proficiencyBonus : 0;
  const expertiseBonus = calculateExpertiseBonus({
    hasProficiency,
    hasExpertise,
    proficiencyBonus,
  });
  const jackBonus = calculateJackOfAllTradesBonus({
    hasProficiency,
    hasJackOfAllTrades,
    proficiencyBonus,
  });
  return abilityMod + profBonusApplied + expertiseBonus + jackBonus;
}

/**
 * Resolves the total skill check modifier for a PlayerCharacter on a specific skill,
 * including base ability modifier, proficiency, expertise, and Jack of All Trades.
 */
export function getCharacterSkillModifier(
  character: PlayerCharacter,
  skillIdOrName: string,
  abilityOverride?: AbilityScoreName,
): number {
  const normalized = normalizeSkillId(skillIdOrName);
  const skill = SKILLS_DATA[normalized] || Object.values(SKILLS_DATA).find(
    s => normalizeSkillId(s.name) === normalized || normalizeSkillId(s.id) === normalized
  );
  const ability = abilityOverride ?? (skill?.ability || 'Dexterity');
  const abilityScore = character.finalAbilityScores?.[ability] ?? character.abilityScores?.[ability] ?? 10;
  const isProficient = (character.skills ?? []).some(
    s => normalizeSkillId(s.id) === normalized || normalizeSkillId(s.name) === normalized
  );
  const hasExpertise = hasExpertiseInSkill(character, normalized);
  const hasJack = hasJackOfAllTrades(character);
  const level = character.level ?? 1;

  return calculateTotalSkillModifier({
    abilityScore,
    hasProficiency: isProficient,
    level,
    hasExpertise,
    hasJackOfAllTrades: hasJack,
  });
}
