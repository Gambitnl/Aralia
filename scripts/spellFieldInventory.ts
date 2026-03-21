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
}

export interface InventoryOccurrence {
  spellId: string;
  spellName: string;
  level: number;
  filePath: string;
  fieldPath: string;
  value: string;
  valueKind: ValueKind;
  isFreeText: boolean;
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
      const relativePath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
      entries.push({ level, filePath, relativePath });
    }
  }

  return entries;
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

function collectNode(
  value: unknown,
  fieldPath: string,
  spell: SpellRecord,
  fields: Map<string, MutableFieldSummary>,
  occurrences: InventoryOccurrence[],
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
      collectNode(item, nextPath, spell, fields, occurrences);
    }
    return;
  }

  if (isPlainObject(value)) {
    if (fieldPath) ensureField(fieldPath, 'object');

    for (const [key, child] of Object.entries(value)) {
      const nextPath = fieldPath ? `${fieldPath}.${key}` : key;
      collectNode(child, nextPath, spell, fields, occurrences);
    }
    return;
  }

  const primitive = normalizePrimitive((value as PrimitiveValue) ?? null);
  const field = ensureField(fieldPath, primitive.kind);
  const isFreeText = detectFreeText(fieldPath, (value as PrimitiveValue) ?? null);

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
    fieldPath,
    value: primitive.display,
    valueKind: primitive.kind,
    isFreeText,
  });
}

export function buildSpellFieldInventory(): SpellFieldInventory {
  const spells: SpellRecord[] = [];
  const fields = new Map<string, MutableFieldSummary>();
  const occurrences: InventoryOccurrence[] = [];

  for (const entry of listSpellFiles()) {
    const raw = JSON.parse(fs.readFileSync(entry.filePath, 'utf8')) as Record<string, unknown>;
    const spell = deriveSpellRecord(entry.level, entry.filePath, entry.relativePath, raw);
    spells.push(spell);
    collectNode(raw, '', spell, fields, occurrences);
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

  const fieldSummaries = inventory.fields.filter((field) => {
    if (!includeFreeText && field.containsFreeTextValues && !fieldNeedle && !valueNeedle) {
      // Keep the default field browser focused on structural lanes unless the user
      // explicitly filters into a field or asks for free-text lanes.
      return false;
    }
    if (fieldNeedle && !field.fieldPath.toLowerCase().includes(fieldNeedle)) return false;
    return true;
  });

  const occurrences = inventory.occurrences.filter((occurrence) => {
    if (!includeFreeText && occurrence.isFreeText) return false;
    if (fieldNeedle && !occurrence.fieldPath.toLowerCase().includes(fieldNeedle)) return false;
    if (valueNeedle && !occurrence.value.toLowerCase().includes(valueNeedle)) return false;
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
