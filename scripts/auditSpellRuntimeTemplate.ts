import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This script checks whether the spell corpus follows one strict conversion template.
 *
 * The normal spell validator proves that the runtime JSON has the broad shape the
 * game can load. This audit asks a narrower trust question: "did the canonical
 * markdown, structured markdown, and runtime JSON avoid drifting into local field
 * names, placeholder geometry, or contradictory condition/range/casting data?"
 *
 * Called by: agents and maintainers running `npx tsx scripts/auditSpellRuntimeTemplate.ts`
 * Depends on: `docs/spells/reference/**` for structured markdown and
 * `public/data/spells/**` for runtime JSON.
 */

// ============================================================================
// Paths And Report Shape
// ============================================================================
// This section defines where the audit reads spell data and where it writes the
// review artifacts. The report is intentionally separate from the existing
// schema/parity reports so it can mature without disturbing the current gates.
// ============================================================================

const REPO_ROOT = process.cwd();
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SPELL_REFERENCE_ROOT = path.join(REPO_ROOT, 'docs', 'spells', 'reference');
const SPELL_JSON_ROOT = path.join(REPO_ROOT, 'public', 'data', 'spells');
const REPORT_JSON_PATH = path.join(
  REPO_ROOT,
  '.agent',
  'roadmap-local',
  'spell-validation',
  'spell-runtime-template-audit.json',
);
const REPORT_MD_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md');

type TemplateSeverity = 'error' | 'warning';

interface TemplateIssue {
  severity: TemplateSeverity;
  code: string;
  spellId: string;
  spellName: string;
  source: 'structured-markdown' | 'runtime-json' | 'structured-vs-json';
  fieldPath: string;
  message: string;
  actualValue: string;
  expectedValue: string;
  filePath: string;
}

interface IssueGroup {
  code: string;
  severity: TemplateSeverity;
  source: TemplateIssue['source'];
  fieldPath: string;
  count: number;
  sampleSpellIds: string[];
  sampleMessages: string[];
}

interface TemplateAuditReport {
  generatedAt: string;
  spellCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  groupedIssues: IssueGroup[];
  issues: TemplateIssue[];
}

interface StructuredSpell {
  spellId: string;
  spellName: string;
  filePath: string;
  labels: Map<string, string>;
}

// ============================================================================
// Strict Template Vocabulary
// ============================================================================
// This section is the canonical field vocabulary for the current strict audit.
// If a future bucket needs a new field, it should be added here deliberately
// instead of appearing as an unreviewed one-off label in a spell file.
// ============================================================================

const CANONICAL_STRUCTURED_LABELS = new Set([
  'Level',
  'School',
  'Ritual',
  'Classes',
  'Sub-Classes',
  'Casting Time Value',
  'Casting Time Unit',
  'Combat Cost',
  'Reaction Trigger',
  'Range Type',
  'Range Distance',
  'Range Distance Unit',
  'Targeting Type',
  'Targeting Range',
  'Targeting Range Unit',
  'Targeting Max',
  'Valid Targets',
  'Line of Sight',
  'Area Shape',
  'Area Size',
  'Area Size Type',
  'Area Size Unit',
  'Area Height',
  'Area Height Unit',
  'Area Width',
  'Area Width Unit',
  'Area Thickness',
  'Area Thickness Unit',
  'Area Follows Caster',
  'Verbal',
  'Somatic',
  'Material',
  'Material Description',
  'Material Cost GP',
  'Consumed',
  'Duration Type',
  'Duration Value',
  'Duration Unit',
  'Concentration',
  'Effect Type',
  'Attack Roll',
  'Damage Dice',
  'Damage Flat',
  'Damage Type',
  'Secondary Damage Dice',
  'Secondary Damage Type',
  'Healing Dice',
  'Save Stat',
  'Save Outcome',
  'Secondary Save Stat',
  'Secondary Save Outcome',
  'Conditions Applied',
  'Utility Type',
  'Terrain Type',
  'Defense Type',
  'Defense Value',
  'Attack Roll Modifier',
  'Attack Roll Direction',
  'Attack Roll Kind',
  'Attack Roll Consumption',
  'Attack Roll Duration',
  'Attack Roll Notes',
  'Description',
  'Higher Levels',
]);

const NUMBERED_STRUCTURED_LABEL_PATTERNS = [
  /^Spatial Form \d+ (Label|Shape|Size Value|Size Type|Size Unit|Height Value|Height Unit|Width Value|Width Unit|Thickness Value|Thickness Unit|Segment Count|Segment Width Value|Segment Width Unit|Segment Height Value|Segment Height Unit|Notes)$/,
  /^Spatial Detail \d+ (Label|Kind|Subject|Value|Unit|Qualifier|Notes)$/,
];

const DEPRECATED_LABEL_REPLACEMENTS = new Map([
  ['Range Unit', 'Range Distance Unit'],
  ['Effect Types', 'Effect Type'],
  ['Condition', 'Conditions Applied'],
  ['Primary Damage Dice', 'Damage Dice'],
  ['Primary Damage Type', 'Damage Type'],
  ['Additional Damage', 'Secondary Damage Dice / Secondary Damage Type'],
  ['Exploration Time Value', 'Casting Time Value / Casting Time Unit'],
  ['Exploration Time Unit', 'Casting Time Value / Casting Time Unit'],
  ['Exploration Cost Value', 'Casting Time Value / Casting Time Unit'],
  ['Exploration Cost Unit', 'Casting Time Value / Casting Time Unit'],
]);

const CASTING_TIME_UNITS = new Set(['action', 'bonus_action', 'reaction', 'minute', 'hour', 'special']);
const RANGE_TYPES = new Set(['self', 'touch', 'ranged', 'sight', 'unlimited', 'special']);
const DISTANCE_UNITS = new Set(['feet', 'miles', 'inches']);
const DURATION_TYPES = new Set(['instantaneous', 'timed', 'special', 'until_dispelled', 'until_dispelled_or_triggered']);
const DURATION_UNITS = new Set(['round', 'minute', 'hour', 'day']);
const AREA_SHAPES = new Set(['Cone', 'Cube', 'Cylinder', 'Line', 'Sphere', 'Square', 'Circle', 'Emanation', 'Wall', 'Hemisphere', 'Ring', 'N/A']);
const AREA_SIZE_TYPES = new Set(['radius', 'diameter', 'length', 'edge', 'side']);
const TARGETING_TYPES = new Set(['self', 'single', 'multi', 'area', 'melee', 'ranged', 'point']);
const VALID_TARGETS = new Set(['self', 'creatures', 'allies', 'enemies', 'objects', 'point', 'ground']);
const SAVE_OUTCOMES = new Set(['none', 'half', 'negates_condition']);
const EFFECT_TYPES = new Set([
  'DAMAGE',
  'HEALING',
  'STATUS_CONDITION',
  'ATTACK_ROLL_MODIFIER',
  'MOVEMENT',
  'SUMMONING',
  'TERRAIN',
  'UTILITY',
  'DEFENSIVE',
]);

// ============================================================================
// Generic Data Helpers
// ============================================================================
// This section keeps all unknown JSON access narrow. Spell JSON is dynamic while
// the corpus is being converted, so these helpers let the audit inspect it
// without weakening the rest of the TypeScript file with broad casts.
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const child = value[key];
  return isRecord(child) ? child : null;
}

function getString(value: unknown, key: string): string {
  if (!isRecord(value)) return '';
  const child = value[key];
  return typeof child === 'string' ? child : '';
}

function getNumber(value: unknown, key: string): number {
  if (!isRecord(value)) return 0;
  const child = value[key];
  return typeof child === 'number' && Number.isFinite(child) ? child : 0;
}

function getBoolean(value: unknown, key: string): boolean {
  if (!isRecord(value)) return false;
  const child = value[key];
  return typeof child === 'boolean' ? child : false;
}

function hasOwnField(value: unknown, key: string): boolean {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function getArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) return [];
  const child = value[key];
  return Array.isArray(child) ? child : [];
}

function normalizeListEntry(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function splitCsvLike(value: string): string[] {
  return value
    .split(',')
    .map(normalizeListEntry)
    .filter(Boolean);
}

function normalizeConditionName(value: string): string {
  return normalizeListEntry(value).toLowerCase();
}

// ============================================================================
// File Loading
// ============================================================================
// This section reads structured markdown and runtime JSON in the same level
// layout used by the rest of the spell pipeline. It skips no spell intentionally:
// missing pairs are themselves part of conversion health.
// ============================================================================

function walkFiles(root: string, extension: string): string[] {
  const files: string[] = [];

  function walk(currentPath: string): void {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function parseStructuredSpell(markdownPath: string): StructuredSpell {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const lines = markdown.split(/\r?\n/);
  const spellId = path.basename(markdownPath, '.md');
  const heading = lines.find((line) => line.startsWith('# '));
  const spellName = heading ? heading.replace(/^#\s+/, '').trim() : spellId;
  const labels = new Map<string, string>();

  for (const line of lines) {
    // Only the validator-facing structured bullet lines count here. Prose and
    // canonical snapshot comments are intentionally ignored by this strict pass.
    const match = line.match(/^- \*\*([^*]+)\*\*:\s*(.*)$/);
    if (!match) continue;
    labels.set(match[1].trim(), (match[2] ?? '').trim());
  }

  return {
    spellId,
    spellName,
    filePath: markdownPath,
    labels,
  };
}

function findJsonPathForSpell(spellId: string): string | null {
  for (let level = 0; level <= 9; level += 1) {
    const candidate = path.join(SPELL_JSON_ROOT, `level-${level}`, `${spellId}.json`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function loadJsonSpell(jsonPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
}

// ============================================================================
// Issue Collection
// ============================================================================
// This section gives every check a consistent way to describe drift. The report
// groups by code later, so each message should explain the local spell fact and
// each code should explain the repeated family of problems.
// ============================================================================

function pushIssue(
  issues: TemplateIssue[],
  issue: Omit<TemplateIssue, 'filePath'> & { filePath?: string },
): void {
  issues.push({
    ...issue,
    filePath: issue.filePath ?? '',
  });
}

function groupIssues(issues: TemplateIssue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();

  for (const issue of issues) {
    const key = `${issue.severity}::${issue.source}::${issue.code}::${issue.fieldPath}`;
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      if (existing.sampleSpellIds.length < 12 && !existing.sampleSpellIds.includes(issue.spellId)) {
        existing.sampleSpellIds.push(issue.spellId);
      }
      if (existing.sampleMessages.length < 5) {
        existing.sampleMessages.push(issue.message);
      }
      continue;
    }

    groups.set(key, {
      code: issue.code,
      severity: issue.severity,
      source: issue.source,
      fieldPath: issue.fieldPath,
      count: 1,
      sampleSpellIds: [issue.spellId],
      sampleMessages: [issue.message],
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.severity !== right.severity) return left.severity === 'error' ? -1 : 1;
    if (right.count !== left.count) return right.count - left.count;
    return left.code.localeCompare(right.code);
  });
}

// ============================================================================
// Structured Markdown Checks
// ============================================================================
// This section protects the human-authored conversion template. It catches drift
// before sync scripts have a chance to silently ignore fields they do not know.
// ============================================================================

function isKnownStructuredLabel(label: string): boolean {
  if (CANONICAL_STRUCTURED_LABELS.has(label)) return true;
  return NUMBERED_STRUCTURED_LABEL_PATTERNS.some((pattern) => pattern.test(label));
}

function checkStructuredEnum(
  issues: TemplateIssue[],
  spell: StructuredSpell,
  label: string,
  allowedValues: Set<string>,
): void {
  const value = spell.labels.get(label);
  if (value == null || value === '') return;

  if (!allowedValues.has(value)) {
    pushIssue(issues, {
      severity: 'error',
      code: 'structured-enum-drift',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-markdown',
      fieldPath: label,
      message: `${spell.spellName} uses a non-template value for ${label}.`,
      actualValue: value,
      expectedValue: Array.from(allowedValues).join(', '),
      filePath: spell.filePath,
    });
  }
}

function checkStructuredCsvEnum(
  issues: TemplateIssue[],
  spell: StructuredSpell,
  label: string,
  allowedValues: Set<string>,
): void {
  const value = spell.labels.get(label);
  if (value == null || value === '') return;

  for (const entry of splitCsvLike(value)) {
    if (allowedValues.has(entry)) continue;

    pushIssue(issues, {
      severity: 'error',
      code: 'structured-list-value-drift',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-markdown',
      fieldPath: label,
      message: `${spell.spellName} uses "${entry}" inside ${label}, but the strict template only accepts registered values.`,
      actualValue: value,
      expectedValue: Array.from(allowedValues).join(', '),
      filePath: spell.filePath,
    });
  }
}

function checkStructuredLabels(issues: TemplateIssue[], spell: StructuredSpell): void {
  for (const [label, value] of spell.labels) {
    const replacement = DEPRECATED_LABEL_REPLACEMENTS.get(label);
    if (replacement) {
      pushIssue(issues, {
        severity: 'error',
        code: 'structured-deprecated-label',
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'structured-markdown',
        fieldPath: label,
        message: `${spell.spellName} uses "${label}", which should be folded into the strict template field "${replacement}".`,
        actualValue: value,
        expectedValue: replacement,
        filePath: spell.filePath,
      });
      continue;
    }

    if (!isKnownStructuredLabel(label)) {
      pushIssue(issues, {
        severity: 'warning',
        code: 'structured-unregistered-label',
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'structured-markdown',
        fieldPath: label,
        message: `${spell.spellName} uses "${label}", which is not registered in the strict template vocabulary yet.`,
        actualValue: value,
        expectedValue: 'Register this label or migrate it into an existing strict field.',
        filePath: spell.filePath,
      });
    }
  }
}

function checkStructuredValues(issues: TemplateIssue[], spell: StructuredSpell): void {
  checkStructuredEnum(issues, spell, 'Casting Time Unit', CASTING_TIME_UNITS);
  checkStructuredEnum(issues, spell, 'Range Type', RANGE_TYPES);
  checkStructuredEnum(issues, spell, 'Range Distance Unit', DISTANCE_UNITS);
  checkStructuredEnum(issues, spell, 'Area Shape', AREA_SHAPES);
  checkStructuredEnum(issues, spell, 'Area Size Type', AREA_SIZE_TYPES);
  checkStructuredEnum(issues, spell, 'Area Size Unit', DISTANCE_UNITS);
  checkStructuredEnum(issues, spell, 'Targeting Type', TARGETING_TYPES);
  checkStructuredEnum(issues, spell, 'Targeting Range Unit', DISTANCE_UNITS);
  checkStructuredEnum(issues, spell, 'Duration Type', DURATION_TYPES);
  checkStructuredEnum(issues, spell, 'Duration Unit', DURATION_UNITS);
  checkStructuredCsvEnum(issues, spell, 'Valid Targets', VALID_TARGETS);
  checkStructuredCsvEnum(issues, spell, 'Save Outcome', SAVE_OUTCOMES);
  checkStructuredCsvEnum(issues, spell, 'Effect Type', EFFECT_TYPES);
}

// ============================================================================
// Runtime JSON Checks
// ============================================================================
// This section catches JSON that passes the broad Zod schema but still carries
// contradictory or placeholder data that would confuse runtime spell execution.
// ============================================================================

function checkRuntimeJson(issues: TemplateIssue[], spell: StructuredSpell, jsonPath: string, json: Record<string, unknown>): void {
  const castingTime = getRecord(json, 'castingTime');
  const combatCost = getRecord(castingTime, 'combatCost');
  const castingUnit = getString(castingTime, 'unit');
  const combatCostType = getString(combatCost, 'type');

  if (['action', 'bonus_action', 'reaction'].includes(castingUnit) && combatCostType !== castingUnit) {
    pushIssue(issues, {
      severity: 'error',
      code: 'runtime-casting-cost-mismatch',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'runtime-json',
      fieldPath: 'castingTime.combatCost.type',
      message: `${spell.spellName} casts as ${castingUnit}, but its combat cost is stored as ${combatCostType}.`,
      actualValue: combatCostType,
      expectedValue: castingUnit,
      filePath: jsonPath,
    });
  }

  const range = getRecord(json, 'range');
  const rangeDistance = getNumber(range, 'distance');
  if (rangeDistance > 0 && !hasOwnField(range, 'distanceUnit')) {
    pushIssue(issues, {
      severity: 'error',
      code: 'runtime-distance-missing-unit',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'runtime-json',
      fieldPath: 'range.distanceUnit',
      message: `${spell.spellName} has a measured cast range but no explicit range unit.`,
      actualValue: '<missing>',
      expectedValue: 'feet, miles, or inches',
      filePath: jsonPath,
    });
  }

  const targeting = getRecord(json, 'targeting');
  const targetingRange = getNumber(targeting, 'range');
  if (targetingRange > 0 && !hasOwnField(targeting, 'rangeUnit')) {
    pushIssue(issues, {
      severity: 'error',
      code: 'runtime-distance-missing-unit',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'runtime-json',
      fieldPath: 'targeting.rangeUnit',
      message: `${spell.spellName} has a measured targeting range but no explicit targeting unit.`,
      actualValue: '<missing>',
      expectedValue: 'feet, miles, or inches',
      filePath: jsonPath,
    });
  }

  const areaOfEffect = getRecord(targeting, 'areaOfEffect');
  const targetingType = getString(targeting, 'type');
  const areaSize = getNumber(areaOfEffect, 'size');

  if (areaSize === 0) {
    pushIssue(issues, {
      severity: 'error',
      code: 'runtime-area-placeholder',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'runtime-json',
      fieldPath: 'targeting.areaOfEffect.size',
      message: `${spell.spellName} still carries a zero-size area placeholder instead of omitting or modeling the area fact deliberately.`,
      actualValue: '0',
      expectedValue: 'No placeholder area object, or a positive area size for area spells.',
      filePath: jsonPath,
    });
  }

  if (targetingType !== 'area' && areaSize > 0) {
    pushIssue(issues, {
      severity: 'error',
      code: 'runtime-non-area-has-area',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'runtime-json',
      fieldPath: 'targeting.areaOfEffect',
      message: `${spell.spellName} is not marked as an area spell but still has positive area geometry.`,
      actualValue: `${targetingType} / ${areaSize}`,
      expectedValue: 'targeting.type area, or no positive area geometry',
      filePath: jsonPath,
    });
  }

  if (targetingType === 'area' && areaSize <= 0) {
    pushIssue(issues, {
      severity: 'error',
      code: 'runtime-area-missing-geometry',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'runtime-json',
      fieldPath: 'targeting.areaOfEffect.size',
      message: `${spell.spellName} is marked as an area spell but does not have positive area geometry.`,
      actualValue: String(areaSize),
      expectedValue: 'A positive area size and explicit shape.',
      filePath: jsonPath,
    });
  }

  const components = getRecord(json, 'components');
  if (
    components
    && !getBoolean(components, 'material')
    && (
      getString(components, 'materialDescription').length > 0
      || getNumber(components, 'materialCost') !== 0
      || getBoolean(components, 'isConsumed')
    )
  ) {
    pushIssue(issues, {
      severity: 'error',
      code: 'runtime-non-material-has-material-payload',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'runtime-json',
      fieldPath: 'components',
      message: `${spell.spellName} says material is false but still carries material detail fields.`,
      actualValue: JSON.stringify(components),
      expectedValue: 'material false with empty material description, 0 cost, and not consumed',
      filePath: jsonPath,
    });
  }

  const effects = getArray(json, 'effects');
  effects.forEach((effect, index) => {
    const condition = getRecord(effect, 'condition');
    if (!condition) return;

    const conditionType = getString(condition, 'type');
    const carriesSaveFields = hasOwnField(condition, 'saveType') || hasOwnField(condition, 'saveEffect');

    if (conditionType !== 'save' && carriesSaveFields) {
      pushIssue(issues, {
        severity: 'error',
        code: 'runtime-condition-placeholder',
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'runtime-json',
        fieldPath: `effects[${index}].condition`,
        message: `${spell.spellName} has a ${conditionType} effect condition that still carries save-only fields.`,
        actualValue: JSON.stringify(condition),
        expectedValue: 'Only save conditions should carry saveType/saveEffect.',
        filePath: jsonPath,
      });
    }

    if (conditionType === 'save' && (!hasOwnField(condition, 'saveType') || !hasOwnField(condition, 'saveEffect'))) {
      pushIssue(issues, {
        severity: 'error',
        code: 'runtime-save-condition-incomplete',
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'runtime-json',
        fieldPath: `effects[${index}].condition`,
        message: `${spell.spellName} has a save condition without both saveType and saveEffect.`,
        actualValue: JSON.stringify(condition),
        expectedValue: 'saveType and saveEffect',
        filePath: jsonPath,
      });
    }
  });
}

// ============================================================================
// Structured-To-Runtime Mechanical Checks
// ============================================================================
// This section checks template details that the existing display-oriented parity
// report does not compare yet. Conditions are the first priority because they
// directly affect whether a spell can run as a mechanical effect.
// ============================================================================

function collectRuntimeStatusConditions(json: Record<string, unknown>): Set<string> {
  const names = new Set<string>();

  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'STATUS_CONDITION') continue;

    const statusCondition = getRecord(effect, 'statusCondition');
    const name = getString(statusCondition, 'name');
    if (name) names.add(normalizeConditionName(name));
  }

  return names;
}

function checkStructuredRuntimeMechanicalParity(
  issues: TemplateIssue[],
  spell: StructuredSpell,
  jsonPath: string,
  json: Record<string, unknown>,
): void {
  const conditionValue = spell.labels.get('Conditions Applied') ?? '';
  const structuredConditions = splitCsvLike(conditionValue).filter((entry) => entry.toLowerCase() !== 'none');
  if (structuredConditions.length === 0) return;

  const runtimeConditions = collectRuntimeStatusConditions(json);

  for (const condition of structuredConditions) {
    if (runtimeConditions.has(normalizeConditionName(condition))) continue;

    pushIssue(issues, {
      severity: 'error',
      code: 'structured-condition-missing-runtime-effect',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-vs-json',
      fieldPath: 'Conditions Applied -> effects[].statusCondition.name',
      message: `${spell.spellName} lists "${condition}" in structured Conditions Applied, but runtime JSON has no matching STATUS_CONDITION effect.`,
      actualValue: condition,
      expectedValue: Array.from(runtimeConditions).join(', ') || 'A matching STATUS_CONDITION effect',
      filePath: jsonPath,
    });
  }
}

// ============================================================================
// Report Rendering
// ============================================================================
// This section turns the machine result into a short review document. The full
// issue list stays in JSON; the markdown report focuses on repeated problem
// families so the next migration pass can be planned by bucket.
// ============================================================================

function renderMarkdownReport(report: TemplateAuditReport): string {
  const lines = [
    '# Spell Runtime Template Audit Report',
    '',
    'This report checks the strict spell conversion template across structured markdown and runtime JSON.',
    '',
    `Generated: ${report.generatedAt}`,
    `Spells scanned: ${report.spellCount}`,
    `Total issues: ${report.issueCount}`,
    `Errors: ${report.errorCount}`,
    `Warnings: ${report.warningCount}`,
    `Grouped issue families: ${report.groupedIssues.length}`,
    '',
    'The normal spell validator can be green while this report is not. That means the game can load the JSON, but the spell corpus still has drift that can make conversion, targeting, conditions, or future runtime behavior unreliable.',
    '',
    '## Grouped Issues',
    '',
  ];

  for (const group of report.groupedIssues) {
    lines.push(`### ${group.code}`);
    lines.push('');
    lines.push(`- Severity: ${group.severity}`);
    lines.push(`- Source: ${group.source}`);
    lines.push(`- Field: ${group.fieldPath}`);
    lines.push(`- Occurrences: ${group.count}`);
    lines.push(`- Sample spells: ${group.sampleSpellIds.join(', ')}`);
    lines.push('- Sample messages:');
    for (const message of group.sampleMessages) {
      lines.push(`  - ${message}`);
    }
    lines.push('');
  }

  if (report.groupedIssues.length === 0) {
    lines.push('No strict-template issues found.');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function writeReport(report: TemplateAuditReport): void {
  fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(REPORT_MD_PATH, renderMarkdownReport(report), 'utf8');
}

// ============================================================================
// Main Audit
// ============================================================================
// This section ties the three checks together: structured vocabulary, runtime
// semantic consistency, and mechanical details that must survive conversion.
// ============================================================================

export function buildReport(): TemplateAuditReport {
  const issues: TemplateIssue[] = [];
  const structuredSpells = walkFiles(SPELL_REFERENCE_ROOT, '.md').map(parseStructuredSpell);

  for (const structuredSpell of structuredSpells) {
    checkStructuredLabels(issues, structuredSpell);
    checkStructuredValues(issues, structuredSpell);

    const jsonPath = findJsonPathForSpell(structuredSpell.spellId);
    if (!jsonPath) {
      pushIssue(issues, {
        severity: 'error',
        code: 'missing-runtime-json',
        spellId: structuredSpell.spellId,
        spellName: structuredSpell.spellName,
        source: 'structured-vs-json',
        fieldPath: 'runtime json file',
        message: `${structuredSpell.spellName} has structured markdown but no matching runtime JSON file.`,
        actualValue: '<missing>',
        expectedValue: 'public/data/spells/level-N/<spell-id>.json',
        filePath: structuredSpell.filePath,
      });
      continue;
    }

    const json = loadJsonSpell(jsonPath);
    checkRuntimeJson(issues, structuredSpell, jsonPath, json);
    checkStructuredRuntimeMechanicalParity(issues, structuredSpell, jsonPath, json);
  }

  const groupedIssues = groupIssues(issues);
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    generatedAt: new Date().toISOString(),
    spellCount: structuredSpells.length,
    issueCount: issues.length,
    errorCount,
    warningCount,
    groupedIssues,
    issues,
  };
}

function main(): void {
  const failOnIssues = process.argv.includes('--fail-on-issues');
  const report = buildReport();
  writeReport(report);

  console.log(`Strict spell template report written to ${REPORT_MD_PATH}`);
  console.log(`Machine-readable report written to ${REPORT_JSON_PATH}`);
  console.log(`Spells scanned: ${report.spellCount}`);
  console.log(`Issues: ${report.issueCount} (${report.errorCount} errors, ${report.warningCount} warnings)`);
  console.log(`Grouped issue families: ${report.groupedIssues.length}`);

  if (failOnIssues && report.errorCount > 0) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === SCRIPT_FILE
  : false;

if (isDirectRun) {
  main();
}
