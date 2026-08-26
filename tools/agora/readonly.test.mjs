// tools/agora/readonly.test.mjs
// The read-only surface (phase 4, D-V and D-U).
//   node --test "tools/agora/*.test.mjs"
//
// WHAT THESE PROTECT.
//
// Two promises, and a promise nobody checks is a comment.
//   1. THE WRITE PATH IS ABSENT, not hidden. Checked by reading the source of
//      both modules, so adding one `writeFileSync` fails the suite.
//   2. UNKNOWN IS VISIBLE. An item without enough history must never be
//      reported as quiet or as fine. That silent third state is the whole
//      reason the aging view exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  openReadOnly, ageOf, assertNoWritePath, readSnapshot,
  AGING_MIN_GAPS, AGING_QUIET_MULTIPLE,
} from './readonly-store.mjs';
import { createReadOnlyServer, READONLY_PORT } from './readonly-server.mjs';

const DAY = 86400000;

function board(snapshot) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-ro-'));
  fs.writeFileSync(path.join(dir, 'snapshot.json'), JSON.stringify(snapshot), 'utf8');
  return dir;
}

function history(...daysAgo) {
  const now = Date.UTC(2026, 8, 8);
  return daysAgo.map((d) => ({ at: now - d * DAY, action: 'state' }));
}

test('the write path is ABSENT from both modules, not merely unused', () => {
  const check = assertNoWritePath();
  assert.equal(check.ok, true,
    'a write call reached the read-only surface: ' + JSON.stringify(check.found));
});

test('the check that proves it actually fails when a write appears', () => {
  // A guard nobody has seen fail is a guard nobody knows works.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-guard-'));
  const bad = path.join(dir, 'pretend-readonly.mjs');
  fs.writeFileSync(bad, 'import fs from "node:fs";\nfs.writeFileSync("x", "y");\n', 'utf8');
  const check = assertNoWritePath([bad]);
  assert.equal(check.ok, false);
  assert.equal(check.found[0].term, 'writeFileSync');
});

test('a prose mention of createStore does not trip the guard', () => {
  // The reader EXPLAINS why it does not use createStore. If the check read
  // comments it would fail on its own documentation, and would then be
  // weakened rather than obeyed.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-prose-'));
  const file = path.join(dir, 'commented.mjs');
  fs.writeFileSync(file, '// This never calls createStore, and holds no emit( call.\nexport const a = 1;\n', 'utf8');
  assert.equal(assertNoWritePath([file]).ok, true);
});

test('too little history reads as unknown, never as quiet and never as fine', () => {
  const now = Date.UTC(2026, 8, 8);
  // Three stamps make two gaps: one short of the floor.
  const verdict = ageOf(history(400, 380, 370), now);
  assert.equal(verdict.state, 'unknown');
  assert.match(verdict.why, /not enough history yet/);
  assert.equal(verdict.gaps, AGING_MIN_GAPS - 1);
  // It has been silent for over a year, and it STILL must not say quiet.
  assert.ok(verdict.silenceDays > 300, 'the silence is reported even when unjudged');
  assert.equal(verdict.typicalDays, null, 'no rhythm can be claimed from too few gaps');
});

test('an item is judged against its OWN rhythm, not a fixed number of days', () => {
  const now = Date.UTC(2026, 8, 8);

  // A slow item: touched about every 30 days, last touched 20 days ago. It is
  // ACTIVE, even though 20 days would look abandoned by any fixed threshold.
  const slow = ageOf(history(140, 110, 80, 50, 20), now);
  assert.equal(slow.state, 'active', 'a slow rhythm is not the same as a stalled item');
  assert.equal(slow.typicalDays, 30);

  // A fast item: touched daily, silent for 9 days. It is QUIET, though 9 days
  // would pass any month-long threshold unnoticed.
  const fast = ageOf(history(13, 12, 11, 10, 9), now);
  assert.equal(fast.state, 'quiet');
  assert.ok(fast.silenceDays > fast.typicalDays * AGING_QUIET_MULTIPLE);
});

test('a bulk sweep does not manufacture a rhythm out of one instant', () => {
  // Found on the live record 2026-09-08. A migration wrote one history line
  // onto every task at the same millisecond. Counting those as gaps gave a
  // typical gap of zero, so an item touched two hours ago read as QUIET —
  // and the quiet list, which exists to surface what nothing else does,
  // filled up with things that were not quiet at all.
  const now = Date.UTC(2026, 8, 8);
  const sameInstant = now - 2 * DAY;
  const swept = [
    { at: sameInstant, action: 'membership' },
    { at: sameInstant, action: 'membership' },
    { at: sameInstant, action: 'membership' },
    { at: sameInstant, action: 'membership' },
  ];
  const verdict = ageOf(swept, now);
  assert.equal(verdict.state, 'unknown', 'one instant is not a rhythm');
  assert.equal(verdict.gaps, 0);
  assert.notEqual(verdict.typicalDays, 0, 'a zero typical gap must never be reported as a rhythm');

  // A real rhythm that happens to include one duplicated stamp still counts.
  const real = ageOf([
    { at: now - 40 * DAY }, { at: now - 30 * DAY }, { at: now - 30 * DAY },
    { at: now - 20 * DAY }, { at: now - 10 * DAY },
  ], now);
  assert.equal(real.gaps, AGING_MIN_GAPS, 'the duplicate collapses, the real gaps remain');
  assert.equal(real.state, 'active');
});

test('the aging view groups every item and hides none of them', () => {
  const dir = board({
    lastSeq: 10,
    campaigns: [{ id: 'c1', name: 'one', state: 'active', history: history(9, 8, 7, 6) }],
    tasks: [
      { id: 't1', title: 'fresh', state: 'open', history: history(4, 3, 2, 1) },
      { id: 't2', title: 'stalled', state: 'open', history: history(90, 89, 88, 87) },
      { id: 't3', title: 'new', state: 'open', history: history(2) },
    ],
    seats: [],
  });
  const view = openReadOnly({ dir }).aging();
  assert.equal(view.counts.total, 4, 'every campaign and task appears exactly once');
  assert.equal(
    view.counts.active + view.counts.quiet + view.counts.unknown,
    view.counts.total,
    'no item falls outside the three states',
  );
  assert.equal(view.groups.unknown.length, 1);
  assert.equal(view.groups.unknown[0].id, 't3');
  assert.ok(view.groups.quiet.some((r) => r.id === 't2'));
});

test('WF-G168: the journal tail is applied in memory, and an event that cannot be applied is named', () => {
  const dir = board({ lastSeq: 100, campaigns: [], tasks: [], seats: [], aliases: [] });
  const task = { id: 't9', title: 'newer than the snapshot', state: 'open', history: [{ at: 5, action: 'created', state: 'open' }] };
  fs.writeFileSync(path.join(dir, 'journal.jsonl'), [
    // At the snapshot seq: already folded in, so it is neither applied nor counted.
    JSON.stringify({ seq: 100, type: 'task.create', payload: { task: { id: 'old', title: 'x', state: 'open', history: [] } }, ts: 1 }),
    // Newer, and valid: it must appear.
    JSON.stringify({ seq: 101, type: 'task.create', payload: { task }, ts: 2 }),
    // Newer, and malformed: it must be reported, and must not crash the read.
    JSON.stringify({ seq: 102, type: 'task.create', payload: {}, ts: 3 }),
    '{ this line is torn',
  ].join('\n'), 'utf8');

  const ro = openReadOnly({ dir });
  const src = ro.source();
  assert.equal(src.ok, true, 'a torn last line does not stop the read');
  assert.equal(src.journalTailEvents, 2, 'events at or below the snapshot seq are not counted twice');
  assert.equal(src.behindByEvents, 1, 'only the event that could not be applied is still behind');
  assert.deepEqual(src.behindByTypes, { 'task.create': 1 });
  assert.equal(src.notApplied[0].seq, 102);
  assert.deepEqual(ro.tasks().map((t) => t.id), ['t9'], 'a task that exists only in the tail is visible');
  // Nothing on disk moved.
  assert.deepEqual(fs.readdirSync(dir).sort(), ['journal.jsonl', 'snapshot.json']);
});

test('a corrupt snapshot is reported, never served as an empty board', () => {
  // An empty board and an unreadable board look identical on a page, and only
  // one of them means stop trusting the page.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-bad-'));
  fs.writeFileSync(path.join(dir, 'snapshot.json'), '{ not json', 'utf8');
  const read = readSnapshot(dir);
  assert.equal(read.ok, false);
  assert.match(read.error, /not valid JSON/);
  assert.equal(read.snapshot, null);
});

test('it reads with no daemon running, and refuses every write method', async () => {
  const dir = board({
    lastSeq: 1,
    campaigns: [{ id: 'c1', name: 'one', state: 'active', history: history(9, 8, 7, 6) }],
    tasks: [], seats: [],
  });
  const server = createReadOnlyServer({ dir });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    const body = await health.json();
    assert.equal(body.readOnly, true);
    assert.equal(body.ok, true, 'the record is readable with nothing else running');

    const aging = await (await fetch(`${base}/aging`)).json();
    assert.equal(aging.counts.total, 1);

    const page = await fetch(`${base}/`);
    assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
    const html = await page.text();
    assert.match(html, /What has gone quiet/);
    assert.match(html, /this surface never writes/);

    // Every write verb, refused by one gate.
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await fetch(`${base}/campaigns`, { method });
      assert.equal(res.status, 405, `${method} must be refused`);
      assert.equal(res.headers.get('allow'), 'GET, HEAD');
    }

    // Nothing on disk moved.
    const after = fs.readdirSync(dir).sort();
    assert.deepEqual(after, ['snapshot.json'], 'the surface created no file');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('D-A: the triage report is served from the snapshot, matches the daemon report, and changes no byte', async () => {
  // Build a real record with the real store, then close it: the surface must
  // work with no daemon, from what the daemon left on disk.
  const { createStore } = await import('./store.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-ro-ws-'));
  fs.mkdirSync(path.join(root, 'public', 'planmap'), { recursive: true });
  const topics = { topics: [{ id: 'coord', status: 'active', features: [{ title: 'Charter contract', status: 'active' }] }] };
  fs.writeFileSync(path.join(root, 'public', 'planmap', 'topics.json'), JSON.stringify(topics), 'utf8');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-ro-'));
  let t = Date.UTC(2026, 8, 13);
  const store = createStore({ dir, now: () => t, presenceTtlMs: 1000, presenceDropMs: 5000, seatRosterPath: null, workspaceRoot: root });
  const owner = store.registerAgent({ petSlug: 'gf-sd', handle: 'ro-owner' });
  store.claimCampaign({ agentId: owner.id, campaignId: 'ro-abandoned', scope: 'x', paths: ['tmp/ro'] });
  const code = store.canonicalId('ro-abandoned');
  const task = store.createTask({ agentId: owner.id, title: 'left', campaignId: code });
  store.claimTask({ taskId: task.id, agentId: owner.id });
  // Past BOTH drop horizons: this store's 5 s and the surface's default 1 h,
  // which is the daemon's production default. The surface reads no config.
  t += 2 * 3_600_000;
  const daemonReport = store.triageReport(code);
  // The store stays open until the end, so the daemon report and the served
  // report are compared against the same record.
  store.snapshot();

  const snapPath = path.join(dir, 'snapshot.json');
  const before = fs.readFileSync(snapPath);
  const server = createReadOnlyServer({ dir, now: () => t, workspaceRoot: root });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/campaigns/ro-abandoned/triage`);
    assert.equal(res.status, 200);
    const report = await res.json();
    assert.equal(report.readOnly, true);
    assert.equal(report.campaign.adoptable, true);
    assert.equal(report.tasks[0].recommendation.disposition, 'reopen', 'the dead claimant is judged gone from the snapshot');
    // Same rules, same answer: only the source block differs.
    const { source, ...served } = report;
    assert.ok(source);
    assert.deepEqual(served, daemonReport);
    assert.equal((await fetch(`${base}/campaigns/${code}/triage`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/campaigns/agora-none/triage`)).status, 404);
    assert.ok(before.equals(fs.readFileSync(snapPath)), 'the snapshot is byte-identical after the report');
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('health fails loudly when the record cannot be read', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-none-'));
  const server = createReadOnlyServer({ dir });
  await new Promise((r) => server.listen(0, r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    // 200 with an error inside is how a monitor learns to ignore a page.
    assert.equal(res.status, 503);
    assert.equal((await res.json()).ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('the port is 4321, the free neighbor the design chose', () => {
  assert.equal(READONLY_PORT, 4321);
});
