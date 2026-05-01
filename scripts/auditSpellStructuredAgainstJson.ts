import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpellValidator } from '../src/systems/spells/validation/spellValidator';

/**
 * This file compares the structured spell markdown block to the live spell JSON.
 *
 * The spell-truth workflow now has an important second parity phase:
 * 1. canonical source gets compared to the structured markdown block
 * 2. the structured markdown block gets compared to the runtime JSON
 *
 * This script exists for phase 2. It answers the question the glossary could not
 * previously answer clearly: "after structured markdown was updated from canonical
 * source, is the runtime spell JSON still behind?"
 *
 * Called by:
 * - `npx tsx scripts/auditSpellStructuredAgainstJson.ts`
 * - `scripts/generateSpellGateReport.ts`
 * Writes:
 * - `docs/tasks/spells/SPELL_STRUCTURED_VS_JSON_REPORT.md`
 * - `.agent/roadmap-local/spell-validation/spell-structured-vs-json-report.json`
 */

// ============================================================================
// Paths, types, and report labels
// ============================================================================
// This section keeps the filesystem targets and mismatch shapes in one place so
// the audit can be rerun without changing the report contract the glossary and
// other tooling expect.
// ============================================================================

const REPO_ROOT = 'F:/Repos/Aralia';
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SPELL_REFERENCE_ROOT = path.join(REPO_ROOT, 'docs', 'spells', 'reference');
const SPELLS_ROOT = path.join(REPO_ROOT, 'public', 'data', 'spells');
const REPORT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-structured-vs-json-report.json');
const REPORT_MD_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_STRUCTURED_VS_JSON_REPORT.md');
const CANONICAL_ONLY_MARKER = '<!-- CANONICAL-ONLY-REFERENCE -->';

type MismatchKind = 'value-mismatch' | 'missing-structured-field' | 'missing-json-field' | 'json-parse-failed';

interface StructuredSpellRecord {
  spellId: string;
  spellName: string;
  markdownPath: string;
  labels: Map<string, string>;
}

interface StructuredJsonComparableRecord {
  spellId: string;
  spellName: string;
  jsonPath: string;
  labels: Map<string, string>;
}

interface ComparableField {
  field: string;
  structuredValue: string;
  jsonValue: string;
}

export interface StructuredJsonMismatch {
  id: string;
  groupKey: string;
  mismatchKind: MismatchKind;
  spellId: string;
  spellName: string;
  markdownPath: string;
  jsonPath: string;
  field: string;
  structuredValue: string;
  jsonValue: string;
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

export interface StructuredVsJsonReport {
  generatedAt: string;
  scannedMarkdownFiles: number;
  comparedSpellFiles: number;
  mismatchCount: number;
  mismatches: StructuredJsonMismatch[];
  groupedMismatches: GroupedMismatch[];
}

interface AuditOptions {
  spellId?: string;
}

// ============================================================================
// File discovery and parsing
// ============================================================================
// This section finds the structured markdown files, skips canonical-only stubs,
// and pairs each comparable markdown file with its matching runtime spell JSON.
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
  return files.sort((left, right) => left.localeCompare(right));
}

function findMarkdownFileForSpell(spellId: string): string | null {
  return listMarkdownFiles(SPELL_REFERENCE_ROOT).find((markdownPath) => path.basename(markdownPath, '.md') === spellId) ?? null;
}

function findSpellJsonPath(spellId: string): string | null {
  for (let level = 0; level <= 9; level += 1) {
    const candidate = path.join(SPELLS_ROOT, `level-${level}`, `${spellId}.json`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function readText(pathname: string): string {
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

  // The structured block is intentionally strict. This audit compares the exact
  // validator-facing markdown fields, not inferred prose elsewhere in the file.
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

// ============================================================================
// Normalization helpers
// ============================================================================
// This section turns structured markdown fields and runtime JSON fields into the
// same display shape before comparison. The goal is not to erase meaning. It is
// to avoid flagging noise like casing or list order as if it were real drift.
// ============================================================================

function normalizeComparableText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã¢â‚¬Å“/g, '"')
    .replace(/Ã¢â‚¬/g, '"')
    .replace(/Ã¢â‚¬â€œ/g, '-')
    .replace(/Ã¢â‚¬â€/g, '-')
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

function formatSingularOrPlural(value: number, unit: string): string {
  const normalizedUnit = unit.replace(/_/g, ' ').trim().toLowerCase();

  if (normalizedUnit === 'bonus action') {
    return value === 1 ? 'Bonus Action' : 'Bonus Actions';
  }

  // Both markdown and JSON can legitimately carry singular or plural unit
  // labels during the spell migration. Normalize those labels before pluralizing
  // so the audit does not invent fake drift like `10 Minutess`.
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

/**
 * Render a distance using the spell JSON's explicit unit field when present.
 *
 * Why this exists:
 * The runtime spell model is moving away from "all geometry is secretly feet."
 * The audit needs to understand that new explicit unit layer or it will flag
 * valid backfilled JSON as drift the moment we start adding the fields.
 */
function formatMeasuredDistance(
  value: number,
  unit: 'feet' | 'miles' | 'inches' = 'feet',
  style: 'separated' | 'hyphenated' = 'separated',
): string {
  if (unit === 'miles') {
    if (style === 'hyphenated') {
      return `${value}-mile`;
    }

    return `${value} ${value === 1 ? 'mile' : 'miles'}`;
  }

  if (unit === 'inches') {
    if (style === 'hyphenated') {
      return `${value}-inch`;
    }

    return `${value} ${value === 1 ? 'inch' : 'inches'}`;
  }

  return style === 'hyphenated' ? `${value}-ft.` : `${value} ft.`;
}

function normalizeDistanceUnit(raw: string): 'feet' | 'miles' | 'inches' {
  const normalized = normalizeComparableText(raw).toLowerCase();
  if (normalized === 'mile' || normalized === 'miles') return 'miles';
  if (normalized === 'inch' || normalized === 'inches') return 'inches';
  return 'feet';
}

function formatMeasuredDetailValue(value: number, unit: string): string {
  const normalized = normalizeComparableText(unit).toLowerCase();

  if (normalized === 'gallon' || normalized === 'gallons') {
    return `${value} ${value === 1 ? 'gallon' : 'gallons'}`;
  }

  if (normalized === 'minute' || normalized === 'minutes') {
    return `${value} ${value === 1 ? 'minute' : 'minutes'}`;
  }

  return formatMeasuredDistance(value, normalizeDistanceUnit(unit), 'separated');
}

function formatSizeTypeLabel(sizeType: string): string {
  switch (normalizeComparableText(sizeType).toLowerCase()) {
    case 'radius':
      return 'Radius';
    case 'diameter':
      return 'Diameter';
    case 'length':
      return 'Length';
    case 'edge':
      return 'Edge';
    case 'side':
      return 'Side';
    default:
      return '';
  }
}

function formatStructuredCastingTime(labels: Map<string, string>): string {
  const rawValue = labels.get('Casting Time Value') ?? '';
  const unit = labels.get('Casting Time Unit') ?? '';
  const numericValue = Number(rawValue);

  if (unit.trim().toLowerCase() === 'special') return 'Special';
  if (!Number.isFinite(numericValue) || !unit) return '';

  // Reaction trigger prose is a separate spell fact. The runtime JSON comparison
  // for the Casting Time field should answer whether the base cast timing aligns,
  // not whether trigger wording is carried in the same display string.
  return `${numericValue} ${formatSingularOrPlural(numericValue, unit)}`.trim();
}

function formatJsonCastingTime(spell: unknown): string {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) return '';

  if (parsed.data.castingTime.unit === 'special') return 'Special';
  const rendered = `${parsed.data.castingTime.value} ${formatSingularOrPlural(parsed.data.castingTime.value, parsed.data.castingTime.unit)}`.trim();

  return rendered;
}

function formatStructuredRange(labels: Map<string, string>): string {
  const rangeType = (labels.get('Range Type') ?? '').trim();
  const rangeDistance = (labels.get('Range Distance') ?? '').trim();
  const rangeUnit = (labels.get('Range Distance Unit') ?? labels.get('Range Unit') ?? '').trim();
  const areaShape = (labels.get('Area Shape') ?? '').trim();
  const areaSize = (labels.get('Area Size') ?? '').trim();
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

        // Reuse the same explicit-unit formatter as the JSON side so the audit
        // does not invent fake drift like "feets" once runtime geometry starts
        // carrying real unit fields. Structured markdown is still the compared
        // source here, but it should normalize to the same rendered contract.
        base = Number.isFinite(numericRange)
          ? formatMeasuredDistance(numericRange, normalizeDistanceUnit(rangeUnit || 'feet'))
          : `${rangeDistance} ${rangeUnit || 'ft.'}`.trim();
      }
      break;
    default:
      base = rangeType ? titleCaseWord(rangeType) : '';
      break;
  }

  if (!areaSize || areaSize === 'N/A') return base;

  const hasAreaShape = areaShape && areaShape !== 'N/A';
  if (!hasAreaShape) {
    return base ? `${base} (${areaSize})` : areaSize;
  }

  const renderedShape = areaShape
    .split(/[_\s-]+/)
    .map(titleCaseWord)
    .join(' ');
  const areaValue = Number(areaSize);
  const normalizedAreaUnit = areaUnit === 'miles'
    ? 'miles'
    : areaUnit === 'inches'
      ? 'inches'
      : 'feet';
  const sizeType = (labels.get('Area Size Type') ?? '').trim();
  const renderedSizeType = sizeType ? formatSizeTypeLabel(sizeType) : '';
  const renderedMeasurement = Number.isFinite(areaValue)
    ? formatMeasuredDistance(areaValue, normalizedAreaUnit, 'hyphenated')
    : areaSize;
  const area = `${renderedSizeType ? `${renderedSizeType} ` : ''}${renderedMeasurement} ${renderedShape}`.trim();

  if (!base) return area;
  return `${base} (${area})`;
}

function formatJsonRange(spell: unknown): string {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) return '';

  const { range, targeting } = parsed.data;
  let base = '';

  switch (range.type) {
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
      base = range.distance != null
        ? formatMeasuredDistance(range.distance, range.distanceUnit ?? 'feet')
        : '';
      break;
    default:
      base = range.type ? titleCaseWord(range.type) : '';
      break;
  }

  const area = targeting.areaOfEffect;
  if (!area || !area.size) return base;

  const renderedShape = area.shape
    ? area.shape.split(/[_\s-]+/).map(titleCaseWord).join(' ')
    : '';
  const renderedSizeType = area.sizeType ? formatSizeTypeLabel(area.sizeType) : '';
  const areaLabel = renderedShape
    ? `${renderedSizeType ? `${renderedSizeType} ` : ''}${formatMeasuredDistance(area.size, area.sizeUnit ?? 'feet', 'hyphenated')} ${renderedShape}`
    : `${area.size}`;

  if (!base) return areaLabel;
  return `${base} (${areaLabel})`;
}

function formatStructuredSpatialDetails(labels: Map<string, string>): string {
  const entries: string[] = [];

  // These numbered markdown fields are the new structured spell surface for
  // risky geometry spells. The audit needs to treat them as first-class data,
  // not as invisible extras, or the runtime backfill work cannot be verified.
  for (let index = 1; index <= 20; index += 1) {
    const label = (labels.get(`Spatial Form ${index} Label`) ?? '').trim();
    const shape = (labels.get(`Spatial Form ${index} Shape`) ?? '').trim();
    const sizeValue = (labels.get(`Spatial Form ${index} Size Value`) ?? '').trim();
    const sizeType = (labels.get(`Spatial Form ${index} Size Type`) ?? '').trim();
    const sizeUnit = (labels.get(`Spatial Form ${index} Size Unit`) ?? '').trim();
    const heightValue = (labels.get(`Spatial Form ${index} Height Value`) ?? '').trim();
    const heightUnit = (labels.get(`Spatial Form ${index} Height Unit`) ?? '').trim();
    const widthValue = (labels.get(`Spatial Form ${index} Width Value`) ?? '').trim();
    const widthUnit = (labels.get(`Spatial Form ${index} Width Unit`) ?? '').trim();
    const thicknessValue = (labels.get(`Spatial Form ${index} Thickness Value`) ?? '').trim();
    const thicknessUnit = (labels.get(`Spatial Form ${index} Thickness Unit`) ?? '').trim();
    const segmentCount = (labels.get(`Spatial Form ${index} Segment Count`) ?? '').trim();
    const segmentWidthValue = (labels.get(`Spatial Form ${index} Segment Width Value`) ?? '').trim();
    const segmentWidthUnit = (labels.get(`Spatial Form ${index} Segment Width Unit`) ?? '').trim();
    const segmentHeightValue = (labels.get(`Spatial Form ${index} Segment Height Value`) ?? '').trim();
    const segmentHeightUnit = (labels.get(`Spatial Form ${index} Segment Height Unit`) ?? '').trim();
    const notes = (labels.get(`Spatial Form ${index} Notes`) ?? '').trim();

    if (!label && !shape) continue;

    const parts: string[] = [];
    if (label) parts.push(label);
    if (shape) parts.push(`shape=${shape}`);
    if (sizeValue) {
      const measurement = Number.isFinite(Number(sizeValue))
        ? formatMeasuredDistance(Number(sizeValue), normalizeDistanceUnit(sizeUnit), 'separated')
        : sizeValue;
      const sizePrefix = sizeType ? `${formatSizeTypeLabel(sizeType)} ` : '';
      parts.push(`${sizePrefix}${measurement}`.trim());
    }
    if (heightValue) {
      const measurement = Number.isFinite(Number(heightValue))
        ? formatMeasuredDistance(Number(heightValue), normalizeDistanceUnit(heightUnit), 'separated')
        : heightValue;
      parts.push(`Height ${measurement}`);
    }
    if (widthValue) {
      const measurement = Number.isFinite(Number(widthValue))
        ? formatMeasuredDistance(Number(widthValue), normalizeDistanceUnit(widthUnit), 'separated')
        : widthValue;
      parts.push(`Width ${measurement}`);
    }
    if (thicknessValue) {
      const measurement = Number.isFinite(Number(thicknessValue))
        ? formatMeasuredDistance(Number(thicknessValue), normalizeDistanceUnit(thicknessUnit), 'separated')
        : thicknessValue;
      parts.push(`Thickness ${measurement}`);
    }
    if (segmentCount) parts.push(`Segments ${segmentCount}`);
    if (segmentWidthValue) {
      const measurement = Number.isFinite(Number(segmentWidthValue))
        ? formatMeasuredDistance(Number(segmentWidthValue), normalizeDistanceUnit(segmentWidthUnit), 'separated')
        : segmentWidthValue;
      parts.push(`Segment Width ${measurement}`);
    }
    if (segmentHeightValue) {
      const measurement = Number.isFinite(Number(segmentHeightValue))
        ? formatMeasuredDistance(Number(segmentHeightValue), normalizeDistanceUnit(segmentHeightUnit), 'separated')
        : segmentHeightValue;
      parts.push(`Segment Height ${measurement}`);
    }
    if (notes) parts.push(notes);

    entries.push(parts.join(' | '));
  }

  for (let index = 1; index <= 20; index += 1) {
    const label = (labels.get(`Spatial Detail ${index} Label`) ?? '').trim();
    const kind = (labels.get(`Spatial Detail ${index} Kind`) ?? '').trim();
    const subject = (labels.get(`Spatial Detail ${index} Subject`) ?? '').trim();
    const value = (labels.get(`Spatial Detail ${index} Value`) ?? '').trim();
    const unit = (labels.get(`Spatial Detail ${index} Unit`) ?? '').trim();
    const qualifier = (labels.get(`Spatial Detail ${index} Qualifier`) ?? '').trim();
    const notes = (labels.get(`Spatial Detail ${index} Notes`) ?? '').trim();

    if (!label) continue;

    const parts: string[] = [label];
    if (kind) parts.push(`kind=${kind}`);
    if (subject) parts.push(subject);
    if (value) {
      const measurement = Number.isFinite(Number(value))
        ? formatMeasuredDetailValue(Number(value), unit)
        : value;
      parts.push(measurement);
    }
    if (qualifier) parts.push(qualifier);
    if (notes) parts.push(notes);

    entries.push(parts.join(' | '));
  }

  return entries.join(' || ');
}

function formatJsonSpatialDetails(spell: unknown): string {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) return '';

  const spatialDetails = parsed.data.targeting.spatialDetails;
  if (!spatialDetails) return '';

  const entries: string[] = [];

  for (const form of spatialDetails.forms ?? []) {
    const parts: string[] = [];
    if (form.label) parts.push(form.label);
    parts.push(`shape=${form.shape}`);
    if (typeof form.size === 'number') {
      const sizePrefix = form.sizeType ? `${formatSizeTypeLabel(form.sizeType)} ` : '';
      parts.push(`${sizePrefix}${formatMeasuredDistance(form.size, form.sizeUnit ?? 'feet')}`.trim());
    }
    if (typeof form.height === 'number') {
      parts.push(`Height ${formatMeasuredDistance(form.height, form.heightUnit ?? 'feet')}`);
    }
    if (typeof form.width === 'number') {
      parts.push(`Width ${formatMeasuredDistance(form.width, form.widthUnit ?? 'feet')}`);
    }
    if (typeof form.thickness === 'number') {
      parts.push(`Thickness ${formatMeasuredDistance(form.thickness, form.thicknessUnit ?? 'feet')}`);
    }
    if (typeof form.segmentCount === 'number') parts.push(`Segments ${form.segmentCount}`);
    if (typeof form.segmentWidth === 'number') {
      parts.push(`Segment Width ${formatMeasuredDistance(form.segmentWidth, form.segmentWidthUnit ?? 'feet')}`);
    }
    if (typeof form.segmentHeight === 'number') {
      parts.push(`Segment Height ${formatMeasuredDistance(form.segmentHeight, form.segmentHeightUnit ?? 'feet')}`);
    }
    if (form.notes) parts.push(form.notes);
    entries.push(parts.join(' | '));
  }

  for (const detail of spatialDetails.measuredDetails ?? []) {
    const parts: string[] = [detail.label, `kind=${detail.kind}`];
    if (detail.subject) parts.push(detail.subject);
    if (typeof detail.value === 'number') {
      parts.push(formatMeasuredDetailValue(detail.value, detail.unit ?? 'feet'));
    }
    if (detail.qualifier) parts.push(detail.qualifier);
    if (detail.notes) parts.push(detail.notes);
    entries.push(parts.join(' | '));
  }

  return entries.join(' || ');
}

function formatStructuredComponents(labels: Map<string, string>): string {
  const parts: string[] = [];
  const material = (labels.get('Material') ?? '').trim() === 'true';

  if ((labels.get('Verbal') ?? '').trim() === 'true') parts.push('V');
  if ((labels.get('Somatic') ?? '').trim() === 'true') parts.push('S');
  if (material) parts.push('M *');

  return parts.join(', ');
}

function formatJsonComponents(spell: unknown): string {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) return '';

  const parts: string[] = [];
  if (parsed.data.components.verbal) parts.push('V');
  if (parsed.data.components.somatic) parts.push('S');
  if (parsed.data.components.material) parts.push('M *');
  return parts.join(', ');
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

    if (/\beach\b/i.test(match[0])) {
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

  // Material notes are split into multiple structured/runtime fields in
  // Aralia. Comparing the facts here keeps wrapper text and prose placement
  // from being reported as runtime drift.
  normalized = normalized
    .replace(/,?\s*which the spell consumes\b\.?/i, '')
    .replace(/\bGP\b/g, 'gp')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return { description: normalized, consumedFromText, costFromText };
}

function formatStructuredMaterialForJsonComparison(labels: Map<string, string>): string {
  const description = (labels.get('Material Description') ?? '').trim();
  const hasMaterial = (labels.get('Material') ?? '').trim() === 'true';
  if (!hasMaterial || !description || description === 'None') return '';

  const normalized = normalizeMaterialDescriptionForFactComparison(description);
  const costFromField = Number((labels.get('Material Cost GP') ?? '').replace(/,/g, ''));
  const cost = Number.isFinite(costFromField) ? costFromField : normalized.costFromText;
  const consumed = (labels.get('Consumed') ?? '').trim() === 'true' || normalized.consumedFromText;

  return `${normalized.description}|cost:${cost ?? 0}|consumed:${consumed}`;
}

function formatJsonMaterialForStructuredComparison(spell: unknown): string {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) return '';

  const components = parsed.data.components;
  const description = components.materialDescription?.trim() ?? '';
  if (!components.material || !description) return '';

  const normalized = normalizeMaterialDescriptionForFactComparison(description);
  const cost = typeof components.materialCost === 'number' ? components.materialCost : normalized.costFromText;
  const consumed = components.isConsumed === true || normalized.consumedFromText;

  return `${normalized.description}|cost:${cost ?? 0}|consumed:${consumed}`;
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
    const rendered = `${numericValue} ${formatSingularOrPlural(numericValue, durationUnit)}`.trim();
    return concentration ? `Concentration ${rendered}` : rendered;
  }

  return concentration ? 'Concentration' : titleCaseWord(durationType);
}

function formatJsonDuration(spell: unknown): string {
  const parsed = SpellValidator.safeParse(spell);
  if (!parsed.success) return '';

  const { duration } = parsed.data;
  if (duration.type === 'instantaneous') return 'Instantaneous';
  if (duration.type === 'special') return 'Special';
  if (duration.type === 'permanent') return 'Permanent';
  if (duration.type === 'until_dispelled') return 'Until Dispelled';

  if (typeof duration.value === 'number' && duration.value > 0 && duration.unit) {
    const rendered = `${duration.value} ${formatSingularOrPlural(duration.value, duration.unit)}`.trim();
    return duration.concentration ? `Concentration ${rendered}` : rendered;
  }

  return duration.concentration ? 'Concentration' : titleCaseWord(duration.type);
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

function formatJsonComparableRecord(spellId: string, jsonPath: string, rawSpell: unknown): StructuredJsonComparableRecord {
  const parsed = SpellValidator.safeParse(rawSpell);

  if (!parsed.success) {
    return {
      spellId,
      spellName: spellId,
      jsonPath,
      labels: new Map(),
    };
  }

  const spell = parsed.data;
  const labels = new Map<string, string>([
    ['Name', spell.name],
    ['Level', String(spell.level)],
    ['School', spell.school],
    ['Classes', joinComparableList([...spell.classes].sort())],
    ['Sub-Classes', joinComparableList([...spell.subClasses].sort())],
    ['Casting Time', formatJsonCastingTime(spell)],
    ['Range/Area', formatJsonRange(spell)],
    ['Components', formatJsonComponents(spell)],
    ['Material Component', formatJsonMaterialForStructuredComparison(spell)],
    ['Duration', formatJsonDuration(spell)],
    ['Description', spell.description ?? ''],
    ['Higher Levels', spell.higherLevels ?? ''],
    ['Spatial Details', formatJsonSpatialDetails(spell)],
  ]);

  return {
    spellId,
    spellName: spell.name,
    jsonPath,
    labels,
  };
}

function buildComparableFields(structured: StructuredSpellRecord, comparableJson: StructuredJsonComparableRecord): ComparableField[] {
  return [
    { field: 'Name', structuredValue: structured.spellName, jsonValue: comparableJson.labels.get('Name') ?? '' },
    { field: 'Level', structuredValue: structured.labels.get('Level') ?? '', jsonValue: comparableJson.labels.get('Level') ?? '' },
    { field: 'School', structuredValue: structured.labels.get('School') ?? '', jsonValue: comparableJson.labels.get('School') ?? '' },
    { field: 'Classes', structuredValue: joinComparableList(normalizeStructuredList(structured.labels.get('Classes') ?? '')), jsonValue: comparableJson.labels.get('Classes') ?? '' },
    { field: 'Sub-Classes', structuredValue: joinComparableList(normalizeStructuredList(structured.labels.get('Sub-Classes') ?? '')), jsonValue: comparableJson.labels.get('Sub-Classes') ?? '' },
    { field: 'Casting Time', structuredValue: formatStructuredCastingTime(structured.labels), jsonValue: comparableJson.labels.get('Casting Time') ?? '' },
    { field: 'Range/Area', structuredValue: formatStructuredRange(structured.labels), jsonValue: comparableJson.labels.get('Range/Area') ?? '' },
    { field: 'Components', structuredValue: formatStructuredComponents(structured.labels), jsonValue: comparableJson.labels.get('Components') ?? '' },
    { field: 'Material Component', structuredValue: formatStructuredMaterialForJsonComparison(structured.labels), jsonValue: comparableJson.labels.get('Material Component') ?? '' },
    { field: 'Duration', structuredValue: formatStructuredDuration(structured.labels), jsonValue: comparableJson.labels.get('Duration') ?? '' },
    { field: 'Description', structuredValue: structured.labels.get('Description') ?? '', jsonValue: comparableJson.labels.get('Description') ?? '' },
    { field: 'Higher Levels', structuredValue: structured.labels.get('Higher Levels') ?? '', jsonValue: comparableJson.labels.get('Higher Levels') ?? '' },
    { field: 'Spatial Details', structuredValue: formatStructuredSpatialDetails(structured.labels), jsonValue: comparableJson.labels.get('Spatial Details') ?? '' },
  ];
}

// ============================================================================
// Mismatch collection
// ============================================================================
// This section compares normalized field pairs and records where structured
// markdown still differs from the live runtime JSON that the glossary renders.
// ============================================================================

function isMeaningfulValue(value: string): boolean {
  const normalized = normalizeComparableText(value);
  return normalized.length > 0 && normalized.toLowerCase() !== 'none' && normalized.toLowerCase() !== 'n/a';
}

function pushMismatch(
  mismatches: StructuredJsonMismatch[],
  spell: StructuredSpellRecord,
  jsonPath: string,
  mismatchKind: MismatchKind,
  field: string,
  structuredValue: string,
  jsonValue: string,
  summary: string,
): void {
  mismatches.push({
    id: `${spell.spellId}::${field}::${mismatchKind}`,
    groupKey: `structured-vs-json / ${field}`,
    mismatchKind,
    spellId: spell.spellId,
    spellName: spell.spellName,
    markdownPath: spell.markdownPath,
    jsonPath,
    field,
    structuredValue,
    jsonValue,
    summary,
  });
}

function collectSpellMismatches(
  structured: StructuredSpellRecord,
  jsonPath: string,
  rawSpell: unknown,
): StructuredJsonMismatch[] {
  const mismatches: StructuredJsonMismatch[] = [];
  const parsed = SpellValidator.safeParse(rawSpell);

  if (!parsed.success) {
    pushMismatch(
      mismatches,
      structured,
      jsonPath,
      'json-parse-failed',
      'JSON Parse',
      '',
      '',
      `${structured.spellName} could not be compared because the live spell JSON failed schema parsing.`,
    );
    return mismatches;
  }

  const comparableJson = formatJsonComparableRecord(structured.spellId, jsonPath, parsed.data);

  for (const field of buildComparableFields(structured, comparableJson)) {
    const structuredValue = normalizeComparableText(field.structuredValue);
    const jsonValue = normalizeComparableText(field.jsonValue);

    if (!isMeaningfulValue(structuredValue) && !isMeaningfulValue(jsonValue)) {
      continue;
    }

    if (!isMeaningfulValue(structuredValue) && isMeaningfulValue(jsonValue)) {
      pushMismatch(
        mismatches,
        structured,
        jsonPath,
        'missing-structured-field',
        field.field,
        '',
        jsonValue,
        `${structured.spellName} is missing structured ${field.field} data that still exists in the runtime spell JSON.`,
      );
      continue;
    }

    if (isMeaningfulValue(structuredValue) && !isMeaningfulValue(jsonValue)) {
      pushMismatch(
        mismatches,
        structured,
        jsonPath,
        'missing-json-field',
        field.field,
        structuredValue,
        '',
        `${structured.spellName} still has structured ${field.field} data, but the runtime spell JSON does not currently store a comparable ${field.field} value.`,
      );
      continue;
    }

    if (structuredValue !== jsonValue) {
      pushMismatch(
        mismatches,
        structured,
        jsonPath,
        'value-mismatch',
        field.field,
        structuredValue,
        jsonValue,
        `${structured.spellName} records ${field.field} differently in the structured markdown block and the runtime spell JSON.`,
      );
    }
  }

  return mismatches;
}

function groupMismatches(mismatches: StructuredJsonMismatch[]): GroupedMismatch[] {
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
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.groupKey.localeCompare(right.groupKey);
    });
}

// ============================================================================
// Report writing
// ============================================================================
// This section writes both the machine artifact and the human-readable grouped
// report so the glossary and the spell-truth workflow can reuse the same data.
// ============================================================================

function renderMarkdownReport(report: StructuredVsJsonReport): string {
  const lines: string[] = [
    '# Spell Structured vs JSON Report',
    '',
    'This report compares the validator-facing structured spell markdown block to the live runtime spell JSON that the glossary renders.',
    '',
    `Generated: ${report.generatedAt}`,
    `Markdown files scanned: ${report.scannedMarkdownFiles}`,
    `Spell files compared: ${report.comparedSpellFiles}`,
    `Total mismatches: ${report.mismatchCount}`,
    `Grouped mismatch buckets: ${report.groupedMismatches.length}`,
    '',
    'This is the second parity phase in the spell-truth workflow. It shows where runtime JSON still lags behind the structured markdown after canonical review work has already happened.',
    '',
    '## Grouped Mismatches',
    '',
  ];

  if (report.groupedMismatches.length === 0) {
    lines.push('No structured-vs-json mismatches found.');
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

function writeReport(report: StructuredVsJsonReport): void {
  fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(REPORT_MD_PATH, `${renderMarkdownReport(report)}\n`, 'utf8');
}

// ============================================================================
// Main audit builder
// ============================================================================
// This section walks the structured markdown corpus, finds matching JSON files,
// and assembles the final report. Single-spell mode keeps the same report shape
// so the glossary dev endpoint can ask for a fresh answer on one spell only.
// ============================================================================

export function buildReport(options: AuditOptions = {}): StructuredVsJsonReport {
  const files = options.spellId
    ? [findMarkdownFileForSpell(options.spellId)].filter((value): value is string => Boolean(value))
    : listMarkdownFiles(SPELL_REFERENCE_ROOT);
  const mismatches: StructuredJsonMismatch[] = [];
  let comparedSpellFiles = 0;

  for (const markdownPath of files) {
    const markdown = readText(markdownPath);
    if (isCanonicalOnlyMarkdown(markdown)) continue;

    const structured = parseStructuredSpellRecord(markdownPath, markdown);
    const jsonPath = findSpellJsonPath(structured.spellId);
    if (!jsonPath) continue;

    const rawSpell = JSON.parse(readText(jsonPath)) as unknown;
    comparedSpellFiles += 1;
    mismatches.push(...collectSpellMismatches(structured, jsonPath, rawSpell));
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

  console.log(`Structured-vs-json report written to ${REPORT_MD_PATH}`);
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
