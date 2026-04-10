import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * This file crawls every spell JSON file and turns the current dataset into a searchable
 * field-and-value inventory.
 *
 * It exists because the spell lane now needs a structural view of the live data before
 * we lock stricter validation rules. The docs and roadmap work can ask "which fields exist?"
 * and "which spells use value X?" much more safely if that answer comes from one normalized
 * inventory instead of ad hoc grep passes.
 *
 * Called by: the Dev Hub API in vite.config.ts and the direct CLI entrypoint added below.
 * Depends on: the spell JSON files under public/data/spells.
 */

// ============================================================================
// Paths, structural hints, and shared types
// ============================================================================
// This section defines where the spell JSON files live and which fields should
// be treated as prose-heavy. The first crawler pass stays structural on purpose,
// but we still tag likely free-text fields so the UI can exclude them by default.
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SPELLS_ROOT = path.resolve(__dirname, '..', 'public', 'data', 'spells');

const FREE_TEXT_FIELD_HINTS = [
  'description',
  'higherlevels',
  'prompt',
  'flavor',
  'notes',
  'summary',
  'lore',
  'text',
];

type PrimitiveValue = string | number | boolean | null;
type ValueKind = 'string' | 'number' | 'boolean' | 'null';
type ContainerKind = ValueKind | 'object' | 'array' | 'mixed';

export interface SpellRecord {
  spellId: string;
  spellName: string;
  level: number;
  filePath: string;
  relativePath: string;
  browserPath: string;
}

export interface InventoryOccurrence {
  spellId: string;
  spellName: string;
  level: number;
  filePath: string;
  browserPath: string;
  fieldPath: string;
  semanticFieldPath: string;
  value: string;
  valueKind: ValueKind;
  isFreeText: boolean;
  lineNumber: number | null;
}

export interface InventoryValueSummary {
  value: string;
  valueKind: ValueKind;
  occurrenceCount: number;
  spellCount: number;
  sampleSpellIds: string[];
}

export interface InventoryFieldSummary {
  fieldPath: string;
  containerKind: ContainerKind;
  spellCount: number;
  occurrenceCount: number;
  distinctValueCount: number;
  containsFreeTextValues: boolean;
  sampleValues: InventoryValueSummary[];
}

export interface SpellFieldInventory {
  generatedAt: string;
  sourceRoot: string;
  spellCount: number;
  fieldCount: number;
  occurrenceCount: number;
  spells: SpellRecord[];
  fields: InventoryFieldSummary[];
  occurrences: InventoryOccurrence[];
}

export interface SpellFieldInventoryQueryOptions {
  fieldPath?: string;
  value?: string;
  level?: number;
  includeFreeText?: boolean;
  limit?: number;
}

interface MutableValueSummary {
  value: string;
  valueKind: ValueKind;
  occurrenceCount: number;
  spellIds: Set<string>;
}

interface MutableFieldSummary {
  fieldPath: string;
  containerKinds: Set<ContainerKind>;
  spellIds: Set<string>;
  occurrenceCount: number;
  containsFreeTextValues: boolean;
  values: Map<string, MutableValueSummary>;
}

// ============================================================================
// Spell discovery and low-opinion structural flattening
// ============================================================================
// This section walks the spell folders, reads each JSON file, and turns nested
// objects and arrays into normalized field paths such as "effects[].type".
// The crawler records only what exists; it does not try to judge whether a field
// is a good model for PHB semantics yet.
// ============================================================================

function listSpellFiles(): Array<{ level: number; filePath: string; relativePath: string }> {
  const entries: Array<{ level: number; filePath: string; relativePath: string }> = [];

  for (let level = 0; level <= 9; level += 1) {
    const levelDir = path.join(SPELLS_ROOT, `level-${level}`);
    if (!fs.existsSync(levelDir)) continue;

    const files = fs.readdirSync(levelDir)
      .filter((name) => name.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of files) {
      const filePath = path.join(levelDir, fileName);
      const relativePath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
      entries.push({ level, filePath, relativePath });
    }
  }

  return entries;
}

function createSpellBrowserPath(relativePath: string): string {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  const withoutPublicPrefix = normalized.replace(/^public\//, '');
  return `/Aralia/${withoutPublicPrefix}`;
}

function deriveSpellRecord(level: number, filePath: string, relativePath: string, rawSpell: Record<string, unknown>): SpellRecord {
  const fileName = path.basename(filePath, '.json');
  const spellId = typeof rawSpell.id === 'string' && rawSpell.id.trim() ? rawSpell.id.trim() : fileName;
  const spellName = typeof rawSpell.name === 'string' && rawSpell.name.trim() ? rawSpell.name.trim() : fileName;

  return {
    spellId,
    spellName,
    level,
    filePath,
    relativePath,
    browserPath: createSpellBrowserPath(relativePath),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function detectFreeText(fieldPath: string, value: PrimitiveValue): boolean {
  if (typeof value !== 'string') return false;

  const normalizedField = fieldPath.toLowerCase();
  if (FREE_TEXT_FIELD_HINTS.some((hint) => normalizedField.includes(hint))) {
    return true;
  }

  // DEBT: This first pass uses length as a crude hint for prose-heavy values.
  // That keeps the query tool usable quickly, but some medium-length structured
  // strings may still be tagged as prose and some short free text may slip through.
  return value.length > 100;
}

function normalizePrimitive(value: PrimitiveValue): { display: string; kind: ValueKind } {
  if (value === null) return { display: 'null', kind: 'null' };
  if (typeof value === 'boolean') return { display: value ? 'true' : 'false', kind: 'boolean' };
  if (typeof value === 'number') return { display: String(value), kind: 'number' };
  return { display: value, kind: 'string' };
}

function mergeContainerKinds(kinds: Set<ContainerKind>): ContainerKind {
  if (kinds.size === 0) return 'mixed';
  if (kinds.size === 1) return Array.from(kinds)[0];
  return 'mixed';
}

function denormalizePrimitive(value: string, kind: ValueKind): PrimitiveValue {
  if (kind === 'null') return null;
  if (kind === 'boolean') return value === 'true';
  if (kind === 'number') return Number(value);
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOccurrenceLinePattern(occurrence: InventoryOccurrence): RegExp {
  const serializedValue = JSON.stringify(denormalizePrimitive(occurrence.value, occurrence.valueKind));
  const escapedValue = escapeRegExp(serializedValue);

  // The inventory only records primitive leaves, so each occurrence should map to
  // one line in the pretty-printed spell JSON. Object properties look like
  // `"key": value,` while primitive array items look like `"Wizard",`.
  if (occurrence.fieldPath.endsWith('[]')) {
    return new RegExp(`^\\s*${escapedValue}\\s*,?$`);
  }

  const leafSegment = occurrence.fieldPath.split('.').pop() || '';
  const leafKey = leafSegment.replace(/\[\]/g, '');
  const escapedKey = escapeRegExp(JSON.stringify(leafKey));
  return new RegExp(`^\\s*${escapedKey}\\s*:\\s*${escapedValue}\\s*,?$`);
}

function deriveArrayItemIdentity(value: unknown): string | null {
  if (!isPlainObject(value)) return null;

  // Validation review needs a stable way to distinguish "same path, different
  // semantic slot" cases inside arrays of objects. Labels are the best signal,
  // but we fall back to other naming fields so the inventory can still separate
  // entries like measured details, spatial forms, or typed effect fragments.
  const candidateKeys = ['label', 'name', 'id'];
  for (const key of candidateKeys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  const kind = typeof value.kind === 'string' && value.kind.trim() ? value.kind.trim() : '';
  const type = typeof value.type === 'string' && value.type.trim() ? value.type.trim() : '';
  const qualifier = typeof value.qualifier === 'string' && value.qualifier.trim() ? value.qualifier.trim() : '';
  const fallbackParts = [kind || type, qualifier].filter(Boolean);

  return fallbackParts.length ? fallbackParts.join(' - ') : null;
}

function applySemanticArrayIdentities(fieldPath: string, identities: Array<string | null>): string {
  let identityIndex = 0;

  return fieldPath.replace(/\[\]/g, () => {
    const identity = identities[identityIndex] ?? null;
    identityIndex += 1;
    return identity ? `[${identity}]` : '[]';
  });
}

function attachOccurrenceLineNumbers(filePath: string, spellOccurrences: InventoryOccurrence[]): void {
  const fileLines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  let nextSearchIndex = 0;

  // We resolve hits in traversal order so repeated values in the same file stay
  // attached to the correct line instead of collapsing onto the first matching
  // occurrence. That gives the validation page a stable "hit line" without
  // pulling in a heavier JSON-with-source-locations parser.
  for (const occurrence of spellOccurrences) {
    const pattern = buildOccurrenceLinePattern(occurrence);
    let matchedIndex = -1;

    for (let lineIndex = nextSearchIndex; lineIndex < fileLines.length; lineIndex += 1) {
      if (pattern.test(fileLines[lineIndex])) {
        matchedIndex = lineIndex;
        break;
      }
    }

    if (matchedIndex === -1 && nextSearchIndex > 0) {
      for (let lineIndex = 0; lineIndex < nextSearchIndex; lineIndex += 1) {
        if (pattern.test(fileLines[lineIndex])) {
          matchedIndex = lineIndex;
          break;
        }
      }
    }

    occurrence.lineNumber = matchedIndex >= 0 ? matchedIndex + 1 : null;
    if (matchedIndex >= 0) nextSearchIndex = matchedIndex + 1;
  }
}

function collectNode(
  value: unknown,
  fieldPath: string,
  spell: SpellRecord,
  fields: Map<string, MutableFieldSummary>,
  occurrences: InventoryOccurrence[],
  semanticArrayIdentities: Array<string | null> = [],
): void {
  const ensureField = (pathKey: string, kind: ContainerKind): MutableFieldSummary => {
    const existing = fields.get(pathKey);
    if (existing) {
      existing.containerKinds.add(kind);
      existing.spellIds.add(spell.spellId);
      return existing;
    }

    const created: MutableFieldSummary = {
      fieldPath: pathKey,
      containerKinds: new Set([kind]),
      spellIds: new Set([spell.spellId]),
      occurrenceCount: 0,
      containsFreeTextValues: false,
      values: new Map(),
    };
    fields.set(pathKey, created);
    return created;
  };

  if (Array.isArray(value)) {
    if (fieldPath) ensureField(fieldPath, 'array');

    const nextPath = fieldPath ? `${fieldPath}[]` : '[]';
    for (const item of value) {
      collectNode(item, nextPath, spell, fields, occurrences, [...semanticArrayIdentities, deriveArrayItemIdentity(item)]);
    }
    return;
  }

  if (isPlainObject(value)) {
    if (fieldPath) ensureField(fieldPath, 'object');

    for (const [key, child] of Object.entries(value)) {
      const nextPath = fieldPath ? `${fieldPath}.${key}` : key;
      collectNode(child, nextPath, spell, fields, occurrences, semanticArrayIdentities);
    }
    return;
  }

  const primitive = normalizePrimitive((value as PrimitiveValue) ?? null);
  const field = ensureField(fieldPath, primitive.kind);
  const isFreeText = detectFreeText(fieldPath, (value as PrimitiveValue) ?? null);
  const semanticFieldPath = applySemanticArrayIdentities(fieldPath, semanticArrayIdentities);

  field.occurrenceCount += 1;
  field.containsFreeTextValues = field.containsFreeTextValues || isFreeText;

  const existingValue = field.values.get(primitive.display);
  if (existingValue) {
    existingValue.occurrenceCount += 1;
    existingValue.spellIds.add(spell.spellId);
  } else {
    field.values.set(primitive.display, {
      value: primitive.display,
      valueKind: primitive.kind,
      occurrenceCount: 1,
      spellIds: new Set([spell.spellId]),
    });
  }

  occurrences.push({
    spellId: spell.spellId,
    spellName: spell.spellName,
    level: spell.level,
    filePath: spell.filePath,
    browserPath: spell.browserPath,
    fieldPath,
    semanticFieldPath,
    value: primitive.display,
    valueKind: primitive.kind,
    isFreeText,
    lineNumber: null,
  });
}

export function buildSpellFieldInventory(): SpellFieldInventory {
  const spells: SpellRecord[] = [];
  const fields = new Map<string, MutableFieldSummary>();
  const occurrences: InventoryOccurrence[] = [];

  for (const entry of listSpellFiles()) {
    const raw = JSON.parse(fs.readFileSync(entry.filePath, 'utf8')) as Record<string, unknown>;
    const spell = deriveSpellRecord(entry.level, entry.filePath, entry.relativePath, raw);
    const spellOccurrences: InventoryOccurrence[] = [];
    spells.push(spell);
    collectNode(raw, '', spell, fields, spellOccurrences);
    attachOccurrenceLineNumbers(entry.filePath, spellOccurrences);
    occurrences.push(...spellOccurrences);
  }

  const fieldSummaries = Array.from(fields.values())
    .filter((field) => field.fieldPath.trim().length > 0)
    .map<InventoryFieldSummary>((field) => ({
      fieldPath: field.fieldPath,
      containerKind: mergeContainerKinds(field.containerKinds),
      spellCount: field.spellIds.size,
      occurrenceCount: field.occurrenceCount,
      distinctValueCount: field.values.size,
      containsFreeTextValues: field.containsFreeTextValues,
      sampleValues: Array.from(field.values.values())
        .sort((a, b) => {
          if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
          return a.value.localeCompare(b.value);
        })
        .slice(0, 10)
        .map((value) => ({
          value: value.value,
          valueKind: value.valueKind,
          occurrenceCount: value.occurrenceCount,
          spellCount: value.spellIds.size,
          sampleSpellIds: Array.from(value.spellIds).sort().slice(0, 6),
        })),
    }))
    .sort((a, b) => a.fieldPath.localeCompare(b.fieldPath));

  const sortedOccurrences = occurrences.sort((a, b) => {
    if (a.fieldPath !== b.fieldPath) return a.fieldPath.localeCompare(b.fieldPath);
    if (a.semanticFieldPath !== b.semanticFieldPath) return a.semanticFieldPath.localeCompare(b.semanticFieldPath);
    if (a.level !== b.level) return a.level - b.level;
    if (a.spellName !== b.spellName) return a.spellName.localeCompare(b.spellName);
    return a.value.localeCompare(b.value);
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceRoot: SPELLS_ROOT,
    spellCount: spells.length,
    fieldCount: fieldSummaries.length,
    occurrenceCount: sortedOccurrences.length,
    spells: spells.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.spellName.localeCompare(b.spellName);
    }),
    fields: fieldSummaries,
    occurrences: sortedOccurrences,
  };
}

// ============================================================================
// Summary shaping and query helpers
// ============================================================================
// This section keeps the inventory useful instead of bloated. The Dev Hub asks
// for small, filtered slices so a human can browse field paths and search values
// like "1d4" without wading through one giant report file.
// ============================================================================

export function createSpellFieldInventorySummary(inventory: SpellFieldInventory) {
  return {
    generatedAt: inventory.generatedAt,
    sourceRoot: inventory.sourceRoot,
    spellCount: inventory.spellCount,
    fieldCount: inventory.fieldCount,
    occurrenceCount: inventory.occurrenceCount,
    fields: inventory.fields,
  };
}

export function querySpellFieldInventory(inventory: SpellFieldInventory, options: SpellFieldInventoryQueryOptions = {}) {
  const fieldNeedle = String(options.fieldPath ?? '').trim().toLowerCase();
  const valueNeedle = String(options.value ?? '').trim().toLowerCase();
  const includeFreeText = Boolean(options.includeFreeText);
  const level = typeof options.level === 'number' ? options.level : null;
  const limit = Math.max(1, Math.min(Number(options.limit ?? 200), 1000));
  const hasFieldFilter = fieldNeedle.length > 0;
  const hasValueFilter = valueNeedle.length > 0;
  const requireExactCombinedMatch = hasFieldFilter && hasValueFilter;

  const fieldSummaries = inventory.fields.filter((field) => {
    if (!includeFreeText && field.containsFreeTextValues && !hasFieldFilter && !hasValueFilter) {
      // Keep the default field browser focused on structural lanes unless the user
      // explicitly filters into a field or asks for free-text lanes.
      return false;
    }
    // Combined searches are now treated as a strict paired query. When the user
    // supplies both a field path and a value, the field side must match that one
    // exact path instead of doing a broad substring browse. This prevents a query
    // like `targeting.spatialDetails.measuredDetails[].value = 10` from drifting
    // into sibling field paths while the user is trying to verify one concrete
    // structural lane.
    if (requireExactCombinedMatch) {
      if (field.fieldPath.toLowerCase() !== fieldNeedle) return false;
      return true;
    }

    if (hasFieldFilter && !field.fieldPath.toLowerCase().includes(fieldNeedle)) return false;
    return true;
  });

  const occurrences = inventory.occurrences.filter((occurrence) => {
    if (!includeFreeText && occurrence.isFreeText) return false;

    // The field/value search now has two modes:
    // 1. browse mode: one filter filled in, so partial matching stays useful
    // 2. strict combined mode: both filters filled in, so only exact field+value
    //    pairs should survive. This is the behavior the spell validation page
    //    needs when the user is trying to confirm a very specific structural fact.
    if (requireExactCombinedMatch) {
      const fieldMatchesExactly =
        occurrence.fieldPath.toLowerCase() === fieldNeedle
        || occurrence.semanticFieldPath.toLowerCase() === fieldNeedle;
      if (!fieldMatchesExactly) return false;
      if (occurrence.value.toLowerCase() !== valueNeedle) return false;
    } else {
      const fieldMatchesBroadly =
        occurrence.fieldPath.toLowerCase().includes(fieldNeedle)
        || occurrence.semanticFieldPath.toLowerCase().includes(fieldNeedle);
      if (hasFieldFilter && !fieldMatchesBroadly) return false;
      if (hasValueFilter && !occurrence.value.toLowerCase().includes(valueNeedle)) return false;
    }

    if (level !== null && occurrence.level !== level) return false;
    return true;
  });

  const distinctValues = new Map<string, MutableValueSummary>();
  for (const occurrence of occurrences) {
    const existing = distinctValues.get(occurrence.value);
    if (existing) {
      existing.occurrenceCount += 1;
      existing.spellIds.add(occurrence.spellId);
    } else {
      distinctValues.set(occurrence.value, {
        value: occurrence.value,
        valueKind: occurrence.valueKind,
        occurrenceCount: 1,
        spellIds: new Set([occurrence.spellId]),
      });
    }
  }

  return {
    generatedAt: inventory.generatedAt,
    filters: {
      fieldPath: options.fieldPath ?? '',
      value: options.value ?? '',
      level,
      includeFreeText,
      limit,
    },
    fieldMatches: fieldSummaries.slice(0, limit),
    distinctValues: Array.from(distinctValues.values())
      .sort((a, b) => {
        if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
        return a.value.localeCompare(b.value);
      })
      .slice(0, limit)
      .map((value) => ({
        value: value.value,
        valueKind: value.valueKind,
        occurrenceCount: value.occurrenceCount,
        spellCount: value.spellIds.size,
        sampleSpellIds: Array.from(value.spellIds).sort().slice(0, 10),
      })),
    occurrences: occurrences.slice(0, limit),
    totalMatches: occurrences.length,
  };
}

// ============================================================================
// CLI entrypoint
// ============================================================================
// This gives the inventory a command-line home as well. The Dev Hub is the
// browseable surface, but the CLI lets us regenerate or inspect the dataset
// quickly during testing and future validation work.
// ============================================================================

function parseCliArgs(args: string[]) {
  const parsed = {
    outPath: '',
    summaryOnly: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--full') parsed.summaryOnly = false;
    if (arg === '--out') {
      parsed.outPath = String(args[index + 1] ?? '').trim();
      index += 1;
    }
  }

  return parsed;
}

function runCli() {
  const args = parseCliArgs(process.argv.slice(2));
  const inventory = buildSpellFieldInventory();
  const payload = args.summaryOnly ? createSpellFieldInventorySummary(inventory) : inventory;
  const json = JSON.stringify(payload, null, 2);

  if (args.outPath) {
    const absoluteOutPath = path.resolve(process.cwd(), args.outPath);
    fs.mkdirSync(path.dirname(absoluteOutPath), { recursive: true });
    fs.writeFileSync(absoluteOutPath, json, 'utf8');
    console.log(`Wrote spell field inventory to ${absoluteOutPath}`);
    return;
  }

  console.log(json);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli();
}
