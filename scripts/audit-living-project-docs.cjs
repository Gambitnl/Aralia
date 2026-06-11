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
  const missingDocs = requiredDocs.filter((doc) => !fs.existsSync(path.join(projectDir, doc)));
  const missingSchemaFields = requiredSchemaFields.filter((field) => !(field in frontmatter));
  const missingPromptFrontmatter = requiredPromptFrontmatterFields.filter((field) => !(field in promptFrontmatter));
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

  return {
    slug,
    schema_status: Object.keys(frontmatter).length === 0 ? 'missing' : missingSchemaFields.length ? 'partial' : 'valid',
    missing_schema_fields: missingSchemaFields,
    missing_required_docs: missingDocs,
    missing_tracker_contract: missingTrackerContract,
    missing_gap_contract: missingGapContract,
    missing_prompt_frontmatter: missingPromptFrontmatter,
    missing_prompt_needles: missingPromptNeedles,
    dirty_date_fields: dirtyDates,
    dirty_prompt_date_fields: dirtyPromptDates,
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
  gap_contract_outdated: results.filter((result) => result.missing_gap_contract.length).length,
  prompt_outdated: results.filter((result) => result.missing_prompt_needles.length || result.missing_prompt_frontmatter.length).length,
  dirty_machine_dates: results.filter((result) => result.dirty_date_fields.length || result.dirty_prompt_date_fields.length).length,
  projects: results,
};

console.log(JSON.stringify(summary, null, 2));
