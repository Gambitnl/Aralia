import fs from 'node:fs';
import path from 'node:path';

/**
 * This script keeps the large spell template registries reviewable.
 *
 * The spell mechanics closure pass needs the full aggregate template JSON files
 * because existing audits and reports already read those stable paths. Those
 * files have grown large enough that editing them directly is risky, so this
 * script creates smaller source shards and checks that the aggregate files still
 * match the shard contents exactly.
 *
 * Called by:
 * - agents after a mechanics bucket adds or edits template fields
 * - modularization checkpoints before another broad template family is added
 * Depends on:
 * - docs/tasks/spells/templates/spell-structured-template.json
 * - docs/tasks/spells/templates/spell-json-template.json
 * Writes:
 * - docs/tasks/spells/templates/parts/structured/*.json
 * - docs/tasks/spells/templates/parts/runtime-json/*.json
 */

// ============================================================================
// Paths And Template Shapes
// ============================================================================
// This section names the stable aggregate files and the smaller shard folders.
// Existing tools keep reading the aggregate paths; the shards become the safer
// editing surface for future mechanics buckets.
// ============================================================================

const REPO_ROOT = process.cwd();
const TEMPLATE_ROOT = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'templates');

interface TemplateField {
  label?: string;
  path?: string;
  jsonPath?: string;
  [key: string]: unknown;
}

interface TemplateFile {
  schemaVersion: number;
  templateKind: string;
  fields: TemplateField[];
  [key: string]: unknown;
}

interface TemplateConfig {
  name: string;
  aggregatePath: string;
  partsDir: string;
  classifyField: (field: TemplateField) => string;
}

const STRUCTURED_CONFIG: TemplateConfig = {
  name: 'structured markdown template',
  aggregatePath: path.join(TEMPLATE_ROOT, 'spell-structured-template.json'),
  partsDir: path.join(TEMPLATE_ROOT, 'parts', 'structured'),
  classifyField: classifyStructuredField,
};

const RUNTIME_CONFIG: TemplateConfig = {
  name: 'runtime JSON template',
  aggregatePath: path.join(TEMPLATE_ROOT, 'spell-json-template.json'),
  partsDir: path.join(TEMPLATE_ROOT, 'parts', 'runtime-json'),
  classifyField: classifyRuntimeField,
};

const TEMPLATE_CONFIGS = [STRUCTURED_CONFIG, RUNTIME_CONFIG];
const MAX_FIELDS_PER_PART = 20;

// ============================================================================
// Field Classification
// ============================================================================
// This section groups fields by the part of the spell they describe. During the
// split step, the script starts a new shard whenever the group changes. That
// preserves the exact aggregate order even if fields from the same broad domain
// appear in several places.
// ============================================================================

function classifyStructuredField(field: TemplateField): string {
  const label = field.label ?? field.pattern ?? '';
  const jsonPath = field.jsonPath ?? '';
  const combined = `${label} ${jsonPath}`;

  if (/^(Level|School|Ritual|Classes|Sub-Classes|Access Grants|Access Grant)/.test(label)) {
    return '00-identity-and-access';
  }

  if (/^(Casting|Combat Cost|Reaction Trigger|Exploration|Verbal|Somatic|Material|Consumed|Duration)/.test(label)) {
    return '10-casting-components-duration';
  }

  if (/^(Range|Target|Area|Spatial)/.test(label) || combined.includes('targeting.')) {
    return '20-targeting-and-geometry';
  }

  if (/^(Effect|Utility|Control|Triggered|Save|Attack|Damage|Secondary|Healing|Temporary HP|Defense|Resistance|Vulnerability|Mitigation|Conditions|Recurring|Light|Sound|Conditional Ending)/.test(label)) {
    return '30-effects-damage-and-conditions';
  }

  if (/^(Movement|Forced Movement|Flood|Part Water|Redirect Flow|Whirlpool|Armor Class|Hit Points|Speed|Senses|Languages)/.test(label)) {
    return '40-world-state-and-entities';
  }

  return '90-descriptions-and-misc';
}

function classifyRuntimeField(field: TemplateField): string {
  const runtimePath = field.path ?? '';

  if (/^(id|name|aliases|level|school|legacy|classes|subClasses|ritual|rarity|attackType|tags|arbitrationType|aiContext)/.test(runtimePath)) {
    return '00-identity-access-and-ai';
  }

  if (/^(castingTime|range|components|duration)/.test(runtimePath)) {
    return '10-casting-components-duration';
  }

  if (/^targeting/.test(runtimePath)) {
    return '20-targeting-and-geometry';
  }

  if (/^effects/.test(runtimePath)) {
    return '30-effects-damage-and-conditions';
  }

  if (/^(description|higherLevels)$/.test(runtimePath)) {
    return '90-descriptions';
  }

  return '95-misc-runtime';
}

// ============================================================================
// Read, Write, And Compare Helpers
// ============================================================================
// This section does plain JSON IO and equality checks. It intentionally compares
// parsed JSON values instead of raw text so equivalent formatting does not fail
// a behavior-preserving split.
// ============================================================================

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function listPartFiles(partsDir: string): string[] {
  if (!fs.existsSync(partsDir)) return [];
  return fs.readdirSync(partsDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => path.join(partsDir, entry))
    .sort((left, right) => left.localeCompare(right));
}

// ============================================================================
// Split And Compose Operations
// ============================================================================
// This section owns the two supported operations. Splitting creates source
// shards from the current aggregate. Checking proves the current aggregate can
// still be reconstructed from those shards.
// ============================================================================

function splitAggregateIntoParts(config: TemplateConfig): void {
  const aggregate = readJson<TemplateFile>(config.aggregatePath);
  const orderedParts: Array<{ partName: string; fields: TemplateField[] }> = [];

  fs.rmSync(config.partsDir, { recursive: true, force: true });

  for (const field of aggregate.fields) {
    const partName = config.classifyField(field);
    const currentPart = orderedParts[orderedParts.length - 1];

    if (currentPart && currentPart.partName === partName && currentPart.fields.length < MAX_FIELDS_PER_PART) {
      currentPart.fields.push(field);
      continue;
    }

    orderedParts.push({ partName, fields: [field] });
  }

  orderedParts.forEach((part, index) => {
    const sequence = String(index).padStart(2, '0');
    writeJson(path.join(config.partsDir, `${sequence}-${part.partName}.json`), {
      templateKind: aggregate.templateKind,
      part: part.partName,
      fieldCount: part.fields.length,
      fields: part.fields,
    });
  });

  console.log(`[split] ${config.name}: wrote ${orderedParts.length} ordered parts to ${path.relative(REPO_ROOT, config.partsDir)}`);
}

function composeFieldsFromParts(config: TemplateConfig): TemplateField[] {
  const fields: TemplateField[] = [];
  for (const partFile of listPartFiles(config.partsDir)) {
    const part = readJson<{ fields: TemplateField[] }>(partFile);
    fields.push(...part.fields);
  }
  return fields;
}

function checkAggregateMatchesParts(config: TemplateConfig): boolean {
  const aggregate = readJson<TemplateFile>(config.aggregatePath);
  const composedFields = composeFieldsFromParts(config);
  const matches = stableStringify(aggregate.fields) === stableStringify(composedFields);

  if (matches) {
    console.log(`[check] ${config.name}: aggregate fields match ${listPartFiles(config.partsDir).length} parts`);
    return true;
  }

  console.error(`[check] ${config.name}: aggregate fields do not match template parts`);
  console.error(`[check] aggregate fields: ${aggregate.fields.length}; composed fields: ${composedFields.length}`);
  return false;
}

function writeAggregateFromParts(config: TemplateConfig): void {
  const aggregate = readJson<TemplateFile>(config.aggregatePath);
  const fields = composeFieldsFromParts(config);
  writeJson(config.aggregatePath, { ...aggregate, fields });
  console.log(`[write] ${config.name}: wrote ${fields.length} fields to ${path.relative(REPO_ROOT, config.aggregatePath)}`);
}

// ============================================================================
// Command Line Entrypoint
// ============================================================================
// This section keeps the allowed modes explicit. The default is `--check`
// because verification should be cheap and non-mutating after every batch.
// ============================================================================

const mode = process.argv[2] ?? '--check';

if (!['--split-from-aggregate', '--check', '--write-aggregate'].includes(mode)) {
  console.error('Usage: npx tsx scripts\\syncSpellTemplateRegistry.ts [--split-from-aggregate|--check|--write-aggregate]');
  process.exit(1);
}

if (mode === '--split-from-aggregate') {
  for (const config of TEMPLATE_CONFIGS) splitAggregateIntoParts(config);
  process.exit(0);
}

if (mode === '--write-aggregate') {
  for (const config of TEMPLATE_CONFIGS) writeAggregateFromParts(config);
  process.exit(0);
}

let ok = true;
for (const config of TEMPLATE_CONFIGS) {
  ok = checkAggregateMatchesParts(config) && ok;
}

if (!ok) {
  process.exit(1);
}
