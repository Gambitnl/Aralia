// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/05/2026, 00:13:21
 * Dependents: utils/character/characterUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  AbilityScoreName,
  RacialSpellGrant,
  RacialSpell,
  RacialSpellCastingMethod,
  Race,
} from '../../types';

type RacialTraitResetCondition = 'short_rest' | 'long_rest';

type RacialResourceMax = number | 'proficiency_bonus';

export interface RacialResourceMechanic {
  id: string;
  maxUses: RacialResourceMax;
  resetOn: RacialTraitResetCondition;
  sourceLabel?: string;
}

export interface RacialTraitActivationWindow {
  fromLevel: number;
  toLevel?: number;
}

export interface RacialTraitSummary {
  id: string;
  sourceRaceId: string;
  sourceRaceName: string;
  traitName: string;
  traitType: RacialTraitType;
  minLevel: number;
  maxLevel?: number;
  featureGroup?: 'racialChoice' | 'mechanical' | 'informational';
  hasChoiceDefaults: boolean;
  resourceIds: string[];
  spellIds: string[];
  sourceText: string;
}

const DEFAULT_RACIAL_SPELL_CASTING_METHOD: RacialSpellCastingMethod = 'at_will';
const DEFAULT_RACIAL_SPELL_COUNTS_AS_PREPARED = false;

export type RacialTraitType =
  | 'spell'
  | 'feature'
  | 'resource'
  | 'resistance'
  | 'movement'
  | 'combat'
  | 'other';

export interface RacialTraitBase {
  type: RacialTraitType;
  sourceRaceId: string;
  sourceRaceName: string;
  traitName: string;
  traitDescription: string;
  minLevel: number;
  maxLevel?: number;
}

export interface RacialSpellTrait extends RacialTraitBase, Omit<RacialSpellGrant, 'sourceRaceName' | 'traitName'> {
  type: 'spell';
}

export interface RacialFeatureTrait extends RacialTraitBase {
  type: Exclude<RacialTraitType, 'spell'>;
  featureGroup: 'racialChoice' | 'mechanical' | 'informational';
  sourceText?: string;
  sourceChoiceId?: string;
  minLevel: number;
  maxLevel?: number;
  defensiveTraits?: RacialDefenseBuckets;
  metadata?: {
    source?: string;
    note?: string;
    defaultsFromChoice?: boolean;
  };
  resources?: RacialResourceMechanic[];
}

export type RacialChoiceRequirementType = 'spellAbility';

export interface RacialChoiceRequirement {
  type: RacialChoiceRequirementType;
  id: string;
  sourceRaceId: string;
  sourceRaceName: string;
  sourceTraitName: string;
  sourceTraitDescription: string;
  sourceText: string;
  requiredSpellIds?: string[];
}

export type RacialTrait = RacialSpellTrait | RacialFeatureTrait;

export interface RacialTraitLibrary {
  byRaceId: Record<string, RacialTrait[]>;
  bySpellId: Record<string, RacialSpellTrait[]>;
  byChoiceRaceId: Record<string, RacialChoiceRequirement[]>;
  allSpells: RacialSpellTrait[];
  allTraits: RacialTrait[];
  byType: Record<RacialTraitType, RacialTrait[]>;
  byActivationWindow: Record<string, RacialTraitSummary[]>;
  raceTraitSummaries: Record<string, RacialTraitSummary[]>;
  allTraitSummaries: RacialTraitSummary[];
}

const ABILITY_NAME_LOOKUP: Record<string, AbilityScoreName> = {
  wisdom: 'Wisdom',
  intelligence: 'Intelligence',
  charisma: 'Charisma',
};

const INVALID_RACIAL_SPELL_TOKENS = new Set([
  'a',
  'an',
  'the',
  'it',
  'them',
  'these',
  'those',
  'that',
  'either',
  'either/or',
  'any',
  'all',
  'each',
  'one',
  'same',
  'other',
  'another',
  'these',
  'itself',
  'you',
  'spell',
  'either',
  'spell/ability',
]);

type ParsedDefenseType = 'resistances' | 'immunities' | 'vulnerabilities';

export interface RacialDefenseBuckets {
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
}

const DAMAGE_TYPE_SYNONYMS: Record<string, string> = {
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
};

const normalizeDefenseTokens = (value: string): string[] => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z\\s]/g, ' ')
    .replace(/\\b(non[-\\s]?magical|magical|spell|damage|type|types|effect|effects)\\b/g, ' ')
    .split(/\\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const resolved: string[] = [];
  normalized.forEach((token) => {
    const damageType = DAMAGE_TYPE_SYNONYMS[token];
    if (!damageType) return;
    if (seen.has(damageType.toLowerCase())) return;
    seen.add(damageType.toLowerCase());
    resolved.push(damageType);
  });

  return resolved;
};

const extractDefenseBuckets = (text: string): RacialDefenseBuckets => {
  const matchRegex = /(resistance|resistant|immunity|immune|vulnerability|vulnerable)\s+(?:to|against)\s+([^.;,]+)/gi;
  const defensiveBuckets: RacialDefenseBuckets = {
    resistances: [],
    immunities: [],
    vulnerabilities: [],
  };

  const addToBucket = (bucket: ParsedDefenseType, clause: string): void => {
    const nextTypes = normalizeDefenseTokens(clause);
    nextTypes.forEach((type) => {
      if (!defensiveBuckets[bucket].includes(type)) {
        defensiveBuckets[bucket].push(type);
      }
    });
  };

  const trimClause = (clause: string): string => {
    const nextMarker = clause.search(
      /\\b(resistance|resistant|immunity|immune|vulnerability|vulnerable)\\s+(?:to|against)\\b/i
    );
    if (nextMarker > 0) return clause.slice(0, nextMarker).trim();
    return clause.trim();
  };

  let match: RegExpExecArray | null;
  while ((match = matchRegex.exec(text)) !== null) {
    const mode = match[1].toLowerCase();
    const clause = trimClause(match[2] || '');
    if (mode === 'immunity' || mode === 'immune') {
      addToBucket('immunities', clause);
      continue;
    }
    if (mode === 'vulnerability' || mode === 'vulnerable') {
      addToBucket('vulnerabilities', clause);
      continue;
    }
    addToBucket('resistances', clause);
  }

  return defensiveBuckets;
};

export const getRacialDefenseBucketsFromTraitText = (traitText: string): RacialDefenseBuckets =>
  extractDefenseBuckets(traitText);

const isSpellTokenAcceptable = (rawSpellId: string): boolean => {
  const token = normalizeSpellToken(rawSpellId);
  if (!token || token.length < 2) return false;
  if (!/^[a-z]/i.test(token)) return false;
  if (INVALID_RACIAL_SPELL_TOKENS.has(token.toLowerCase())) return false;
  if (/^(?:can|also|be|cast|with|using|without|at|level|from|or|and|of|to|by|for|your|you)$/.test(token.toLowerCase())) {
    return false;
  }
  return true;
};

export const buildRacialSpellTraitFromRacialSpell = (
  race: Race,
  racialTraitName: string,
  racialTraitDescription: string,
  spell: RacialSpell,
): RacialSpellTrait => ({
  type: 'spell',
  sourceRaceId: race.id,
  sourceRaceName: race.name,
  traitName: racialTraitName,
  traitDescription: racialTraitDescription,
  minLevel: spell.minLevel,
  spellId: spell.spellId,
  castingMethod: spell.castingMethod || DEFAULT_RACIAL_SPELL_CASTING_METHOD,
  spellAbility: spell.spellAbility as RacialSpellTrait['spellAbility'],
  maxCastLevel: spell.maxCastLevel,
  upcastable: spell.upcastable === undefined ? true : spell.upcastable,
  countsAsPrepared: spell.countsAsPrepared ?? DEFAULT_RACIAL_SPELL_COUNTS_AS_PREPARED,
});

const toResourceSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

const parseRacialTraitResourceReset = (trait: string): RacialTraitResetCondition | null => {
  const oncePerShortRestRegex = /once per short rest|short or long rest|until you finish a short rest|you can\s+use this trait\s+(?:once|a number of times).*(?:short|short or long) rest|you can\s+use this feature\s+(?:once|a number of times).*(?:short|short or long) rest|\bonce per rest\b|\bper\s+(?:a\s+)?short\s+rest|until you can(?:not|n't) use it again until you finish a short rest|until you can(?:not|n't) do so again until you finish a short rest|until you can(?:not|n't) use this feature again until you finish a short rest|you regain all expended uses when you finish a short rest/i;
  const oncePerLongRestRegex = /once per long rest|until you finish a long rest|you can\s+use this trait\s+(?:once|a number of times).*(?:long|daily) rest|you can\s+use this feature\s+(?:once|a number of times).*(?:long|daily) rest|\bper\s+(?:a\s+)?long\s+rest|until you can(?:not|n't) use it again until you finish a long rest|until you can(?:not|n't) do so again until you finish a long rest|until you can(?:not|n't) use this feature again until you finish a long rest|you regain all expended uses when you finish a long rest/i;

  if (oncePerShortRestRegex.test(trait)) {
    return 'short_rest';
  }
  if (oncePerLongRestRegex.test(trait)) {
    return 'long_rest';
  }
  return null;
};

const parseRacialTraitResourceMax = (trait: string): RacialResourceMax => {
  const proficiencyMatch = trait.match(/proficiency bonus/i);
  if (proficiencyMatch) return 'proficiency_bonus';

  const numericMatch = trait.match(/(?:a number of times|number of times equal to|up to|at most)\s+(\d+)/i);
  if (numericMatch) return parseInt(numericMatch[1], 10);

  return 1;
};

const normalizeSpellToken = (rawName: string): string => {
  const withLinks = rawName
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\*\*|\*/g, '')
    .replace(/[’']/g, '')
    .replace(/[\u2013\u2014]/g, '-');
  return withLinks
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const parseChoicePromptAbilities = (trait: string): AbilityScoreName[] => {
  const abilityMatches = trait.match(/\b(Intelligence|Wisdom|Charisma)\b/gi) ?? [];
  const abilities = Array.from(new Set(abilityMatches.map(match => ABILITY_NAME_LOOKUP[match.toLowerCase()])));
  return abilities.filter(Boolean) as AbilityScoreName[];
};

const inferSpellAbilityFromText = (trait: string): RacialSpellTrait['spellAbility'] | undefined => {
  const abilityMentions = parseChoicePromptAbilities(trait);
  if (abilityMentions.length === 0) {
    return undefined;
  }

  const choosesRaceSpellAbility = /\bchoose\b.*\bspellcasting ability\b/i.test(trait) ||
    /\bchoose when you select this race\b/i.test(trait) ||
    /\bspellcasting ability is your spellcasting ability\b/i.test(trait) ||
    /\byou can cast .* with.*choose\b/i.test(trait);

  if (choosesRaceSpellAbility || abilityMentions.length > 1) {
    return 'subrace_choice';
  }

  return abilityMentions[0];
};

const parseFeatureStartLevel = (trait: string): number => {
  const startMatch = trait.match(
    /\b(?:starting at|from|at)\s+(\d+)(?:st|nd|rd|th)?\s+level\b|\blevel\s+(\d+)(?:st|nd|rd|th)?\b/i
  );
  if (!startMatch) return 1;
  const [, matchedStart, matchedLevel] = startMatch;
  return parseInt((matchedStart ?? matchedLevel) as string, 10);
};

const parseFeatureMaxLevel = (trait: string): number | undefined => {
  const maxMatch = trait.match(/until\s+(?:you reach|you are)\s+(\d+)(?:st|nd|rd|th)? level/i) ??
    trait.match(/not after (\d+)(?:st|nd|rd|th)? level/i) ??
    trait.match(/(?:through|until)\s+(\d+)(?:st|nd|rd|th)? level/i);
  return maxMatch ? parseInt(maxMatch[1], 10) : undefined;
};

const parseSpellCastingMethodFromText = (trait: string): RacialSpellCastingMethod => {
  if (/\bonce per short rest\b/i.test(trait)) return 'once_per_short_rest';
  if (/\bonce per long rest\b/i.test(trait)) return 'once_per_long_rest';
  return 'at_will';
};

const parseCastingUpcastability = (spellText: string): boolean => {
  if (/\bwithout expending a spell slot\b/i.test(spellText)) return false;
  if (/\bwithout requiring a spell slot\b/i.test(spellText)) return false;
  if (/\bwithout a spell slot\b/i.test(spellText)) return false;
  if (/\bappropriate level\b/i.test(spellText)) return false;
  if (/\busing a higher[- ]level spell slot\b/i.test(spellText)) return true;
  if (/\busing (?:your|any|spell|character|appropriate|available)?\s*spell slots?\b/i.test(spellText)) return false;
  return true;
};

const parseSpellMaxCastLevel = (spellText: string): number | undefined => {
  const matches = spellText.match(/(?:at|up to|level)\s*(\d+)(?:st|nd|rd|th)?/i);
  if (!matches) return undefined;
  return parseInt(matches[1], 10);
};

const parseCountedAsPrepared = (trait: string): boolean => {
  if (/\bprepared\b/i.test(trait)) return true;
  return false;
};

const parseSpellLevelFromPhrase = (text: string): number => {
  const levelMatch = text.match(/(?:starting at|at|from|when you reach)\s+(\d+)(?:st|nd|rd|th)?\s+level/i);
  return levelMatch ? parseInt(levelMatch[1], 10) : 1;
};

const splitSpellNames = (raw: string): string[] => raw
  .split(/\s*(?:,|;|\band\b)\s*/i)
  .map((name) => normalizeSpellToken(name))
  .map((name) => name.trim())
  .filter(isSpellTokenAcceptable);

const extractSpellGrantsFromTraitText = (
  race: Race,
  traitName: string,
  traitDescription: string
): RacialSpellTrait[] => {
  const grants: RacialSpellTrait[] = [];
  const seen = new Set<string>();
  const addGrant = (grant: RacialSpellTrait): void => {
    const key = `${grant.spellId}|${grant.minLevel}|${grant.castingMethod}|${grant.maxLevel ?? ''}|${grant.spellAbility ?? ''}|${grant.countsAsPrepared ? '1' : '0'}|${grant.maxCastLevel ?? ''}|${grant.upcastable ? '1' : '0'}`;
    if (seen.has(key)) return;
    seen.add(key);
    grants.push(grant);
  };

  const leveledMatches = [...traitDescription.matchAll(/starting at (\d+)(?:st|nd|rd|th)? level(?: and for higher levels)?[,;:]?\s*you can (?:also )?cast (?:the )?([a-z0-9_' -]+?) spell/gi)];
  leveledMatches.forEach((match) => {
    const rawLevel = match[1];
    const rawSpells = match[2];
    const level = parseInt(rawLevel, 10);
    const spellIds = splitSpellNames(rawSpells);
    spellIds.forEach((spellId) => {
      const localTrait = traitDescription.slice(match.index ?? 0);
      const spellAbility = inferSpellAbilityFromText(traitDescription);
      addGrant({
        type: 'spell',
        sourceRaceId: race.id,
        sourceRaceName: race.name,
        traitName,
        traitDescription,
        minLevel: level,
        maxLevel: parseFeatureMaxLevel(traitDescription),
        spellId,
        castingMethod: parseSpellCastingMethodFromText(localTrait),
        spellAbility,
        upcastable: parseCastingUpcastability(localTrait),
        maxCastLevel: parseSpellMaxCastLevel(localTrait),
        countsAsPrepared: parseCountedAsPrepared(localTrait),
      });
    });
  });

  const cantripMatches = [...traitDescription.matchAll(/you know the ([a-z0-9_' -]+?) cantrip/gi)];
  cantripMatches.forEach((match) => {
    const spellNames = splitSpellNames(match[1]);
    spellNames.forEach((spellId) => {
      const spellAbility = inferSpellAbilityFromText(traitDescription);
      addGrant({
        type: 'spell',
        sourceRaceId: race.id,
        sourceRaceName: race.name,
        traitName,
        traitDescription,
        minLevel: 1,
        spellId,
        castingMethod: 'at_will',
        spellAbility,
        upcastable: false,
        countsAsPrepared: parseCountedAsPrepared(traitDescription),
      });
    });
  });

  const learnMatches = [...traitDescription.matchAll(/(?:at|starting at|from|when you reach)\s+(\d+)(?:st|nd|rd|th)?\s+level[^.]*?\s(?:you can|you)\s+(?:learn|know|can cast)\s+(?:the\s+)?([a-z0-9_' -]+?)(?:\s+spell\b|$)/gi)];
  learnMatches.forEach((match) => {
    const rawLevel = match[1];
    const rawSpells = match[2];
    const level = parseInt(rawLevel, 10);
    const spellIds = splitSpellNames(rawSpells);
    spellIds.forEach((spellId) => {
      const localTrait = traitDescription.slice(match.index ?? 0);
      const spellAbility = inferSpellAbilityFromText(traitDescription);
      addGrant({
        type: 'spell',
        sourceRaceId: race.id,
        sourceRaceName: race.name,
        traitName,
        traitDescription,
        minLevel: level,
        maxLevel: parseFeatureMaxLevel(traitDescription),
        spellId,
        castingMethod: parseSpellCastingMethodFromText(localTrait),
        spellAbility,
        upcastable: parseCastingUpcastability(localTrait),
        maxCastLevel: parseSpellMaxCastLevel(localTrait),
        countsAsPrepared: parseCountedAsPrepared(localTrait),
      });
    });
  });

  const anyCastMatches = [...traitDescription.matchAll(/cast (?:the )?([a-z0-9_' -]+?) spell\b/gi)];
  anyCastMatches.forEach((match) => {
    const rawSpells = splitSpellNames(match[1]);
    const matchContext = traitDescription.slice(0, (match.index ?? 0) + match[0].length);
    const spellLevel = parseSpellLevelFromPhrase(matchContext);
    rawSpells.forEach((spellId) => {
      const spellAbility = inferSpellAbilityFromText(traitDescription);
      const localTrait = traitDescription.slice(match.index ?? 0);
      addGrant({
        type: 'spell',
        sourceRaceId: race.id,
        sourceRaceName: race.name,
        traitName,
        traitDescription,
        minLevel: spellLevel,
        maxLevel: parseFeatureMaxLevel(traitDescription),
        spellId,
        castingMethod: parseSpellCastingMethodFromText(localTrait),
        spellAbility,
        upcastable: parseCastingUpcastability(localTrait),
        maxCastLevel: parseSpellMaxCastLevel(localTrait),
        countsAsPrepared: parseCountedAsPrepared(localTrait),
      });
    });
  });

  return grants;
};

const extractChoiceFromTrait = (
  race: Race,
  trait: string,
  traitName: string
): RacialChoiceRequirement | null => {
  const requiredAbilities = parseChoicePromptAbilities(trait);
  if (requiredAbilities.length === 0) return null;
  const requiresSpellAbilitySentence = /spellcasting ability|cast (?:the|that) spell|these spells/i.test(trait);
  if (!requiresSpellAbilitySentence) return null;

  const requiredSpellIds = new Set<string>();
  const grants = extractSpellGrantsFromTraitText(race, traitName, trait);
  grants.forEach((grant) => requiredSpellIds.add(grant.spellId));

  if (requiredSpellIds.size === 0 && /choose when you select this race/i.test(trait)) {
    return null;
  }

  return {
    type: 'spellAbility',
    id: `${race.id}::${normalizeSpellToken(traitName)}::spellAbility`,
    sourceRaceId: race.id,
    sourceRaceName: race.name,
    sourceTraitName: traitName,
    sourceTraitDescription: trait,
    sourceText: trait,
    requiredSpellIds: Array.from(requiredSpellIds),
  };
};

const buildRacialChoiceRequirementFromLegacyRaceField = (race: Race): RacialChoiceRequirement | null => {
  if (!race.racialSpellChoice) return null;
  return {
    type: 'spellAbility',
    id: `${race.id}::legacy-choice`,
    sourceRaceId: race.id,
    sourceRaceName: race.name,
    sourceTraitName: race.racialSpellChoice.traitName,
    sourceTraitDescription: race.racialSpellChoice.traitDescription,
    sourceText: race.racialSpellChoice.traitDescription,
    requiredSpellIds: race.knownSpells ? race.knownSpells.map(spell => spell.spellId) : [],
  };
};

const buildRacialChoiceFeatureTrait = (race: Race): RacialFeatureTrait => ({
  type: 'feature',
  sourceRaceId: race.id,
  sourceRaceName: race.name,
  minLevel: 1,
  traitName: race.racialSpellChoice?.traitName ?? `${race.name} racial feature`,
  traitDescription: race.racialSpellChoice?.traitDescription ?? `${race.name} racial feature`,
  featureGroup: 'racialChoice',
  metadata: {
    source: 'racialSpellChoice',
    defaultsFromChoice: true,
  },
});

const parseTraitResourceMechanics = (raceId: string, traitName: string, trait: string): RacialResourceMechanic[] => {
  const resources: RacialResourceMechanic[] = [];
  const resetOn = parseRacialTraitResourceReset(trait);
  if (!resetOn) return resources;

  const maxUses = parseRacialTraitResourceMax(trait);
  const resourceId = `${raceId}__${toResourceSlug(traitName)}__resource`;
  resources.push({
    id: resourceId,
    maxUses,
    resetOn,
    sourceLabel: `${traitName} usage`,
  });

  return resources;
};

const buildRacialTextFeatureTrait = (race: Race, trait: string): RacialFeatureTrait => {
  const featureNameMatch = trait.match(/^([^:]+):\s*(.*)$/);
  const traitName = featureNameMatch ? featureNameMatch[1].trim() : `${race.name} racial trait`;
  const traitDescription = featureNameMatch ? featureNameMatch[2].trim() : trait;
  const hasMechanicHint = /(starting at|you can|you have|once per|advantage|disadvantage|resistance|immunity|speed|darkvision)/i.test(trait);
  const resources = parseTraitResourceMechanics(race.id, traitName, trait);
  const featureType = resources.length > 0 ? 'resource' : inferRacialFeatureType(trait);
  const defensiveTraits = getRacialDefenseBucketsFromTraitText(trait);

  return {
    type: hasMechanicHint && featureType === 'feature' ? 'combat' : featureType,
    sourceRaceId: race.id,
    sourceRaceName: race.name,
    minLevel: parseFeatureStartLevel(trait),
    traitName,
    traitDescription,
    sourceText: trait,
    defensiveTraits: {
      resistances: [...defensiveTraits.resistances],
      immunities: [...defensiveTraits.immunities],
      vulnerabilities: [...defensiveTraits.vulnerabilities],
    },
    featureGroup: hasMechanicHint ? 'mechanical' : 'informational',
    resources,
    metadata: {
      source: 'race_traits',
    },
  };
};

const createTraitActivationWindowKey = (window: RacialTraitActivationWindow): string =>
  window.toLevel ? `${window.fromLevel}-${window.toLevel}` : `${window.fromLevel}+`;

const buildRacialTraitSummary = (trait: RacialTrait): RacialTraitSummary => {
  const featureGroup = trait.type === 'spell' ? undefined : (trait as RacialFeatureTrait).featureGroup;
  const hasChoiceDefaults = trait.type !== 'spell'
    ? Boolean((trait as RacialFeatureTrait).metadata?.defaultsFromChoice)
    : false;
  const resourceIds = trait.type === 'spell'
    ? []
    : ((trait as RacialFeatureTrait).resources ?? []).map(resource => resource.id);
  const spellIds = trait.type === 'spell' ? [(trait as RacialSpellTrait).spellId] : [];

  return {
    id: `${trait.sourceRaceId}::${toResourceSlug(`${trait.traitName}--${trait.minLevel}-${trait.maxLevel ?? 'open'}--${trait.type}`)}`,
    sourceRaceId: trait.sourceRaceId,
    sourceRaceName: trait.sourceRaceName,
    traitName: trait.traitName,
    traitType: trait.type,
    minLevel: trait.minLevel,
    maxLevel: trait.maxLevel,
    featureGroup,
    hasChoiceDefaults,
    resourceIds,
    spellIds,
    sourceText: trait.traitDescription,
  };
};

const buildDefaultTraitName = (race: Race): string => `${race.name} racial spells`;
const buildDefaultTraitDescription = (race: Race): string => `${race.name} racial spell list.`;

const addToRecord = <T,>(record: Record<string, T[]>, key: string, value: T): void => {
  const existing = record[key];
  if (existing) {
    existing.push(value);
  } else {
    record[key] = [value];
  }
};

const inferRacialFeatureType = (traitText: string): RacialFeatureTrait['type'] => {
  const text = traitText.toLowerCase();
  if (/\b(resistance|immunity)\b/i.test(text)) return 'resistance';
  if (/\b(speed|fly|swim|climb|burrow|movement)\b/i.test(text)) return 'movement';
  if (/\b(advantage|disadvantage)\s+on|saving throw|stealth|perception|initiative|attack|damage|combat\b/i.test(text)) {
    return 'combat';
  }
  if (/\b(cantrips?|spells?|casting|spell slots?|cast|spell ability)\b/i.test(text)) {
    return 'feature';
  }
  return 'feature';
};

export const buildRacialTraitLibrary = (races: Record<string, Race>): RacialTraitLibrary => {
  const byRaceId: Record<string, RacialTrait[]> = {};
  const bySpellId: Record<string, RacialSpellTrait[]> = {};
  const byChoiceRaceId: Record<string, RacialChoiceRequirement[]> = {};
  const byType: Record<RacialTraitType, RacialTrait[]> = {
    spell: [],
    feature: [],
    resource: [],
    resistance: [],
    movement: [],
    combat: [],
    other: [],
  };
  const byActivationWindow: Record<string, RacialTraitSummary[]> = {};
  const raceTraitSummaries: Record<string, RacialTraitSummary[]> = {};
  const allSpells: RacialSpellTrait[] = [];
  const allTraits: RacialTrait[] = [];

  Object.values(races).forEach((race) => {
    const traits: RacialTrait[] = [];
    const choices: RacialChoiceRequirement[] = [];

    if (race.racialSpellChoice) {
      traits.push(buildRacialChoiceFeatureTrait(race));
      const legacyChoice = buildRacialChoiceRequirementFromLegacyRaceField(race);
      if (legacyChoice) {
        choices.push(legacyChoice);
      }
    }

    const spellTraitName = race.racialSpellChoice?.traitName ?? buildDefaultTraitName(race);
    const spellTraitDescription = race.racialSpellChoice?.traitDescription ?? buildDefaultTraitDescription(race);
    const knownSpellIds = new Set(race.knownSpells?.map(spell => spell.spellId) ?? []);

    if (race.knownSpells?.length) {
      const spellTraits = race.knownSpells.map((spell) =>
        buildRacialSpellTraitFromRacialSpell(race, spellTraitName, spellTraitDescription, spell)
      );
      traits.push(...spellTraits);
      spellTraits.forEach((trait) => {
          allSpells.push(trait);
        addToRecord(bySpellId, trait.spellId, trait);
      });
    }

    const textTraitSpells: RacialSpellTrait[] = [];
    race.traits.forEach((traitText) => {
      const parsedTrait = buildRacialTextFeatureTrait(race, traitText);
      traits.push(parsedTrait);
      const parsedSpells = extractSpellGrantsFromTraitText(race, parsedTrait.traitName, traitText);
      parsedSpells.forEach((parsedSpellTrait) => {
        if (knownSpellIds.has(parsedSpellTrait.spellId)) return;
        textTraitSpells.push(parsedSpellTrait);
        knownSpellIds.add(parsedSpellTrait.spellId);
      });

      const parsedChoice = extractChoiceFromTrait(race, traitText, parsedTrait.traitName);
      if (parsedChoice && !choices.some(choice => choice.id === parsedChoice.id)) {
        choices.push(parsedChoice);
      }
    });

    traits.push(...textTraitSpells);
    textTraitSpells.forEach((trait) => {
      allSpells.push(trait);
      addToRecord(bySpellId, trait.spellId, trait);
    });

    if (choices.length === 0 && race.racialSpellChoice) {
      const fallbackChoice = buildRacialChoiceRequirementFromLegacyRaceField(race);
      if (fallbackChoice) {
        choices.push(fallbackChoice);
      }
    }

    if (choices.length > 0) {
      byChoiceRaceId[race.id] = choices;
    }

    traits.forEach((trait) => {
      addToRecord(byType, trait.type, trait);
      const summary = buildRacialTraitSummary(trait);
      addToRecord(raceTraitSummaries, race.id, summary);
      addToRecord(
        byActivationWindow,
        createTraitActivationWindowKey({ fromLevel: trait.minLevel, toLevel: trait.maxLevel }),
        summary
      );
    });

    byRaceId[race.id] = traits;
    allTraits.push(...traits);
  });

  const allTraitSummaries = Object.values(raceTraitSummaries).flat();

  return {
    byRaceId,
    bySpellId,
    byChoiceRaceId,
    byType,
    byActivationWindow,
    raceTraitSummaries,
    allTraitSummaries,
    allSpells,
    allTraits,
  };
};

export const getRacialChoiceRequirementsForRace = (raceId: string): RacialChoiceRequirement[] =>
  RACE_TRAIT_LIBRARY_INSTANCE?.byChoiceRaceId[raceId] ?? [];

export const getRacialSpellCastingAbilityChoicesForRace = (
  raceId: string
): RacialChoiceRequirement[] => getRacialChoiceRequirementsForRace(raceId).filter(choice => choice.type === 'spellAbility');

export const getRacialSpellCastingAbilityChoiceForRace = (
  raceId: string
): RacialChoiceRequirement | undefined => getRacialSpellCastingAbilityChoicesForRace(raceId)[0];

export const hasRacialSpellCastingAbilityChoiceForRace = (raceId: string): boolean =>
  getRacialSpellCastingAbilityChoicesForRace(raceId).length > 0;

export const getRacialTraitSummariesByRace = (raceId: string): RacialTraitSummary[] =>
  RACE_TRAIT_LIBRARY_INSTANCE?.raceTraitSummaries[raceId] ?? [];

export const getAllRacialTraitSummaries = (): RacialTraitSummary[] =>
  RACE_TRAIT_LIBRARY_INSTANCE?.allTraitSummaries ?? [];

export const getRacialTraitSummariesByActivationWindow = (): Record<string, RacialTraitSummary[]> =>
  RACE_TRAIT_LIBRARY_INSTANCE?.byActivationWindow ?? {};

let RACE_TRAIT_LIBRARY_INSTANCE: RacialTraitLibrary | null = null;

export const setRacialTraitLibraryInstance = (library: RacialTraitLibrary): void => {
  RACE_TRAIT_LIBRARY_INSTANCE = library;
};


