// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/05/2026, 19:21:27
 * Dependents: utils/character/characterUtils.ts
 * Imports: 2 files
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
import type { 
  EffectTrigger, 
  EffectCondition, 
  SpellEffect, 
  DefensiveEffect, 
  ReactiveEffect,
  SavingThrowAbility
} from '../../types/spells';

/**
 * This file manages the definition and parsing of racial traits.
 *
 * It parses trait strings from race configurations and extracts mechanical benefits
 * such as spell grants, defensive features (resistance/immunity), and modifier buckets
 * (ability score increases, custom Armor Class formulas, skill proficiencies, and speeds).
 *
 * Called by: characterUtils.ts (character assembly pipeline)
 * Depends on: types/index.ts, types/spells.ts for character/combat data definitions
 */

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
  modifierBuckets?: RacialModifierBuckets;
  metadata?: {
    source?: string;
    note?: string;
    defaultsFromChoice?: boolean;
  };
  resources?: RacialResourceMechanic[];
}

export type RacialChoiceRequirementType = 'spellAbility' | 'spellChoice' | 'skillChoice' | 'featChoice';

export interface RacialChoiceRequirement {
  type: RacialChoiceRequirementType;
  id: string;
  sourceRaceId: string;
  sourceRaceName: string;
  sourceTraitName: string;
  sourceTraitDescription: string;
  sourceText: string;
  requiredSpellIds?: string[];
  availableSpellIds?: string[];
  availableAbilities?: AbilityScoreName[];
  skillCount?: number;
  availableSkillIds?: string[];
  featId?: string;
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

export interface RacialBreathWeapon {
  areaShape: 'cone' | 'line';
  areaSize: number;
  saveAbility: AbilityScoreName;
  damageDice: string;
  damageType: string;
  scaling: { level: number; dice: string }[];
}

export interface RacialModifierBuckets {
  advantage: string[];
  disadvantage: string[];
  bonuses: string[];
  baseArmorClass?: number;
  acBonus?: number;
  reachBonus?: number;
  powerfulBuild?: boolean;
  unendingBreath?: boolean;
  languages?: string[];
  skillProficiencies?: string[];
  weaponProficiencies?: string[];
  armorProficiencies?: string[];
  initiativeBonus?: number;
  initiativeProficiency?: boolean;
  ignoreDifficultTerrain?: boolean;
  breathWeapon?: RacialBreathWeapon;
  reactions?: RacialReaction[];
  savageAttacks?: boolean;
}

export interface RacialReaction {
  id: string;
  name: string;
  description: string;
  trigger: any; // Using any for now to avoid circular dependencies with EffectTrigger
  condition: any; // Using any for now to avoid circular dependencies with EffectCondition
  effect: any; // Using any for now to avoid circular dependencies with SpellEffect
}

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

// ============================================================================
// Racial Modifier Parsing and Extraction
// ============================================================================
// This section handles parsing raw trait descriptions to find mechanical
// bonuses that alter character stats, such as additional skill or weapon
// proficiencies, custom Armor Class formulas (Natural Armor), extra attack
// reach, speed improvements, and saving throw modifiers.
// ============================================================================

// Look at a trait's text description and pull out any mechanical stat adjustments.
// This supports translating natural text blocks into concrete player stats.
const extractModifierBuckets = (text: string): RacialModifierBuckets => {
  // Start with empty lists for bonuses, advantages, and disadvantages.
  const buckets: RacialModifierBuckets = {
    advantage: [],
    disadvantage: [],
    bonuses: [],
  };

  // Find phrases that give advantage on certain rolls (like stealth or charm saving throws).
  const advMatch = text.match(/advantage on ([^.;]+)/gi);
  if (advMatch) {
    advMatch.forEach(match => buckets.advantage.push(match.replace(/advantage on /i, '').trim()));
  }
  
  // Find phrases that impose disadvantage on certain rolls.
  const disMatch = text.match(/disadvantage on ([^.;]+)/gi);
  if (disMatch) {
    disMatch.forEach(match => buckets.disadvantage.push(match.replace(/disadvantage on /i, '').trim()));
  }

  // Look for custom base Armor Class overrides.
  // This matches formulas like "base AC of 17" (Tortle) or "base AC is 13" (Thri-Kreen).
  const baseACMatch = text.match(/base\s+(?:Armor\s+Class|AC)\s+(?:is|of)\s+(\d+)/i);
  if (baseACMatch) {
    buckets.baseArmorClass = parseInt(baseACMatch[1], 10);
  }

  // Look for flat additions to Armor Class (like a "+1 bonus to Armor Class").
  const acBonusMatch = text.match(/(\+\d+)\s+bonus\s+to\s+your\s+Armor\s+Class/i) || text.match(/bonus\s+to\s+your\s+AC\s+of\s+(\d+)/i);
  if (acBonusMatch) {
    buckets.acBonus = parseInt(acBonusMatch[1].replace('+', ''), 10);
  }

  // Look for modifications to melee attack range (reach).
  const reachMatch = text.match(/reach\s+for\s+it\s+is\s+(\d+)\s+feet\s+greater/i);
  if (reachMatch) {
    buckets.reachBonus = parseInt(reachMatch[1], 10);
  }

  // Determine if this trait treats the character as one size category larger for carrying/lifting.
  if (/count\s+as\s+one\s+size\s+larger/i.test(text)) {
    buckets.powerfulBuild = true;
  }

  // Check if the character has the ability to breathe underwater or hold their breath indefinitely.
  if (/hold\s+your\s+breath\s+indefinitely/i.test(text)) {
    buckets.unendingBreath = true;
  }

  // Extract any additional languages the character learns to speak, read, and write.
  const langMatch = text.match(/speak,\s+read,\s+and\s+write\s+([A-Z][a-z]+)/g);
  if (langMatch) {
    buckets.languages = langMatch.map(m => m.replace(/speak,\s+read,\s+and\s+write\s+/i, '').trim());
  }

  // Parse skill proficiencies granted by this trait.
  // We look for phrasing like "proficiency in..." or "proficient in...".
  // To handle multiple skills (e.g. Satyr's Performance and Persuasion), we scan the matching text
  // block for any of the 18 standard D&D skills and grant proficiency for each one found.
  const skillMatches: string[] = [];
  const profSkillRegex = /(?:proficiency|proficient)\s+in\s+(?:the\s+)?([^.;]+)/i;
  const profSkillMatch = text.match(profSkillRegex);
  if (profSkillMatch) {
    const targetText = profSkillMatch[1];
    const skillsList = targetText.match(/\b(Acrobatics|Animal Handling|Arcana|Athletics|Deception|History|Insight|Intimidation|Investigation|Medicine|Nature|Perception|Performance|Persuasion|Religion|Sleight of Hand|Stealth|Survival)\b/gi);
    if (skillsList) {
      skillsList.forEach(skill => {
        // Ensure each skill name is correctly formatted with capital starting letters (e.g., Sleight of Hand).
        const formattedSkill = skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (!skillMatches.includes(formattedSkill)) {
          skillMatches.push(formattedSkill);
        }
      });
    }
  }

  // If we found skill proficiencies using the generalized matcher, apply them.
  // Otherwise, fall back to standard single-skill matching patterns.
  if (skillMatches.length > 0) {
    buckets.skillProficiencies = skillMatches;
  } else {
    const skillMatch = text.match(/proficiency\s+in\s+the\s+([A-Z][a-z]+)\s+skill/i) || text.match(/proficiency\s+in\s+([A-Z][a-z]+)/i);
    if (skillMatch) {
      buckets.skillProficiencies = [skillMatch[1].trim()];
    }
  }

  // Parse weapon proficiencies granted by this trait (e.g. axes, swords, or specific weapons).
  const weaponMatch = text.match(/proficiency\s+with\s+(?:the\s+)?([^.;]+)/i);
  if (weaponMatch && (text.includes('weapon') || text.includes('axe') || text.includes('bow') || text.includes('sword') || text.includes('hammer'))) {
    const weapons = weaponMatch[1].split(/,|\band\b/).map(s => s.trim()).filter(Boolean);
    buckets.weaponProficiencies = weapons;
  }

  // Parse armor or shield proficiencies granted by this trait (e.g., light or medium armor).
  const armorMatch = text.match(/proficiency\s+with\s+(?:the\s+)?([^.;]+)/i);
  if (armorMatch && (text.includes('armor') || text.includes('shield'))) {
    const armorTypes: string[] = [];
    if (/light/i.test(text)) armorTypes.push('Light armor');
    if (/medium/i.test(text)) armorTypes.push('Medium armor');
    if (/heavy/i.test(text)) armorTypes.push('Heavy armor');
    if (/shield/i.test(text)) armorTypes.push('Shields');
    buckets.armorProficiencies = armorTypes;
  }

  // Check if the character can add their Proficiency Bonus to initiative rolls.
  if (/add\s+your\s+Proficiency\s+Bonus\s+to\s+your\s+initiative\s+rolls/i.test(text)) {
    buckets.initiativeProficiency = true;
  }
  // Look for flat initiative roll bonuses (e.g. "+5 bonus to initiative").
  const initBonusMatch = text.match(/(\+\d+)\s+bonus\s+to\s+initiative/i);
  if (initBonusMatch) {
    buckets.initiativeBonus = parseInt(initBonusMatch[1].replace('+', ''), 10);
  }

  // Check if the character can move across difficult terrain without expending extra movement.
  if (/move\s+across\s+Difficult\s+Terrain\s+without\s+expending\s+extra\s+movement/i.test(text)) {
    buckets.ignoreDifficultTerrain = true;
  }

  // Check if the character has the Savage Attacks feature (grants extra damage die on melee critical hits).
  if (/Savage\s+Attacks/i.test(text)) {
    buckets.savageAttacks = true;
  }

  // Parse breath weapon parameters if this trait describes a dragonborn-style breath weapon.
  if (/Breath\s+Weapon/i.test(text)) {
    const areaMatch = text.match(/(\d+)-foot\s+(cone|line)/i);
    const saveMatch = text.match(/\b(Dexterity|Constitution)\b\s+saving\s+throw/i);
    const damageMatch = text.match(/(\d+d\d+)\s+([a-z]+)\s+damage/i);
    
    if (areaMatch && saveMatch && damageMatch) {
      const scaling: { level: number; dice: string }[] = [];
      const scalingMatches = [...text.matchAll(/(\d+d\d+)\s+at\s+(\d+)(?:st|nd|rd|th)?\s+level/gi)];
      scalingMatches.forEach(m => {
        scaling.push({ level: parseInt(m[2], 10), dice: m[1] });
      });

      buckets.breathWeapon = {
        areaShape: areaMatch[2].toLowerCase() as 'cone' | 'line',
        areaSize: parseInt(areaMatch[1], 10),
        saveAbility: saveMatch[1] as AbilityScoreName,
        damageDice: damageMatch[1],
        damageType: damageMatch[2],
        scaling
      };
    }
  }

  // Look for other general numerical or die-roll bonuses to specific rolls,
  // such as adding a d4 to ability checks or skill checks.
  const bonusRegex = /(?:add|roll|gain)\s+(?:a\s+)?(d\d+|\+\d+)\s+.*?(?:to|on|for)\s+([^.;]+)/gi;
  let match;
  while ((match = bonusRegex.exec(text)) !== null) {
    const diceOrFlat = match[1];
    let target = match[2].trim();
    target = target.replace(/the number rolled to\s+/i, '');
    const skillMatches = target.match(/\b(Acrobatics|Animal Handling|Arcana|Athletics|Deception|History|Insight|Intimidation|Investigation|Medicine|Nature|Perception|Performance|Persuasion|Religion|Sleight of Hand|Stealth|Survival)\b/gi);
    if (skillMatches) {
      skillMatches.forEach(skill => buckets.bonuses.push(`${diceOrFlat} to ${skill}`));
    } else {
      buckets.bonuses.push(`${diceOrFlat} to ${target}`);
    }
  }

  return buckets;
};

export const getRacialModifierBucketsFromTraitText = (traitText: string): RacialModifierBuckets =>
  extractModifierBuckets(traitText);

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
  .split(/\s*(?:,|;|\band\b|\bor\b)\s*/i)
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

const extractChoicesFromTrait = (
  race: Race,
  trait: string,
  traitName: string
): RacialChoiceRequirement[] => {
  const choices: RacialChoiceRequirement[] = [];

  // 1. Spell Choice Detection
  // Pattern: "one of the following cantrips of your choice: Dancing Lights, Light, or Sacred Flame"
  // Linear single-run capture (no nested quantifier) — ReDoS-safe (CodeQL js/redos).
  // Grabs the whole "a, b, or c" list up to the sentence period; splitSpellNames()
  // handles the , / and / or separators and filters invalid tokens.
  const spellChoiceMatch = trait.match(/one of the following (?:cantrips|spells) of your choice:?\s*([a-z0-9_', -]+)/i);
  let availableSpellIds: string[] | undefined;
  if (spellChoiceMatch) {
    availableSpellIds = splitSpellNames(spellChoiceMatch[1]);
    if (availableSpellIds.length > 0) {
      choices.push({
        type: 'spellChoice',
        id: `${race.id}::${normalizeSpellToken(traitName)}::spellChoice`,
        sourceRaceId: race.id,
        sourceRaceName: race.name,
        sourceTraitName: traitName,
        sourceTraitDescription: trait,
        sourceText: trait,
        availableSpellIds,
      });
    }
  }

  // 2. Spell Ability Choice Detection
  const requiredAbilities = parseChoicePromptAbilities(trait);
  if (requiredAbilities.length > 0) {
    const requiresSpellAbilitySentence = /spellcasting ability|cast (?:the|that) spell|these spells/i.test(trait);
    // Only surface a *choice* when the trait actually offers one: either it
    // names more than one ability, or it explicitly says "choose". A trait that
    // pins a single ability — e.g. Aasimar Light Bearer: "Charisma is your
    // spellcasting ability for it" — is FIXED, so it must not spawn a chooser.
    // (Mirrors inferSpellAbilityFromText's choice detection.)
    const offersAbilityChoice = requiredAbilities.length > 1 || /\bchoose\b/i.test(trait);
    if (requiresSpellAbilitySentence && offersAbilityChoice) {
      const requiredSpellIds = new Set<string>();
      const grants = extractSpellGrantsFromTraitText(race, traitName, trait);
      grants.forEach((grant) => requiredSpellIds.add(grant.spellId));

      const isManualChoiceHint = /choose when you select this race/i.test(trait);
      if (requiredSpellIds.size > 0 || isManualChoiceHint || availableSpellIds) {
         choices.push({
          type: 'spellAbility',
          id: `${race.id}::${normalizeSpellToken(traitName)}::spellAbility`,
          sourceRaceId: race.id,
          sourceRaceName: race.name,
          sourceTraitName: traitName,
          sourceTraitDescription: trait,
          sourceText: trait,
          requiredSpellIds: Array.from(requiredSpellIds),
          availableSpellIds,
          availableAbilities: requiredAbilities,
        });
      }
    }
  }

  // 3. Skill Choice Detection
  // Pattern: "one skill of your choice" (Human Skillful)
  // Pattern: "two of the following skills of your choice" (Lizardfolk Nature's Intuition)
  const skillCountMatch = trait.match(/proficiency with (one|two) of the following skills of your choice/i);
  if (skillCountMatch || /\bone skill of your choice\b/i.test(trait) || /\bproficiency in one skill of your choice\b/i.test(trait)) {
    const skillCount = (skillCountMatch && skillCountMatch[1].toLowerCase() === 'two') ? 2 : 1;
    
    // Extract available skill list if present
    let availableSkillIds: string[] | undefined;
    // Linear single-run capture (no nested quantifier) — ReDoS-safe (CodeQL js/redos).
    // Also fixes a latent under-capture in the old lazy pattern, which returned only the
    // first skill (e.g. just "Animal Handling") for multi-skill choices; the split below
    // handles , / and / or.
    const skillListMatch = trait.match(/of the following skills of your choice:?\s*([a-z0-9_', -]+)/i);
    if (skillListMatch) {
      availableSkillIds = skillListMatch[1].split(/,|\band\b|\bor\b/).map(s => s.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
    }

    choices.push({
      type: 'skillChoice',
      id: `${race.id}::${normalizeSpellToken(traitName)}::skillChoice`,
      sourceRaceId: race.id,
      sourceRaceName: race.name,
      sourceTraitName: traitName,
      sourceTraitDescription: trait,
      sourceText: trait,
      skillCount,
      availableSkillIds,
    });
  }

  // 4. Feat Choice Detection
  // Pattern: "an Origin feat of your choice" (Human Versatile)
  if (/\bOrigin feat of your choice\b/i.test(trait)) {
    choices.push({
      type: 'featChoice',
      id: `${race.id}::${normalizeSpellToken(traitName)}::featChoice`,
      sourceRaceId: race.id,
      sourceRaceName: race.name,
      sourceTraitName: traitName,
      sourceTraitDescription: trait,
      sourceText: trait,
    });
  }

  return choices;
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

const extractRacialReactions = (text: string, raceId: string, traitName: string): RacialReaction[] => {
  const reactions: RacialReaction[] = [];

  // Pattern 1: Damage Reduction (Stone's Endurance, Hadozee Resilience)
  const damageReductionRegex = /When you take damage.*?(?:use|take) (?:your |a )?reaction to roll (?:a |an? )?(\d*d\d+).*?(reduce the damage|subtract that total)/i;
  const drMatch = text.match(damageReductionRegex);
  if (drMatch) {
    const dice = drMatch[1];
    const hasConMod = /Constitution modifier/i.test(text);
    const hasProfBonus = /proficiency bonus/i.test(text);

    reactions.push({
      id: `${raceId}__${toResourceSlug(traitName)}__reaction`,
      name: traitName,
      description: text,
      trigger: { type: 'on_target_takes_damage' },
      condition: { type: 'always' },
      effect: {
        type: 'DEFENSIVE',
        defenseType: 'damage_reduction',
        damageReduction: {
          dice: dice,
          abilityModifier: hasConMod ? 'Constitution' : undefined,
          addProficiencyBonus: hasProfBonus,
          appliesTo: 'damage_taken',
          frequency: 'every_time'
        }
      }
    });
  }

  // Pattern 2: Vengeful Assault (Reaction Attack)
  const vengeanceRegex = /When you take damage from a creature.*?(?:use|take) (?:your |a )?reaction to make an attack/i;
  if (vengeanceRegex.test(text)) {
    reactions.push({
      id: `${raceId}__${toResourceSlug(traitName)}__reaction`,
      name: traitName,
      description: text,
      trigger: { type: 'on_target_takes_damage' },
      condition: { type: 'always' },
      effect: {
        type: 'REACTIVE',
        trigger: {
          type: 'on_target_attack',
          movementType: 'any'
        },
        description: 'Make an attack with the weapon against that creature.'
      }
    });
  }

  // Pattern 3: Lucky Footwork (Bonus to Save)
  const luckyFootworkRegex = /When you fail a (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw.*?(?:use|take) (?:your |a )?reaction to roll (?:a |an? )?(\d*d\d+) and add it to the save/i;
  const lfMatch = text.match(luckyFootworkRegex);
  if (lfMatch) {
    const saveType = lfMatch[1] as SavingThrowAbility;
    const dice = lfMatch[2];
    reactions.push({
      id: `${raceId}__${toResourceSlug(traitName)}__reaction`,
      name: traitName,
      description: text,
      trigger: { type: 'on_target_takes_damage' }, // Placeholder
      condition: {
        type: 'save',
        saveType: saveType
      },
      effect: {
        type: 'ATTACK_ROLL_MODIFIER',
        savingThrowModifier: {
          modifier: 'bonus',
          dice: dice,
          consumption: 'next_save',
          duration: { type: 'rounds', value: 1 }
        }
      }
    });
  }

  // Pattern 4: Reactive Damage (Storm's Thunder)
  const reactiveDamageRegex = /When you take damage from a creature.*?(?:use|take) (?:your |a )?reaction to deal (?:a |an? )?(\d*d\d+) (\w+) damage/i;
  const rdMatch = text.match(reactiveDamageRegex);
  if (rdMatch) {
    const dice = rdMatch[1];
    const damageType = rdMatch[2];
    reactions.push({
      id: `${raceId}__${toResourceSlug(traitName)}__reaction`,
      name: traitName,
      description: text,
      trigger: { type: 'on_target_takes_damage' },
      condition: { type: 'always' },
      effect: {
        type: 'DAMAGE',
        damage: {
          dice: dice,
          type: damageType
        }
      }
    });
  }

  return reactions;
};

const buildRacialTextFeatureTrait = (race: Race, trait: string): RacialFeatureTrait => {
  const featureNameMatch = trait.match(/^([^:]+):\s*(.*)$/);
  const traitName = featureNameMatch ? featureNameMatch[1].trim() : `${race.name} racial trait`;
  const traitDescription = featureNameMatch ? featureNameMatch[2].trim() : trait;
  const hasMechanicHint = /(starting at|you can|you have|once per|advantage|disadvantage|resistance|immunity|speed|darkvision|add a d\d+|roll a d\d+|reaction)/i.test(trait);
  const resources = parseTraitResourceMechanics(race.id, traitName, trait);
  const featureType = resources.length > 0 ? 'resource' : inferRacialFeatureType(trait);
  const defensiveTraits = getRacialDefenseBucketsFromTraitText(trait);
  const modifierBuckets = getRacialModifierBucketsFromTraitText(trait);
  const reactions = extractRacialReactions(trait, race.id, traitName);

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
    modifierBuckets: {
      advantage: [...modifierBuckets.advantage],
      disadvantage: [...modifierBuckets.disadvantage],
      bonuses: [...modifierBuckets.bonuses],
      baseArmorClass: modifierBuckets.baseArmorClass,
      acBonus: modifierBuckets.acBonus,
      reachBonus: modifierBuckets.reachBonus,
      powerfulBuild: modifierBuckets.powerfulBuild,
      unendingBreath: modifierBuckets.unendingBreath,
      languages: modifierBuckets.languages ? [...modifierBuckets.languages] : undefined,
      reactions: reactions.length > 0 ? reactions : undefined,
      skillProficiencies: modifierBuckets.skillProficiencies ? [...modifierBuckets.skillProficiencies] : [],
      weaponProficiencies: modifierBuckets.weaponProficiencies ? [...modifierBuckets.weaponProficiencies] : [],
      armorProficiencies: modifierBuckets.armorProficiencies ? [...modifierBuckets.armorProficiencies] : [],
      initiativeBonus: modifierBuckets.initiativeBonus,
      initiativeProficiency: modifierBuckets.initiativeProficiency,
      ignoreDifficultTerrain: modifierBuckets.ignoreDifficultTerrain,
      savageAttacks: modifierBuckets.savageAttacks,
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

      const parsedChoices = extractChoicesFromTrait(race, traitText, parsedTrait.traitName);
      parsedChoices.forEach((parsedChoice) => {
        if (!choices.some(choice => choice.id === parsedChoice.id)) {
          choices.push(parsedChoice);
        }
      });
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

/**
 * RACIAL TRAIT SUMMARIZATION & ACCESSORS:
 * 
 * These helper functions provide high-level, flattened accessors to the active
 * racial trait library instance, shielding consumer components from manual checks
 * against the global RACE_TRAIT_LIBRARY_INSTANCE singleton.
 * 
 * PRESERVED LOGIC:
 * - Direct lookup in the cached raceTraitSummaries map.
 * - Flat summaries retrieval for all traits in the system.
 * - Grouped lookup by level-based activation windows.
 * 
 * FIX HISTORY:
 * - Removed an accidental duplicate copy-paste block at the end of this file 
 *   that was introducing duplicate exports and syntax errors (broken trailing expression).
 */

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


