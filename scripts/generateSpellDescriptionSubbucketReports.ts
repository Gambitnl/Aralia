import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This file rebuilds the Description bucket taxonomy after the spell-truth lane was split
 * into two phases and after the canonical-side parser bug was fixed.
 *
 * The older `spell-description-subbucket-report.json` artifact mixed together canonical-
 * side and runtime-side findings from before the canonical audit could reliably extract
 * multiline `Rules Text` blocks. That made the Description bucket look much noisier than
 * it really was. This script replaces that stale view with two current subbucket surfaces:
 * 1. canonical -> structured Description residue
 * 2. structured -> json Description residue
 *
 * Called manually by: Codex during spell-truth review
 * Depends on:
 * - `.agent/roadmap-local/spell-validation/spell-structured-vs-canonical-report.json`
 * - `.agent/roadmap-local/spell-validation/spell-structured-vs-json-report.json`
 * Writes:
 * - `.agent/roadmap-local/spell-validation/spell-description-canonical-subbucket-report.json`
 * - `.agent/roadmap-local/spell-validation/spell-description-runtime-subbucket-report.json`
 * - `docs/tasks/spells/description/SPELL_DESCRIPTION_SUBBUCKET_REPORT.md`
 */

// ============================================================================
// Paths and shared types
// ============================================================================
// This section keeps the input and output artifact locations together so the
// Description bucket can be regenerated without hunting through the repo.
// ============================================================================

const REPO_ROOT = 'F:/Repos/Aralia';
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const CANONICAL_REPORT_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-structured-vs-canonical-report.json');
const RUNTIME_REPORT_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-structured-vs-json-report.json');
const CANONICAL_SUBBUCKET_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-description-canonical-subbucket-report.json');
const RUNTIME_SUBBUCKET_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-description-runtime-subbucket-report.json');
const MARKDOWN_REPORT_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'description', 'SPELL_DESCRIPTION_SUBBUCKET_REPORT.md');

interface ReportMismatch {
  spellId: string;
  spellName: string;
  markdownPath: string;
  jsonPath?: string;
  field: string;
  structuredValue: string;
  canonicalValue?: string;
  jsonValue?: string;
  mismatchKind: string;
  summary: string;
}

interface RawAuditReport {
  generatedAt: string;
  mismatches: ReportMismatch[];
}

interface BucketRecord {
  spellId: string;
  spellName: string;
  markdownPath: string;
  jsonPath?: string;
  bucketId: string;
  reason: string;
  structuredPreview: string;
  counterpartPreview: string;
}

interface GroupedBucket {
  bucketId: string;
  title: string;
  rationale: string;
  count: number;
  spellIds: string[];
  sampleSpellIds: string[];
  sampleReasons: string[];
}

interface SubbucketReport {
  generatedAt: string;
  phase: 'canonical-structured' | 'structured-json';
  mismatchCount: number;
  subBucketCount: number;
  records: BucketRecord[];
  groupedBuckets: GroupedBucket[];
}

// ============================================================================
// Normalization helpers
// ============================================================================
// This section strips out punctuation and encoding noise so the runtime phase can
// distinguish "same prose with ugly text encoding" from real content drift.
// ============================================================================

function normalizeForLooseEquality(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢/g, "'")
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ/g, '"')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬/g, '"')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“/g, '-')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, '-')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/−/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function preview(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

// ============================================================================
// Canonical-side subbucketing
// ============================================================================
// This section classifies real canonical -> structured Description residue now
// that canonical Rules Text is being extracted correctly.
// ============================================================================

function classifyCanonicalDescriptionMismatch(mismatch: ReportMismatch): { bucketId: string; reason: string } {
  const structured = mismatch.structuredValue ?? '';
  const canonical = mismatch.canonicalValue ?? '';
  const normalizedStructured = normalizeForLooseEquality(structured);
  const normalizedCanonical = normalizeForLooseEquality(canonical);

  // If the texts become equal after punctuation and encoding cleanup, this is not a
  // real content disagreement anymore. It is a formatting surface mismatch.
  if (normalizedStructured === normalizedCanonical) {
    return {
      bucketId: 'formatting-or-encoding-residue',
      reason: 'The structured and canonical Description differ only by punctuation, encoding, spacing, or glossary formatting.',
    };
  }

  // If canonical prose clearly carries the higher-level paragraph inline, the real
  // follow-up is to keep that scaling text split into Higher Levels instead of treating
  // the whole Description as one amorphous rewrite problem.
  if (/Using a Higher-Level Spell Slot\.|At Higher Levels\./i.test(canonical) && !/Using a Higher-Level Spell Slot\.|At Higher Levels\./i.test(structured)) {
    return {
      bucketId: 'higher-level-text-still-inline-or-missing',
      reason: 'The canonical Rules Text still carries higher-level scaling prose that the structured Description does not mirror directly.',
    };
  }

  // Some spells still omit extra operational clauses entirely, which is more important
  // than generic wording changes because the spell behavior itself becomes incomplete.
  if (canonical.length > structured.length + 40) {
    return {
      bucketId: 'canonical-extra-rules-detail',
      reason: 'The canonical Description includes additional operational rules detail that the structured Description still omits or shortens.',
    };
  }

  // The remaining differences are mostly true wording rewrites now that the parser is fixed.
  return {
    bucketId: 'real-prose-drift',
    reason: 'The structured Description still uses materially different prose than the copied canonical Description.',
  };
}

// ============================================================================
// Runtime-side subbucketing
// ============================================================================
// This section classifies structured -> json Description mismatches so the runtime
// lane can separate actual lagging data from low-value formatting residue.
// ============================================================================

function classifyRuntimeDescriptionMismatch(mismatch: ReportMismatch): { bucketId: string; reason: string } {
  const structured = mismatch.structuredValue ?? '';
  const json = mismatch.jsonValue ?? '';
  const normalizedStructured = normalizeForLooseEquality(structured);
  const normalizedJson = normalizeForLooseEquality(json);

  if (!structured.trim()) {
    return {
      bucketId: 'blocked-missing-structured-description',
      reason: 'The structured Description is missing, so the runtime Description cannot be reviewed meaningfully against it yet.',
    };
  }

  if (!json.trim()) {
    return {
      bucketId: 'missing-runtime-description',
      reason: 'The structured Description exists, but the runtime spell JSON has no comparable description text.',
    };
  }

  if (normalizedStructured === normalizedJson) {
    return {
      bucketId: 'formatting-or-encoding-residue',
      reason: 'The structured Description and runtime JSON differ only by punctuation, encoding, or spacing noise.',
    };
  }

  if (structured.length > json.length + 20 || json.length > structured.length + 20) {
    return {
      bucketId: 'real-runtime-drift',
      reason: 'The runtime JSON Description is still materially behind or otherwise different from the structured Description.',
    };
  }

  return {
    bucketId: 'wording-shift-still-needs-review',
    reason: 'The runtime JSON Description uses different wording than the structured Description and still needs direct review.',
  };
}

// ============================================================================
// Shared grouping and report rendering
// ============================================================================
// This section keeps the machine artifacts and the human-readable markdown in a
// consistent shape so future agents can see the bucket split immediately.
// ============================================================================

function groupRecords(records: BucketRecord[], phase: SubbucketReport['phase']): GroupedBucket[] {
  const titles: Record<string, { title: string; rationale: string }> = {
    'formatting-or-encoding-residue': {
      title: 'Formatting Or Encoding Residue',
      rationale: 'The prose is effectively the same, but punctuation, spacing, or encoding still keeps the comparison from landing cleanly.',
    },
    'higher-level-text-still-inline-or-missing': {
      title: 'Higher-Level Text Still Inline Or Missing',
      rationale: 'Canonical prose still carries scaling text inline, so the Description mismatch is partly a Description-versus-Higher-Levels split problem.',
    },
    'canonical-extra-rules-detail': {
      title: 'Canonical Extra Rules Detail',
      rationale: 'Canonical prose still contains meaningful operational detail that the structured Description does not fully carry yet.',
    },
    'real-prose-drift': {
      title: 'Real Prose Drift',
      rationale: 'The structured Description still uses materially different prose than the copied canonical Description.',
    },
    'blocked-missing-structured-description': {
      title: 'Blocked Missing Structured Description',
      rationale: 'The runtime Description comparison is blocked because there is no structured Description to compare against.',
    },
    'missing-runtime-description': {
      title: 'Missing Runtime Description',
      rationale: 'The runtime spell JSON does not currently store the Description text that the structured layer already has.',
    },
    'real-runtime-drift': {
      title: 'Real Runtime Drift',
      rationale: 'The runtime spell JSON still carries materially different Description prose than the structured layer.',
    },
    'wording-shift-still-needs-review': {
      title: 'Wording Shift Still Needs Review',
      rationale: 'The runtime Description and structured Description still differ in wording in a way that is not pure formatting noise.',
    },
  };

  const grouped = new Map<string, GroupedBucket>();

  for (const record of records) {
    const existing = grouped.get(record.bucketId);
    if (existing) {
      existing.count += 1;
      existing.spellIds.push(record.spellId);
      if (existing.sampleSpellIds.length < 10) existing.sampleSpellIds.push(record.spellId);
      if (existing.sampleReasons.length < 5) existing.sampleReasons.push(record.reason);
      continue;
    }

    const titleInfo = titles[record.bucketId] ?? {
      title: record.bucketId,
      rationale: `Unmapped ${phase} Description residue bucket.`,
    };

    grouped.set(record.bucketId, {
      bucketId: record.bucketId,
      title: titleInfo.title,
      rationale: titleInfo.rationale,
      count: 1,
      spellIds: [record.spellId],
      sampleSpellIds: [record.spellId],
      sampleReasons: [record.reason],
    });
  }

  return Array.from(grouped.values())
    .map((bucket) => ({
      ...bucket,
      spellIds: bucket.spellIds.sort(),
      sampleSpellIds: bucket.sampleSpellIds.sort(),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.bucketId.localeCompare(right.bucketId);
    });
}

function buildCanonicalReport(raw: RawAuditReport): SubbucketReport {
  const records = raw.mismatches
    .filter((mismatch) => mismatch.field === 'Description')
    .map((mismatch) => {
      const classification = classifyCanonicalDescriptionMismatch(mismatch);
      return {
        spellId: mismatch.spellId,
        spellName: mismatch.spellName,
        markdownPath: mismatch.markdownPath,
        bucketId: classification.bucketId,
        reason: classification.reason,
        structuredPreview: preview(mismatch.structuredValue),
        counterpartPreview: preview(mismatch.canonicalValue ?? ''),
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    phase: 'canonical-structured',
    mismatchCount: records.length,
    subBucketCount: groupRecords(records, 'canonical-structured').length,
    records,
    groupedBuckets: groupRecords(records, 'canonical-structured'),
  };
}

function buildRuntimeReport(raw: RawAuditReport): SubbucketReport {
  const records = raw.mismatches
    .filter((mismatch) => mismatch.field === 'Description')
    .map((mismatch) => {
      const classification = classifyRuntimeDescriptionMismatch(mismatch);
      return {
        spellId: mismatch.spellId,
        spellName: mismatch.spellName,
        markdownPath: mismatch.markdownPath,
        jsonPath: mismatch.jsonPath,
        bucketId: classification.bucketId,
        reason: classification.reason,
        structuredPreview: preview(mismatch.structuredValue),
        counterpartPreview: preview(mismatch.jsonValue ?? ''),
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    phase: 'structured-json',
    mismatchCount: records.length,
    subBucketCount: groupRecords(records, 'structured-json').length,
    records,
    groupedBuckets: groupRecords(records, 'structured-json'),
  };
}

function renderMarkdownReport(canonicalReport: SubbucketReport, runtimeReport: SubbucketReport): string {
  const lines: string[] = [
    '# Spell Description Subbucket Report',
    '',
    'This report splits the Description bucket by phase so the project can see the current residue clearly after the canonical-side parser fix.',
    '',
    `Generated: ${canonicalReport.generatedAt}`,
    '',
    '## Canonical -> Structured',
    '',
    `- Mismatches: ${canonicalReport.mismatchCount}`,
    `- Sub-buckets: ${canonicalReport.subBucketCount}`,
    '',
  ];

  for (const bucket of canonicalReport.groupedBuckets) {
    lines.push(`### ${bucket.title}`);
    lines.push('');
    lines.push(`- Bucket ID: \`${bucket.bucketId}\``);
    lines.push(`- Count: ${bucket.count}`);
    lines.push(`- Rationale: ${bucket.rationale}`);
    lines.push(`- Sample spells: ${bucket.sampleSpellIds.join(', ')}`);
    lines.push('');
  }

  lines.push('## Structured -> JSON');
  lines.push('');
  lines.push(`- Mismatches: ${runtimeReport.mismatchCount}`);
  lines.push(`- Sub-buckets: ${runtimeReport.subBucketCount}`);
  lines.push('');

  for (const bucket of runtimeReport.groupedBuckets) {
    lines.push(`### ${bucket.title}`);
    lines.push('');
    lines.push(`- Bucket ID: \`${bucket.bucketId}\``);
    lines.push(`- Count: ${bucket.count}`);
    lines.push(`- Rationale: ${bucket.rationale}`);
    lines.push(`- Sample spells: ${bucket.sampleSpellIds.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Main runner
// ============================================================================
// This section reads the current phase reports, rebuilds the Description taxonomy,
// and writes both machine artifacts and the human-readable markdown handoff.
// ============================================================================

function main(): void {
  const canonicalRaw = JSON.parse(fs.readFileSync(CANONICAL_REPORT_PATH, 'utf8')) as RawAuditReport;
  const runtimeRaw = JSON.parse(fs.readFileSync(RUNTIME_REPORT_PATH, 'utf8')) as RawAuditReport;
  const canonicalReport = buildCanonicalReport(canonicalRaw);
  const runtimeReport = buildRuntimeReport(runtimeRaw);

  fs.mkdirSync(path.dirname(CANONICAL_SUBBUCKET_JSON_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(MARKDOWN_REPORT_PATH), { recursive: true });
  fs.writeFileSync(CANONICAL_SUBBUCKET_JSON_PATH, JSON.stringify(canonicalReport, null, 2), 'utf8');
  fs.writeFileSync(RUNTIME_SUBBUCKET_JSON_PATH, JSON.stringify(runtimeReport, null, 2), 'utf8');
  fs.writeFileSync(MARKDOWN_REPORT_PATH, `${renderMarkdownReport(canonicalReport, runtimeReport)}\n`, 'utf8');

  console.log(`Canonical Description subbucket report written to ${CANONICAL_SUBBUCKET_JSON_PATH}`);
  console.log(`Runtime Description subbucket report written to ${RUNTIME_SUBBUCKET_JSON_PATH}`);
  console.log(`Markdown summary written to ${MARKDOWN_REPORT_PATH}`);
  console.log(`Canonical Description mismatches: ${canonicalReport.mismatchCount}`);
  console.log(`Runtime Description mismatches: ${runtimeReport.mismatchCount}`);
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === SCRIPT_FILE
  : false;

if (isDirectRun) {
  main();
}
