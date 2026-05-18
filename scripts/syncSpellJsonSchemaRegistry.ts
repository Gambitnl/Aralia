import fs from 'node:fs';
import path from 'node:path';

/**
 * This script keeps the spell JSON Schema reviewable without changing the path
 * that existing validators and audits already read.
 *
 * The stable aggregate remains `src/systems/spells/schema/spell.schema.json`.
 * Future edits should usually happen in the smaller files under
 * `src/systems/spells/schema/parts/`, then this script can rebuild the
 * aggregate. The check mode compares parsed JSON values with sorted keys, so a
 * formatting-only change does not count as a behavior change.
 *
 * Called by: agents during spell mechanics modularization checkpoints.
 * Depends on: `spell.schema.json` and optional schema part files.
 * Writes: `src/systems/spells/schema/parts/*.json` and, in write mode, the
 * aggregate `spell.schema.json`.
 */

// ============================================================================
// Paths And Schema Part Plan
// ============================================================================
// Existing code expects one JSON Schema file at the aggregate path. The part plan
// splits only the source editing surface; it does not ask existing consumers to
// learn a new loader.
// ============================================================================

const REPO_ROOT = process.cwd();
const SCHEMA_ROOT = path.join(REPO_ROOT, 'src', 'systems', 'spells', 'schema');
const AGGREGATE_PATH = path.join(SCHEMA_ROOT, 'spell.schema.json');
const PARTS_DIR = path.join(SCHEMA_ROOT, 'parts');

interface JsonObject {
  [key: string]: unknown;
}

interface RootPart {
  schemaKind: 'spell-json-schema';
  part: '00-schema-root';
  content: JsonObject;
}

interface DefinitionPart {
  schemaKind: 'spell-json-schema';
  part: string;
  definitionCount: number;
  definitions: JsonObject;
}

const DEFINITION_PARTS: Array<{ fileName: string; part: string; names: string[] }> = [
  {
    fileName: '10-schedules-modes-and-relationships.json',
    part: '10-schedules-modes-and-relationships',
    names: [
      'RecurringMechanic',
      'ModeChoice',
      'ModeChoiceOption',
      'EffectSchedule',
      'EffectScheduleEntry',
      'EffectScheduleTargeting',
      'SecondaryTargeting',
    ],
  },
  {
    fileName: '20-effect-payloads.json',
    part: '20-effect-payloads',
    names: [
      'DamageEffect',
      'HealingEffect',
      'StatusConditionEffect',
      'MovementEffect',
      'SummoningEffect',
      'TerrainEffect',
      'UtilityEffect',
      'DefensiveEffect',
    ],
  },
  {
    fileName: '30-lifecycle-protection-and-appearance.json',
    part: '30-lifecycle-protection-and-appearance',
    names: [
      'GrantedAction',
      'DeathPrevention',
      'EffectEndCleanup',
      'SustainRequirement',
      'SensoryManifestation',
      'SensoryManifestationVariant',
      'SensoryManifestationSize',
      'IllusionMetadata',
      'IllusionRevealRule',
    ],
  },
  {
    fileName: '40-modifiers-and-controlled-entities.json',
    part: '40-modifiers-and-controlled-entities',
    names: [
      'AttackAugment',
      'AbilityCheckModifier',
      'ControlledEntity',
    ],
  },
];

// ============================================================================
// JSON IO And Semantic Comparison
// ============================================================================
// The aggregate file is generated with normal two-space JSON. For equivalence
// checks, keys are sorted recursively so the check proves data equality instead
// of enforcing a specific object key order.
// ============================================================================

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJson(entry));
  }

  if (value && typeof value === 'object') {
    const sorted: JsonObject = {};
    for (const key of Object.keys(value as JsonObject).sort()) {
      sorted[key] = sortJson((value as JsonObject)[key]);
    }
    return sorted;
  }

  return value;
}

function semanticString(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function listPartFiles(): string[] {
  if (!fs.existsSync(PARTS_DIR)) return [];
  return fs.readdirSync(PARTS_DIR)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => path.join(PARTS_DIR, entry))
    .sort((left, right) => left.localeCompare(right));
}

// ============================================================================
// Split And Compose
// ============================================================================
// Splitting writes one root part plus definition parts. Composing restores the
// single aggregate object expected by existing tools.
// ============================================================================

function splitAggregateIntoParts(): void {
  const aggregate = readJson<JsonObject>(AGGREGATE_PATH);
  const definitions = aggregate.definitions as JsonObject | undefined;

  if (!definitions || typeof definitions !== 'object') {
    throw new Error('spell.schema.json does not contain a definitions object to split.');
  }

  fs.rmSync(PARTS_DIR, { recursive: true, force: true });

  const rootContent: JsonObject = {};
  for (const [key, value] of Object.entries(aggregate)) {
    if (key !== 'definitions') rootContent[key] = value;
  }

  writeJson(path.join(PARTS_DIR, '00-schema-root.json'), {
    schemaKind: 'spell-json-schema',
    part: '00-schema-root',
    content: rootContent,
  } satisfies RootPart);

  const assigned = new Set<string>();
  for (const partPlan of DEFINITION_PARTS) {
    const partDefinitions: JsonObject = {};

    for (const name of partPlan.names) {
      if (!(name in definitions)) {
        throw new Error(`Definition part ${partPlan.part} expected missing definition ${name}.`);
      }
      partDefinitions[name] = definitions[name];
      assigned.add(name);
    }

    writeJson(path.join(PARTS_DIR, partPlan.fileName), {
      schemaKind: 'spell-json-schema',
      part: partPlan.part,
      definitionCount: Object.keys(partDefinitions).length,
      definitions: partDefinitions,
    } satisfies DefinitionPart);
  }

  const unassigned = Object.keys(definitions).filter((name) => !assigned.has(name));
  if (unassigned.length > 0) {
    throw new Error(`Unassigned schema definitions: ${unassigned.join(', ')}`);
  }

  console.log(`[split] spell JSON Schema: wrote ${listPartFiles().length} parts to ${path.relative(REPO_ROOT, PARTS_DIR)}`);
}

function composeAggregateFromParts(): JsonObject {
  const rootFile = path.join(PARTS_DIR, '00-schema-root.json');
  const rootPart = readJson<RootPart>(rootFile);
  const aggregate: JsonObject = { ...rootPart.content, definitions: {} };
  const definitions = aggregate.definitions as JsonObject;

  for (const partFile of listPartFiles()) {
    if (path.basename(partFile) === '00-schema-root.json') continue;
    const part = readJson<DefinitionPart>(partFile);
    for (const [name, definition] of Object.entries(part.definitions)) {
      definitions[name] = definition;
    }
  }

  return aggregate;
}

function checkAggregateMatchesParts(): boolean {
  const aggregate = readJson<JsonObject>(AGGREGATE_PATH);
  const composed = composeAggregateFromParts();
  const matches = semanticString(aggregate) === semanticString(composed);

  if (matches) {
    console.log(`[check] spell JSON Schema: aggregate semantically matches ${listPartFiles().length} parts`);
    return true;
  }

  console.error('[check] spell JSON Schema: aggregate does not semantically match schema parts');
  return false;
}

function writeAggregateFromParts(): void {
  const aggregate = composeAggregateFromParts();
  writeJson(AGGREGATE_PATH, aggregate);
  console.log(`[write] spell JSON Schema: wrote aggregate to ${path.relative(REPO_ROOT, AGGREGATE_PATH)}`);
}

// ============================================================================
// Command Line Entrypoint
// ============================================================================
// Check mode is non-mutating and should be cheap enough to run after mechanics
// batches. Split and write modes are explicit because they change files.
// ============================================================================

const mode = process.argv[2] ?? '--check';

if (!['--split-from-aggregate', '--check', '--write-aggregate'].includes(mode)) {
  console.error('Usage: npx tsx scripts\\syncSpellJsonSchemaRegistry.ts [--split-from-aggregate|--check|--write-aggregate]');
  process.exit(1);
}

if (mode === '--split-from-aggregate') {
  splitAggregateIntoParts();
  process.exit(0);
}

if (mode === '--write-aggregate') {
  writeAggregateFromParts();
  process.exit(0);
}

if (!checkAggregateMatchesParts()) {
  process.exit(1);
}
