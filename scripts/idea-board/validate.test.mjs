/**
 * This file proves the Idea Board's institutional-memory guarantees.
 *
 * It exercises a complete isolated record, deliberate failure cases, stable
 * routes, historical links, and the boundary that keeps research data out of
 * production source. The fixture never enters records.json, so users cannot
 * mistake test prose for an assessed external idea.
 *
 * Called by: Node's built-in test runner
 * Depends on: validate.mjs, public/idea-board/lib.mjs, and Node standard APIs
 */

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { guideUrl, lexiconUrl, parseIdeaRoute, promptsUrl, recordUrl, revisionUrl } from '../../public/idea-board/lib.mjs';
import {
  checkSourceReachability,
  collectCheckableUrls,
  parseCliOptions,
  validateIdeaBoard,
} from './validate.mjs';

// ============================================================================
// Complete Research Fixture
// ============================================================================
// This compact fictional fixture includes every required evidence category. It
// tests shape and honesty rules without asserting anything about a real source.
// ============================================================================

function completeFixture() {
  return {
    schemaVersion: 1,
    boardTitle: 'Test board',
    generatedAt: '2026-08-31T22:17:44+02:00',
    localProject: {
      name: 'Aralia',
      committedBaseline: { commit: 'dff21bbc292bc508a686979180373c3bbfa86953', committedAt: '2026-08-26T02:00:03+02:00' },
      workspaceInspection: { inspectedAt: '2026-08-31T22:17:44+02:00', dirty: true, note: 'Uncommitted fixture work was present.' },
    },
    excludedSources: [],
    records: [{
      id: 'IB-0001',
      title: 'Fictional bounded technique',
      summary: 'A fixture that exercises the complete research contract.',
      problem: 'Prove that evidence cannot be replaced by enthusiasm.',
      tags: ['fixture', 'boundary'],
      kind: 'partial technique',
      relatedIdeaIds: [],
      sources: [{
        id: 'SRC-0001', title: 'Primary fixture', url: 'https://example.com/technique', type: 'official documentation', role: 'primary',
        publishedAt: 'unavailable: the fixture source exposes no publication date', latestRevisionInspected: '2026-08-30',
        licence: 'MIT', provenance: 'Fictional primary source used by an isolated test.', archiveUrl: '',
        claims: ['The source claims the technique solves the named fixture problem.'],
        demonstrates: ['The source demonstrates one bounded input and output.'],
        implementationContains: ['The implementation contains a callable transformation.'],
      }],
      revisions: [{
        id: 'IB-0001-R001', previousRevisionId: '', assessedAt: '2026-08-31T22:17:44+02:00', sourceProvidedAt: '2026-08-31',
        status: 'promising', confidence: 'medium', changeSummary: 'Initial fixture assessment.',
        facts: ['The source exposes one implementation.'], inferences: ['The boundary may fit Aralia.'],
        unknowns: ['Runtime performance is unmeasured.'], recommendations: ['Test only behind the named boundary.'],
        projectBaseline: { commit: 'dff21bbc292bc508a686979180373c3bbfa86953', committedAt: '2026-08-26T02:00:03+02:00', inspectedAt: '2026-08-31T22:17:44+02:00', dirty: true, dirtyNote: 'The fixture acknowledges uncommitted work.' },
        technique: {
          requiredInput: ['One fixture input'], processingSteps: ['Transform it once'], producedOutput: ['One fixture output'],
          dependencies: ['Pinned fixture dependency'], runtimeRequirements: ['Standard JavaScript'], manualWork: ['Review output'],
          componentTypes: ['Deterministic processing'], externalRequirements: ['No account'], licenceConstraints: ['Retain MIT notice'],
          knownLimitations: ['Unmeasured at scale'], doesNotSolve: ['Production promotion'],
        },
        comparisons: [{
          dimension: 'Architecture', externalApproach: 'Standalone transformation.', projectApproach: 'Existing project-owned pipeline.',
          meaningfulDifference: 'The external method does not own project state.', practicalConsequence: 'It must remain behind an adapter.',
          evidence: 'Fixture source and named project baseline.', uncertainty: 'Integration cost is not measured.',
        }],
        fit: {
          couldHelp: ['Test one transformation'], wouldNotHelp: ['Replace the project pipeline'], complements: ['Existing pipeline'],
          mustNotReplace: ['Canonical project state'], architecturalBoundary: ['Optional sidecar adapter'], dependenciesIntroduced: ['One pinned fixture package'],
          blockers: ['No performance evidence'], risks: ['Dependency drift'], ownership: ['Research owner and runtime owner'],
          migrationRollback: ['Delete isolated output and remove adapter'], conclusion: 'Test as an optional sidecar',
        },
        experiment: {
          question: 'Does the fixture improve the named measurement?', exactInput: 'One pinned input', pinnedRevisions: ['source@abc1234', 'tool@1.0.0'],
          expectedOutput: 'One isolated artifact', projectBaseline: 'dff21bbc292bc508a686979180373c3bbfa86953', measurements: ['Runtime milliseconds', 'Output correctness'],
          limit: '30 minutes and no paid services', acceptanceCriteria: ['Correct output under 20 ms'], rejectionCriteria: ['Any project-state mutation or runtime over 20 ms'],
          isolationBoundary: 'Temporary ignored directory', cleanup: 'Delete the temporary directory and remove no production files', result: '', resultAt: '',
        },
      }],
    }],
  };
}

// ============================================================================
// Contract Success And Failure Proof
// ============================================================================
// Each failure test names a user-facing guarantee instead of merely checking a
// parser implementation detail.
// ============================================================================

test('a complete dated assessment satisfies every evidence category', () => {
  assert.deepEqual(validateIdeaBoard(completeFixture()), []);
});

test('stable record identities and source URLs cannot be duplicated', () => {
  const data = completeFixture();
  const duplicate = structuredClone(data.records[0]);
  duplicate.revisions[0].id = 'IB-0001-R002';
  duplicate.revisions[0].previousRevisionId = 'IB-0001-R001';
  data.records.push(duplicate);
  const errors = validateIdeaBoard(data).join('\n');
  assert.match(errors, /id duplicates another record/);
  assert.match(errors, /url duplicates/);
});

test('unsupported date precision and malformed commit hashes are rejected', () => {
  const data = completeFixture();
  data.records[0].sources[0].publishedAt = 'sometime last summer';
  data.records[0].revisions[0].projectBaseline.commit = 'latest';
  const errors = validateIdeaBoard(data).join('\n');
  assert.match(errors, /publishedAt must use supported precision/);
  assert.match(errors, /commit must be a hexadecimal Git hash/);
});

test('facts, inferences, unknowns, recommendations, and both comparison sides are mandatory', () => {
  const data = completeFixture();
  data.records[0].revisions[0].unknowns = [];
  data.records[0].revisions[0].comparisons[0].projectApproach = '';
  const errors = validateIdeaBoard(data).join('\n');
  assert.match(errors, /unknowns must be a non-empty list/);
  assert.match(errors, /projectApproach must contain evidence-bearing text/);
});

test('fit assessments and experiments require boundaries plus measurable pass and reject gates', () => {
  const data = completeFixture();
  data.records[0].revisions[0].fit.blockers = [];
  data.records[0].revisions[0].experiment.rejectionCriteria = [];
  const errors = validateIdeaBoard(data).join('\n');
  assert.match(errors, /fit.blockers must contain evidence-bearing text/);
  assert.match(errors, /experiment.rejectionCriteria must contain evidence-bearing text/);
});

test('later assessments link to preserved history instead of rewriting it', () => {
  const data = completeFixture();
  const next = structuredClone(data.records[0].revisions[0]);
  next.id = 'IB-0001-R002';
  next.assessedAt = '2026-09-01';
  next.previousRevisionId = '';
  data.records[0].revisions.push(next);
  assert.match(validateIdeaBoard(data).join('\n'), /must link to the immediately preceding historical revision/);
});

// ============================================================================
// Archive Governance Proof (IB-G2)
// ============================================================================
// The board links a snapshot that a third party made; it never makes one. These
// checks cover only the mechanical part of the RUNBOOK archive rule.
// ============================================================================

test('an archive link must point at an approved public archive service', () => {
  const data = completeFixture();
  data.records[0].sources[0].archiveUrl = 'https://example.com/private-mirror/technique';
  data.records[0].sources[0].archivedAt = '2026-09-20';
  assert.match(validateIdeaBoard(data).join('\n'), /is not an approved archive service/);
});

test('an archive link must record the date on which the snapshot was inspected', () => {
  const data = completeFixture();
  data.records[0].sources[0].archiveUrl = 'https://web.archive.org/web/20260920/https://example.com/technique';
  const errors = validateIdeaBoard(data).join('\n');
  assert.match(errors, /archivedAt must record when the snapshot was inspected/);
  assert.doesNotMatch(errors, /is not an approved archive service/);
});

test('an approved and dated archive link satisfies the archive contract', () => {
  const data = completeFixture();
  data.records[0].sources[0].archiveUrl = 'https://web.archive.org/web/20260920/https://example.com/technique';
  data.records[0].sources[0].archivedAt = '2026-09-20';
  assert.deepEqual(validateIdeaBoard(data), []);
});

test('a snapshot date without a snapshot link is rejected as unsupported evidence', () => {
  const data = completeFixture();
  data.records[0].sources[0].archivedAt = '2026-09-20';
  assert.match(validateIdeaBoard(data).join('\n'), /archivedAt cannot record a snapshot date when/);
});

// ============================================================================
// Opt-In Reachability Proof (IB-G1)
// ============================================================================
// The receipt is advisory. An available, redirected, missing, offline, or
// rate-limited address must each produce an honest line, and none of them may
// add a validation error or change a record conclusion.
// ============================================================================

function reachabilityFixture() {
  return {
    records: [{
      sources: [
        { url: 'https://example.com/available', archiveUrl: 'https://web.archive.org/web/20260920/https://example.com/available' },
        { url: 'https://example.com/moved' },
        { url: 'https://example.com/gone' },
        { url: 'https://example.com/offline' },
        { url: 'https://example.com/rate-limited' },
      ],
    }],
    excludedSources: [{ url: 'https://example.com/excluded-moved' }],
  };
}

function mockFetch(calls) {
  return async (url, init) => {
    calls.push({ url, method: init?.method, redirect: init?.redirect });
    if (url.endsWith('/offline')) throw Object.assign(new Error('fetch failed'), { name: 'TypeError' });
    if (url.endsWith('/gone')) return { status: 404, redirected: false, url };
    if (url.endsWith('/rate-limited')) return { status: 429, redirected: false, url };
    if (url.endsWith('/moved')) return { status: 200, redirected: true, url: 'https://example.com/moved-permanently' };
    if (url.endsWith('/excluded-moved')) return { status: 200, redirected: true, url: 'https://example.com/excluded-destination' };
    return { status: 200, redirected: false, url };
  };
}

test('every recorded address, including archive and excluded links, is named in the receipt', () => {
  const entries = collectCheckableUrls(reachabilityFixture());
  assert.deepEqual(entries.map((entry) => entry.path), [
    'records[0].sources[0].url',
    'records[0].sources[0].archiveUrl',
    'records[0].sources[1].url',
    'records[0].sources[2].url',
    'records[0].sources[3].url',
    'records[0].sources[4].url',
    'excludedSources[0].url',
  ]);
  assert.equal(entries.at(-1).excluded, true, 'an excluded address must carry its own marker.');
  assert.ok(entries.slice(0, -1).every((entry) => entry.excluded === undefined), 'a live address must carry no excluded marker.');
});

test('available, redirected, and unavailable addresses each produce an honest timestamped receipt', async () => {
  const calls = [];
  const report = await checkSourceReachability(reachabilityFixture(), {
    fetch: mockFetch(calls),
    timeoutMs: 50,
    now: '2026-09-20T12:00:00Z',
  });

  assert.equal(report.checkedAt, '2026-09-20T12:00:00Z');
  assert.ok(calls.every((call) => call.method === 'HEAD'), 'the check must never download a source body.');

  const byPath = new Map(report.receipts.map((receipt) => [receipt.path, receipt]));
  assert.equal(byPath.get('records[0].sources[0].url').state, 'available');
  assert.equal(byPath.get('records[0].sources[0].archiveUrl').state, 'available');
  assert.equal(byPath.get('records[0].sources[1].url').state, 'redirected');
  assert.equal(byPath.get('records[0].sources[1].url').finalUrl, 'https://example.com/moved-permanently');
  assert.equal(byPath.get('records[0].sources[2].url').state, 'unreachable');
  assert.equal(byPath.get('excludedSources[0].url').state, 'excluded');
  assert.ok(report.receipts.every((receipt) => receipt.checkedAt === '2026-09-20T12:00:00Z'));
  assert.deepEqual(report.counts, { available: 2, redirected: 1, unreachable: 1, not_checked: 2, excluded: 1 });
});

test('an excluded address that redirects is its own bucket, never link rot', async () => {
  const calls = [];
  const report = await checkSourceReachability(reachabilityFixture(), {
    fetch: mockFetch(calls),
    timeoutMs: 50,
    now: '2026-09-20T12:00:00Z',
  });

  assert.ok(
    calls.every((call) => !call.url.includes('/excluded-moved')),
    'an excluded address is provenance, so the check must never send it a request.',
  );

  const receipt = report.receipts.find((entry) => entry.path === 'excludedSources[0].url');
  assert.equal(receipt.state, 'excluded');
  assert.equal(receipt.status, 0);
  assert.equal(receipt.finalUrl, receipt.url);
  assert.match(receipt.detail, /retained as provenance/);
  assert.equal(report.counts.excluded, 1);
  assert.equal(report.counts.redirected, 1, 'only the live moved address counts as redirected.');
});

test('an offline host and a rate-limited host are reported as not checked, never as link rot', async () => {
  const report = await checkSourceReachability(reachabilityFixture(), {
    fetch: mockFetch([]),
    timeoutMs: 50,
    now: '2026-09-20T12:00:00Z',
  });

  const offline = report.receipts.find((receipt) => receipt.url.endsWith('/offline'));
  const limited = report.receipts.find((receipt) => receipt.url.endsWith('/rate-limited'));
  assert.equal(offline.state, 'not_checked');
  assert.match(offline.detail, /^unavailable: /);
  assert.equal(limited.state, 'not_checked');
  assert.match(limited.detail, /status 429/);
});

test('a runtime without fetch reports not checked instead of failing the board', async () => {
  const report = await checkSourceReachability(reachabilityFixture(), { fetch: null, timeoutMs: 50, now: '2026-09-20T12:00:00Z' });
  assert.equal(report.counts.not_checked, report.receipts.length - report.counts.excluded);
  assert.equal(report.counts.excluded, 1);
  assert.match(report.receipts[0].detail, /exposes no fetch implementation/);
});

test('the reachability check is opt-in and adds no error to the deterministic contract', () => {
  assert.deepEqual(parseCliOptions([]), { reach: false, timeoutMs: 5000 });
  assert.deepEqual(parseCliOptions(['--reach']), { reach: true, timeoutMs: 5000 });
  assert.deepEqual(parseCliOptions(['--reach', '--reach-timeout=250']), { reach: true, timeoutMs: 250 });
  assert.deepEqual(parseCliOptions(['--reach', '--reach-timeout=nonsense']), { reach: true, timeoutMs: 5000 });
  assert.deepEqual(validateIdeaBoard(completeFixture()), []);
});

// ============================================================================
// Stable URL Proof
// ============================================================================
// Static hash links must resolve identically without a server-side route table.
// ============================================================================

test('guide, record, and historical revision URLs resolve to their exact identities', () => {
  assert.deepEqual(parseIdeaRoute(guideUrl()), { view: 'guide' });
  assert.deepEqual(parseIdeaRoute(recordUrl('IB-0042')), { view: 'record', recordId: 'IB-0042' });
  assert.deepEqual(parseIdeaRoute(revisionUrl('IB-0042', 'IB-0042-R003')), { view: 'revision', recordId: 'IB-0042', revisionId: 'IB-0042-R003' });
  assert.deepEqual(parseIdeaRoute('#/unknown'), { view: 'index' });
  assert.deepEqual(parseIdeaRoute(lexiconUrl()), { view: 'lexicon', term: '' });
  assert.deepEqual(parseIdeaRoute(lexiconUrl('promising')), { view: 'lexicon', term: 'promising' });
});

test('cold-agent guide names every intake outcome, safety boundary, and required check', async () => {
  const appPath = fileURLToPath(new URL('../../public/idea-board/app.mjs', import.meta.url));
  const app = await readFile(appPath, 'utf8');

  for (const requiredText of [
    'dated institutional memory',
    'New record',
    'Supporting evidence',
    'Deliberate exclusion',
    'documenting an idea does not authorize',
    'node scripts/idea-board/validate.mjs',
    'node --test scripts/idea-board/validate.test.mjs',
    'cmd /c npm run sync-check',
  ]) assert.match(app, new RegExp(requiredText));
});

// ============================================================================
// Presentation Preference Proof
// ============================================================================
// Dark mode is a local display preference only. These checks keep its early
// paint, persistent control, and complete palette connected without coupling it
// to the research dataset or production application source.
// ============================================================================

test('dark mode is applied before paint and remains a presentation-only persisted choice', async () => {
  const publicRoot = fileURLToPath(new URL('../../public/idea-board/', import.meta.url));
  const [page, app, styles] = await Promise.all([
    readFile(join(publicRoot, 'index.html'), 'utf8'),
    readFile(join(publicRoot, 'app.mjs'), 'utf8'),
    readFile(join(publicRoot, 'styles.css'), 'utf8'),
  ]);

  assert.match(page, /prefers-color-scheme: dark/);
  assert.match(page, /document\.documentElement\.dataset\.theme/);
  assert.match(app, /aralia-idea-board-theme/);
  assert.match(app, /aria-pressed/);
  assert.match(styles, /:root\[data-theme="dark"\]/);
});

// ============================================================================
// Production Boundary Proof
// ============================================================================
// The record store may be read by its standalone dashboard only. Any reference
// from src/ would couple research data to gameplay or production runtime state.
// ============================================================================

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? listFiles(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

test('production source does not import or read the Idea Board dataset', async () => {
  // Convert the module-relative URL once so recursive path joins stay native on Windows.
  const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url));
  const sourceFiles = await listFiles(sourceRoot);
  const references = [];

  // Only text-like source files matter; binary assets cannot form an import edge.
  for (const file of sourceFiles.filter((path) => /\.(?:ts|tsx|js|jsx|mjs|css|html)$/.test(path))) {
    const text = await readFile(file, 'utf8');
    if (/idea-board|idea_board|records\.json/i.test(text)) references.push(file);
  }
  assert.deepEqual(references, []);
});

// ============================================================================
// Prompt Library Proof
// ============================================================================
// Curated prompts must fill cleanly, point at the runbook, and never collide;
// personal prompt imports must validate before anything is saved.
// ============================================================================

test('prompt routes, placeholders, and personal prompt imports behave predictably', async () => {
  const prompts = await import('../../public/idea-board/prompts.mjs');
  assert.deepEqual(parseIdeaRoute(promptsUrl()), { view: 'prompts', prompt: '' });
  assert.deepEqual(parseIdeaRoute(promptsUrl('reassess-record', 'IB-0013')), { view: 'prompts', prompt: 'reassess-record' });

  const ids = prompts.BOARD_PROMPTS.map((prompt) => prompt.id);
  assert.equal(new Set(ids).size, ids.length, 'curated prompt IDs are unique');
  for (const prompt of prompts.BOARD_PROMPTS) assert.ok(prompts.PROMPT_GROUPS.includes(prompt.group), `${prompt.id} has a known group`);
  for (const id of prompts.RECORD_PROMPT_IDS) assert.ok(ids.includes(id), `${id} exists`);
  assert.match(prompts.BOARD_PROMPTS.find((prompt) => prompt.id === 'intake-source').body, /docs\/projects\/idea-board\/RUNBOOK\.md/);

  assert.deepEqual(prompts.promptVariables('Add {{SOURCE_URL}} to {{RECORD_ID}} and {{RECORD_ID}}'), ['SOURCE_URL', 'RECORD_ID']);
  assert.equal(prompts.fillPrompt('See {{RECORD_ID}} and {{REASON}}', { RECORD_ID: ' IB-0001 ', REASON: '  ' }), 'See IB-0001 and {{REASON}}');

  const storage = new Map();
  const store = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  assert.deepEqual(prompts.readPrompts(store), prompts.emptyPrompts());
  const { collection, added } = prompts.mergePrompts(prompts.emptyPrompts(), { prompts: [{ id: 'intake-source', title: 'Mine', body: 'Hello {{NAME}}' }] });
  assert.equal(added, 1);
  assert.equal(collection.prompts[0].id, 'intake-source-1', 'an import cannot shadow a curated prompt ID');
  prompts.savePrompts(store, collection);
  prompts.savePrompts(store, collection);
  assert.ok(storage.has(prompts.PROMPTS_BACKUP_KEY), 'a save keeps the previous copy');
  assert.equal(prompts.mergePrompts(collection, JSON.stringify(collection)).skipped, 1, 'identical imports are skipped');
  assert.throws(() => prompts.parsePromptsPayload({ prompts: [{ id: 'x', title: '', body: 'b' }] }), /Nothing was imported/);
});
