// tools/agora/gapIndex.mjs
// GAPS.md → JSON gap index: the bridge between the project tracker's living
// GAPS registries (docs/projects/**/GAPS.md) and an AI orchestrator that needs
// a machine-readable work intake instead of reading thousands of markdown files.
//
//   node tools/agora/gapIndex.mjs [--root docs/projects] [--open-only] [--summary]
//
// Default output is JSON (one array), so orchestrators can pipe it straight into
// a plan: id, status, severity, classification, gap, nextAction, project, file.
// --summary prints per-project open/total counts for humans.
//
// Parsing contract (matches the living-project GAPS.md convention): the FIRST
// markdown table whose header row contains a "Gap ID" column is the registry;
// column names are matched loosely (case/punctuation-insensitive prefixes) so
// the many per-project header variants all resolve. Rows missing a Gap ID are
// skipped. Files that fail to parse are reported on stderr, never silently.
//
// Pure Node.js ESM, zero npm dependencies — same bar as the rest of tools/agora.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

/** Statuses that mean "this gap still needs work" per the tracker convention
 *  (PROJECT_TRACKER.md status vocabulary + GAPS.md allowed_statuses). */
export const OPEN_STATUSES = new Set([
  'open', 'active', 'pending', 'blocked', 'not_started', 'in_progress',
  'waiting', 'needs_validation', 'untriaged', 'review-required',
  'design_decision_deferred',
]);

/** Statuses that mean "no further work owed HERE" (done, declined, or moved).
 *  Anything in neither set is UNRECOGNIZED — callers must surface it, not
 *  silently bucket it (WF-G13: `routed` etc. were invisible to reconcile). */
export const CLOSED_STATUSES = new Set([
  'resolved', 'done', 'complete', 'closed', 'wont_fix', 'out_of_scope',
  'routed', 'merged-reference', 'archived',
]);

// Older registry rows predate durable Presence provenance. They may keep an
// explicit unknown marker, but every new row must carry a full Agora UUID.
const LEGACY_PROVENANCE = /^unknown \(legacy(?:[;)])/i;
const AGENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERIC_REGISTRANTS = /^(agent|claude|codex|orchestrator|worker)(?:\s*$|\s*\()/i;

/**
 * Validate the workflow registry fields that make each gap assignable and
 * traceable. Project-specific GAPS.md files retain their existing looser schema.
 */
export function validateWorkflowGapRows(rows, { allowedAgentIds = [] } = {}) {
  const allowed = new Set([...allowedAgentIds, 'human-operator']);
  const errors = [];

  for (const row of rows) {
    if (!row.suggestedAgent) {
      errors.push(`${row.id}: Suggested agent is required`);
    } else if (!allowed.has(row.suggestedAgent)) {
      errors.push(`${row.id}: Suggested agent must be an agents.json key or human-operator`);
    }

    if (!row.registeredBy) {
      errors.push(`${row.id}: Registered by must name the exact Agora handle`);
    } else if (GENERIC_REGISTRANTS.test(row.registeredBy)) {
      errors.push(`${row.id}: Registered by cannot be a generic role label`);
    }

    if (!row.registrantAgentId) {
      errors.push(`${row.id}: Registrant ID is required`);
    } else if (!AGENT_UUID.test(row.registrantAgentId) && !LEGACY_PROVENANCE.test(row.registrantAgentId)) {
      errors.push(`${row.id}: Registrant ID must be a full Agora UUID or an explicit legacy marker`);
    }

    if (!row.registrantTaskId) {
      errors.push(`${row.id}: Task/thread is required`);
    }
  }

  return errors;
}

// Loose header matching: lowercase, strip non-alphanumerics, then prefix-match.
function normHeader(h) {
  return String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const COLUMN_KEYS = [
  { key: 'id', match: ['gapid'] },
  { key: 'status', match: ['status'] },
  { key: 'severity', match: ['severity'] },
  { key: 'classification', match: ['classification', 'class'] },
  { key: 'owner', match: ['owner'] },
  // Workflow gaps name the agent lane best suited to perform the repair. This
  // is separate from classification, which only describes the kind of problem.
  { key: 'suggestedAgent', match: ['suggestedagent', 'agentfit', 'tackleby'] },
  // Registration provenance must identify the actual Presence row and task,
  // not merely say that an unnamed "orchestrator" noticed the problem.
  { key: 'registeredBy', match: ['registeredby', 'registranthandle'] },
  { key: 'registrantAgentId', match: ['registrantid', 'registrantagentid'] },
  { key: 'registrantTaskId', match: ['taskthread', 'registranttaskthread', 'registrantsession'] },
  { key: 'gap', match: ['gap'] },
  { key: 'evidence', match: ['evidence', 'evidencesource'] },
  { key: 'nextAction', match: ['nextaction'] },
];

function mapColumns(headerCells) {
  const cols = {};
  headerCells.forEach((cell, i) => {
    const n = normHeader(cell);
    if (!n) return;
    for (const { key, match } of COLUMN_KEYS) {
      if (cols[key] !== undefined) continue;
      if (match.some((m) => n === m || n.startsWith(m))) {
        // 'gap' must not swallow 'gapid' — exact key priority handles it because
        // COLUMN_KEYS lists id first and each header cell maps at most one key.
        if (key === 'gap' && n.startsWith('gapid')) continue;
        cols[key] = i;
        break;
      }
    }
  });
  return cols;
}

function splitRow(line) {
  // | a | b | c |  ->  ['a','b','c']  (leading/trailing pipes optional)
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isDividerRow(cells) {
  return cells.every((c) => /^:?-{1,}:?$/.test(c) || c === '');
}

/** Parse one GAPS.md's registry table into row objects. */
export function parseGapsMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const rows = [];
  let cols = null;
  let inTable = false;
  for (const line of lines) {
    const isRow = /^\s*\|/.test(line) && line.includes('|');
    if (!isRow) {
      if (inTable && cols) break; // registry table ended — ignore later tables
      inTable = false;
      continue;
    }
    const cells = splitRow(line);
    if (!cols) {
      // Looking for the header row of THE registry table.
      const candidate = mapColumns(cells);
      if (candidate.id !== undefined && candidate.status !== undefined) {
        cols = candidate;
        inTable = true;
      }
      continue;
    }
    if (isDividerRow(cells)) continue;
    const get = (key) => (cols[key] !== undefined ? cells[cols[key]] || '' : '');
    const id = get('id');
    if (!id || normHeader(id) === 'gapid') continue;
    rows.push({
      id,
      status: get('status').toLowerCase(),
      severity: get('severity').toLowerCase(),
      classification: get('classification'),
      owner: get('owner'),
      suggestedAgent: get('suggestedAgent'),
      registeredBy: get('registeredBy'),
      registrantAgentId: get('registrantAgentId'),
      registrantTaskId: get('registrantTaskId'),
      gap: get('gap'),
      evidence: get('evidence'),
      nextAction: get('nextAction'),
    });
  }
  return rows;
}

function walkGapsFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      // WORKFLOW_GAPS.md (tools/agora) uses the same row schema — index it too.
      else if (e.isFile() && (e.name === 'GAPS.md' || e.name === 'WORKFLOW_GAPS.md')) out.push(p);
    }
  }
  return out.sort();
}

/** Index every GAPS.md under root. Returns flat rows tagged with project + file. */
export function indexGaps({ root, openOnly = false, onError } = {}) {
  const absRoot = path.isAbsolute(root) ? root : path.resolve(REPO_ROOT, root);
  const gaps = [];
  for (const file of walkGapsFiles(absRoot)) {
    let rows;
    try {
      rows = parseGapsMarkdown(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      if (onError) onError(file, e);
      continue;
    }
    // WORKFLOW_GAPS.md is THE workflow registry — its project is 'workflow',
    // matching the documented `--ref workflow:WF-G<n>` convention (a root-level
    // file would otherwise get the meaningless project '.').
    const project = path.basename(file) === 'WORKFLOW_GAPS.md'
      ? 'workflow'
      : path.relative(absRoot, path.dirname(file)).split(path.sep).join('/') || '.';
    for (const r of rows) {
      if (openOnly && !OPEN_STATUSES.has(r.status)) continue;
      gaps.push({ ...r, project, file: path.relative(REPO_ROOT, file).split(path.sep).join('/') });
    }
  }
  return gaps;
}

/**
 * Rewrite ONE gap row in a GAPS.md registry (the tracker close-loop's write
 * half, WF-G3): set its status cell and append evidence to the evidence cell.
 * Column positions come from that file's own header (orders vary per project).
 * Returns true if the row was found and rewritten; false if the id is absent.
 */
export function updateGapRow(file, gapId, { status, appendEvidence } = {}) {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  let cols = null;
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*\|/.test(line)) { if (cols) break; continue; }
    const cells = splitRow(line);
    if (!cols) {
      const candidate = mapColumns(cells);
      if (candidate.id !== undefined && candidate.status !== undefined) cols = candidate;
      continue;
    }
    if (isDividerRow(cells)) continue;
    if ((cells[cols.id] || '').trim() !== gapId) continue;
    if (status && cols.status !== undefined) cells[cols.status] = status;
    if (appendEvidence && cols.evidence !== undefined) {
      cells[cols.evidence] = `${cells[cols.evidence] || ''}${cells[cols.evidence] ? '; ' : ''}${appendEvidence}`.trim();
    }
    lines[i] = `| ${cells.join(' | ')} |`;
    changed = true;
    break;
  }
  if (changed) fs.writeFileSync(file, lines.join('\n'));
  return changed;
}

// ---------------------------------------------------------------- CLI
function isMainModule() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return invoked === __filename;
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  const getFlag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = getFlag('--root') || 'docs/projects';
  const openOnly = argv.includes('--open-only');
  const summary = argv.includes('--summary');
  const gaps = indexGaps({
    root,
    openOnly,
    onError: (file, e) => console.error(`gapIndex: failed to parse ${file}: ${e.message}`),
  });

  // Workflow rows use the agent registry as the vocabulary for executor fit.
  // A bad row makes the command fail so orchestrators cannot silently ingest
  // anonymous or unassignable work.
  const workflowRows = gaps.filter((gap) => gap.project === 'workflow');
  if (workflowRows.length) {
    const registry = JSON.parse(fs.readFileSync(path.join(path.dirname(__filename), 'agents.json'), 'utf8'));
    const errors = validateWorkflowGapRows(workflowRows, { allowedAgentIds: Object.keys(registry.agents || {}) });
    for (const error of errors) console.error(`gapIndex: invalid workflow registry: ${error}`);
    if (errors.length) process.exitCode = 1;
  }
  if (summary) {
    const byProject = new Map();
    for (const g of gaps) {
      const s = byProject.get(g.project) || { open: 0, total: 0 };
      s.total++;
      if (OPEN_STATUSES.has(g.status)) s.open++;
      byProject.set(g.project, s);
    }
    console.log(`${gaps.length} gap(s) across ${byProject.size} project(s) under ${root}${openOnly ? ' (open only)' : ''}:\n`);
    for (const [project, s] of [...byProject.entries()].sort((a, b) => b[1].open - a[1].open)) {
      console.log(`  ${String(s.open).padStart(4)} open / ${String(s.total).padStart(4)} total  ${project}`);
    }
  } else {
    console.log(JSON.stringify(gaps, null, 2));
  }
}
