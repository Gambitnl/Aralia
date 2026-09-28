/**
 * This file validates the durable Idea Board research contract.
 *
 * It rejects duplicate identities and sources, unsupported date precision,
 * incomplete project comparisons, blurred evidence categories, and experiments
 * without measurable pass/fail gates. The validator reads data only; it never
 * fetches a source, installs a package, or changes a research conclusion.
 *
 * Called by: validate.test.mjs and direct `node scripts/idea-board/validate.mjs`
 * Depends on: public/idea-board/lib.mjs and Node's standard library
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  ASSESSMENT_STATUSES,
  CONFIDENCE_LEVELS,
  IDEA_KINDS,
  normalizeSourceUrl,
} from '../../public/idea-board/lib.mjs';

// ============================================================================
// Canonical Vocabulary And Field Contracts
// ============================================================================
// These lists make missing evidence visible. Optional experiment results remain
// optional because an unrun experiment is a valid and important research state.
// ============================================================================

const CONCLUSIONS = new Set([
  'Adopt directly',
  'Adapt behind a boundary',
  'Test as an optional sidecar',
  'Watch for future maturity',
  'Reject for the current project',
  'Revisit after a named blocker is resolved',
]);

const REQUIRED_TECHNIQUE_FIELDS = [
  'requiredInput', 'processingSteps', 'producedOutput', 'dependencies',
  'runtimeRequirements', 'manualWork', 'componentTypes', 'externalRequirements',
  'licenceConstraints', 'knownLimitations', 'doesNotSolve',
];

const REQUIRED_FIT_FIELDS = [
  'couldHelp', 'wouldNotHelp', 'complements', 'mustNotReplace',
  'architecturalBoundary', 'dependenciesIntroduced', 'blockers', 'risks',
  'ownership', 'migrationRollback', 'conclusion',
];

const REQUIRED_COMPARISON_FIELDS = [
  'dimension', 'externalApproach', 'projectApproach', 'meaningfulDifference',
  'practicalConsequence', 'evidence', 'uncertainty',
];

const REQUIRED_EXPERIMENT_FIELDS = [
  'question', 'exactInput', 'pinnedRevisions', 'expectedOutput', 'projectBaseline',
  'measurements', 'limit', 'acceptanceCriteria', 'rejectionCriteria',
  'isolationBoundary', 'cleanup',
];

// ============================================================================
// Archive Governance Contract (RUNBOOK section 8)
// ============================================================================
// The project records a link to a snapshot that a third party already made. It
// never makes a snapshot itself. These are the mechanical parts of the RUNBOOK
// rule: the host must be an approved public archive service, and a recorded
// snapshot must carry the date on which the assessor inspected it. The rest of
// the rule (licence judgement and deletion approval) stays with the owners.
// ============================================================================

export const APPROVED_ARCHIVE_HOSTS = [
  'web.archive.org',
  'archive.org',
  'archive.ph',
  'archive.today',
  'archive.is',
  'archive.li',
  'archive.vn',
  'ghostarchive.org',
  'perma.cc',
];

function archiveHostIsApproved(host) {
  const normalized = host.toLowerCase().replace(/^www\./, '');
  return APPROVED_ARCHIVE_HOSTS.includes(normalized);
}

// ============================================================================
// Primitive Evidence Checks
// ============================================================================
// A date may be a full timestamp, a calendar day, or an explicit unavailable
// explanation. Anything else risks claiming precision the source did not show.
// ============================================================================

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHonestDate(value) {
  if (!hasText(value)) return false;
  if (/^unavailable:\s+.+/i.test(value)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return !Number.isNaN(Date.parse(value));
  return false;
}

function isCommitOrUnavailable(value) {
  return /^[a-f0-9]{7,40}$/i.test(value) || /^unavailable:\s+.+/i.test(value);
}

function requireFields(value, fields, path, errors) {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  // Every required field needs usable text or a non-empty list of usable text.
  for (const field of fields) {
    const item = value[field];
    const valid = Array.isArray(item) ? item.length > 0 && item.every(hasText) : hasText(item);
    if (!valid) errors.push(`${path}.${field} must contain evidence-bearing text.`);
  }
}

function requireStringList(value, path, errors, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || !value.every(hasText)) {
    errors.push(`${path} must be ${allowEmpty ? 'a' : 'a non-empty'} list of text entries.`);
  }
}

// ============================================================================
// Source Shelf Validation
// ============================================================================
// Each URL is globally unique across records and exclusions. Several sources
// may support one technique, but the same URL cannot masquerade as new evidence.
// ============================================================================

function validateSource(source, path, errors, sourceUrls) {
  requireFields(source, ['id', 'title', 'url', 'type', 'role', 'publishedAt', 'latestRevisionInspected', 'licence', 'provenance'], path, errors);
  requireStringList(source.claims, `${path}.claims`, errors);
  requireStringList(source.demonstrates, `${path}.demonstrates`, errors);
  requireStringList(source.implementationContains, `${path}.implementationContains`, errors);

  for (const dateField of ['publishedAt', 'latestRevisionInspected']) {
    if (!isHonestDate(source[dateField])) errors.push(`${path}.${dateField} must use supported precision or explain why it is unavailable.`);
  }

  try {
    const normalized = normalizeSourceUrl(source.url);
    if (!['http:', 'https:'].includes(new URL(normalized).protocol)) errors.push(`${path}.url must be an HTTP(S) primary-source address.`);
    if (sourceUrls.has(normalized)) errors.push(`${path}.url duplicates ${sourceUrls.get(normalized)}.`);
    else sourceUrls.set(normalized, path);
  } catch {
    errors.push(`${path}.url is not a valid URL.`);
  }

  // Archive evidence is optional. When it is present, the mechanical part of
  // the RUNBOOK archive rule applies: an approved public archive host and the
  // date on which the assessor inspected that snapshot.
  if (hasText(source.archiveUrl)) {
    let archive = null;
    try { archive = new URL(source.archiveUrl); } catch { errors.push(`${path}.archiveUrl is not a valid URL.`); }

    if (archive) {
      if (!['http:', 'https:'].includes(archive.protocol)) {
        errors.push(`${path}.archiveUrl must be an HTTP(S) address; the project does not store a local copy.`);
      } else if (!archiveHostIsApproved(archive.hostname)) {
        errors.push(`${path}.archiveUrl host "${archive.hostname}" is not an approved archive service (RUNBOOK section 8: ${APPROVED_ARCHIVE_HOSTS.join(', ')}).`);
      }
    }

    if (!isHonestDate(source.archivedAt)) {
      errors.push(`${path}.archivedAt must record when the snapshot was inspected, or explain why that date is unavailable.`);
    }
  } else if (hasText(source.archivedAt)) {
    errors.push(`${path}.archivedAt cannot record a snapshot date when ${path}.archiveUrl is empty.`);
  }
}

// ============================================================================
// Dated Revision Validation
// ============================================================================
// Revisions own conclusions and project comparisons. This is what prevents a
// new assessment from rewriting the evidence available to an earlier one.
// ============================================================================

function validateRevision(revision, record, path, errors, revisionIds) {
  requireFields(revision, ['id', 'assessedAt', 'sourceProvidedAt', 'status', 'confidence', 'changeSummary'], path, errors);

  if (!new RegExp(`^${record.id}-R\\d{3}$`).test(revision.id)) errors.push(`${path}.id must be namespaced under ${record.id}.`);
  if (revisionIds.has(revision.id)) errors.push(`${path}.id duplicates another historical revision.`);
  revisionIds.add(revision.id);
  if (!ASSESSMENT_STATUSES.includes(revision.status)) errors.push(`${path}.status is not an allowed assessment status.`);
  if (!CONFIDENCE_LEVELS.includes(revision.confidence)) errors.push(`${path}.confidence is not an allowed confidence level.`);

  for (const dateField of ['assessedAt', 'sourceProvidedAt']) {
    if (!isHonestDate(revision[dateField])) errors.push(`${path}.${dateField} must use supported precision or explain why it is unavailable.`);
  }

  requireStringList(revision.facts, `${path}.facts`, errors);
  requireStringList(revision.inferences, `${path}.inferences`, errors);
  requireStringList(revision.unknowns, `${path}.unknowns`, errors);
  requireStringList(revision.recommendations, `${path}.recommendations`, errors);
  requireFields(revision.technique, REQUIRED_TECHNIQUE_FIELDS, `${path}.technique`, errors);
  requireFields(revision.fit, REQUIRED_FIT_FIELDS, `${path}.fit`, errors);

  if (!CONCLUSIONS.has(revision.fit?.conclusion)) errors.push(`${path}.fit.conclusion must use the board's provisional conclusion vocabulary.`);

  // At least one dimension must compare both sides and state consequence, evidence, and uncertainty.
  if (!Array.isArray(revision.comparisons) || revision.comparisons.length === 0) {
    errors.push(`${path}.comparisons must contain at least one two-sided project comparison.`);
  } else {
    revision.comparisons.forEach((comparison, index) => requireFields(comparison, REQUIRED_COMPARISON_FIELDS, `${path}.comparisons[${index}]`, errors));
  }

  const baseline = revision.projectBaseline;
  requireFields(baseline, ['commit', 'committedAt', 'inspectedAt', 'dirtyNote'], `${path}.projectBaseline`, errors);
  if (!isCommitOrUnavailable(baseline?.commit ?? '')) errors.push(`${path}.projectBaseline.commit must be a hexadecimal Git hash or an unavailable explanation.`);
  for (const dateField of ['committedAt', 'inspectedAt']) {
    if (!isHonestDate(baseline?.[dateField])) errors.push(`${path}.projectBaseline.${dateField} must use supported precision or explain why it is unavailable.`);
  }
  if (typeof baseline?.dirty !== 'boolean') errors.push(`${path}.projectBaseline.dirty must explicitly record whether uncommitted work existed.`);

  // Experiments are optional, but a proposed or completed experiment must be bounded and falsifiable.
  if (revision.experiment !== null && revision.experiment !== undefined) {
    requireFields(revision.experiment, REQUIRED_EXPERIMENT_FIELDS, `${path}.experiment`, errors);
    if (revision.experiment.result && !isHonestDate(revision.experiment.resultAt)) errors.push(`${path}.experiment.resultAt is required when a result is recorded.`);
  }
}

// ============================================================================
// Whole Dataset Validation
// ============================================================================
// This function returns every issue in one pass so an editor can repair a
// record without repeated single-error cycles.
// ============================================================================

export function validateIdeaBoard(data) {
  const errors = [];
  const recordIds = new Set();
  const revisionIds = new Set();
  const sourceUrls = new Map();

  if (!isObject(data) || data.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (!isHonestDate(data?.generatedAt)) errors.push('generatedAt must use supported date precision.');
  if (!Array.isArray(data?.records)) errors.push('records must be an array.');
  if (!Array.isArray(data?.excludedSources)) errors.push('excludedSources must be an array.');

  const workspace = data?.localProject?.workspaceInspection;
  const committed = data?.localProject?.committedBaseline;
  if (!isCommitOrUnavailable(committed?.commit ?? '')) errors.push('localProject.committedBaseline.commit must be a Git hash or unavailable explanation.');
  if (!isHonestDate(committed?.committedAt)) errors.push('localProject.committedBaseline.committedAt must use supported precision.');
  if (!isHonestDate(workspace?.inspectedAt)) errors.push('localProject.workspaceInspection.inspectedAt must use supported precision.');
  if (typeof workspace?.dirty !== 'boolean') errors.push('localProject.workspaceInspection.dirty must be a boolean.');
  if (workspace?.dirty && !hasText(workspace?.note)) errors.push('A dirty workspace must explain how it differs from the committed baseline.');

  for (const [recordIndex, record] of (data?.records ?? []).entries()) {
    const path = `records[${recordIndex}]`;
    requireFields(record, ['id', 'title', 'summary', 'problem', 'kind'], path, errors);
    requireStringList(record.tags, `${path}.tags`, errors);
    requireStringList(record.relatedIdeaIds, `${path}.relatedIdeaIds`, errors, true);

    if (!/^IB-\d{4}$/.test(record.id)) errors.push(`${path}.id must match IB-0001 style stable identity.`);
    if (recordIds.has(record.id)) errors.push(`${path}.id duplicates another record.`);
    recordIds.add(record.id);
    if (!IDEA_KINDS.includes(record.kind)) errors.push(`${path}.kind is not an allowed idea kind.`);
    if (!Array.isArray(record.sources) || record.sources.length === 0) errors.push(`${path}.sources must retain at least one primary or supporting source.`);
    else record.sources.forEach((source, sourceIndex) => validateSource(source, `${path}.sources[${sourceIndex}]`, errors, sourceUrls));
    if (!Array.isArray(record.revisions) || record.revisions.length === 0) errors.push(`${path}.revisions must contain at least one dated assessment.`);
    else record.revisions.forEach((revision, revisionIndex) => validateRevision(revision, record, `${path}.revisions[${revisionIndex}]`, errors, revisionIds));
  }

  // Related identities are checked after the full registry is known.
  for (const [recordIndex, record] of (data?.records ?? []).entries()) {
    for (const relatedId of record.relatedIdeaIds ?? []) {
      if (!recordIds.has(relatedId)) errors.push(`records[${recordIndex}].relatedIdeaIds references missing record ${relatedId}.`);
      if (relatedId === record.id) errors.push(`records[${recordIndex}].relatedIdeaIds cannot link a record to itself.`);
    }

    // Every revision after the first must point to an earlier preserved revision.
    const ascending = [...(record.revisions ?? [])].sort((left, right) => left.assessedAt.localeCompare(right.assessedAt));
    ascending.forEach((revision, index) => {
      if (index === 0 && revision.previousRevisionId) errors.push(`${revision.id} is the first revision and cannot name a previous revision.`);
      if (index > 0 && revision.previousRevisionId !== ascending[index - 1].id) errors.push(`${revision.id} must link to the immediately preceding historical revision ${ascending[index - 1].id}.`);
    });
  }

  for (const [index, source] of (data?.excludedSources ?? []).entries()) {
    const path = `excludedSources[${index}]`;
    requireFields(source, ['id', 'title', 'url', 'providedAt', 'excludedAt', 'reason'], path, errors);
    if (!isHonestDate(source.providedAt) || !isHonestDate(source.excludedAt)) errors.push(`${path} dates must use supported precision or explain why unavailable.`);
    try {
      const normalized = normalizeSourceUrl(source.url);
      if (sourceUrls.has(normalized)) errors.push(`${path}.url duplicates ${sourceUrls.get(normalized)}.`);
      else sourceUrls.set(normalized, path);
    } catch { errors.push(`${path}.url is not a valid URL.`); }
  }

  return errors;
}

// ============================================================================
// Opt-In Reachability Receipt
// ============================================================================
// This check is the only part of the file that touches the network, and it runs
// only when the caller passes --reach. It reports link rot as a timestamped
// warning. It never changes a record conclusion and never fails the run,
// because an offline, blocked, or rate-limited host proves nothing about the
// source itself.
// ============================================================================

export const REACH_TIMEOUT_MS = 5000;

// 404 and 410 are the only answers that show the address itself is gone. Every
// other refusal describes the network or the host policy, not the source.
const GONE_STATUS_CODES = new Set([404, 410]);

export function collectCheckableUrls(data) {
  const entries = [];

  for (const [recordIndex, record] of (data?.records ?? []).entries()) {
    for (const [sourceIndex, source] of (record?.sources ?? []).entries()) {
      const path = `records[${recordIndex}].sources[${sourceIndex}]`;
      if (hasText(source?.url)) entries.push({ path: `${path}.url`, url: source.url.trim() });
      if (hasText(source?.archiveUrl)) entries.push({ path: `${path}.archiveUrl`, url: source.archiveUrl.trim() });
    }
  }

  // An excluded address is kept as provenance, not as a live claim. It is
  // carried in the list so the receipt can name it, and it is marked so the
  // network check leaves it alone.
  for (const [index, source] of (data?.excludedSources ?? []).entries()) {
    if (hasText(source?.url)) entries.push({ path: `excludedSources[${index}].url`, url: source.url.trim(), excluded: true });
  }

  return entries;
}

function safeNormalize(url) {
  try { return normalizeSourceUrl(url); } catch { return url; }
}

async function checkOneUrl(entry, fetchImpl, timeoutMs, checkedAt) {
  const receipt = { path: entry.path, url: entry.url, checkedAt, status: 0, finalUrl: entry.url };

  if (typeof fetchImpl !== 'function') {
    return { ...receipt, state: 'not_checked', detail: 'unavailable: this runtime exposes no fetch implementation.' };
  }

  let response = null;
  try {
    response = await fetchImpl(entry.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? `no answer within ${timeoutMs} ms`
      : (error?.message ?? String(error));
    return { ...receipt, state: 'not_checked', detail: `unavailable: ${reason}.` };
  }

  const status = Number(response?.status ?? 0);
  const finalUrl = hasText(response?.url) ? response.url : entry.url;

  if (status >= 200 && status < 400) {
    const redirected = Boolean(response?.redirected) || safeNormalize(finalUrl) !== safeNormalize(entry.url);
    return {
      ...receipt,
      status,
      finalUrl,
      state: redirected ? 'redirected' : 'available',
      detail: redirected ? `The host answered ${status} and moved the address to ${finalUrl}.` : `The host answered ${status}.`,
    };
  }

  if (GONE_STATUS_CODES.has(status)) {
    return { ...receipt, status, finalUrl, state: 'unreachable', detail: `The host answered HEAD with status ${status}.` };
  }

  return { ...receipt, status, finalUrl, state: 'not_checked', detail: `unavailable: the host answered HEAD with status ${status}, which describes the host and not the source.` };
}

/**
 * Builds a timestamped reachability receipt for every recorded address.
 * The result is a report only. It contains no validation error and it cannot
 * change the outcome of validateIdeaBoard.
 */
export async function checkSourceReachability(data, options = {}) {
  // An explicit `fetch: null` is how a caller says "this runtime has none".
  const fetchImpl = Object.hasOwn(options, 'fetch') ? options.fetch : globalThis.fetch;
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : REACH_TIMEOUT_MS;
  const checkedAt = options.now ?? new Date().toISOString();
  const receipts = [];

  // The addresses are checked one after another so a large board cannot look
  // like a burst of traffic to one host.
  for (const entry of collectCheckableUrls(data)) {
    if (entry.excluded) {
      receipts.push({
        path: entry.path,
        url: entry.url,
        checkedAt,
        status: 0,
        finalUrl: entry.url,
        state: 'excluded',
        detail: 'excluded: this address is retained as provenance, so it is not tested as a live link.',
      });
      continue;
    }
    receipts.push(await checkOneUrl(entry, fetchImpl, timeoutMs, checkedAt));
  }

  const counts = { available: 0, redirected: 0, unreachable: 0, not_checked: 0, excluded: 0 };
  for (const receipt of receipts) counts[receipt.state] += 1;

  return { checkedAt, timeoutMs, receipts, counts };
}

function formatReachabilityReport(report) {
  const { counts } = report;
  const lines = [
    `Idea Board reachability receipt ${report.checkedAt} (HEAD, ${report.timeoutMs} ms limit, ${report.receipts.length} address(es)): `
    + `${counts.available} available, ${counts.redirected} redirected, ${counts.unreachable} unreachable, ${counts.not_checked} not checked, ${counts.excluded} excluded.`,
  ];

  for (const receipt of report.receipts) {
    if (receipt.state === 'unreachable') lines.push(`- WARNING ${receipt.path} ${receipt.url} is unreachable. ${receipt.detail}`);
    else if (receipt.state === 'redirected') lines.push(`- NOTE ${receipt.path} ${receipt.url} redirects. ${receipt.detail}`);
    else if (receipt.state === 'not_checked') lines.push(`- NOTE ${receipt.path} ${receipt.url} was not checked. ${receipt.detail}`);
    else if (receipt.state === 'excluded') lines.push(`- NOTE ${receipt.path} ${receipt.url} is excluded, not checked. ${receipt.detail}`);
  }

  lines.push('This receipt is advisory. It does not change any record conclusion and it does not fail the run.');
  return lines.join('\n');
}

// ============================================================================
// Command-Line Entry
// ============================================================================
// Direct execution validates the canonical board and exits non-zero on any
// evidence-contract failure. Importing the module remains side-effect free.
// The optional --reach flag adds the network receipt described above.
// ============================================================================

export function parseCliOptions(argv) {
  const options = { reach: false, timeoutMs: REACH_TIMEOUT_MS };

  for (const argument of argv) {
    if (argument === '--reach') options.reach = true;
    else if (argument.startsWith('--reach-timeout=')) {
      const parsed = Number(argument.slice('--reach-timeout='.length));
      if (Number.isFinite(parsed) && parsed > 0) options.timeoutMs = parsed;
    }
  }

  return options;
}

async function run() {
  const options = parseCliOptions(process.argv.slice(2));
  const dataUrl = new URL('../../public/idea-board/records.json', import.meta.url);
  const data = JSON.parse(await readFile(dataUrl, 'utf8'));
  const errors = validateIdeaBoard(data);

  if (errors.length) {
    console.error(`Idea Board validation failed with ${errors.length} issue(s):\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.info(`Idea Board validation passed: ${data.records.length} record(s), ${data.excludedSources.length} excluded source(s).`);
  }

  if (options.reach) {
    const report = await checkSourceReachability(data, { timeoutMs: options.timeoutMs });
    console.info(formatReachabilityReport(report));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await run();

