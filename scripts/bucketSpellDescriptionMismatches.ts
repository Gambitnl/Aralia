import fs from 'node:fs';
import path from 'node:path';

/**
 * This file breaks the spell description mismatch bucket into smaller reviewable families.
 *
 * The first structured-vs-canonical audit showed that `Description` is by far the largest
 * mismatch family. Reviewing 340 description diffs as one bucket is not practical, so this
 * script reads the existing comparison artifact and classifies those description mismatches
 * into smaller sub-buckets that are easier to review and arbitrate.
 *
 * Called manually by: Codex during the "spell .md description bucket" review lane
 * Depends on:
 * - `.agent/roadmap-local/spell-validation/spell-structured-vs-canonical-report.json`
 * Writes:
 * - `docs/tasks/spells/SPELL_DESCRIPTION_SUBBUCKET_REPORT.md`
 * - `.agent/roadmap-local/spell-validation/spell-description-subbucket-report.json`
 */

// ============================================================================
// Paths and shared types
// ============================================================================
// This section keeps the input artifact and the two output surfaces together.
// The machine artifact stores the exact bucket assignments, while the markdown
// report is the human-facing review surface.
// ============================================================================

const REPO_ROOT = 'F:/Repos/Aralia';
const INPUT_REPORT_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-structured-vs-canonical-report.json');
const OUTPUT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-description-subbucket-report.json');
const OUTPUT_MD_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_DESCRIPTION_SUBBUCKET_REPORT.md');

type DescriptionBucketId =
  | 'higher-level-text-missing'
  | 'canonical-2024-terminology-shift'
  | 'canonical-extra-option-detail'
  | 'canonical-extra-rules-detail'
  | 'structured-extra-legacy-or-interpretive-wording'
  | 'condition-and-save-wording-shift'
  | 'damage-and-scaling-wording-shift'
  | 'area-and-targeting-wording-shift'
  | 'general-phrasing-rewrite'
  | 'multi-factor-rewrite'
  | 'uncategorized';

interface ComparisonMismatch {
  id: string;
  groupKey: string;
  mismatchKind: string;
  spellId: string;
  spellName: string;
  markdownPath: string;
  field: string;
  structuredValue: string;
  canonicalValue: string;
  summary: string;
}

interface StructuredVsCanonicalReport {
  generatedAt: string;
  scannedMarkdownFiles: number;
  comparedSpellFiles: number;
  mismatchCount: number;
  mismatches: ComparisonMismatch[];
}

interface DescriptionSubBucketRecord {
  spellId: string;
  spellName: string;
  markdownPath: string;
  bucketId: DescriptionBucketId;
  reason: string;
  structuredPreview: string;
  canonicalPreview: string;
}

interface GroupedDescriptionBucket {
  bucketId: DescriptionBucketId;
  title: string;
  rationale: string;
  count: number;
  spellIds: string[];
  sampleSpellIds: string[];
  sampleReasons: string[];
}

interface DescriptionSubBucketReport {
  generatedAt: string;
  descriptionMismatchCount: number;
  subBucketCount: number;
  records: DescriptionSubBucketRecord[];
  groupedBuckets: GroupedDescriptionBucket[];
}

// ============================================================================
// Input parsing helpers
// ============================================================================
// This section loads only the already-generated structured-vs-canonical report.
// The sub-bucketing pass is intentionally downstream of that existing audit so
// the project has one source of truth for raw mismatches and one helper layer
// for review-oriented clustering.
// ============================================================================

function readInputReport(): StructuredVsCanonicalReport {
  return JSON.parse(fs.readFileSync(INPUT_REPORT_PATH, 'utf8')) as StructuredVsCanonicalReport;
}

function normalizeComparableText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function lower(value: string): string {
  return normalizeComparableText(value).toLowerCase();
}

function buildPreview(value: string): string {
  const normalized = normalizeComparableText(value);
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

// ============================================================================
// Bucket heuristics
// ============================================================================
// This section maps a flat description mismatch into a best-fit review bucket.
// The buckets are intentionally review-oriented, not academically perfect. They
// answer "what kind of difference is this?" well enough to support arbitration.
// ============================================================================

function classifyDescriptionMismatch(mismatch: ComparisonMismatch): { bucketId: DescriptionBucketId; reason: string } {
  const structured = lower(mismatch.structuredValue);
  const canonical = lower(mismatch.canonicalValue);

  const canonicalHasHigherLevel = canonical.includes('using a higher-level spell slot.');
  const structuredHasHigherLevel = structured.includes('using a higher-level spell slot.')
    || structured.includes('for each spell slot level above')
    || structured.includes('at higher levels');

  if (canonicalHasHigherLevel && !structuredHasHigherLevel) {
    return {
      bucketId: 'higher-level-text-missing',
      reason: 'The canonical description includes an explicit higher-level scaling paragraph that the structured description does not include.',
    };
  }

  if (
    hasAny(canonical, [
      'magic action',
      'study action',
      'friendly to you',
      'has the prone condition',
      'has the charmed condition',
      'has the blinded condition',
      'emanation',
      'originating from you',
      'ally',
      'allies',
      'yourself',
    ])
    && !hasAny(structured, [
      'magic action',
      'study action',
      'friendly to you',
      'has the prone condition',
      'has the charmed condition',
      'has the blinded condition',
      'emanation',
      'originating from you',
      'ally',
      'allies',
      'yourself',
    ])
  ) {
    return {
      bucketId: 'canonical-2024-terminology-shift',
      reason: 'The canonical description uses 2024-era rules terminology or glossary language that the structured description still expresses in older wording.',
    };
  }

  if (
    hasAny(canonical, [
      'choose the command from these options',
      'audible alarm.',
      'mental alarm.',
      'create water.',
      'destroy water.',
      'approach.',
      'drop.',
      'flee.',
      'grovel.',
      'halt.',
    ])
    && !hasAny(structured, [
      'choose the command from these options',
      'audible alarm.',
      'mental alarm.',
      'create water.',
      'destroy water.',
      'approach.',
      'drop.',
      'flee.',
      'grovel.',
      'halt.',
    ])
  ) {
    return {
      bucketId: 'canonical-extra-option-detail',
      reason: 'The canonical description expands summarized options into an explicit choice list or labeled option block that the structured description collapses.',
    };
  }

  if (
    canonical.length > structured.length * 1.2
    && hasAny(canonical, [
      'to discern',
      'if the spell ends before then',
      'the spell ends if',
      'the spell is blocked by',
      'using a higher-level spell slot.',
      'objects pass through',
      'must take the study action',
    ])
  ) {
    return {
      bucketId: 'canonical-extra-rules-detail',
      reason: 'The canonical description contains extra operational rules detail that appears shortened or omitted in the structured description.',
    };
  }

  if (
    structured.length > canonical.length * 1.15
    && hasAny(structured, [
      'manifesting as',
      'the dark hunger',
      'wracking it with terrible pain',
      'this spell lets you',
      'drawn to you, compelled by your divine demand',
      'as you hold your hands',
      'including your clothing, armor, weapons, and other belongings on your person',
    ])
  ) {
    return {
      bucketId: 'structured-extra-legacy-or-interpretive-wording',
      reason: 'The structured description still carries older flavor-heavy or interpretive wording that the canonical snapshot expresses more directly.',
    };
  }

  if (
    hasAny(canonical, [
      'has the charmed condition',
      'has the blinded condition',
      'has the prone condition',
      'on a failed save',
      'on a successful save',
      'takes half as much damage only',
      'wisdom saving throw',
      'strength saving throw',
      'dexterity saving throw',
      'constitution saving throw',
    ])
    && hasAny(structured, [
      'is charmed',
      'is blinded',
      'make a wisdom saving throw',
      'make a strength saving throw',
      'make a dexterity saving throw',
      'make a constitution saving throw',
      'half as much damage',
    ])
  ) {
    return {
      bucketId: 'condition-and-save-wording-shift',
      reason: 'Both sides describe the same mechanic, but the canonical snapshot uses updated condition/save phrasing while the structured description keeps older wording.',
    };
  }

  if (
    hasAny(canonical, [
      'the damage increases by',
      'the healing increases by',
      'adds 1d4',
      'subtract 1d4',
      'takes 3d6',
      'takes 2d6',
      'temporary hit points',
    ])
    && hasAny(structured, [
      'takes 3d6',
      'takes 2d6',
      'add the number rolled',
      'subtract the number rolled',
      'temporary hit points',
    ])
  ) {
    return {
      bucketId: 'damage-and-scaling-wording-shift',
      reason: 'The mismatch is centered on how the spell expresses damage, healing, or scaling math rather than on a different spell effect entirely.',
    };
  }

  if (
    hasAny(canonical, [
      'cone',
      'cube',
      'emanation',
      'within range',
      'originating from you',
      'target within range',
    ])
    && hasAny(structured, [
      'cone',
      'cube',
      'within range',
      'creature in that area',
      'all creatures within',
    ])
  ) {
    return {
      bucketId: 'area-and-targeting-wording-shift',
      reason: 'The mismatch is mainly about how the description phrases area, target selection, or point-of-origin language.',
    };
  }

  // When both sides are clearly describing the same spell effect but none of the
  // narrower issue families above dominate, treat it as a general rewrite bucket.
  // This keeps "same mechanic, different sentence shape" cases out of Uncategorized.
  if (
    canonical.length > 0
    && structured.length > 0
    && Math.min(canonical.length, structured.length) >= 80
  ) {
    return {
      bucketId: 'general-phrasing-rewrite',
      reason: 'The structured and canonical descriptions appear to describe the same mechanic, but with a broad wording rewrite rather than one narrow issue like scaling or targeting.',
    };
  }

  const triggeredSignals = [
    canonicalHasHigherLevel && !structuredHasHigherLevel,
    hasAny(canonical, ['magic action', 'study action', 'friendly to you', 'emanation', 'allies']),
    hasAny(canonical, ['choose the command from these options', 'audible alarm.', 'mental alarm.']),
    canonical.length > structured.length * 1.2,
    structured.length > canonical.length * 1.15,
  ].filter(Boolean).length;

  if (triggeredSignals >= 2) {
    return {
      bucketId: 'multi-factor-rewrite',
      reason: 'The mismatch combines several kinds of description drift at once and does not fit cleanly into one narrower review bucket.',
    };
  }

  return {
    bucketId: 'uncategorized',
    reason: 'The mismatch did not meet any current heuristic strongly enough to assign a narrower review bucket.',
  };
}

function bucketTitle(bucketId: DescriptionBucketId): string {
  switch (bucketId) {
    case 'higher-level-text-missing':
      return 'Higher-Level Text Missing';
    case 'canonical-2024-terminology-shift':
      return '2024 Terminology Shift';
    case 'canonical-extra-option-detail':
      return 'Canonical Option Detail Expanded';
    case 'canonical-extra-rules-detail':
      return 'Canonical Extra Rules Detail';
    case 'structured-extra-legacy-or-interpretive-wording':
      return 'Structured Legacy Or Interpretive Wording';
    case 'condition-and-save-wording-shift':
      return 'Condition And Save Wording Shift';
    case 'damage-and-scaling-wording-shift':
      return 'Damage And Scaling Wording Shift';
    case 'area-and-targeting-wording-shift':
      return 'Area And Targeting Wording Shift';
    case 'general-phrasing-rewrite':
      return 'General Phrasing Rewrite';
    case 'multi-factor-rewrite':
      return 'Multi-Factor Rewrite';
    case 'uncategorized':
      return 'Uncategorized';
  }
}

function bucketRationale(bucketId: DescriptionBucketId): string {
  switch (bucketId) {
    case 'higher-level-text-missing':
      return 'Structured markdown is missing explicit upcasting or higher-slot text that exists in the canonical description.';
    case 'canonical-2024-terminology-shift':
      return 'Canonical text uses updated 2024 rules vocabulary while the structured description still uses older or less glossary-aligned phrasing.';
    case 'canonical-extra-option-detail':
      return 'Canonical text expands choices or modes into labeled option blocks that the structured description currently summarizes.';
    case 'canonical-extra-rules-detail':
      return 'Canonical text contains additional operational rules detail that appears shortened or omitted in the structured description.';
    case 'structured-extra-legacy-or-interpretive-wording':
      return 'Structured markdown includes extra older wording, flavor framing, or interpretive phrasing that is not present in the copied canonical text.';
    case 'condition-and-save-wording-shift':
      return 'The underlying mechanic looks similar, but the phrasing around conditions, saves, and success/failure outcomes differs.';
    case 'damage-and-scaling-wording-shift':
      return 'The difference is concentrated in damage, healing, temporary hit points, or scaling math wording.';
    case 'area-and-targeting-wording-shift':
      return 'The main drift is in area-of-effect or targeting phrasing, especially older vs current source wording.';
    case 'general-phrasing-rewrite':
      return 'These descriptions look like broad same-mechanic rewrites where the sentence structure and detail selection changed without one dominant narrow mismatch type.';
    case 'multi-factor-rewrite':
      return 'These spells combine multiple types of description drift and probably need individual review rather than one simple ruling.';
    case 'uncategorized':
      return 'These mismatches still need a more specific taxonomy or individual review.';
  }
}

// ============================================================================
// Grouping and report rendering
// ============================================================================
// This section turns the per-spell bucket assignments into a review report that
// shows counts, rationale, and examples for each description mismatch family.
// ============================================================================

function groupRecords(records: DescriptionSubBucketRecord[]): GroupedDescriptionBucket[] {
  const groups = new Map<DescriptionBucketId, GroupedDescriptionBucket>();

  for (const record of records) {
    const existing = groups.get(record.bucketId);
    if (existing) {
      existing.count += 1;
      existing.spellIds.push(record.spellId);
      if (existing.sampleSpellIds.length < 10) {
        existing.sampleSpellIds.push(record.spellId);
      }
      if (existing.sampleReasons.length < 5) {
        existing.sampleReasons.push(record.reason);
      }
      continue;
    }

    groups.set(record.bucketId, {
      bucketId: record.bucketId,
      title: bucketTitle(record.bucketId),
      rationale: bucketRationale(record.bucketId),
      count: 1,
      spellIds: [record.spellId],
      sampleSpellIds: [record.spellId],
      sampleReasons: [record.reason],
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.bucketId.localeCompare(b.bucketId);
  });
}

function renderMarkdown(report: DescriptionSubBucketReport): string {
  const lines: string[] = [
    '# Spell Description Sub-Bucket Report',
    '',
    'This report breaks the structured-vs-canonical `Description` mismatch bucket into smaller review families.',
    '',
    `Generated: ${report.generatedAt}`,
    `Description mismatches analyzed: ${report.descriptionMismatchCount}`,
    `Sub-buckets: ${report.subBucketCount}`,
    '',
    'These sub-buckets are heuristic review helpers. They do not decide which description is correct; they only make the review queue more legible.',
    '',
    '## Grouped Description Sub-Buckets',
    '',
  ];

  for (const bucket of report.groupedBuckets) {
    lines.push(`### ${bucket.title}`);
    lines.push('');
    lines.push(`- Bucket Id: \`${bucket.bucketId}\``);
    lines.push(`- Occurrences: ${bucket.count}`);
    lines.push(`- Rationale: ${bucket.rationale}`);
    lines.push(`- Sample spells: ${bucket.sampleSpellIds.join(', ')}`);
    lines.push('');
  }

  lines.push('## Sample Spell Assignments');
  lines.push('');

  for (const record of report.records.slice(0, 40)) {
    lines.push(`### ${record.spellName}`);
    lines.push('');
    lines.push(`- Bucket: \`${record.bucketId}\``);
    lines.push(`- File: ${record.markdownPath}`);
    lines.push(`- Reason: ${record.reason}`);
    lines.push(`- Structured Preview: ${record.structuredPreview}`);
    lines.push(`- Canonical Preview: ${record.canonicalPreview}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

// ============================================================================
// Main execution
// ============================================================================
// This section filters the existing comparison artifact down to the Description
// mismatches, classifies each one, then writes both the machine artifact and the
// human-readable report.
// ============================================================================

function main(): void {
  const input = readInputReport();
  const descriptionMismatches = input.mismatches.filter((mismatch) => mismatch.field === 'Description');

  const records: DescriptionSubBucketRecord[] = descriptionMismatches.map((mismatch) => {
    const classification = classifyDescriptionMismatch(mismatch);
    return {
      spellId: mismatch.spellId,
      spellName: mismatch.spellName,
      markdownPath: mismatch.markdownPath,
      bucketId: classification.bucketId,
      reason: classification.reason,
      structuredPreview: buildPreview(mismatch.structuredValue),
      canonicalPreview: buildPreview(mismatch.canonicalValue),
    };
  });

  const report: DescriptionSubBucketReport = {
    generatedAt: new Date().toISOString(),
    descriptionMismatchCount: records.length,
    subBucketCount: new Set(records.map((record) => record.bucketId)).size,
    records,
    groupedBuckets: groupRecords(records),
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(OUTPUT_MD_PATH, renderMarkdown(report), 'utf8');

  console.log(`Description sub-bucket report written to ${OUTPUT_MD_PATH}`);
  console.log(`Machine-readable sub-bucket report written to ${OUTPUT_JSON_PATH}`);
  console.log(`Description mismatches analyzed: ${report.descriptionMismatchCount}`);
  console.log(`Sub-buckets: ${report.subBucketCount}`);
  for (const bucket of report.groupedBuckets) {
    console.log(`- ${bucket.bucketId}: ${bucket.count}`);
  }
}

main();
