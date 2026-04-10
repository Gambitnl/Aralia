import fs from 'node:fs';
import path from 'node:path';

/**
 * This script audits the canonical snapshot blocks inside the spell reference markdown files.
 *
 * The canonical-retrieval lane copied raw source snapshots into `docs/spells/reference/**`,
 * but a later review showed that some snapshots kept the top-level statblock while missing
 * the actual spell rules text. This audit exists to find those gaps across the whole corpus
 * before the follow-up validation lane depends on the snapshots as a trustworthy crosscheck.
 *
 * Called manually by: Codex during spell canonical snapshot repair work
 * Depends on:
 * - `docs/spells/reference/**`
 * Writes:
 * - `docs/tasks/spells/SPELL_CANONICAL_RULES_AUDIT_REPORT.md`
 * - `.agent/roadmap-local/spell-validation/spell-canonical-rules-audit.json`
 */

// ============================================================================
// Paths and report labels
// ============================================================================
// This section keeps the audit surfaces together so the script can be rerun
// without guessing where its machine output and human report belong.
// ============================================================================

const REPO_ROOT = 'F:/Repos/Aralia';
const SPELL_REFERENCE_ROOT = path.join(REPO_ROOT, 'docs', 'spells', 'reference');
const AUDIT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-canonical-rules-audit.json');
const AUDIT_REPORT_PATH = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'SPELL_CANONICAL_RULES_AUDIT_REPORT.md');
const CANONICAL_SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';

type AuditReason =
  | 'missing_rules_text'
  | 'truncated_against_structured_description';

interface AuditFinding {
  spellId: string;
  markdownPath: string;
  reason: AuditReason;
  structuredDescriptionLength: number;
  canonicalRulesLength: number;
  structuredDescriptionPreview: string;
  canonicalRulesPreview: string;
}

// ============================================================================
// Markdown parsing helpers
// ============================================================================
// This section pulls the structured description and the commented canonical
// snapshot block out of each markdown file. The audit only cares about whether
// the rules text inside that canonical block is actually present and plausible.
// ============================================================================

function normalizeComparableText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStructuredDescription(markdown: string): string {
  const match = markdown.match(/^- \*\*Description\*\*: (.+)$/m);
  return match ? match[1].trim() : '';
}

function extractCanonicalCommentBlock(markdown: string): string | null {
  const headingIndex = markdown.indexOf(CANONICAL_SNAPSHOT_HEADING);
  if (headingIndex === -1) return null;

  const commentStart = markdown.indexOf('<!--', headingIndex);
  const commentEnd = markdown.indexOf('-->', commentStart);
  if (commentStart === -1 || commentEnd === -1) return null;

  return markdown.slice(commentStart + 4, commentEnd).trim();
}

function extractCanonicalRulesText(commentBlock: string): string {
  const match = commentBlock.match(
    /\nRules Text:\n([\s\S]*?)(?=\n\n(?:Material Component:|Spell Tags:|Available For:|Referenced Rules:|Capture Method:|Legacy Page:)|$)/i,
  );

  return match ? match[1].trim() : '';
}

function buildPreview(value: string): string {
  const normalized = normalizeComparableText(value);
  return normalized.length <= 140 ? normalized : `${normalized.slice(0, 137)}...`;
}

function isStructuredDescriptionMismatch(structuredDescription: string, canonicalRulesText: string): boolean {
  const normalizedDescription = normalizeComparableText(structuredDescription);
  const normalizedRules = normalizeComparableText(canonicalRulesText);

  if (!normalizedDescription || !normalizedRules) return false;
  if (normalizedDescription === normalizedRules) return false;

  // If the canonical snapshot is simply a short prefix of the longer Aralia description,
  // the snapshot likely lost follow-on paragraphs or list items during retrieval.
  if (
    normalizedDescription.includes(normalizedRules)
    && normalizedRules.length < Math.max(120, Math.floor(normalizedDescription.length * 0.75))
  ) {
    return true;
  }

  // A trailing colon is a common sign that only the introduction to a list survived.
  if (normalizedRules.endsWith(':') && normalizedDescription.length > normalizedRules.length) {
    return true;
  }

  return false;
}

// ============================================================================
// Corpus audit
// ============================================================================
// This section walks every spell reference file, inspects the canonical comment
// block, and records only the spells whose rules text is missing or clearly thin.
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

function toSpellId(markdownPath: string): string {
  return path.basename(markdownPath, '.md');
}

function auditCanonicalRulesBlocks(): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const markdownPath of listMarkdownFiles(SPELL_REFERENCE_ROOT)) {
    const markdown = fs.readFileSync(markdownPath, 'utf8');
    const commentBlock = extractCanonicalCommentBlock(markdown);
    if (!commentBlock) continue;

    const structuredDescription = extractStructuredDescription(markdown);
    const canonicalRulesText = extractCanonicalRulesText(commentBlock);

    if (!normalizeComparableText(canonicalRulesText)) {
      findings.push({
        spellId: toSpellId(markdownPath),
        markdownPath,
        reason: 'missing_rules_text',
        structuredDescriptionLength: normalizeComparableText(structuredDescription).length,
        canonicalRulesLength: 0,
        structuredDescriptionPreview: buildPreview(structuredDescription),
        canonicalRulesPreview: '',
      });
      continue;
    }

    if (isStructuredDescriptionMismatch(structuredDescription, canonicalRulesText)) {
      findings.push({
        spellId: toSpellId(markdownPath),
        markdownPath,
        reason: 'truncated_against_structured_description',
        structuredDescriptionLength: normalizeComparableText(structuredDescription).length,
        canonicalRulesLength: normalizeComparableText(canonicalRulesText).length,
        structuredDescriptionPreview: buildPreview(structuredDescription),
        canonicalRulesPreview: buildPreview(canonicalRulesText),
      });
    }
  }

  return findings;
}

// ============================================================================
// Report writing
// ============================================================================
// This section keeps the audit legible for both machines and humans. The JSON
// file feeds repair automation, while the markdown report makes the findings
// easy to inspect without opening every spell file by hand.
// ============================================================================

function renderReport(findings: AuditFinding[]): string {
  const missing = findings.filter((finding) => finding.reason === 'missing_rules_text');
  const truncated = findings.filter((finding) => finding.reason === 'truncated_against_structured_description');

  const lines: string[] = [
    '# Spell Canonical Rules Audit Report',
    '',
    'This report lists spell reference markdown files whose canonical snapshot block is missing rules text or appears truncated against the structured Aralia description already in the same file.',
    '',
    `Generated At: ${new Date().toISOString()}`,
    `Total Findings: ${findings.length}`,
    `Missing Rules Text: ${missing.length}`,
    `Truncated Against Structured Description: ${truncated.length}`,
    '',
  ];

  if (findings.length === 0) {
    lines.push('No canonical rules-text gaps were detected.');
    return `${lines.join('\n')}\n`;
  }

  for (const finding of findings) {
    lines.push(`## ${finding.spellId}`);
    lines.push('');
    lines.push(`- Reason: ${finding.reason}`);
    lines.push(`- File: ${finding.markdownPath}`);
    lines.push(`- Structured Description Length: ${finding.structuredDescriptionLength}`);
    lines.push(`- Canonical Rules Length: ${finding.canonicalRulesLength}`);
    if (finding.structuredDescriptionPreview) {
      lines.push(`- Structured Preview: ${finding.structuredDescriptionPreview}`);
    }
    if (finding.canonicalRulesPreview) {
      lines.push(`- Canonical Preview: ${finding.canonicalRulesPreview}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main(): void {
  const findings = auditCanonicalRulesBlocks();

  fs.mkdirSync(path.dirname(AUDIT_JSON_PATH), { recursive: true });
  fs.writeFileSync(
    AUDIT_JSON_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalFindings: findings.length,
        findings,
      },
      null,
      2,
    ),
    'utf8',
  );

  fs.writeFileSync(AUDIT_REPORT_PATH, renderReport(findings), 'utf8');

  console.log(`Canonical rules audit report written to ${AUDIT_REPORT_PATH}`);
  console.log(`Machine-readable audit artifact written to ${AUDIT_JSON_PATH}`);
  console.log(`Findings: ${findings.length}`);
}

main();
