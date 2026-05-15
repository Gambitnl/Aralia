import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSpellFieldInventory, type InventoryFieldSummary } from './spellFieldInventory.js';

/**
 * This script maps the current spell mechanics contract across the layers that
 * can drift while raw rules text is being converted into runtime data.
 *
 * It does not change the spell schema or remove `any`. Instead, it produces a
 * review map that answers which fields exist in live JSON, which fields are
 * allowed by the JSON schema, which field names appear in the TypeScript spell
 * types, and which fields are visibly read by runtime code.
 *
 * Called by: `npm run audit:spell-contract`
 * Depends on: spellFieldInventory.ts, spell.schema.json, src/types/spells.ts,
 * and runtime source files under src/.
 */

// ============================================================================
// Paths And Report Shape
// ============================================================================
// This section keeps the audit read-only and gives both agents and UI tooling a
// stable Markdown + JSON artifact to inspect before changing contracts.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = process.cwd();
const SCHEMA_PATH = path.join(REPO_ROOT, 'src', 'systems', 'spells', 'schema', 'spell.schema.json');
const TYPES_PATH = path.join(REPO_ROOT, 'src', 'types', 'spells.ts');
const REPORT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-mechanics-contract-audit.json');
const REPORT_MD_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_MECHANICS_CONTRACT_AUDIT_REPORT.md');

const RUNTIME_SCAN_ROOTS = [
  path.join(REPO_ROOT, 'src', 'systems', 'spells'),
  path.join(REPO_ROOT, 'src', 'hooks', 'combat'),
  path.join(REPO_ROOT, 'src', 'hooks', 'actions'),
  path.join(REPO_ROOT, 'src', 'commands'),
  path.join(REPO_ROOT, 'src', 'components', 'Glossary'),
  path.join(REPO_ROOT, 'src', 'utils', 'validation'),
  path.join(REPO_ROOT, 'src', 'utils', 'combat'),
];

type ContractStatus = 'aligned' | 'json-only' | 'schema-only' | 'type-gap' | 'runtime-only' | 'review';

interface ContractFieldRow {
  fieldPath: string;
  leafName: string;
  jsonSpellCount: number;
  jsonOccurrenceCount: number;
  jsonSampleValues: string[];
  schemaPresent: boolean;
  typeTokenPresent: boolean;
  runtimeTokenPresent: boolean;
  status: ContractStatus;
  notes: string[];
}

interface SpellMechanicsContractAudit {
  generatedAt: string;
  spellCount: number;
  jsonFieldCount: number;
  schemaFieldCount: number;
  typeTokenCount: number;
  runtimeTokenCount: number;
  rows: ContractFieldRow[];
  groupedCounts: Record<ContractStatus, number>;
  schemaOnlyFields: string[];
}

// ============================================================================
// Filesystem And Token Helpers
// ============================================================================
// This section gathers source text without interpreting behavior. Runtime
// detection is deliberately conservative: it proves a field name is read
// somewhere, not that the read is semantically complete.
// ============================================================================

function walkSourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  const files: string[] = [];

  function walk(currentPath: string): void {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        return;
      }

      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}

function extractPropertyTokens(sourceText: string): Set<string> {
  const tokens = new Set<string>();
  const patterns = [
    /\b([A-Za-z_$][A-Za-z0-9_$]*)\??\s*:/g,
    /\.([A-Za-z_$][A-Za-z0-9_$]*)\b/g,
    /['"]([A-Za-z_$][A-Za-z0-9_$]*)['"]\s+in\s+/g,
    /\[['"]([A-Za-z_$][A-Za-z0-9_$]*)['"]\]/g,
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      if (match[1]) tokens.add(match[1]);
    }
  }

  return tokens;
}

function getLeafName(fieldPath: string): string {
  const parts = fieldPath.replace(/\[\]/g, '').split('.');
  return parts[parts.length - 1] ?? fieldPath;
}

// ============================================================================
// Schema Path Extraction
// ============================================================================
// This section walks the checked-in JSON schema, including local definitions.
// It captures paths the schema admits, then the report compares them to live
// JSON fields from the inventory.
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveLocalRef(schemaRoot: Record<string, unknown>, ref: string): Record<string, unknown> | null {
  if (!ref.startsWith('#/')) return null;
  const segments = ref.slice(2).split('/');
  let current: unknown = schemaRoot;

  for (const segment of segments) {
    if (!isRecord(current)) return null;
    current = current[segment];
  }

  return isRecord(current) ? current : null;
}

function collectSchemaPaths(
  schemaRoot: Record<string, unknown>,
  schemaNode: unknown,
  currentPath: string,
  paths: Set<string>,
  seenRefs = new Set<string>(),
): void {
  if (!isRecord(schemaNode)) return;

  const ref = typeof schemaNode.$ref === 'string' ? schemaNode.$ref : '';
  if (ref) {
    if (seenRefs.has(ref)) return;
    const resolved = resolveLocalRef(schemaRoot, ref);
    if (resolved) {
      collectSchemaPaths(schemaRoot, resolved, currentPath, paths, new Set([...seenRefs, ref]));
    }
    return;
  }

  for (const unionKey of ['oneOf', 'anyOf', 'allOf']) {
    const unionMembers = schemaNode[unionKey];
    if (Array.isArray(unionMembers)) {
      unionMembers.forEach((member) => collectSchemaPaths(schemaRoot, member, currentPath, paths, seenRefs));
    }
  }

  const properties = schemaNode.properties;
  if (isRecord(properties)) {
    for (const [propertyName, childNode] of Object.entries(properties)) {
      const nextPath = currentPath ? `${currentPath}.${propertyName}` : propertyName;
      paths.add(nextPath);
      collectSchemaPaths(schemaRoot, childNode, nextPath, paths, seenRefs);
    }
  }

  const items = schemaNode.items;
  if (items) {
    const nextPath = currentPath ? `${currentPath}[]` : '[]';
    paths.add(nextPath);
    collectSchemaPaths(schemaRoot, items, nextPath, paths, seenRefs);
  }
}

function loadSchemaPaths(): Set<string> {
  const schemaRoot = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as Record<string, unknown>;
  const paths = new Set<string>();
  collectSchemaPaths(schemaRoot, schemaRoot, '', paths);
  return paths;
}

// ============================================================================
// Contract Classification
// ============================================================================
// This section labels each field with the smallest useful status. The labels are
// not pass/fail verdicts; they tell us where to investigate before replacing
// spell-related `any` casts.
// ============================================================================

function classifyRow(jsonPresent: boolean, schemaPresent: boolean, typePresent: boolean, runtimePresent: boolean): ContractStatus {
  if (!jsonPresent && schemaPresent) return 'schema-only';
  if (jsonPresent && !schemaPresent) return 'json-only';
  if (jsonPresent && schemaPresent && !typePresent) return 'type-gap';
  if (!jsonPresent && runtimePresent) return 'runtime-only';
  if (jsonPresent && schemaPresent && typePresent && runtimePresent) return 'aligned';
  return 'review';
}

function buildNotes(row: Omit<ContractFieldRow, 'notes' | 'status'>): string[] {
  const notes: string[] = [];

  if (!row.schemaPresent) notes.push('Live JSON uses this field, but spell.schema.json does not list the same path.');
  if (!row.typeTokenPresent) notes.push('The leaf field name is not visible in src/types/spells.ts property declarations.');
  if (!row.runtimeTokenPresent) notes.push('No obvious runtime read found in scanned spell/combat/glossary code.');
  if (row.schemaPresent && row.jsonSpellCount === 0) notes.push('Schema allows this path, but the current JSON corpus does not use it.');

  return notes;
}

function toContractRow(
  field: InventoryFieldSummary,
  schemaPaths: Set<string>,
  typeTokens: Set<string>,
  runtimeTokens: Set<string>,
): ContractFieldRow {
  const fieldPath = field.fieldPath;
  const leafName = getLeafName(fieldPath);
  const schemaPresent = schemaPaths.has(fieldPath);
  const typeTokenPresent = typeTokens.has(leafName);
  const runtimeTokenPresent = runtimeTokens.has(leafName);
  const base = {
    fieldPath,
    leafName,
    jsonSpellCount: field.spellCount,
    jsonOccurrenceCount: field.occurrenceCount,
    jsonSampleValues: field.sampleValues.slice(0, 5).map((value) => value.value),
    schemaPresent,
    typeTokenPresent,
    runtimeTokenPresent,
  };
  const status = classifyRow(true, schemaPresent, typeTokenPresent, runtimeTokenPresent);

  return {
    ...base,
    status,
    notes: buildNotes(base),
  };
}

function groupCounts(rows: ContractFieldRow[]): Record<ContractStatus, number> {
  return rows.reduce<Record<ContractStatus, number>>((counts, row) => {
    counts[row.status] += 1;
    return counts;
  }, {
    aligned: 0,
    'json-only': 0,
    'schema-only': 0,
    'type-gap': 0,
    'runtime-only': 0,
    review: 0,
  });
}

// ============================================================================
// Report Rendering
// ============================================================================
// The Markdown report leads with mismatches and high-signal examples. The full
// row list stays in JSON so follow-up tooling can filter and sort it.
// ============================================================================

function renderMarkdownReport(report: SpellMechanicsContractAudit): string {
  const lines = [
    '# Spell Mechanics Contract Audit',
    '',
    'This report maps live spell JSON fields against the checked-in JSON schema, TypeScript spell field names, and obvious runtime reads.',
    '',
    `Generated: ${report.generatedAt}`,
    `Spells scanned: ${report.spellCount}`,
    `Live JSON fields: ${report.jsonFieldCount}`,
    `Schema fields: ${report.schemaFieldCount}`,
    `Type field tokens: ${report.typeTokenCount}`,
    `Runtime read tokens: ${report.runtimeTokenCount}`,
    '',
    '## Status Counts',
    '',
    `- Aligned: ${report.groupedCounts.aligned}`,
    `- JSON-only: ${report.groupedCounts['json-only']}`,
    `- Type gaps: ${report.groupedCounts['type-gap']}`,
    `- Review: ${report.groupedCounts.review}`,
    `- Schema-only: ${report.schemaOnlyFields.length}`,
    '',
    '## Highest Priority JSON-Only Fields',
    '',
  ];

  const jsonOnly = report.rows
    .filter((row) => row.status === 'json-only')
    .sort((left, right) => right.jsonOccurrenceCount - left.jsonOccurrenceCount)
    .slice(0, 25);

  if (jsonOnly.length === 0) {
    lines.push('No JSON-only fields found.');
  } else {
    jsonOnly.forEach((row) => {
      lines.push(`- \`${row.fieldPath}\` (${row.jsonSpellCount} spells, ${row.jsonOccurrenceCount} occurrences) samples: ${row.jsonSampleValues.join(' | ')}`);
    });
  }

  lines.push('', '## Type Gaps With Runtime Reads', '');

  const typeGaps = report.rows
    .filter((row) => row.status === 'type-gap' && row.runtimeTokenPresent)
    .sort((left, right) => right.jsonOccurrenceCount - left.jsonOccurrenceCount)
    .slice(0, 25);

  if (typeGaps.length === 0) {
    lines.push('No type gaps with visible runtime reads found.');
  } else {
    typeGaps.forEach((row) => {
      lines.push(`- \`${row.fieldPath}\` (${row.jsonSpellCount} spells, ${row.jsonOccurrenceCount} occurrences)`);
    });
  }

  lines.push('', '## Schema-Only Fields', '');
  if (report.schemaOnlyFields.length === 0) {
    lines.push('No schema-only fields found.');
  } else {
    report.schemaOnlyFields.slice(0, 80).forEach((fieldPath) => {
      lines.push(`- \`${fieldPath}\``);
    });
  }

  lines.push('', '## Notes', '');
  lines.push('- Runtime-read detection is token based. It is useful for triage, not proof of complete behavior.');
  lines.push('- Type detection is based on field-name tokens in `src/types/spells.ts`, so nested fields with common names may need manual review.');
  lines.push('- Use this report to decide where spell-related `any` casts are hiding real contract drift before replacing them.');

  return `${lines.join('\n')}\n`;
}

function writeReport(report: SpellMechanicsContractAudit): void {
  fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(REPORT_MD_PATH), { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(REPORT_MD_PATH, renderMarkdownReport(report), 'utf8');
}

// ============================================================================
// Audit Builder
// ============================================================================
// This section composes existing inventory data with schema/type/runtime scans.
// Keeping the data sources separate makes drift visible instead of papering it
// over with broader `any` casts.
// ============================================================================

export function buildSpellMechanicsContractAudit(): SpellMechanicsContractAudit {
  const inventory = buildSpellFieldInventory();
  const schemaPaths = loadSchemaPaths();
  const typeTokens = extractPropertyTokens(fs.readFileSync(TYPES_PATH, 'utf8'));
  const runtimeTokens = new Set<string>();

  for (const root of RUNTIME_SCAN_ROOTS) {
    for (const filePath of walkSourceFiles(root)) {
      const tokens = extractPropertyTokens(fs.readFileSync(filePath, 'utf8'));
      tokens.forEach((token) => runtimeTokens.add(token));
    }
  }

  const rows = inventory.fields.map((field) => toContractRow(field, schemaPaths, typeTokens, runtimeTokens));
  const jsonFieldPaths = new Set(rows.map((row) => row.fieldPath));
  const schemaOnlyFields = Array.from(schemaPaths)
    .filter((fieldPath) => !jsonFieldPaths.has(fieldPath))
    .sort((left, right) => left.localeCompare(right));

  return {
    generatedAt: new Date().toISOString(),
    spellCount: inventory.spellCount,
    jsonFieldCount: inventory.fieldCount,
    schemaFieldCount: schemaPaths.size,
    typeTokenCount: typeTokens.size,
    runtimeTokenCount: runtimeTokens.size,
    rows: rows.sort((left, right) => {
      if (left.status !== right.status) return left.status.localeCompare(right.status);
      if (right.jsonOccurrenceCount !== left.jsonOccurrenceCount) return right.jsonOccurrenceCount - left.jsonOccurrenceCount;
      return left.fieldPath.localeCompare(right.fieldPath);
    }),
    groupedCounts: groupCounts(rows),
    schemaOnlyFields,
  };
}

function main(): void {
  const report = buildSpellMechanicsContractAudit();
  writeReport(report);

  console.log(`Spell mechanics contract report written to ${REPORT_MD_PATH}`);
  console.log(`Machine-readable report written to ${REPORT_JSON_PATH}`);
  console.log(`Spells scanned: ${report.spellCount}`);
  console.log(`Live JSON fields: ${report.jsonFieldCount}`);
  console.log(`JSON-only fields: ${report.groupedCounts['json-only']}`);
  console.log(`Type gaps: ${report.groupedCounts['type-gap']}`);
  console.log(`Schema-only fields: ${report.schemaOnlyFields.length}`);
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === SCRIPT_FILE
  : false;

if (isDirectRun) {
  main();
}
