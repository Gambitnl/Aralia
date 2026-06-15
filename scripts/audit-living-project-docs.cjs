#!/usr/bin/env node
/**
 * Read-only living project documentation audit.
 *
 * This script checks the docs/projects living-project surface without changing
 * files. It exists so agents can run the same basic compliance pass before
 * launching broad project iterations: schema frontmatter, cold-start prompt
 * links, canonical doc coverage, dirty machine dates, and repeated handoff
 * marker risks.
 *
 * Called by: npm run projects:audit
 * Depends on: docs/projects and the living-project workflow docs.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Paths and Required Contract
// ============================================================================
// These constants mirror PROJECT_CARD_SCHEMA.md and the cold-start prompt
// template. Keep this small and explicit so future agents can see what the
// checker is enforcing without tracing dashboard code.
// ============================================================================

const repoRoot = process.cwd();
const projectsRoot = path.join(repoRoot, 'docs', 'projects');
const requiredDocs = [
  'NORTH_STAR.md',
  'TRACKER.md',
  'GAPS.md',
  'COLD_START_AGENT_PROMPT.md',
  'DECISIONS.md',
  'AUDIT_OR_PROOF.md',
  'RUNBOOK.md',
];
const requiredSchemaFields = [
  'schema_version',
  'project',
  'slug',
  'category',
  'main_category',
  'subcategory',
  'status',
  'last_updated',
  'confidence',
  'evidence',
  'gap_signal',
  'protocol',
  'next_step',
  'agent_comments',
  'required_docs',
  'optional_docs',
  'required_verification',
  'completed_verification',
  'last_proof',
  'workflow_gaps_reviewed',
  'compaction_status',
  'lifecycle_status',
  'deprecation_confidence',
  'deprecation_reason',
  'canonical_owner',
  'human_decision_required',
];
const requiredPromptFrontmatterFields = [
  'schema_version',
  'handoff_type',
  'project',
  'slug',
  'status',
  'last_updated',
  'iteration',
  'source_agent',
  'target_agent',
  'runtime_surface',
  'certainty',
  'workflow',
  'workflow_gaps',
  'dashboard_schema',
  'north_star',
  'tracker',
  'gaps',
];
const requiredPromptNeedles = [
  'docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md',
  'docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md',
  'docs/projects/PROJECT_CARD_SCHEMA.md',
  'NORTH_STAR.md',
  'TRACKER.md',
  'GAPS.md',
  'Required End State For This Iteration',
  'agent_comments',
];
const requiredTrackerSections = [
  'Status Vocabulary',
  'Active Task Queue',
  'Gap Log',
  'Update Rules',
];
const requiredGapFrontmatterFields = [
  'schema_version',
  'gap_schema',
  'project',
  'slug',
  'status',
  'status_note',
  'registry_mode',
  'last_updated',
  'gap_count',
  'open_gap_count',
  'resolved_gap_count',
  'routed_gap_count',
  'imported_gap_count',
  'decision_required_count',
  'visual_proof_required_count',
  'highest_severity',
  'proof_freshness',
  'workflow',
  'north_star',
  'tracker',
  'global_gaps',
  'allowed_statuses',
  'allowed_classifications',
  'allowed_severities',
  'supported_optional_row_fields',
  'supported_optional_sections',
];
const actionableGapStatuses = new Set([
  'open',
  'active',
  'pending',
  'blocked',
  'not_started',
  'in_progress',
  'waiting',
  'needs_validation',
  'untriaged',
  'routed',
  'review-required',
  'design_decision_deferred',
]);
const requiredGapSections = [
  'Gap Log',
  'Classification Reference',
  'Update Rules',
];

// ============================================================================
// Small Markdown/YAML Readers
// ============================================================================
// The audit intentionally uses a lightweight frontmatter reader. Unsupported
// YAML shapes are reported as missing fields instead of silently becoming valid.
// ============================================================================

const readText = (filePath) => (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
const stripBom = (content) => content.replace(/^\uFEFF/, '');
const hasSection = (content, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^##\\s+' + escapedHeading + '\\s*$', 'm').test(stripBom(content));
};

const readFrontmatter = (content) => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields = {};
  let activeListKey = '';

  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s*-\s+(.+)\s*$/);
    if (listItem && activeListKey) {
      fields[activeListKey] = [...(fields[activeListKey] || []), listItem[1].trim()];
      continue;
    }

    const scalar = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!scalar) continue;
    activeListKey = '';
    const key = scalar[1].trim();
    const value = scalar[2].trim();
    if (!value) {
      fields[key] = [];
      activeListKey = key;
    } else {
      fields[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  return fields;
};

const isDirtyDate = (value) => Boolean(value) && !/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim());
const gapRowsFromContent = (content) => {
  // Keep blank lines inside the section. A regex lookahead that treats
  // whitespace as "end" can terminate on the first empty line after the
  // heading and make a valid table look empty on Windows-authored markdown.
  const lines = stripBom(content).split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Gap Log\s*$/.test(line));
  if (start === -1) return [];
  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  const sectionLines = lines.slice(start + 1, end === -1 ? lines.length : end);
  return sectionLines.flatMap((line) => {
    if (!line.startsWith('|')) return [];
    const cells = line.split('|').slice(1, -1).map((cell) => cell.replace(/[`*]/g, '').trim());
    if (cells.length < 4) return [];
    if (/^gap( id)?$/i.test(cells[0]) || /^-+$/.test(cells[0].replace(/\s/g, ''))) return [];
    return [{ id: cells[0], status: cells[1], classification: cells[2] }];
  });
};

// ============================================================================
// Project Folder Audit
// ============================================================================
// Each project is checked independently. The output is JSON so the dashboard or
// a future migration script can consume it without scraping console prose.
// ============================================================================

const projectDirs = fs.existsSync(projectsRoot)
  ? fs.readdirSync(projectsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  : [];

const results = projectDirs.map((slug) => {
  const projectDir = path.join(projectsRoot, slug);
  const northStar = stripBom(readText(path.join(projectDir, 'NORTH_STAR.md')));
  const tracker = stripBom(readText(path.join(projectDir, 'TRACKER.md')));
  const gaps = stripBom(readText(path.join(projectDir, 'GAPS.md')));
  const prompt = stripBom(readText(path.join(projectDir, 'COLD_START_AGENT_PROMPT.md')));
  const frontmatter = readFrontmatter(northStar);
  const promptFrontmatter = readFrontmatter(prompt);
  const gapFrontmatter = readFrontmatter(gaps);
  const gapRows = gapRowsFromContent(gaps);
  const openGapRows = gapRows.filter((row) => actionableGapStatuses.has(String(row.status).toLowerCase()));
  const missingDocs = requiredDocs.filter((doc) => !fs.existsSync(path.join(projectDir, doc)));
  const missingSchemaFields = requiredSchemaFields.filter((field) => !(field in frontmatter));
  const missingPromptFrontmatter = requiredPromptFrontmatterFields.filter((field) => !(field in promptFrontmatter));
  const missingGapFrontmatter = requiredGapFrontmatterFields.filter((field) => !(field in gapFrontmatter));
  const missingPromptNeedles = requiredPromptNeedles.filter((needle) => !prompt.includes(needle));
  const missingTrackerContract = [
    ...(!/^# .+/m.test(tracker) ? ['heading'] : []),
    ...(!/^Status:\s*.+/im.test(tracker) ? ['Status'] : []),
    ...(!/^Last updated:\s*\d{4}-\d{2}-\d{2}/im.test(tracker) ? ['Last updated'] : []),
    ...requiredTrackerSections.filter((section) => !hasSection(tracker, section)),
  ];
  const missingGapContract = [
    ...(!/^# .+/m.test(gaps) ? ['heading'] : []),
    ...(!/^Status:\s*.+/im.test(gaps) ? ['Status'] : []),
    ...(!/^Last updated:\s*\d{4}-\d{2}-\d{2}/im.test(gaps) ? ['Last updated'] : []),
    ...requiredGapSections.filter((section) => !hasSection(gaps, section)),
  ];
  if (gapFrontmatter.gap_schema !== 'project_gap_registry') {
    missingGapFrontmatter.push('gap_schema must be project_gap_registry');
  }
  if (gapFrontmatter.slug && gapFrontmatter.slug !== slug) {
    missingGapFrontmatter.push('slug must match project folder');
  }
  if (!/^\d+$/.test(String(gapFrontmatter.gap_count || '').trim())) {
    missingGapFrontmatter.push('gap_count must be numeric');
  } else if (Number(gapFrontmatter.gap_count) !== gapRows.length) {
    missingGapFrontmatter.push('gap_count must match Gap Log rows');
  }
  if (!/^\d+$/.test(String(gapFrontmatter.open_gap_count || '').trim())) {
    missingGapFrontmatter.push('open_gap_count must be numeric');
  } else if (Number(gapFrontmatter.open_gap_count) !== openGapRows.length) {
    missingGapFrontmatter.push('open_gap_count must match actionable Gap Log rows');
  }
  const handoffMarkerCount = (prompt.match(/---BEGIN NEXT AGENT HANDOFF---/g) || []).length;
  const handoffEndMarkerCount = (prompt.match(/---END NEXT AGENT HANDOFF---/g) || []).length;
  if (handoffMarkerCount !== 1) {
    missingPromptNeedles.push(`BEGIN marker count ${handoffMarkerCount}`);
  }
  if (handoffEndMarkerCount !== 1) {
    missingPromptNeedles.push(`END marker count ${handoffEndMarkerCount}`);
  }
  if (!/^##\s+Iteration (Agent )?Ledger\s*$/m.test(prompt)) {
    missingPromptNeedles.push('Iteration Ledger');
  }
  if (!/^Iteration:\s*\d+/im.test(prompt)) {
    missingPromptNeedles.push('Iteration field');
  }
  if (promptFrontmatter.handoff_type !== 'agent_to_agent') {
    missingPromptFrontmatter.push('handoff_type must be agent_to_agent');
  }
  if (!/^\d+$/.test(String(promptFrontmatter.iteration || '').trim())) {
    missingPromptFrontmatter.push('iteration must be numeric');
  }
  if (promptFrontmatter.slug && promptFrontmatter.slug !== slug) {
    missingPromptFrontmatter.push('slug must match project folder');
  }
  const dirtyDates = ['last_updated', 'workflow_gaps_reviewed', 'last_proof'].filter((field) => isDirtyDate(frontmatter[field]));
  const dirtyPromptDates = ['last_updated'].filter((field) => isDirtyDate(promptFrontmatter[field]));
  const dirtyGapDates = ['last_updated'].filter((field) => isDirtyDate(gapFrontmatter[field]));

  return {
    slug,
    schema_status: Object.keys(frontmatter).length === 0 ? 'missing' : missingSchemaFields.length ? 'partial' : 'valid',
    missing_schema_fields: missingSchemaFields,
    missing_required_docs: missingDocs,
    missing_tracker_contract: missingTrackerContract,
    missing_gap_contract: missingGapContract,
    missing_gap_frontmatter: missingGapFrontmatter,
    missing_prompt_frontmatter: missingPromptFrontmatter,
    missing_prompt_needles: missingPromptNeedles,
    dirty_date_fields: dirtyDates,
    dirty_prompt_date_fields: dirtyPromptDates,
    dirty_gap_date_fields: dirtyGapDates,
    gap_count: gapRows.length,
    open_gap_count: openGapRows.length,
    handoff_marker_count: handoffMarkerCount,
    handoff_end_marker_count: handoffEndMarkerCount,
  };
});

const summary = {
  generated_at: new Date().toISOString(),
  project_count: results.length,
  schema_missing: results.filter((result) => result.schema_status === 'missing').length,
  schema_partial: results.filter((result) => result.schema_status === 'partial').length,
  schema_valid: results.filter((result) => result.schema_status === 'valid').length,
  missing_required_docs: results.filter((result) => result.missing_required_docs.length).length,
  tracker_contract_outdated: results.filter((result) => result.missing_tracker_contract.length).length,
  gap_contract_outdated: results.filter((result) => result.missing_gap_contract.length || result.missing_gap_frontmatter.length).length,
  prompt_outdated: results.filter((result) => result.missing_prompt_needles.length || result.missing_prompt_frontmatter.length).length,
  dirty_machine_dates: results.filter((result) => result.dirty_date_fields.length || result.dirty_prompt_date_fields.length || result.dirty_gap_date_fields.length).length,
  projects: results,
};

console.log(JSON.stringify(summary, null, 2));
