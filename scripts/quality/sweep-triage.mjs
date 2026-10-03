/**
 * Keeps scanner findings tied to unfinished intent, durable plans, and existing work.
 *
 * The scanner calls these read-only helpers after detecting evidence in source.
 * A finding is a request for triage, not permission to delete code or create a task.
 * Gap records come from Agora's shared markdown parser so planning vocabulary has
 * one home. Comparisons refuse incomplete inventories: disappearing evidence is
 * never, by itself, proof that a feature was completed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  parseGapsMarkdownWithWarnings, mapColumns, splitRow, isDividerRow, OPEN_STATUSES, CLOSED_STATUSES,
} from '../../tools/agora/gapIndex.mjs';

export const ACTIVE_TASK_STATES = new Set(['open', 'ready', 'claimed', 'in_progress', 'blocked']);
export const CLOSED_TASK_STATES = new Set(['done', 'closed', 'complete', 'completed', 'cancelled']);
const PRESERVATION = 'Preserve intent, existing behavior, and embryonic systems. Do not delete or narrow unfinished capability merely to remove a scanner finding. Escalate uncertain product decisions to the user.';
const normalizePath = value => String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
const unique = values => [...new Set(values)];
const compareText = (a, b) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compactTask = task => ({ id: task.id, state: task.state, title: task.title || '' });

// Tracking annotations change ownership, not the underlying missing capability.
// Keep the entire remaining context in the hash; a shared 100-character prefix
// must not collapse two different findings. Symbols distinguish identical notes
// in different functions. Truly identical notes in one symbol remain ambiguous;
// report comparison detects duplicate IDs and asks for review rather than merging.
export function normalizeFindingContext(context, knownGapIds = []) {
  let text = String(context || '');
  for (const id of knownGapIds) text = text.replace(new RegExp(`\\b${escapeRegex(id)}\\b`, 'gi'), 'GG-0');
  return text
    .replace(/(?:\s*(?:\/\/|\/\*|\*)\s*)?(?:\b(?:tracked\s+(?:by|in|under)|tracking|see)\s*:?\s*)?(?:\[|\()?\s*\b(?:agora-[a-z0-9]+(?:[.-][a-z0-9]+)*|task-[a-z0-9]+(?:[.-][a-z0-9]+)*|GG-\d+|[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-G\d+)\b\s*(?:\]|\))?/gi, ' ')
    .replace(/^\s*(?:\/\/|\/\*+|\*)\s*/, '')
    .replace(/\*\/\s*$/, '')
    .replace(/\[\s*\]|\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?:\s*[,;|:-]\s*)+$/, '');
}

function identityContext(type, context, knownGapIds = []) {
  // The syntax detector supplies executable nodes without adjacent comments.
  // Their literal strings are actual behavior and must retain task-like text.
  // Only comment-derived findings can safely discard tracking annotations.
  const isComment = /^(?:MARKER|TODO|DEBT|FIXME|HACK|XXX|DEFERRED|STUB|PLACEHOLDER|.*_COMMENT|TS_IGNORE_SUPPRESSION|ESLINT_TYPE_SUPPRESSION)$/.test(type);
  return isComment ? normalizeFindingContext(context, knownGapIds) : String(context || '').replace(/\r\n/g, '\n').trim();
}

export function computeFindingId(file, type, context, symbol = '', knownGapIds = []) {
  const identity = [normalizePath(file), String(type), String(symbol), identityContext(type, context, knownGapIds)];
  return `finding-${createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 24)}`;
}

// Global and project registries sometimes have several tables separated by prose.
// Parse each actual registry table with the shared parser, without flattening the
// document or treating unrelated tables as gaps. Parser warnings remain visible.
function parseRegistryTables(content) {
  const lines = String(content).split(/\r?\n/);
  const rows = [];
  const warnings = [];
  const errors = [];
  let schema = null;
  let foundRegistry = false;
  for (let start = 0; start < lines.length; start++) {
    if (!/^\s*\|/.test(lines[start])) continue;
    let end = start + 1;
    while (end < lines.length && /^\s*\|/.test(lines[end])) end++;
    const block = lines.slice(start, end);
    const firstCells = splitRow(block[0]);
    const columns = mapColumns(firstCells);
    const hasHeader = block.length > 1 && isDividerRow(splitRow(block[1]));
    let registryText = null;
    if (hasHeader) {
      if (columns.id !== undefined && columns.status !== undefined) {
        foundRegistry = true;
        schema = { columns, width: firstCells.length, header: block.slice(0, 2).join('\n') };
        registryText = block.join('\n');
      }
      // A resolved-summary or vocabulary table has its own schema. Its rows
      // are not a second set of ownership records merely because IDs occur.
    } else if (schema && block.every(line => {
      const cells = splitRow(line);
      return /^[A-Z][A-Z0-9_-]*\d+$/i.test(cells[schema.columns.id] || '');
    })) {
      // Recover a matching bare continuation instead of losing old global
      // records appended after prose. Still expose the malformed table layout.
      registryText = `${schema.header}\n${block.join('\n')}`;
      warnings.push(`Registry table split: matching rows resume without a header at line ${start + 1}.`);
    } else if (!hasHeader && block.some(line => /^\s*\|\s*[A-Z][A-Z0-9_-]*\d+\s*\|/i.test(line))) {
      errors.push(`Unrecognized gap row layout at line ${start + 1}; these rows could not be inventoried.`);
    }
    start = end - 1;
    if (!registryText) continue;
    const parsed = parseGapsMarkdownWithWarnings(registryText);
    const malformedIds = new Set(block.slice(hasHeader ? 2 : 0).map(splitRow)
      .filter(cells => cells.length !== schema.width).map(cells => cells[schema.columns.id]));
    for (const row of parsed.rows) {
      // Unescaped pipes can shift evidence columns. Retain the row identity for
      // review, but never let a malformed layout prove its ownership is settled.
      const reviewIssues = malformedIds.has(row.id) ? [{ code: 'gap_row_layout_review' }] : [];
      rows.push({ ...row, reviewIssues });
    }
    warnings.push(...parsed.warnings);
  }
  if (!foundRegistry) warnings.push('No gap registry table with Gap ID and Status columns was found.');
  return { rows, warnings, errors };
}

export function loadGapRecords(repoRoot) {
  const records = [];
  const errors = [];
  const warnings = [];
  const root = path.resolve(repoRoot);
  const projectRoot = path.join(root, 'docs', 'projects');
  const registryFiles = new Set([path.join(projectRoot, 'GLOBAL_GAPS.md')]);
  const visit = directory => {
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch (error) { errors.push({ file: normalizePath(path.relative(root, directory)), error: error.message }); return; }
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory() && !['node_modules', '.git', '.agent'].includes(entry.name)) visit(file);
      else if (entry.isFile() && entry.name === 'GAPS.md') registryFiles.add(file);
    }
  };
  visit(projectRoot);
  for (const absoluteFile of [...registryFiles].sort(compareText)) {
    const file = normalizePath(path.relative(root, absoluteFile));
    try {
      const parsed = parseRegistryTables(fs.readFileSync(absoluteFile, 'utf8'));
      errors.push(...parsed.errors.map(error => ({ file, error })));
      warnings.push(...parsed.warnings.map(warning => ({ file, warning })));
      const project = path.basename(absoluteFile) === 'GLOBAL_GAPS.md' ? 'global' : normalizePath(path.relative(projectRoot, path.dirname(absoluteFile))) || 'global';
      for (const row of parsed.rows) {
        const status = String(row.status || '').toLowerCase().trim();
        const reviewIssues = [...(row.reviewIssues || [])];
        if (!OPEN_STATUSES.has(status) && !CLOSED_STATUSES.has(status)) reviewIssues.push({ code: 'unknown_gap_status', status });
        // "Duplicate" closes a registry row, not the underlying capability.
        // The survivor needs a deliberate link before this row proves ownership.
        if (status === 'duplicate') reviewIssues.push({ code: 'duplicate_gap_status', status });
        records.push({ ...row, id: row.id.toUpperCase(), status, file, project, reviewIssues });
      }
    } catch (error) { errors.push({ file, error: error.message }); }
  }
  const counts = new Map();
  for (const record of records) counts.set(record.id, (counts.get(record.id) || 0) + 1);
  for (const record of records) {
    if (counts.get(record.id) > 1) record.reviewIssues.push({ code: 'duplicate_gap_id', count: counts.get(record.id) });
  }
  return { records, errors, warnings };
}

// Every citation gets evidence. An active task must not conceal another missing
// reference or a completed task whose promised behavior is still absent.
export function classifyFinding(item, { tasks = [], agoraOnline = false, gapRecords = [], gapsAvailable = true } = {}) {
  const availableTasks = Array.isArray(tasks) ? tasks : tasks instanceof Map ? [...tasks.values()] : [];
  const records = Array.isArray(gapRecords) ? gapRecords : gapRecords?.records || [];
  const citedAgoraIds = unique((item.citedAgoraIds || []).map(id => id.toLowerCase()));
  const citedGaps = unique((item.citedGaps || []).map(id => id.toUpperCase()));
  const findingId = item.findingId || computeFindingId(item.file, item.type, item.text, item.symbol);
  const issues = [];
  const taskEvidence = [];
  const gapEvidence = [];
  const activeDirect = [];
  const activeGapTasks = [];
  const validGapRecords = [];

  for (const id of citedAgoraIds) {
    if (!agoraOnline) {
      taskEvidence.push({ id, verification: 'unavailable' });
      issues.push({ code: 'task_verification_unavailable', reference: id });
      continue;
    }
    const matches = availableTasks.filter(task => String(task.id).toLowerCase() === id);
    if (!matches.length) {
      taskEvidence.push({ id, verification: 'missing' });
      issues.push({ code: 'task_not_found', reference: id });
      continue;
    }
    if (matches.length > 1) issues.push({ code: 'duplicate_task_id', reference: id });
    for (const task of matches) {
      taskEvidence.push({ ...compactTask(task), verification: 'verified' });
      if (ACTIVE_TASK_STATES.has(task.state)) activeDirect.push(task);
      else if (CLOSED_TASK_STATES.has(task.state)) issues.push({ code: 'completed_task_finding_remains', reference: id });
      else issues.push({ code: 'unknown_task_state', reference: id, state: task.state });
    }
  }

  for (const id of citedGaps) {
    const matches = records.filter(record => String(record.id).toUpperCase() === id);
    const linkedTasks = agoraOnline ? availableTasks.filter(task => {
      const text = [task.title, task.body, ...(task.refs || [])].join(' ');
      return new RegExp(`\\b${escapeRegex(id)}\\b`, 'i').test(text);
    }) : [];
    const active = linkedTasks.filter(task => ACTIVE_TASK_STATES.has(task.state));
    activeGapTasks.push(...active);
    gapEvidence.push({ id, verification: matches.length ? 'verified' : gapsAvailable ? 'missing' : 'unavailable', records: matches, tasks: linkedTasks.map(compactTask) });
    if (matches.length > 1) issues.push({ code: 'duplicate_gap_id', reference: id });
    if (!matches.length) issues.push({ code: gapsAvailable ? 'gap_not_found' : 'gap_verification_unavailable', reference: id });
    for (const record of matches) {
      const recordIssues = record.reviewIssues || [];
      issues.push(...recordIssues.map(issue => ({ ...issue, reference: id })));
      if (OPEN_STATUSES.has(record.status) && matches.length === 1 && !recordIssues.length) validGapRecords.push(record);
      else if (CLOSED_STATUSES.has(record.status)) issues.push({ code: 'closed_gap_finding_remains', reference: id, status: record.status });
      else if (!recordIssues.some(issue => issue.code === 'unknown_gap_status')) issues.push({ code: 'unknown_gap_status', reference: id, status: record.status });
    }
    if (!agoraOnline) issues.push({ code: 'live_gap_assignment_unavailable', reference: id });
    else if (!active.length && linkedTasks.some(task => CLOSED_TASK_STATES.has(task.state))) issues.push({ code: 'completed_gap_task_finding_remains', reference: id });
    for (const task of linkedTasks) {
      if (!ACTIVE_TASK_STATES.has(task.state) && !CLOSED_TASK_STATES.has(task.state)) issues.push({ code: 'unknown_task_state', reference: task.id, state: task.state });
    }
  }

  const relatedTasks = availableTasks.map(task => {
    const text = [task.title, task.body, ...(task.refs || []), ...(task.findingIds || []), ...(task.metadata?.findingIds || [])].join(' ');
    const hasId = new RegExp(`\\b${escapeRegex(findingId)}\\b`).test(text);
    const hasFile = (task.refs || []).some(ref => normalizePath(ref).replace(/:\d+(?::\d+)?$/, '') === normalizePath(item.file));
    return hasId || hasFile ? { ...compactTask(task), reason: hasId ? 'finding_id' : 'file_reference' } : null;
  }).filter(Boolean).sort((a, b) => (a.reason === b.reason ? 0 : a.reason === 'finding_id' ? -1 : 1) || compareText(a.id, b.id));

  let trackingStatus;
  const codes = new Set(issues.map(issue => issue.code));
  const closed = [...codes].some(code => ['completed_task_finding_remains', 'completed_gap_task_finding_remains', 'closed_gap_finding_remains'].includes(code));
  const review = [...codes].some(code => ['duplicate_task_id', 'unknown_task_state', 'duplicate_gap_id', 'duplicate_gap_status', 'unknown_gap_status', 'gap_verification_unavailable', 'gap_row_layout_review'].includes(code));
  const missing = codes.has('task_not_found') || codes.has('gap_not_found');
  if (codes.has('task_verification_unavailable')) trackingStatus = 'unverified_offline';
  else if (!agoraOnline && citedGaps.length && validGapRecords.length !== citedGaps.length) trackingStatus = 'unverified_offline';
  else if (review || (missing && citedAgoraIds.length + citedGaps.length > 1)) trackingStatus = 'reference_review';
  else if (closed) trackingStatus = 'completion_review';
  else if (codes.has('task_not_found')) trackingStatus = 'task_not_found';
  else if (codes.has('gap_not_found')) trackingStatus = gapsAvailable ? 'unmapped_gap' : 'unverified_offline';
  else if (activeDirect.length) trackingStatus = activeDirect.every(task => task.state === 'blocked') ? 'blocked' : 'tracked';
  else if (activeGapTasks.length) trackingStatus = 'tracked_via_gap';
  else if (validGapRecords.length) trackingStatus = 'recorded_deferred';
  else trackingStatus = 'unlisted';

  const dispositions = {
    tracked: { action: 'keep_visible', reason: 'An active task owns this finding; preserve its evidence until acceptance is demonstrated.' },
    blocked: { action: 'keep_visible', reason: 'Registered work is blocked. Preserve its scope and blocker rather than proposing a duplicate task.' },
    tracked_via_gap: { action: 'keep_visible', reason: 'A verified durable gap has active work. Keep the gap and finding visible together.' },
    recorded_deferred: { action: 'record_deferred_intent', reason: 'A durable open planning record preserves this intent without requiring an active task. Live assignment may be unavailable.' },
    completion_review: { action: 'reconcile_completion', reason: 'A finding remains after linked work was closed. Check acceptance evidence and remaining scope before changing commentary or reopening work.' },
    reference_review: { action: 'review_tracking', reason: 'Explicit references disagree or cannot be validated. Reconcile every listed issue before treating ownership as settled.' },
    task_not_found: { action: 'review_tracking', reason: 'A cited task does not exist in the verified board response. Check its identity and any replacement task.' },
    unmapped_gap: { action: 'review_tracking', reason: 'A cited gap is absent from the durable registry. Check its spelling or routed destination before creating new work.' },
    unverified_offline: { action: 'verify_tracking', reason: 'Live task verification is unavailable. Retain independently verified durable records and retry verification before task intake.' },
    unlisted: { action: relatedTasks.length ? 'link_existing_work' : 'investigate', reason: relatedTasks.length ? 'Existing task candidates may cover this finding. Review their scope before adding a citation or proposing new work.' : 'No verified owner is cited. Establish the intended behavior and decide whether to link work, record deferred intent, or propose a task.' },
  };
  return {
    ...item, findingId, citedAgoraIds, citedGaps, trackingStatus,
    detectionEvidence: item.detectionEvidence || { rule: item.type, file: item.file, line: item.line, text: item.text },
    trackingEvidence: { tasks: taskEvidence, gaps: gapEvidence, issues, liveVerification: agoraOnline ? 'available' : 'unavailable' },
    disposition: dispositions[trackingStatus], relatedTasks,
    verifiedTask: activeDirect.length ? compactTask(activeDirect[0]) : null,
    gapTasks: unique(activeGapTasks.map(task => task.id)).map(id => compactTask(activeGapTasks.find(task => task.id === id))),
  };
}

// Groups are conservative review proposals, not batches to submit automatically.
// A durable project takes precedence; otherwise only a nearby source directory
// groups findings. The scanner cannot infer product intent from a file name.
function proposalArea(item) {
  const projects = unique((item.trackingEvidence?.gaps || []).flatMap(gap => gap.records || []).map(record => record.project).filter(project => project && project !== 'global'));
  if (projects.length === 1) return `project:${projects[0]}`;
  const parts = normalizePath(item.file).split('/');
  if (parts[0] === 'src' && parts.length > 3) return parts.slice(0, 3).join('/');
  return parts.slice(0, -1).join('/') || 'repository-root';
}

export function buildTaskProposals(findings) {
  const groups = new Map();
  for (const item of findings) {
    if (['tracked', 'blocked', 'tracked_via_gap', 'recorded_deferred'].includes(item.trackingStatus)) continue;
    const area = proposalArea(item);
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(item);
  }
  return [...groups.entries()].sort(([a], [b]) => compareText(a, b)).map(([area, members]) => {
    const items = [...members].sort((a, b) => compareText(a.file, b.file) || (a.line || 0) - (b.line || 0) || compareText(a.findingId, b.findingId));
    const findingIds = unique(items.map(item => item.findingId)).sort(compareText);
    const refs = unique(items.map(item => normalizePath(item.file))).sort(compareText);
    const candidates = new Map();
    for (const item of items) for (const task of item.relatedTasks || []) {
      if (!candidates.has(task.id) || task.reason === 'finding_id') candidates.set(task.id, task);
    }
    const existingCandidates = [...candidates.values()].sort((a, b) => compareText(a.id, b.id));
    const nextAction = items.some(item => ['verify_tracking', 'review_tracking', 'reconcile_completion'].includes(item.disposition?.action))
      ? 'Reconcile tracking and acceptance evidence before proposing any new task.'
      : existingCandidates.length ? 'Review existing task scope and link matching findings before proposing new work.' : 'Investigate current behavior and intended capability, then choose a durable record or a cohesive task.';
    const evidence = items.map(item => ({ findingId: item.findingId, file: item.file, line: item.line, type: item.type, text: item.text, trackingStatus: item.trackingStatus, disposition: item.disposition, issues: item.trackingEvidence?.issues || [] }));
    const acceptanceCriteria = [
      'Explain current behavior and the intended capability using source or product evidence.',
      'Account for every finding ID and explicit reference, including existing work and deferred intent.',
      'State what behavior and future scope must be preserved; ask for a user decision when intent is uncertain.',
      'Define and collect the focused test or rendered evidence needed to verify the agreed outcome.',
      'Do not treat a removed comment, missing finding, or smaller inventory as proof of completion.',
    ];
    return {
      proposalId: `proposal-${createHash('sha256').update(JSON.stringify([area, findingIds])).digest('hex').slice(0, 24)}`,
      area, title: `Investigate unfinished intent in ${area}`, findingIds, refs, evidence,
      existingCandidates, preservation: PRESERVATION, nextAction, acceptanceCriteria,
      currentBehavior: 'Requires inspection of the listed evidence; scanner patterns do not establish product behavior.',
      missingCapability: 'Confirm the intended capability or unresolved decision during triage.',
      requiresReview: true,
    };
  });
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort(compareText).map(key => [key, stableValue(value[key])]));
  return value;
}

function reportScope(scope) {
  if (!scope || !Array.isArray(scope.roots) || !Array.isArray(scope.checks)) throw new Error('Report scope must name roots and checks.');
  return JSON.stringify(stableValue({ ...scope, ...(scope.repoRoot ? { repoRoot: normalizePath(scope.repoRoot) } : {}), roots: unique(scope.roots.map(normalizePath)).sort(compareText), checks: unique(scope.checks).sort(compareText) }));
}

function reportFindings(report, label) {
  if (report?.schemaVersion !== 2) throw new Error(`${label} report schema is incompatible; expected schemaVersion 2.`);
  if (report.coverage?.complete !== true) throw new Error(`${label} source inventory is incomplete; comparison cannot infer disappearance.`);
  for (const check of report.scope?.checks || []) {
    const subsystem = report.subsystems?.[check];
    if (subsystem && !['passed', 'has_findings'].includes(subsystem.status)) throw new Error(`${label} selected subsystem ${check} is ${subsystem.status}; comparison cannot infer disappearance.`);
  }
  if (!Array.isArray(report.findings)) throw new Error(`${label} report has no findings inventory.`);
  const map = new Map();
  for (const item of report.findings) {
    if (typeof item.findingId !== 'string' || !item.findingId) throw new Error(`${label} report contains a finding without an ID.`);
    if (map.has(item.findingId)) throw new Error(`${label} report has ambiguous duplicate finding ID ${item.findingId}.`);
    map.set(item.findingId, item);
  }
  return map;
}

function findingFingerprint(item) {
  // Ignore line shifts and display-only metadata, but retain every fact that may
  // change the triage decision, including a newly attached citation.
  return JSON.stringify(stableValue({
    type: item.type, file: normalizePath(item.file), symbol: item.symbol || '',
    context: identityContext(item.type, item.context || item.text, item.citedGaps), trackingStatus: item.trackingStatus,
    citedAgoraIds: [...(item.citedAgoraIds || [])].sort(compareText), citedGaps: [...(item.citedGaps || [])].sort(compareText),
    disposition: item.disposition, trackingEvidence: item.trackingEvidence,
  }));
}

export function compareReports(previous, current) {
  const before = reportFindings(previous, 'Previous');
  const after = reportFindings(current, 'Current');
  if (reportScope(previous.scope) !== reportScope(current.scope)) throw new Error('Report scopes differ; compare identical roots, checks, and scan policies.');
  const result = { new: [], changed: [], previouslySeen: [], noLongerDetected: [], noLongerDetectedMeansResolved: false, note: 'No longer detected is not resolved. Inspect moves, exclusions, and removed commentary before judging completion.' };
  for (const [id, item] of after) {
    if (!before.has(id)) result.new.push(item);
    else if (findingFingerprint(before.get(id)) !== findingFingerprint(item)) result.changed.push({ findingId: id, previous: before.get(id), current: item });
    else result.previouslySeen.push(item);
  }
  for (const [id, item] of before) if (!after.has(id)) result.noLongerDetected.push(item);
  for (const key of ['new', 'changed', 'previouslySeen', 'noLongerDetected']) result[key].sort((a, b) => compareText(a.findingId, b.findingId));
  return result;
}
