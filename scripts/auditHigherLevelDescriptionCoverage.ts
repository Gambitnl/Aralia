import fs from 'node:fs';
import path from 'node:path';

/**
 * This file audits the `higher-level-text-missing` description sub-bucket to see whether the
 * missing canonical upcast text is already represented elsewhere in the spell file.
 *
 * The description bucket is useful diagnostic evidence, but not every mismatch means the same
 * thing. Some spells already capture the higher-level mechanic in the structured `Higher Levels`
 * field or in effect-scaling data. Others only partly capture it, and some barely encode it at all.
 *
 * This audit exists to split that one description sub-bucket into:
 * - already represented elsewhere
 * - partially represented elsewhere
 * - not materially represented elsewhere
 *
 * Called manually by: Codex during the "spell .md description bucket" review lane
 * Depends on:
 * - `.agent/roadmap-local/spell-validation/spell-description-subbucket-report.json`
 * - `.agent/roadmap-local/spell-validation/spell-structured-vs-canonical-report.json`
 * - `docs/spells/reference/**`
 * - `public/data/spells/**`
 * Writes:
 * - `docs/tasks/spells/SPELL_HIGHER_LEVEL_DESCRIPTION_COVERAGE_REPORT.md`
 * - `.agent/roadmap-local/spell-validation/spell-higher-level-description-coverage-report.json`
 */

// ============================================================================
// Paths and types
// ============================================================================
// This section keeps the two input artifacts and the two output artifacts in one
// place so the audit can be rerun without hunting for the right spell reports.
// ============================================================================

const REPO_ROOT = 'F:/Repos/Aralia';
const SUBBUCKET_REPORT_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-description-subbucket-report.json');
const STRUCTURED_VS_CANONICAL_REPORT_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-structured-vs-canonical-report.json');
const SPELL_JSON_ROOT = path.join(REPO_ROOT, 'public', 'data', 'spells');
const OUTPUT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-higher-level-description-coverage-report.json');
const OUTPUT_MD_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_HIGHER_LEVEL_DESCRIPTION_COVERAGE_REPORT.md');

type CoverageBucketId =
  | 'represented-elsewhere'
  | 'partially-represented-elsewhere'
  | 'not-represented-elsewhere';

interface DescriptionSubBucketRecord {
  spellId: string;
  spellName: string;
  markdownPath: string;
  bucketId: string;
  reason: string;
  structuredPreview: string;
  canonicalPreview: string;
}

interface DescriptionSubBucketReport {
  generatedAt: string;
  descriptionMismatchCount: number;
  subBucketCount: number;
  records: DescriptionSubBucketRecord[];
}

interface ComparisonMismatch {
  spellId: string;
  spellName: string;
  markdownPath: string;
  field: string;
  structuredValue: string;
  canonicalValue: string;
}

interface StructuredVsCanonicalReport {
  generatedAt: string;
  scannedMarkdownFiles: number;
  comparedSpellFiles: number;
  mismatchCount: number;
  mismatches: ComparisonMismatch[];
}

interface CoverageRecord {
  spellId: string;
  spellName: string;
  markdownPath: string;
  jsonPath: string;
  bucketId: CoverageBucketId;
  reason: string;
  structuredHigherLevels: string;
  jsonHigherLevels: string;
  canonicalHigherLevelText: string;
  scalingEvidence: string[];
}

interface GroupedCoverageBucket {
  bucketId: CoverageBucketId;
  title: string;
  rationale: string;
  count: number;
  spellIds: string[];
  sampleSpellIds: string[];
  sampleReasons: string[];
}

interface CoverageReport {
  generatedAt: string;
  higherLevelBucketSpellCount: number;
  groupedBuckets: GroupedCoverageBucket[];
  records: CoverageRecord[];
}

// ============================================================================
// Input loading and common helpers
// ============================================================================
// This section reads the two existing spell-validation artifacts and provides
// shared text helpers used by the coverage audit below.
// ============================================================================

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
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

function tokenize(value: string): string[] {
  return lower(value)
    .split(/[^a-z0-9+]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !['the', 'and', 'for', 'each', 'spell', 'slot', 'level', 'levels', 'above', 'when', 'you', 'use', 'using'].includes(token));
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function buildPreview(value: string): string {
  const normalized = normalizeComparableText(value);
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
}

function titleForBucket(bucketId: CoverageBucketId): string {
  switch (bucketId) {
    case 'represented-elsewhere':
      return 'Represented Elsewhere';
    case 'partially-represented-elsewhere':
      return 'Partially Represented Elsewhere';
    case 'not-represented-elsewhere':
      return 'Not Represented Elsewhere';
  }
}

function rationaleForBucket(bucketId: CoverageBucketId): string {
  switch (bucketId) {
    case 'represented-elsewhere':
      return 'The missing higher-level text in the Description field is already captured elsewhere in the spell file through the structured Higher Levels field and/or explicit scaling data.';
    case 'partially-represented-elsewhere':
      return 'Some of the canonical higher-level mechanic is already captured elsewhere, but the spell file does not appear to encode the full upcast behavior cleanly.';
    case 'not-represented-elsewhere':
      return 'The canonical higher-level behavior is not materially captured outside the Description mismatch, so overwriting the description would hide real missing signal.';
  }
}

// ============================================================================
// Markdown and JSON extraction
// ============================================================================
// This section extracts the structured `Higher Levels` field, the canonical
// upcast sentence from the description mismatch, and the current scaling data
// from the live spell JSON file.
// ============================================================================

function extractStructuredHigherLevels(markdownPath: string): string {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const match = markdown.match(/^- \*\*Higher Levels\*\*:\s*(.*)$/m);
  return match ? match[1].trim() : '';
}

function findSpellJsonPath(spellId: string): string {
  for (let level = 0; level <= 9; level += 1) {
    const candidate = path.join(SPELL_JSON_ROOT, `level-${level}`, `${spellId}.json`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find spell JSON for ${spellId}.`);
}

function extractCanonicalHigherLevelText(canonicalDescription: string): string {
  const normalized = normalizeComparableText(canonicalDescription);
  const marker = 'Using a Higher-Level Spell Slot.';
  const index = normalized.indexOf(marker);
  if (index === -1) return '';
  return normalized.slice(index + marker.length).trim();
}

function collectScalingEvidence(spellJson: Record<string, unknown>): string[] {
  const evidence: string[] = [];

  if (typeof spellJson.higherLevels === 'string' && spellJson.higherLevels.trim()) {
    evidence.push(`json.higherLevels: ${normalizeComparableText(spellJson.higherLevels)}`);
  }

  if (typeof spellJson.higherLevelScaling === 'string' && spellJson.higherLevelScaling.trim()) {
    evidence.push(`json.higherLevelScaling: ${normalizeComparableText(spellJson.higherLevelScaling)}`);
  }

  if (Array.isArray(spellJson.effects)) {
    for (const [index, effect] of spellJson.effects.entries()) {
      if (typeof effect !== 'object' || effect === null) continue;
      const scaling = (effect as Record<string, unknown>).scaling;
      if (typeof scaling !== 'object' || scaling === null) continue;

      const scalingRecord = scaling as Record<string, unknown>;
      const type = typeof scalingRecord.type === 'string' ? scalingRecord.type : '';
      const bonusPerLevel = typeof scalingRecord.bonusPerLevel === 'string' ? scalingRecord.bonusPerLevel.trim() : '';
      const customFormula = typeof scalingRecord.customFormula === 'string' ? scalingRecord.customFormula.trim() : '';

      if (!type && !bonusPerLevel && !customFormula) continue;

      const parts: string[] = [];
      if (type) parts.push(`type=${type}`);
      if (bonusPerLevel) parts.push(`bonusPerLevel=${bonusPerLevel}`);
      if (customFormula) parts.push(`customFormula=${customFormula}`);
      evidence.push(`effects[${index}].scaling: ${parts.join('; ')}`);
    }
  }

  return evidence;
}

// ============================================================================
// Coverage classification
// ============================================================================
// This section decides whether the missing higher-level text is already covered,
// partly covered, or still mostly absent elsewhere in the spell file.
// ============================================================================

function classifyCoverage(
  structuredHigherLevels: string,
  jsonHigherLevels: string,
  canonicalHigherLevelText: string,
  scalingEvidence: string[],
): { bucketId: CoverageBucketId; reason: string } {
  const structured = lower(structuredHigherLevels);
  const jsonHigher = lower(jsonHigherLevels);
  const canonical = lower(canonicalHigherLevelText);
  const scalingJoined = lower(scalingEvidence.join(' | '));

  const hasStructuredHigherLevels = structured.length > 0 && structured !== 'none' && structured !== 'n/a';
  const hasJsonHigherLevels = jsonHigher.length > 0 && jsonHigher !== 'none' && jsonHigher !== 'n/a';
  const hasEffectScaling = scalingEvidence.some((entry) => !entry.startsWith('json.higherLevels:') && !entry.startsWith('json.higherLevelScaling:'));
  const bestTextCoverage = Math.max(tokenSimilarity(structuredHigherLevels, canonicalHigherLevelText), tokenSimilarity(jsonHigherLevels, canonicalHigherLevelText));
  const canonicalLooksLikeEmbeddedStatBlock = canonical.includes(' ac ')
    || canonical.includes(' hp ')
    || canonical.includes(' speed ')
    || canonical.includes(' senses ')
    || canonical.includes(' languages ')
    || canonical.includes(' melee attack roll:')
    || canonical.includes(' ranged attack roll:')
    || canonical.includes(' saving throw:');

  const wantsTargetIncrease = canonical.includes('additional creature')
    || canonical.includes('additional beast')
    || canonical.includes('additional target')
    || canonical.includes('additional')
    || canonical.includes('+1 target');
  const wantsDamageIncrease = canonical.includes('damage increases') || canonical.includes('+1d') || canonical.includes('+2d');
  const wantsHealingIncrease = canonical.includes('healing increases');
  const wantsRadiusIncrease = canonical.includes('radius') || canonical.includes('cube increases') || canonical.includes('size of the cube increases');
  const wantsMultiClauseScaling = canonical.includes(' and ') || canonical.includes(';');

  const scalingMentionsTargets = scalingJoined.includes('target');
  const scalingMentionsDamage = scalingJoined.includes('1d') || scalingJoined.includes('damage') || scalingJoined.includes('+5');
  const scalingMentionsHealing = scalingJoined.includes('healing') || scalingJoined.includes('+2d4');
  const scalingMentionsArea = scalingJoined.includes('radius') || scalingJoined.includes('cube') || scalingJoined.includes('20 feet');

  const mechanicsCovered = [
    wantsTargetIncrease ? scalingMentionsTargets : true,
    wantsDamageIncrease ? scalingMentionsDamage : true,
    wantsHealingIncrease ? scalingMentionsHealing : true,
    wantsRadiusIncrease ? scalingMentionsArea : true,
  ].every(Boolean);

  if (
    (hasStructuredHigherLevels || hasJsonHigherLevels)
    && bestTextCoverage >= 0.45
    && !canonicalLooksLikeEmbeddedStatBlock
  ) {
    return {
      bucketId: 'represented-elsewhere',
      reason: 'The spell already has explicit higher-level prose elsewhere in the file, and that prose substantially overlaps the canonical upcast text.',
    };
  }

  if (hasStructuredHigherLevels && (hasJsonHigherLevels || hasEffectScaling) && mechanicsCovered && !wantsMultiClauseScaling) {
    return {
      bucketId: 'represented-elsewhere',
      reason: 'The spell already carries explicit higher-level text plus scaling evidence elsewhere, and that evidence appears to cover the canonical upcast mechanic.',
    };
  }

  if (hasStructuredHigherLevels || hasJsonHigherLevels || hasEffectScaling) {
    return {
      bucketId: 'partially-represented-elsewhere',
      reason: 'The spell has some higher-level support elsewhere in the file, but the coverage looks incomplete or too coarse for the full canonical upcast text.',
    };
  }

  return {
    bucketId: 'not-represented-elsewhere',
    reason: 'The canonical higher-level mechanic does not appear to be materially captured outside the description mismatch.',
  };
}

// ============================================================================
// Grouping and report rendering
// ============================================================================
// This section turns the per-spell coverage decisions into a review report with
// counts, rationale, and examples.
// ============================================================================

function groupRecords(records: CoverageRecord[]): GroupedCoverageBucket[] {
  const groups = new Map<CoverageBucketId, GroupedCoverageBucket>();

  for (const record of records) {
    const existing = groups.get(record.bucketId);
    if (existing) {
      existing.count += 1;
      existing.spellIds.push(record.spellId);
      if (existing.sampleSpellIds.length < 10) existing.sampleSpellIds.push(record.spellId);
      if (existing.sampleReasons.length < 5) existing.sampleReasons.push(record.reason);
      continue;
    }

    groups.set(record.bucketId, {
      bucketId: record.bucketId,
      title: titleForBucket(record.bucketId),
      rationale: rationaleForBucket(record.bucketId),
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

function renderMarkdown(report: CoverageReport): string {
  const lines: string[] = [
    '# Spell Higher-Level Description Coverage Report',
    '',
    'This report audits the `higher-level-text-missing` description sub-bucket and asks whether the missing canonical upcast text is already represented elsewhere in the spell file.',
    '',
    `Generated: ${report.generatedAt}`,
    `Higher-level description mismatches analyzed: ${report.higherLevelBucketSpellCount}`,
    '',
    '## Coverage Buckets',
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
    lines.push(`- Structured Higher Levels: ${buildPreview(record.structuredHigherLevels || 'None')}`);
    lines.push(`- JSON Higher Levels: ${buildPreview(record.jsonHigherLevels || 'None')}`);
    lines.push(`- Canonical Higher-Level Text: ${buildPreview(record.canonicalHigherLevelText || 'None')}`);
    lines.push(`- Scaling Evidence: ${record.scalingEvidence.length > 0 ? record.scalingEvidence.join(' | ') : 'None'}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

// ============================================================================
// Main execution
// ============================================================================
// This section selects the higher-level description sub-bucket, looks up the
// corresponding raw comparison records, and writes the coverage report.
// ============================================================================

function main(): void {
  const subbucketReport = readJsonFile<DescriptionSubBucketReport>(SUBBUCKET_REPORT_PATH);
  const structuredVsCanonicalReport = readJsonFile<StructuredVsCanonicalReport>(STRUCTURED_VS_CANONICAL_REPORT_PATH);
  const higherLevelSpellIds = new Set(
    subbucketReport.records
      .filter((record) => record.bucketId === 'higher-level-text-missing')
      .map((record) => record.spellId),
  );

  const descriptionMismatches = structuredVsCanonicalReport.mismatches.filter(
    (mismatch) => mismatch.field === 'Description' && higherLevelSpellIds.has(mismatch.spellId),
  );

  const records: CoverageRecord[] = descriptionMismatches.map((mismatch) => {
    const jsonPath = findSpellJsonPath(mismatch.spellId);
    const spellJson = readJsonFile<Record<string, unknown>>(jsonPath);
    const structuredHigherLevels = extractStructuredHigherLevels(mismatch.markdownPath);
    const jsonHigherLevels = typeof spellJson.higherLevels === 'string' ? spellJson.higherLevels : '';
    const canonicalHigherLevelText = extractCanonicalHigherLevelText(mismatch.canonicalValue);
    const scalingEvidence = collectScalingEvidence(spellJson);
    const classification = classifyCoverage(structuredHigherLevels, jsonHigherLevels, canonicalHigherLevelText, scalingEvidence);

    return {
      spellId: mismatch.spellId,
      spellName: mismatch.spellName,
      markdownPath: mismatch.markdownPath,
      jsonPath,
      bucketId: classification.bucketId,
      reason: classification.reason,
      structuredHigherLevels,
      jsonHigherLevels,
      canonicalHigherLevelText,
      scalingEvidence,
    };
  });

  const report: CoverageReport = {
    generatedAt: new Date().toISOString(),
    higherLevelBucketSpellCount: records.length,
    groupedBuckets: groupRecords(records),
    records,
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(OUTPUT_MD_PATH, renderMarkdown(report), 'utf8');

  console.log(`Higher-level coverage report written to ${OUTPUT_MD_PATH}`);
  console.log(`Machine-readable coverage report written to ${OUTPUT_JSON_PATH}`);
  console.log(`Higher-level description mismatches analyzed: ${report.higherLevelBucketSpellCount}`);
  for (const bucket of report.groupedBuckets) {
    console.log(`- ${bucket.bucketId}: ${bucket.count}`);
  }
}

main();
