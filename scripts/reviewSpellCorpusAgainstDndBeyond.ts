import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This script compares the full local spell corpus against the public D&D Beyond spell corpus.
 *
 * The spell-truth lane has already proven that local JSON can be structurally valid while still
 * drifting from canonical top-level spell facts. This file exists to scale that check from a
 * hand-reviewed 23-spell batch to the full corpus. It fetches the official listing/detail pages,
 * maps them onto the local spell JSON files, reports drift in grouped families, and can apply the
 * safest top-level fixes back into the repo when the owner wants execution instead of just review.
 *
 * Called by: `npx tsx scripts/reviewSpellCorpusAgainstDndBeyond.ts [--apply]`
 * Depends on:
 * - `public/data/spells/**`
 * - `docs/spells/reference/**`
 * - public D&D Beyond spell listing/detail pages
 */

// ============================================================================
// Paths and constants
// ============================================================================
// This section keeps the file self-contained and makes the output locations
// stable. The JSON artifact is a machine-readable corpus snapshot, while the
// Markdown report is the human review surface for grouped mismatch families.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_JSON_ROOT = path.resolve(REPO_ROOT, 'public', 'data', 'spells');
const SPELL_MARKDOWN_ROOT = path.resolve(REPO_ROOT, 'docs', 'spells', 'reference');
const JSON_OUT = path.resolve(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-corpus-dndbeyond-report.json');
const MD_OUT = path.resolve(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_CORPUS_DNDBEYOND_REPORT.md');
const DND_BEYOND_ROOT = 'https://www.dndbeyond.com';
const BASE_CLASS_NAMES = new Set([
  'Artificer',
  'Bard',
  'Cleric',
  'Druid',
  'Fighter',
  'Monk',
  'Paladin',
  'Ranger',
  'Rogue',
  'Sorcerer',
  'Warlock',
  'Wizard',
]);
const TOP_LEVEL_FIELD_GROUPS: string[][] = [
  ['Level', 'School', 'Ritual', 'Classes', 'Sub-Classes'],
  ['Casting Time Value', 'Casting Time Unit', 'Combat Cost', 'Reaction Trigger'],
  ['Range Type', 'Range Distance', 'Targeting Type', 'Targeting Max', 'Valid Targets', 'Target Filter Creature Types', 'Line of Sight'],
  ['Verbal', 'Somatic', 'Material', 'Material Description', 'Material Cost GP', 'Consumed'],
  ['Duration Type', 'Duration Value', 'Duration Unit', 'Concentration'],
];
const MANAGED_MARKDOWN_FIELDS = new Set(TOP_LEVEL_FIELD_GROUPS.flat());

interface LocalSpellRecord {
  id: string;
  name: string;
  level: number;
  legacy: boolean;
  jsonPath: string;
  markdownPath: string;
  data: Record<string, unknown>;
}

interface DndBeyondListingEntry {
  slug: string;
  urlPath: string;
  name: string;
  level: number;
  legacy: boolean;
}

interface DndBeyondDetailRecord {
  url: string;
  name: string;
  level: number;
  legacy: boolean;
  listingSlug: string;
  school: string;
  castingTime: string;
  rangeArea: string;
  components: string;
  duration: string;
  attackSave: string;
  damageEffect: string;
  availableFor: string[];
  sourceText: string;
  hasUsableTopLevelFields: boolean;
}

interface CanonicalClassAccess {
  classes: string[];
  subClasses: string[];
}

interface ParsedCastingTime {
  value: number;
  unit: 'action' | 'bonus_action' | 'reaction' | 'minute' | 'hour' | 'special';
  combatCostType?: 'action' | 'bonus_action' | 'reaction';
}

interface ParsedRange {
  type: 'self' | 'touch' | 'ranged' | 'special';
  distance: number;
  areaSize?: number;
}

interface ParsedDuration {
  type: 'instantaneous' | 'timed' | 'special' | 'until_dispelled' | 'until_dispelled_or_triggered';
  value: number;
  unit: 'round' | 'minute' | 'hour' | 'day';
  concentration: boolean;
}

type CanonicalMismatchField =
  | 'listing match'
  | 'detail fetch incomplete'
  | 'school'
  | 'casting time'
  | 'range/area'
  | 'components'
  | 'duration'
  | 'classes'
  | 'subClasses'
  | 'subClassesVerification';

interface CanonicalMismatch {
  spellId: string;
  spellName: string;
  level: number;
  field: CanonicalMismatchField;
  summary: string;
  localValue: string;
  canonicalValue: string;
}

interface SpellCanonicalReview {
  spellId: string;
  spellName: string;
  level: number;
  jsonPath: string;
  markdownPath: string;
  matchedListing: boolean;
  listingUrl: string;
  mismatches: CanonicalMismatch[];
}

interface CanonicalReviewReport {
  generatedAt: string;
  localSpellCount: number;
  listingEntryCount: number;
  matchedSpellCount: number;
  unmatchedSpellCount: number;
  mismatchCount: number;
  spellResults: SpellCanonicalReview[];
  groupedMismatches: Array<{
    groupKey: string;
    field: CanonicalMismatchField;
    count: number;
    spellIds: string[];
    sampleSummaries: string[];
  }>;
}

function decodeHtmlEntities(value: string): string {
  const numericDecoded = value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return numericDecoded
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&bull;/g, '*')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNameKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeComparableText(value: string): string {
  return value
    .replace(/\s+\(\s*/g, ' (')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

function listLocalSpells(): LocalSpellRecord[] {
  const spells: LocalSpellRecord[] = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelFolder = `level-${level}`;
    const jsonDir = path.join(SPELL_JSON_ROOT, levelFolder);
    const markdownDir = path.join(SPELL_MARKDOWN_ROOT, levelFolder);
    if (!fs.existsSync(jsonDir)) continue;

    const files = fs.readdirSync(jsonDir)
      .filter((file) => file.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const jsonPath = path.join(jsonDir, file);
      const markdownPath = path.join(markdownDir, file.replace(/\.json$/i, '.md'));
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;

      spells.push({
        id: typeof data.id === 'string' ? data.id : path.basename(file, '.json'),
        name: typeof data.name === 'string' ? data.name : path.basename(file, '.json'),
        level: typeof data.level === 'number' ? data.level : level,
        legacy: data.legacy === true,
        jsonPath,
        markdownPath,
        data,
      });
    }
  }

  return spells;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; Aralia spell truth auditor)',
      'accept-language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

function parseLevelText(value: string): number {
  const trimmed = normalizeComparableText(value);
  if (/^cantrip$/i.test(trimmed)) return 0;
  const numericMatch = trimmed.match(/^(\d+)/);
  return numericMatch ? Number(numericMatch[1]) : -1;
}

function parseDndBeyondPageCount(pageHtml: string): number {
  const pageNumbers = Array.from(pageHtml.matchAll(/\/spells\?page=(\d+)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
}

function parseListingEntries(pageHtml: string): DndBeyondListingEntry[] {
  const entries: DndBeyondListingEntry[] = [];
  const blocks = pageHtml.split('<div class="info"').slice(1);

  for (const rawBlock of blocks) {
    const block = `<div class="info"${rawBlock}`;
    if (!block.includes('data-type="spells"')) continue;

    const slugMatch = block.match(/data-slug="([^"]+)"/);
    const levelMatch = block.match(/<div class="row spell-level">[\s\S]*?<span>([^<]+)<\/span>/);
    const linkMatch = block.match(/<a href="([^"]+)" class="link">([^<]+)<\/a>/);
    if (!slugMatch || !levelMatch || !linkMatch) continue;

    entries.push({
      slug: slugMatch[1],
      urlPath: decodeHtmlEntities(linkMatch[1]),
      name: stripHtml(linkMatch[2]),
      level: parseLevelText(levelMatch[1]),
      legacy: block.includes('legacy-badge'),
    });
  }

  return entries;
}

async function fetchListingEntries(): Promise<DndBeyondListingEntry[]> {
  const firstPageHtml = await fetchText(`${DND_BEYOND_ROOT}/spells`);
  const maxPage = parseDndBeyondPageCount(firstPageHtml);
  const entries = [...parseListingEntries(firstPageHtml)];

  for (let page = 2; page <= maxPage; page += 1) {
    const pageHtml = await fetchText(`${DND_BEYOND_ROOT}/spells?page=${page}`);
    entries.push(...parseListingEntries(pageHtml));
  }

  return entries;
}

function extractStatblockValue(detailHtml: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = detailHtml.match(new RegExp(`ddb-statblock-item-${escapedKey}[\\s\\S]*?<div class="ddb-statblock-item-value">([\\s\\S]*?)<\\/div>`, 'i'));
  return match ? normalizeComparableText(stripHtml(match[1])) : '';
}

function parseAvailableFor(detailHtml: string): string[] {
  const sectionMatch = detailHtml.match(/<p class="tags available-for">Available For:([\s\S]*?)<\/p>/i);
  if (!sectionMatch) return [];

  return Array.from(sectionMatch[1].matchAll(/<span class="tag class-tag">([^<]+)<\/span>/gi))
    .map((match) => normalizeComparableText(stripHtml(match[1])))
    .filter(Boolean);
}

function parseSourceText(detailHtml: string): string {
  const match = detailHtml.match(/<p class="source spell-source">\s*([\s\S]*?)\s*<\/p>/i);
  return match ? normalizeComparableText(stripHtml(match[1])) : '';
}

async function fetchDetailRecord(entry: DndBeyondListingEntry): Promise<DndBeyondDetailRecord> {
  const url = `${DND_BEYOND_ROOT}${entry.urlPath}`;
  const html = await fetchText(url);

  const school = extractStatblockValue(html, 'school');
  const castingTime = extractStatblockValue(html, 'casting-time');
  const rangeArea = extractStatblockValue(html, 'range-area');
  const components = extractStatblockValue(html, 'components');
  const duration = extractStatblockValue(html, 'duration');
  const attackSave = extractStatblockValue(html, 'attack-save');
  const damageEffect = extractStatblockValue(html, 'damage-effect');
  const availableFor = parseAvailableFor(html);
  const sourceText = parseSourceText(html);
  const hasUsableTopLevelFields = [
    school,
    castingTime,
    rangeArea,
    components,
    duration,
    attackSave,
    damageEffect,
    sourceText,
  ].some(Boolean) || availableFor.length > 0;

  return {
    url,
    name: entry.name,
    level: entry.level,
    legacy: entry.legacy,
    listingSlug: entry.slug,
    school,
    castingTime,
    rangeArea,
    components,
    duration,
    attackSave,
    damageEffect,
    availableFor,
    sourceText,
    hasUsableTopLevelFields,
  };
}

function parseCanonicalClassAccess(availableFor: string[]): CanonicalClassAccess {
  const classes = new Set<string>();
  const subClasses = new Set<string>();

  for (const rawEntry of availableFor) {
    const withoutLegacy = rawEntry.replace(/\s+\(Legacy\)$/i, '').trim();
    if (!withoutLegacy) continue;

    if (BASE_CLASS_NAMES.has(withoutLegacy)) {
      classes.add(withoutLegacy);
      continue;
    }

    const bracketMatch = withoutLegacy.match(/^([^()]+?)\s*\((.+)\)$/);
    if (bracketMatch) {
      const possibleBase = bracketMatch[1].trim();
      const possibleSubclass = bracketMatch[2].trim();
      if (BASE_CLASS_NAMES.has(possibleBase)) {
        subClasses.add(`${possibleBase} - ${possibleSubclass}`);
        continue;
      }
    }

    const dashMatch = withoutLegacy.match(/^([A-Za-z]+)\s*-\s*(.+)$/);
    if (dashMatch && BASE_CLASS_NAMES.has(dashMatch[1])) {
      subClasses.add(`${dashMatch[1]} - ${dashMatch[2].trim()}`);
      continue;
    }

    const possibleBase = Array.from(BASE_CLASS_NAMES).find((baseClass) => withoutLegacy.startsWith(`${baseClass} `));
    if (possibleBase) {
      const subclassName = withoutLegacy.slice(possibleBase.length).trim().replace(/^[\-–—:]\s*/, '');
      if (subclassName.length > 0) {
        subClasses.add(`${possibleBase} - ${subclassName}`);
        continue;
      }
    }

    // DEBT: D&D Beyond can surface class-access formats that do not fit the simple
    // base-class-or-parenthetical-subclass shapes seen in the current corpus. When
    // that happens, keep the raw value visible in the subclass lane instead of
    // discarding it, because preserving the unresolved access string is safer than
    // pretending no subclass access exists.
    subClasses.add(withoutLegacy);
  }

  return {
    classes: Array.from(classes).sort(),
    subClasses: Array.from(subClasses).sort(),
  };
}

function normalizeLocalClasses(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean).sort() : [];
}

function buildLocalComponentSummary(spell: Record<string, unknown>): string {
  const components = (spell.components ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  if (components.verbal === true) parts.push('V');
  if (components.somatic === true) parts.push('S');
  if (components.material === true) {
    let materialText = 'M';
    if (typeof components.materialDescription === 'string' && components.materialDescription.trim().length > 0) {
      materialText += ' *';
    }
    parts.push(materialText);
  }

  return parts.join(', ');
}

function buildLocalCastingTimeSummary(spell: Record<string, unknown>): string {
  const castingTime = (spell.castingTime ?? {}) as Record<string, unknown>;
  const value = typeof castingTime.value === 'number' ? castingTime.value : 0;
  const unit = typeof castingTime.unit === 'string' ? castingTime.unit : '';

  switch (unit) {
    case 'action':
      return `${value} Action`;
    case 'bonus_action':
      return `${value} Bonus Action`;
    case 'reaction':
      return `${value} Reaction`;
    case 'minute':
      return `${value} ${value === 1 ? 'Minute' : 'Minutes'}`;
    case 'hour':
      return `${value} ${value === 1 ? 'Hour' : 'Hours'}`;
    default:
      return 'Special';
  }
}

function buildLocalRangeSummary(spell: Record<string, unknown>): string {
  const range = (spell.range ?? {}) as Record<string, unknown>;
  const targeting = (spell.targeting ?? {}) as Record<string, unknown>;
  const aoe = (targeting.areaOfEffect ?? {}) as Record<string, unknown>;

  const rangeType = typeof range.type === 'string' ? range.type : 'special';
  const rangeDistance = typeof range.distance === 'number' ? range.distance : 0;
  const areaSize = typeof aoe.size === 'number' && aoe.size > 0 ? aoe.size : 0;

  let base = 'Special';
  if (rangeType === 'self') base = 'Self';
  else if (rangeType === 'touch') base = 'Touch';
  else if (rangeType === 'ranged') base = `${rangeDistance} ft.`;

  if (areaSize > 0) {
    base += ` (${areaSize} ft.)`;
  }

  return base;
}

function buildLocalDurationSummary(spell: Record<string, unknown>): string {
  const duration = (spell.duration ?? {}) as Record<string, unknown>;
  const type = typeof duration.type === 'string' ? duration.type : 'special';
  const value = typeof duration.value === 'number' ? duration.value : 0;
  const unit = typeof duration.unit === 'string' ? duration.unit : 'round';
  const concentration = duration.concentration === true;

  let base = 'Special';
  if (type === 'instantaneous') base = 'Instantaneous';
  else if (type === 'timed') {
    const unitLabel = unit === 'hour'
      ? (value === 1 ? 'Hour' : 'Hours')
      : unit === 'minute'
        ? (value === 1 ? 'Minute' : 'Minutes')
        : unit === 'day'
          ? (value === 1 ? 'Day' : 'Days')
          : (value === 1 ? 'Round' : 'Rounds');
    base = `${value} ${unitLabel}`;
  } else if (type === 'until_dispelled') {
    base = 'Until Dispelled';
  } else if (type === 'until_dispelled_or_triggered') {
    base = 'Until Dispelled or Triggered';
  }

  return concentration ? `Concentration ${base}` : base;
}

function parseCanonicalCastingTime(value: string): ParsedCastingTime | null {
  const normalized = normalizeComparableText(value).replace(/\s*\*$/, '');
  const match = normalized.match(/^(\d+)\s+(.+)$/);
  if (!match) return normalized === 'Special' ? { value: 0, unit: 'special' } : null;

  const numericValue = Number(match[1]);
  const unitText = match[2].toLowerCase();

  if (unitText.startsWith('action')) {
    return { value: numericValue, unit: 'action', combatCostType: 'action' };
  }
  if (unitText.startsWith('bonus action')) {
    return { value: numericValue, unit: 'bonus_action', combatCostType: 'bonus_action' };
  }
  if (unitText.startsWith('reaction')) {
    return { value: numericValue, unit: 'reaction', combatCostType: 'reaction' };
  }
  if (unitText.startsWith('minute')) {
    return { value: numericValue, unit: 'minute' };
  }
  if (unitText.startsWith('hour')) {
    return { value: numericValue, unit: 'hour' };
  }

  return normalized === 'Special' ? { value: 0, unit: 'special' } : null;
}

function parseCanonicalRange(value: string): ParsedRange | null {
  const normalized = normalizeComparableText(value);
  if (!normalized) return null;
  if (/^self/i.test(normalized)) {
    const areaMatch = normalized.match(/\((\d+)\s*ft\./i);
    return { type: 'self', distance: 0, areaSize: areaMatch ? Number(areaMatch[1]) : undefined };
  }
  if (/^touch/i.test(normalized)) {
    return { type: 'touch', distance: 0 };
  }
  if (/^special/i.test(normalized)) {
    return { type: 'special', distance: 0 };
  }

  const rangeMatch = normalized.match(/^(\d+)\s*ft\./i);
  if (rangeMatch) {
    const areaMatch = normalized.match(/\((\d+)\s*ft\./i);
    return {
      type: 'ranged',
      distance: Number(rangeMatch[1]),
      areaSize: areaMatch ? Number(areaMatch[1]) : undefined,
    };
  }

  return null;
}

function parseCanonicalDuration(value: string): ParsedDuration | null {
  const normalized = normalizeComparableText(value);
  if (!normalized) return null;

  if (/^instantaneous$/i.test(normalized)) {
    return { type: 'instantaneous', value: 0, unit: 'round', concentration: false };
  }
  if (/^until dispelled or triggered$/i.test(normalized)) {
    return { type: 'until_dispelled_or_triggered', value: 0, unit: 'round', concentration: false };
  }
  if (/^until dispelled$/i.test(normalized)) {
    return { type: 'until_dispelled', value: 0, unit: 'round', concentration: false };
  }
  if (/^special$/i.test(normalized)) {
    return { type: 'special', value: 0, unit: 'round', concentration: false };
  }

  const withoutUpTo = normalized.replace(/^Up to\s+/i, '');
  const concentration = /^Concentration\s+/i.test(withoutUpTo);
  const timedText = withoutUpTo.replace(/^Concentration\s+/i, '');
  const match = timedText.match(/^(\d+)\s+(Round|Rounds|Minute|Minutes|Hour|Hours|Day|Days)$/i);
  if (!match) return null;

  const numericValue = Number(match[1]);
  const unitText = match[2].toLowerCase();
  const unit = unitText.startsWith('round')
    ? 'round'
    : unitText.startsWith('minute')
      ? 'minute'
      : unitText.startsWith('hour')
        ? 'hour'
        : 'day';

  return {
    type: 'timed',
    value: numericValue,
    unit,
    concentration,
  };
}

function normalizeComponentsComparable(value: string): string {
  return value.replace(/\s*\*$/, '').trim();
}

function normalizeBoolean(value: unknown): string {
  return value ? 'true' : 'false';
}

function normalizeOptionalList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return 'None';
  return value.map((entry) => String(entry)).join(', ');
}

function normalizeList(value: unknown): string {
  return Array.isArray(value) ? value.map((entry) => String(entry)).join(', ') : '';
}

function buildTopLevelStructuredFields(spell: Record<string, unknown>): Map<string, string> {
  const fields = new Map<string, string>();
  const castingTime = (spell.castingTime ?? {}) as Record<string, unknown>;
  const range = (spell.range ?? {}) as Record<string, unknown>;
  const targeting = (spell.targeting ?? {}) as Record<string, unknown>;
  const filter = (targeting.filter ?? {}) as Record<string, unknown>;
  const components = (spell.components ?? {}) as Record<string, unknown>;
  const duration = (spell.duration ?? {}) as Record<string, unknown>;

  fields.set('Level', typeof spell.level === 'number' ? String(spell.level) : '');
  fields.set('School', typeof spell.school === 'string' ? String(spell.school) : '');
  fields.set('Ritual', normalizeBoolean(spell.ritual));
  fields.set('Classes', normalizeList(spell.classes));
  fields.set('Sub-Classes', normalizeOptionalList(spell.subClasses));

  fields.set('Casting Time Value', typeof castingTime.value === 'number' ? String(castingTime.value) : '');
  fields.set('Casting Time Unit', typeof castingTime.unit === 'string' ? castingTime.unit : '');
  const combatCost = (castingTime.combatCost ?? {}) as Record<string, unknown>;
  fields.set('Combat Cost', typeof combatCost.type === 'string' ? combatCost.type : '');
  if (typeof combatCost.condition === 'string' && combatCost.condition.trim().length > 0) {
    fields.set('Reaction Trigger', combatCost.condition);
  }

  fields.set('Range Type', typeof range.type === 'string' ? range.type : '');
  if (typeof range.distance === 'number' && (range.type === 'ranged' || range.distance > 0)) {
    fields.set('Range Distance', String(range.distance));
  }
  fields.set('Targeting Type', typeof targeting.type === 'string' ? targeting.type : '');
  if (typeof targeting.maxTargets === 'number' && targeting.maxTargets > 1) {
    fields.set('Targeting Max', String(targeting.maxTargets));
  }
  fields.set('Valid Targets', normalizeList(targeting.validTargets));
  if (Array.isArray(filter.creatureTypes) && filter.creatureTypes.length > 0) {
    fields.set('Target Filter Creature Types', normalizeList(filter.creatureTypes));
  }
  fields.set('Line of Sight', normalizeBoolean(targeting.lineOfSight));

  fields.set('Verbal', normalizeBoolean(components.verbal));
  fields.set('Somatic', normalizeBoolean(components.somatic));
  fields.set('Material', normalizeBoolean(components.material));
  if (typeof components.materialDescription === 'string' && components.materialDescription.trim().length > 0) {
    fields.set('Material Description', components.materialDescription);
  }
  if (typeof components.materialCost === 'number' && components.materialCost > 0) {
    fields.set('Material Cost GP', String(components.materialCost));
  }
  if (components.isConsumed === true) {
    fields.set('Consumed', 'true');
  }

  fields.set('Duration Type', typeof duration.type === 'string' ? duration.type : '');
  if (typeof duration.value === 'number' && duration.value > 0) {
    fields.set('Duration Value', String(duration.value));
  }
  if (typeof duration.unit === 'string' && typeof duration.value === 'number' && duration.value > 0) {
    fields.set('Duration Unit', duration.unit);
  }
  fields.set('Concentration', normalizeBoolean(duration.concentration));

  return fields;
}

function patchMarkdownTopLevelFields(markdownPath: string, spell: Record<string, unknown>): void {
  const structuredFields = buildTopLevelStructuredFields(spell);
  const existingContent = fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, 'utf8') : '';
  const existingLines = existingContent.length > 0 ? existingContent.split(/\r?\n/) : [];
  const headingLine = existingLines.find((line) => line.startsWith('# ')) ?? `# ${String(spell.name ?? path.basename(markdownPath, '.md'))}`;
  const unmanagedLines = existingLines
    .filter((line) => !line.startsWith('# '))
    .filter((line) => {
      const match = line.match(/^- \*\*(.+?)\*\*:\s*(.*)$/);
      if (!match) return true;
      return !MANAGED_MARKDOWN_FIELDS.has(match[1].trim());
    })
    .join('\n')
    .trim();

  const managedLines: string[] = [];
  for (const group of TOP_LEVEL_FIELD_GROUPS) {
    const groupLines = group
      .filter((fieldName) => structuredFields.has(fieldName))
      .map((fieldName) => `- **${fieldName}**: ${structuredFields.get(fieldName) ?? ''}`);
    if (groupLines.length > 0) {
      managedLines.push(...groupLines, '');
    }
  }

  const nextLines = [headingLine, '', ...managedLines];
  if (unmanagedLines.length > 0) {
    nextLines.push(unmanagedLines);
  }

  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.writeFileSync(markdownPath, `${nextLines.join('\n').trimEnd()}\n`, 'utf8');
}

function pickListingEntry(spell: LocalSpellRecord, entries: DndBeyondListingEntry[]): DndBeyondListingEntry | null {
  const desiredKey = normalizeNameKey(spell.name);
  const exact = entries.filter((entry) =>
    entry.level === spell.level &&
    entry.legacy === spell.legacy &&
    normalizeNameKey(entry.name) === desiredKey,
  );
  if (exact.length === 1) return exact[0];

  const levelOnly = entries.filter((entry) =>
    entry.level === spell.level &&
    normalizeNameKey(entry.name) === desiredKey,
  );
  if (levelOnly.length === 1) return levelOnly[0];

  const fuzzy = entries.filter((entry) => normalizeNameKey(entry.name) === desiredKey);
  if (fuzzy.length === 1) return fuzzy[0];

  return null;
}

function buildMismatch(
  spell: LocalSpellRecord,
  field: CanonicalMismatchField,
  localValue: string,
  canonicalValue: string,
  summary: string,
): CanonicalMismatch {
  return {
    spellId: spell.id,
    spellName: spell.name,
    level: spell.level,
    field,
    summary,
    localValue,
    canonicalValue,
  };
}

function compareSpellToCanonical(
  spell: LocalSpellRecord,
  detail: DndBeyondDetailRecord,
  canonicalClassAccess: CanonicalClassAccess,
): CanonicalMismatch[] {
  const mismatches: CanonicalMismatch[] = [];

  // Some D&D Beyond URLs resolve cleanly in the authenticated browser but return
  // a marketplace shell or blank statblock through raw HTTP fetch. Those pages
  // are weak evidence, so report them separately instead of counting empty
  // canonical fields as proof that the local corpus is wrong.
  if (!detail.hasUsableTopLevelFields) {
    mismatches.push(buildMismatch(
      spell,
      'detail fetch incomplete',
      'local data available',
      'public detail fields unavailable',
      `${spell.name} matched a D&D Beyond listing row, but the fetched public detail page did not expose usable top-level spell fields for comparison.`,
    ));
    return mismatches;
  }

  const localClasses = normalizeLocalClasses(spell.data.classes);
  const localSubClasses = normalizeLocalClasses(spell.data.subClasses);
  const localSubClassesVerification = typeof spell.data.subClassesVerification === 'string'
    ? String(spell.data.subClassesVerification)
    : 'missing';
  const localSchool = typeof spell.data.school === 'string' ? spell.data.school : '';
  const localCastingTime = buildLocalCastingTimeSummary(spell.data);
  const localRange = buildLocalRangeSummary(spell.data);
  const localComponents = buildLocalComponentSummary(spell.data);
  const localDuration = buildLocalDurationSummary(spell.data);

  if (detail.school && localSchool !== detail.school) {
    mismatches.push(buildMismatch(spell, 'school', localSchool, detail.school, `${spell.name} stores school as "${localSchool}" locally but D&D Beyond lists "${detail.school}".`));
  }
  if (detail.castingTime && normalizeComparableText(localCastingTime) !== normalizeComparableText(detail.castingTime.replace(/\s*\*$/, ''))) {
    mismatches.push(buildMismatch(spell, 'casting time', localCastingTime, detail.castingTime, `${spell.name} stores casting time as "${localCastingTime}" locally but D&D Beyond lists "${detail.castingTime}".`));
  }
  if (detail.rangeArea && normalizeComparableText(localRange) !== normalizeComparableText(detail.rangeArea)) {
    mismatches.push(buildMismatch(spell, 'range/area', localRange, detail.rangeArea, `${spell.name} stores range/area as "${localRange}" locally but D&D Beyond lists "${detail.rangeArea}".`));
  }
  if (detail.components && normalizeComponentsComparable(localComponents) !== normalizeComponentsComparable(detail.components)) {
    mismatches.push(buildMismatch(spell, 'components', localComponents, detail.components, `${spell.name} stores components as "${localComponents}" locally but D&D Beyond lists "${detail.components}".`));
  }
  if (detail.duration && normalizeComparableText(localDuration) !== normalizeComparableText(detail.duration)) {
    mismatches.push(buildMismatch(spell, 'duration', localDuration, detail.duration, `${spell.name} stores duration as "${localDuration}" locally but D&D Beyond lists "${detail.duration}".`));
  }
  if (detail.availableFor.length > 0 && JSON.stringify(localClasses) !== JSON.stringify(canonicalClassAccess.classes)) {
    mismatches.push(buildMismatch(spell, 'classes', localClasses.join(', ') || 'None', canonicalClassAccess.classes.join(', ') || 'None', `${spell.name} stores base class access as "${localClasses.join(', ') || 'None'}" locally but D&D Beyond exposes "${canonicalClassAccess.classes.join(', ') || 'None'}".`));
  }
  if (detail.availableFor.length > 0 && JSON.stringify(localSubClasses) !== JSON.stringify(canonicalClassAccess.subClasses)) {
    mismatches.push(buildMismatch(spell, 'subClasses', localSubClasses.join(', ') || 'None', canonicalClassAccess.subClasses.join(', ') || 'None', `${spell.name} stores subclass/domain access as "${localSubClasses.join(', ') || 'None'}" locally but D&D Beyond exposes "${canonicalClassAccess.subClasses.join(', ') || 'None'}".`));
  }
  if (detail.availableFor.length > 0 && localSubClassesVerification !== 'verified') {
    mismatches.push(buildMismatch(spell, 'subClassesVerification', localSubClassesVerification, 'verified', `${spell.name} still marks subclass/domain access as "${localSubClassesVerification}" locally even though this D&D Beyond pass verified the visible class-access surface.`));
  }

  return mismatches;
}

function applyCanonicalFixes(
  spell: LocalSpellRecord,
  detail: DndBeyondDetailRecord,
  canonicalClassAccess: CanonicalClassAccess,
): void {
  const parsedCastingTime = parseCanonicalCastingTime(detail.castingTime);
  const parsedRange = parseCanonicalRange(detail.rangeArea);
  const parsedDuration = parseCanonicalDuration(detail.duration);
  const local = spell.data;

  if (detail.school) {
    local.school = detail.school;
  }
  if (detail.availableFor.length > 0) {
    local.classes = canonicalClassAccess.classes;
    local.subClasses = canonicalClassAccess.subClasses;
    local.subClassesVerification = 'verified';
  }

  const components = (local.components ?? {}) as Record<string, unknown>;
  const componentSummary = detail.components;
  if (componentSummary) {
    const hasVerbal = /\bV\b/.test(componentSummary);
    const hasSomatic = /\bS\b/.test(componentSummary);
    const hasMaterial = /\bM\b/.test(componentSummary);
    components.verbal = hasVerbal;
    components.somatic = hasSomatic;
    components.material = hasMaterial;
    if (!hasMaterial) {
      components.materialDescription = '';
      components.materialCost = 0;
      components.isConsumed = false;
    }
    local.components = components;
  }

  if (detail.castingTime && parsedCastingTime) {
    const castingTime = (local.castingTime ?? {}) as Record<string, unknown>;
    const combatCost = (castingTime.combatCost ?? {}) as Record<string, unknown>;
    castingTime.value = parsedCastingTime.value;
    castingTime.unit = parsedCastingTime.unit;
    if (parsedCastingTime.combatCostType) {
      combatCost.type = parsedCastingTime.combatCostType;
    }
    if (typeof combatCost.condition !== 'string') {
      combatCost.condition = '';
    }
    castingTime.combatCost = combatCost;
    const explorationCost = (castingTime.explorationCost ?? {}) as Record<string, unknown>;
    if (typeof explorationCost.value !== 'number') explorationCost.value = 0;
    if (typeof explorationCost.unit !== 'string') explorationCost.unit = 'minute';
    castingTime.explorationCost = explorationCost;
    local.castingTime = castingTime;
  }

  if (detail.rangeArea && parsedRange) {
    const range = (local.range ?? {}) as Record<string, unknown>;
    range.type = parsedRange.type;
    range.distance = parsedRange.distance;
    local.range = range;

    const targeting = (local.targeting ?? {}) as Record<string, unknown>;
    const areaOfEffect = (targeting.areaOfEffect ?? {}) as Record<string, unknown>;
    if (parsedRange.areaSize !== undefined) {
      areaOfEffect.size = parsedRange.areaSize;
    }
    if (typeof areaOfEffect.shape !== 'string') areaOfEffect.shape = 'Sphere';
    if (typeof areaOfEffect.height !== 'number') areaOfEffect.height = 0;
    targeting.areaOfEffect = areaOfEffect;
    local.targeting = targeting;
  }

  if (detail.duration && parsedDuration) {
    const duration = (local.duration ?? {}) as Record<string, unknown>;
    duration.type = parsedDuration.type;
    duration.value = parsedDuration.value;
    duration.unit = parsedDuration.unit;
    duration.concentration = parsedDuration.concentration;
    local.duration = duration;
  }

  fs.writeFileSync(spell.jsonPath, `${JSON.stringify(local, null, 2)}\n`, 'utf8');
  patchMarkdownTopLevelFields(spell.markdownPath, local);
}

function groupMismatches(results: SpellCanonicalReview[]): CanonicalReviewReport['groupedMismatches'] {
  const groups = new Map<string, CanonicalReviewReport['groupedMismatches'][number]>();

  for (const result of results) {
    for (const mismatch of result.mismatches) {
      const groupKey = `json-vs-dndbeyond / ${mismatch.field}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.count += 1;
        if (!existing.spellIds.includes(mismatch.spellId)) existing.spellIds.push(mismatch.spellId);
        if (existing.sampleSummaries.length < 5) existing.sampleSummaries.push(mismatch.summary);
        continue;
      }

      groups.set(groupKey, {
        groupKey,
        field: mismatch.field,
        count: 1,
        spellIds: [mismatch.spellId],
        sampleSummaries: [mismatch.summary],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.groupKey.localeCompare(b.groupKey);
  });
}

function buildMarkdownReport(report: CanonicalReviewReport): string {
  const lines: string[] = [];
  lines.push('# Spell Corpus D&D Beyond Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Local spells reviewed: ${report.localSpellCount}`);
  lines.push(`D&D Beyond listing entries scraped: ${report.listingEntryCount}`);
  lines.push(`Matched local spells: ${report.matchedSpellCount}`);
  lines.push(`Unmatched local spells: ${report.unmatchedSpellCount}`);
  lines.push(`Total mismatches: ${report.mismatchCount}`);
  lines.push('');
  lines.push('This report compares local spell JSON against public D&D Beyond top-level spell facts.');
  lines.push('It does not claim to verify deeper local effect-object modeling.');
  lines.push('');
  lines.push('## Grouped Mismatches');
  lines.push('');

  if (report.groupedMismatches.length === 0) {
    lines.push('No grouped mismatches found.');
    lines.push('');
  } else {
    for (const group of report.groupedMismatches) {
      lines.push(`### ${group.groupKey}`);
      lines.push('');
      lines.push(`- Field: \`${group.field}\``);
      lines.push(`- Occurrences: ${group.count}`);
      lines.push(`- Distinct spells: ${group.spellIds.length}`);
      lines.push(`- Sample spells: ${group.spellIds.slice(0, 10).join(', ')}`);
      lines.push('- Sample findings:');
      for (const summary of group.sampleSummaries) {
        lines.push(`  - ${summary}`);
      }
      lines.push('');
    }
  }

  const unmatched = report.spellResults.filter((result) => !result.matchedListing);
  lines.push('## Unmatched Local Spells');
  lines.push('');
  if (unmatched.length === 0) {
    lines.push('No unmatched local spells.');
    lines.push('');
  } else {
    for (const spell of unmatched) {
      lines.push(`- \`${spell.level}\` ${spell.spellName} (\`${spell.spellId}\`)`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function writeReport(report: CanonicalReviewReport): void {
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MD_OUT, buildMarkdownReport(report), 'utf8');
}

async function main(): Promise<void> {
  const shouldApply = process.argv.includes('--apply');
  const localSpells = listLocalSpells();
  const listingEntries = await fetchListingEntries();
  const detailCache = new Map<string, DndBeyondDetailRecord>();
  const results: SpellCanonicalReview[] = [];

  console.log(`Loaded ${localSpells.length} local spells and ${listingEntries.length} D&D Beyond listing rows.`);

  for (const [index, spell] of localSpells.entries()) {
    if (index > 0 && index % 25 === 0) {
      console.log(`Reviewed ${index}/${localSpells.length} spells...`);
    }

    const listingEntry = pickListingEntry(spell, listingEntries);
    if (!listingEntry) {
      results.push({
        spellId: spell.id,
        spellName: spell.name,
        level: spell.level,
        jsonPath: spell.jsonPath,
        markdownPath: spell.markdownPath,
        matchedListing: false,
        listingUrl: '',
        mismatches: [
          buildMismatch(
            spell,
            'listing match',
            `${spell.name} / level ${spell.level} / legacy ${spell.legacy}`,
            'matching D&D Beyond listing row',
            `${spell.name} could not be mapped to a public D&D Beyond listing row with the current corpus matcher.`,
          ),
        ],
      });
      continue;
    }

    let detail = detailCache.get(listingEntry.urlPath);
    if (!detail) {
      detail = await fetchDetailRecord(listingEntry);
      detailCache.set(listingEntry.urlPath, detail);
    }

    const canonicalClassAccess = parseCanonicalClassAccess(detail.availableFor);
    const mismatches = compareSpellToCanonical(spell, detail, canonicalClassAccess);

    if (shouldApply && mismatches.some((mismatch) => mismatch.field !== 'listing match')) {
      applyCanonicalFixes(spell, detail, canonicalClassAccess);
    }

    results.push({
      spellId: spell.id,
      spellName: spell.name,
      level: spell.level,
      jsonPath: spell.jsonPath,
      markdownPath: spell.markdownPath,
      matchedListing: true,
      listingUrl: detail.url,
      mismatches,
    });
  }

  const report: CanonicalReviewReport = {
    generatedAt: new Date().toISOString(),
    localSpellCount: localSpells.length,
    listingEntryCount: listingEntries.length,
    matchedSpellCount: results.filter((result) => result.matchedListing).length,
    unmatchedSpellCount: results.filter((result) => !result.matchedListing).length,
    mismatchCount: results.reduce((sum, result) => sum + result.mismatches.length, 0),
    spellResults: results,
    groupedMismatches: groupMismatches(results),
  };

  writeReport(report);

  console.log(`Spell corpus D&D Beyond report written to ${MD_OUT}`);
  console.log(`Machine-readable artifact written to ${JSON_OUT}`);
  console.log(`Local spells reviewed: ${report.localSpellCount}`);
  console.log(`Matched local spells: ${report.matchedSpellCount}`);
  console.log(`Unmatched local spells: ${report.unmatchedSpellCount}`);
  console.log(`Total mismatches: ${report.mismatchCount}`);
  console.log(`Grouped mismatch buckets: ${report.groupedMismatches.length}`);
  if (shouldApply) {
    console.log('Applied safe top-level canonical fixes to matched spells.');
  }
}

void main();
