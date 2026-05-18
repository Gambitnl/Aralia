import { readFileSync, writeFileSync } from "node:fs";

/**
 * This script rebuilds the high-level actionable schema bucket summary from the
 * mechanics-discovery machine report.
 *
 * The detailed mechanics audit owns the per-spell findings. This script only
 * derives the review dashboard that tells agents and the project owner how much
 * actionable schema work remains grouped by bucket family. Keeping this as a
 * reusable script avoids repeated throwaway Node helpers during the closure
 * phase, which reduces command fragility and keeps report refreshes consistent.
 *
 * Called by: agents during spell mechanics closure packets, after
 * auditSpellMechanicsDiscovery.ts regenerates the source report.
 * Depends on: .agent/roadmap-local/spell-validation/spell-mechanics-discovery.json
 */

// ============================================================================
// File Paths
// ============================================================================
// These are the canonical input and output files for the actionable summary.
// The source report is produced by auditSpellMechanicsDiscovery.ts; the two
// output files are the human-facing markdown summary and its machine-readable
// companion.
// ============================================================================

const SOURCE_REPORT_PATH =
  ".agent/roadmap-local/spell-validation/spell-mechanics-discovery.json";
const JSON_OUTPUT_PATH =
  "docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.json";
const MARKDOWN_OUTPUT_PATH =
  "docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md";

// ============================================================================
// Report Types
// ============================================================================
// These lightweight types describe only the fields this summary needs. The
// source report can contain additional data, and this script deliberately leaves
// that richer data owned by the mechanics audit.
// ============================================================================

interface FindingRow {
  bucketId: string;
  resolutionStatus: string;
  issue: string;
  recommendedTemplateChange?: string;
  recommendedJsonChange?: string;
}

interface SpellRow {
  spellId: string;
  level?: number;
  findings?: FindingRow[];
}

interface MechanicsReport {
  rows?: SpellRow[];
}

interface CountedText {
  text: string;
  count: number;
}

interface BucketAccumulator {
  bucketId: string;
  findings: Array<{ spellId: string; level?: number; issue: string }>;
  spellIds: Set<string>;
  levels: Map<string, number>;
  templateChanges: Map<string, number>;
  jsonChanges: Map<string, number>;
}

// ============================================================================
// Counting Helpers
// ============================================================================
// These helpers keep the summary deterministic: repeated runs on the same source
// report produce stable ordering and stable common-change lists.
// ============================================================================

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topEntries(map: Map<string, number>): CountedText[] {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([text, count]) => ({ text, count }));
}

// ============================================================================
// Bucket Grouping
// ============================================================================
// The report contains every mechanics finding, including closed and deferred
// rows. This pass keeps only actionable_open rows so the summary reflects the
// remaining work surface instead of historical work already resolved.
// ============================================================================

function groupActionableFindings(report: MechanicsReport) {
  const buckets = new Map<string, BucketAccumulator>();

  for (const row of report.rows ?? []) {
    for (const finding of row.findings ?? []) {
      if (finding.resolutionStatus !== "actionable_open") {
        continue;
      }

      const bucket = buckets.get(finding.bucketId) ?? {
        bucketId: finding.bucketId,
        findings: [],
        spellIds: new Set<string>(),
        levels: new Map<string, number>(),
        templateChanges: new Map<string, number>(),
        jsonChanges: new Map<string, number>(),
      };

      bucket.findings.push({
        spellId: row.spellId,
        level: row.level,
        issue: finding.issue,
      });
      bucket.spellIds.add(row.spellId);
      increment(bucket.levels, String(row.level ?? "unknown"));
      increment(bucket.templateChanges, finding.recommendedTemplateChange ?? "(none)");
      increment(bucket.jsonChanges, finding.recommendedJsonChange ?? "(none)");
      buckets.set(finding.bucketId, bucket);
    }
  }

  return [...buckets.values()]
    .sort(
      (left, right) =>
        right.findings.length - left.findings.length ||
        left.bucketId.localeCompare(right.bucketId),
    )
    .map((bucket) => ({
      bucketId: bucket.bucketId,
      findings: bucket.findings.length,
      distinctSpells: bucket.spellIds.size,
      levels: [...bucket.levels.entries()]
        .sort((left, right) => Number(left[0]) - Number(right[0]))
        .map(([level, count]) => ({ level, count })),
      commonTemplateChanges: topEntries(bucket.templateChanges),
      commonJsonChanges: topEntries(bucket.jsonChanges),
      examples: bucket.findings.slice(0, 5),
    }));
}

// ============================================================================
// Markdown Rendering
// ============================================================================
// The markdown file is a compact review surface. It intentionally shows examples
// and common change families rather than every finding, because the per-bucket
// markdown files remain the detailed source for individual rows.
// ============================================================================

function renderMarkdown(output: {
  generatedAt: string;
  actionableOpenFindings: number;
  groupedMechanicsFamilies: number;
  buckets: ReturnType<typeof groupActionableFindings>;
}): string {
  const lines = [
    "# Actionable Schema Buckets",
    "",
    "This report groups remaining `actionable_open` spell mechanics findings by mechanics bucket family, then lists the most common requested schema/template changes inside each family.",
    "",
    `Generated: ${output.generatedAt}`,
    `Actionable open findings: ${output.actionableOpenFindings}`,
    `Grouped mechanics families: ${output.groupedMechanicsFamilies}`,
    "",
    "## Buckets",
    "",
  ];

  for (const bucket of output.buckets) {
    lines.push(`### ${bucket.bucketId}`, "");
    lines.push(`- Findings: ${bucket.findings}`);
    lines.push(`- Distinct spells: ${bucket.distinctSpells}`);
    lines.push(
      `- Levels: ${bucket.levels
        .map((entry) => `${entry.level} (${entry.count})`)
        .join(", ")}`,
    );
    lines.push("- Common template/schema changes:");
    for (const entry of bucket.commonTemplateChanges) {
      lines.push(`  - ${entry.count}: ${entry.text}`);
    }
    lines.push("- Common JSON changes:");
    for (const entry of bucket.commonJsonChanges) {
      lines.push(`  - ${entry.count}: ${entry.text}`);
    }
    lines.push("- Examples:");
    for (const example of bucket.examples) {
      lines.push(`  - ${example.spellId} / ${bucket.bucketId}: ${example.issue}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

// ============================================================================
// Script Entry Point
// ============================================================================
// Read the latest mechanics report, rebuild both summary artifacts, and print
// the remaining actionable count so the terminal output can be used as quick
// verification during closure packets.
// ============================================================================

const report = JSON.parse(readFileSync(SOURCE_REPORT_PATH, "utf8")) as MechanicsReport;
const buckets = groupActionableFindings(report);
const output = {
  generatedAt: new Date().toISOString(),
  sourceReport: SOURCE_REPORT_PATH,
  actionableOpenFindings: buckets.reduce((sum, bucket) => sum + bucket.findings, 0),
  groupedMechanicsFamilies: buckets.length,
  buckets,
};

writeFileSync(JSON_OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
writeFileSync(MARKDOWN_OUTPUT_PATH, renderMarkdown(output), "utf8");

console.log(`Actionable open findings: ${output.actionableOpenFindings}`);
console.log(`Grouped mechanics families: ${output.groupedMechanicsFamilies}`);
