/**
 * This file handles character statistics, racial traits, senses, and derived attributes.
 *
 * It calculates ability score modifiers (+2, -1, etc.), applies racial attribute
 * bonuses and innate racial spells (like Tiefling thaumaturgy or Elf cantrips),
 * computes movement speeds (including swimming, flying, climbing, and burrowing),
 * resolves darkvision ranges, builds Hit Dice pools, and keeps derived stats in sync
 * when equipment or levels change.
 *
 * Called by: Character sheets, party management, level-up routines, and characterUtils facade.
 * Depends on: statUtils (for core math and AC), racial trait libraries, and class data.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 03/11/2026, 17:10:53
 * Dependents: systems/gameplay/spellPreparation.ts, utils/character/characterUtils.ts, utils/character/index.ts, utils/character/progression.ts, utils/sandbox/quickCharacterGenerator.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  PlayerCharacter,
  Item,
  AbilityScores,
  DraconicAncestryInfo,
  AbilityScoreName,
  HitDieSize,
  HitPointDicePool,
  RacialSpellGrant,
  TempPartyMember,
  Race,
} from '../../types';
import { resolveTerrainMovementPolicyFromTraits } from '../combat/movementUtils';
import {
  RacialFeatureTrait,
  RacialResourceMechanic,
  RacialModifierBuckets,
} from '../../data/races/racialTraits';
import {
  ALL_RACES_DATA as RACES_DATA,
  buildRacialTraitLibrary,
  getRacialTraitLibrary,
} from '../../data/races';
import { DRAGONBORN_ANCESTRIES_DATA as DRAGONBORN_ANCESTRIES } from '../../data/races/dragonborn';
import { GIANT_ANCESTRY_BENEFITS_DATA as GIANT_ANCESTRIES } from '../../data/races/goliath';
import { FIENDISH_LEGACIES_DATA as TIEFLING_LEGACIES } from '../../data/races/tiefling';
import { CLASSES_DATA } from '../../data/classes';
import { SKILLS_DATA } from '../../data/skills';
import { FEATS_DATA } from '../../data/feats/featsData';
import {
  getAbilityModifierValue,
  getAbilityModifierString,
  calculateFixedRacialBonuses,
  calculateFinalAbilityScores,
  calculatePassiveScore,
  calculateArmorClass,
} from './statUtils';

// ============================================================================
// Core Ability Score Re-exports
// ============================================================================
// Re-export standard D&D ability score calculations from statUtils so callers
// can import all stat helpers from this unified module.
// ============================================================================

export {
  getAbilityModifierValue,
  getAbilityModifierString,
  calculateFixedRacialBonuses,
  calculateFinalAbilityScores,
  calculatePassiveScore,
};

// ============================================================================
// Character Race Display
// ============================================================================
// Formats race and subrace/ancestry choices into a clean human-readable name.
// ============================================================================

/**
 * Generates a descriptive race display string for a character.
 * e.g., "Drow Elf", "Black Dragonborn", "Stone Goliath", "Human".
 *
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
  };

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

// ============================================================================
// Hit Point Dice & Class Level Mechanics
// ============================================================================
// Manages hit dice pools (d6, d8, d10, d12) across single-class and multiclass
// characters, ensuring rest healing pools scale accurately with level.
// ============================================================================

export const HIT_DIE_SIZES: HitDieSize[] = [6, 8, 10, 12];

export const isHitDieSize = (value: number | undefined): value is HitDieSize =>
  typeof value === 'number' && HIT_DIE_SIZES.includes(value as HitDieSize);

export const resolveClassHitDie = (character: PlayerCharacter, classId: string): HitDieSize => {
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

export const sanitizeHitPointDicePools = (pools: HitPointDicePool[]): HitPointDicePool[] => {
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

export const coerceHitPointDicePools = (
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

export const buildHitPointDiceMaxByDie = (
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

export const mergeHitPointDicePools = (
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

// ============================================================================
// Feat Stat & Movement Bonus Helpers
// ============================================================================
// Evaluates passive stat additions granted by feats (e.g. Tough HP boosts,
// Mobile movement speed boosts).
// ============================================================================

export const getHpBonusPerLevelFromFeats = (featIds: string[]): number => featIds.reduce((bonus, featId) => {
  const feat = FEATS_DATA.find(f => f.id === featId);
  const perLevel = feat?.benefits?.hpMaxIncreasePerLevel ?? 0;
  return bonus + perLevel;
}, 0);

export const getSpeedBonusFromFeats = (featIds: string[]): number => featIds.reduce((bonus, featId) => {
  const feat = FEATS_DATA.find(f => f.id === featId);
  const speedIncrease = feat?.benefits?.speedIncrease ?? 0;
  return bonus + speedIncrease;
}, 0);

// ============================================================================
// Racial Spell Grants & Resource Tracking
// ============================================================================
// Handles spells and daily limited-use powers granted naturally by race and
// subrace choices (e.g., Drow Innate Magic, Tiefling Legacies, Breath Weapons).
// ============================================================================

const DEFAULT_RACIAL_SPELL_CASTING_METHOD = 'at_will' as const;
const DEFAULT_RACIAL_SPELL_COUNTS_AS_PREPARED = false;

export const normalizeRacialSpellGrantSource = (
  character: PlayerCharacter,
  entry: RacialSpellGrant,
): RacialSpellGrant => ({
  sourceRaceId: entry.sourceRaceId || character.race.id,
  sourceRaceName: entry.sourceRaceName || character.race.name,
  minLevel: entry.minLevel,
  spellId: entry.spellId,
  castingMethod: entry.castingMethod || DEFAULT_RACIAL_SPELL_CASTING_METHOD,
  spellAbility: entry.spellAbility,
  maxCastLevel: entry.maxCastLevel,
  upcastable: entry.upcastable === undefined ? true : entry.upcastable,
  countsAsPrepared: entry.countsAsPrepared ?? DEFAULT_RACIAL_SPELL_COUNTS_AS_PREPARED,
  traitName: entry.traitName || (entry as any).traitName,
});

export const getRacialAbilityFromSelection = (
  character: PlayerCharacter,
  sourceRaceId: string,
  spellAbility?: RacialSpellGrant['spellAbility'],
): AbilityScoreName | undefined => {
  if (!spellAbility) return undefined;
  if (spellAbility === 'subrace_choice') {
    return character.racialSelections?.[sourceRaceId]?.spellAbility;
  }
  return spellAbility;
};

export const getRacialSpellAbilityFromSelection = (
  sourceRaceId: string,
  racialSelections: PlayerCharacter['racialSelections'] = {},
): AbilityScoreName | undefined => racialSelections?.[sourceRaceId]?.spellAbility;

export const getRacialSpellGrantsForCharacter = (
  character: PlayerCharacter,
  targetLevel = character.level || 1,
): RacialSpellGrant[] => {
  if (!character || !character.race) return [];
  const { race } = character;

  // 1. Gather all race/subrace IDs to query
  const queryIds = [race.id];
  const choiceId = character.racialSelections?.[race.id]?.choiceId;
  if (choiceId) {
    queryIds.push(choiceId);
    queryIds.push(`${choiceId}_${race.id}`);
  }

  // 2. Gather library grants for all matching IDs
  const libraryGrants: RacialSpellGrant[] = [];
  queryIds.forEach(id => {
    const grants = getRacialTraitLibrary().byRaceId[id];
    if (grants) {
      grants.forEach(grant => {
        if (grant.type === 'spell') {
          libraryGrants.push(grant);
        }
      });
    }
  });

  const legacyRaceGrants = (race as any).knownSpells ?? [];
  const spellbookGrants = character.spellbook?.racialSpellGrants || [];

  const activeGrants = [...libraryGrants, ...legacyRaceGrants]
    .filter(entry => targetLevel >= entry.minLevel)
    .map(entry => normalizeRacialSpellGrantSource(character, entry));

  // 3. Synthesize grants from selections
  const selections = character.racialSelections?.[race.id];
  if (selections?.selectedSpellIds) {
    const libraryChoices = getRacialTraitLibrary().byChoiceRaceId[race.id] || [];
    selections.selectedSpellIds.forEach(spellId => {
      const choice = libraryChoices.find(c => 
        (c.type === 'spellChoice' || c.type === 'spellAbility') && 
        c.availableSpellIds?.includes(spellId)
      );
      if (choice) {
        const synthesized = normalizeRacialSpellGrantSource(character, {
          sourceRaceId: race.id,
          traitName: choice.sourceTraitName,
          minLevel: 1,
          spellId: spellId,
          castingMethod: 'at_will',
          spellAbility: 'subrace_choice',
          countsAsPrepared: false,
        });
        activeGrants.push(synthesized);
      }
    });
  }

  if (activeGrants.length === 0 && spellbookGrants.length === 0) {
    return [];
  }

  const byId = new Map<string, RacialSpellGrant>();

  [...spellbookGrants, ...activeGrants].forEach(grant => {
    byId.set(grant.spellId, grant);
  });

  return Array.from(byId.values()).filter(grant => targetLevel >= grant.minLevel);
};

export const getRacialSpellGrantForSpell = (
  character: PlayerCharacter,
  spellId: string,
  targetLevel = character.level || 1,
): RacialSpellGrant | undefined => {
  return getRacialSpellGrantsForCharacter(character, targetLevel)
    .find(grant => grant.spellId === spellId);
};

export const isRacialSpellCastLevelAllowed = (
  character: PlayerCharacter,
  spellId: string,
  castLevel: number,
): boolean => {
  const grant = getRacialSpellGrantForSpell(character, spellId);
  if (!grant) return true;
  if (grant.upcastable === false) {
    const maxCastLevel = grant.maxCastLevel ?? grant.minLevel;
    return castLevel <= maxCastLevel;
  }
  return true;
};

export const getPreparedSpellsAffectingLimit = (character: PlayerCharacter): Set<string> => {
  const preparedSpellIds = new Set(character.spellbook?.preparedSpells || []);
  const grants = getRacialSpellGrantsForCharacter(character);

  grants.forEach(grant => {
    if (grant.countsAsPrepared === false) {
      preparedSpellIds.delete(grant.spellId);
    }
  });

  return preparedSpellIds;
};

export const isRacialSpellLockedForPreparation = (
  character: PlayerCharacter,
  spellId: string,
): boolean => {
  const grant = getRacialSpellGrantForSpell(character, spellId);
  return !!grant && grant.countsAsPrepared === false;
};

export const resolveRacialSpellCastingAbility = (
  character: PlayerCharacter,
  spellId: string,
): AbilityScoreName | undefined => {
  const grant = getRacialSpellGrantForSpell(character, spellId);
  if (!grant) return undefined;
  return getRacialAbilityFromSelection(character, grant.sourceRaceId, grant.spellAbility);
};

/**
 * Unified generator for racial resource / limited-use IDs (RM-045).
 *
 * All racial resource-key generation routes through this single helper so the
 * naming conventions stay consistent and lookups can't silently diverge:
 *  - 'feature': trait-granted resources, keyed `racial_feature_<resourceId>`.
 *  - 'spell':   racial spell limited uses, keyed `racial_<raceId>_<spellId>`.
 */
export function resolveRacialResourceId(kind: 'feature', resourceId: string): string;
export function resolveRacialResourceId(kind: 'spell', sourceRaceId: string, spellId: string): string;
export function resolveRacialResourceId(kind: 'feature' | 'spell', a: string, b?: string): string {
  return kind === 'spell' ? `racial_${a}_${b}` : `racial_feature_${a}`;
}

export const resolveRacialSpellLimitedUseId = (sourceRaceId: string, spellId: string): string =>
  resolveRacialResourceId('spell', sourceRaceId, spellId);

// Build the list of racial trait library keys that apply to this character:
// the base race ID plus any subrace/lineage choice ID (such as a Dragonborn
// ancestry or Tiefling fiendish legacy) stored in `racialSelections`.
export const getRacialSelectionIdsForCharacter = (character: PlayerCharacter): string[] => {
  const { race, racialSelections } = character;
  const baseIds = [race.id];
  const choiceId = racialSelections?.[race.id]?.choiceId;
  if (!choiceId) return baseIds;
  return [...baseIds, choiceId, `${choiceId}_${race.id}`];
};

// Return all non-spell racial traits that are active at `targetLevel`.
// Canonical races resolve from the cached `getRacialTraitLibrary().byRaceId`
// map by ID. When a character carries an inline custom/NPC/fixture Race whose
// ID is not registered in the canonical library, we parse its inline `traits`
// array on demand through `buildRacialTraitLibrary` so level-gated and
// trait-prose features (including alternate movement speeds in
// `getRacialMovementSpeedsForLevel`) still resolve with full level-window
// semantics instead of being silently dropped (WF-G277).
export const getActiveRacialFeatureTraitsForCharacter = (
  character: PlayerCharacter,
  targetLevel: number,
): RacialFeatureTrait[] => {
  const seen = new Set<string>();
  const library = getRacialTraitLibrary();
  const selectionIds = getRacialSelectionIdsForCharacter(character);
  let traits = selectionIds.flatMap(
    id => library.byRaceId[id] ?? []
  );

  // Fallback for unlisted inline race objects whose ID is absent from the
  // canonical racial trait library (WF-G277).
  if (
    traits.length === 0 &&
    character.race?.id &&
    !library.byRaceId[character.race.id] &&
    Array.isArray(character.race.traits) &&
    character.race.traits.length > 0
  ) {
    const inlineLibrary = buildRacialTraitLibrary({ [character.race.id]: character.race });
    traits = selectionIds.flatMap(
      id => inlineLibrary.byRaceId[id] ?? []
    );
  }

  // Filter out spell grants and keep only traits whose level window covers
  // the character's target level.
  const active = traits.filter((trait): trait is RacialFeatureTrait =>
    trait.type !== 'spell' &&
    targetLevel >= trait.minLevel &&
    (trait.maxLevel === undefined || targetLevel <= trait.maxLevel)
  );

  // Deduplicate identical trait entries across base race and sub-choice buckets.
  const deduped: RacialFeatureTrait[] = [];
  active.forEach((trait) => {
    const traitKey = `${trait.sourceRaceId}::${trait.traitName}::${trait.minLevel}::${trait.maxLevel ?? ''}::${trait.traitDescription}`;
    if (seen.has(traitKey)) return;
    seen.add(traitKey);
    deduped.push(trait);
  });

  return deduped;
};

export const getCanonicalRacialDamageType = (rawType: string): string | undefined => {
  const normalized = rawType.trim().toLowerCase();
  if (!normalized) return undefined;

  const normalizedDamageTypeLookup: Record<string, string> = {
    acid: 'Acid',
    bludgeoning: 'Bludgeoning',
    cold: 'Cold',
    fire: 'Fire',
    force: 'Force',
    lightning: 'Lightning',
    necrotic: 'Necrotic',
    piercing: 'Piercing',
    poison: 'Poison',
    psychic: 'Psychic',
    radiant: 'Radiant',
    slashing: 'Slashing',
    thunder: 'Thunder',
    physical: 'Physical',
  };

  return normalizedDamageTypeLookup[normalized] ?? normalized
    .split(' ')
    .filter(Boolean)
    .map(token => token[0].toUpperCase() + token.slice(1))
    .join(' ');
};

export const appendDamageTypes = (current: string[], next: string[]): void => {
  const nextSet = new Set(current.map(type => type.toLowerCase()));
  next.forEach((value) => {
    const canonical = getCanonicalRacialDamageType(value);
    if (!canonical) return;
    const normalized = canonical.toLowerCase();
    if (nextSet.has(normalized)) return;
    nextSet.add(normalized);
    current.push(canonical);
  });
};

export const applyRacialSpellGrantsByLevel = (character: PlayerCharacter, targetLevel: number): PlayerCharacter => {
  const { race } = character;
  const racialGrants = getRacialSpellGrantsForCharacter(character, targetLevel);
  const racialFeatureTraits = getActiveRacialFeatureTraitsForCharacter(character, targetLevel);
  const racialResourceTraits = racialFeatureTraits.filter((trait): trait is RacialFeatureTrait & { resources: RacialResourceMechanic[] } =>
    !!trait.resources && trait.resources.length > 0
  );
  const racialDefenseTraits = racialFeatureTraits.filter((trait): trait is RacialFeatureTrait & { defensiveTraits: { resistances: string[]; immunities: string[]; vulnerabilities: string[] } } =>
    !!trait.defensiveTraits &&
    (
      trait.defensiveTraits.resistances.length > 0 ||
      trait.defensiveTraits.immunities.length > 0 ||
      trait.defensiveTraits.vulnerabilities.length > 0
    )
  );

  const racialModifierTraits = racialFeatureTraits.filter((trait): trait is RacialFeatureTrait & { modifierBuckets: RacialModifierBuckets } =>
    !!trait.modifierBuckets
  );

  if (racialGrants.length === 0 && racialResourceTraits.length === 0 && racialDefenseTraits.length === 0 && racialModifierTraits.length === 0) {
    return character;
  }

  const next: PlayerCharacter = {
    ...character,
    limitedUses: character.limitedUses ? { ...character.limitedUses } : {},
    resistances: [...(character.resistances || [])],
    immunities: [...(character.immunities || [])],
    vulnerabilities: [...(character.vulnerabilities || [])],
    modifiers: character.modifiers ? {
      advantage: [...character.modifiers.advantage],
      disadvantage: [...character.modifiers.disadvantage],
      bonuses: [...character.modifiers.bonuses],
      baseArmorClass: character.modifiers.baseArmorClass,
      acBonus: character.modifiers.acBonus,
      reachBonus: character.modifiers.reachBonus,
      powerfulBuild: character.modifiers.powerfulBuild,
      unendingBreath: character.modifiers.unendingBreath,
      languages: character.modifiers.languages ? [...character.modifiers.languages] : undefined,
      skillProficiencies: character.modifiers.skillProficiencies ? [...character.modifiers.skillProficiencies] : [],
      weaponProficiencies: character.modifiers.weaponProficiencies ? [...character.modifiers.weaponProficiencies] : [],
      armorProficiencies: character.modifiers.armorProficiencies ? [...character.modifiers.armorProficiencies] : [],
      initiativeBonus: character.modifiers.initiativeBonus,
      initiativeProficiency: character.modifiers.initiativeProficiency,
      ignoreDifficultTerrain: character.modifiers.ignoreDifficultTerrain,
      terrainPolicyId: character.modifiers.terrainPolicyId,
      terrainPolicy: character.modifiers.terrainPolicy,
      reactions: character.modifiers.reactions ? [...character.modifiers.reactions] : [],
      savageAttacks: character.modifiers.savageAttacks,
    } : { advantage: [], disadvantage: [], bonuses: [], reactions: [], skillProficiencies: [], weaponProficiencies: [], armorProficiencies: [] },
    skills: [...character.skills],
    weaponProficiencies: [...(character.weaponProficiencies || [])],
    armorProficiencies: [...(character.armorProficiencies || [])],
    ignoreDifficultTerrain: character.ignoreDifficultTerrain,
    terrainPolicyId: character.terrainPolicyId,
    terrainPolicy: character.terrainPolicy,
    initiativeBonus: character.initiativeBonus,
    initiativeProficiency: character.initiativeProficiency,
    spellbook: character.spellbook ? {
      cantrips: [...(character.spellbook?.cantrips || [])],
      knownSpells: [...(character.spellbook?.knownSpells || [])],
      preparedSpells: [...(character.spellbook?.preparedSpells || [])],
      racialSpellGrants: [...(character.spellbook?.racialSpellGrants || [])],
    } : undefined,
  };

  if (!next.spellbook && racialGrants.length > 0) {
    next.spellbook = {
      cantrips: [],
      knownSpells: [],
      preparedSpells: [],
      racialSpellGrants: [],
    };
  }

  if (next.spellbook) {
    const knownSpellsSet = new Set(next.spellbook.knownSpells);
    const preparedSpellsSet = new Set(next.spellbook.preparedSpells);
    const grantsBySpell = new Map<string, RacialSpellGrant>();
    const racialSpellGrants = next.spellbook.racialSpellGrants ?? [];

    racialSpellGrants.forEach((grant) => {
      grantsBySpell.set(grant.spellId, grant);
    });

    racialGrants.forEach((grant) => {
      knownSpellsSet.add(grant.spellId);
      grantsBySpell.set(grant.spellId, grant);
      if (!grant.countsAsPrepared) {
        preparedSpellsSet.add(grant.spellId);
      }

      if (grant.castingMethod === 'once_per_long_rest' || grant.castingMethod === 'once_per_short_rest') {
        const limitedUseKey = resolveRacialSpellLimitedUseId(grant.sourceRaceId, grant.spellId);
        if (!next.limitedUses![limitedUseKey]) {
          next.limitedUses![limitedUseKey] = {
            name: `${grant.sourceRaceName || race.name}: ${grant.spellId.replace(/-/g, ' ')}`,
            current: 1,
            max: 1,
            resetOn: grant.castingMethod === 'once_per_short_rest' ? 'short_rest' : 'long_rest',
          };
        }
      }
    });

    next.spellbook.knownSpells = Array.from(knownSpellsSet);
    next.spellbook.preparedSpells = Array.from(preparedSpellsSet);
    next.spellbook.racialSpellGrants = Array.from(grantsBySpell.values());
  }

  racialDefenseTraits.forEach((trait) => {
    if (!trait.defensiveTraits) return;
    appendDamageTypes(next.resistances || [], trait.defensiveTraits.resistances);
    appendDamageTypes(next.immunities || [], trait.defensiveTraits.immunities);
    appendDamageTypes(next.vulnerabilities || [], trait.defensiveTraits.vulnerabilities);
  });

  racialModifierTraits.forEach((trait) => {
    if (!trait.modifierBuckets) return;
    next.modifiers!.advantage.push(...trait.modifierBuckets.advantage);
    next.modifiers!.disadvantage.push(...trait.modifierBuckets.disadvantage);
    next.modifiers!.bonuses.push(...trait.modifierBuckets.bonuses);

    if (trait.modifierBuckets.baseArmorClass !== undefined) {
      next.modifiers!.baseArmorClass = Math.max(next.modifiers!.baseArmorClass || 0, trait.modifierBuckets.baseArmorClass);
    }
    if (trait.modifierBuckets.acBonus !== undefined) {
      next.modifiers!.acBonus = (next.modifiers!.acBonus || 0) + trait.modifierBuckets.acBonus;
    }
    if (trait.modifierBuckets.reachBonus !== undefined) {
      next.modifiers!.reachBonus = (next.modifiers!.reachBonus || 0) + trait.modifierBuckets.reachBonus;
    }
    if (trait.modifierBuckets.powerfulBuild) {
      next.modifiers!.powerfulBuild = true;
    }
    if (trait.modifierBuckets.unendingBreath) {
      next.modifiers!.unendingBreath = true;
    }
    if (trait.modifierBuckets.languages) {
      next.modifiers!.languages = Array.from(new Set([...(next.modifiers!.languages || []), ...trait.modifierBuckets.languages]));
    }
    if (trait.modifierBuckets.breathWeapon) {
      next.modifiers!.breathWeapon = { ...trait.modifierBuckets.breathWeapon };
    }
    if (trait.modifierBuckets.skillProficiencies) {
      trait.modifierBuckets.skillProficiencies.forEach((skillName: string) => {
        const skillId = skillName.toLowerCase().replace(/\s+/g, '_');
        const skill = SKILLS_DATA[skillId];
        if (skill && !next.skills.some(s => s.id === skill.id)) {
          next.skills.push(skill);
        }
        if (!next.modifiers!.skillProficiencies!.includes(skillName)) {
          next.modifiers!.skillProficiencies!.push(skillName);
        }
      });
    }
    if (trait.modifierBuckets.weaponProficiencies) {
      trait.modifierBuckets.weaponProficiencies.forEach((weapon: string) => {
        if (!next.weaponProficiencies!.includes(weapon)) {
          next.weaponProficiencies!.push(weapon);
        }
        if (!next.modifiers!.weaponProficiencies!.includes(weapon)) {
          next.modifiers!.weaponProficiencies!.push(weapon);
        }
      });
    }
    if (trait.modifierBuckets.armorProficiencies) {
      trait.modifierBuckets.armorProficiencies.forEach((armor: string) => {
        if (!next.armorProficiencies!.includes(armor)) {
          next.armorProficiencies!.push(armor);
        }
        if (!next.modifiers!.armorProficiencies!.includes(armor)) {
          next.modifiers!.armorProficiencies!.push(armor);
        }
      });
    }
    if (trait.modifierBuckets.initiativeBonus !== undefined) {
      next.initiativeBonus = (next.initiativeBonus || 0) + trait.modifierBuckets.initiativeBonus;
      next.modifiers!.initiativeBonus = (next.modifiers!.initiativeBonus || 0) + trait.modifierBuckets.initiativeBonus;
    }
    if (trait.modifierBuckets.initiativeProficiency) {
      next.initiativeProficiency = true;
      next.modifiers!.initiativeProficiency = true;
    }
    if (trait.modifierBuckets.ignoreDifficultTerrain) {
      next.ignoreDifficultTerrain = true;
      next.modifiers!.ignoreDifficultTerrain = true;
    }
    const terrainPolicy = resolveTerrainMovementPolicyFromTraits(race.traits);
    if (terrainPolicy) {
      next.terrainPolicy = terrainPolicy;
      next.terrainPolicyId = terrainPolicy.id;
      next.modifiers!.terrainPolicy = terrainPolicy;
      next.modifiers!.terrainPolicyId = terrainPolicy.id;
    }
    if (trait.modifierBuckets.reactions) {
      next.modifiers!.reactions = [
        ...(next.modifiers!.reactions || []),
        ...trait.modifierBuckets.reactions,
      ];
    }
    if (trait.modifierBuckets.savageAttacks) {
      next.modifiers!.savageAttacks = true;
    }
  });

  racialResourceTraits.forEach((trait) => {
    const sourceLabel = `${trait.sourceRaceName}: ${trait.traitName}`;
    trait.resources?.forEach((resource) => {
      const resourceKey = resolveRacialResourceId('feature', resource.id);
      const nextMax: number = typeof resource.maxUses === 'number'
        ? resource.maxUses
        : next.proficiencyBonus || 2;
      const existing = next.limitedUses![resourceKey];
      const nextCurrent = existing ? Math.min(existing.current, nextMax) : nextMax;

      next.limitedUses![resourceKey] = {
        ...existing,
        name: resource.sourceLabel ? `${sourceLabel} (${resource.sourceLabel})` : sourceLabel,
        current: nextCurrent,
        max: resource.maxUses,
        resetOn: resource.resetOn,
      };
    });
  });

  next.resistances = next.resistances && next.resistances.length > 0 ? next.resistances : undefined;
  next.immunities = next.immunities && next.immunities.length > 0 ? next.immunities : undefined;
  next.vulnerabilities = next.vulnerabilities && next.vulnerabilities.length > 0 ? next.vulnerabilities : undefined;

  if (next.limitedUses && Object.keys(next.limitedUses).length === 0) {
    next.limitedUses = undefined;
  }

  return next;
};

// ============================================================================
// Speed & Movement Modes
// ============================================================================
// Parses race traits for walking, swimming, flying, climbing, and burrowing speeds,
// and factors in armor encumbrance penalties.
// ============================================================================

export function calculateCharacterSpeedFromRace(
  race: PlayerCharacter['race'],
  racialSelections: PlayerCharacter['racialSelections'] = {},
): number {
  let speed = 30;

  const speedTrait = race.traits.find(t => t.toLowerCase().startsWith('speed:'));
  if (speedTrait) {
    const match = speedTrait.match(/(\d+)/);
    if (match) speed = parseInt(match[1], 10);
  }

  const selectedLineageId = racialSelections?.elf?.choiceId;
  if (selectedLineageId && race.elvenLineages) {
    const lineage = race.elvenLineages.find(l => l.id === selectedLineageId);
    if (lineage) {
      const lineageSpeedIncrease = lineage.benefits.reduce(
        (sum, benefit) => sum + (benefit.speedIncrease ?? 0),
        0,
      );
      speed += lineageSpeedIncrease;
    }
  }

  return speed;
}

/** Equipment calculation and the sheet share this rule. Some carried legacy
 * racial traits explicitly exempt heavy armor from reducing speed; a species
 * name alone grants nothing. This does not remove stealth or other armor costs. */
export function hasHeavyArmorSpeedPenalty(character: PlayerCharacter): boolean {
  const torso = character.equippedItems?.Torso;
  if (!torso || torso.type !== 'armor' || torso.armorCategory !== 'Heavy' || !torso.strengthRequirement) return false;
  const armorExempt = character.race?.ignoresHeavyArmorSpeedPenalty === true;
  // Structured race flag replaces free-text trait parsing (GG-168).
  return !armorExempt && (character.finalAbilityScores?.Strength ?? 10) < torso.strengthRequirement;
}

export function calculateCharacterSpeed(character: PlayerCharacter): number {
  const baseSpeed = calculateCharacterSpeedFromRace(character.race, character.racialSelections);
  const featBonus = getSpeedBonusFromFeats(character.feats || []);
  const finalSpeed = baseSpeed + featBonus;
  return hasHeavyArmorSpeedPenalty(character) ? Math.max(0, finalSpeed - 10) : finalSpeed;
}

export type MovementMode = 'swim' | 'climb' | 'fly' | 'burrow';

const MODE_WORD = '(swim|swimming|climb|climbing|fly|flying|burrow|burrowing)';

// GG-259: this prose reader used to be the public `deriveAlternateMovementSpeeds`.
// It reads every trait line it is given and has no level, so a level-1
// Dragonborn read as flying. It is private now; every caller goes through the
// level-gated readers below. It stays the one place that decides how a speed
// sentence is read (numeric, comma form, and "equal to your walking speed").
function readMovementSpeedProse(
  character: PlayerCharacter,
  traits: string[],
): Partial<Record<MovementMode, number>> {
  const walking = calculateCharacterSpeed(character);
  const text = traits.join(' ');

  const out: Partial<Record<MovementMode, number>> = {};

  const numericPattern = new RegExp(
    `${MODE_WORD}\\s*(?:speed)?\\b\\s*(?::|of|=)?\\s*(\\d+)\\s*(?:ft|foot|feet)`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = numericPattern.exec(text)) !== null) {
    const mode = normalizeMode(m[1]);
    if (mode) out[mode] = parseInt(m[2], 10);
  }

  const commaPattern = new RegExp(
    `speed\\s*:\\s*\\d+\\s*(?:ft|foot|feet)\\s*,\\s*${MODE_WORD}\\s+(\\d+)\\s*(?:ft|foot|feet)`,
    'gi'
  );
  let cm: RegExpExecArray | null;
  while ((cm = commaPattern.exec(text)) !== null) {
    const mode = normalizeMode(cm[1]);
    if (mode) out[mode] = parseInt(cm[2], 10);
  }

  const relativePattern = new RegExp(
    `${MODE_WORD}\\s+speed\\b[^.]*?equal to your walking speed`,
    'gi'
  );
  let rm: RegExpExecArray | null;
  while ((rm = relativePattern.exec(text)) !== null) {
    const mode = normalizeMode(rm[1]);
    if (mode && out[mode] === undefined) out[mode] = walking;
  }

  return out;
}


// ============================================================================
// Level-Gated Racial Movement Modes
// ============================================================================
// A race can grant a movement mode that only starts at a later character
// level. Dragonborn Draconic Flight, which begins at level 5, is the case
// this was written for. (Moved here from progression.ts for GG-259; it is
// re-exported there, so existing imports keep working.)
//
// This pairs the speed prose reader above with the level window the racial
// trait library already records (`minLevel` / `maxLevel` on each trait), so a
// mode is reported only once its trait is live. No new text parser is added.
//
// Resolution contract (WF-G277):
// - Core "Speed:" line modes (e.g., "Speed: 30 feet, Swim 30 feet") are read
//   directly from `character.race.traits` and are always active from level 1.
// - Feature-granted modes resolve through `getActiveRacialFeatureTraitsForCharacter`:
//   canonical race IDs (present in `getRacialTraitLibrary().byRaceId`) use their
//   cached canonical trait entries by ID (plus any `racialSelections` choice IDs),
//   while unlisted inline custom/NPC/fixture race IDs fall back to parsing
//   `character.race.traits` through `buildRacialTraitLibrary` on demand.
//
// Caller status (agora-81ba, agora-db71.30 / GG-259): the character sheet
// overview (`CharacterOverview.tsx`) and the combat actor builder
// (`createPlayerCombatCharacter` in `src/utils/combat/combatUtils.ts`) call
// `getRacialMovementSpeedsForLevel`; `deriveAlternateMovementSpeeds` is now the
// same level-gated read, so no exported helper can hand out flight early.
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
  const baseSpeeds = readMovementSpeedProse(character, baseSpeedTraits);

  const unlocks: RacialMovementUnlock[] = (Object.keys(baseSpeeds) as MovementMode[])
    .flatMap((mode) => {
      const speedFeet = baseSpeeds[mode];
      return speedFeet === undefined
        ? []
        : [{ mode, speedFeet, minLevel: 1, traitName: 'Speed' }];
    });

  // Walk each racial feature trait active at `targetLevel` and check whether
  // its prose grants an additional or faster movement mode beyond the base line.
  getActiveRacialFeatureTraitsForCharacter(character, targetLevel).forEach((trait) => {
    const traitText = trait.sourceText ?? `${trait.traitName}: ${trait.traitDescription}`;
    const speeds = readMovementSpeedProse(character, [...baseSpeedTraits, traitText]);

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
 * The alternate movement speeds a character has at a level, with later-level
 * racial traits left out until that level is reached.
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
    // applies, exactly as the prose reader resolves overlapping sentences.
    if (current === undefined || unlock.speedFeet > current) {
      speeds[unlock.mode] = unlock.speedFeet;
    }
  });

  return speeds;
};

/**
 * GG-259: a character's alternate movement speeds (swim, climb, fly, burrow).
 * This used to read every race trait with no level check, so a level-1
 * Dragonborn could fly. It is now the level-gated read: a trait counts only
 * from its unlock level. `targetLevel` defaults to the character's level.
 */
export function deriveAlternateMovementSpeeds(
  character: PlayerCharacter,
  targetLevel: number = character.level ?? 1,
): Partial<Record<MovementMode, number>> {
  return getRacialMovementSpeedsForLevel(character, targetLevel);
}

function normalizeMode(word: string): MovementMode | undefined {
  const lower = word.toLowerCase();
  if (lower === 'swim' || lower === 'swimming') return 'swim';
  if (lower === 'climb' || lower === 'climbing') return 'climb';
  if (lower === 'fly' || lower === 'flying') return 'fly';
  if (lower === 'burrow' || lower === 'burrowing') return 'burrow';
  return undefined;
}

// ============================================================================
// Senses (Darkvision)
// ============================================================================
// Derives darkvision distance in feet from race data and specific subrace overrides.
// ============================================================================

export function calculateCharacterDarkvisionFromRace(
  race: PlayerCharacter['race'],
  racialSelections: PlayerCharacter['racialSelections'] = {},
): number {
  let range = 0;
  const darkvisionTrait = race.traits.find(t => t.toLowerCase().includes('darkvision') || t.toLowerCase().includes('vision:'));
  if (darkvisionTrait) {
    const match = darkvisionTrait.match(/(\d+)/);
    if (match) range = parseInt(match[1], 10);
  }

  if (
    (race.id === 'elf' && racialSelections?.elf?.choiceId === 'drow') ||
    race.id === 'duergar' ||
    race.id === 'dwarf' ||
    race.id === 'orc'
  ) {
    range = Math.max(range, 120);
  }

  return range;
}

// ============================================================================
// Derived Stats & Template Rehydration
// ============================================================================
// Full character recalculation that unifies stats, HP, AC, speed, proficiency bonus,
// and hit dice pools when changes occur.
// ============================================================================

/**
 * Fully recalculates all derived properties for a character based on their
 * current base ability scores, equipment, and level.
 * Consolidates logic that was previously duplicated across multiple reducers.
 */
export const updateDerivedStats = (character: PlayerCharacter): PlayerCharacter => {
  const updated = { ...character };

  // 1. Ability Scores (Final = Base + Racial + Equipment)
  updated.finalAbilityScores = calculateFinalAbilityScores(
    updated.abilityScores,
    updated.race,
    updated.equippedItems,
    updated.id
  );

  // 2. Max HP (Base + Con Mod * Level + Feat Bonuses)
  const conMod = getAbilityModifierValue(updated.finalAbilityScores.Constitution);
  const hpBonusPerLevel = getHpBonusPerLevelFromFeats(updated.feats || []);
  const racialHpBonus = (updated.race?.traits?.some(t => t.includes('Dwarven Toughness')) || updated.race?.id === 'hill_dwarf') ? 1 : 0;
  const hitDie = updated.class.hitDie;
  const level = updated.level || 1;

  // PHB Logic: Level 1 is full die, subsequent levels are average (die/2 + 1).
  const hpGainFirstLevel = hitDie + conMod + hpBonusPerLevel + racialHpBonus;
  const hpGainSubseqLevels = (level - 1) * (Math.floor(hitDie / 2) + 1 + conMod + hpBonusPerLevel + racialHpBonus);
  const newMaxHp = Math.max(1, hpGainFirstLevel + hpGainSubseqLevels);

  // Maintain current HP ratio or clamp to new max
  const oldMaxHp = updated.maxHp || newMaxHp;
  if (newMaxHp !== oldMaxHp) {
    updated.maxHp = newMaxHp;
    updated.hp = Math.min(updated.hp, updated.maxHp);
  }

  // 3. Armor Class
  updated.armorClass = calculateArmorClass(updated, updated.activeEffects);

  // 3.5. Movement Speed
  updated.speed = calculateCharacterSpeed(updated);

  // 4. Proficiency Bonus
  updated.proficiencyBonus = Math.floor((level - 1) / 4) + 2;

  // 5. Hit Dice Pools
  updated.hitPointDice = buildHitPointDicePools(updated);

  return updated;
};

export const normalizeCharacterRaceData = (character: PlayerCharacter): PlayerCharacter => {
  const canonicalRace = RACES_DATA[character.race?.id] ?? character.race;
  const normalized: PlayerCharacter = {
    ...character,
    race: canonicalRace,
    racialSelections: character.racialSelections ?? {},
    equippedItems: character.equippedItems ?? {},
    activeEffects: character.activeEffects ?? [],
    statusEffects: character.statusEffects ?? [],
  };

  const updated = updateDerivedStats(normalized);

  updated.speed = calculateCharacterSpeed(updated);
  updated.darkvisionRange = calculateCharacterDarkvisionFromRace(updated.race, updated.racialSelections);

  return updated;
};

/**
 * Creates a full PlayerCharacter object from a simplified TempPartyMember object.
 *
 * @param {TempPartyMember} tempMember - The temporary member data.
 * @returns {PlayerCharacter} A complete PlayerCharacter object.
 */
export const createPlayerCharacterFromTemp = (tempMember: TempPartyMember, raceId: string = 'human'): PlayerCharacter => {
  const classData = CLASSES_DATA[tempMember.classId] || CLASSES_DATA['fighter'];
  // Known recruits keep their species. Legacy callers still default to Human;
  // missing lineage/ancestry choices stay unresolved instead of being invented.
  const raceData = RACES_DATA[raceId.trim().toLowerCase().replace(/\s+/g, '_')] || RACES_DATA['human'];
  const baseAbilityScores: AbilityScores = { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 };
  const finalAbilityScores = calculateFixedRacialBonuses(baseAbilityScores, raceData);
  const maxHp = classData.hitDie + getAbilityModifierValue(finalAbilityScores.Constitution);
  const classLevels = { [classData.id]: Math.max(1, tempMember.level) };

  const newChar: PlayerCharacter = {
    id: tempMember.id,
    name: tempMember.name || `${classData.name} ${tempMember.level}`,
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
  const charLevel = newChar.level ?? tempMember.level ?? 1;
  const charWithRacialSpells = applyRacialSpellGrantsByLevel(newChar, charLevel);
  charWithRacialSpells.hitPointDice = buildHitPointDicePools(charWithRacialSpells, { classLevels });
  charWithRacialSpells.armorClass = calculateArmorClass(charWithRacialSpells, charWithRacialSpells.activeEffects);
  charWithRacialSpells.speed = calculateCharacterSpeed(charWithRacialSpells);
  charWithRacialSpells.darkvisionRange = calculateCharacterDarkvisionFromRace(raceData);
  return charWithRacialSpells;
};
