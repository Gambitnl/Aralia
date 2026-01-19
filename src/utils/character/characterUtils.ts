/**
 * @file src/utils/characterUtils.ts
 * This file contains utility functions related to player characters,
 * such as calculating ability score modifiers, armor class, and equipment rules.
 */
import {
  PlayerCharacter,
  Item,
  ArmorCategory,
  ArmorProficiencyLevel,
  TempPartyMember,
  AbilityScores,
  DraconicAncestryInfo,
  Feat,
  FeatPrerequisiteContext,
  LevelUpChoices,
  AbilityScoreName,
  MagicInitiateSource,
  FeatChoice,
  HitDieSize,
  HitPointDicePool,
} from '../../types';
import { ALL_RACES_DATA as RACES_DATA, RACE_DATA_BUNDLE } from '../../data/races';
import { CLASSES_DATA } from '../../data/classes';
import { SKILLS_DATA } from '../../data/skills';

const {
  dragonbornAncestries: DRAGONBORN_ANCESTRIES,
  goliathGiantAncestries: GIANT_ANCESTRIES,
  tieflingLegacies: TIEFLING_LEGACIES,
} = RACE_DATA_BUNDLE;
import { FEATS_DATA } from '../../data/feats/featsData';

/**
 * Calculates the D&D ability score modifier as a number.
 * @param {number} score - The ability score.
 * @returns {number} The numerical modifier (e.g., 2, -1, 0).
 */
export { getAbilityModifierValue, calculateFinalAbilityScores, getAbilityModifierString } from './statUtils';
export { getMaxPreparedSpells } from './getMaxPreparedSpells';
import { getAbilityModifierValue, calculateFinalAbilityScores, calculateFixedRacialBonuses, calculateArmorClass } from './statUtils';
import {
  isWeaponProficient,
  isWeaponMartial
} from './weaponUtils';

/**
 * Generates a descriptive race display string for a character.
 * e.g., "Drow Elf", "Black Dragonborn", "Stone Goliath", "Human".
 * @param {PlayerCharacter} character - The player character object.
 * @returns {string} The formatted race display string.
 */
export function getCharacterRaceDisplayString(character: PlayerCharacter): string {
  const { race, racialSelections } = character;

  if (!race) return 'Unknown Race';

  const getSelectionName = <T extends { id: string }>(
    data: T[] | undefined,
    id: string | undefined,
    nameKey: keyof T,
    suffixToRemove: string
  ): string | null => {
    if (!id || !data) return null;
    const found = data.find(item => item.id === id);
    const value = found ? found[nameKey] : null;
    if (typeof value === 'string') {
      return value.replace(suffixToRemove, '').trim();
    }
    return null;
  }

  switch (race.id) {
    case 'elf': {
      const lineageName = getSelectionName(RACES_DATA.elf?.elvenLineages, racialSelections?.['elf']?.choiceId, 'name', 'Lineage');
      return lineageName ? `${lineageName}` : race.name;
    }
    case 'dragonborn': {
      const ancestryId = racialSelections?.['dragonborn']?.choiceId;
      const ancestry = ancestryId ? (DRAGONBORN_ANCESTRIES as Record<string, DraconicAncestryInfo>)[ancestryId] : null;
      return ancestry ? `${ancestry.type} ${race.name}` : race.name;
    }
    case 'gnome': {
      const subraceName = getSelectionName(RACES_DATA.gnome?.gnomeSubraces, racialSelections?.['gnome']?.choiceId, 'name', '');
      return subraceName ? subraceName : race.name;
    }
    case 'goliath': {
      // GIANT_ANCESTRIES has 'id' like 'Fire', 'Stone', and 'name' like 'Fire Giant Ancestry'
      // The original code used 'id' for the display name prefix (e.g. "Fire Goliath").
      const ancestryName = getSelectionName(GIANT_ANCESTRIES, racialSelections?.['goliath']?.choiceId, 'id', '');
      return ancestryName ? `${ancestryName} ${race.name}` : race.name;
    }
    case 'tiefling': {
      const legacyName = getSelectionName(TIEFLING_LEGACIES, racialSelections?.['tiefling']?.choiceId, 'name', 'Legacy');
      return legacyName ? `${legacyName} ${race.name}` : race.name;
    }
    default:
      return race.name;
  }
}

const HIT_DIE_SIZES: HitDieSize[] = [6, 8, 10, 12];

const isHitDieSize = (value: number | undefined): value is HitDieSize =>
  typeof value === 'number' && HIT_DIE_SIZES.includes(value as HitDieSize);

const resolveClassHitDie = (character: PlayerCharacter, classId: string): HitDieSize => {
  if (character.class?.id === classId && isHitDieSize(character.class.hitDie)) {
    return character.class.hitDie;
  }
  const fromCharacterList = character.classes?.find(cls => cls.id === classId);
  if (fromCharacterList?.hitDie && isHitDieSize(fromCharacterList.hitDie)) {
    return fromCharacterList.hitDie;
  }
  const fromData = CLASSES_DATA[classId]?.hitDie;
  if (isHitDieSize(fromData)) {
    return fromData;
  }
  return 8;
};

const sanitizeHitPointDicePools = (pools: HitPointDicePool[]): HitPointDicePool[] => {
  const sanitized = pools
    .map(pool => ({
      die: pool.die,
      max: Math.max(0, Math.floor(pool.max)),
      current: Math.max(0, Math.floor(pool.current)),
    }))
    .filter(pool => isHitDieSize(pool.die) && pool.max > 0);
  return sanitized
    .map(pool => ({
      ...pool,
      current: Math.min(pool.current, pool.max),
    }))
    .sort((a, b) => a.die - b.die);
};

const coerceHitPointDicePools = (
  character: PlayerCharacter,
  pools: PlayerCharacter['hitPointDice'] | { current?: number; max?: number } | null | undefined,
): HitPointDicePool[] | null => {
  if (Array.isArray(pools)) {
    return sanitizeHitPointDicePools(pools);
  }
  if (pools && typeof pools === 'object' && ('current' in pools || 'max' in pools)) {
    const level = Math.max(1, character.level ?? 1);
    const die = resolveClassHitDie(character, character.class.id);
    const max = Math.max(1, Math.floor(pools.max ?? level));
    const current = Math.min(max, Math.max(0, Math.floor(pools.current ?? max)));
    return sanitizeHitPointDicePools([{ die, current, max }]);
  }
  return null;
};

export const normalizeClassLevels = (character: PlayerCharacter): Record<string, number> => {
  const level = Math.max(1, character.level ?? 1);
  const primaryClassId = character.class?.id;
  const normalized: Record<string, number> = {};

  if (character.classLevels && Object.keys(character.classLevels).length > 0) {
    Object.entries(character.classLevels).forEach(([classId, count]) => {
      const safeCount = Math.max(0, Math.floor(count));
      if (safeCount > 0) {
        normalized[classId] = safeCount;
      }
    });
  } else if (character.classes && character.classes.length > 0) {
    character.classes.forEach(cls => {
      normalized[cls.id] = (normalized[cls.id] || 0) + 1;
    });
  }

  if (primaryClassId && normalized[primaryClassId] === undefined) {
    normalized[primaryClassId] = 0;
  }

  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  if (total < level && primaryClassId) {
    normalized[primaryClassId] = (normalized[primaryClassId] || 0) + (level - total);
  } else if (total > level) {
    let excess = total - level;
    const adjustmentOrder = primaryClassId
      ? [primaryClassId, ...Object.keys(normalized).filter(id => id !== primaryClassId)]
      : Object.keys(normalized);
    adjustmentOrder.forEach(classId => {
      if (excess <= 0) return;
      const available = normalized[classId] || 0;
      const reduction = Math.min(available, excess);
      normalized[classId] = available - reduction;
      excess -= reduction;
      if (normalized[classId] <= 0) {
        delete normalized[classId];
      }
    });
  }

  if (Object.keys(normalized).length === 0 && primaryClassId) {
    normalized[primaryClassId] = level;
  }

  return normalized;
};

const buildHitPointDiceMaxByDie = (
  character: PlayerCharacter,
  classLevels: Record<string, number>,
): Record<HitDieSize, number> => {
  const maxByDie: Record<HitDieSize, number> = {
    6: 0,
    8: 0,
    10: 0,
    12: 0,
  };

  Object.entries(classLevels).forEach(([classId, count]) => {
    if (count <= 0) return;
    const die = resolveClassHitDie(character, classId);
    maxByDie[die] += count;
  });

  return maxByDie;
};

const mergeHitPointDicePools = (
  prevPools: HitPointDicePool[] | null | undefined,
  maxByDie: Record<HitDieSize, number>,
): HitPointDicePool[] => {
  const previous = sanitizeHitPointDicePools(prevPools ?? []);
  const previousByDie = new Map(previous.map(pool => [pool.die, pool]));

  const nextPools = HIT_DIE_SIZES.map((die) => {
    const max = maxByDie[die] || 0;
    if (max <= 0) return null;
    const prev = previousByDie.get(die);
    const prevMax = prev?.max ?? 0;
    const prevCurrent = prev?.current ?? prevMax;
    const gained = Math.max(0, max - prevMax);
    const current = Math.min(max, Math.max(0, prevCurrent + gained));
    return { die, current, max };
  }).filter(Boolean) as HitPointDicePool[];

  return sanitizeHitPointDicePools(nextPools);
};

export const buildHitPointDicePools = (
  character: PlayerCharacter,
  overrides?: {
    classLevels?: Record<string, number>;
    previousPools?: PlayerCharacter['hitPointDice'] | { current?: number; max?: number } | null;
  },
): HitPointDicePool[] => {
  const classLevels = overrides?.classLevels ?? normalizeClassLevels(character);
  const prevPools = coerceHitPointDicePools(character, overrides?.previousPools ?? character.hitPointDice);
  const maxByDie = buildHitPointDiceMaxByDie(character, classLevels);
  return mergeHitPointDicePools(prevPools, maxByDie);
};

export const getHitPointDiceTotal = (pools?: HitPointDicePool[]): number =>
  (pools ?? []).reduce((sum, pool) => sum + pool.current, 0);

/**
 * Returns a numerical value for armor categories to allow for comparisons.
 * @param {ArmorCategory} [category] - The armor category.
 * @returns {number} A numerical representation of the proficiency level.
 */
export const getArmorCategoryHierarchy = (category?: ArmorCategory): number => {
  if (!category) return 0;
  switch (category) {
    case 'Light': return 1;
    case 'Medium': return 2;
    case 'Heavy': return 3;
    case 'Shield': return 0;
    default: return 0;
  }
};

/**
 * Determines the highest level of armor a character is proficient with.
 * @param {PlayerCharacter} character - The character object.
 * @returns {ArmorProficiencyLevel} The highest level of armor proficiency.
 */
export const getCharacterMaxArmorProficiency = (character: PlayerCharacter): ArmorProficiencyLevel => {
  const profs = character.class.armorProficiencies.map(p => p.toLowerCase());
  if (profs.includes('all armor') || profs.includes('heavy armor')) return 'heavy';
  if (profs.includes('medium armor')) return 'medium';
  if (profs.includes('light armor')) return 'light';
  return 'unarmored';
};

export { calculateArmorClass };

/**
 * Checks if a character can equip a given item based on proficiencies and requirements.
 * @param {PlayerCharacter} character - The character attempting to equip the item.
 * @param {Item} item - The item to be equipped.
 * @returns {{can: boolean, reason?: string}} An object indicating if the item can be equipped and why not if applicable.
 */
export const canEquipItem = (character: PlayerCharacter, item: Item): { can: boolean; reason?: string } => {
  // Check requirements first, regardless of proficiency
  if (item.requirements) {
    const { requirements } = item;
    if (requirements.minLevel && (character.level || 1) < requirements.minLevel) {
      return { can: false, reason: `Requires Level ${requirements.minLevel}.` };
    }
    if (requirements.classId && !requirements.classId.includes(character.class.id)) {
      return { can: false, reason: `Class restricted.` };
    }
    // Check stat requirements against BASE or CURRENT stats?
    // Usually current final stats.
    if (requirements.minStrength && character.finalAbilityScores.Strength < requirements.minStrength) {
      return { can: false, reason: `Requires ${requirements.minStrength} Strength.` };
    }
    if (requirements.minDexterity && character.finalAbilityScores.Dexterity < requirements.minDexterity) {
      return { can: false, reason: `Requires ${requirements.minDexterity} Dexterity.` };
    }
    if (requirements.minConstitution && character.finalAbilityScores.Constitution < requirements.minConstitution) {
      return { can: false, reason: `Requires ${requirements.minConstitution} Constitution.` };
    }
    if (requirements.minIntelligence && character.finalAbilityScores.Intelligence < requirements.minIntelligence) {
      return { can: false, reason: `Requires ${requirements.minIntelligence} Intelligence.` };
    }
    if (requirements.minWisdom && character.finalAbilityScores.Wisdom < requirements.minWisdom) {
      return { can: false, reason: `Requires ${requirements.minWisdom} Wisdom.` };
    }
    if (requirements.minCharisma && character.finalAbilityScores.Charisma < requirements.minCharisma) {
      return { can: false, reason: `Requires ${requirements.minCharisma} Charisma.` };
    }
  }

  if (item.type === 'armor') {
    if (item.strengthRequirement && character.finalAbilityScores.Strength < item.strengthRequirement) {
      return { can: false, reason: `Requires ${item.strengthRequirement} Strength.` };
    }

    if (item.armorCategory) {
      const charMaxProf = getCharacterMaxArmorProficiency(character);
      if (item.armorCategory === 'Shield') {
        if (!character.class.armorProficiencies.map(p => p.toLowerCase()).includes('shields')) {
          return { can: false, reason: 'Not proficient with shields.' };
        }
      } else {
        const itemProfValue = getArmorCategoryHierarchy(item.armorCategory);
        const charProfValue = getArmorCategoryHierarchy(charMaxProf.charAt(0).toUpperCase() + charMaxProf.slice(1) as ArmorCategory);
        if (itemProfValue > charProfValue) {
          return { can: false, reason: `Not proficient with ${item.armorCategory} armor.` };
        }
      }
    }
  }

  if (item.type === 'weapon') {
    // Check proficiency using the centralized helper
    const isProficient = isWeaponProficient(character, item);

    if (!isProficient) {
      // Fix Q9: Use isWeaponMartial helper to determine type
      const weaponType = isWeaponMartial(item) ? 'Martial weapons' : 'Simple weapons';
      return {
        can: true, // Permissive: can still equip
        reason: `Not proficient with ${weaponType}. Cannot add proficiency bonus to attack rolls or use weapon mastery.`
      };
    }
  }

  return { can: true };
};

/**
 * Calculates the AC change if an item were equipped in place of the current gear.
 * Used to display upgrade indicators in the inventory UI.
 * @param character - The character to evaluate
 * @param item - The item to check
 * @returns The AC change (positive = upgrade, negative = downgrade, 0 = no change)
 */
export const calculatePotentialAcChange = (character: PlayerCharacter, item: Item): number => {
  // Only armor items affect AC
  if (item.type !== 'armor') return 0;

  // Clone character's equipped items for hypothetical calculation
  const hypotheticalEquippedItems = { ...character.equippedItems };

  // Determine which slot the item goes in and equip it
  if (item.armorCategory === 'Shield') {
    hypotheticalEquippedItems.OffHand = item;
  } else if (item.slot === 'Torso') {
    hypotheticalEquippedItems.Torso = item;
  } else if (item.slot) {
    // For other armor slots (Head, Hands, Legs, Feet, Wrists), they don't typically affect AC calculation
    // but we'll include them for completeness
    hypotheticalEquippedItems[item.slot] = item;
  }

  // Create a hypothetical character with the new equipment
  const hypotheticalCharacter: PlayerCharacter = {
    ...character,
    equippedItems: hypotheticalEquippedItems,
  };

  // Calculate new AC using the same function used elsewhere
  const newAc = calculateArmorClass(hypotheticalCharacter, character.activeEffects || []);

  return newAc - character.armorClass;
};

export { calculateFixedRacialBonuses };

/**
 * Creates a full PlayerCharacter object from a simplified TempPartyMember object.
 * @param {TempPartyMember} tempMember - The temporary member data.
 * @returns {PlayerCharacter} A complete PlayerCharacter object.
 */
export const createPlayerCharacterFromTemp = (tempMember: TempPartyMember): PlayerCharacter => {
  const classData = CLASSES_DATA[tempMember.classId] || CLASSES_DATA['fighter'];
  const raceData = RACES_DATA['human']; // Default to Human for simplicity
  const baseAbilityScores: AbilityScores = { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 };
  const finalAbilityScores = calculateFixedRacialBonuses(baseAbilityScores, raceData);
  const maxHp = classData.hitDie + getAbilityModifierValue(finalAbilityScores.Constitution);
  // Initialize class levels so Hit Dice pools can be derived for temp members.
  const classLevels = { [classData.id]: Math.max(1, tempMember.level) };

  const newChar: PlayerCharacter = {
    id: tempMember.id,
    name: `${classData.name} ${tempMember.level}`,
    level: tempMember.level,
    xp: 0,
    race: raceData,
    class: classData,
    classLevels,
    abilityScores: baseAbilityScores,
    finalAbilityScores,
    skills: [],
    statusEffects: [],
    hp: maxHp,
    maxHp: maxHp,
    hitPointDice: undefined,
    armorClass: 10 + getAbilityModifierValue(finalAbilityScores.Dexterity),
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    equippedItems: {},
    proficiencyBonus: Math.floor((tempMember.level - 1) / 4) + 2,
  };
  newChar.hitPointDice = buildHitPointDicePools(newChar, { classLevels });
  newChar.armorClass = calculateArmorClass(newChar, newChar.activeEffects);
  return newChar;
};

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
 * Calculates any repeatable HP-per-level bonus from the provided feat list.
 * Tough and Durable style feats use this path to keep HP math consolidated.
 */
const getHpBonusPerLevelFromFeats = (featIds: string[]): number => featIds.reduce((bonus, featId) => {
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
      selectedSkills: choices?.selectedSkills as string[] | undefined,
    });
  }, { ...character });
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
        selectedCantrips: featChoice?.selectedCantrips as string[] | undefined,
        selectedLeveledSpells: featChoice?.selectedLeveledSpells as string[] | undefined,
        selectedSpellSource: featChoice?.selectedSpellSource as MagicInitiateSource | undefined,
        selectedSkills: featChoice?.selectedSkills as string[] | undefined,
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
  // Use the chosen class hit die for multiclass level-ups.
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
  // Existing feats (present in character.feats) have already contributed to maxHp in previous levels.
  const previousHpBonusPerLevel = getHpBonusPerLevelFromFeats(character.feats || []);
  const retroactiveFeatAdjustment = (hpBonusPerLevel - previousHpBonusPerLevel) * previousLevel;

  updatedCharacter.maxHp = (character.maxHp || 0) + hpGainThisLevel + retroactiveConAdjustment + retroactiveFeatAdjustment;
  updatedCharacter.hp = Math.min(updatedCharacter.maxHp, (character.hp || 0) + hpGainThisLevel + retroactiveConAdjustment + retroactiveFeatAdjustment);

  // Update class level tracking and refresh Hit Dice pools for the new level.
  const updatedClassLevels = normalizeClassLevels(character);
  if (leveledClassId) {
    // Apply the level to the chosen class so Hit Dice pools grow correctly.
    updatedClassLevels[leveledClassId] = (updatedClassLevels[leveledClassId] || 0) + 1;
  }
  updatedCharacter.classLevels = updatedClassLevels;
  updatedCharacter.hitPointDice = buildHitPointDicePools(updatedCharacter, {
    classLevels: updatedClassLevels,
    previousPools: character.hitPointDice,
  });

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
    const nextLevel = (updatedCharacter.level || 1) + 1;
    const asiBudget = getAbilityScoreImprovementBudget(nextLevel);
    const hasAsiOrFeatChoice = !!choices && (!!choices.featId || !!choices.abilityScoreIncreases);

    // Pause automatic leveling when a choice is required but none was provided.
    if (asiBudget > 0 && !hasAsiOrFeatChoice) {
      // Stop auto-leveling when a choice is required so UI can prompt for ASI/feat selection.
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
