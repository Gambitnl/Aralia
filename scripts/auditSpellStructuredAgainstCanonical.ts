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
// A "from-5etools" partial canonical block is the parity escape-hatch for spells that have no
// public D&D Beyond detail page (Galder's Tower, Galder's Speedy Courier, Blade of Disaster, etc.).
// The block carries only the structural identity fields (Name, Level, School) sourced from the
// 5etools community index; rules text and component prose are intentionally not embedded. When
// this marker is present, the audit only compares fields the partial block actually populates and
// suppresses `missing-canonical-field` mismatches for the rest, so the partial coverage doesn't
// produce synthetic noise across the prose lanes that the partial block deliberately omits.
const CANONICAL_FROM_FIVE_E_TOOLS_MARKER = '<!-- CANONICAL-FROM-5ETOOLS -->';

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
  captureMethod: string;
  legacyPage: boolean;
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

interface PolicyBoundary {
  id: string;
  spellId: string;
  spellName: string;
  markdownPath: string;
  field: string;
  structuredValue: string;
  canonicalValue: string;
  policy: string;
}

interface StructuredVsCanonicalReport {
  generatedAt: string;
  scannedMarkdownFiles: number;
  comparedSpellFiles: number;
  mismatchCount: number;
  mismatches: ComparisonMismatch[];
  groupedMismatches: GroupedMismatch[];
  policyBoundaryCount: number;
  policyBoundaries: PolicyBoundary[];
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

function isCanonicalFromFiveEtoolsMarkdown(markdown: string): boolean {
  return markdown.includes(CANONICAL_FROM_FIVE_E_TOOLS_MARKER);
}

// The 5etools partial canonical block is a stand-alone HTML comment that appears
// immediately after the `<!-- CANONICAL-FROM-5ETOOLS -->` sentinel rather than under a
// "Canonical D&D Beyond Snapshot" heading. Returning the inner block lets the existing
// `extractCanonicalField` / `extractCanonicalSectionBlock` helpers pull labels from it
// unchanged. Returns null when the file is missing the marker or the trailing comment.
function extractFiveEtoolsCommentBlock(markdown: string): string | null {
  const markerIndex = markdown.indexOf(CANONICAL_FROM_FIVE_E_TOOLS_MARKER);
  if (markerIndex === -1) return null;

  const commentStart = markdown.indexOf('<!--', markerIndex + CANONICAL_FROM_FIVE_E_TOOLS_MARKER.length);
  const commentEnd = commentStart === -1 ? -1 : markdown.indexOf('-->', commentStart);
  if (commentStart === -1 || commentEnd === -1) return null;

  return markdown.slice(commentStart + 4, commentEnd).trim();
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
  // though the spell file clearly contained them. Some legacy snapshots also have intentionally
  // empty blocks like `Available For:` immediately followed by `Capture Method:`. The lookahead
  // therefore accepts a next label at the start of the captured block as well as after a newline,
  // so an empty canonical section stays empty instead of swallowing the next metadata label.
  const match = commentBlock.match(
    new RegExp(`(?:^|\\r?\\n)${escapedLabel}:\\r?\\n([\\s\\S]*?)(?=(?:${escapedNextLabels}):|\\r?\\n(?:${escapedNextLabels}):|$)`, 'i'),
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
    captureMethod: extractCanonicalField(commentBlock, 'Capture Method'),
    legacyPage: normalizeComparableText(extractCanonicalField(commentBlock, 'Legacy Page')).toLowerCase() === 'true',
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
    .replace(/\s+([.,;:!?])/g, '$1')
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
  const normalized = value.trim().toLowerCase();

  // Structured markdown has accumulated both singular and plural unit labels
  // (`minute` and `minutes`). The audit should compare the spell's timing fact,
  // not create fake drift like `10 Minutess` because one layer used a plural key.
  switch (normalized) {
    case 'action':
    case 'actions':
      return 'Action';
    case 'bonus_action':
    case 'bonus actions':
      return 'Bonus Action';
    case 'reaction':
    case 'reactions':
      return 'Reaction';
    case 'round':
    case 'rounds':
      return 'Round';
    case 'minute':
    case 'minutes':
      return 'Minute';
    case 'hour':
    case 'hours':
      return 'Hour';
    case 'special':
      return 'Special';
    default:
      return value
        .split(/[_\s-]+/)
        .map(titleCaseWord)
        .join(' ');
  }
}

function formatSingularOrPlural(value: number, unit: string): string {
  const normalizedUnit = unit.replace(/_/g, ' ').trim().toLowerCase();

  // The markdown layer has accumulated a mix of singular enum values, plural
  // source labels, and underscore-separated names. Normalize those labels before
  // pluralizing so the audit does not create synthetic drift like `Dayss`.
  if (normalizedUnit === 'bonus action') {
    return value === 1 ? 'Bonus Action' : 'Bonus Actions';
  }

  if (normalizedUnit === 'minute' || normalizedUnit === 'minutes') {
    return value === 1 ? 'Minute' : 'Minutes';
  }

  if (normalizedUnit === 'hour' || normalizedUnit === 'hours') {
    return value === 1 ? 'Hour' : 'Hours';
  }

  if (normalizedUnit === 'day' || normalizedUnit === 'days') {
    return value === 1 ? 'Day' : 'Days';
  }

  if (normalizedUnit === 'round' || normalizedUnit === 'rounds') {
    return value === 1 ? 'Round' : 'Rounds';
  }

  if (normalizedUnit === 'action' || normalizedUnit === 'actions') {
    return value === 1 ? 'Action' : 'Actions';
  }

  if (normalizedUnit === 'reaction' || normalizedUnit === 'reactions') {
    return value === 1 ? 'Reaction' : 'Reactions';
  }

  if (normalizedUnit === 'special') {
    return 'Special';
  }

  const titleUnit = normalizedUnit
    .split(/\s+/)
    .map(titleCaseWord)
    .join(' ');

  return value === 1 ? titleUnit : `${titleUnit}s`;
}

function formatMeasuredDistance(
  value: number,
  unit: 'feet' | 'miles' | 'inches' = 'feet',
  style: 'separated' | 'hyphenated' = 'separated',
): string {
  // Large ward spells are displayed by the canonical source with thousands
  // separators, so the audit keeps that display stable when comparing measured
  // floor areas such as Forbiddance's 40,000 square feet.
  const renderedValue = value.toLocaleString('en-US');

  if (unit === 'miles') {
    return style === 'hyphenated'
      ? `${renderedValue}-mile`
      : `${renderedValue} ${value === 1 ? 'mile' : 'miles'}`;
  }

  if (unit === 'inches') {
    return style === 'hyphenated'
      ? `${renderedValue}-inch`
      : `${renderedValue} ${value === 1 ? 'inch' : 'inches'}`;
  }

  return style === 'hyphenated' ? `${renderedValue}-ft.` : `${renderedValue} ft.`;
}

function normalizeDistanceUnit(raw: string): 'feet' | 'miles' | 'inches' {
  const normalized = normalizeComparableText(raw).toLowerCase();
  if (normalized === 'mile' || normalized === 'miles') return 'miles';
  if (normalized === 'inch' || normalized === 'inches') return 'inches';
  return 'feet';
}

function formatStructuredCastingTime(labels: Map<string, string>): string {
  const rawValue = labels.get('Casting Time Value') ?? '';
  const unit = labels.get('Casting Time Unit') ?? '';
  const numericValue = Number(rawValue);

  if (unit.trim().toLowerCase() === 'special') return 'Special';
  if (!Number.isFinite(numericValue) || !unit) return '';

  // Reaction trigger wording is a separate structured fact. Keeping it out of
  // this canonical Casting Time comparison prevents source footnote markers like
  // `1 Reaction *` from masquerading as a wrong base casting-time value.
  return `${numericValue} ${formatSingularOrPlural(numericValue, unit)}`.trim();
}

function normalizeCastingTimeDisplayWords(value: string): string {
  return value
    .replace(/\bbonus actions\b/gi, 'Bonus Actions')
    .replace(/\bbonus action\b/gi, 'Bonus Action')
    .replace(/\breactions\b/gi, 'Reactions')
    .replace(/\breaction\b/gi, 'Reaction')
    .replace(/\bactions\b/gi, 'Actions')
    .replace(/\baction\b/gi, 'Action')
    .replace(/\bminutes\b/gi, 'Minutes')
    .replace(/\bminute\b/gi, 'Minute')
    .replace(/\bhours\b/gi, 'Hours')
    .replace(/\bhour\b/gi, 'Hour')
    .replace(/\brounds\b/gi, 'Rounds')
    .replace(/\bround\b/gi, 'Round');
}

function formatCanonicalCastingTimeForStructuredComparison(canonicalCastingTime: string, labels: Map<string, string>): string {
  const ritual = (labels.get('Ritual') ?? '').trim().toLowerCase() === 'true';
  let comparable = canonicalCastingTime.trim();

  // D&D Beyond appends "Ritual" to the visible casting-time label, but Aralia
  // stores ritual capability as its own structured fact. For this audit lane,
  // the Casting Time field should compare only the default non-ritual cast time;
  // the derived "10 minutes longer" ritual timing stays visible in the gate
  // checker and remains a separate model-policy question.
  if (ritual && /\s+ritual$/i.test(comparable)) {
    comparable = comparable.replace(/\s+ritual$/i, '');
  }

  // The copied source uses a trailing `*` to point at trigger notes elsewhere on
  // the page. The structured layer stores the actual trigger separately, so this
  // field compares the base cast-time label and leaves trigger validation to the
  // dedicated trigger/model-policy follow-up.
  comparable = comparable.replace(/\s+\*$/u, '');

  return normalizeCastingTimeDisplayWords(comparable);
}

function canonicalRangeMentionsAreaShape(canonicalRangeArea: string): boolean {
  return /\b(cone|cube|cylinder|emanation|line|sphere|square)\b/i.test(canonicalRangeArea);
}

function canonicalRangeHasParentheticalDistance(canonicalRangeArea: string): boolean {
  return /\(\s*[\d,]+(?:[-\s]*(?:ft\.|feet|foot|miles?|inches?|inch))/i.test(canonicalRangeArea);
}

function canonicalRangeHasSelfReach(canonicalRangeArea: string): boolean {
  return /^Self(?:\s+|\s*\()\s*[\d,]+(?:[-\s]*(?:ft\.|feet|foot|miles?|inches?|inch))/i.test(canonicalRangeArea);
}

function formatStructuredRange(labels: Map<string, string>, canonicalRangeArea: string): string {
  const rangeType = (labels.get('Range Type') ?? '').trim();
  const rangeDistance = (labels.get('Range Distance') ?? '').trim();
  const rangeUnit = (labels.get('Range Distance Unit') ?? labels.get('Range Unit') ?? '').trim();
  const targetingRange = (labels.get('Targeting Range') ?? '').trim();
  const targetingRangeUnit = (labels.get('Targeting Range Unit') ?? labels.get('Range Distance Unit') ?? labels.get('Range Unit') ?? '').trim();
  const areaShape = (labels.get('Area Shape') ?? '').trim();
  const areaSize = (labels.get('Area Size') ?? '').trim();
  const areaSizeType = (labels.get('Area Size Type') ?? '').trim();
  const areaUnit = (labels.get('Area Size Unit') ?? labels.get('Area Unit') ?? '').trim();

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
        const numericRange = Number(rangeDistance);
        base = Number.isFinite(numericRange)
          ? formatMeasuredDistance(numericRange, normalizeDistanceUnit(rangeUnit || 'feet'))
          : `${rangeDistance} ${rangeUnit || 'ft.'}`.trim();
      }
      break;
    default:
      base = rangeType ? titleCaseWord(rangeType) : '';
      break;
  }

  // Self-origin attack cantrips may store the reach either as Targeting Range or
  // as Area Size, depending on whether the runtime needs area metadata. The
  // canonical source flattens both shapes into the visible Range/Area header, so
  // this audit folds the same reach back in only for comparison.
  if (rangeType === 'self' && canonicalRangeHasSelfReach(canonicalRangeArea) && !canonicalRangeMentionsAreaShape(canonicalRangeArea)) {
    const normalizedAreaSize = areaSize.toLowerCase();
    const areaSizeIsMeaningful = areaSize
      && normalizedAreaSize !== 'n/a'
      && normalizedAreaSize !== 'none'
      && normalizedAreaSize !== 'not_applicable';
    const comparableReach = areaSizeIsMeaningful ? areaSize : targetingRange;
    const comparableReachUnit = areaSizeIsMeaningful ? areaUnit : targetingRangeUnit;

    if (!comparableReach || comparableReach === '0') return base;

    const numericTargetingRange = Number(comparableReach);
    const renderedTargetingRange = Number.isFinite(numericTargetingRange)
      ? formatMeasuredDistance(numericTargetingRange, normalizeDistanceUnit(comparableReachUnit || 'feet'))
      : `${comparableReach} ${comparableReachUnit || 'ft.'}`.trim();

    return `${base} (${renderedTargetingRange})`;
  }

  // The structured block keeps richer shape metadata than D&D Beyond's compact
  // Range/Area header. When the canonical header omits the shape, the audit
  // compares the shared size fact and leaves the richer shape fact intact in the
  // structured block for runtime/template validation.
  const normalizedAreaSize = areaSize.toLowerCase();
  if (
    !areaSize
    || normalizedAreaSize === 'n/a'
    || normalizedAreaSize === 'none'
    || normalizedAreaSize === 'not_applicable'
    || !canonicalRangeHasParentheticalDistance(canonicalRangeArea)
  ) {
    return base;
  }

  const normalizedAreaShape = areaShape.toLowerCase();
  const hasAreaShape = areaShape
    && normalizedAreaShape !== 'n/a'
    && normalizedAreaShape !== 'none'
    && normalizedAreaShape !== 'not_applicable';
  const sourceHeaderShowsShape = hasAreaShape && canonicalRangeMentionsAreaShape(canonicalRangeArea);
  const areaValue = Number(areaSize);
  const renderedAreaSize = Number.isFinite(areaValue)
    ? formatMeasuredDistance(areaValue, normalizeDistanceUnit(areaUnit || 'feet'), sourceHeaderShowsShape ? 'hyphenated' : 'separated')
    : areaSize;
  const renderedAreaFact = areaSizeType.toLowerCase() === 'square'
    ? `${renderedAreaSize} 2`
    : renderedAreaSize;

  if (!hasAreaShape) {
    return base ? `${base} (${renderedAreaFact})` : renderedAreaFact;
  }

  const renderedShape = areaShape
    .split(/[_\s-]+/)
    .map(titleCaseWord)
    .join(' ');
  const area = sourceHeaderShowsShape ? `${renderedAreaFact} ${renderedShape}` : renderedAreaFact;

  if (!base) return area;
  return `${base} (${area})`;
}

function formatCanonicalRangeForStructuredComparison(canonicalRangeArea: string): string {
  let comparable = normalizeComparableText(canonicalRangeArea)
    .replace(/\s*\*+/gu, '')
    .replace(/\b(\d+)\s*(?:feet|foot)\b/gi, '$1 ft.')
    .replace(/\b(\d+)[-\s]*(?:feet|foot)-/gi, '$1-ft.')
    .replace(/\b(\d+)\s*(?:miles?)\b/gi, (_match, distance: string) => formatMeasuredDistance(Number(distance), 'miles'))
    .replace(/\b(\d+)\s*(?:inches?|inch)\b/gi, (_match, distance: string) => formatMeasuredDistance(Number(distance), 'inches'));

  comparable = comparable
    .replace(/\b(\d+)\s+ft\.\s+(Cone|Cube|Cylinder|Emanation|Line|Sphere|Square)\b/gi, '$1-ft. $2')
    .replace(/\b(\d+)\s+(mile|miles)\s+(Cone|Cube|Cylinder|Emanation|Line|Sphere|Square)\b/gi, '$1-mile $3')
    .replace(/\b(\d+)\s+(inch|inches)\s+(Cone|Cube|Cylinder|Emanation|Line|Sphere|Square)\b/gi, '$1-inch $3')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // D&D Beyond alternates between `Self 5 ft.` and `Self (5 ft.)` for compact
  // self-origin headers. That punctuation does not change the runtime geometry,
  // so the audit compares both displays as the same reach fact.
  comparable = comparable.replace(/^Self\s+(\d+\s+(?:ft\.|miles?|inches?))$/i, 'Self ($1)');

  return comparable;
}

function formatStructuredComponents(labels: Map<string, string>): string {
  const parts: string[] = [];
  const material = (labels.get('Material') ?? '').trim() === 'true';

  if ((labels.get('Verbal') ?? '').trim() === 'true') parts.push('V');
  if ((labels.get('Somatic') ?? '').trim() === 'true') parts.push('S');
  if (material) parts.push('M *');

  return parts.join(', ');
}

function formatCanonicalComponentsForStructuredComparison(canonicalComponents: string): string {
  const normalized = normalizeComparableText(canonicalComponents);
  if (!normalized) return '';

  // Canonical component lines mix display-only footnote markers (`M *`, `M **`)
  // with older legacy captures that inline the material text after bare
  // component letters. The structured layer compares the actual V/S/M flags
  // here; material description, cost, and consumption are checked by the
  // Material Component lane instead of by the footnote count.
  const components = normalized
    .replace(/\([^)]*\)/g, '')
    .replace(/\*+/g, '*')
    .split(/[,\s]+/)
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part === 'V' || part === 'S' || part === 'M');

  return components.map((component) => (component === 'M' ? 'M *' : component)).join(', ');
}

function formatStructuredMaterial(labels: Map<string, string>): string {
  const description = (labels.get('Material Description') ?? '').trim();
  if (!description || description === 'None') return '';
  return `* - (${description})`;
}

function parseMaterialCost(value: string): number | null {
  const normalized = normalizeComparableText(value);
  const matches = Array.from(normalized.matchAll(/([0-9][0-9,]*(?:\.\d+)?)\+?\s*(gp|sp)\b(?:\s+each)?/gi));
  if (matches.length === 0) return null;

  const total = matches.reduce((sum, match) => {
    const amount = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(amount)) return sum;

    const unit = match[2].toLowerCase();
    let gpValue = unit === 'sp' ? amount / 10 : amount;
    const matchText = match[0];

    if (/\beach\b/i.test(matchText)) {
      const beforePrice = normalized.slice(Math.max(0, match.index - 80), match.index).toLowerCase();
      const numericQuantity = beforePrice.match(/(\d+)\s+\w+\s*$/);

      if (numericQuantity) {
        gpValue *= Number(numericQuantity[1]);
      } else if (/\bpair\b/i.test(beforePrice)) {
        gpValue *= 2;
      }
    }

    return sum + gpValue;
  }, 0);

  return total;
}

function normalizeMaterialDescriptionForFactComparison(value: string): { description: string; consumedFromText: boolean; costFromText: number | null } {
  let normalized = normalizeComparableText(value)
    .replace(/^\*+\s*-\s*/u, '')
    .trim();

  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    normalized = normalized.slice(1, -1).trim();
  }

  const consumedFromText = /\bwhich the spell consumes\b/i.test(normalized);
  const costFromText = parseMaterialCost(normalized);

  // The canonical snapshot keeps footnote wrappers and sometimes includes the
  // consumed clause inside the prose. The structured layer stores consumed and
  // cost as their own fields. This normalized string compares the actual
  // ingredient facts while preserving the raw copied text in the spell file.
  normalized = normalized
    .replace(/,?\s*which the spell consumes\b\.?/i, '')
    .replace(/\bGP\b/g, 'gp')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return { description: normalized, consumedFromText, costFromText };
}

function formatStructuredMaterialForCanonicalComparison(labels: Map<string, string>): string {
  const description = (labels.get('Material Description') ?? '').trim();
  const hasMaterial = (labels.get('Material') ?? '').trim() === 'true';
  if (!hasMaterial || !description || description === 'None') return '';

  const normalized = normalizeMaterialDescriptionForFactComparison(description);
  const costFromField = Number((labels.get('Material Cost GP') ?? '').replace(/,/g, ''));
  const cost = Number.isFinite(costFromField) ? costFromField : normalized.costFromText;
  const consumed = (labels.get('Consumed') ?? '').trim() === 'true' || normalized.consumedFromText;

  return `${normalized.description}|cost:${cost ?? 0}|consumed:${consumed}`;
}

function formatCanonicalMaterialForStructuredComparison(canonicalMaterial: string): string {
  if (!canonicalMaterial.trim()) return '';

  const normalized = normalizeMaterialDescriptionForFactComparison(canonicalMaterial);
  return `${normalized.description}|cost:${normalized.costFromText ?? 0}|consumed:${normalized.consumedFromText}`;
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
  if (durationType === 'until_dispelled_or_triggered') return 'Until Dispelled or Triggered';

  if (Number.isFinite(numericValue) && durationUnit) {
    const renderedUnit = formatSingularOrPlural(numericValue, durationUnit);
    const rendered = `${numericValue} ${renderedUnit}`.trim();
    return concentration ? `Concentration ${rendered}` : rendered;
  }

  return concentration ? 'Concentration' : titleCaseWord(durationType);
}

function normalizeDurationDisplayWords(value: string): string {
  return value
    .replace(/\bminutes\b/gi, 'Minutes')
    .replace(/\bminute\b/gi, 'Minute')
    .replace(/\bhours\b/gi, 'Hours')
    .replace(/\bhour\b/gi, 'Hour')
    .replace(/\bdays\b/gi, 'Days')
    .replace(/\bday\b/gi, 'Day')
    .replace(/\brounds\b/gi, 'Rounds')
    .replace(/\bround\b/gi, 'Round')
    .replace(/\binstantaneous\b/gi, 'Instantaneous')
    .replace(/\bspecial\b/gi, 'Special')
    .replace(/\bpermanent\b/gi, 'Permanent')
    .replace(/\buntil dispelled or triggered\b/gi, 'Until Dispelled or Triggered')
    .replace(/\buntil dispelled\b/gi, 'Until Dispelled')
    .replace(/\bconcentration\b/gi, 'Concentration');
}

function formatCanonicalDurationForStructuredComparison(canonicalDuration: string): string {
  const comparable = normalizeComparableText(canonicalDuration)
    .replace(/\s+\*+$/u, '')
    .replace(/^Concentration,\s*up to\s+/i, 'Concentration ')
    .replace(/^Concentration\s+up to\s+/i, 'Concentration ');

  // This function deliberately does not convert equivalent magnitudes such as
  // `60 Minutes` and `1 Hour`. The spell-template lane needs those unit choices
  // to stay visible because they affect whether the structured variables drift.
  return normalizeDurationDisplayWords(comparable);
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
  if (!value || value === 'None' || value === 'not_applicable') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
}

function joinComparableList(entries: string[]): string {
  return entries.join(', ');
}

function isCanonicalHigherLevelsLine(line: string): boolean {
  return /^Using a Higher-Level Spell Slot\./i.test(line)
    || /^At Higher Levels\./i.test(line)
    || /^Cantrip Upgrade\./i.test(line)
    || /^This spell['’]s damage increases\b/i.test(line)
    || /^The spell['’]s damage increases\b/i.test(line);
}

function splitCanonicalRulesText(rawRulesText: string): { mainRulesText: string; higherLevelsText: string } {
  const lines = rawRulesText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Canonical source prose has several section labels for the same scaling
  // concept. Splitting all of them keeps cantrip upgrades and older "At Higher
  // Levels" prose out of Description so the audit compares the intended fields.
  const higherLevelsStart = lines.findIndex(isCanonicalHigherLevelsLine);
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

function normalizeHigherLevelsDisplay(value: string): string {
  let comparable = normalizeComparableText(value);
  if (comparable.toLowerCase() === 'not_applicable') return '';

  comparable = comparable
    .replace(/^Cantrip Upgrade\.\s*/i, '')
    .replace(/^At Higher Levels\.\s*/i, '')
    .replace(/^Using a Higher-Level Spell Slot\.\s*/i, '')
    .replace(/^The spell's damage increases\b/i, "This spell's damage increases");

  const cantripDamageMatch = comparable.match(
    /^The damage increases by (.+?) when you reach levels (\d+) \(([^)]+)\), (\d+) \(([^)]+)\), and (\d+) \(([^)]+)\)\.?$/i,
  );

  if (cantripDamageMatch) {
    const [, dice, firstLevel, firstDamage, secondLevel, secondDamage, thirdLevel, thirdDamage] = cantripDamageMatch;
    comparable = `This spell's damage increases by ${dice} when you reach ${formatOrdinal(Number(firstLevel))} level (${firstDamage}), ${formatOrdinal(Number(secondLevel))} level (${secondDamage}), and ${formatOrdinal(Number(thirdLevel))} level (${thirdDamage}).`;
  }

  return comparable;
}

function normalizeRulesTextForStructuredComparison(value: string): string {
  return normalizeComparableText(value);
}

function normalizeFieldComparableText(field: string, value: string): string {
  const normalized = normalizeComparableText(value);

  // Linked terms copied from the source often only differ by capitalization
  // (`Sphere` versus `sphere`) or by smart-quote repair. For prose fields the
  // audit should surface content drift, not capitalization residue from links.
  if (field === 'Description' || field === 'Higher Levels') {
    return normalized.toLowerCase();
  }

  return normalized;
}

function formatStructuredHigherLevelsForCanonicalComparison(labels: Map<string, string>): string {
  return normalizeHigherLevelsDisplay(labels.get('Higher Levels') ?? '');
}

function formatCanonicalHigherLevelsForStructuredComparison(canonicalHigherLevelsText: string): string {
  return normalizeHigherLevelsDisplay(canonicalHigherLevelsText);
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
      canonicalValue: formatCanonicalCastingTimeForStructuredComparison(canonical.castingTime, structured.labels),
    },
    {
      field: 'Range/Area',
      structuredValue: formatStructuredRange(structured.labels, canonical.rangeArea),
      canonicalValue: formatCanonicalRangeForStructuredComparison(canonical.rangeArea),
    },
    {
      field: 'Components',
      structuredValue: formatStructuredComponents(structured.labels),
      canonicalValue: formatCanonicalComponentsForStructuredComparison(canonical.components),
    },
    {
      field: 'Material Component',
      structuredValue: formatStructuredMaterialForCanonicalComparison(structured.labels),
      canonicalValue: formatCanonicalMaterialForStructuredComparison(canonical.materialComponent),
    },
    {
      field: 'Duration',
      structuredValue: formatStructuredDuration(structured.labels),
      canonicalValue: formatCanonicalDurationForStructuredComparison(canonical.duration),
    },
    {
      field: 'Description',
      structuredValue: normalizeRulesTextForStructuredComparison(structured.labels.get('Description') ?? ''),
      canonicalValue: normalizeRulesTextForStructuredComparison(canonical.rulesText),
    },
    {
      field: 'Higher Levels',
      structuredValue: formatStructuredHigherLevelsForCanonicalComparison(structured.labels),
      canonicalValue: formatCanonicalHigherLevelsForStructuredComparison(canonical.higherLevelsText),
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
  const lower = normalized.toLowerCase();
  return normalized.length > 0 && lower !== 'none' && lower !== 'n/a' && lower !== 'not_applicable';
}

function isStructuredSubclassPolicyMarker(value: string): boolean {
  // The structured Sub-Classes lane deliberately keeps a small marker vocabulary
  // for cases where raw canonical access data should not become runtime-facing
  // subclass entries. Those markers are reviewed and maintained by the dedicated
  // roster audit, so the raw canonical parity report must preserve them as policy
  // outcomes instead of reopening the bucket as ordinary drift.
  const normalized = normalizeComparableText(value).toLowerCase();
  return normalized === 'folded into classes'
    || normalized === 'unsupported entries'
    || normalized === 'no subclass entries'
    || normalized === 'not_applicable';
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

function shouldTreatAsPolicyBoundary(field: ComparableField, canonical: CanonicalSpellRecord): boolean {
  // Several legacy D&D Beyond captures preserved spell prose but did not expose
  // the page's `Available For` list. In those cases the structured Classes row
  // is still the best known access surface, and deleting it would destroy useful
  // data. The audit therefore records this as a boundary instead of a defect.
  if (
    field.field === 'Classes'
    && canonical.legacyPage
    && canonical.availableFor.length === 0
    && isMeaningfulValue(field.structuredValue)
    && !isMeaningfulValue(field.canonicalValue)
  ) {
    return true;
  }

  // Sub-Classes now have a dedicated roster-aware audit that applies the repo's
  // supported-subclass and repeated-base policies before judging parity. The raw
  // canonical report intentionally does not duplicate that logic because doing so
  // makes policy-correct spell rows look "wrong" whenever the source snapshot keeps
  // unsupported or folded entries around. Every Sub-Classes comparison therefore
  // records as a boundary here and defers pass/fail ownership to that specialist audit.
  return field.field === 'Sub-Classes';
}

function buildPolicyBoundary(
  structured: StructuredSpellRecord,
  field: ComparableField,
): PolicyBoundary {
  const structuredValue = normalizeComparableText(field.structuredValue);
  const canonicalValue = normalizeComparableText(field.canonicalValue);
  const isSubclassPolicyBoundary = field.field === 'Sub-Classes';
  const usesStructuredSubclassMarker = isStructuredSubclassPolicyMarker(field.structuredValue);

  return {
    id: isSubclassPolicyBoundary
      ? `${structured.spellId}::${field.field}::structured-subclass-policy-marker`
      : `${structured.spellId}::${field.field}::legacy-canonical-missing-access`,
    spellId: structured.spellId,
    spellName: structured.spellName,
    markdownPath: structured.markdownPath,
    field: field.field,
    structuredValue,
    canonicalValue: isSubclassPolicyBoundary ? canonicalValue : '',
    policy: isSubclassPolicyBoundary
      ? usesStructuredSubclassMarker
        ? 'Structured Sub-Classes uses an approved policy marker governed by the roster-specific subclass audit, so raw canonical access text is recorded as a boundary instead of reopened as ordinary drift.'
        : 'Structured Sub-Classes is governed by the roster-specific subclass audit, which applies supported-roster and repeated-base policies before judging parity; this raw canonical comparison is recorded as a boundary so that audit remains the single source of truth.'
      : 'Legacy canonical capture has an empty Available For section, so the Classes row is preserved as structured access data and is not treated as canonical drift.',
  };
}

function hasStructuredHigherLevelScalingRules(labels: Map<string, string>): boolean {
  // Higher Levels prose can be copied perfectly while still failing the real
  // bucket goal: the structured layer must say what value scales. Numbered
  // Scaling Rule rows are the explicit contract for that machine-readable work.
  for (const label of labels.keys()) {
    if (/^Scaling Rule \d+ (Type|Applies To|Base|Levels|Bonus Per Level|Slot Level|Area Size|Target Count|Notes)$/.test(label)) {
      return true;
    }
  }

  return false;
}

function collectHigherLevelScalingCoverageMismatch(
  structured: StructuredSpellRecord,
  canonical: CanonicalSpellRecord,
  mismatches: ComparisonMismatch[],
): void {
  const canonicalHigherLevels = formatCanonicalHigherLevelsForStructuredComparison(canonical.higherLevelsText);
  const structuredHigherLevels = formatStructuredHigherLevelsForCanonicalComparison(structured.labels);

  // If either side exposes higher-level prose, the audit now expects the
  // structured block to also declare scaling rows. This intentionally reopens
  // the Higher Levels bucket for spells whose prose was copied but whose
  // scaling math is still not machine-actionable.
  if (
    (isMeaningfulValue(canonicalHigherLevels) || isMeaningfulValue(structuredHigherLevels))
    && !hasStructuredHigherLevelScalingRules(structured.labels)
  ) {
    pushMismatch(
      mismatches,
      structured,
      'missing-structured-field',
      'Higher Level Scaling',
      '',
      canonicalHigherLevels || structuredHigherLevels,
      `${structured.spellName} has higher-level scaling prose but no structured Scaling Rule rows describing what values scale.`,
    );
  }
}

interface CollectSpellComparisonOptions {
  // True for the partial 5etools-derived canonical blocks that intentionally only
  // populate identity fields (Name, Level, School). When set, fields where the
  // canonical side is unpopulated are skipped instead of producing
  // `missing-canonical-field` mismatches, since the partial block is not claiming
  // coverage of those fields. Value-mismatches and missing-structured-field
  // mismatches still fire normally on the populated fields.
  partialCanonical?: boolean;
}

function collectSpellComparison(
  structured: StructuredSpellRecord,
  canonical: CanonicalSpellRecord,
  options: CollectSpellComparisonOptions = {},
): { mismatches: ComparisonMismatch[]; policyBoundaries: PolicyBoundary[] } {
  const mismatches: ComparisonMismatch[] = [];
  const policyBoundaries: PolicyBoundary[] = [];

  for (const field of buildComparableFields(structured, canonical)) {
    const structuredValue = normalizeComparableText(field.structuredValue);
    const canonicalValue = normalizeComparableText(field.canonicalValue);
    const structuredComparisonValue = normalizeFieldComparableText(field.field, structuredValue);
    const canonicalComparisonValue = normalizeFieldComparableText(field.field, canonicalValue);

    if (shouldTreatAsPolicyBoundary(field, canonical)) {
      policyBoundaries.push(buildPolicyBoundary(structured, field));
      continue;
    }

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
      // Partial 5etools canonical blocks deliberately omit the prose fields
      // (Description, Higher Levels, Material Component, etc.). Treating those
      // omissions as `missing-canonical-field` mismatches would punish the
      // partial block for being intentionally narrow, so the audit skips them
      // here instead. Identity fields still get full comparison coverage.
      if (options.partialCanonical) continue;

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

    if (structuredComparisonValue !== canonicalComparisonValue) {
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

  // The higher-level-scaling coverage check inspects structured Scaling Rule
  // rows when either side has higher-level prose. Partial 5etools blocks do
  // not embed higher-level prose, so this would only fire on the structured
  // side - same shape as a normal canonical run, no special-casing needed.
  collectHigherLevelScalingCoverageMismatch(structured, canonical, mismatches);

  return { mismatches, policyBoundaries };
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
    `Policy boundaries: ${report.policyBoundaryCount}`,
    '',
    'This report does not arbitrate which side is correct. It surfaces where the structured Aralia spell data and the copied canonical snapshot are not currently identical, and it lists accepted policy boundaries separately so missing source data is not silent.',
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

  lines.push('## Policy Boundaries');
  lines.push('');

  if (report.policyBoundaries.length === 0) {
    lines.push('No policy boundaries recorded.');
    lines.push('');
    return lines.join('\n');
  }

  for (const boundary of report.policyBoundaries) {
    lines.push(`- ${boundary.spellName} / ${boundary.field}`);
    lines.push(`  - Structured: \`${boundary.structuredValue}\``);
    lines.push(`  - Policy: ${boundary.policy}`);
  }
  lines.push('');

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
  const policyBoundaries: PolicyBoundary[] = [];
  let comparedSpellFiles = 0;

  for (const markdownPath of files) {
    const markdown = readMarkdown(markdownPath);
    if (isCanonicalOnlyMarkdown(markdown)) continue;

    // Files carrying the 5etools partial-canonical marker take the partial path:
    // we extract the trailing comment block (which only carries Name / Level /
    // School), build a CanonicalSpellRecord whose unset prose fields parse as
    // empty strings, and pass `partialCanonical: true` so the comparison only
    // checks the populated identity fields. Without the partial flag, the
    // empty prose fields would each generate a synthetic `missing-canonical-field`
    // mismatch and flood the report.
    if (isCanonicalFromFiveEtoolsMarkdown(markdown)) {
      const partialBlock = extractFiveEtoolsCommentBlock(markdown);
      if (!partialBlock) continue;

      const structured = parseStructuredSpellRecord(markdownPath, markdown);
      const canonical = parseCanonicalSpellRecord(partialBlock);
      comparedSpellFiles += 1;
      const comparison = collectSpellComparison(structured, canonical, { partialCanonical: true });
      mismatches.push(...comparison.mismatches);
      policyBoundaries.push(...comparison.policyBoundaries);
      continue;
    }

    const commentBlock = extractCanonicalCommentBlock(markdown);
    if (!commentBlock) continue;

    const structured = parseStructuredSpellRecord(markdownPath, markdown);
    const canonical = parseCanonicalSpellRecord(commentBlock);
    comparedSpellFiles += 1;
    const comparison = collectSpellComparison(structured, canonical);
    mismatches.push(...comparison.mismatches);
    policyBoundaries.push(...comparison.policyBoundaries);
  }

  return {
    generatedAt: new Date().toISOString(),
    scannedMarkdownFiles: files.length,
    comparedSpellFiles,
    mismatchCount: mismatches.length,
    mismatches,
    groupedMismatches: groupMismatches(mismatches),
    policyBoundaryCount: policyBoundaries.length,
    policyBoundaries,
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
  console.log(`Policy boundaries: ${report.policyBoundaryCount}`);
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === SCRIPT_FILE
  : false;

if (isDirectRun) {
  main();
}
