#!/usr/bin/env npx tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

import type { Race } from '../src/types';
import { loadActiveRacesForValidation } from './load-race-data';

/**
 * This script builds review reports that compare Aralia's implemented race data
 * with the vendored 5etools race corpus.
 *
 * It exists to guide future data migration work without rewriting Aralia's race
 * files. The script reads the current TypeScript race records, reads glossary
 * race JSON for display coverage, reads the local vendor corpus as a reference,
 * and writes report artifacts under docs/reports/race-reconciliation.
 *
 * Called by: agents or developers through `npx tsx scripts/raceReconciliationInventory.ts`
 * Depends on: scripts/load-race-data.ts for safe Node-side race loading, vendor/5etools-src/data/races.json
 */

// ============================================================================
// Shared Report Types
// ============================================================================
// These interfaces define the JSON shape emitted by the reconciliation workflow.
// Keeping them in this script makes the report contract visible without adding a
// runtime race-data model that could be mistaken for the app's canonical source.
// ============================================================================

export type SupportBucket =
  | 'enforced_now'
  | 'represented_not_enforced'
  | 'blocked_by_missing_mechanic_family'
  | 'ambiguous_requires_human_mapping'
  | 'display_lore_only';

export type CrosswalkStatus = 'matched' | 'reflavored' | 'custom' | 'unmatched' | 'ambiguous';

export type MatchConfidence = 'high' | 'medium' | 'low';

export interface AraliaTraitDetail {
  traitName: string;
  detailText: string;
}

export interface AraliaRaceInventoryRecord {
  id: string;
  name: string;
  baseRace?: string;
  descriptionLength: number;
  abilityBonuses: Race['abilityBonuses'];
  traits: string[];
  traitNames: string[];
  knownSpells: Race['knownSpells'];
  spellsOfTheMark: Race['spellsOfTheMark'];
  racialSpellChoice: Race['racialSpellChoice'];
  choiceStructures: string[];
  visual?: Race['visual'];
  imageUrl?: string;
  glossaryPath?: string;
  glossaryId?: string;
  glossaryName?: string;
  structuralWarnings: string[];
}

export interface VendorTraitSummary {
  name: string;
  summary: string;
}

export interface VendorRaceInventoryRecord {
  name: string;
  normalizedName: string;
  source: string;
  page?: number;
  path: string;
  kind: 'race' | 'subrace' | 'foundry_race';
  size: string[];
  speed: Record<string, number>;
  senses: {
    darkvision?: number;
    blindsight?: number;
    tremorsense?: number;
    truesight?: number;
  };
  abilityKeys: string[];
  resistanceKeys: string[];
  skillKeys: string[];
  toolKeys: string[];
  weaponKeys: string[];
  languageKeys: string[];
  choiceSignals: string[];
  traits: VendorTraitSummary[];
  tags: string[];
}

export interface CrosswalkCandidate {
  vendorName: string;
  vendorSource: string;
  vendorPath: string;
  confidence: MatchConfidence;
  score: number;
  reasons: string[];
}

export interface CrosswalkRecord {
  araliaRaceId: string;
  araliaName: string;
  status: CrosswalkStatus;
  vendorCandidates: CrosswalkCandidate[];
  notes: string;
}

export interface MechanicClassification {
  mechanicKey: string;
  support: SupportBucket;
  bucket: string;
  recommendedNextStep: string;
  confidence: MatchConfidence;
  capability?: RaceMechanicCapability;
  codeReferences: string[];
}

export interface MechanicSupportRecord extends MechanicClassification {
  araliaRaceId?: string;
  araliaName?: string;
  vendorName?: string;
  vendorSource?: string;
  traitName: string;
  araliaCurrentRepresentation: string;
  vendorEvidence?: string;
  source: 'aralia' | 'vendor_candidate';
}

export type CapabilitySupportStatus =
  | 'enforced'
  | 'represented_only'
  | 'display_only'
  | 'unsupported'
  | 'ambiguous';

export interface RaceMechanicCapability {
  mechanicFamily: string;
  supportStatus: CapabilitySupportStatus;
  dataFields: string[];
  enforcementPaths: string[];
  displayPaths: string[];
  limitations: string[];
  exampleRaceIds: string[];
  confidence: MatchConfidence;
}

interface GlossaryRaceRecord {
  id?: string;
  name?: string;
  path: string;
}

interface VendorRaceRaw {
  name?: unknown;
  source?: unknown;
  page?: unknown;
  size?: unknown;
  speed?: unknown;
  darkvision?: unknown;
  blindsight?: unknown;
  tremorsense?: unknown;
  truesight?: unknown;
  ability?: unknown;
  resist?: unknown;
  traitTags?: unknown;
  skillProficiencies?: unknown;
  toolProficiencies?: unknown;
  weaponProficiencies?: unknown;
  languageProficiencies?: unknown;
  entries?: unknown;
}

// ============================================================================
// Paths And Constants
// ============================================================================
// This section keeps all generated output in the report folder requested by the
// goal prompt. No source race files are written by this script.
// ============================================================================

const PROJECT_ROOT = process.cwd();
const REPORT_DIR = path.join(PROJECT_ROOT, 'docs', 'reports', 'race-reconciliation');
const VENDOR_RACES_PATH = path.join(PROJECT_ROOT, 'vendor', '5etools-src', 'data', 'races.json');
const VENDOR_FOUNDRY_RACES_PATH = path.join(PROJECT_ROOT, 'vendor', '5etools-src', 'data', 'foundry-races.json');
const GLOSSARY_RACE_GLOB = 'public/data/glossary/entries/races/**/*.json';

const CUSTOM_OR_REFLAVOR_SIGNALS = [
  'beastborn',
  'forgeborn',
  'guardian',
  'hearthkeeper',
  'mender',
  'pathfinder',
  'runeward',
  'seersight',
  'shadowveil',
  'stormborn',
  'wayfarer',
  'wordweaver',
];

// ============================================================================
// Aralia Race Mechanic Capability Matrix
// ============================================================================
// This matrix is the gatekeeper for implementation claims. Keyword matching can
// identify a likely mechanic family, but only this list can say whether Aralia
// actually consumes that family today.
// ============================================================================

export const DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX: RaceMechanicCapability[] = [
  {
    mechanicFamily: 'walk_speed',
    supportStatus: 'enforced',
    dataFields: ['race.traits', 'PlayerCharacter.speed'],
    enforcementPaths: [
      'src/components/CharacterCreator/hooks/useCharacterAssembly.ts:calculateCharacterSpeed',
      'src/utils/character/characterUtils.ts:calculateCharacterSpeedFromRace',
      'src/utils/character/characterUtils.ts:normalizeCharacterRaceData',
    ],
    displayPaths: [
      'src/components/CharacterCreator/NameAndReview.tsx',
      'src/components/CharacterSheet/Overview/CharacterOverview.tsx',
    ],
    limitations: ['Only the walking speed number is enforced; fly, swim, climb, and burrow text is not structured.'],
    exampleRaceIds: ['human', 'wood_elf', 'air_genasi'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'darkvision',
    supportStatus: 'enforced',
    dataFields: ['race.traits', 'PlayerCharacter.darkvisionRange'],
    enforcementPaths: [
      'src/components/CharacterCreator/hooks/useCharacterAssembly.ts:calculateCharacterDarkvision',
      'src/utils/character/characterUtils.ts:calculateCharacterDarkvisionFromRace',
      'src/utils/character/characterUtils.ts:normalizeCharacterRaceData',
    ],
    displayPaths: ['src/components/CharacterSheet/Overview/CharacterOverview.tsx'],
    limitations: ['Darkvision range is numeric only; lighting rules and magical-darkness exceptions are not modeled here.'],
    exampleRaceIds: ['drow', 'deep_gnome', 'half_orc'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'fixed_ability_bonus',
    supportStatus: 'enforced',
    dataFields: ['race.abilityBonuses', 'PlayerCharacter.finalAbilityScores'],
    enforcementPaths: [
      'src/utils/character/statUtils.ts:calculateFixedRacialBonuses',
      'src/utils/character/statUtils.ts:calculateFinalAbilityScores',
      'src/components/CharacterCreator/state/characterCreatorState.ts',
    ],
    displayPaths: ['src/components/CharacterCreator/NameAndReview.tsx'],
    limitations: ['Flexible Any bonuses are intentionally skipped by the fixed-bonus calculator and handled by point-buy/choice flow.'],
    exampleRaceIds: ['half_orc', 'hill_dwarf'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'known_racial_spells',
    supportStatus: 'enforced',
    dataFields: ['race.knownSpells', 'PlayerCharacter.spellbook'],
    enforcementPaths: [
      'src/utils/character/spellUtils.ts:getCharacterSpells',
      'src/utils/character/characterValidation.ts:validateCharacterChoices',
    ],
    displayPaths: ['src/components/CharacterCreator/NameAndReview.tsx'],
    limitations: ['The spell grant is aggregated, but rest-limited casting uses and free cast tracking are not enforced.'],
    exampleRaceIds: ['air_genasi', 'aarakocra', 'abyssal_tiefling'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'racial_spell_ability_choice',
    supportStatus: 'represented_only',
    dataFields: ['race.racialSpellChoice', 'PlayerCharacter.racialSelections'],
    enforcementPaths: ['src/utils/character/characterValidation.ts:validateCharacterChoices'],
    displayPaths: [
      'src/components/CharacterCreator/state/characterCreatorState.ts',
      'src/components/CharacterCreator/config/sidebarSteps.ts',
    ],
    limitations: ['The choice is stored and validated, but the current spell utility does not use it to calculate save DC or attack bonuses.'],
    exampleRaceIds: ['air_genasi', 'aarakocra'],
    confidence: 'medium',
  },
  {
    mechanicFamily: 'required_race_choice',
    supportStatus: 'enforced',
    dataFields: ['PlayerCharacter.racialSelections', 'RaceDataBundle'],
    enforcementPaths: [
      'src/utils/character/characterValidation.ts:validateCharacterChoices',
      'src/components/CharacterCreator/state/characterCreatorState.ts',
    ],
    displayPaths: ['src/components/Party/PartyPane/PartyMemberCard.tsx'],
    limitations: ['Only the known chooser families in validation are covered. Reflavored standalone races need their own explicit choice handling.'],
    exampleRaceIds: ['elf', 'tiefling', 'goliath'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'fixed_or_selected_skill_proficiency',
    supportStatus: 'enforced',
    dataFields: ['PlayerCharacter.skills', 'PlayerCharacter.racialSelections'],
    enforcementPaths: [
      'src/components/CharacterCreator/hooks/useCharacterAssembly.ts:assembleFinalSkills',
      'src/components/CharacterCreator/utils/skillSelectionUtils.ts:buildSkillsForSubmit',
    ],
    displayPaths: ['src/components/CharacterCreator/SkillSelection.tsx'],
    limitations: ['Only currently hardcoded race skill grants and choices are enforced; arbitrary trait text is not automatically converted.'],
    exampleRaceIds: ['human', 'elf', 'bugbear', 'centaur', 'changeling'],
    confidence: 'medium',
  },
  {
    mechanicFamily: 'canonical_race_rehydration',
    supportStatus: 'enforced',
    dataFields: ['PlayerCharacter.race', 'ALL_RACES_DATA'],
    enforcementPaths: ['src/utils/character/characterUtils.ts:normalizeCharacterRaceData'],
    displayPaths: ['src/services/premadeCharacterService.ts'],
    limitations: ['Rehydration restores canonical race data by ID; missing racialSelections remain validation work.'],
    exampleRaceIds: ['human', 'half_orc'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'race_derived_hp_ac_recalculation',
    supportStatus: 'enforced',
    dataFields: ['PlayerCharacter.finalAbilityScores', 'PlayerCharacter.maxHp', 'PlayerCharacter.armorClass'],
    enforcementPaths: [
      'src/utils/character/characterUtils.ts:updateDerivedStats',
      'src/utils/character/statUtils.ts:calculateFinalAbilityScores',
      'src/utils/character/statUtils.ts:calculateArmorClass',
    ],
    displayPaths: ['src/components/CharacterSheet/Overview/CharacterOverview.tsx'],
    limitations: ['This enforces derived HP/AC from ability scores and equipment, not standalone race traits like natural armor unless encoded elsewhere.'],
    exampleRaceIds: ['half_orc', 'hill_dwarf'],
    confidence: 'medium',
  },
  {
    mechanicFamily: 'visual_metadata',
    supportStatus: 'display_only',
    dataFields: ['race.visual', 'race.imageUrl'],
    enforcementPaths: [],
    displayPaths: [
      'src/components/CharacterCreator/Race/RaceDetailModal.tsx',
      'src/components/CharacterCreator/shared/CharacterCreatorTraitsTable.tsx',
    ],
    limitations: ['Visual data supports selection/display, not gameplay.'],
    exampleRaceIds: ['aarakocra', 'half_orc'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'display_identity_text',
    supportStatus: 'display_only',
    dataFields: ['race.traits', 'race.description', 'glossary race JSON'],
    enforcementPaths: [],
    displayPaths: ['src/components/CharacterCreator/Race/RaceDetailModal.tsx'],
    limitations: ['Creature type, size, culture, age, and lore text are shown but not used as mechanical gates.'],
    exampleRaceIds: ['human', 'aarakocra'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'once_per_rest_spell',
    supportStatus: 'represented_only',
    dataFields: ['race.knownSpells', 'race.racialSpellChoice', 'race.traits'],
    enforcementPaths: ['src/utils/character/spellUtils.ts:getCharacterSpells'],
    displayPaths: ['src/components/CharacterCreator/NameAndReview.tsx'],
    limitations: ['The spell can be known/displayed, but free uses and rest reset limits are not tracked for racial spells.'],
    exampleRaceIds: ['aarakocra', 'duergar', 'firbolg'],
    confidence: 'medium',
  },
  {
    mechanicFamily: 'tool_weapon_language_proficiency',
    supportStatus: 'display_only',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: ['src/components/CharacterCreator/Race/RaceDetailModal.tsx'],
    limitations: ['Race has no structured language/tool/weapon proficiency fields in src/types/character.ts yet.'],
    exampleRaceIds: ['dragonborn', 'githyanki'],
    confidence: 'medium',
  },
  {
    mechanicFamily: 'alternate_movement_mode',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Fly, swim, climb, and burrow speeds are not separate PlayerCharacter movement fields.'],
    exampleRaceIds: ['aarakocra', 'sea_elf', 'tabaxi'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'damage_resistance',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Damage resolution does not consume race-owned resistance fields.'],
    exampleRaceIds: ['air_genasi', 'dragonborn', 'tiefling'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'breath_weapon',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Breath weapon action, save DC, scaling, area, damage type, and rest reset are not structured.'],
    exampleRaceIds: ['black_dragonborn', 'red_dragonborn'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'condition_save_advantage',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Saving throw logic does not consume race-owned conditional advantage traits.'],
    exampleRaceIds: ['drow', 'deep_gnome'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'death_prevention',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['No trigger/reaction/rest-reset mechanic exists for dropping to 1 HP.'],
    exampleRaceIds: ['half_orc'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'natural_weapon',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Race-granted attacks are not converted into weapon, action, or unarmed strike options.'],
    exampleRaceIds: ['aarakocra', 'tabaxi', 'lizardfolk'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'limited_use_reaction',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Combat reactions and rest-reset uses are not defined for race traits.'],
    exampleRaceIds: ['goblin', 'hadozee'],
    confidence: 'medium',
  },
  {
    mechanicFamily: 'reroll_or_luck',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Race-owned rerolls do not connect to the roll engine or limited-use tracking.'],
    exampleRaceIds: ['halfling', 'autognome'],
    confidence: 'medium',
  },
  {
    mechanicFamily: 'powerful_build',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Carrying capacity and size-based carry rules are not enforced from race data.'],
    exampleRaceIds: ['goliath', 'firbolg', 'bugbear'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'creature_communication',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Dialogue and creature interaction systems do not consume race communication traits.'],
    exampleRaceIds: ['firbolg', 'forest_gnome'],
    confidence: 'medium',
  },
  {
    mechanicFamily: 'environmental_adaptation',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Travel, rest, poison, breathing, sleep, and survival systems do not consume these race traits.'],
    exampleRaceIds: ['air_genasi', 'autognome', 'warforged'],
    confidence: 'medium',
  },
  {
    mechanicFamily: 'shapeshifting_or_disguise',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Identity-changing traits are not represented as actions, forms, or disguise state.'],
    exampleRaceIds: ['changeling'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'innate_teleport',
    supportStatus: 'unsupported',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Teleport traits are not wired into movement, combat, map, or limited-use systems.'],
    exampleRaceIds: ['eladrin', 'shadar_kai'],
    confidence: 'high',
  },
  {
    mechanicFamily: 'ambiguous_unmapped_trait',
    supportStatus: 'ambiguous',
    dataFields: ['race.traits'],
    enforcementPaths: [],
    displayPaths: [],
    limitations: ['Trait text needs human review before it can be classified as display text or a mechanic family.'],
    exampleRaceIds: [],
    confidence: 'low',
  },
];

// ============================================================================
// Text Normalization
// ============================================================================
// These helpers make matching deterministic. They reduce names to comparable
// words while preserving ancestry words hidden in 5etools parenthetical names.
// ============================================================================

export function normalizeRaceNameForMatching(name: string): string {
  const parenthetical = [...name.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]).join(' ');
  const withoutParenthetical = name.replace(/\([^)]*\)/g, ' ');
  const combined = `${parenthetical} ${withoutParenthetical}`;

  return combined
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeIdText(value: string): string {
  // Race IDs are already review-friendly in Aralia. This helper only removes
  // separators so IDs can be compared against normalized vendor names.
  return value.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function wordsForMatching(value: string): Set<string> {
  return new Set(normalizeRaceNameForMatching(value).split(' ').filter(Boolean));
}

// ============================================================================
// Safe Value Readers
// ============================================================================
// Vendor records are intentionally treated as unknown external data. These
// readers keep malformed or surprising fields from crashing the whole workflow.
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = 'unknown_or_available_source'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function collectTruthyKeys(value: unknown): string[] {
  // 5etools proficiency fields are often arrays of objects where truthy keys
  // name granted languages, tools, weapons, or choices. This keeps only the key
  // names so report output avoids copying long rule text.
  if (!Array.isArray(value)) return [];

  const keys = new Set<string>();

  for (const entry of value) {
    if (!isRecord(entry)) continue;
    for (const [key, itemValue] of Object.entries(entry)) {
      if (key === 'choose' || key === 'anyStandard') {
        keys.add(key);
      } else if (itemValue === true || typeof itemValue === 'number' || typeof itemValue === 'string') {
        keys.add(key);
      }
    }
  }

  return [...keys].sort();
}

function readSpeed(value: unknown): Record<string, number> {
  if (typeof value === 'number') return { walk: value };
  if (!isRecord(value)) return {};

  const speed: Record<string, number> = {};
  for (const [key, itemValue] of Object.entries(value)) {
    if (typeof itemValue === 'number') {
      speed[key] = itemValue;
    } else if (isRecord(itemValue) && typeof itemValue.number === 'number') {
      speed[key] = itemValue.number;
    }
  }

  return speed;
}

function collectAbilityKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const keys = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    for (const [key, itemValue] of Object.entries(entry)) {
      if (typeof itemValue === 'number' || key === 'choose') {
        keys.add(key);
      }
    }
  }

  return [...keys].sort();
}

function collectResistanceKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : isRecord(entry) ? Object.keys(entry).join('.') : ''))
      .filter(Boolean)
      .sort();
  }
  return [];
}

// ============================================================================
// Trait Extraction
// ============================================================================
// Aralia currently stores many race mechanics as readable trait strings. These
// helpers split and classify that text while preserving the original source data.
// ============================================================================

export function extractAraliaTraitDetail(traitText: string): AraliaTraitDetail {
  const separatorIndex = traitText.indexOf(':');
  if (separatorIndex === -1) {
    return {
      traitName: traitText.trim(),
      detailText: '',
    };
  }

  return {
    traitName: traitText.slice(0, separatorIndex).trim(),
    detailText: traitText.slice(separatorIndex + 1).trim(),
  };
}

function summarizeEntries(entries: unknown): VendorTraitSummary[] {
  if (!Array.isArray(entries)) return [];

  const traits: VendorTraitSummary[] = [];

  for (const entry of entries) {
    if (isRecord(entry) && typeof entry.name === 'string') {
      traits.push({
        name: entry.name,
        summary: `${asString(entry.type, 'entry')}: ${entry.name}`,
      });
    } else if (typeof entry === 'string') {
      const shortText = entry.replace(/\{@[^}]+}/g, '').slice(0, 80).trim();
      traits.push({
        name: 'Unlabeled Entry',
        summary: shortText,
      });
    }
  }

  return traits;
}

// ============================================================================
// Vendor Inventory
// ============================================================================
// This section turns 5etools records into compact structural summaries. The
// report stores names, source references, paths, and field-level signals rather
// than long copyrighted trait text.
// ============================================================================

export function summarizeVendorRace(
  rawRace: VendorRaceRaw,
  vendorPath: string,
  kind: VendorRaceInventoryRecord['kind'] = 'race',
): VendorRaceInventoryRecord {
  const name = asString(rawRace.name, 'Unnamed Vendor Race');
  const speed = readSpeed(rawRace.speed);

  return {
    name,
    normalizedName: normalizeRaceNameForMatching(name),
    source: asString(rawRace.source),
    page: asNumber(rawRace.page),
    path: path.relative(PROJECT_ROOT, vendorPath).replace(/\\/g, '/'),
    kind,
    size: asStringArray(rawRace.size),
    speed,
    senses: {
      darkvision: asNumber(rawRace.darkvision),
      blindsight: asNumber(rawRace.blindsight),
      tremorsense: asNumber(rawRace.tremorsense),
      truesight: asNumber(rawRace.truesight),
    },
    abilityKeys: collectAbilityKeys(rawRace.ability),
    resistanceKeys: collectResistanceKeys(rawRace.resist),
    skillKeys: collectTruthyKeys(rawRace.skillProficiencies),
    toolKeys: collectTruthyKeys(rawRace.toolProficiencies),
    weaponKeys: collectTruthyKeys(rawRace.weaponProficiencies),
    languageKeys: collectTruthyKeys(rawRace.languageProficiencies),
    choiceSignals: [
      ...collectTruthyKeys(rawRace.skillProficiencies).filter((key) => key === 'choose'),
      ...collectTruthyKeys(rawRace.toolProficiencies).filter((key) => key === 'choose'),
      ...collectTruthyKeys(rawRace.weaponProficiencies).filter((key) => key === 'choose'),
      ...collectTruthyKeys(rawRace.languageProficiencies).filter((key) => key === 'choose' || key === 'anyStandard'),
    ].sort(),
    traits: summarizeEntries(rawRace.entries),
    tags: asStringArray(rawRace.traitTags),
  };
}

function loadVendorInventory(): VendorRaceInventoryRecord[] {
  if (!fs.existsSync(VENDOR_RACES_PATH)) {
    throw new Error(`Vendored 5etools race file not found: ${VENDOR_RACES_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(VENDOR_RACES_PATH, 'utf-8')) as Record<string, unknown>;
  const records: VendorRaceInventoryRecord[] = [];

  const raceRecords = Array.isArray(raw.race) ? raw.race : [];
  for (const race of raceRecords) {
    if (isRecord(race)) records.push(summarizeVendorRace(race, VENDOR_RACES_PATH, 'race'));
  }

  const subraceRecords = Array.isArray(raw.subrace) ? raw.subrace : [];
  for (const subrace of subraceRecords) {
    if (isRecord(subrace)) records.push(summarizeVendorRace(subrace, VENDOR_RACES_PATH, 'subrace'));
  }

  if (fs.existsSync(VENDOR_FOUNDRY_RACES_PATH)) {
    const foundryRaw = JSON.parse(fs.readFileSync(VENDOR_FOUNDRY_RACES_PATH, 'utf-8')) as Record<string, unknown>;
    const foundryRecords = Array.isArray(foundryRaw.race) ? foundryRaw.race : [];
    for (const race of foundryRecords) {
      if (isRecord(race)) records.push(summarizeVendorRace(race, VENDOR_FOUNDRY_RACES_PATH, 'foundry_race'));
    }
  }

  return records.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}

// ============================================================================
// Glossary Inventory
// ============================================================================
// Glossary JSON is a display surface, not the mechanical source of truth. This
// section records which display entry appears to line up with each Aralia race.
// ============================================================================

function loadGlossaryRaceRecords(): GlossaryRaceRecord[] {
  return globSync(GLOSSARY_RACE_GLOB, { cwd: PROJECT_ROOT })
    .sort()
    .map((relativePath) => {
      const absolutePath = path.join(PROJECT_ROOT, relativePath);
      try {
        const data = JSON.parse(fs.readFileSync(absolutePath, 'utf-8')) as Record<string, unknown>;
        return {
          id: typeof data.id === 'string' ? data.id : undefined,
          name: typeof data.name === 'string' ? data.name : undefined,
          path: relativePath.replace(/\\/g, '/'),
        };
      } catch {
        return {
          path: relativePath.replace(/\\/g, '/'),
        };
      }
    });
}

function findGlossaryRecord(race: Race, glossaryRecords: GlossaryRaceRecord[]): GlossaryRaceRecord | undefined {
  const raceIdFormats = new Set([race.id, race.id.replace(/_/g, '-'), race.id.replace(/-/g, '_')]);
  const raceName = normalizeRaceNameForMatching(race.name);

  return glossaryRecords.find((record) => {
    const recordId = record.id ?? path.basename(record.path, '.json');
    const recordName = record.name ? normalizeRaceNameForMatching(record.name) : '';
    return raceIdFormats.has(recordId) || raceIdFormats.has(recordId.replace(/-/g, '_')) || recordName === raceName;
  });
}

// ============================================================================
// Aralia Inventory
// ============================================================================
// This section reads implemented Aralia race records and records their current
// fields. It does not mutate or normalize the race files themselves.
// ============================================================================

function buildChoiceStructureList(race: Race): string[] {
  const structures: string[] = [];
  if (race.elvenLineages?.length) structures.push('elvenLineages');
  if (race.gnomeSubraces?.length) structures.push('gnomeSubraces');
  if (race.giantAncestryChoices?.length) structures.push('giantAncestryChoices');
  if (race.fiendishLegacies?.length) structures.push('fiendishLegacies');
  if (race.racialSpellChoice) structures.push('racialSpellChoice');
  if (race.spellsOfTheMark?.length) structures.push('spellsOfTheMark');
  return structures;
}

function findStructuralWarnings(race: Race, glossaryRecord?: GlossaryRaceRecord): string[] {
  const warnings: string[] = [];

  if (!race.traits?.length) warnings.push('missing traits array or traits array is empty');
  if (!race.description?.trim()) warnings.push('missing description');
  if (!race.visual && !race.imageUrl) warnings.push('missing visual metadata and legacy imageUrl');
  if (!glossaryRecord) warnings.push('no matching glossary race JSON found by id/name heuristics');
  if (race.imageUrl && race.visual) warnings.push('has both legacy imageUrl and visual metadata');

  return warnings;
}

async function loadAraliaInventory(): Promise<AraliaRaceInventoryRecord[]> {
  const races = await loadActiveRacesForValidation();
  const glossaryRecords = loadGlossaryRaceRecords();

  return races.map((race) => {
    const glossaryRecord = findGlossaryRecord(race, glossaryRecords);
    const traitDetails = race.traits.map(extractAraliaTraitDetail);

    return {
      id: race.id,
      name: race.name,
      baseRace: race.baseRace,
      descriptionLength: race.description.length,
      abilityBonuses: race.abilityBonuses ?? [],
      traits: race.traits,
      traitNames: traitDetails.map((detail) => detail.traitName),
      knownSpells: race.knownSpells ?? [],
      spellsOfTheMark: race.spellsOfTheMark ?? [],
      racialSpellChoice: race.racialSpellChoice,
      choiceStructures: buildChoiceStructureList(race),
      visual: race.visual,
      imageUrl: race.imageUrl,
      glossaryPath: glossaryRecord?.path,
      glossaryId: glossaryRecord?.id,
      glossaryName: glossaryRecord?.name,
      structuralWarnings: findStructuralWarnings(race, glossaryRecord),
    };
  });
}

// ============================================================================
// Crosswalk Matching
// ============================================================================
// Matching is confidence-scored so uncertain or custom Aralia identities remain
// visible to human review instead of being silently collapsed into vendor data.
// ============================================================================

function getAraliaWalkSpeed(race: Pick<AraliaRaceInventoryRecord, 'traits'>): number | undefined {
  const speedTrait = race.traits.find((trait) => trait.toLowerCase().startsWith('speed:'));
  const match = speedTrait?.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function getAraliaDarkvision(race: Pick<AraliaRaceInventoryRecord, 'traits'>): number | undefined {
  const visionTrait = race.traits.find((trait) => /darkvision|vision:/i.test(trait));
  const match = visionTrait?.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function scoreCandidate(araliaRace: Pick<AraliaRaceInventoryRecord, 'id' | 'name' | 'traits' | 'traitNames'>, vendorRace: VendorRaceInventoryRecord): CrosswalkCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  const araliaName = normalizeRaceNameForMatching(araliaRace.name);
  const araliaIdName = normalizeIdText(araliaRace.id);
  const vendorName = vendorRace.normalizedName;

  if (araliaName === vendorName || araliaIdName === vendorName) {
    score += 60;
    reasons.push('name match');
  } else if (vendorName.includes(araliaName) || araliaName.includes(vendorName)) {
    score += 35;
    reasons.push('partial name match');
  } else {
    const araliaWords = wordsForMatching(araliaRace.name);
    const vendorWords = wordsForMatching(vendorRace.name);
    const overlap = [...araliaWords].filter((word) => vendorWords.has(word));
    if (overlap.length > 0) {
      score += overlap.length * 12;
      reasons.push(`name word overlap: ${overlap.join(', ')}`);
    }
  }

  const araliaSpeed = getAraliaWalkSpeed(araliaRace);
  if (araliaSpeed !== undefined && vendorRace.speed.walk === araliaSpeed) {
    score += 10;
    reasons.push('speed match');
  }

  const araliaDarkvision = getAraliaDarkvision(araliaRace);
  if (araliaDarkvision !== undefined && vendorRace.senses.darkvision === araliaDarkvision) {
    score += 10;
    reasons.push('darkvision match');
  }

  const araliaTraitNames = new Set(araliaRace.traitNames.map(normalizeRaceNameForMatching));
  const vendorTraitNames = vendorRace.traits.map((trait) => normalizeRaceNameForMatching(trait.name));
  const traitOverlap = vendorTraitNames.filter((name) => araliaTraitNames.has(name));
  if (traitOverlap.length > 0) {
    score += Math.min(20, traitOverlap.length * 5);
    reasons.push(`trait overlap: ${traitOverlap.slice(0, 4).join(', ')}`);
  }

  if (score < 20) return null;

  return {
    vendorName: vendorRace.name,
    vendorSource: vendorRace.source,
    vendorPath: vendorRace.path,
    confidence: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    score,
    reasons,
  };
}

export function createRaceCrosswalkRecord(
  araliaRace: Pick<AraliaRaceInventoryRecord, 'id' | 'name' | 'traits' | 'traitNames'>,
  vendorInventory: VendorRaceInventoryRecord[],
): CrosswalkRecord {
  const candidates = vendorInventory
    .map((vendorRace) => scoreCandidate(araliaRace, vendorRace))
    .filter((candidate): candidate is CrosswalkCandidate => !!candidate)
    .sort((a, b) => b.score - a.score || a.vendorName.localeCompare(b.vendorName))
    .slice(0, 5);

  const hasCustomSignal = CUSTOM_OR_REFLAVOR_SIGNALS.some((signal) => araliaRace.id.includes(signal));
  const topConfidence = candidates[0]?.confidence;

  const status: CrosswalkStatus = candidates.length === 0
    ? hasCustomSignal ? 'custom' : 'unmatched'
    : hasCustomSignal ? 'reflavored'
    : topConfidence === 'high' ? 'matched'
    : 'ambiguous';

  const notes = status === 'matched'
    ? 'High-confidence deterministic match; still review before using vendor data for migration.'
    : status === 'reflavored'
      ? 'Aralia ID/name suggests a reflavor or custom variant. Vendor candidates are references only.'
      : status === 'custom'
        ? 'No useful vendor candidate found and Aralia ID suggests a custom or reflavored race.'
        : status === 'unmatched'
          ? 'No candidate reached the minimum deterministic score.'
          : 'Candidate exists, but confidence is not high enough for automated mapping.';

  return {
    araliaRaceId: araliaRace.id,
    araliaName: araliaRace.name,
    status,
    vendorCandidates: candidates,
    notes,
  };
}

function buildCrosswalk(araliaInventory: AraliaRaceInventoryRecord[], vendorInventory: VendorRaceInventoryRecord[]): CrosswalkRecord[] {
  return araliaInventory.map((race) => createRaceCrosswalkRecord(race, vendorInventory));
}

// ============================================================================
// Mechanic Support Classification
// ============================================================================
// This classifier starts conservative. It recognizes mechanics that existing
// utilities consume today, flags stored-but-not-enforced details, and groups
// repeated unsupported behaviors into future implementation families.
// ============================================================================

function findCapability(
  mechanicFamily: string,
  capabilityMatrix: RaceMechanicCapability[],
): RaceMechanicCapability | undefined {
  // The matrix is the only source allowed to prove support. Missing matrix
  // entries deliberately downgrade otherwise familiar keywords to manual review.
  return capabilityMatrix.find((capability) => capability.mechanicFamily === mechanicFamily);
}

function supportFromCapability(capability?: RaceMechanicCapability): SupportBucket {
  if (!capability) return 'ambiguous_requires_human_mapping';

  switch (capability.supportStatus) {
    case 'enforced':
      return 'enforced_now';
    case 'represented_only':
      return 'represented_not_enforced';
    case 'display_only':
      return 'display_lore_only';
    case 'unsupported':
      return 'blocked_by_missing_mechanic_family';
    case 'ambiguous':
    default:
      return 'ambiguous_requires_human_mapping';
  }
}

function classifyFromCapability(params: {
  mechanicKey: string;
  bucket: string;
  mechanicFamily: string;
  fallbackNextStep: string;
  capabilityMatrix: RaceMechanicCapability[];
}): MechanicClassification {
  const capability = findCapability(params.mechanicFamily, params.capabilityMatrix);
  const support = supportFromCapability(capability);

  return {
    mechanicKey: params.mechanicKey,
    support,
    bucket: params.bucket,
    recommendedNextStep: capability?.limitations[0] ?? params.fallbackNextStep,
    confidence: capability?.confidence ?? 'low',
    capability,
    codeReferences: capability ? [...capability.enforcementPaths, ...capability.displayPaths] : [],
  };
}

const RACE_IDS_WITH_ENFORCED_SKILL_PROFICIENCY = new Set([
  'human',
  'elf',
  'bugbear',
  'centaur',
  'changeling',
]);

export function applyRaceSpecificSupportCorrections(
  raceId: string,
  classification: MechanicClassification,
): MechanicClassification {
  // The capability matrix proves that some racial skill grants are wired, but
  // not that every skill-looking race trait is wired. This guard keeps the
  // report honest for races whose skill traits still need character assembly work.
  if (
    classification.capability?.mechanicFamily === 'fixed_or_selected_skill_proficiency' &&
    !RACE_IDS_WITH_ENFORCED_SKILL_PROFICIENCY.has(raceId)
  ) {
    return {
      ...classification,
      support: 'blocked_by_missing_mechanic_family',
      confidence: 'medium',
      recommendedNextStep: 'Add this race skill trait to character assembly before treating it as enforced.',
    };
  }

  return classification;
}

export function classifyMechanicText(
  traitName: string,
  detailText: string,
  capabilityMatrix: RaceMechanicCapability[] = DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX,
): MechanicClassification {
  const text = `${traitName} ${detailText}`.toLowerCase();
  const lowerTraitName = traitName.toLowerCase();

  if (/^speed$/i.test(traitName) || /walk speed|speed:\s*\d+|\d+\s*feet/.test(text) && lowerTraitName === 'speed') {
    return classifyFromCapability({
      mechanicKey: 'movement.walk_speed',
      bucket: 'movement_walk_speed',
      mechanicFamily: 'walk_speed',
      fallbackNextStep: 'Verify walk speed support before treating this as implemented.',
      capabilityMatrix,
    });
  }

  if (/darkvision|vision/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'senses.darkvision',
      bucket: 'darkvision',
      mechanicFamily: 'darkvision',
      fallbackNextStep: 'Verify darkvision support before treating this as implemented.',
      capabilityMatrix,
    });
  }

  if (/breath weapon|metallic breath/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'combat.breath_weapon',
      bucket: 'breath_weapon',
      mechanicFamily: 'breath_weapon',
      fallbackNextStep: 'Define breath weapon action, scaling, save DC, damage type, area, and rest reset before implementation.',
      capabilityMatrix,
    });
  }

  if (/drop to 1 hit point|reduced to 0 hit points|death/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'survival.death_prevention',
      bucket: 'death_prevention',
      mechanicFamily: 'death_prevention',
      fallbackNextStep: 'Define a death-prevention trigger mechanic with rest reset tracking.',
      capabilityMatrix,
    });
  }

  if (/known? the|cantrip|cast .* spell|spellcasting ability|spells of the mark|levitate|disguise self|misty step/.test(text)) {
    const isRestLimited = /once per|long rest|short rest/.test(text);
    return classifyFromCapability({
      mechanicKey: isRestLimited ? 'spellcasting.once_per_rest_spell' : 'spellcasting.known_racial_spell',
      bucket: isRestLimited ? 'once_per_rest_spell' : 'racial_spell_grant',
      mechanicFamily: isRestLimited ? 'once_per_rest_spell' : 'known_racial_spells',
      fallbackNextStep: 'Compare text traits with knownSpells/racialSpellChoice and define missing spell storage where needed.',
      capabilityMatrix,
    });
  }

  if (/resistance|resistant|damage type/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'defense.damage_resistance',
      bucket: 'damage_resistance',
      mechanicFamily: 'damage_resistance',
      fallbackNextStep: 'Define a race-owned resistance mechanic consumed by damage resolution.',
      capabilityMatrix,
    });
  }

  if (/powerful build|carrying capacity|push|drag|lift/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'inventory.powerful_build',
      bucket: 'powerful_build',
      mechanicFamily: 'powerful_build',
      fallbackNextStep: 'Wait for carrying capacity/inventory weight systems before enforcement.',
      capabilityMatrix,
    });
  }

  if (/\bcreature type\b|\bsize\b|\bage\b|\bheight\b|\bappearance\b|\bculture\b|\blore\b/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'display.lore_or_identity',
      bucket: 'display_lore_only',
      mechanicFamily: 'display_identity_text',
      fallbackNextStep: 'Keep as glossary/display text unless a gameplay system needs it.',
      capabilityMatrix,
    });
  }

  if (/advantage/.test(text) && /saving throw|save/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'saving_throw.condition_advantage',
      bucket: 'condition_save_advantage',
      mechanicFamily: 'condition_save_advantage',
      fallbackNextStep: 'Define a conditional save-advantage hook for race traits.',
      capabilityMatrix,
    });
  }

  if (/proficien/.test(text) && /skill/.test(text)) {
    return classifyFromCapability({
      mechanicKey: /choose|choice|one of|two of/.test(text) ? 'proficiency.choice_of_skill' : 'proficiency.fixed_skill',
      bucket: /choose|choice|one of|two of/.test(text) ? 'choice_of_skill' : 'skill_proficiency',
      mechanicFamily: 'fixed_or_selected_skill_proficiency',
      fallbackNextStep: 'Only treat this as implemented for race skill grants known to character assembly.',
      capabilityMatrix,
    });
  }

  if (/tool|weapon|language/.test(text) && /proficien|speak|read|write/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'proficiency.tool_weapon_language',
      bucket: /language/.test(text) ? 'language_proficiency' : /tool/.test(text) ? 'tool_proficiency' : 'weapon_proficiency',
      mechanicFamily: 'tool_weapon_language_proficiency',
      fallbackNextStep: 'Add structured race proficiency fields before enforcement.',
      capabilityMatrix,
    });
  }

  if (/fly|flying|swim|climb|burrow/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'movement.alternate_mode',
      bucket: 'alternate_movement_mode',
      mechanicFamily: 'alternate_movement_mode',
      fallbackNextStep: 'Add structured movement modes before enforcing non-walk movement.',
      capabilityMatrix,
    });
  }

  if (/natural weapon|unarmed strike|claw|bite|talon|horn/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'combat.natural_weapon',
      bucket: 'natural_weapon',
      mechanicFamily: 'natural_weapon',
      fallbackNextStep: 'Define race-granted attacks as equipment or action options.',
      capabilityMatrix,
    });
  }

  if (/reaction/.test(text) || /when .* hit|when .* damage/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'reaction.limited_use',
      bucket: 'limited_use_reaction',
      mechanicFamily: 'limited_use_reaction',
      fallbackNextStep: 'Create trigger/reaction storage before enforcing this trait in combat.',
      capabilityMatrix,
    });
  }

  if (/reroll|luck|lucky|d20/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'rolls.reroll_or_luck',
      bucket: 'reroll_or_luck',
      mechanicFamily: 'reroll_or_luck',
      fallbackNextStep: 'Connect race-owned rerolls to the same future roll modifier layer as feat luck.',
      capabilityMatrix,
    });
  }

  if (/communicate|speak with|telepathy|beast|animal|creature/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'interaction.creature_communication',
      bucket: 'creature_communication',
      mechanicFamily: 'creature_communication',
      fallbackNextStep: 'Represent special communication modes for dialogue and exploration systems.',
      capabilityMatrix,
    });
  }

  if (/environment|underwater|poison|disease|sleep|rest|exhaustion|weather|temperature/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'survival.environmental_adaptation',
      bucket: 'environmental_adaptation',
      mechanicFamily: 'environmental_adaptation',
      fallbackNextStep: 'Group environmental adaptations before wiring them into travel/rest/survival systems.',
      capabilityMatrix,
    });
  }

  if (/disguise|shapechange|shapeshift|appearance|form/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'identity.shapeshifting_or_disguise',
      bucket: 'shapeshifting_or_disguise',
      mechanicFamily: 'shapeshifting_or_disguise',
      fallbackNextStep: 'Define identity-changing mechanics separately from static race display.',
      capabilityMatrix,
    });
  }

  if (/teleport|misty step|step through|fey step/.test(text)) {
    return classifyFromCapability({
      mechanicKey: 'movement.innate_teleport',
      bucket: 'innate_teleport',
      mechanicFamily: 'innate_teleport',
      fallbackNextStep: 'Model innate teleport as a limited-use action before combat/map enforcement.',
      capabilityMatrix,
    });
  }

  return classifyFromCapability({
    mechanicKey: 'ambiguous.unmapped_trait_text',
    bucket: 'ambiguous_requires_human_mapping',
    mechanicFamily: 'ambiguous_unmapped_trait',
    fallbackNextStep: 'Review manually before choosing whether this is display text or a reusable mechanic family.',
    capabilityMatrix,
  });
}

function buildMechanicsReport(
  araliaInventory: AraliaRaceInventoryRecord[],
  vendorInventory: VendorRaceInventoryRecord[],
  crosswalk: CrosswalkRecord[],
): MechanicSupportRecord[] {
  const records: MechanicSupportRecord[] = [];
  const vendorByNameSource = new Map(vendorInventory.map((vendor) => [`${vendor.name}|${vendor.source}|${vendor.path}`, vendor]));

  for (const race of araliaInventory) {
    for (const trait of race.traits) {
      const detail = extractAraliaTraitDetail(trait);
      records.push({
        ...applyRaceSpecificSupportCorrections(
          race.id,
          classifyMechanicText(detail.traitName, detail.detailText),
        ),
        araliaRaceId: race.id,
        araliaName: race.name,
        traitName: detail.traitName,
        araliaCurrentRepresentation: detail.detailText ? 'trait_text_only' : 'trait_label_only',
        source: 'aralia',
      });
    }

    if (race.abilityBonuses?.length) {
      records.push({
        ...classifyFromCapability({
          mechanicKey: 'ability.fixed_or_flexible_bonus',
          bucket: 'ability_bonus',
          mechanicFamily: 'fixed_ability_bonus',
          fallbackNextStep: 'Preserve current character creation ability handling until runtime race data is designed.',
          capabilityMatrix: DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX,
        }),
        araliaRaceId: race.id,
        araliaName: race.name,
        traitName: 'Ability Bonuses',
        araliaCurrentRepresentation: 'abilityBonuses_field',
        source: 'aralia',
      });
    }

    if (race.knownSpells?.length) {
      records.push({
        ...classifyFromCapability({
          mechanicKey: 'spellcasting.known_spells_field',
          bucket: 'racial_spell_grant',
          mechanicFamily: 'known_racial_spells',
          fallbackNextStep: 'Keep using knownSpells where character spell aggregation already consumes it.',
          capabilityMatrix: DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX,
        }),
        araliaRaceId: race.id,
        araliaName: race.name,
        traitName: 'Known Spells',
        araliaCurrentRepresentation: 'knownSpells_field',
        source: 'aralia',
      });
    }
  }

  for (const record of crosswalk) {
    const candidate = record.vendorCandidates[0];
    if (!candidate) continue;

    const vendor = vendorByNameSource.get(`${candidate.vendorName}|${candidate.vendorSource}|${candidate.vendorPath}`);
    if (!vendor) continue;

    for (const trait of vendor.traits) {
      records.push({
        ...classifyMechanicText(trait.name, trait.summary),
        araliaRaceId: record.araliaRaceId,
        araliaName: record.araliaName,
        vendorName: vendor.name,
        vendorSource: vendor.source,
        traitName: trait.name,
        araliaCurrentRepresentation: 'vendor_reference_only',
        vendorEvidence: trait.summary,
        source: 'vendor_candidate',
      });
    }

    for (const resistance of vendor.resistanceKeys) {
      records.push({
        ...classifyMechanicText('Damage Resistance', resistance),
        araliaRaceId: record.araliaRaceId,
        araliaName: record.araliaName,
        vendorName: vendor.name,
        vendorSource: vendor.source,
        traitName: 'Vendor Resistance Field',
        araliaCurrentRepresentation: 'vendor_reference_only',
        vendorEvidence: resistance,
        source: 'vendor_candidate',
      });
    }
  }

  return records;
}

// ============================================================================
// Markdown Report Writers
// ============================================================================
// These functions turn the machine-readable reports into human-facing summaries
// that explain what was found, what was preserved, and what should happen next.
// ============================================================================

function countBy<T extends string>(items: T[]): Record<T, number> {
  return items.reduce((counts, item) => {
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function writeJsonReport(fileName: string, data: unknown): void {
  fs.writeFileSync(path.join(REPORT_DIR, fileName), `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function buildMechanicBucketsMarkdown(records: MechanicSupportRecord[]): string {
  const bucketMap = new Map<string, MechanicSupportRecord[]>();

  for (const record of records) {
    if (record.support === 'display_lore_only' || record.support === 'ambiguous_requires_human_mapping') continue;
    const existing = bucketMap.get(record.bucket) ?? [];
    existing.push(record);
    bucketMap.set(record.bucket, existing);
  }

  const sortedBuckets = [...bucketMap.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const lines = [
    '# Race Reconciliation Mechanic Buckets',
    '',
    'This report separates race mechanics by the capability-backed status Aralia can prove today. Keyword matches suggest a family, but implementation claims come from aralia-mechanic-capability-matrix.json.',
    '',
    '## Buckets By Status And Leverage',
    '',
  ];

  for (const [bucket, bucketRecords] of sortedBuckets) {
    const araliaRaceIds = [...new Set(bucketRecords.map((record) => record.araliaRaceId).filter(Boolean))].sort();
    const vendorExamples = [...new Set(bucketRecords.map((record) => record.vendorName).filter(Boolean))].slice(0, 6);
    const exampleTraits = [...new Set(bucketRecords.map((record) => record.traitName))].slice(0, 8);
    const nextStep = bucketRecords[0]?.recommendedNextStep ?? 'Review manually.';
    const supportCounts = countBy(bucketRecords.map((record) => record.support));

    lines.push(`### ${bucket}`);
    lines.push('');
    lines.push(`- Status counts: ${Object.entries(supportCounts).map(([support, count]) => `${support} ${count}`).join(', ')}`);
    lines.push(`- Records: ${bucketRecords.length}`);
    lines.push(`- Aralia races touched: ${araliaRaceIds.length}`);
    lines.push(`- Example Aralia race IDs: ${araliaRaceIds.slice(0, 10).join(', ') || 'none'}`);
    lines.push(`- Example vendor candidates: ${vendorExamples.join(', ') || 'none'}`);
    lines.push(`- Example traits: ${exampleTraits.join(', ')}`);
    lines.push(`- Recommended next step: ${nextStep}`);
    lines.push('');
  }

  lines.push('## Deferred Scope');
  lines.push('');
  lines.push('Blocked buckets need the engine/system family named in their records before race data should be migrated into structured runtime mechanics.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function buildCapabilityMatrixMarkdown(capabilities: RaceMechanicCapability[]): string {
  const lines = [
    '# Aralia Race Mechanic Capability Matrix',
    '',
    'This matrix records what Aralia can prove from current code paths. A race detail is only reported as enforced when a capability row names concrete enforcement code.',
    '',
  ];

  for (const capability of capabilities) {
    lines.push(`## ${capability.mechanicFamily}`);
    lines.push('');
    lines.push(`- Support status: ${capability.supportStatus}`);
    lines.push(`- Confidence: ${capability.confidence}`);
    lines.push(`- Data fields: ${capability.dataFields.join(', ') || 'none'}`);
    lines.push(`- Enforcement paths: ${capability.enforcementPaths.join(', ') || 'none'}`);
    lines.push(`- Display paths: ${capability.displayPaths.join(', ') || 'none'}`);
    lines.push(`- Example race IDs: ${capability.exampleRaceIds.join(', ') || 'none'}`);
    lines.push(`- Limitations: ${capability.limitations.join(' ')}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function buildImplementedMechanicsMarkdown(records: MechanicSupportRecord[]): string {
  const implemented = records
    .filter((record) => record.source === 'aralia' && record.support === 'enforced_now')
    .sort((a, b) => a.bucket.localeCompare(b.bucket) || (a.araliaRaceId ?? '').localeCompare(b.araliaRaceId ?? ''));

  const lines = [
    '# Implemented Race Mechanics',
    '',
    'This report lists race details that are implemented or normalized by existing Aralia systems and were reclassified through the capability matrix during this goal.',
    '',
    'No source race files were overwritten from 5etools. The implemented slice was report/classifier normalization: existing supported fields and trait-derived details are now separated from unsupported mechanics with code references.',
    '',
    '## Implemented Or Normalized Now',
    '',
  ];

  for (const record of implemented) {
    lines.push(`- ${record.araliaRaceId ?? 'vendor'} / ${record.traitName}: ${record.bucket}`);
    lines.push(`  - Representation: ${record.araliaCurrentRepresentation}`);
    lines.push(`  - Evidence: ${record.codeReferences.join(', ') || 'capability matrix entry'}`);
    lines.push(`  - Validation note: classified as enforced_now only through ${record.capability?.mechanicFamily ?? 'capability matrix'}.`);
  }

  if (implemented.length === 0) {
    lines.push('- No additional race mechanics were safe to implement with current systems.');
  }

  lines.push('');
  lines.push('## Why No Race Data Was Bulk Edited');
  lines.push('');
  lines.push('The current supported mechanics are already represented in existing Aralia fields or trait text that existing utilities consume. Adding new broad fields for unsupported mechanics would create fake implementation without engine support.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function ownerForBucket(bucket: string): string {
  if (bucket.includes('movement') || bucket.includes('teleport')) return 'movement/map systems';
  if (bucket.includes('spell')) return 'spellcasting and rest systems';
  if (bucket.includes('resistance') || bucket.includes('weapon') || bucket.includes('reaction') || bucket.includes('death')) return 'combat systems';
  if (bucket.includes('skill') || bucket.includes('proficiency')) return 'character creator and sheet systems';
  if (bucket.includes('environment')) return 'travel/rest/survival systems';
  if (bucket.includes('communication') || bucket.includes('disguise')) return 'dialogue/identity systems';
  if (bucket.includes('build')) return 'inventory/carrying capacity systems';
  return 'human design review';
}

function buildUnresolvedMechanicsMarkdown(records: MechanicSupportRecord[]): string {
  const unresolved = records
    .filter((record) => record.source === 'aralia' && (record.support === 'blocked_by_missing_mechanic_family' || record.support === 'ambiguous_requires_human_mapping'))
    .sort((a, b) => a.bucket.localeCompare(b.bucket) || (a.araliaRaceId ?? '').localeCompare(b.araliaRaceId ?? ''));

  const lines = [
    '# Unresolved Race Mechanics',
    '',
    'This report makes unsupported race details explicit instead of leaving them hidden as vague trait text.',
    '',
  ];

  const grouped = new Map<string, MechanicSupportRecord[]>();
  for (const record of unresolved) {
    const existing = grouped.get(record.bucket) ?? [];
    existing.push(record);
    grouped.set(record.bucket, existing);
  }

  for (const [bucket, bucketRecords] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    const raceIds = [...new Set(bucketRecords.map((record) => record.araliaRaceId).filter(Boolean))].sort();
    lines.push(`## ${bucket}`);
    lines.push('');
    lines.push(`- Records: ${bucketRecords.length}`);
    lines.push(`- Missing mechanic family: ${bucketRecords[0]?.capability?.mechanicFamily ?? bucket}`);
    lines.push(`- Suggested owner: ${ownerForBucket(bucket)}`);
    lines.push(`- Other races needing this family: ${raceIds.slice(0, 15).join(', ') || 'none'}`);
    lines.push(`- Why blocked: ${bucketRecords[0]?.recommendedNextStep ?? 'Manual mapping required.'}`);
    lines.push('- Examples:');
    for (const record of bucketRecords.slice(0, 12)) {
      lines.push(`  - ${record.araliaRaceId ?? record.vendorName ?? 'unknown'} / ${record.traitName} / ${record.araliaCurrentRepresentation}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function buildQualityNotesMarkdown(): string {
  return `# Race Reconciliation Quality Notes

## Corrections From The First Reconciliation Pass

- Breath Weapon was previously able to fall into weak keyword buckets such as weapon proficiency or environmental adaptation. It is now its own unsupported \`breath_weapon\` family because Aralia has no breath action, save DC, area, scaling, damage type, or rest-reset engine for it.
- Speed and darkvision are no longer marked implemented merely because their text contains those words. They are \`enforced_now\` only because the capability matrix cites character creation and rehydration code paths that consume them.
- Fixed skill proficiency is no longer treated as globally implemented from text alone. It is enforced only for the known hardcoded racial skill paths in character assembly and skill selection utilities.
- Tool, weapon, and language proficiencies are display-only until Race gains structured fields and validation/sheet code consumes them.
- Creature Type and Size are kept as display/lore identity text; they are not treated as creature communication mechanics.

## Remaining Weaknesses

- The classifier still uses text to suggest a mechanic family, so ambiguous traits remain human-review items.
- Vendor candidates are reference evidence only. They are not imported into Aralia race data.
- Some Aralia traits combine enforced and unsupported pieces in one sentence, such as walk speed plus swim speed. The report can classify the trait family, but future runtime data should split those details structurally.
`;
}

function buildSummaryMarkdown(
  araliaInventory: AraliaRaceInventoryRecord[],
  vendorInventory: VendorRaceInventoryRecord[],
  crosswalk: CrosswalkRecord[],
  mechanics: MechanicSupportRecord[],
): string {
  const statusCounts = countBy(crosswalk.map((record) => record.status));
  const supportCounts = countBy(mechanics.map((record) => record.support));
  const structuralWarnings = araliaInventory.flatMap((race) => race.structuralWarnings.map((warning) => `${race.id}: ${warning}`));
  const unsupportedBuckets = countBy(
    mechanics
      .filter((record) => record.support === 'blocked_by_missing_mechanic_family')
      .map((record) => record.bucket),
  );
  const topUnsupportedBuckets = Object.entries(unsupportedBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const lines = [
    '# Race Reconciliation Summary',
    '',
    '## Discovery Note',
    '',
    `- Aralia race source: src/data/races/*.ts loaded through scripts/load-race-data.ts.`,
    `- Glossary race display source: ${GLOSSARY_RACE_GLOB}.`,
    `- Vendored 5etools race corpus: ${path.relative(PROJECT_ROOT, VENDOR_RACES_PATH).replace(/\\/g, '/')}.`,
    `- Foundry supplement considered when present: ${path.relative(PROJECT_ROOT, VENDOR_FOUNDRY_RACES_PATH).replace(/\\/g, '/')}.`,
    '',
    '## What Exists',
    '',
    `- Aralia selectable race records inventoried: ${araliaInventory.length}.`,
    `- Vendor race/subrace/foundry records inventoried: ${vendorInventory.length}.`,
    `- Mechanics report records generated: ${mechanics.length}.`,
    '',
    '## Crosswalk Status',
    '',
    ...Object.entries(statusCounts).sort().map(([status, count]) => `- ${status}: ${count}`),
    '',
    '## Mechanic Support Status',
    '',
    ...Object.entries(supportCounts).sort().map(([support, count]) => `- ${support}: ${count}`),
    '',
    '## Highest-Leverage Unsupported Buckets',
    '',
    ...topUnsupportedBuckets.map(([bucket, count]) => `- ${bucket}: ${count} records`),
    '',
    '## Preserved Intent',
    '',
    '- No Aralia race TypeScript files were overwritten.',
    '- No glossary race JSON files were rewritten.',
    '- Aralia-specific IDs, reflavors, baseRace groupings, visual metadata, descriptions, and current trait text remain the reviewed source of truth.',
    '- 5etools data is used only as a local reference corpus with confidence-scored matches.',
    '',
    '## Uncertainty And Human Review',
    '',
    '- Medium/low confidence candidates remain ambiguous in the crosswalk.',
    '- Custom or reflavored Aralia IDs are marked as custom/reflavored instead of being forced onto vendor identities.',
    '- Source references in vendor data may be missing or may differ by edition/source; review before migration.',
    '- Vendor trait evidence is summarized by field and trait names to avoid copying large text.',
    '',
    '## Structural Warnings Detected',
    '',
    ...(structuralWarnings.length ? structuralWarnings.slice(0, 50).map((warning) => `- ${warning}`) : ['- None from the safe structural checks in this workflow.']),
    structuralWarnings.length > 50 ? `- ${structuralWarnings.length - 50} additional warnings are available in aralia-race-inventory.json.` : '',
    '',
    '## Recommended Next Project Prompt',
    '',
    'Create the first missing mechanic family from docs/reports/race-reconciliation/unresolved-race-mechanics.md, starting with damage_resistance or breath_weapon. Preserve existing TypeScript race data as the behavioral baseline, add validators that compare new structured data against current Race records, and do not migrate custom/reflavored races until their mappings are manually approved.',
    '',
    '## Progress Log',
    '',
    '- Checkpoint 1 Discovery: located Aralia race TypeScript files, glossary race JSON, existing race sync scripts, and vendor/5etools-src/data/races.json.',
    '- Checkpoint 2 Aralia inventory: generated aralia-race-inventory.json without changing race data.',
    '- Checkpoint 3 Vendor inventory: generated vendor-race-inventory.json with structural summaries and minimal text.',
    '- Checkpoint 4 Crosswalk: generated confidence-scored aralia-to-vendor-crosswalk.json.',
    '- Checkpoint 5 Mechanic support classifier: generated capability-backed mechanics-support-report.json.',
    '- Checkpoint 6 Overlap buckets: generated mechanic-buckets.md and unresolved-race-mechanics.md sorted by implementation family.',
    '- Checkpoint 7 Summary and next steps: generated this summary with preserved intent, uncertainty, and next prompt.',
    '',
  ].filter((line) => line !== '');

  return `${lines.join('\n')}\n`;
}

function buildReadmeMarkdown(): string {
  return `# Race Reconciliation Workflow

This folder contains generated reports that compare Aralia's implemented race data against the vendored 5etools race corpus.

The workflow is intentionally report-driven. It does not overwrite Aralia race files, bulk-convert vendor data, or remove glossary/display scaffolding.

## How To Run

\`\`\`bash
npx tsx scripts/raceReconciliationInventory.ts
\`\`\`

## Inputs

- \`src/data/races/*.ts\`: current Aralia race mechanics and descriptions.
- \`public/data/glossary/entries/races/**/*.json\`: race glossary/display entries.
- \`vendor/5etools-src/data/races.json\`: local 5etools race reference corpus.
- \`vendor/5etools-src/data/foundry-races.json\`: optional foundry supplement signals when present.

## Outputs

- \`aralia-race-inventory.json\`: implemented Aralia race records and safe structural warnings.
- \`vendor-race-inventory.json\`: summarized vendor race records with source/path references and short trait labels.
- \`aralia-to-vendor-crosswalk.json\`: candidate matches with confidence, scores, reasons, and review notes.
- \`mechanics-support-report.json\`: per-race/per-trait support bucket classifications.
- \`aralia-mechanic-capability-matrix.json\`: machine-readable support claims with code references.
- \`aralia-mechanic-capability-matrix.md\`: human-readable support claims with limitations.
- \`implemented-race-mechanics.md\`: details classified as enforced by current Aralia systems.
- \`unresolved-race-mechanics.md\`: blocked or ambiguous details grouped by missing family.
- \`reconciliation-quality-notes.md\`: known classifier repairs and remaining weak spots.
- \`mechanic-buckets.md\`: mechanics grouped by status and reusable family.
- \`reconciliation-summary.md\`: executive summary, uncertainty notes, preserved intent, and recommended next prompt.

## How To Interpret Confidence

- \`high\`: deterministic name or ID match plus supporting mechanical overlap such as speed, darkvision, or trait names.
- \`medium\`: useful candidate, but not enough evidence for automated migration.
- \`low\`: weak candidate retained for human review.

## Support Buckets

- \`enforced_now\`: Aralia has a concrete code path that consumes this mechanic.
- \`represented_not_enforced\`: Aralia stores or validates part of the mechanic, but gameplay does not fully consume it.
- \`blocked_by_missing_mechanic_family\`: repeated mechanic that needs a reusable system before migration.
- \`ambiguous_requires_human_mapping\`: unclear behavior or mapping that needs review.
- \`display_lore_only\`: useful descriptive material without current gameplay enforcement.

## Progress Log

- Discovery confirmed existing race sync tooling and the vendor corpus path.
- The workflow generates all reports locally from current repo data.
- Focused validation commands and any blockers should be recorded in \`reconciliation-summary.md\` by the agent running the workflow.
`;
}

// ============================================================================
// Main Workflow
// ============================================================================
// The main command ties the inventories, crosswalk, classifier, and markdown
// reports together. It is isolated here so tests can import helpers without
// generating files as a side effect.
// ============================================================================

export async function runRaceReconciliationWorkflow(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const araliaInventory = await loadAraliaInventory();
  const vendorInventory = loadVendorInventory();
  const crosswalk = buildCrosswalk(araliaInventory, vendorInventory);
  const mechanics = buildMechanicsReport(araliaInventory, vendorInventory, crosswalk);

  writeJsonReport('aralia-race-inventory.json', araliaInventory);
  writeJsonReport('vendor-race-inventory.json', vendorInventory);
  writeJsonReport('aralia-to-vendor-crosswalk.json', crosswalk);
  writeJsonReport('mechanics-support-report.json', mechanics);
  writeJsonReport('aralia-mechanic-capability-matrix.json', DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX);

  fs.writeFileSync(path.join(REPORT_DIR, 'aralia-mechanic-capability-matrix.md'), buildCapabilityMatrixMarkdown(DEFAULT_RACE_MECHANIC_CAPABILITY_MATRIX), 'utf-8');
  fs.writeFileSync(path.join(REPORT_DIR, 'implemented-race-mechanics.md'), buildImplementedMechanicsMarkdown(mechanics), 'utf-8');
  fs.writeFileSync(path.join(REPORT_DIR, 'unresolved-race-mechanics.md'), buildUnresolvedMechanicsMarkdown(mechanics), 'utf-8');
  fs.writeFileSync(path.join(REPORT_DIR, 'reconciliation-quality-notes.md'), buildQualityNotesMarkdown(), 'utf-8');
  fs.writeFileSync(path.join(REPORT_DIR, 'mechanic-buckets.md'), buildMechanicBucketsMarkdown(mechanics), 'utf-8');
  fs.writeFileSync(path.join(REPORT_DIR, 'reconciliation-summary.md'), buildSummaryMarkdown(araliaInventory, vendorInventory, crosswalk, mechanics), 'utf-8');
  fs.writeFileSync(path.join(REPORT_DIR, 'README.md'), buildReadmeMarkdown(), 'utf-8');

  console.log(`Race reconciliation reports written to ${path.relative(PROJECT_ROOT, REPORT_DIR)}`);
  console.log(`Aralia races: ${araliaInventory.length}`);
  console.log(`Vendor records: ${vendorInventory.length}`);
  console.log(`Mechanic records: ${mechanics.length}`);
}

const thisFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFilePath === thisFilePath) {
  runRaceReconciliationWorkflow().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
