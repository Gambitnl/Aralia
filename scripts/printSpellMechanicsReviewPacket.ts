import fs from 'node:fs';
import path from 'node:path';

/**
 * This file prints compact review packets from the generated mechanics discovery ledger.
 *
 * The full ledger is intentionally machine-readable and large. During the manual
 * spell pass, agents need smaller chunks that show canonical prose, structured
 * fields, and runtime JSON summaries side by side. This helper does not create
 * new truth; it only formats the latest discovery report for easier review.
 *
 * Called manually by: Codex during the spell mechanics discovery pass.
 * Depends on: .agent/roadmap-local/spell-validation/spell-mechanics-discovery.json.
 */

// ============================================================================
// Paths And Input Parsing
// ============================================================================
// This section locates the generated ledger and reads optional CLI filters. Use
// `--level=0` for a level packet or `--spell=acid-splash` for one spell.
// ============================================================================

const REPO_ROOT = process.cwd();
const REPORT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-mechanics-discovery.json');

interface SpellMechanicsRow {
  spellId: string;
  spellName: string;
  level: number;
  markdownPath: string;
  jsonPath: string;
  canonicalSource: string;
  canonicalText: string;
  structuredLabels: Record<string, string>;
  runtimeSummary: Record<string, unknown>;
  findings: Array<{ findingId: string; resolutionStatus: string; canonicalEvidence: string }>;
  deferredFlavor: Array<{ findingId: string; resolutionStatus: string; canonicalEvidence: string }>;
  specialQuestions: Array<{ findingId: string; resolutionStatus: string; canonicalEvidence: string }>;
}

interface MechanicsDiscoveryReport {
  rows: SpellMechanicsRow[];
}

function parseArg(name: string): string | null {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

// ============================================================================
// Formatting Helpers
// ============================================================================
// This section trims noisy values while preserving the facts needed for manual
// review. The source files remain available through the printed paths.
// ============================================================================

function isReviewTextField(label: string): boolean {
  return label === 'Description' || label === 'Higher Levels';
}

function summarizeStructuredLabels(labels: Record<string, string>): string {
  return Object.entries(labels)
    .filter(([label]) => !isReviewTextField(label))
    .map(([label, value]) => `${label}: ${value}`)
    .join('; ');
}

function summarizeRuntime(runtimeSummary: Record<string, unknown>): string {
  return JSON.stringify({
    targeting: runtimeSummary.targeting,
    effects: runtimeSummary.effects,
    aiContext: runtimeSummary.aiContext,
    tags: runtimeSummary.tags,
  }, null, 2);
}

function wrapBlock(text: string, maxLength: number): string {
  const normalized = text.replace(/\r/g, '').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function printRow(row: SpellMechanicsRow): void {
  console.log(`\n# ${row.spellName} (${row.spellId}, L${row.level})`);
  console.log(`Markdown: ${row.markdownPath}`);
  console.log(`JSON: ${row.jsonPath}`);
  console.log(`Canonical source: ${row.canonicalSource}`);
  console.log('\n## Canonical prose');
  console.log(wrapBlock(row.canonicalText, 2200));
  console.log('\n## Structured fields');
  console.log(wrapBlock(summarizeStructuredLabels(row.structuredLabels), 2200));
  console.log('\n## Runtime summary');
  console.log(wrapBlock(summarizeRuntime(row.runtimeSummary), 2600));
  console.log('\n## Current discovery candidates');

  for (const finding of [...row.findings, ...row.deferredFlavor, ...row.specialQuestions]) {
    console.log(`- ${finding.findingId} [${finding.resolutionStatus}]: ${wrapBlock(finding.canonicalEvidence, 500)}`);
  }
}

// ============================================================================
// Main
// ============================================================================
// This section applies filters and prints packets in spell order.
// ============================================================================

function main(): void {
  const report = JSON.parse(fs.readFileSync(REPORT_JSON_PATH, 'utf8')) as MechanicsDiscoveryReport;
  const levelArg = parseArg('level');
  const spellArg = parseArg('spell');
  const skipArg = parseArg('skip');
  const limitArg = parseArg('limit');
  const level = levelArg === null ? null : Number(levelArg);
  const skip = skipArg === null ? 0 : Number(skipArg);
  const limit = limitArg === null ? null : Number(limitArg);

  let rows = report.rows;
  if (level !== null) rows = rows.filter((row) => row.level === level);
  if (spellArg) rows = rows.filter((row) => row.spellId === spellArg);
  if (skip > 0) rows = rows.slice(skip);
  if (limit !== null) rows = rows.slice(0, limit);

  for (const row of rows) printRow(row);
}

main();
