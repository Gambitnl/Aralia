// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:54:17
 * Dependents: utils/character/characterUtils.ts, utils/character/index.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file handles character progression, leveling up, and feat acquisition.
 *
 * It validates whether a character has enough experience points to level up,
 * manages Ability Score Improvements (ASIs) and feat prerequisites, handles
 * spell slot expansion and cantrip/known-spell learning, grants new class
 * features and subclass milestones, and applies retroactive Constitution/feat HP increases.
 *
 * Called by: Level-up modals, XP reward systems, character builder, and characterUtils facade.
 * Depends on: stats (for racial grants and derived recalculation), defense (for AC),
 * classes/feats data, and spell progression systems.
 */

import {
  PlayerCharacter,
  Feat,
  FeatPrerequisiteContext,
  LevelUpChoices,
  AbilityScoreName,
  MagicInitiateSource,
  FeatChoice,
  AbilityScores,
} from '../../types';
import { FEATS_DATA } from '../../data/feats/featsData';
import { subclassesForClass } from '../../data/classes/subclasses';
import { classFeaturesForLevel } from '../../data/classes/classFeatureProgression';
import { SKILLS_DATA } from '../../data/skills';
import { growSpellSlots, cantripsKnownForClassLevel } from '../../systems/character/spellSlotProgression';
import { getMaxPreparedSpells as computeMaxPreparedSpells } from './getMaxPreparedSpells';
import {
  getAbilityModifierValue,
  calculateFinalAbilityScores,
} from './statUtils';
import {
  applyRacialSpellGrantsByLevel,
  getActiveRacialFeatureTraitsForCharacter,
  deriveAlternateMovementSpeeds,
  resolveClassHitDie,
  getHpBonusPerLevelFromFeats,
  normalizeClassLevels,
  buildHitPointDicePools,
  getHitPointDiceTotal,
  type MovementMode,
} from './stats';
import { calculateArmorClass } from './defense';

// Re-export helpers commonly needed by progression callers
export { getMaxPreparedSpells } from './getMaxPreparedSpells';
export {
  buildHitPointDicePools,
  normalizeClassLevels,
  getHitPointDiceTotal,
};

// ============================================================================
// Experience Points (XP) & Level-Up Eligibility
// ============================================================================
// Uses standard 5e cumulative XP thresholds to determine when a character
// qualifies for their next character level.
// ============================================================================

/**
 * Returns the XP required to reach the next level.
 *
 * @param {number} currentLevel - The character's current level.
 * @returns {number | null} The XP required, or null if max level (20).
 */
export const getXpRequiredForNextLevel = (currentLevel: number): number | null => {
  if (currentLevel >= 20) return null;

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
    20: 355000,
  };

  return LEVEL_XP[currentLevel + 1] || null;
};

/**
 * Checks if a character has enough XP to level up.
 *
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

// ============================================================================
// Feat Prerequisites & Feat Application
// ============================================================================
// Evaluates feat eligibility (level, race, class, stat minimums) and applies
// benefits (ASIs, skills, spells, HP, speed, luck points) to the character.
// ============================================================================

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

/**
 * Applies spell benefits from a feat to the character.
 * Handles granted spells, chosen cantrips/spells, and creates limited use entries.
 */
const applyFeatSpellBenefits = (
  character: PlayerCharacter,
  feat: Feat,
  spellChoices?: {
    selectedCantrips?: string[];
    selectedLeveledSpells?: string[];
    selectedSpellSource?: MagicInitiateSource;
  }
): PlayerCharacter => {
  const updated = { ...character };
  const spellBenefits = feat.benefits?.spellBenefits;
  if (!spellBenefits) return updated;

  // Initialize spellbook if needed
  if (!updated.spellbook) {
    updated.spellbook = {
      knownSpells: [],
      preparedSpells: [],
      cantrips: [],
    };
  } else {
    // Clone to avoid mutations
    updated.spellbook = {
      knownSpells: [...updated.spellbook.knownSpells],
      preparedSpells: [...updated.spellbook.preparedSpells],
      cantrips: [...updated.spellbook.cantrips],
    };
  }

  // Initialize limitedUses if needed
  if (!updated.limitedUses) {
    updated.limitedUses = {};
  } else {
    updated.limitedUses = { ...updated.limitedUses };
  }

  // Process granted spells (automatic, no choice needed)
  if (spellBenefits.grantedSpells) {
    for (const granted of spellBenefits.grantedSpells) {
      if (!updated.spellbook.knownSpells.includes(granted.spellId)) {
        updated.spellbook.knownSpells = [...updated.spellbook.knownSpells, granted.spellId];
      }

      // Create limited use entry for non-at-will spells
      if (granted.castingMethod === 'once_per_long_rest') {
        const limitedUseKey = `feat_${feat.id}_${granted.spellId}`;
        updated.limitedUses[limitedUseKey] = {
          name: `${feat.name}: Cast ${granted.spellId.replace(/-/g, ' ')}`,
          current: 1,
          max: 1,
          resetOn: 'long_rest',
        };
      } else if (granted.castingMethod === 'once_per_short_rest') {
        const limitedUseKey = `feat_${feat.id}_${granted.spellId}`;
        updated.limitedUses[limitedUseKey] = {
          name: `${feat.name}: Cast ${granted.spellId.replace(/-/g, ' ')}`,
          current: 1,
          max: 1,
          resetOn: 'short_rest',
        };
      }
    }
  }

  // Process chosen cantrips
  if (spellChoices?.selectedCantrips) {
    for (const cantripId of spellChoices.selectedCantrips) {
      if (!updated.spellbook.cantrips.includes(cantripId)) {
        updated.spellbook.cantrips = [...updated.spellbook.cantrips, cantripId];
      }
    }
  }

  // Process chosen leveled spells (e.g., Magic Initiate's 1st-level spell)
  if (spellChoices?.selectedLeveledSpells) {
    for (const spellId of spellChoices.selectedLeveledSpells) {
      if (!updated.spellbook.knownSpells.includes(spellId)) {
        updated.spellbook.knownSpells = [...updated.spellbook.knownSpells, spellId];
      }

      // Feat-granted leveled spells can be cast once per long rest without a slot
      const limitedUseKey = `feat_${feat.id}_${spellId}`;
      updated.limitedUses[limitedUseKey] = {
        name: `${feat.name}: Cast ${spellId.replace(/-/g, ' ')}`,
        current: 1,
        max: 1,
        resetOn: 'long_rest',
      };
    }
  }

  return updated;
};

/**
 * Applies a single feat to the character and returns a cloned, updated object.
 * This helper centralizes stat mutations so the creator and level-up paths
 * stay consistent.
 */
export const applyFeatToCharacter = (
  character: PlayerCharacter,
  feat: Feat,
  options?: {
    applyHpBonus?: boolean;
    selectedAbilityScore?: AbilityScoreName;
    selectedCantrips?: string[];
    selectedLeveledSpells?: string[];
    selectedSpellSource?: MagicInitiateSource;
    selectedSkills?: string[];
  }
): PlayerCharacter => {
  let updated: PlayerCharacter = { ...character };
  const applyHpBonus = options?.applyHpBonus ?? true;

  if (!updated.feats) updated.feats = [];
  if (!updated.feats.includes(feat.id)) {
    updated.feats = [...updated.feats, feat.id];
  }

  const benefit = feat.benefits;

  // Handle selectable ability score increases
  if (benefit?.selectableAbilityScores && benefit.selectableAbilityScores.length > 0) {
    const selectedAbility = options?.selectedAbilityScore;
    if (selectedAbility && benefit.selectableAbilityScores.includes(selectedAbility)) {
      const nextBase = { ...updated.abilityScores };
      nextBase[selectedAbility] = Math.min(20, (nextBase[selectedAbility] || 0) + 1);
      updated.abilityScores = nextBase;
    } else if (!selectedAbility) {
      console.warn(`Feat ${feat.id} requires an ability score selection but none was provided. No ASI will be applied.`);
    }
  } else if (benefit?.abilityScoreIncrease) {
    // Handle fixed ability score increases
    const nextBase = { ...updated.abilityScores };
    Object.entries(benefit.abilityScoreIncrease).forEach(([ability, increase]) => {
      const key = ability as AbilityScoreName;
      nextBase[key] = Math.min(20, (nextBase[key] || 0) + (increase || 0));
    });
    updated.abilityScores = nextBase;
  }

  // Handle fixed skill proficiencies
  if (benefit?.skillProficiencies) {
    const newSkills = new Map(updated.skills.map(s => [s.id, s]));
    benefit.skillProficiencies.forEach(skillId => {
      const skill = SKILLS_DATA[skillId];
      if (skill) newSkills.set(skillId, skill);
    });
    updated.skills = Array.from(newSkills.values());
  }

  // Handle selected skill proficiencies (e.g. Skilled feat)
  if (benefit?.selectableSkillCount && benefit.selectableSkillCount > 0 && options?.selectedSkills) {
    const newSkills = new Map(updated.skills.map(s => [s.id, s]));
    options.selectedSkills.forEach(skillId => {
      const skill = SKILLS_DATA[skillId];
      if (skill) newSkills.set(skillId, skill);
    });
    updated.skills = Array.from(newSkills.values());
  }

  if (benefit?.speedIncrease) {
    updated.speed = (updated.speed || 0) + benefit.speedIncrease;
  }

  if (benefit?.initiativeBonus) {
    updated.initiativeBonus = (updated.initiativeBonus || 0) + benefit.initiativeBonus;
  }
  // Alert (2024): Initiative bonus = Proficiency Bonus (scales with level)
  if (benefit?.initiativeBonusProficiency) {
    updated.initiativeBonus = (updated.initiativeBonus || 0) + (updated.proficiencyBonus || 2);
  }

  // Handle saving throw proficiencies
  if (benefit?.savingThrowLinkedToAbility && options?.selectedAbilityScore) {
    const currentProfs = updated.savingThrowProficiencies || [];
    if (!currentProfs.includes(options.selectedAbilityScore)) {
      updated.savingThrowProficiencies = [...currentProfs, options.selectedAbilityScore];
    }
  } else if (benefit?.savingThrowProficiencies) {
    const currentProfs = updated.savingThrowProficiencies || [];
    const newProfs = benefit.savingThrowProficiencies.filter(p => !currentProfs.includes(p));
    if (newProfs.length > 0) {
      updated.savingThrowProficiencies = [...currentProfs, ...newProfs];
    }
  }

  if (benefit?.hpMaxIncreasePerLevel && applyHpBonus) {
    const hpBonus = benefit.hpMaxIncreasePerLevel * (updated.level || 1);
    updated.maxHp = (updated.maxHp || 0) + hpBonus;
    updated.hp = Math.min(updated.maxHp, (updated.hp || updated.maxHp) + hpBonus);
  }

  // Apply spell benefits (granted spells, chosen cantrips/spells, limited uses)
  if (benefit?.spellBenefits) {
    updated = applyFeatSpellBenefits(updated, feat, {
      selectedCantrips: options?.selectedCantrips,
      selectedLeveledSpells: options?.selectedLeveledSpells,
      selectedSpellSource: options?.selectedSpellSource,
    });
  }

  // Lucky (2024): Creates a luck_points pool = Proficiency Bonus, resets on Long Rest.
  if (benefit?.luckyPoints) {
    const pb = updated.proficiencyBonus || 2;
    updated.limitedUses = {
      ...updated.limitedUses,
      luck_points: {
        name: 'Luck Points',
        current: pb,
        max: 'proficiency_bonus' as const,
        resetOn: 'long_rest' as const,
      },
    };
  }

  // Recalculate derived properties when ability scores change.
  updated.finalAbilityScores = calculateFinalAbilityScores(updated.abilityScores, updated.race, updated.equippedItems);
  updated.armorClass = calculateArmorClass(updated, updated.activeEffects);

  return updated;
};

/**
 * Applies many feats in order. Useful for the character creator preview where
 * the final sheet should reflect chosen feats.
 */
export const applyAllFeats = (
  character: PlayerCharacter,
  featIds: string[],
  featChoices?: Record<string, FeatChoice>
): PlayerCharacter => {
  return featIds.reduce((char, featId) => {
    const feat = FEATS_DATA.find(f => f.id === featId);
    if (!feat) return char;

    const choices = featChoices?.[featId];
    return applyFeatToCharacter(char, feat, {
      selectedAbilityScore: choices?.selectedAbilityScore,
      selectedCantrips: choices?.selectedCantrips as string[] | undefined,
      selectedLeveledSpells: choices?.selectedLeveledSpells as string[] | undefined,
      selectedSpellSource: choices?.selectedSpellSource as MagicInitiateSource | undefined,
      selectedSkills: choices?.selectedSkills as string[] | undefined,
    });
  }, { ...character });
};

// ============================================================================
// Ability Score Improvement (ASI) Budgeting
// ============================================================================
// Manages the +2 stat point allowance granted at standard class milestones
// (levels 4, 8, 12, 16, 19).
// ============================================================================

export const ABILITY_SCORE_IMPROVEMENT_LEVELS = [4, 8, 12, 16, 19];

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

// ============================================================================
// Spell Learning Allowance & Level-Up Spell Expansion
// ============================================================================
// Calculates cantrip learning capacity and adds new spells to the spellbook
// on level up.
// ============================================================================

export interface SpellcastingAllowance {
  /** Class cantrips the character should know at this level. */
  maxCantrips: number;
  /** Cantrips still unfilled (maxCantrips minus cantrips already on the sheet). */
  cantripsToLearn: number;
  /** Leveled spells that may be prepared/known, or null if not applicable. */
  maxPreparedSpells: number | null;
}

export const getSpellcastingAllowance = (character: PlayerCharacter): SpellcastingAllowance => {
  const classId = character.class?.id ?? '';
  const level = character.level ?? 1;
  const maxCantrips = cantripsKnownForClassLevel(classId, level);
  const knownCantrips = character.spellbook?.cantrips?.length ?? 0;
  const maxPreparedSpells = computeMaxPreparedSpells(character);
  return {
    maxCantrips,
    cantripsToLearn: Math.max(0, maxCantrips - knownCantrips),
    maxPreparedSpells,
  };
};

const applyLevelUpSpellLearning = (
  character: PlayerCharacter,
  choices?: LevelUpChoices,
): PlayerCharacter => {
  const classId = character.class?.id ?? '';
  const level = character.level ?? 1;
  const maxCantrips = cantripsKnownForClassLevel(classId, level);

  const chosenCantrips = choices?.selectedCantrips ?? [];
  const chosenKnownSpells = choices?.selectedKnownSpells ?? [];
  if (chosenCantrips.length === 0 && chosenKnownSpells.length === 0) {
    return character;
  }

  const spellbook = character.spellbook
    ? {
        knownSpells: [...(character.spellbook.knownSpells || [])],
        preparedSpells: [...(character.spellbook.preparedSpells || [])],
        cantrips: [...(character.spellbook.cantrips || [])],
        racialSpellGrants: character.spellbook.racialSpellGrants
          ? [...character.spellbook.racialSpellGrants]
          : undefined,
      }
    : { knownSpells: [] as string[], preparedSpells: [] as string[], cantrips: [] as string[] };

  // Add chosen cantrips up to the derived class cantrip capacity.
  const cantripSet = new Set(spellbook.cantrips);
  for (const cantripId of chosenCantrips) {
    if (cantripSet.size >= maxCantrips) break;
    if (!cantripSet.has(cantripId)) {
      cantripSet.add(cantripId);
    }
  }
  spellbook.cantrips = Array.from(cantripSet);

  // Add chosen leveled spells to the known-spells list (deduped) for spellcasters.
  const isSpellcaster = computeMaxPreparedSpells(character) !== null || maxCantrips > 0;
  if (isSpellcaster) {
    const knownSet = new Set(spellbook.knownSpells);
    for (const spellId of chosenKnownSpells) {
      knownSet.add(spellId);
    }
    spellbook.knownSpells = Array.from(knownSet);
  }

  return { ...character, spellbook };
};

// ============================================================================
// Core Level-Up Execution
// ============================================================================
// Performs all state updates for a single or multiple level-ups, including
// HP increases, Hit Dice expansion, spell slot growth, and feat application.
// ============================================================================

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
        selectedCantrips: featChoice?.selectedCantrips as string[] | undefined,
        selectedLeveledSpells: featChoice?.selectedLeveledSpells as string[] | undefined,
        selectedSpellSource: featChoice?.selectedSpellSource as MagicInitiateSource | undefined,
        selectedSkills: featChoice?.selectedSkills as string[] | undefined,
      });
    }
  }

  // Persist every choice this level-up step produced, not only the chosen feat's.
  // Class features record their picks under their own key (the bard `expertise`
  // feature, the wizard `scholar` feature, the `skill_expert` feat), and readers
  // such as getExpertiseSkillIds walk every `featChoices` entry. Copying only
  // `featChoices[featChosen]` dropped those keys, so an expertise pick made in
  // the level-up modal never reached the sheet (WF-G269).
  // Existing entries survive; this level's entries win a key collision.
  const levelUpFeatChoices = choices?.featChoices;
  if (levelUpFeatChoices && Object.keys(levelUpFeatChoices).length > 0) {
    updatedCharacter.featChoices = {
      ...(updatedCharacter.featChoices ?? {}),
      ...levelUpFeatChoices,
    };
  }

  // Grow spell slots to the new level (preserving already-spent slots).
  const spellcastingClassId = choices?.classId || updatedCharacter.class?.id || '';
  const grownSlots = growSpellSlots(updatedCharacter.spellSlots, spellcastingClassId, newLevel);
  if (grownSlots) {
    updatedCharacter.spellSlots = grownSlots;
  }

  // Level 3 is the subclass milestone. Apply chosen subclass if unassigned.
  if (newLevel >= 3 && !updatedCharacter.subclassId) {
    const chosenSubclass = choices?.subclassId ?? subclassesForClass(spellcastingClassId)[0]?.id;
    if (chosenSubclass) {
      updatedCharacter.subclassId = chosenSubclass;
    }
  }

  // Battle Master (level 3): grant the canonical four d8 Superiority Dice pool.
  if (
    newLevel >= 3
    && updatedCharacter.class?.id === 'fighter'
    && updatedCharacter.subclassId === 'battle_master'
    && !updatedCharacter.limitedUses?.superiority_dice
  ) {
    updatedCharacter.limitedUses = {
      ...(updatedCharacter.limitedUses ?? {}),
      superiority_dice: {
        name: 'Superiority Dice',
        current: 4,
        max: 4,
        resetOn: 'short_rest',
      },
    };
  }

  // Grant class abilities (non-spell class features) on level-up.
  const allFeaturesForLevel = classFeaturesForLevel(updatedCharacter.class, newLevel, updatedCharacter.subclassId);
  if (allFeaturesForLevel.length > 0) {
    updatedCharacter.class = {
      ...updatedCharacter.class,
      features: allFeaturesForLevel,
    };
  }

  updatedCharacter = applyLevelUpSpellLearning(updatedCharacter, choices);

  // Recalculate derived scores after ASI/feat adjustments.
  updatedCharacter = applyRacialSpellGrantsByLevel(updatedCharacter, newLevel);
  updatedCharacter.finalAbilityScores = calculateFinalAbilityScores(updatedCharacter.abilityScores, updatedCharacter.race, updatedCharacter.equippedItems);

  // Calculate HP increase (Average of Hit Die + Con Mod) plus any feat bonuses.
  const leveledClassId = choices?.classId || updatedCharacter.class?.id;
  const hitDie = leveledClassId ? resolveClassHitDie(updatedCharacter, leveledClassId) : updatedCharacter.class.hitDie;
  const hpIncreaseBase = (hitDie / 2) + 1;
  const conMod = getAbilityModifierValue(updatedCharacter.finalAbilityScores.Constitution);
  const hpBonusPerLevel = getHpBonusPerLevelFromFeats(updatedCharacter.feats || []);
  const hpGainThisLevel = Math.max(1, hpIncreaseBase + conMod + hpBonusPerLevel);

  // Retroactively apply new Con modifier and per-level bonuses to existing levels.
  const previousConMod = getAbilityModifierValue(character.finalAbilityScores.Constitution);
  const retroactiveConAdjustment = (conMod - previousConMod) * previousLevel;

  // Retroactively apply feat bonuses ONLY if they are new.
  const previousHpBonusPerLevel = getHpBonusPerLevelFromFeats(character.feats || []);
  const retroactiveFeatAdjustment = (hpBonusPerLevel - previousHpBonusPerLevel) * previousLevel;

  updatedCharacter.maxHp = (character.maxHp || 0) + hpGainThisLevel + retroactiveConAdjustment + retroactiveFeatAdjustment;
  updatedCharacter.hp = Math.min(updatedCharacter.maxHp, (character.hp || 0) + hpGainThisLevel + retroactiveConAdjustment + retroactiveFeatAdjustment);

  // Update class level tracking and refresh Hit Dice pools for the new level.
  const updatedClassLevels = normalizeClassLevels(character);
  if (leveledClassId) {
    updatedClassLevels[leveledClassId] = (updatedClassLevels[leveledClassId] || 0) + 1;
  }
  updatedCharacter.classLevels = updatedClassLevels;
  updatedCharacter.hitPointDice = buildHitPointDicePools(updatedCharacter, {
    classLevels: updatedClassLevels,
    previousPools: character.hitPointDice,
  });

  // Calculate new Proficiency Bonus and AC
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
    const nextLevel = (updatedCharacter.level || 1) + 1;
    const asiBudget = getAbilityScoreImprovementBudget(nextLevel);
    const hasAsiOrFeatChoice = !!choices && (!!choices.featId || !!choices.abilityScoreIncreases);

    // Pause automatic leveling when a choice is required but none was provided.
    if (asiBudget > 0 && !hasAsiOrFeatChoice) {
      break;
    }

    updatedCharacter = performLevelUp(updatedCharacter, choices);
    safetyCounter += 1;

    // Avoid reusing a single choice payload across multiple level-ups.
    if (choices) {
      break;
    }
  }

  return updatedCharacter;
};

// ============================================================================
// Level-Gated Racial Movement Modes
// ============================================================================
// A race can grant a movement mode that only starts at a later character
// level. Dragonborn Draconic Flight, which begins at level 5, is the case
// this was written for. `deriveAlternateMovementSpeeds` reads every race
// trait at once and has no level to judge them by, so on its own it hands a
// level-1 Dragonborn a flying speed.
//
// This pairs that same speed parser with the level window the racial trait
// parser already records, so a mode is reported only once its trait is live.
//
// Preserved: the speed prose parser stays the one place that decides how a
// speed sentence is read (numeric, comma form, and "equal to your walking
// speed"), and the level window stays owned by the racial trait library.
// Neither is re-implemented here.
//
// Caller status (agora-81ba, verified 2026-09-20): the character sheet overview
// reads this module. `CharacterOverview.tsx` calls `getRacialMovementSpeedsForLevel`,
// so a later-level mode such as Draconic Flight stays off the sheet until its own
// level is reached.
//
// Still open (agora-81ba follow-up): the combat actor build does not read it.
// `createPlayerCombatCharacter` in src/utils/combat/combatUtils.ts sets a walking
// `stats.speed` only and never writes `stats.extraMovementSpeeds`, so a racial fly,
// swim, climb, or burrow mode never reaches a player combatant at any level. The
// readers of that field (aerialMovementUtils, actionEconomyUtils, useBattleMap,
// useGridMovement) therefore see nothing for a player actor.
// ============================================================================

/**
 * One movement mode a race grants, with the trait and level window it comes
 * from. A mode written on the core "Speed:" line is reported as always-on
 * (`minLevel` 1) under the trait name `Speed`.
 */
export interface RacialMovementUnlock {
  mode: MovementMode;
  speedFeet: number;
  minLevel: number;
  maxLevel?: number;
  traitName: string;
}

const readMovementSpeedsFromTraits = (
  character: PlayerCharacter,
  traits: string[],
): Partial<Record<MovementMode, number>> => deriveAlternateMovementSpeeds({
  ...character,
  race: { ...character.race, traits },
});

/**
 * Lists the movement modes a character's race has actually unlocked at a given
 * level, one entry per granting trait.
 *
 * @param {PlayerCharacter} character - The character whose race is read.
 * @param {number} targetLevel - Character level to judge trait windows against.
 * @returns {RacialMovementUnlock[]} Unlocked modes; empty when the race grants none.
 */
export const getRacialMovementUnlocksForLevel = (
  character: PlayerCharacter,
  targetLevel: number = character.level ?? 1,
): RacialMovementUnlock[] => {
  const race = character.race;
  if (!race?.traits?.length) return [];

  // The core "Speed:" line carries the walking speed and, in the comma form
  // ("Speed: 30 feet, Swim 30 feet"), an alternate mode of its own. It states
  // no level, so it is always on and every per-trait read keeps it in view:
  // a trait that says "equal to your walking speed" needs it to resolve.
  const baseSpeedTraits = race.traits.filter(trait => trait.toLowerCase().startsWith('speed:'));
  const baseSpeeds = readMovementSpeedsFromTraits(character, baseSpeedTraits);

  const unlocks: RacialMovementUnlock[] = (Object.keys(baseSpeeds) as MovementMode[])
    .flatMap((mode) => {
      const speedFeet = baseSpeeds[mode];
      return speedFeet === undefined
        ? []
        : [{ mode, speedFeet, minLevel: 1, traitName: 'Speed' }];
    });

  getActiveRacialFeatureTraitsForCharacter(character, targetLevel).forEach((trait) => {
    const traitText = trait.sourceText ?? `${trait.traitName}: ${trait.traitDescription}`;
    const speeds = readMovementSpeedsFromTraits(character, [...baseSpeedTraits, traitText]);

    (Object.keys(speeds) as MovementMode[]).forEach((mode) => {
      const speedFeet = speeds[mode];
      if (speedFeet === undefined) return;
      // Already reported from the core line; the trait added nothing here.
      if (baseSpeeds[mode] === speedFeet) return;
      unlocks.push({
        mode,
        speedFeet,
        minLevel: trait.minLevel,
        maxLevel: trait.maxLevel,
        traitName: trait.traitName,
      });
    });
  });

  return unlocks;
};

/**
 * Level-gated companion to `deriveAlternateMovementSpeeds`: the alternate
 * movement speeds a character has at a level, with later-level racial traits
 * left out until that level is reached.
 *
 * @param {PlayerCharacter} character - The character whose race is read.
 * @param {number} targetLevel - Character level to judge trait windows against.
 * @returns {Partial<Record<MovementMode, number>>} Mode to speed in feet.
 */
export const getRacialMovementSpeedsForLevel = (
  character: PlayerCharacter,
  targetLevel: number = character.level ?? 1,
): Partial<Record<MovementMode, number>> => {
  const speeds: Partial<Record<MovementMode, number>> = {};

  getRacialMovementUnlocksForLevel(character, targetLevel).forEach((unlock) => {
    const current = speeds[unlock.mode];
    // Two traits can grant the same mode; the faster grant is the one that
    // applies, exactly as the level-blind parser resolves overlapping prose.
    if (current === undefined || unlock.speedFeet > current) {
      speeds[unlock.mode] = unlock.speedFeet;
    }
  });

  return speeds;
};
