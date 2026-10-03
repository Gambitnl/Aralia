/**
 * Regression fixtures for preservation-first scanner triage.
 * These tests use disposable directories and in-memory boards. They never create
 * Agora tasks or rewrite the repository's planning records.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  computeFindingId, loadGapRecords, classifyFinding, buildTaskProposals, compareReports,
} from './sweep-triage.mjs';

const baseFinding = (overrides = {}) => ({ file: 'src/systems/combat/actions.ts', line: 42, type: 'TODO', text: '// TODO: implement bonus', citedAgoraIds: [], citedGaps: [], ...overrides });
const task = (id, state = 'open', extra = {}) => ({ id, state, title: 'Preserve unfinished bonus behavior', refs: [], ...extra });
const gap = (id = 'GG-123', status = 'open', extra = {}) => ({ id, status, project: 'combat', file: 'docs/projects/combat/GAPS.md', reviewIssues: [], ...extra });
const classify = (item, options = {}) => classifyFinding(baseFinding(item), { tasks: [], agoraOnline: true, gapRecords: [], gapsAvailable: true, ...options });
const report = (findings = [], extra = {}) => ({ schemaVersion: 2, scope: { roots: ['src'], checks: ['routine'] }, findings, coverage: { complete: true }, ...extra });

function withRegistry(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-sweep-triage-'));
  t.after(() => {
    const absolute = path.resolve(root);
    assert.ok(absolute.startsWith(`${path.resolve(os.tmpdir())}${path.sep}aralia-sweep-triage-`));
    fs.rmSync(absolute, { recursive: true, force: true });
  });
  for (const [relative, text] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return root;
}
const table = rows => `| Gap ID | Status | Gap | Next action |\n|---|---|---|---|\n${rows.map(([id, status]) => `| ${id} | ${status} | Preserve capability | Inspect behavior |`).join('\n')}\n`;

test('finding identity survives tracking annotations, line endings, and path separators', () => {
  const original = computeFindingId('src/a.ts', 'TODO', '// TODO: implement bonus', 'bonus');
  for (const text of ['// TODO: implement bonus (agora-ab12)', '// TODO: implement bonus [GG-123]', '// TODO: implement bonus // task-1234', '// TODO: implement bonus tracked by agora-ab12.2', '// TODO: implement bonus (COMBAT-G001)', '// TODO: implement\r\n bonus']) {
    assert.equal(computeFindingId('src\\a.ts', 'TODO', text, 'bonus'), original, text);
  }
});

test('known project citations normalize while executable task-like strings stay meaningful', () => {
  assert.equal(computeFindingId('a.ts', 'MARKER', 'TODO: implement (G14)', '', ['G14']), computeFindingId('a.ts', 'MARKER', 'TODO: implement'));
  assert.notEqual(computeFindingId('a.ts', 'CONSOLE_STUB', 'console.warn("STUB: task-1")'), computeFindingId('a.ts', 'CONSOLE_STUB', 'console.warn("STUB: task-2")'));
});

test('finding identity uses full context and enclosing symbol', () => {
  const prefix = 'TODO: '.padEnd(130, 'a');
  assert.notEqual(computeFindingId('a.ts', 'TODO', `${prefix} first`), computeFindingId('a.ts', 'TODO', `${prefix} second`));
  assert.notEqual(computeFindingId('a.ts', 'TODO', 'TODO: implement', 'first'), computeFindingId('a.ts', 'TODO', 'TODO: implement', 'second'));
});

test('loader includes global and project records, including separated registry tables', t => {
  const root = withRegistry(t, {
    'docs/projects/GLOBAL_GAPS.md': `${table([['GG-1', 'open']])}\nHistory explains this boundary.\n\n${table([['GG-2', 'resolved']])}`,
    'docs/projects/combat/GAPS.md': table([['COMBAT-G001', 'design_decision_deferred']]),
  });
  const { records, errors } = loadGapRecords(root);
  assert.deepEqual(errors, []);
  assert.deepEqual(records.map(row => row.id).sort(), ['COMBAT-G001', 'GG-1', 'GG-2']);
  assert.equal(records.find(row => row.id === 'GG-1').project, 'global');
  assert.equal(records.find(row => row.id === 'COMBAT-G001').file, 'docs/projects/combat/GAPS.md');
});

test('loader preserves unknown and duplicate statuses as local review issues', t => {
  const root = withRegistry(t, {
    'docs/projects/GLOBAL_GAPS.md': table([['GG-1', 'open'], ['GG-2', 'deferred'], ['GG-3', 'duplicate']]),
    'docs/projects/combat/GAPS.md': table([['GG-1', 'open'], ['COMBAT-4', 'design_decision_deferred']]),
  });
  const { records, errors } = loadGapRecords(root);
  assert.deepEqual(errors, []);
  assert.equal(records.filter(row => row.id === 'GG-1').length, 2);
  assert.ok(records.filter(row => row.id === 'GG-1').every(row => row.reviewIssues.some(issue => issue.code === 'duplicate_gap_id')));
  assert.equal(records.find(row => row.id === 'GG-2').reviewIssues[0].code, 'unknown_gap_status');
  assert.equal(records.find(row => row.id === 'GG-3').reviewIssues[0].code, 'duplicate_gap_status');
  assert.deepEqual(records.find(row => row.id === 'COMBAT-4').reviewIssues, []);
});

test('registry loading reports missing files but only warns for narrative trackers without IDs', t => {
  const root = withRegistry(t, { 'docs/projects/combat/GAPS.md': '# Empty tracker' });
  const loaded = loadGapRecords(root);
  assert.equal(loaded.errors.length, 1);
  assert.equal(loaded.warnings.length, 1);
});

test('registry loading recovers matching bare continuations and exposes split-table warnings', t => {
  const root = withRegistry(t, {
    'docs/projects/GLOBAL_GAPS.md': `${table([['GG-1', 'open']])}\n| GG-2 | open | Preserve | Inspect |\n\nInterruption\n\n| GG-3 | open | Preserve | Inspect |`,
  });
  const loaded = loadGapRecords(root);
  assert.ok(loaded.warnings.some(entry => entry.warning.includes('split')));
  assert.equal(loaded.warnings.length, 2);
  assert.equal(loaded.errors.length, 0);
  assert.deepEqual(loaded.records.map(row => row.id), ['GG-1', 'GG-2', 'GG-3']);
});

test('resolved-summary tables do not create duplicate ownership records or coverage errors', t => {
  const root = withRegistry(t, {
    'docs/projects/GLOBAL_GAPS.md': `${table([['GG-1', 'resolved']])}\n## History\n\n| Gap ID | Resolved on | Evidence |\n|---|---|---|\n| GG-1 | yesterday | focused tests |`,
  });
  const loaded = loadGapRecords(root);
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.records.length, 1);
});

test('blocked tasks remain registered without duplicate task proposals', () => {
  const item = classify({ citedAgoraIds: ['agora-a1'] }, { tasks: [task('agora-a1', 'blocked')] });
  assert.equal(item.trackingStatus, 'blocked');
  assert.equal(item.disposition.action, 'keep_visible');
  assert.deepEqual(buildTaskProposals([item]), []);
});

test('open durable gaps preserve deferred work without an Agora task', () => {
  const item = classify({ citedGaps: ['GG-123'] }, { gapRecords: [gap()] });
  assert.equal(item.trackingStatus, 'recorded_deferred');
  assert.equal(item.disposition.action, 'record_deferred_intent');
  assert.deepEqual(buildTaskProposals([item]), []);
});

test('offline task lookup retains independent durable evidence and never declares tracking verified', () => {
  const options = { agoraOnline: false, gapRecords: [gap()] };
  const item = classify({ citedAgoraIds: ['agora-a1'], citedGaps: ['GG-123'] }, options);
  assert.equal(item.trackingStatus, 'unverified_offline');
  assert.equal(item.trackingEvidence.gaps[0].verification, 'verified');
  assert.equal(item.trackingEvidence.liveVerification, 'unavailable');
  const gapOnly = classify({ citedGaps: ['GG-123'] }, options);
  assert.equal(gapOnly.trackingStatus, 'recorded_deferred');
  assert.ok(gapOnly.trackingEvidence.issues.some(issue => issue.code === 'live_gap_assignment_unavailable'));
});

test('offline gap citations without valid durable records stay unverified', () => {
  const item = classify({ citedGaps: ['GG-42'] }, { agoraOnline: false });
  assert.equal(item.trackingStatus, 'unverified_offline');
  assert.ok(item.trackingEvidence.issues.some(issue => issue.code === 'gap_not_found'));
  assert.ok(item.trackingEvidence.issues.some(issue => issue.code === 'live_gap_assignment_unavailable'));
});

test('misaligned row columns retain the gap identity as review evidence', t => {
  const root = withRegistry(t, {
    'docs/projects/GLOBAL_GAPS.md': `${table([['GG-1', 'open']])}\n| GG-2 | open | unescaped | separator | Inspect |`,
  });
  const loaded = loadGapRecords(root);
  const record = loaded.records.find(row => row.id === 'GG-2');
  assert.ok(record.reviewIssues.some(issue => issue.code === 'gap_row_layout_review'));
  assert.equal(classify({ citedGaps: ['GG-2'] }, { gapRecords: loaded.records }).trackingStatus, 'reference_review');
});

test('all explicit citations are considered when one task is active', () => {
  const item = classify({ citedAgoraIds: ['agora-a1', 'agora-a2', 'agora-a3'], citedGaps: ['GG-123', 'GG-404'] }, {
    tasks: [task('agora-a1'), task('agora-a2', 'done')], gapRecords: [gap()],
  });
  assert.equal(item.trackingStatus, 'reference_review');
  assert.equal(item.trackingEvidence.tasks.length, 3);
  assert.equal(item.trackingEvidence.gaps.length, 2);
  assert.deepEqual(new Set(item.trackingEvidence.issues.map(issue => issue.code)), new Set(['completed_task_finding_remains', 'task_not_found', 'gap_not_found']));
});

test('completed work prompts evidence reconciliation instead of deleting stale comments', () => {
  for (const tasks of [[task('agora-a1', 'done')], [task('agora-a1', 'done'), task('agora-a2')]]) {
    const item = classify({ citedAgoraIds: tasks.map(entry => entry.id) }, { tasks });
    assert.equal(item.trackingStatus, 'completion_review');
    assert.equal(item.disposition.action, 'reconcile_completion');
  }
});

test('closed durable gaps and completed gap assignments need completion review', () => {
  assert.equal(classify({ citedGaps: ['GG-123'] }, { gapRecords: [gap('GG-123', 'routed')] }).trackingStatus, 'completion_review');
  assert.equal(classify({ citedGaps: ['GG-123'] }, { gapRecords: [gap()], tasks: [task('agora-a1', 'done', { body: 'GG-123' })] }).trackingStatus, 'completion_review');
});

test('unknown and duplicate gap records do not silently become deferred or completed', () => {
  assert.equal(classify({ citedGaps: ['GG-123'] }, { gapRecords: [gap('GG-123', 'deferred')] }).trackingStatus, 'reference_review');
  assert.equal(classify({ citedGaps: ['GG-123'] }, { gapRecords: [gap(), gap()] }).trackingStatus, 'reference_review');
});

test('missing and unavailable references have distinct evidence', () => {
  assert.equal(classify({ citedAgoraIds: ['task-404'] }).trackingStatus, 'task_not_found');
  assert.equal(classify({ citedGaps: ['GG-404'] }).trackingStatus, 'unmapped_gap');
  const item = classify({ citedGaps: ['GG-404'] }, { gapsAvailable: false });
  assert.equal(item.trackingStatus, 'reference_review');
  assert.equal(item.trackingEvidence.gaps[0].verification, 'unavailable');
});

test('gap assignments require a real durable record and exact gap identity', () => {
  const options = { tasks: [task('agora-a1', 'open', { body: 'Finish GG-1234' }), task('agora-a2', 'blocked', { refs: ['GG-123'] })] };
  assert.equal(classify({ citedGaps: ['GG-123'] }, options).trackingStatus, 'unmapped_gap');
  const result = classify({ citedGaps: ['GG-123'] }, { ...options, gapRecords: [gap()] });
  assert.equal(result.trackingStatus, 'tracked_via_gap');
  assert.deepEqual(result.gapTasks.map(entry => entry.id), ['agora-a2']);
});

test('task candidates prioritize stable IDs, but file matches never claim ownership', () => {
  const item = baseFinding();
  const id = computeFindingId(item.file, item.type, item.text);
  const result = classify(item, { tasks: [task('agora-a1', 'open', { refs: [`${item.file}:42`] }), task('agora-a2', 'done', { body: `Finding IDs: ${id}` }), task('agora-a3', 'open', { refs: [`${item.file}.other`] })] });
  assert.equal(result.trackingStatus, 'unlisted');
  assert.equal(result.disposition.action, 'link_existing_work');
  assert.deepEqual(result.relatedTasks.map(entry => entry.id), ['agora-a2', 'agora-a1']);
});

test('proposals group conservatively, preserve IDs and evidence, and require review', () => {
  const first = classify({ file: 'src/systems/combat/a.ts' });
  const second = classify({ file: 'src/systems/combat/b.ts', text: '// TODO: retain missing terrain rules' });
  const third = classify({ file: 'src/components/Inventory/a.tsx' });
  const proposals = buildTaskProposals([first, third, second]);
  assert.deepEqual(proposals, buildTaskProposals([second, first, third]));
  assert.equal(proposals.length, 2);
  const combat = proposals.find(item => item.area === 'src/systems/combat');
  assert.equal(combat.findingIds.length, 2);
  assert.equal(combat.evidence.length, 2);
  assert.equal(combat.requiresReview, true);
  assert.match(combat.title, /^Investigate/);
  assert.match(combat.preservation, /Do not delete/);
  assert.match(combat.acceptanceCriteria.at(-1), /proof of completion/);
});

test('proposal grouping uses a unique durable project before a code directory', () => {
  const item = classify({ citedGaps: ['GG-123'] }, { gapRecords: [gap('GG-123', 'resolved')] });
  const [proposal] = buildTaskProposals([item]);
  assert.equal(proposal.area, 'project:combat');
  assert.match(proposal.nextAction, /Reconcile/);
});

test('comparison separates new, changed, seen, and no-longer-detected without resolving work', () => {
  const seen = classify({ text: '// TODO: first' });
  const changed = classify({ text: '// TODO: second' });
  const removed = classify({ text: '// TODO: third' });
  const added = classify({ text: '// TODO: fourth' });
  const afterChanged = classify({ ...changed, citedAgoraIds: ['agora-a1'] }, { tasks: [task('agora-a1')] });
  const result = compareReports(report([seen, changed, removed]), report([{ ...seen, line: 400 }, afterChanged, added]));
  assert.deepEqual(result.new, [added]);
  assert.deepEqual(result.changed.map(item => item.findingId), [changed.findingId]);
  assert.deepEqual(result.previouslySeen.map(item => item.findingId), [seen.findingId]);
  assert.deepEqual(result.noLongerDetected, [removed]);
  assert.equal(result.noLongerDetectedMeansResolved, false);
});

test('comparison refuses incompatible schemas, scopes, incomplete scans, and ambiguous IDs', () => {
  const item = classify({});
  assert.throws(() => compareReports(report(), report([], { schemaVersion: 1 })), /schema/);
  assert.throws(() => compareReports(report(), report([], { scope: { roots: ['tools'], checks: ['routine'] } })), /scopes differ/);
  assert.throws(() => compareReports(report(), report([], { coverage: { complete: false } })), /incomplete/);
  assert.throws(() => compareReports(report([], { coverage: { complete: false } }), report()), /incomplete/);
  assert.throws(() => compareReports(report(), report([item, item])), /duplicate/);
  assert.throws(() => compareReports(report(), report([{}])), /without an ID/);
});

test('comparison refuses failed selected detectors even when source coverage claims complete', () => {
  const previous = report([], { scope: { roots: ['src'], checks: ['leaks'] }, subsystems: { leaks: { status: 'passed' } } });
  for (const status of ['error', 'unavailable', 'skipped']) {
    const current = { ...previous, subsystems: { leaks: { status } } };
    assert.throws(() => compareReports(previous, current), /selected subsystem leaks/);
  }
  const trackingOnly = { ...previous, subsystems: { ...previous.subsystems, agora_tasks: { status: 'unavailable' } } };
  assert.deepEqual(compareReports(previous, trackingOnly).noLongerDetected, []);
  const observed = {...previous, subsystems:{leaks:{status:'has_findings'}}};
  assert.deepEqual(compareReports(observed,previous).noLongerDetected,[]);
});

test('comparison normalizes scope order but preserves scan-policy changes', () => {
  const first = report([], { scope: { roots: ['src', 'tools'], checks: ['routine', 'types'], policy: 'preserve' } });
  const second = report([], { scope: { roots: ['tools', 'src'], checks: ['types', 'routine'], policy: 'preserve' } });
  assert.deepEqual(compareReports(first, second).new, []);
  assert.throws(() => compareReports(first, { ...second, scope: { ...second.scope, policy: 'changed' } }), /scopes differ/);
});
