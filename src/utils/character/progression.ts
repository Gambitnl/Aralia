// [Architect] Extracted from src/utils/character/ to separate concerns
import { PlayerCharacter, AbilityScores, FeatChoice, LevelUpChoices, AbilityScoreName, FeatPrerequisiteContext, Feat } from '../../types';
import { FEATS_DATA } from '../../data/feats/featsData';
import { calculateFinalAbilityScores, calculateArmorClass, getAbilityModifierValue } from '../statUtils';
import { applyFeatToCharacter, getHpBonusPerLevelFromFeats } from './feats';

/**
 * Returns the XP required to reach the next level.
 * @param {number} currentLevel - The character's current level.
 * @returns {number | null} The XP required, or null if max level.
 */
export const getXpRequiredForNextLevel = (currentLevel: number): number | null => {
  if (currentLevel >= 20) return null;
  // D&D 5e XP cumulative thresholds are usually:
  // 1->2: 300, 2->3: 900, 3->4: 2700...
  // The provided XP_THRESHOLDS_BY_LEVEL seems to be encounter thresholds (Easy, Medium, Hard, Deadly), NOT leveling thresholds.
  // I need to use standard D&D 5e leveling XP.

  // Standard 5e XP Table (Cumulative)
  const LEVEL_XP: Record<number, number> = {
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14000,
    7: 23000,
    8: 34000,
    9: 48000,
    10: 64000,
    11: 85000,
    12: 100000,
    13: 120000,
    14: 140000,
    15: 165000,
    16: 195000,
    17: 225000,
    18: 265000,
    19: 305000,
    20: 355000
  };

  return LEVEL_XP[currentLevel + 1] || null;
};

/**
 * Checks if a character has enough XP to level up.
 * @param {PlayerCharacter} character - The character.
 * @returns {boolean} True if eligible for level up.
 */
export const canLevelUp = (character: PlayerCharacter): boolean => {
  const currentLevel = character.level || 1;
  const currentXp = character.xp || 0;
  const nextLevelXp = getXpRequiredForNextLevel(currentLevel);

  if (nextLevelXp === null) return false;
  return currentXp >= nextLevelXp;
};

const ABILITY_SCORE_IMPROVEMENT_LEVELS = [4, 8, 12, 16, 19];

export const getAbilityScoreImprovementBudget = (level: number): number => (
  ABILITY_SCORE_IMPROVEMENT_LEVELS.includes(level) ? 2 : 0
);

const clampAbilityScores = (scores: AbilityScores): AbilityScores => {
  const clamped: AbilityScores = { ...scores };
  (Object.keys(clamped) as AbilityScoreName[]).forEach(key => {
    clamped[key] = Math.min(20, Math.max(1, clamped[key]));
  });
  return clamped;
};

const applyAbilityScoreIncreases = (
  baseScores: AbilityScores,
  increases: Partial<AbilityScores>,
  budget: number,
): AbilityScores => {
  const updated = { ...baseScores };
  let spent = 0;

  (Object.keys(increases) as AbilityScoreName[]).forEach(key => {
    const inc = increases[key] || 0;
    if (inc <= 0 || spent >= budget) return;
    const applied = Math.min(inc, budget - spent);
    updated[key] = (updated[key] || 0) + applied;
    spent += applied;
  });

  return clampAbilityScores(updated);
};

const buildAutomaticAbilityScoreChoice = (character: PlayerCharacter, budget: number): Partial<AbilityScores> => {
  // Prioritize class primary abilities, then highest scores that have room below 20.
  const focusList: AbilityScoreName[] = character.class.primaryAbility as AbilityScoreName[];
  const increases: Partial<AbilityScores> = {};
  let remaining = budget;

  const sortedAbilities = focusList
    .concat((Object.keys(character.abilityScores) as AbilityScoreName[]))
    .filter((value, index, array) => array.indexOf(value) === index);

  sortedAbilities.forEach(ability => {
    if (remaining <= 0) return;
    if (character.abilityScores[ability] >= 20) return;
    const bump = Math.min(2, 20 - character.abilityScores[ability], remaining);
    if (bump > 0) {
      increases[ability] = (increases[ability] || 0) + bump;
      remaining -= bump;
    }
  });

  return increases;
};

/**
 * Performs a full level up on a character, honoring ability score improvements
 * and optional feat selections. Defaults to an auto-allocation when no choice
 * data is supplied so simulation loops can still progress.
 */
export const performLevelUp = (
  character: PlayerCharacter,
  choices?: LevelUpChoices,
): PlayerCharacter => {
  if (!canLevelUp(character)) return character;

  const previousLevel = character.level || 1;
  const newLevel = previousLevel + 1;

  const asiBudget = getAbilityScoreImprovementBudget(newLevel);
  const featChosen = choices?.featId;
  const abilityIncreaseChoice = choices?.abilityScoreIncreases ||
    (!featChosen && asiBudget > 0 ? buildAutomaticAbilityScoreChoice(character, asiBudget) : undefined);
  const appliedBudget = asiBudget > 0
    ? asiBudget
    : (abilityIncreaseChoice ? Object.values(abilityIncreaseChoice).reduce((sum, v) => sum + (v || 0), 0) : 0);

  // Apply ability score improvements (or leave as-is if none selected).
  const updatedBaseScores = abilityIncreaseChoice
    ? applyAbilityScoreIncreases(character.abilityScores, abilityIncreaseChoice, appliedBudget)
    : character.abilityScores;

  const updatedFeats = featChosen ? [...(character.feats || []), featChosen] : (character.feats || []);
  let updatedCharacter: PlayerCharacter = {
    ...character,
    level: newLevel,
    abilityScores: updatedBaseScores,
    feats: updatedFeats,
  };

  if (featChosen) {
    const feat = FEATS_DATA.find(f => f.id === featChosen);
    if (feat) {
      const featChoice = choices?.featChoices?.[featChosen];
      updatedCharacter = applyFeatToCharacter(updatedCharacter, feat, {
        applyHpBonus: false,
        selectedAbilityScore: featChoice?.selectedAbilityScore,
      });

      // Store feat choices on the character if provided
      if (featChoice && !updatedCharacter.featChoices) {
        updatedCharacter.featChoices = {};
      }
      if (featChoice) {
        updatedCharacter.featChoices = {
          ...updatedCharacter.featChoices,
          [featChosen]: featChoice,
        };
      }
    }
  }

  // TODO(FEATURES): Grant class abilities/spells on level-up (beyond ASI/feats) and persist new spellbook entries (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
  // Recalculate derived scores after ASI/feat adjustments.
  updatedCharacter.finalAbilityScores = calculateFinalAbilityScores(updatedCharacter.abilityScores, updatedCharacter.race, updatedCharacter.equippedItems);

  // Calculate HP increase (Average of Hit Die + Con Mod) plus any feat bonuses.
  const hitDie = updatedCharacter.class.hitDie;
  const hpIncreaseBase = (hitDie / 2) + 1;
  const conMod = getAbilityModifierValue(updatedCharacter.finalAbilityScores.Constitution);
  const hpBonusPerLevel = getHpBonusPerLevelFromFeats(updatedCharacter.feats || []);
  const hpGainThisLevel = Math.max(1, hpIncreaseBase + conMod + hpBonusPerLevel);

  // Retroactively apply new Con modifier and per-level bonuses to existing levels.
  const previousConMod = getAbilityModifierValue(character.finalAbilityScores.Constitution);
  const retroactiveConAdjustment = (conMod - previousConMod) * previousLevel;

  // Retroactively apply feat bonuses ONLY if they are new.
  // Existing feats (present in character.feats) have already contributed to maxHp in previous levels.
  const previousHpBonusPerLevel = getHpBonusPerLevelFromFeats(character.feats || []);
  const retroactiveFeatAdjustment = (hpBonusPerLevel - previousHpBonusPerLevel) * previousLevel;

  updatedCharacter.maxHp = (character.maxHp || 0) + hpGainThisLevel + retroactiveConAdjustment + retroactiveFeatAdjustment;
  updatedCharacter.hp = Math.min(updatedCharacter.maxHp, (character.hp || 0) + hpGainThisLevel + retroactiveConAdjustment + retroactiveFeatAdjustment);

  // Calculate new Proficiency Bonus
  updatedCharacter.proficiencyBonus = Math.floor((newLevel - 1) / 4) + 2;
  updatedCharacter.armorClass = calculateArmorClass(updatedCharacter, updatedCharacter.activeEffects);

  return updatedCharacter;
};

/**
 * Adds XP and processes level ups until the character no longer qualifies.
 */
export const applyXpAndHandleLevelUps = (
  character: PlayerCharacter,
  xpGained: number,
  choices?: LevelUpChoices,
): PlayerCharacter => {
  let updatedCharacter = { ...character, xp: (character.xp || 0) + xpGained } as PlayerCharacter;
  let safetyCounter = 0;

  while (canLevelUp(updatedCharacter) && safetyCounter < 20) {
    updatedCharacter = performLevelUp(updatedCharacter, choices);
    safetyCounter += 1;
  }

  return updatedCharacter;
};

/**
 * Evaluates whether a feat meets the provided prerequisite context.
 * Returns both a boolean flag and a human-readable list of unmet reasons
 * to surface in the UI.
 */
export const evaluateFeatPrerequisites = (
  feat: Feat,
  context: FeatPrerequisiteContext,
): { isEligible: boolean; unmet: string[] } => {
  const unmet: string[] = [];
  const { prerequisites } = feat;

  if (prerequisites?.minLevel && context.level < prerequisites.minLevel) {
    unmet.push(`Requires level ${prerequisites.minLevel}+`);
  }

  if (prerequisites?.raceId && prerequisites.raceId !== context.raceId) {
    unmet.push('Restricted to a specific race');
  }

  if (prerequisites?.classId && prerequisites.classId !== context.classId) {
    unmet.push('Restricted to a specific class');
  }

  if (prerequisites?.abilityScores) {
    Object.entries(prerequisites.abilityScores).forEach(([ability, required]) => {
      const score = context.abilityScores[ability as AbilityScoreName] ?? 0;
      if (required && score < required) {
        unmet.push(`${ability} ${required}+`);
      }
    });
  }

  if (prerequisites?.requiresFightingStyle && !context.hasFightingStyle) {
    unmet.push('Requires Fighting Style class feature');
  }

  const alreadyTaken = context.knownFeats?.includes(feat.id);
  if (alreadyTaken) unmet.push('Already learned');

  return { isEligible: unmet.length === 0, unmet };
};
