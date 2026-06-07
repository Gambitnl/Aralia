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
  'status',
  'last_updated',
  'confidence',
  'evidence',
  'gap_signal',
  'protocol',
  'next_step',
  'required_docs',
  'optional_docs',
  'workflow_gaps_reviewed',
  'compaction_status',
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

// ============================================================================
// Small Markdown/YAML Readers
// ============================================================================
// The audit intentionally uses a lightweight frontmatter reader. Unsupported
// YAML shapes are reported as missing fields instead of silently becoming valid.
// ============================================================================

const readText = (filePath) => (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');

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
  const northStar = readText(path.join(projectDir, 'NORTH_STAR.md'));
  const prompt = readText(path.join(projectDir, 'COLD_START_AGENT_PROMPT.md'));
  const frontmatter = readFrontmatter(northStar);
  const missingDocs = requiredDocs.filter((doc) => !fs.existsSync(path.join(projectDir, doc)));
  const missingSchemaFields = requiredSchemaFields.filter((field) => !(field in frontmatter));
  const missingPromptNeedles = requiredPromptNeedles.filter((needle) => !prompt.includes(needle));
  const handoffMarkerCount = (prompt.match(/---BEGIN NEXT AGENT HANDOFF---/g) || []).length;
  const dirtyDates = ['last_updated', 'workflow_gaps_reviewed', 'last_proof'].filter((field) => isDirtyDate(frontmatter[field]));

  return {
    slug,
    schema_status: Object.keys(frontmatter).length === 0 ? 'missing' : missingSchemaFields.length ? 'partial' : 'valid',
    missing_schema_fields: missingSchemaFields,
    missing_required_docs: missingDocs,
    missing_prompt_needles: missingPromptNeedles,
    dirty_date_fields: dirtyDates,
    handoff_marker_count: handoffMarkerCount,
  };
});

const summary = {
  generated_at: new Date().toISOString(),
  project_count: results.length,
  schema_missing: results.filter((result) => result.schema_status === 'missing').length,
  schema_partial: results.filter((result) => result.schema_status === 'partial').length,
  schema_valid: results.filter((result) => result.schema_status === 'valid').length,
  missing_required_docs: results.filter((result) => result.missing_required_docs.length).length,
  prompt_outdated: results.filter((result) => result.missing_prompt_needles.length).length,
  dirty_machine_dates: results.filter((result) => result.dirty_date_fields.length).length,
  projects: results,
};

console.log(JSON.stringify(summary, null, 2));
