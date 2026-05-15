import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyApplicabilityValue } from './spellTemplateApplicability';
import {
  AREA_TARGET_SELECTION_COUNTS,
  AREA_TARGET_SELECTION_MODES,
  AREA_TARGET_SELECTION_SCOPES,
  AREA_SHAPES,
  AREA_SIZE_TYPES,
  BOOLEAN_SENTINEL,
  CANONICAL_STRUCTURED_LABELS,
  CASTING_TIME_UNITS,
  CONDITIONAL_ENDING_SCOPES,
  CONDITIONAL_ENDING_TRIGGERS,
  DEPRECATED_LABEL_REPLACEMENTS,
  DISTANCE_UNITS,
  DURATION_TYPES,
  DURATION_UNITS,
  EFFECT_TYPES,
  EFFECT_SCHEDULE_TIMINGS,
  ESCAPE_CHECK_ABILITIES,
  ESCAPE_CHECK_ACTION_COSTS,
  ESCAPE_CHECK_ELIGIBLE_ACTORS,
  ILLUSION_DISCERNED_STATES,
  ILLUSION_REVEAL_ABILITIES,
  ILLUSION_REVEAL_ACTION_COSTS,
  ILLUSION_REVEAL_DCS,
  ILLUSION_REVEAL_METHODS,
  ILLUSION_REVEAL_SCOPES,
  ILLUSION_REVEAL_SKILLS,
  LIGHT_COLOR_CHOICES,
  MODE_CHOICE_OPTIONS_SOURCES,
  MODE_CHOICE_TIMINGS,
  MODE_CHOICE_TYPES,
  NUMBERED_STRUCTURED_LABEL_PATTERNS,
  PER_TARGET_CHOICE_SCOPES,
  PER_TARGET_CHOICE_TYPES,
  RANGE_TYPES,
  REPEAT_SAVE_TIMINGS,
  REPEAT_SAVE_PREREQUISITES,
  REPEAT_SAVE_TYPES,
  SAVE_AUTO_OUTCOME_CONDITIONS,
  SAVE_AUTO_OUTCOMES,
  SAVE_COVER_IGNORED,
  SAVE_OUTCOMES,
  SECONDARY_TARGET_MAX_LEAPS,
  SECONDARY_TARGET_ORIGINS,
  SECONDARY_TARGET_REPEAT_RULES,
  SECONDARY_TARGET_SELECTIONS,
  SECONDARY_TARGET_TRIGGERS,
  SECONDARY_TARGET_VALID_TARGETS,
  SENSORY_CHANNELS,
  SENSORY_MANIFESTATION_MODE_SOURCES,
  SENSORY_MANIFESTATION_SHAPES,
  SENSORY_MANIFESTATION_SIZE_UNITS,
  SENSORY_MANIFESTATION_TIMINGS,
  SENSORY_MANIFESTATION_VOLUME_RANGES,
  SOUND_RADIUS_UNITS,
  SOUND_SOURCES,
  SOUND_TRIGGERS,
  TARGET_ABILITY_THRESHOLD_ABILITIES,
  TARGET_ABILITY_THRESHOLD_OPERATORS,
  TARGET_COMMUNICATION_PREREQUISITE,
  TARGET_OBJECT_FIXED_TO_SURFACE,
  TARGET_OBJECT_MAGICAL_STATUS,
  TARGET_OBJECT_WORN_OR_CARRIED,
  TARGET_INSTANCE_ASSIGNMENTS,
  TARGET_INSTANCE_RESOLUTIONS,
  TARGET_INSTANCE_TYPES,
  TARGET_CLUSTER_REQUIREMENTS,
  TARGET_CLUSTER_SCOPES,
  TARGET_SELF_RELATION,
  TARGET_WILLINGNESS,
  TARGETING_TYPES,
  VALID_TARGETS,
} from './spellRuntimeTemplateAudit/vocabulary';

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
  if (classifyApplicabilityValue(value) === 'explicit_not_applicable') return;

  const isAllowed = Array.from(allowedValues).some((allowedValue) => allowedValue.toLowerCase() === value.toLowerCase());
  if (!isAllowed) {
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
  if (classifyApplicabilityValue(value) === 'explicit_not_applicable') return;

  for (const entry of splitCsvLike(value)) {
    const isAllowed = Array.from(allowedValues).some((allowedValue) => allowedValue.toLowerCase() === entry.toLowerCase());
    if (isAllowed) continue;

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
  checkStructuredEnum(issues, spell, 'Target Willingness', TARGET_WILLINGNESS);
  checkStructuredEnum(issues, spell, 'Target Object Worn Or Carried', TARGET_OBJECT_WORN_OR_CARRIED);
  checkStructuredEnum(issues, spell, 'Target Object Magical Status', TARGET_OBJECT_MAGICAL_STATUS);
  checkStructuredEnum(issues, spell, 'Target Object Fixed To Surface', TARGET_OBJECT_FIXED_TO_SURFACE);
  checkStructuredEnum(issues, spell, 'Target Can Hear Caster', TARGET_COMMUNICATION_PREREQUISITE);
  checkStructuredEnum(issues, spell, 'Target Can Understand Caster', TARGET_COMMUNICATION_PREREQUISITE);
  checkStructuredEnum(issues, spell, 'Target Can See Caster', TARGET_COMMUNICATION_PREREQUISITE);
  checkStructuredEnum(issues, spell, 'Target Ability Threshold Ability', TARGET_ABILITY_THRESHOLD_ABILITIES);
  checkStructuredEnum(issues, spell, 'Target Ability Threshold Operator', TARGET_ABILITY_THRESHOLD_OPERATORS);
  checkStructuredEnum(issues, spell, 'Target Self Relation', TARGET_SELF_RELATION);
  checkStructuredEnum(issues, spell, 'Area Target Selection Mode', AREA_TARGET_SELECTION_MODES);
  checkStructuredEnum(issues, spell, 'Area Target Selection Scope', AREA_TARGET_SELECTION_SCOPES);
  checkStructuredEnum(issues, spell, 'Area Target Selection Count', AREA_TARGET_SELECTION_COUNTS);
  checkStructuredEnum(issues, spell, 'Area Target Selection Excludes Unchosen', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Area Target Selection Requires Line Of Sight', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Target Instance Type', TARGET_INSTANCE_TYPES);
  checkStructuredEnum(issues, spell, 'Target Instance Assignment', TARGET_INSTANCE_ASSIGNMENTS);
  checkStructuredEnum(issues, spell, 'Target Instance Resolution', TARGET_INSTANCE_RESOLUTIONS);
  checkStructuredEnum(issues, spell, 'Target Cluster Requirement', TARGET_CLUSTER_REQUIREMENTS);
  checkStructuredEnum(issues, spell, 'Target Cluster Scope', TARGET_CLUSTER_SCOPES);
  checkStructuredEnum(issues, spell, 'Per Target Choice Type', PER_TARGET_CHOICE_TYPES);
  checkStructuredEnum(issues, spell, 'Per Target Choice Scope', PER_TARGET_CHOICE_SCOPES);
  checkStructuredEnum(issues, spell, 'Per Target Choice Different Choices Allowed', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Per Target Choice Required', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Secondary Target Trigger', SECONDARY_TARGET_TRIGGERS);
  checkStructuredEnum(issues, spell, 'Secondary Target Origin', SECONDARY_TARGET_ORIGINS);
  checkStructuredEnum(issues, spell, 'Secondary Target Range Unit', DISTANCE_UNITS);
  checkStructuredEnum(issues, spell, 'Secondary Target Valid Targets', SECONDARY_TARGET_VALID_TARGETS);
  checkStructuredEnum(issues, spell, 'Secondary Target Selection', SECONDARY_TARGET_SELECTIONS);
  checkStructuredEnum(issues, spell, 'Secondary Target Must Be Different', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Secondary Target Requires Line Of Sight', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Secondary Target Requires Attack Roll', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Secondary Target Requires Damage Roll', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Secondary Target Repeat Rule', SECONDARY_TARGET_REPEAT_RULES);
  checkStructuredEnum(issues, spell, 'Secondary Target Max Leaps', SECONDARY_TARGET_MAX_LEAPS);
  checkStructuredEnum(issues, spell, 'Secondary Target Unique Per Casting', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Mode Choice Type', MODE_CHOICE_TYPES);
  checkStructuredEnum(issues, spell, 'Mode Choice Timing', MODE_CHOICE_TIMINGS);
  checkStructuredEnum(issues, spell, 'Mode Choice Options Source', MODE_CHOICE_OPTIONS_SOURCES);
  checkStructuredEnum(issues, spell, 'Mode Choice Can Dismiss Active', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Effect Schedule Timing', EFFECT_SCHEDULE_TIMINGS);
  checkStructuredEnum(issues, spell, 'Targeting Range Unit', DISTANCE_UNITS);
  checkStructuredEnum(issues, spell, 'Duration Type', DURATION_TYPES);
  checkStructuredEnum(issues, spell, 'Duration Unit', DURATION_UNITS);
  checkStructuredCsvEnum(issues, spell, 'Valid Targets', VALID_TARGETS);
  checkStructuredCsvEnum(issues, spell, 'Save Outcome', SAVE_OUTCOMES);
  checkStructuredCsvEnum(issues, spell, 'Save Cover Ignored', SAVE_COVER_IGNORED);
  checkStructuredCsvEnum(issues, spell, 'Save Auto Outcome', SAVE_AUTO_OUTCOMES);
  checkStructuredCsvEnum(issues, spell, 'Save Auto Outcome Condition', SAVE_AUTO_OUTCOME_CONDITIONS);
  checkStructuredEnum(issues, spell, 'Repeat Save Timing', REPEAT_SAVE_TIMINGS);
  checkStructuredCsvEnum(issues, spell, 'Repeat Save Additional Timings', REPEAT_SAVE_TIMINGS);
  checkStructuredEnum(issues, spell, 'Repeat Save Type', REPEAT_SAVE_TYPES);
  checkStructuredEnum(issues, spell, 'Repeat Save Success Ends', BOOLEAN_SENTINEL);
  checkStructuredCsvEnum(issues, spell, 'Repeat Save Prerequisites', REPEAT_SAVE_PREREQUISITES);
  checkStructuredEnum(issues, spell, 'Escape Check Ability', ESCAPE_CHECK_ABILITIES);
  checkStructuredEnum(issues, spell, 'Escape Check Action Cost', ESCAPE_CHECK_ACTION_COSTS);
  checkStructuredCsvEnum(issues, spell, 'Escape Check Eligible Actors', ESCAPE_CHECK_ELIGIBLE_ACTORS);
  checkStructuredEnum(issues, spell, 'Sound Audible Radius Unit', SOUND_RADIUS_UNITS);
  checkStructuredEnum(issues, spell, 'Sound Source', SOUND_SOURCES);
  checkStructuredEnum(issues, spell, 'Sound Trigger', SOUND_TRIGGERS);
  checkStructuredCsvEnum(issues, spell, 'Conditional Ending Triggers', CONDITIONAL_ENDING_TRIGGERS);
  checkStructuredCsvEnum(issues, spell, 'Conditional Ending Scope', CONDITIONAL_ENDING_SCOPES);
  checkStructuredEnum(issues, spell, 'Sensory Manifestation Mode Source', SENSORY_MANIFESTATION_MODE_SOURCES);
  checkStructuredCsvEnum(issues, spell, 'Sensory Manifestation Variant 1 Allowed Senses', SENSORY_CHANNELS);
  checkStructuredCsvEnum(issues, spell, 'Sensory Manifestation Variant 1 Excluded Senses', SENSORY_CHANNELS);
  checkStructuredEnum(issues, spell, 'Sensory Manifestation Variant 1 Volume Range', SENSORY_MANIFESTATION_VOLUME_RANGES);
  checkStructuredEnum(issues, spell, 'Sensory Manifestation Variant 1 Timing', SENSORY_MANIFESTATION_TIMINGS);
  checkStructuredEnum(issues, spell, 'Sensory Manifestation Variant 1 Max Shape', SENSORY_MANIFESTATION_SHAPES);
  checkStructuredEnum(issues, spell, 'Sensory Manifestation Variant 1 Max Size Unit', SENSORY_MANIFESTATION_SIZE_UNITS);
  checkStructuredCsvEnum(issues, spell, 'Sensory Manifestation Variant 2 Allowed Senses', SENSORY_CHANNELS);
  checkStructuredCsvEnum(issues, spell, 'Sensory Manifestation Variant 2 Excluded Senses', SENSORY_CHANNELS);
  checkStructuredEnum(issues, spell, 'Sensory Manifestation Variant 2 Volume Range', SENSORY_MANIFESTATION_VOLUME_RANGES);
  checkStructuredEnum(issues, spell, 'Sensory Manifestation Variant 2 Timing', SENSORY_MANIFESTATION_TIMINGS);
  checkStructuredEnum(issues, spell, 'Sensory Manifestation Variant 2 Max Shape', SENSORY_MANIFESTATION_SHAPES);
  checkStructuredEnum(issues, spell, 'Sensory Manifestation Variant 2 Max Size Unit', SENSORY_MANIFESTATION_SIZE_UNITS);
  checkStructuredEnum(issues, spell, 'Illusion Reveal Scope', ILLUSION_REVEAL_SCOPES);
  checkStructuredCsvEnum(issues, spell, 'Illusion Reveal Methods', ILLUSION_REVEAL_METHODS);
  checkStructuredEnum(issues, spell, 'Illusion Reveal Action Cost', ILLUSION_REVEAL_ACTION_COSTS);
  checkStructuredEnum(issues, spell, 'Illusion Reveal Ability', ILLUSION_REVEAL_ABILITIES);
  checkStructuredEnum(issues, spell, 'Illusion Reveal Skill', ILLUSION_REVEAL_SKILLS);
  checkStructuredEnum(issues, spell, 'Illusion Reveal DC', ILLUSION_REVEAL_DCS);
  checkStructuredEnum(issues, spell, 'Illusion Discerned State', ILLUSION_DISCERNED_STATES);
  checkStructuredEnum(issues, spell, 'Light Color Choice', LIGHT_COLOR_CHOICES);
  checkStructuredEnum(issues, spell, 'Light Opaque Cover Blocks', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Light Emits Heat', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Light Ignites Objects', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Light Consumes Fuel', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Light Can Be Covered Or Hidden', BOOLEAN_SENTINEL);
  checkStructuredEnum(issues, spell, 'Light Can Be Smothered Or Quenched', BOOLEAN_SENTINEL);
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
  const spatialDetails = getRecord(targeting, 'spatialDetails');
  const hasSpatialForms = getArray(spatialDetails, 'forms').length > 0;

  if (areaOfEffect && areaSize === 0 && !hasSpatialForms) {
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

  // `targeting.type` describes how the caster selects the target, while
  // `areaOfEffect` describes the emitted footprint. Point spells, self auras,
  // and targeted payloads can legitimately carry area geometry without being
  // selected as `targeting.type === "area"`, so the audit must not collapse
  // those two runtime concepts into one invariant.

  if (targetingType === 'area' && areaSize <= 0 && !hasSpatialForms) {
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
  const aiContext = getRecord(json, 'aiContext');
  const aiPrompt = getString(aiContext, 'prompt');

  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'STATUS_CONDITION') continue;

    const statusCondition = getRecord(effect, 'statusCondition');
    const name = getString(statusCondition, 'name');
    for (const entry of splitCsvLike(name)) {
      names.add(normalizeConditionName(entry));
    }
  }

  // Choice spells can intentionally model one concrete runtime branch plus an
  // arbitration prompt that asks the player to choose the sibling condition.
  // Blindness/Deafness is the current case: runtime stores `Blinded`, while the
  // prompt explicitly names `Deafness` as the alternate choice. Treating that
  // as missing runtime truth would make the audit stricter than the modeled UX.
  if (/blindness or deafness/i.test(aiPrompt)) {
    names.add(normalizeConditionName('Deafened'));
  }

  return names;
}

function collectRuntimeConditionImmunities(json: Record<string, unknown>): Set<string> {
  const names = new Set<string>();

  // Condition immunity is carried by DEFENSIVE effects rather than
  // STATUS_CONDITION effects because it prevents a state from applying instead
  // of applying a state itself. Keeping the collector separate avoids mixing
  // "has condition" and "cannot gain condition" into one audit meaning.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'DEFENSIVE') continue;

    for (const conditionName of getArray(effect, 'conditionImmunity')) {
      if (typeof conditionName !== 'string') continue;
      names.add(normalizeConditionName(conditionName));
    }
  }

  return names;
}

function collectRuntimePreventionImmunities(json: Record<string, unknown>): Set<string> {
  const names = new Set<string>();

  // Prevention immunity is for blocked mechanics that are not named
  // conditions, such as hit point maximum reduction.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'DEFENSIVE') continue;

    for (const preventionName of getArray(effect, 'preventionImmunity')) {
      if (typeof preventionName !== 'string') continue;
      names.add(preventionName.toLowerCase());
    }
  }

  return names;
}

function collectRuntimeConditionSuppressions(json: Record<string, unknown>): Set<string> {
  const names = new Set<string>();

  // Suppression means "pause this existing state" rather than "prevent this
  // state from being applied." It therefore gets a separate audit collector so
  // Calm Emotions cannot pass by only recording immunity.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'DEFENSIVE') continue;

    for (const conditionName of getArray(effect, 'conditionSuppression')) {
      if (typeof conditionName !== 'string') continue;
      names.add(normalizeConditionName(conditionName));
    }
  }

  return names;
}

function collectRuntimeConditionRemovals(json: Record<string, unknown>): Set<string> {
  const names = new Set<string>();

  // Removal is a third condition path: it ends a condition already on the
  // target. The audit keeps it separate from applied conditions, immunity, and
  // suppression so a spell like Protection from Poison cannot pass by only
  // recording Poison resistance or future save advantage.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect)) continue;

    for (const conditionName of getArray(effect, 'conditionRemoval')) {
      if (typeof conditionName !== 'string') continue;
      names.add(normalizeConditionName(conditionName));
    }
  }

  return names;
}

function collectRuntimeExcludedDamageTypes(json: Record<string, unknown>): Set<string> {
  const names = new Set<string>();

  // Broad defenses sometimes need named exceptions. Feign Death is the first
  // closed case: it resists all damage, but Psychic damage remains outside the
  // protection. This collector keeps that exception visible to the parity gate.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'DEFENSIVE') continue;

    for (const damageType of getArray(effect, 'excludedDamageType')) {
      if (typeof damageType !== 'string') continue;
      names.add(normalizeConditionName(damageType));
    }
  }

  return names;
}

function collectRuntimeDefenseDamageTypeSources(json: Record<string, unknown>): Set<string> {
  const sources = new Set<string>();

  // Damage type source distinguishes static resistance from resistance chosen
  // by play context. This catches the Absorb Elements failure mode where an
  // eligible list looked like every listed resistance applied simultaneously.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'DEFENSIVE') continue;

    const source = getString(effect, 'damageTypeSource');
    if (source) sources.add(source.toLowerCase());
  }

  return sources;
}

function collectRuntimeDamageReductionValues(json: Record<string, unknown>, key: string): Set<string> {
  const values = new Set<string>();

  // Damage reduction has three small fields because each one answers a
  // different runtime question: amount, affected damage total, and consumption
  // frequency. The shared collector keeps those parity checks consistent.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'DEFENSIVE') continue;

    const damageReduction = getRecord(effect, 'damageReduction');
    const value = getString(damageReduction, key);
    if (value) values.add(value.toLowerCase());
  }

  return values;
}

function collectRuntimeDamageMitigationBypasses(json: Record<string, unknown>): Set<string> {
  const values = new Set<string>();

  // Mitigation bypass belongs to the damage packet itself. It tells runtime
  // damage resolution which reduction/prevention families to skip for damage
  // such as Wish stress, Life Transference self-cost, or Create Homunculus
  // self-cost.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'DAMAGE') continue;

    const damage = getRecord(effect, 'damage');
    if (!damage) continue;

    for (const value of getArray(damage, 'mitigationBypass')) {
      if (typeof value === 'string') values.add(value.toLowerCase());
    }
  }

  return values;
}

function collectRuntimeDefenseSourceFilterValues(json: Record<string, unknown>, key: string): Set<string> {
  const values = new Set<string>();

  // Source filters sit on defensive effects and describe what incoming source
  // qualifies for the defense. Arrays and single scalar fields share this
  // collector so category and magical-status checks stay in one place.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect) || getString(effect, 'type') !== 'DEFENSIVE') continue;

    const sourceFilter = getRecord(effect, 'defenseSourceFilter');
    if (!sourceFilter) continue;

    for (const value of getArray(sourceFilter, key)) {
      if (typeof value === 'string') values.add(value.toLowerCase());
    }

    const scalar = getString(sourceFilter, key);
    if (scalar) values.add(scalar.toLowerCase());
  }

  return values;
}

function collectRuntimeBarrierDamagePreventionValues(json: Record<string, unknown>, key: string): Set<string> {
  const values = new Set<string>();

  // Barrier damage prevention can live on utility or defensive effects because
  // barriers often combine targeting, containment, movement, and damage rules.
  // The parity check cares that the runtime exposes the mechanic somewhere.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect)) continue;

    const prevention = getRecord(effect, 'barrierDamagePrevention');
    if (!prevention) continue;

    for (const value of getArray(prevention, key)) {
      if (typeof value === 'string') values.add(value.toLowerCase());
    }
  }

  return values;
}

function collectRuntimeSpellEffectPreventionValues(json: Record<string, unknown>, key: string): Set<string> {
  const values = new Set<string>();

  // Spell-effect prevention can be represented on a defensive or utility effect.
  // The fields include strings, arrays, numbers, and booleans, so this collector
  // normalizes all primitive values to lowercase strings for parity checks.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect)) continue;

    const prevention = getRecord(effect, 'spellEffectPrevention');
    if (!prevention) continue;

    for (const value of getArray(prevention, key)) {
      if (typeof value === 'string') values.add(value.toLowerCase());
      if (typeof value === 'number' || typeof value === 'boolean') values.add(String(value).toLowerCase());
    }

    const scalar = prevention[key];
    if (typeof scalar === 'string') values.add(scalar.toLowerCase());
    if (typeof scalar === 'number' || typeof scalar === 'boolean') values.add(String(scalar).toLowerCase());
  }

  return values;
}

function collectRuntimeLinkedDamageValues(json: Record<string, unknown>, key: string): Set<string> {
  const values = new Set<string>();

  // Linked damage can be attached to utility effects because the link often
  // rides beside defenses and ending conditions. The parity check only needs to
  // prove that the runtime exposes the trigger, recipient, and amount.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect)) continue;

    const linkedDamage = getRecord(effect, 'linkedDamage');
    const value = getString(linkedDamage, key);
    if (value) values.add(value.toLowerCase());
  }

  return values;
}

function collectRuntimeResistanceSuppressionValues(json: Record<string, unknown>, key: string): Set<string> {
  const values = new Set<string>();

  // Resistance suppression can ride on utility or defensive effects because it
  // is a debuff to the target's existing defenses, not a defense granted by the
  // spell. The collector accepts either arrays or scalar fields so damage types
  // and their source enum can share one parity path.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect)) continue;

    const suppression = getRecord(effect, 'resistanceSuppression');
    if (!suppression) continue;

    for (const value of getArray(suppression, key)) {
      if (typeof value === 'string') values.add(value.toLowerCase());
    }

    const scalar = getString(suppression, key);
    if (scalar) values.add(scalar.toLowerCase());
  }

  return values;
}

function collectRuntimeDamageInteractionValues(json: Record<string, unknown>, key: string): Set<string> {
  const values = new Set<string>();

  // Damage interaction is used for mode/area mechanics that can grant
  // resistance or vulnerability. The collector is effect-type-neutral because
  // Hallow stores this as a utility area mode rather than a direct defense.
  for (const effect of getArray(json, 'effects')) {
    if (!isRecord(effect)) continue;

    const interaction = getRecord(effect, 'damageInteraction');
    if (!interaction) continue;

    for (const value of getArray(interaction, key)) {
      if (typeof value === 'string') values.add(value.toLowerCase());
    }

    const scalar = getString(interaction, key);
    if (scalar) values.add(scalar.toLowerCase());
  }

  return values;
}

function checkStructuredRuntimeMechanicalParity(
  issues: TemplateIssue[],
  spell: StructuredSpell,
  jsonPath: string,
  json: Record<string, unknown>,
): void {
  const conditionValue = spell.labels.get('Conditions Applied') ?? '';
  const structuredConditions =
    classifyApplicabilityValue(conditionValue) === 'explicit_not_applicable'
      ? []
      : splitCsvLike(conditionValue).filter((entry) => entry.toLowerCase() !== 'none');

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

  const conditionRemovalValue = spell.labels.get('Conditions Removed') ?? '';
  const structuredRemovals =
    classifyApplicabilityValue(conditionRemovalValue) === 'explicit_not_applicable'
      ? []
      : splitCsvLike(conditionRemovalValue).filter((entry) => entry.toLowerCase() !== 'none');

  const runtimeRemovals = collectRuntimeConditionRemovals(json);

  for (const condition of structuredRemovals) {
    if (runtimeRemovals.has(normalizeConditionName(condition))) continue;

    pushIssue(issues, {
      severity: 'error',
      code: 'structured-condition-removal-missing-runtime-effect',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-vs-json',
      fieldPath: 'Conditions Removed -> effects[].conditionRemoval[]',
      message: `${spell.spellName} lists "${condition}" in structured Conditions Removed, but runtime JSON has no matching conditionRemoval entry.`,
      actualValue: condition,
      expectedValue: Array.from(runtimeRemovals).join(', ') || 'A matching conditionRemoval entry',
      filePath: jsonPath,
    });
  }

  const conditionImmunityValue = spell.labels.get('Condition Immunities') ?? '';
  const structuredImmunities =
    classifyApplicabilityValue(conditionImmunityValue) === 'explicit_not_applicable'
      ? []
      : splitCsvLike(conditionImmunityValue).filter((entry) => entry.toLowerCase() !== 'none');

  const runtimeImmunities = collectRuntimeConditionImmunities(json);

  for (const condition of structuredImmunities) {
    if (runtimeImmunities.has(normalizeConditionName(condition))) continue;

    pushIssue(issues, {
      severity: 'error',
      code: 'structured-condition-immunity-missing-runtime-effect',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-vs-json',
      fieldPath: 'Condition Immunities -> effects[].conditionImmunity[]',
      message: `${spell.spellName} lists "${condition}" in structured Condition Immunities, but runtime JSON has no matching defensive conditionImmunity entry.`,
      actualValue: condition,
      expectedValue: Array.from(runtimeImmunities).join(', ') || 'A matching conditionImmunity entry',
      filePath: jsonPath,
    });
  }

  const preventionImmunityValue = spell.labels.get('Prevention Immunities') ?? '';
  const structuredPreventionImmunities =
    classifyApplicabilityValue(preventionImmunityValue) === 'explicit_not_applicable'
      ? []
      : splitCsvLike(preventionImmunityValue).filter((entry) => entry.toLowerCase() !== 'none');

  const runtimePreventionImmunities = collectRuntimePreventionImmunities(json);

  for (const prevention of structuredPreventionImmunities) {
    if (runtimePreventionImmunities.has(prevention.toLowerCase())) continue;

    pushIssue(issues, {
      severity: 'error',
      code: 'structured-prevention-immunity-missing-runtime-effect',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-vs-json',
      fieldPath: 'Prevention Immunities -> effects[].preventionImmunity[]',
      message: `${spell.spellName} lists "${prevention}" in structured Prevention Immunities, but runtime JSON has no matching defensive preventionImmunity entry.`,
      actualValue: prevention,
      expectedValue: Array.from(runtimePreventionImmunities).join(', ') || 'A matching preventionImmunity entry',
      filePath: jsonPath,
    });
  }

  const damageTypeExclusionValue = spell.labels.get('Damage Type Exclusions') ?? '';
  const structuredDamageTypeExclusions =
    classifyApplicabilityValue(damageTypeExclusionValue) === 'explicit_not_applicable'
      ? []
      : splitCsvLike(damageTypeExclusionValue).filter((entry) => entry.toLowerCase() !== 'none');

  const runtimeDamageTypeExclusions = collectRuntimeExcludedDamageTypes(json);

  for (const damageType of structuredDamageTypeExclusions) {
    if (runtimeDamageTypeExclusions.has(normalizeConditionName(damageType))) continue;

    pushIssue(issues, {
      severity: 'error',
      code: 'structured-damage-type-exclusion-missing-runtime-effect',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-vs-json',
      fieldPath: 'Damage Type Exclusions -> effects[].excludedDamageType[]',
      message: `${spell.spellName} lists "${damageType}" in structured Damage Type Exclusions, but runtime JSON has no matching defensive excludedDamageType entry.`,
      actualValue: damageType,
      expectedValue: Array.from(runtimeDamageTypeExclusions).join(', ') || 'A matching excludedDamageType entry',
      filePath: jsonPath,
    });
  }

  const damageTypeSourceValue = spell.labels.get('Defense Damage Type Source') ?? '';
  const structuredDamageTypeSources =
    classifyApplicabilityValue(damageTypeSourceValue) === 'explicit_not_applicable'
      ? []
      : splitCsvLike(damageTypeSourceValue).filter((entry) => entry.toLowerCase() !== 'none');

  const runtimeDamageTypeSources = collectRuntimeDefenseDamageTypeSources(json);

  for (const source of structuredDamageTypeSources) {
    if (runtimeDamageTypeSources.has(source.toLowerCase())) continue;

    pushIssue(issues, {
      severity: 'error',
      code: 'structured-defense-damage-type-source-missing-runtime-effect',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-vs-json',
      fieldPath: 'Defense Damage Type Source -> effects[].damageTypeSource',
      message: `${spell.spellName} lists "${source}" in structured Defense Damage Type Source, but runtime JSON has no matching defensive damageTypeSource entry.`,
      actualValue: source,
      expectedValue: Array.from(runtimeDamageTypeSources).join(', ') || 'A matching damageTypeSource entry',
      filePath: jsonPath,
    });
  }

  const damageMitigationBypassValue = spell.labels.get('Damage Mitigation Bypass') ?? '';
  const structuredDamageMitigationBypasses =
    classifyApplicabilityValue(damageMitigationBypassValue) === 'explicit_not_applicable'
      ? []
      : splitCsvLike(damageMitigationBypassValue).filter((entry) => entry.toLowerCase() !== 'none');

  const runtimeDamageMitigationBypasses = collectRuntimeDamageMitigationBypasses(json);

  for (const bypass of structuredDamageMitigationBypasses) {
    if (runtimeDamageMitigationBypasses.has(bypass.toLowerCase())) continue;

    pushIssue(issues, {
      severity: 'error',
      code: 'structured-damage-mitigation-bypass-missing-runtime-effect',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-vs-json',
      fieldPath: 'Damage Mitigation Bypass -> effects[].damage.mitigationBypass[]',
      message: `${spell.spellName} lists "${bypass}" in structured Damage Mitigation Bypass, but runtime JSON has no matching damage.mitigationBypass entry.`,
      actualValue: bypass,
      expectedValue: Array.from(runtimeDamageMitigationBypasses).join(', ') || 'A matching damage.mitigationBypass entry',
      filePath: jsonPath,
    });
  }

  const damageReductionChecks = [
    {
      label: 'Damage Reduction Dice',
      runtimeKey: 'dice',
      code: 'structured-damage-reduction-dice-missing-runtime-effect',
      fieldPath: 'Damage Reduction Dice -> effects[].damageReduction.dice',
    },
    {
      label: 'Damage Reduction Applies To',
      runtimeKey: 'appliesTo',
      code: 'structured-damage-reduction-applies-to-missing-runtime-effect',
      fieldPath: 'Damage Reduction Applies To -> effects[].damageReduction.appliesTo',
    },
    {
      label: 'Damage Reduction Frequency',
      runtimeKey: 'frequency',
      code: 'structured-damage-reduction-frequency-missing-runtime-effect',
      fieldPath: 'Damage Reduction Frequency -> effects[].damageReduction.frequency',
    },
  ];

  for (const check of damageReductionChecks) {
    const structuredValue = spell.labels.get(check.label) ?? '';
    const structuredEntries =
      classifyApplicabilityValue(structuredValue) === 'explicit_not_applicable'
        ? []
        : splitCsvLike(structuredValue).filter((entry) => entry.toLowerCase() !== 'none');
    const runtimeValues = collectRuntimeDamageReductionValues(json, check.runtimeKey);

    for (const entry of structuredEntries) {
      if (runtimeValues.has(entry.toLowerCase())) continue;

      pushIssue(issues, {
        severity: 'error',
        code: check.code,
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'structured-vs-json',
        fieldPath: check.fieldPath,
        message: `${spell.spellName} lists "${entry}" in structured ${check.label}, but runtime JSON has no matching damageReduction entry.`,
        actualValue: entry,
        expectedValue: Array.from(runtimeValues).join(', ') || 'A matching damageReduction entry',
        filePath: jsonPath,
      });
    }
  }

  const defenseSourceChecks = [
    {
      label: 'Defense Source Categories',
      runtimeKey: 'sourceCategories',
      code: 'structured-defense-source-categories-missing-runtime-effect',
      fieldPath: 'Defense Source Categories -> effects[].defenseSourceFilter.sourceCategories[]',
    },
    {
      label: 'Defense Source Attack Magical Status',
      runtimeKey: 'attackMagicalStatus',
      code: 'structured-defense-source-attack-magical-status-missing-runtime-effect',
      fieldPath: 'Defense Source Attack Magical Status -> effects[].defenseSourceFilter.attackMagicalStatus',
    },
  ];

  for (const check of defenseSourceChecks) {
    const structuredValue = spell.labels.get(check.label) ?? '';
    const structuredEntries =
      classifyApplicabilityValue(structuredValue) === 'explicit_not_applicable'
        ? []
        : splitCsvLike(structuredValue).filter((entry) => entry.toLowerCase() !== 'none');
    const runtimeValues = collectRuntimeDefenseSourceFilterValues(json, check.runtimeKey);

    for (const entry of structuredEntries) {
      if (runtimeValues.has(entry.toLowerCase())) continue;

      pushIssue(issues, {
        severity: 'error',
        code: check.code,
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'structured-vs-json',
        fieldPath: check.fieldPath,
        message: `${spell.spellName} lists "${entry}" in structured ${check.label}, but runtime JSON has no matching defenseSourceFilter entry.`,
        actualValue: entry,
        expectedValue: Array.from(runtimeValues).join(', ') || 'A matching defenseSourceFilter entry',
        filePath: jsonPath,
      });
    }
  }

  const barrierDamagePreventionChecks = [
    {
      label: 'Barrier Damage Block Directions',
      runtimeKey: 'blockDirections',
      code: 'structured-barrier-damage-block-directions-missing-runtime-effect',
      fieldPath: 'Barrier Damage Block Directions -> effects[].barrierDamagePrevention.blockDirections[]',
    },
    {
      label: 'Barrier Damage Block Source Categories',
      runtimeKey: 'sourceCategories',
      code: 'structured-barrier-damage-block-source-categories-missing-runtime-effect',
      fieldPath: 'Barrier Damage Block Source Categories -> effects[].barrierDamagePrevention.sourceCategories[]',
    },
  ];

  for (const check of barrierDamagePreventionChecks) {
    const structuredValue = spell.labels.get(check.label) ?? '';
    const structuredEntries =
      classifyApplicabilityValue(structuredValue) === 'explicit_not_applicable'
        ? []
        : splitCsvLike(structuredValue).filter((entry) => entry.toLowerCase() !== 'none');
    const runtimeValues = collectRuntimeBarrierDamagePreventionValues(json, check.runtimeKey);

    for (const entry of structuredEntries) {
      if (runtimeValues.has(entry.toLowerCase())) continue;

      pushIssue(issues, {
        severity: 'error',
        code: check.code,
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'structured-vs-json',
        fieldPath: check.fieldPath,
        message: `${spell.spellName} lists "${entry}" in structured ${check.label}, but runtime JSON has no matching barrierDamagePrevention entry.`,
        actualValue: entry,
        expectedValue: Array.from(runtimeValues).join(', ') || 'A matching barrierDamagePrevention entry',
        filePath: jsonPath,
      });
    }
  }

  const spellEffectPreventionChecks = [
    {
      label: 'Spell Effect Prevention Source Side',
      runtimeKey: 'sourceSide',
      code: 'structured-spell-effect-prevention-source-side-missing-runtime-effect',
      fieldPath: 'Spell Effect Prevention Source Side -> effects[].spellEffectPrevention.sourceSide',
    },
    {
      label: 'Spell Effect Prevention Max Spell Level',
      runtimeKey: 'maxSpellLevel',
      code: 'structured-spell-effect-prevention-max-level-missing-runtime-effect',
      fieldPath: 'Spell Effect Prevention Max Spell Level -> effects[].spellEffectPrevention.maxSpellLevel',
    },
    {
      label: 'Spell Effect Prevention Affected Subjects',
      runtimeKey: 'affectedSubjects',
      code: 'structured-spell-effect-prevention-affected-subjects-missing-runtime-effect',
      fieldPath: 'Spell Effect Prevention Affected Subjects -> effects[].spellEffectPrevention.affectedSubjects[]',
    },
    {
      label: 'Spell Effect Prevention Excludes Area Of Effect',
      runtimeKey: 'excludesAreaOfEffect',
      code: 'structured-spell-effect-prevention-area-exclusion-missing-runtime-effect',
      fieldPath: 'Spell Effect Prevention Excludes Area Of Effect -> effects[].spellEffectPrevention.excludesAreaOfEffect',
    },
  ];

  for (const check of spellEffectPreventionChecks) {
    const structuredValue = spell.labels.get(check.label) ?? '';
    const structuredEntries =
      classifyApplicabilityValue(structuredValue) === 'explicit_not_applicable'
        ? []
        : splitCsvLike(structuredValue).filter((entry) => entry.toLowerCase() !== 'none');
    const runtimeValues = collectRuntimeSpellEffectPreventionValues(json, check.runtimeKey);

    for (const entry of structuredEntries) {
      if (runtimeValues.has(entry.toLowerCase())) continue;

      pushIssue(issues, {
        severity: 'error',
        code: check.code,
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'structured-vs-json',
        fieldPath: check.fieldPath,
        message: `${spell.spellName} lists "${entry}" in structured ${check.label}, but runtime JSON has no matching spellEffectPrevention entry.`,
        actualValue: entry,
        expectedValue: Array.from(runtimeValues).join(', ') || 'A matching spellEffectPrevention entry',
        filePath: jsonPath,
      });
    }
  }

  const linkedDamageChecks = [
    {
      label: 'Linked Damage Trigger',
      runtimeKey: 'trigger',
      code: 'structured-linked-damage-trigger-missing-runtime-effect',
      fieldPath: 'Linked Damage Trigger -> effects[].linkedDamage.trigger',
    },
    {
      label: 'Linked Damage Recipient',
      runtimeKey: 'recipient',
      code: 'structured-linked-damage-recipient-missing-runtime-effect',
      fieldPath: 'Linked Damage Recipient -> effects[].linkedDamage.recipient',
    },
    {
      label: 'Linked Damage Amount',
      runtimeKey: 'amount',
      code: 'structured-linked-damage-amount-missing-runtime-effect',
      fieldPath: 'Linked Damage Amount -> effects[].linkedDamage.amount',
    },
    {
      label: 'Linked Damage Amount Basis',
      runtimeKey: 'amountBasis',
      code: 'structured-linked-damage-amount-basis-missing-runtime-effect',
      fieldPath: 'Linked Damage Amount Basis -> effects[].linkedDamage.amountBasis',
    },
    {
      label: 'Linked Damage Type Source',
      runtimeKey: 'damageTypeSource',
      code: 'structured-linked-damage-type-source-missing-runtime-effect',
      fieldPath: 'Linked Damage Type Source -> effects[].linkedDamage.damageTypeSource',
    },
    {
      label: 'Linked Damage Recipient Mitigation',
      runtimeKey: 'recipientMitigation',
      code: 'structured-linked-damage-recipient-mitigation-missing-runtime-effect',
      fieldPath: 'Linked Damage Recipient Mitigation -> effects[].linkedDamage.recipientMitigation',
    },
  ];

  for (const check of linkedDamageChecks) {
    const structuredValue = spell.labels.get(check.label) ?? '';
    const structuredEntries =
      classifyApplicabilityValue(structuredValue) === 'explicit_not_applicable'
        ? []
        : splitCsvLike(structuredValue).filter((entry) => entry.toLowerCase() !== 'none');
    const runtimeValues = collectRuntimeLinkedDamageValues(json, check.runtimeKey);

    for (const entry of structuredEntries) {
      if (runtimeValues.has(entry.toLowerCase())) continue;

      pushIssue(issues, {
        severity: 'error',
        code: check.code,
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'structured-vs-json',
        fieldPath: check.fieldPath,
        message: `${spell.spellName} lists "${entry}" in structured ${check.label}, but runtime JSON has no matching linkedDamage entry.`,
        actualValue: entry,
        expectedValue: Array.from(runtimeValues).join(', ') || 'A matching linkedDamage entry',
        filePath: jsonPath,
      });
    }
  }

  const resistanceSuppressionChecks = [
    {
      label: 'Resistance Suppression Damage Types',
      runtimeKey: 'damageType',
      code: 'structured-resistance-suppression-damage-types-missing-runtime-effect',
      fieldPath: 'Resistance Suppression Damage Types -> effects[].resistanceSuppression.damageType[]',
    },
    {
      label: 'Resistance Suppression Damage Type Source',
      runtimeKey: 'damageTypeSource',
      code: 'structured-resistance-suppression-damage-type-source-missing-runtime-effect',
      fieldPath: 'Resistance Suppression Damage Type Source -> effects[].resistanceSuppression.damageTypeSource',
    },
  ];

  for (const check of resistanceSuppressionChecks) {
    const structuredValue = spell.labels.get(check.label) ?? '';
    const structuredEntries =
      classifyApplicabilityValue(structuredValue) === 'explicit_not_applicable'
        ? []
        : splitCsvLike(structuredValue).filter((entry) => entry.toLowerCase() !== 'none');
    const runtimeValues = collectRuntimeResistanceSuppressionValues(json, check.runtimeKey);

    for (const entry of structuredEntries) {
      if (runtimeValues.has(entry.toLowerCase())) continue;

      pushIssue(issues, {
        severity: 'error',
        code: check.code,
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'structured-vs-json',
        fieldPath: check.fieldPath,
        message: `${spell.spellName} lists "${entry}" in structured ${check.label}, but runtime JSON has no matching resistanceSuppression entry.`,
        actualValue: entry,
        expectedValue: Array.from(runtimeValues).join(', ') || 'A matching resistanceSuppression entry',
        filePath: jsonPath,
      });
    }
  }

  const damageInteractionChecks = [
    {
      label: 'Damage Interaction Modes',
      runtimeKey: 'modes',
      code: 'structured-damage-interaction-modes-missing-runtime-effect',
      fieldPath: 'Damage Interaction Modes -> effects[].damageInteraction.modes[]',
    },
    {
      label: 'Damage Interaction Damage Types',
      runtimeKey: 'damageType',
      code: 'structured-damage-interaction-damage-types-missing-runtime-effect',
      fieldPath: 'Damage Interaction Damage Types -> effects[].damageInteraction.damageType[]',
    },
    {
      label: 'Damage Interaction Damage Type Source',
      runtimeKey: 'damageTypeSource',
      code: 'structured-damage-interaction-damage-type-source-missing-runtime-effect',
      fieldPath: 'Damage Interaction Damage Type Source -> effects[].damageInteraction.damageTypeSource',
    },
    {
      label: 'Damage Interaction Subject Scope',
      runtimeKey: 'subjectScope',
      code: 'structured-damage-interaction-subject-scope-missing-runtime-effect',
      fieldPath: 'Damage Interaction Subject Scope -> effects[].damageInteraction.subjectScope',
    },
    {
      label: 'Damage Interaction Duration Scope',
      runtimeKey: 'durationScope',
      code: 'structured-damage-interaction-duration-scope-missing-runtime-effect',
      fieldPath: 'Damage Interaction Duration Scope -> effects[].damageInteraction.durationScope',
    },
  ];

  for (const check of damageInteractionChecks) {
    const structuredValue = spell.labels.get(check.label) ?? '';
    const structuredEntries =
      classifyApplicabilityValue(structuredValue) === 'explicit_not_applicable'
        ? []
        : splitCsvLike(structuredValue).filter((entry) => entry.toLowerCase() !== 'none');
    const runtimeValues = collectRuntimeDamageInteractionValues(json, check.runtimeKey);

    for (const entry of structuredEntries) {
      if (runtimeValues.has(entry.toLowerCase())) continue;

      pushIssue(issues, {
        severity: 'error',
        code: check.code,
        spellId: spell.spellId,
        spellName: spell.spellName,
        source: 'structured-vs-json',
        fieldPath: check.fieldPath,
        message: `${spell.spellName} lists "${entry}" in structured ${check.label}, but runtime JSON has no matching damageInteraction entry.`,
        actualValue: entry,
        expectedValue: Array.from(runtimeValues).join(', ') || 'A matching damageInteraction entry',
        filePath: jsonPath,
      });
    }
  }

  const conditionSuppressionValue = spell.labels.get('Condition Suppressions') ?? '';
  const structuredSuppressions =
    classifyApplicabilityValue(conditionSuppressionValue) === 'explicit_not_applicable'
      ? []
      : splitCsvLike(conditionSuppressionValue).filter((entry) => entry.toLowerCase() !== 'none');

  const runtimeSuppressions = collectRuntimeConditionSuppressions(json);

  for (const condition of structuredSuppressions) {
    if (runtimeSuppressions.has(normalizeConditionName(condition))) continue;

    pushIssue(issues, {
      severity: 'error',
      code: 'structured-condition-suppression-missing-runtime-effect',
      spellId: spell.spellId,
      spellName: spell.spellName,
      source: 'structured-vs-json',
      fieldPath: 'Condition Suppressions -> effects[].conditionSuppression[]',
      message: `${spell.spellName} lists "${condition}" in structured Condition Suppressions, but runtime JSON has no matching defensive conditionSuppression entry.`,
      actualValue: condition,
      expectedValue: Array.from(runtimeSuppressions).join(', ') || 'A matching conditionSuppression entry',
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
