import fs from 'node:fs';
import path from 'node:path';
import { classifyApplicabilityValue } from './spellTemplateApplicability';
import { compareAcceptedValueSets } from './spellTemplateValueParity';

/**
 * This script validates the spell template contracts.
 *
 * The spell migration now has two explicit contracts:
 * - the structured markdown template, which is the first machine-actionable layer
 * - the runtime JSON template, which is what the running game ultimately loads
 *
 * This script keeps those contracts honest. It checks that they can be read, that
 * mapped fields point at one another, that structured markdown labels are known,
 * and that runtime JSON values stay inside the accepted enum values declared by
 * the JSON template.
 *
 * Called by: agents during spell bucket work and future CI gates.
 * Depends on: docs/tasks/spells/templates/*.json, docs/spells/reference/**,
 * public/data/spells/**
 * Writes: docs/tasks/spells/templates/SPELL_TEMPLATE_VALIDATION_REPORT.md,
 * .agent/roadmap-local/spell-validation/spell-template-contract-validation.json,
 * and public/data/spell_template_contract_validation.json
 */

// ============================================================================
// Paths And Report Types
// ============================================================================
// This section centralizes every path the validation pass reads or writes. The
// validator intentionally emits both a readable Markdown report and a machine
// report so Atlas-style tooling can consume it later.
// ============================================================================

const REPO_ROOT = process.cwd();
const STRUCTURED_TEMPLATE_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'templates', 'spell-structured-template.json');
const JSON_TEMPLATE_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'templates', 'spell-json-template.json');
const SPELL_REFERENCE_ROOT = path.join(REPO_ROOT, 'docs', 'spells', 'reference');
const SPELL_JSON_ROOT = path.join(REPO_ROOT, 'public', 'data', 'spells');
const REPORT_MD_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'templates', 'SPELL_TEMPLATE_VALIDATION_REPORT.md');
const REPORT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-template-contract-validation.json');
const PUBLIC_REPORT_JSON_PATH = path.join(REPO_ROOT, 'public', 'data', 'spell_template_contract_validation.json');

type IssueSeverity = 'error' | 'warning';
type IssueSource = 'template-parity' | 'structured-markdown' | 'runtime-json';

interface TemplateField {
  label?: string;
  pattern?: string;
  path?: string;
  structuredLabel?: string | null;
  structuredPattern?: string;
  structuredLabels?: string[];
  required?: boolean;
  valueType?: string;
  acceptedValues?: string[];
  acceptedValuesFrom?: string;
  acceptedValuesBySuffix?: Record<string, string[]>;
  jsonPath?: string;
  runtimeOnly?: boolean;
  status?: string;
  acceptedValueParity?: 'exact' | 'runtime_subset_ok';
  log?: Array<{ at: string; action: string; why: string }>;
}

interface TemplateContract {
  schemaVersion: number;
  templateKind: string;
  fields: TemplateField[];
}

interface ValidationIssue {
  severity: IssueSeverity;
  source: IssueSource;
  code: string;
  filePath: string;
  field: string;
  message: string;
  actualValue?: string;
  expectedValue?: string;
}

interface ValidationReport {
  generatedAt: string;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

// ============================================================================
// File Discovery And Parsing
// ============================================================================
// This section reads templates, spell markdown, and spell JSON with deliberately
// small helpers. The template validator should not depend on the spell runtime
// validator because its job is to catch contract drift even when runtime code is
// changing underneath it.
// ============================================================================

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function listFiles(root: string, extension: string): string[] {
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
  return files.sort((a, b) => a.localeCompare(b));
}

function parseStructuredLabels(markdownPath: string): Map<string, string> {
  const labels = new Map<string, string>();
  const markdown = fs.readFileSync(markdownPath, 'utf8');

  // Only bullet labels in the structured block count. Canonical snapshots and
  // prose are ignored because this check is about the validator-facing layer.
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^- \*\*(.+?)\*\*:\s*(.*)$/);
    if (!match) continue;
    labels.set(match[1].trim(), (match[2] ?? '').trim());
  }

  return labels;
}

// ============================================================================
// Template Lookup Helpers
// ============================================================================
// This section turns the template arrays into lookup tables. Explicit labels are
// checked first; regex patterns cover numbered families like Access Grant 1 and
// Utility Option 2.
// ============================================================================

function buildLabelLookup(structuredTemplate: TemplateContract): Map<string, TemplateField> {
  const lookup = new Map<string, TemplateField>();
  for (const field of structuredTemplate.fields) {
    if (field.label) lookup.set(field.label, field);
  }
  return lookup;
}

function findStructuredField(label: string, structuredTemplate: TemplateContract): TemplateField | null {
  const explicit = buildLabelLookup(structuredTemplate).get(label);
  if (explicit) return explicit;

  for (const field of structuredTemplate.fields) {
    if (!field.pattern) continue;
    if (new RegExp(field.pattern).test(label)) return field;
  }

  return null;
}

function resolveAcceptedValues(field: TemplateField, structuredTemplate: TemplateContract, label?: string): string[] {
  if (field.acceptedValues) return field.acceptedValues;

  if (field.acceptedValuesFrom) {
    const source = structuredTemplate.fields.find((candidate) => candidate.label === field.acceptedValuesFrom);
    return source?.acceptedValues ?? [];
  }

  if (field.acceptedValuesBySuffix && label) {
    const suffix = Object.keys(field.acceptedValuesBySuffix).find((candidate) => label.endsWith(candidate));
    return suffix ? field.acceptedValuesBySuffix[suffix] : [];
  }

  return [];
}

function splitCsv(value: string): string[] {
  if (!value || value === 'None' || value === 'N/A') return [];
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function acceptedValueMatches(value: string, acceptedValues: string[]): boolean {
  // The structured spell corpus still mixes enum casing (`Cube` and `cube`)
  // while buckets are being migrated from raw canonical text. Case differences
  // are normalization debt, not separate spell meanings, so this contract check
  // compares enums case-insensitively and leaves final casing cleanup to the
  // owning bucket instead of inflating the template error count.
  return acceptedValues.some((acceptedValue) => acceptedValue.toLowerCase() === value.toLowerCase());
}

// ============================================================================
// Template Parity Validation
// ============================================================================
// This section checks the two templates against each other. The structured
// template is intentionally first. If a structured field maps to runtime JSON,
// the JSON template must acknowledge that path unless the field is still marked
// as proposed.
// ============================================================================

function validateTemplateParity(
  structuredTemplate: TemplateContract,
  jsonTemplate: TemplateContract,
  issues: ValidationIssue[],
): void {
  const jsonPaths = new Set(jsonTemplate.fields.map((field) => field.path).filter((value): value is string => Boolean(value)));
  const structuredLabels = new Set(structuredTemplate.fields.map((field) => field.label).filter((value): value is string => Boolean(value)));
  const structuredPatterns = structuredTemplate.fields.map((field) => field.pattern).filter((value): value is string => Boolean(value));

  for (const field of structuredTemplate.fields) {
    if (!field.jsonPath || field.status === 'proposed') continue;

    if (!jsonPaths.has(field.jsonPath)) {
      issues.push({
        severity: 'warning',
        source: 'template-parity',
        code: 'structured-json-path-unregistered',
        filePath: STRUCTURED_TEMPLATE_PATH,
        field: field.label ?? field.pattern ?? field.jsonPath,
        message: 'Structured template field maps to a JSON path that is not explicitly registered in the JSON template yet.',
        actualValue: field.jsonPath,
        expectedValue: 'Matching path in spell-json-template.json',
      });
    }
  }

  for (const field of jsonTemplate.fields) {
    if (field.runtimeOnly || field.status === 'proposed') continue;

    const mappedLabelOk = !field.structuredLabel || structuredLabels.has(field.structuredLabel);
    const mappedPatternOk = !field.structuredPattern || structuredPatterns.some((pattern) => pattern === field.structuredPattern || pattern.startsWith(field.structuredPattern));
    const mappedLabelsOk = !field.structuredLabels || field.structuredLabels.every((label) => structuredLabels.has(label));

    if (!mappedLabelOk || !mappedPatternOk || !mappedLabelsOk) {
      issues.push({
        severity: 'error',
        source: 'template-parity',
        code: 'json-structured-mapping-missing',
        filePath: JSON_TEMPLATE_PATH,
        field: field.path ?? '(unknown path)',
        message: 'JSON template field points at a structured label or pattern that is not registered in the structured template.',
        actualValue: field.structuredLabel ?? field.structuredPattern ?? (field.structuredLabels ?? []).join(', '),
        expectedValue: 'Registered structured label or pattern',
      });
    }

    // Mapped enum-like fields are not really aligned if each template permits a
    // different legal vocabulary. This catches cases such as structured Effect
    // Type accepting broad legacy names while runtime JSON only accepts the
    // narrower execution families the engine actually understands.
    if (field.structuredLabel) {
      const structuredField = structuredTemplate.fields.find((candidate) => candidate.label === field.structuredLabel);
      if (!structuredField) continue;

      const structuredAcceptedValues = resolveAcceptedValues(structuredField, structuredTemplate, field.structuredLabel);
      const runtimeAcceptedValues = resolveAcceptedValues(field, structuredTemplate, field.structuredLabel);
      if (structuredAcceptedValues.length === 0 || runtimeAcceptedValues.length === 0) continue;

      const mismatch = compareAcceptedValueSets(field.structuredLabel, structuredAcceptedValues, runtimeAcceptedValues);
      if (!mismatch) continue;

      // Some downstream runtime fields intentionally consume a narrowed subset
      // of a broader structured vocabulary. Two examples are exploration casting
      // units (minutes/hours only) and combat cost after `long_cast` normalization.
      // Those fields still need to be explicit in the template, but they should
      // not pretend to be exact one-for-one enum mirrors.
      if (field.acceptedValueParity === 'runtime_subset_ok' && mismatch.runtimeOnly.length === 0) {
        continue;
      }

      issues.push({
        severity: 'error',
        source: 'template-parity',
        code: 'template-accepted-values-diverge',
        filePath: JSON_TEMPLATE_PATH,
        field: field.structuredLabel,
        message: 'Mapped structured and runtime template fields disagree about their accepted non-prose values.',
        actualValue: `structured-only: ${mismatch.structuredOnly.join(', ') || '(none)'}`,
        expectedValue: `runtime-only: ${mismatch.runtimeOnly.join(', ') || '(none)'}`,
      });
    }
  }
}

// ============================================================================
// Structured Markdown Validation
// ============================================================================
// This section checks every spell markdown file against the structured template.
// It does not ask whether the value is canonically correct; other bucket audits
// do that. This only asks whether the field names and enum values are legal.
// ============================================================================

function validateStructuredMarkdown(structuredTemplate: TemplateContract, issues: ValidationIssue[]): void {
  for (const markdownPath of listFiles(SPELL_REFERENCE_ROOT, '.md')) {
    const labels = parseStructuredLabels(markdownPath);

    for (const [label, value] of labels) {
      const field = findStructuredField(label, structuredTemplate);

      if (!field) {
        issues.push({
          severity: 'warning',
          source: 'structured-markdown',
          code: 'structured-label-unregistered',
          filePath: markdownPath,
          field: label,
          message: 'Structured markdown uses a field that is not registered in the structured template.',
          actualValue: value,
          expectedValue: 'Registered structured template field',
        });
        continue;
      }

      const acceptedValues = resolveAcceptedValues(field, structuredTemplate, label);
      const applicability = classifyApplicabilityValue(value);

      // The goal now expects one schema-safe applicability sentinel rather than a
      // spread of empty-ish stand-ins. Surface the older placeholders explicitly
      // so they become a real migration queue instead of disappearing from audit
      // output as if they were already settled.
      if (applicability === 'implicit_not_applicable') {
        issues.push({
          severity: 'error',
          source: 'structured-markdown',
          code: 'structured-implicit-not-applicable',
          filePath: markdownPath,
          field: label,
          message: 'Structured markdown uses an implicit blank-like non-applicable value instead of the explicit not_applicable sentinel.',
          actualValue: value || '(blank)',
          expectedValue: 'not_applicable',
        });
        continue;
      }

      if (applicability === 'explicit_not_applicable') continue;
      if (acceptedValues.length === 0) continue;

      const valuesToCheck = field.valueType?.startsWith('csv') ? splitCsv(value) : [value.trim()];
      for (const entry of valuesToCheck) {
        if (!entry) continue;
        if (acceptedValueMatches(entry, acceptedValues)) continue;

        issues.push({
          severity: 'error',
          source: 'structured-markdown',
          code: 'structured-value-outside-template',
          filePath: markdownPath,
          field: label,
          message: 'Structured markdown value is not accepted by the structured template.',
          actualValue: entry,
          expectedValue: acceptedValues.join(', '),
        });
      }
    }

    for (const field of structuredTemplate.fields) {
      if (!field.required || !field.label) continue;

      if (!labels.has(field.label)) {
        issues.push({
          severity: 'error',
          source: 'structured-markdown',
          code: 'structured-required-field-missing',
          filePath: markdownPath,
          field: field.label,
          message: 'Structured markdown is missing a field marked required by the structured template.',
          expectedValue: field.label,
        });
      }
    }
  }
}

// ============================================================================
// Runtime JSON Validation
// ============================================================================
// This section validates enum values in spell JSON against the runtime template.
// It deliberately avoids requiring every optional JSON path on every spell,
// because many paths only apply to one effect family.
// ============================================================================

function collectPathValues(value: unknown, templatePath: string): unknown[] {
  const parts = templatePath.split('.');

  function walk(current: unknown, index: number): unknown[] {
    if (index >= parts.length) return [current];

    const part = parts[index];
    if (part.endsWith('[]')) {
      const key = part.slice(0, -2);
      const arrayValue = key ? (current as Record<string, unknown> | undefined)?.[key] : current;
      if (!Array.isArray(arrayValue)) return [];
      return arrayValue.flatMap((entry) => walk(entry, index + 1));
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) return [];
    return walk((current as Record<string, unknown>)[part], index + 1);
  }

  return walk(value, 0).filter((entry) => entry != null);
}

function hasPath(value: unknown, templatePath: string): boolean {
  const parts = templatePath.split('.');

  function walk(current: unknown, index: number): boolean {
    if (index >= parts.length) return current != null;

    const part = parts[index];
    if (part.endsWith('[]')) {
      const key = part.slice(0, -2);
      const arrayValue = key ? (current as Record<string, unknown> | undefined)?.[key] : current;

      // Empty arrays still satisfy required field presence. Their contents may
      // be validated separately when values exist.
      if (!Array.isArray(arrayValue)) return false;
      if (arrayValue.length === 0) return true;
      return arrayValue.some((entry) => walk(entry, index + 1));
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) return false;
    if (!(part in current)) return false;
    return walk((current as Record<string, unknown>)[part], index + 1);
  }

  return walk(value, 0);
}

function validateRuntimeJson(jsonTemplate: TemplateContract, structuredTemplate: TemplateContract, issues: ValidationIssue[]): void {
  for (const jsonPath of listFiles(SPELL_JSON_ROOT, '.json')) {
    const spell = readJson<unknown>(jsonPath);

    for (const field of jsonTemplate.fields) {
      if (!field.path) continue;

      const values = collectPathValues(spell, field.path);
      if (field.required && !hasPath(spell, field.path)) {
        issues.push({
          severity: 'error',
          source: 'runtime-json',
          code: 'json-required-field-missing',
          filePath: jsonPath,
          field: field.path,
          message: 'Runtime spell JSON is missing a field marked required by the JSON template.',
          expectedValue: field.path,
        });
        continue;
      }

      const acceptedValues = resolveAcceptedValues(field, structuredTemplate);
      if (acceptedValues.length === 0) continue;

      for (const value of values) {
        if (typeof value !== 'string') continue;
        if (acceptedValueMatches(value, acceptedValues)) continue;

        issues.push({
          severity: 'error',
          source: 'runtime-json',
          code: 'json-value-outside-template',
          filePath: jsonPath,
          field: field.path,
          message: 'Runtime JSON value is not accepted by the JSON template.',
          actualValue: value,
          expectedValue: acceptedValues.join(', '),
        });
      }
    }
  }
}

// ============================================================================
// Report Writing
// ============================================================================
// This section writes a concise report. The machine-readable file keeps every
// issue; the Markdown report groups enough detail for humans to decide what
// should be fixed next.
// ============================================================================

function writeReport(issues: ValidationIssue[]): ValidationReport {
  const report: ValidationReport = {
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
    issues,
  };

  fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  // The Atlas and validation pages can only fetch files that Vite serves from
  // `public/data`. This second copy keeps the browser surfaces tied to the same
  // contract report that agents use locally, without making those pages read
  // private `.agent` workspace files.
  fs.mkdirSync(path.dirname(PUBLIC_REPORT_JSON_PATH), { recursive: true });
  fs.writeFileSync(PUBLIC_REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# Spell Template Contract Validation',
    '',
    `Generated: ${report.generatedAt}`,
    `Issues: ${report.issueCount}`,
    `Errors: ${report.errorCount}`,
    `Warnings: ${report.warningCount}`,
    '',
    'This report checks the structured markdown template, runtime JSON template, and their mappings.',
    '',
  ];

  for (const issue of issues.slice(0, 200)) {
    lines.push(`- ${issue.severity.toUpperCase()} ${issue.source} / ${issue.code} / ${issue.field}`);
    lines.push(`  - File: \`${path.relative(REPO_ROOT, issue.filePath)}\``);
    lines.push(`  - ${issue.message}`);
    if (issue.actualValue != null) lines.push(`  - Actual: \`${issue.actualValue}\``);
    if (issue.expectedValue != null) lines.push(`  - Expected: \`${issue.expectedValue}\``);
  }

  if (issues.length > 200) {
    lines.push('');
    lines.push(`Report truncated after 200 issues. Full issue list is in \`${path.relative(REPO_ROOT, REPORT_JSON_PATH)}\`.`);
  }

  fs.writeFileSync(REPORT_MD_PATH, `${lines.join('\n')}\n`);
  return report;
}

// ============================================================================
// Main Entry
// ============================================================================
// This section runs all three checks as one gate. It currently exits with a
// failure code only for template parsing errors; data issues are reported but do
// not fail the process yet because the corpus is mid-migration and this contract
// is being introduced as visibility first.
// ============================================================================

function main(): void {
  const structuredTemplate = readJson<TemplateContract>(STRUCTURED_TEMPLATE_PATH);
  const jsonTemplate = readJson<TemplateContract>(JSON_TEMPLATE_PATH);
  const issues: ValidationIssue[] = [];

  validateTemplateParity(structuredTemplate, jsonTemplate, issues);
  validateStructuredMarkdown(structuredTemplate, issues);
  validateRuntimeJson(jsonTemplate, structuredTemplate, issues);

  const report = writeReport(issues);

  console.log(`Spell template contract validation written to ${REPORT_MD_PATH}`);
  console.log(`Machine-readable report written to ${REPORT_JSON_PATH}`);
  console.log(`Browser-readable report written to ${PUBLIC_REPORT_JSON_PATH}`);
  console.log(`Issues: ${report.issueCount} (${report.errorCount} errors, ${report.warningCount} warnings)`);
}

main();
