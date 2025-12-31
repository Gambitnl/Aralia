// [Architect] Extracted from src/utils/character/ to separate concerns
import { PlayerCharacter, AbilityScores, Feat, MagicInitiateSource, AbilityScoreName, FeatChoice } from '../../types';
import { FEATS_DATA } from '../../data/feats/featsData';
import { SKILLS_DATA } from '../../data/skills';
import { calculateFinalAbilityScores, calculateArmorClass } from '../statUtils';

/**
 * Calculates any repeatable HP-per-level bonus from the provided feat list.
 * Tough and Durable style feats use this path to keep HP math consolidated.
 */
export const getHpBonusPerLevelFromFeats = (featIds: string[]): number => featIds.reduce((bonus, featId) => {
  const feat = FEATS_DATA.find(f => f.id === featId);
  const perLevel = feat?.benefits?.hpMaxIncreasePerLevel ?? 0;
  return bonus + perLevel;
}, 0);

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
      // Determine if it's a cantrip (level 0) or leveled spell
      // For granted spells, we assume they go to knownSpells unless they're cantrips
      // We'll add all granted spells to knownSpells for consistency
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
      // at_will spells don't need limited use tracking
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
      // Log a warning if a feat with selectable ASI is applied without a selection
      // This shouldn't happen in normal flow since UI requires selection, but helps with debugging
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

  if (benefit?.skillProficiencies) {
    const newSkills = new Map(updated.skills.map(s => [s.id, s]));
    benefit.skillProficiencies.forEach(skillId => {
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
    });
  }, { ...character });
};
