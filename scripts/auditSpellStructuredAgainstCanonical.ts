import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This file compares the structured Aralia spell markdown fields to the raw canonical snapshot
 * stored lower in the same file.
 *
 * The spell-truth workflow now has three distinct layers inside a spell reference markdown file:
 * 1. the structured Aralia-facing field block at the top
 * 2. the raw canonical snapshot captured from D&D Beyond or another approved source
 * 3. human review of the differences between those two surfaces
 *
 * This script exists for layer 3. It does not rewrite the spell. It turns both parts of the same
 * markdown file into comparable values, groups the mismatches, and writes a report that can be
 * reviewed before any normalization or arbitration happens.
 *
 * Called manually by: Codex during the canonical-vs-structured markdown comparison lane
 * Depends on:
 * - `docs/spells/reference/**`
 * Writes:
 * - `docs/tasks/spells/SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
 * - `.agent/roadmap-local/spell-validation/spell-structured-vs-canonical-report.json`
 */

// ============================================================================
// Paths, labels, and audit types
// ============================================================================
// This section keeps the report destinations and shared labels in one place so
// the audit can be rerun safely without scattering outputs around the repo.
// ============================================================================

const REPO_ROOT = 'F:/Repos/Aralia';
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SPELL_REFERENCE_ROOT = path.join(REPO_ROOT, 'docs', 'spells', 'reference');
const REPORT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-structured-vs-canonical-report.json');
const REPORT_MD_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_STRUCTURED_VS_CANONICAL_REPORT.md');
const CANONICAL_SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';
const CANONICAL_ONLY_MARKER = '<!-- CANONICAL-ONLY-REFERENCE -->';

type MismatchKind = 'value-mismatch' | 'missing-structured-field' | 'missing-canonical-field';

interface StructuredSpellRecord {
  spellId: string;
  spellName: string;
  markdownPath: string;
  labels: Map<string, string>;
}

interface CanonicalSpellRecord {
  name: string;
  level: string;
  castingTime: string;
  rangeArea: string;
  components: string;
  duration: string;
  school: string;
  materialComponent: string;
  rulesText: string;
  higherLevelsText: string;
  availableFor: string[];
}

interface ComparableField {
  field: string;
  structuredValue: string;
  canonicalValue: string;
}

interface ComparisonMismatch {
  id: string;
  groupKey: string;
  mismatchKind: MismatchKind;
  spellId: string;
  spellName: string;
  markdownPath: string;
  field: string;
  structuredValue: string;
  canonicalValue: string;
  summary: string;
}

interface GroupedMismatch {
  groupKey: string;
  field: string;
  mismatchKind: MismatchKind;
  count: number;
  spellIds: string[];
  sampleSpellIds: string[];
  sampleSummaries: string[];
}

interface StructuredVsCanonicalReport {
  generatedAt: string;
  scannedMarkdownFiles: number;
  comparedSpellFiles: number;
  mismatchCount: number;
  mismatches: ComparisonMismatch[];
  groupedMismatches: GroupedMismatch[];
}

interface AuditOptions {
  spellId?: string;
}

// ============================================================================
// File discovery and markdown parsing
// ============================================================================
// This section finds all spell reference markdown files, skips canonical-only
// placeholders, and parses both the structured field block and the commented
// canonical snapshot from the same file.
// ============================================================================

function listMarkdownFiles(root: string): string[] {
  const files: string[] = [];

  function walk(currentPath: string): void {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function findMarkdownFileForSpell(spellId: string): string | null {
  return listMarkdownFiles(SPELL_REFERENCE_ROOT).find((markdownPath) => path.basename(markdownPath, '.md') === spellId) ?? null;
}

function readMarkdown(pathname: string): string {
  return fs.readFileSync(pathname, 'utf8');
}

function isCanonicalOnlyMarkdown(markdown: string): boolean {
  return markdown.includes(CANONICAL_ONLY_MARKER);
}

function parseStructuredSpellRecord(markdownPath: string, markdown: string): StructuredSpellRecord {
  const lines = markdown.split(/\r?\n/);
  const heading = lines.find((line) => line.startsWith('# ')) ?? `# ${path.basename(markdownPath, '.md')}`;
  const spellName = heading.replace(/^#\s+/, '').trim();
  const spellId = path.basename(markdownPath, '.md');
  const labels = new Map<string, string>();

  // The structured Aralia field block uses one explicit line format. Keeping this
  // parser strict makes the audit compare the real validator-facing surface instead
  // of trying to infer facts out of free prose.
  for (const line of lines) {
    const match = line.match(/^- \*\*(.+?)\*\*:\s*(.*)$/);
    if (!match) continue;
    labels.set(match[1].trim(), (match[2] ?? '').trim());
  }

  return {
    spellId,
    spellName,
    markdownPath,
    labels,
  };
}

function extractCanonicalCommentBlock(markdown: string): string | null {
  const headingIndex = markdown.indexOf(CANONICAL_SNAPSHOT_HEADING);
  if (headingIndex === -1) return null;

  const commentStart = markdown.indexOf('<!--', headingIndex);
  const commentEnd = markdown.indexOf('-->', commentStart);
  if (commentStart === -1 || commentEnd === -1) return null;

  return markdown.slice(commentStart + 4, commentEnd).trim();
}

function extractCanonicalSectionBlock(commentBlock: string, label: string, nextLabels: string[]): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedNextLabels = nextLabels
    .map((nextLabel) => nextLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  // The raw copied canonical snapshots do not consistently put blank lines between sections.
  // Earlier versions of this parser only stopped when the next label appeared after an empty
  // line, which made multiline sections like Rules Text and Material Component look empty even
  // though the spell file clearly contained them. That inflated report buckets like Description
  // and Material Component with parser residue instead of real spell drift. We now stop as soon
  // as the next known section label begins on a new line.
  const match = commentBlock.match(
    new RegExp(`(?:^|\\r?\\n)${escapedLabel}:\\r?\\n([\\s\\S]*?)(?=\\r?\\n(?:${escapedNextLabels}):|$)`, 'i'),
  );

  return match ? match[1].trim() : '';
}

function extractCanonicalField(commentBlock: string, label: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = commentBlock.match(new RegExp(`(?:^|\\r?\\n)${escapedLabel}:\\s*(.+)$`, 'im'));
  return match ? match[1].trim() : '';
}

function extractCanonicalList(commentBlock: string, label: string, nextLabels: string[]): string[] {
  const block = extractCanonicalSectionBlock(commentBlock, label, nextLabels);
  if (!block) return [];

  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCanonicalSpellRecord(commentBlock: string): CanonicalSpellRecord {
  const rawRulesText = extractCanonicalSectionBlock(commentBlock, 'Rules Text', [
    'Material Component',
    'Spell Tags',
    'Available For',
    'Referenced Rules',
    'Capture Method',
    'Legacy Page',
  ]);
  const splitRules = splitCanonicalRulesText(rawRulesText);

  return {
    name: extractCanonicalField(commentBlock, 'Name'),
    level: extractCanonicalField(commentBlock, 'Level'),
    castingTime: extractCanonicalField(commentBlock, 'Casting Time'),
    rangeArea: extractCanonicalField(commentBlock, 'Range/Area'),
    components: extractCanonicalField(commentBlock, 'Components'),
    duration: extractCanonicalField(commentBlock, 'Duration'),
    school: extractCanonicalField(commentBlock, 'School'),
    materialComponent: extractCanonicalSectionBlock(commentBlock, 'Material Component', [
      'Spell Tags',
      'Available For',
      'Referenced Rules',
      'Capture Method',
      'Legacy Page',
    ]),
    rulesText: splitRules.mainRulesText,
    higherLevelsText: splitRules.higherLevelsText,
    availableFor: extractCanonicalList(commentBlock, 'Available For', [
      'Referenced Rules',
      'Capture Method',
      'Legacy Page',
    ]),
  };
}

// ============================================================================
// Normalization helpers
// ============================================================================
// This section converts both the structured field block and the raw canonical
// snapshot into comparable strings. The goal is not perfect semantic parsing.
// The goal is to remove predictable format noise so real content drift becomes
// visible instead of getting buried under casing and punctuation trivia.
// ============================================================================

function normalizeComparableText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€“/g, '-')
    .replace(/â€”/g, '-')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseWord(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatOrdinal(value: number): string {
  if (value === 1) return '1st';
  if (value === 2) return '2nd';
  if (value === 3) return '3rd';
  return `${value}th`;
}

function formatLevel(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  if (numeric === 0) return 'Cantrip';
  return formatOrdinal(numeric);
}

function formatCastingTimeUnit(value: string): string {
  switch (value) {
    case 'action':
      return 'Action';
    case 'bonus_action':
      return 'Bonus Action';
    case 'reaction':
      return 'Reaction';
    case 'round':
      return 'Round';
    case 'minute':
      return 'Minute';
    case 'hour':
      return 'Hour';
    default:
      return value
        .split(/[_\s-]+/)
        .map(titleCaseWord)
        .join(' ');
  }
}

function formatSingularOrPlural(value: number, unit: string): string {
  const baseUnit = formatCastingTimeUnit(unit);
  if (!baseUnit) return '';
  return value === 1 ? baseUnit : `${baseUnit}s`;
}

function formatStructuredCastingTime(labels: Map<string, string>): string {
  const rawValue = labels.get('Casting Time Value') ?? '';
  const unit = labels.get('Casting Time Unit') ?? '';
  const reactionTrigger = labels.get('Reaction Trigger') ?? '';
  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue) || !unit) return '';

  const rendered = `${numericValue} ${formatSingularOrPlural(numericValue, unit)}`.trim();
  if (unit === 'reaction' && reactionTrigger && reactionTrigger !== 'None') {
    return `${rendered}, ${reactionTrigger}`;
  }

  return rendered;
}

function formatStructuredRange(labels: Map<string, string>): string {
  const rangeType = (labels.get('Range Type') ?? '').trim();
  const rangeDistance = (labels.get('Range Distance') ?? '').trim();
  const rangeUnit = (labels.get('Range Unit') ?? '').trim();
  const areaShape = (labels.get('Area Shape') ?? '').trim();
  const areaSize = (labels.get('Area Size') ?? '').trim();

  let base = '';
  switch (rangeType) {
    case 'self':
      base = 'Self';
      break;
    case 'touch':
      base = 'Touch';
      break;
    case 'special':
      base = 'Special';
      break;
    case 'sight':
      base = 'Sight';
      break;
    case 'unlimited':
      base = 'Unlimited';
      break;
    case 'ranged':
      if (rangeDistance) {
        const renderedUnit = rangeUnit
          ? (Number(rangeDistance) === 1 ? rangeUnit : `${rangeUnit}s`)
          : 'ft.';
        base = `${rangeDistance} ${renderedUnit}`.trim();
      }
      break;
    default:
      base = rangeType ? titleCaseWord(rangeType) : '';
      break;
  }

  // The structured block sometimes stores area metadata separately. Folding it back
  // into one comparable display string lets us compare against D&D Beyond's single
  // `Range/Area` field without changing the structured Aralia format.
  // Some spell snapshots keep the area size even when the shape is blank. That is
  // still meaningful canonical data, so we preserve the size instead of dropping it.
  if (!areaSize || areaSize === 'N/A') return base;

  const hasAreaShape = areaShape && areaShape !== 'N/A';
  if (!hasAreaShape) {
    return base ? `${base} (${areaSize})` : areaSize;
  }

  const renderedShape = areaShape
    .split(/[_\s-]+/)
    .map(titleCaseWord)
    .join(' ');
  const area = `${areaSize}-ft. ${renderedShape}`;

  if (!base) return area;
  return `${base} (${area})`;
}

function formatStructuredComponents(labels: Map<string, string>): string {
  const parts: string[] = [];
  const material = (labels.get('Material') ?? '').trim() === 'true';

  if ((labels.get('Verbal') ?? '').trim() === 'true') parts.push('V');
  if ((labels.get('Somatic') ?? '').trim() === 'true') parts.push('S');
  if (material) parts.push('M *');

  return parts.join(', ');
}

function formatStructuredMaterial(labels: Map<string, string>): string {
  const description = (labels.get('Material Description') ?? '').trim();
  if (!description || description === 'None') return '';
  return `* - (${description})`;
}

function formatStructuredDuration(labels: Map<string, string>): string {
  const durationType = (labels.get('Duration Type') ?? '').trim();
  const rawValue = (labels.get('Duration Value') ?? '').trim();
  const durationUnit = (labels.get('Duration Unit') ?? '').trim();
  const concentration = (labels.get('Concentration') ?? '').trim() === 'true';
  const numericValue = Number(rawValue);

  if (durationType === 'instantaneous') return 'Instantaneous';
  if (durationType === 'special') return 'Special';
  if (durationType === 'permanent') return 'Permanent';
  if (durationType === 'until_dispelled') return 'Until Dispelled';

  if (Number.isFinite(numericValue) && durationUnit) {
    const renderedUnit = formatSingularOrPlural(numericValue, durationUnit);
    const rendered = `${numericValue} ${renderedUnit}`.trim();
    return concentration ? `Concentration ${rendered}` : rendered;
  }

  return concentration ? 'Concentration' : titleCaseWord(durationType);
}

function normalizeAvailableForEntry(entry: string): string {
  return entry.replace(/\s+\(Legacy\)$/i, '').trim();
}

function splitCanonicalAvailableFor(entries: string[]): { classes: string[]; subClasses: string[] } {
  const classes = new Set<string>();
  const subClasses = new Set<string>();

  // The raw canonical snapshot intentionally preserves legacy and unsupported entries.
  // The comparison lane still needs an Aralia-comparable view, so this split normalizes
  // away duplicate `(Legacy)` suffixes while preserving subclass strings exactly.
  for (const entry of entries) {
    const normalized = normalizeAvailableForEntry(entry);
    if (!normalized) continue;

    if (normalized.includes(' - ')) {
      subClasses.add(normalized);
      continue;
    }

    classes.add(normalized);
  }

  return {
    classes: Array.from(classes).sort(),
    subClasses: Array.from(subClasses).sort(),
  };
}

function normalizeStructuredList(value: string): string[] {
  if (!value || value === 'None') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
}

function joinComparableList(entries: string[]): string {
  return entries.join(', ');
}

function splitCanonicalRulesText(rawRulesText: string): { mainRulesText: string; higherLevelsText: string } {
  const lines = rawRulesText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const higherLevelsStart = lines.findIndex((line) => /^Using a Higher-Level Spell Slot\./i.test(line));
  if (higherLevelsStart === -1) {
    return {
      mainRulesText: rawRulesText.trim(),
      higherLevelsText: '',
    };
  }

  return {
    mainRulesText: lines.slice(0, higherLevelsStart).join('\n').trim(),
    higherLevelsText: lines.slice(higherLevelsStart).join('\n').trim(),
  };
}

function buildComparableFields(structured: StructuredSpellRecord, canonical: CanonicalSpellRecord): ComparableField[] {
  const canonicalAvailableFor = splitCanonicalAvailableFor(canonical.availableFor);

  return [
    {
      field: 'Name',
      structuredValue: structured.spellName,
      canonicalValue: canonical.name,
    },
    {
      field: 'Level',
      structuredValue: formatLevel(structured.labels.get('Level') ?? ''),
      canonicalValue: canonical.level,
    },
    {
      field: 'School',
      structuredValue: structured.labels.get('School') ?? '',
      canonicalValue: canonical.school,
    },
    {
      field: 'Classes',
      structuredValue: joinComparableList(normalizeStructuredList(structured.labels.get('Classes') ?? '')),
      canonicalValue: joinComparableList(canonicalAvailableFor.classes),
    },
    {
      field: 'Sub-Classes',
      structuredValue: joinComparableList(normalizeStructuredList(structured.labels.get('Sub-Classes') ?? '')),
      canonicalValue: joinComparableList(canonicalAvailableFor.subClasses),
    },
    {
      field: 'Casting Time',
      structuredValue: formatStructuredCastingTime(structured.labels),
      canonicalValue: canonical.castingTime,
    },
    {
      field: 'Range/Area',
      structuredValue: formatStructuredRange(structured.labels),
      canonicalValue: canonical.rangeArea,
    },
    {
      field: 'Components',
      structuredValue: formatStructuredComponents(structured.labels),
      canonicalValue: canonical.components,
    },
    {
      field: 'Material Component',
      structuredValue: formatStructuredMaterial(structured.labels),
      canonicalValue: canonical.materialComponent,
    },
    {
      field: 'Duration',
      structuredValue: formatStructuredDuration(structured.labels),
      canonicalValue: canonical.duration,
    },
    {
      field: 'Description',
      structuredValue: structured.labels.get('Description') ?? '',
      canonicalValue: canonical.rulesText,
    },
    {
      field: 'Higher Levels',
      structuredValue: structured.labels.get('Higher Levels') ?? '',
      canonicalValue: canonical.higherLevelsText,
    },
  ];
}

// ============================================================================
// Mismatch collection and grouping
// ============================================================================
// This section compares the normalized field pairs and groups recurring mismatch
// families. The output is deliberately review-first: it shows where the layers
// disagree without trying to auto-decide which side should win.
// ============================================================================

function isMeaningfulValue(value: string): boolean {
  const normalized = normalizeComparableText(value);
  return normalized.length > 0 && normalized.toLowerCase() !== 'none' && normalized.toLowerCase() !== 'n/a';
}

function pushMismatch(
  mismatches: ComparisonMismatch[],
  spell: StructuredSpellRecord,
  mismatchKind: MismatchKind,
  field: string,
  structuredValue: string,
  canonicalValue: string,
  summary: string,
): void {
  mismatches.push({
    id: `${spell.spellId}::${field}::${mismatchKind}`,
    groupKey: `structured-vs-canonical / ${field}`,
    mismatchKind,
    spellId: spell.spellId,
    spellName: spell.spellName,
    markdownPath: spell.markdownPath,
    field,
    structuredValue,
    canonicalValue,
    summary,
  });
}

function collectSpellMismatches(structured: StructuredSpellRecord, canonical: CanonicalSpellRecord): ComparisonMismatch[] {
  const mismatches: ComparisonMismatch[] = [];

  for (const field of buildComparableFields(structured, canonical)) {
    const structuredValue = normalizeComparableText(field.structuredValue);
    const canonicalValue = normalizeComparableText(field.canonicalValue);

    if (!isMeaningfulValue(structuredValue) && !isMeaningfulValue(canonicalValue)) {
      continue;
    }

    if (!isMeaningfulValue(structuredValue) && isMeaningfulValue(canonicalValue)) {
      pushMismatch(
        mismatches,
        structured,
        'missing-structured-field',
        field.field,
        '',
        canonicalValue,
        `${structured.spellName} is missing structured ${field.field} data that exists in the canonical snapshot.`,
      );
      continue;
    }

    if (isMeaningfulValue(structuredValue) && !isMeaningfulValue(canonicalValue)) {
      pushMismatch(
        mismatches,
        structured,
        'missing-canonical-field',
        field.field,
        structuredValue,
        '',
        `${structured.spellName} has structured ${field.field} data, but the canonical snapshot does not currently expose a comparable ${field.field} value.`,
      );
      continue;
    }

    if (structuredValue !== canonicalValue) {
      pushMismatch(
        mismatches,
        structured,
        'value-mismatch',
        field.field,
        structuredValue,
        canonicalValue,
        `${structured.spellName} records ${field.field} differently in the structured block and the canonical snapshot.`,
      );
    }
  }

  return mismatches;
}

function groupMismatches(mismatches: ComparisonMismatch[]): GroupedMismatch[] {
  const groups = new Map<string, GroupedMismatch>();

  for (const mismatch of mismatches) {
    const existing = groups.get(mismatch.groupKey);
    if (existing) {
      existing.count += 1;
      if (!existing.spellIds.includes(mismatch.spellId)) existing.spellIds.push(mismatch.spellId);
      if (existing.sampleSpellIds.length < 10 && !existing.sampleSpellIds.includes(mismatch.spellId)) {
        existing.sampleSpellIds.push(mismatch.spellId);
      }
      if (existing.sampleSummaries.length < 5) {
        existing.sampleSummaries.push(mismatch.summary);
      }
      continue;
    }

    groups.set(mismatch.groupKey, {
      groupKey: mismatch.groupKey,
      field: mismatch.field,
      mismatchKind: mismatch.mismatchKind,
      count: 1,
      spellIds: [mismatch.spellId],
      sampleSpellIds: [mismatch.spellId],
      sampleSummaries: [mismatch.summary],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      spellIds: group.spellIds.sort(),
      sampleSpellIds: group.sampleSpellIds.sort(),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.groupKey.localeCompare(b.groupKey);
    });
}

// ============================================================================
// Report writing
// ============================================================================
// This section keeps both a machine artifact and a human-readable summary.
// The markdown report is grouped on purpose so review can start with repeated
// mismatch families rather than drowning in per-spell detail immediately.
// ============================================================================

function renderMarkdownReport(report: StructuredVsCanonicalReport): string {
  const lines: string[] = [
    '# Spell Structured vs Canonical Report',
    '',
    'This report compares the validator-facing structured spell markdown block to the raw canonical snapshot stored lower in the same file.',
    '',
    `Generated: ${report.generatedAt}`,
    `Markdown files scanned: ${report.scannedMarkdownFiles}`,
    `Spell files compared: ${report.comparedSpellFiles}`,
    `Total mismatches: ${report.mismatchCount}`,
    `Grouped mismatch buckets: ${report.groupedMismatches.length}`,
    '',
    'This report does not arbitrate which side is correct. It only surfaces where the structured Aralia spell data and the copied canonical snapshot are not currently identical.',
    '',
    '## Grouped Mismatches',
    '',
  ];

  if (report.groupedMismatches.length === 0) {
    lines.push('No structured-vs-canonical mismatches found.');
    lines.push('');
    return lines.join('\n');
  }

  for (const group of report.groupedMismatches) {
    lines.push(`### ${group.groupKey}`);
    lines.push('');
    lines.push(`- Kind: \`${group.mismatchKind}\``);
    lines.push(`- Occurrences: ${group.count}`);
    lines.push(`- Distinct spells: ${group.spellIds.length}`);
    lines.push(`- Sample spells: ${group.sampleSpellIds.join(', ')}`);
    lines.push('- Sample findings:');
    for (const summary of group.sampleSummaries) {
      lines.push(`  - ${summary}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function writeReport(report: StructuredVsCanonicalReport): void {
  fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(REPORT_MD_PATH, `${renderMarkdownReport(report)}\n`, 'utf8');
}

// ============================================================================
// Main audit
// ============================================================================
// This section walks the corpus, compares only the files that have both a
// structured Aralia block and a canonical snapshot, and then writes the reports.
// ============================================================================

// ============================================================================
// Report builder
// ============================================================================
// The full audit still exists for corpus-wide review, but the glossary now also
// needs a fresh answer for the one spell the user just opened. This builder can
// therefore narrow itself to a single markdown file without changing the report
// shape the rest of the tooling already expects.
// ============================================================================

export function buildReport(options: AuditOptions = {}): StructuredVsCanonicalReport {
  const files = options.spellId
    ? [findMarkdownFileForSpell(options.spellId)].filter((value): value is string => Boolean(value))
    : listMarkdownFiles(SPELL_REFERENCE_ROOT);
  const mismatches: ComparisonMismatch[] = [];
  let comparedSpellFiles = 0;

  for (const markdownPath of files) {
    const markdown = readMarkdown(markdownPath);
    if (isCanonicalOnlyMarkdown(markdown)) continue;

    const commentBlock = extractCanonicalCommentBlock(markdown);
    if (!commentBlock) continue;

    const structured = parseStructuredSpellRecord(markdownPath, markdown);
    const canonical = parseCanonicalSpellRecord(commentBlock);
    comparedSpellFiles += 1;
    mismatches.push(...collectSpellMismatches(structured, canonical));
  }

  return {
    generatedAt: new Date().toISOString(),
    scannedMarkdownFiles: files.length,
    comparedSpellFiles,
    mismatchCount: mismatches.length,
    mismatches,
    groupedMismatches: groupMismatches(mismatches),
  };
}

function main(): void {
  const requestedSpellId = process.argv.find((arg) => arg.startsWith('--spell-id='))?.split('=')[1];
  const jsonOnly = process.argv.includes('--json');

  if (requestedSpellId && jsonOnly) {
    console.log(JSON.stringify(buildReport({ spellId: requestedSpellId }), null, 2));
    return;
  }

  const report = buildReport({ spellId: requestedSpellId });
  writeReport(report);

  console.log(`Structured-vs-canonical report written to ${REPORT_MD_PATH}`);
  console.log(`Machine-readable report written to ${REPORT_JSON_PATH}`);
  console.log(`Markdown files scanned: ${report.scannedMarkdownFiles}`);
  console.log(`Spell files compared: ${report.comparedSpellFiles}`);
  console.log(`Total mismatches: ${report.mismatchCount}`);
  console.log(`Grouped mismatch buckets: ${report.groupedMismatches.length}`);
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === SCRIPT_FILE
  : false;

if (isDirectRun) {
  main();
}
