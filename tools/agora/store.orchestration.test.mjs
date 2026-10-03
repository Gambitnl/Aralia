// tools/agora/store.orchestration.test.mjs
// Orchestrator-upgrade tests: task deps/priority/refs/result, result disposition,
// ready-queue + claim-next, dead-agent reaping, and stale-holder force lock release.
// Node built-in test runner only — run: node --test "tools/agora/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { createStore, TASK_DEP_TYPES, isBlockingDepType, inferCampaignForTask } from './store.mjs';

function tmpDir() {
  const d = path.join(os.tmpdir(), 'agora-test', crypto.randomUUID());
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function rm(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function makeClock(start = 1_000_000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => {
    t += ms;
    return t;
  };
  return now;
}

// --- task deps / priority / refs --------------------------------------------

test('tasks: deps gate readiness; done deps unlock; priority orders the ready queue', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const me = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch' });

  const a = store.createTask({ agentId: me.id, title: 'A: prep' });
  const b = store.createTask({ agentId: me.id, title: 'B: build', deps: [a.id], priority: 5 });
  const c = store.createTask({ agentId: me.id, title: 'C: independent', priority: 2 });

  // Only dep-free tasks are ready; b waits on a.
  let ready = store.listTasks({ ready: true });
  assert.deepEqual(ready.map((t) => t.title).sort(), ['A: prep', 'C: independent']);

  // Completing A makes B ready, and B (priority 5) outranks C (priority 2).
  store.claimTask({ taskId: a.id, agentId: me.id });
  store.setTaskState({ taskId: a.id, agentId: me.id, state: 'done' });
  ready = store.listTasks({ ready: true });
  assert.deepEqual(ready.map((t) => t.title), ['B: build', 'C: independent']);

  // deps + priority + refs persist on the task record.
  // D-T: a bare id is normalized on the way in and stored typed. It still
  // means what it always meant — a hard gate — so this is the same edge said
  // precisely rather than a different one.
  assert.deepEqual(b.deps, [{ id: a.id, type: 'blocks' }]);
  assert.equal(b.priority, 5);
  const withRefs = store.createTask({ agentId: me.id, title: 'refs', refs: ['spells:G12'] });
  assert.deepEqual(withRefs.refs, ['spells:G12']);

  store.close();
  rm(dir);
});

test('tasks: creating with an unknown dep fails honestly', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const me = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch' });
  assert.throws(
    () => store.createTask({ agentId: me.id, title: 'bad', deps: ['nope-no-such-task'] }),
    /unknown dep/,
  );
  store.close();
  rm(dir);
});

test('tasks: listTasks computes graph fields ready/depStates/gates (diamond observability)', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const me = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch' });

  const leafA = store.createTask({ agentId: me.id, title: 'leaf A' });
  const leafB = store.createTask({ agentId: me.id, title: 'leaf B' });
  const converge = store.createTask({ agentId: me.id, title: 'converge', deps: [leafA.id, leafB.id] });

  const byId = (rows) => new Map(rows.map((t) => [t.id, t]));

  let rows = byId(store.listTasks());
  // Leaves: no upstream deps so open = ready; each gates exactly one downstream task.
  assert.deepEqual(rows.get(leafA.id).depStates, []);
  assert.equal(rows.get(leafA.id).ready, true); // open + no deps => claimable now
  assert.equal(rows.get(leafA.id).gates, 1);
  assert.equal(rows.get(leafB.id).gates, 1);
  // Converge: not ready, reports its two blocking upstream edges with live state.
  assert.equal(rows.get(converge.id).ready, false);
  assert.deepEqual(rows.get(converge.id).depStates.map((d) => d.id).sort(), [leafA.id, leafB.id].sort());
  assert.deepEqual(rows.get(converge.id).depStates.map((d) => d.state).sort(), ['open', 'open']);

  // Completing both leaves unlocks the converge node (diamond is now join-ready).
  for (const leaf of [leafA, leafB]) {
    store.claimTask({ taskId: leaf.id, agentId: me.id });
    store.setTaskState({ taskId: leaf.id, agentId: me.id, state: 'done' });
  }
  rows = byId(store.listTasks());
  assert.equal(rows.get(leafA.id).ready, false); // done != open, not claimable again
  assert.equal(rows.get(converge.id).ready, true);
  assert.equal(rows.get(converge.id).depStates.every((d) => d.state === 'done'), true);
  assert.equal(rows.get(converge.id).gates, 0); // a final output gates nothing

  // The computed `ready` uses the same predicate claim-next does.
  assert.deepEqual(store.listTasks({ ready: true }).map((t) => t.title), ['converge']);

  store.close();
  rm(dir);
});

test('tasks: claimTask gates open tasks on unresolved deps; only the creator may force (WF-G55)', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch' });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker' });

  const leaf = store.createTask({ agentId: orch.id, title: 'leaf' });
  const converge = store.createTask({ agentId: orch.id, title: 'converge', deps: [leaf.id] });

  // A worker cannot hand-claim the gated converge task...
  const blocked = store.claimTask({ taskId: converge.id, agentId: worker.id });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /not ready: blocked by dep/);

  // ...and a non-creator cannot force it either.
  const forcedByWorker = store.claimTask({ taskId: converge.id, agentId: worker.id, force: true });
  assert.equal(forcedByWorker.ok, false);
  assert.match(forcedByWorker.error, /not ready: blocked by dep/);

  // The creator can force a gated claim (deliberate orchestrator hand-assignment).
  const forcedByOrch = store.claimTask({ taskId: converge.id, agentId: orch.id, force: true });
  assert.equal(forcedByOrch.ok, true);
  assert.equal(forcedByOrch.task.state, 'claimed');

  // Re-claim by the current owner stays allowed (idempotent hot-swap).
  const reClaim = store.claimTask({ taskId: converge.id, agentId: orch.id });
  assert.equal(reClaim.ok, true);

  store.close();
  rm(dir);
});

test('tasks: claimTask lets a ready (dep-satisfied) task be claimed normally (WF-G55)', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch' });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker' });

  const leaf = store.createTask({ agentId: orch.id, title: 'leaf' });
  const converge = store.createTask({ agentId: orch.id, title: 'converge', deps: [leaf.id] });
  store.claimTask({ taskId: leaf.id, agentId: orch.id });
  store.setTaskState({ taskId: leaf.id, agentId: orch.id, state: 'done' });

  // Once every dep is done, any registered agent can claim the converge task.
  const ok = store.claimTask({ taskId: converge.id, agentId: worker.id });
  assert.equal(ok.ok, true);
  assert.equal(ok.task.state, 'claimed');

  store.close();
  rm(dir);
});

test('tasks: substantive completion stores the summary, finding, and evidence independently', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const me = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker' });
  const t = store.createTask({ agentId: me.id, title: 'fix the thing' });
  store.claimTask({ taskId: t.id, agentId: me.id });
  const r = store.setTaskState({
    taskId: t.id,
    agentId: me.id,
    state: 'done',
    result: 'edited 3 files; 12 tests green; no tsc errors',
    resultDisposition: 'substantive',
    finding: 'The retry path dropped the final response.',
    evidence: '12 focused tests green.',
  });
  assert.equal(r.ok, true);
  assert.equal(r.task.result, 'edited 3 files; 12 tests green; no tsc errors');
  assert.equal(r.task.resultDisposition, 'substantive');
  assert.equal(r.task.finding, 'The retry path dropped the final response.');
  assert.equal(r.task.evidence, '12 focused tests green.');
  const last = r.task.history[r.task.history.length - 1];
  assert.equal(last.result, 'edited 3 files; 12 tests green; no tsc errors');
  assert.equal(last.resultDisposition, 'substantive');
  assert.equal(last.finding, 'The retry path dropped the final response.');
  assert.equal(last.evidence, '12 focused tests green.');
  store.close();
  rm(dir);
});

test('tasks: triage-only stays live for one later substantive review', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const me = store.registerAgent({ petSlug: 'gf-sd', handle: 'reviewer' });
  const task = store.createTask({ agentId: me.id, title: 'review a broad feature' });
  store.claimTask({ taskId: task.id, agentId: me.id });

  // An unknown disposition is rejected instead of becoming a new workflow
  // category that older dashboards would misread.
  const invalid = store.setTaskState({
    taskId: task.id,
    agentId: me.id,
    state: 'done',
    result: 'not classified',
    resultDisposition: 'too_big',
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /invalid result disposition/);

  // Triage retains the worker's authored reason but cannot smuggle in fields
  // that would make it look like an evidence-backed review.
  const contradictory = store.setTaskState({
    taskId: task.id,
    agentId: me.id,
    state: 'done',
    result: 'SKIP TOO-BIG',
    resultDisposition: 'triage_only',
    finding: 'pretend finding',
  });
  assert.equal(contradictory.ok, false);
  assert.match(contradictory.error, /cannot include substantive/);

  const triage = store.setTaskState({
    taskId: task.id,
    agentId: me.id,
    state: 'done',
    result: 'SKIP TOO-BIG: cross-file review deferred',
    resultDisposition: 'triage_only',
  });
  assert.equal(triage.ok, true);
  assert.equal(triage.task.state, 'done');
  assert.equal(triage.task.resultDisposition, 'triage_only');
  assert.equal(triage.task.finding, null);
  assert.equal(triage.task.evidence, null);
  assert.equal(triage.task.history.at(-1).resultDisposition, 'triage_only');

  // Even after the ordinary tidy horizon, triage stays on the live board. That
  // leaves the same task claimable by a reviewer instead of burying the refusal.
  store.__setTaskUpdatedAt(task.id, Date.now() - 15 * 86400000);
  assert.equal(store.archiveDoneTasks().archived, 0);
  assert.equal(store.listTasks().some((row) => row.id === task.id), true);
  assert.equal(store.claimTask({ taskId: task.id, agentId: me.id }).ok, true);

  // A reviewer must explicitly promote the triage record and supply both parts
  // of the proof contract. Merely writing another result is not sufficient.
  const reviewed = store.setTaskState({
    taskId: task.id,
    agentId: me.id,
    state: 'done',
    result: 'Review completed after the initial size decline.',
    resultDisposition: 'substantive',
    finding: 'The upcast healing branch reads damage dice first.',
    evidence: 'Focused fixture reproduces the wrong healing total.',
  });
  assert.equal(reviewed.ok, true);
  assert.equal(reviewed.task.resultDisposition, 'substantive');
  assert.equal(reviewed.task.finding, 'The upcast healing branch reads damage dice first.');
  assert.equal(reviewed.task.evidence, 'Focused fixture reproduces the wrong healing total.');
  assert.equal(reviewed.task.history.at(-1).resultDisposition, 'substantive');

  // Once substantive, the existing stale-done archive behavior applies again.
  store.__setTaskUpdatedAt(task.id, Date.now() - 15 * 86400000);
  assert.equal(store.archiveDoneTasks().archived, 1);
  store.close();
  rm(dir);
});

test('tasks: triage-only dependencies keep every claim path gated until substantive review', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const reviewer = store.registerAgent({ petSlug: 'gf-sd', handle: 'reviewer' });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker' });
  const dependency = store.createTask({ agentId: reviewer.id, title: 'review prerequisite' });
  const direct = store.createTask({ agentId: reviewer.id, title: 'direct downstream', deps: [dependency.id] });
  const queued = store.createTask({ agentId: reviewer.id, title: 'queued downstream', deps: [dependency.id] });

  // Triage records why the prerequisite was deferred, but it must not release
  // either downstream route as if the requested review had actually happened.
  store.claimTask({ taskId: dependency.id, agentId: reviewer.id });
  const triage = store.setTaskState({
    taskId: dependency.id,
    agentId: reviewer.id,
    state: 'done',
    result: 'SKIP TOO-BIG: prerequisite review deferred',
    resultDisposition: 'triage_only',
  });
  assert.equal(triage.ok, true);
  assert.deepEqual(store.listTasks({ ready: true }).map((task) => task.id), []);

  // Hand claims and worker-pull claims must agree about the same unresolved
  // prerequisite, and the hand-claim error should identify it for operators.
  const blocked = store.claimTask({ taskId: direct.id, agentId: worker.id });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, new RegExp(dependency.id));
  assert.equal(store.claimNextReady({ agentId: worker.id }).task, null);

  // Once a reviewer supplies a real finding and evidence, both downstream
  // tasks become ready; one can be hand-claimed and the other worker-pulled.
  assert.equal(store.claimTask({ taskId: dependency.id, agentId: reviewer.id }).ok, true);
  const substantive = store.setTaskState({
    taskId: dependency.id,
    agentId: reviewer.id,
    state: 'done',
    result: 'Prerequisite review completed.',
    resultDisposition: 'substantive',
    finding: 'The prerequisite is safe to proceed from.',
    evidence: 'Focused review exercised the downstream contract.',
  });
  assert.equal(substantive.ok, true);
  assert.deepEqual(
    store.listTasks({ ready: true }).map((task) => task.id).sort(),
    [direct.id, queued.id].sort(),
  );
  assert.equal(store.claimTask({ taskId: direct.id, agentId: worker.id }).ok, true);
  assert.equal(store.claimNextReady({ agentId: reviewer.id }).task.id, queued.id);

  store.close();
  rm(dir);
});

test('tasks: bare done result stays legacy-unclassified and cannot imply substantive review', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const me = store.registerAgent({ petSlug: 'gf-sd', handle: 'legacy-worker' });
  const task = store.createTask({ agentId: me.id, title: 'legacy completion' });

  // Existing callers retain their state and free-form result. The missing
  // disposition is meaningful: no technical review classification was claimed.
  const legacy = store.setTaskState({
    taskId: task.id,
    agentId: me.id,
    state: 'done',
    result: 'legacy result without structured proof',
  });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.task.state, 'done');
  assert.equal(legacy.task.result, 'legacy result without structured proof');
  assert.equal(legacy.task.resultDisposition, null);
  assert.equal(legacy.task.history.at(-1).resultDisposition, undefined);

  // Review detail without explicit classification is rejected, as is an
  // explicit substantive claim missing either half of the proof contract.
  const implicit = store.setTaskState({
    taskId: task.id,
    agentId: me.id,
    state: 'done',
    finding: 'finding without classification',
    evidence: 'evidence without classification',
  });
  assert.equal(implicit.ok, false);
  assert.match(implicit.error, /require explicit substantive/);
  const missingEvidence = store.setTaskState({
    taskId: task.id,
    agentId: me.id,
    state: 'done',
    resultDisposition: 'substantive',
    finding: 'finding only',
  });
  assert.equal(missingEvidence.ok, false);
  assert.match(missingEvidence.error, /requires non-empty finding and evidence/);

  store.close();
  rm(dir);
});

test('tasks: claimNextReady atomically claims the top-priority ready task', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const me = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch' });
  const w = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker' });

  store.createTask({ agentId: me.id, title: 'low', priority: 1 });
  const high = store.createTask({ agentId: me.id, title: 'high', priority: 9 });
  const gated = store.createTask({ agentId: me.id, title: 'gated', deps: [high.id], priority: 99 });

  const first = store.claimNextReady({ agentId: w.id });
  assert.equal(first.task.title, 'high'); // gated outranks it but isn't ready
  const second = store.claimNextReady({ agentId: w.id });
  assert.equal(second.task.title, 'low');
  const third = store.claimNextReady({ agentId: w.id });
  assert.equal(third.task, null); // nothing ready ('gated' still blocked)
  assert.equal(gated.priority, 99);

  store.close();
  rm(dir);
});

// WF-G127 (2026-09-09): an unknown lane must not look like an empty one.
// WF-G130 (2026-09-09): fix a task in place; the id survives, the history remembers.
test('tasks: editTask rewrites authored fields, keeps the id, and records the old values', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const author = store.registerAgent({ petSlug: 'gf-sd', handle: 'author' });
  const other = store.registerAgent({ petSlug: 'gf-sd', handle: 'bystander' });
  const t = store.createTask({ agentId: author.id, title: 'data/craftedItems.ts debt', body: 'b', priority: 3 });
  const r = store.editTask({ agentId: author.id, taskId: t.id, fields: { title: 'src/data/craftedItems.ts debt', priority: 4 }, reason: 'lint: missing src/ prefix' });
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.changed, ['title', 'priority']);
  assert.equal(r.task.id, t.id);
  assert.equal(r.task.title, 'src/data/craftedItems.ts debt');
  assert.equal(r.task.priority, 4);
  const last = r.task.history[r.task.history.length - 1];
  assert.equal(last.action, 'edit');
  assert.equal(last.from.title, 'data/craftedItems.ts debt');
  assert.equal(last.from.priority, 3);
  assert.equal(last.reason, 'lint: missing src/ prefix');
  assert.equal(store.editTask({ agentId: other.id, taskId: t.id, fields: { title: 'x' } }).ok, false, 'a bystander worker may not edit');
  assert.equal(store.editTask({ agentId: author.id, taskId: t.id, fields: { state: 'done' } }).ok, false, 'state is not an authored field');
  assert.equal(store.editTask({ agentId: author.id, taskId: t.id, fields: { title: 'src/data/craftedItems.ts debt' } }).ok, false, 'no-op is refused');

  // WF-G149: an orchestrator who neither created nor claimed the task can annotate it with a note/reason.
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'fable-orch', role: 'orchestrator', sessionId: 'orch-thread-1' });
  const orchAnnotate = store.editTask({ agentId: orch.id, taskId: t.id, reason: 'PARKED: waiting for design decision' });
  assert.equal(orchAnnotate.ok, true, orchAnnotate.error);
  assert.deepEqual(orchAnnotate.changed, []);
  const noteEntry = orchAnnotate.task.history[orchAnnotate.task.history.length - 1];
  assert.equal(noteEntry.action, 'note');
  assert.equal(noteEntry.reason, 'PARKED: waiting for design decision');
  assert.equal(noteEntry.by, orch.id);

  // WF-G153: appendBody appends text with a newline.
  const appendResult = store.editTask({ agentId: author.id, taskId: t.id, fields: { appendBody: 'extra details line' } });
  assert.equal(appendResult.ok, true, appendResult.error);
  assert.equal(appendResult.task.body, 'b\nextra details line');

  // The edit survives a journal replay.
  store.close();
  const again = createStore({ dir });
  const replayed = again.listTasks({}).find((x) => x.id === t.id);
  assert.equal(replayed.title, 'src/data/craftedItems.ts debt');
  assert.equal(replayed.body, 'b\nextra details line');
  const replayedNote = replayed.history.find((h) => h.action === 'note');
  assert.ok(replayedNote, 'note entry survived replay');
  assert.equal(replayedNote.reason, 'PARKED: waiting for design decision');
  again.close();
  rm(dir);
});

test('tasks: claimNextReady refuses an unknown campaign instead of answering null', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'lane-worker' });
  const r = store.claimNextReady({ agentId: a.id, campaignId: 'agora-zzzz' });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown campaign/);
  store.close();
  rm(dir);
});

test('tasks: claimNextReady can stay inside one campaign and category lane', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch-filter' });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker-filter' });

  store.claimCampaign({
    agentId: orch.id,
    campaignId: 'lane-a',
    paths: ['tmp/lane-a'],
  });
  store.claimCampaign({
    agentId: orch.id,
    campaignId: 'lane-b',
    paths: ['tmp/lane-b'],
  });
  const laneA = store.createTask({
    agentId: orch.id,
    title: 'lane A task',
    campaignId: 'lane-a',
    category: 'backend',
    priority: 10,
  });
  const laneB = store.createTask({
    agentId: orch.id,
    title: 'lane B task',
    campaignId: 'lane-b',
    category: 'frontend',
    priority: 99,
  });

  const byCampaign = store.claimNextReady({ agentId: worker.id, campaignId: 'lane-a' });
  assert.equal(byCampaign.task.id, laneA.id, 'higher-priority work in another campaign is ignored');

  const byCategory = store.claimNextReady({ agentId: worker.id, category: 'frontend' });
  assert.equal(byCategory.task.id, laneB.id);

  const dryLane = store.claimNextReady({ agentId: worker.id, campaignId: 'lane-a' });
  assert.equal(dryLane.task, null);

  store.close();
  rm(dir);
});

// --- dead-agent reaping ------------------------------------------------------

test('reaping: a dropped agent frees its locks, reopens its tasks, and loses its token', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceTtlMs: 1000, presenceDropMs: 5000 });

  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch' });
  const w = store.registerAgent({ petSlug: 'gf-sd', handle: 'doomed-worker' });
  const t = store.createTask({ agentId: orch.id, title: 'packet-1' });
  store.claimTask({ taskId: t.id, agentId: w.id });
  store.setTaskState({ taskId: t.id, agentId: w.id, state: 'in_progress' });
  const lock = store.acquireLock({ agentId: w.id, paths: ['src/foo.ts'], reason: 'packet-1' });
  assert.equal(lock.ok, true);

  // Keep the orchestrator alive, let the worker fall silent. Because the
  // worker HOLDS an in-progress task, it gets DOUBLE the drop horizon
  // (WF-G4 grace) — at 6000 (> drop 5000, < 2× 10000) it must survive.
  now.advance(4000);
  store.touch(orch.id);
  now.advance(2000); // worker age 6000 — inside the working-agent grace
  store.sweepExpired();
  assert.equal(store.listLocks().length, 1, 'working agent NOT reaped inside the grace window');
  assert.ok(store.getAgentByToken(w.token), 'token still valid inside grace');

  now.advance(5000); // worker age 11000 > 2× drop — grace exhausted
  store.touch(orch.id);
  store.sweepExpired();

  // Lock is gone even though its TTL (30 min default) hasn't elapsed.
  assert.deepEqual(store.listLocks(), []);
  // Task went back to open, unclaimed, with a reap entry in history.
  const reopened = store.listTasks().find((x) => x.id === t.id);
  assert.equal(reopened.state, 'open');
  assert.equal(reopened.claimedBy, null);
  assert.equal(reopened.history[reopened.history.length - 1].action, 'reaped');
  // The dead agent's token no longer authenticates; the live one still does.
  assert.equal(store.getAgentByToken(w.token), null);
  assert.ok(store.getAgentByToken(orch.token));

  store.close();
  rm(dir);
});

test('reaping: done tasks are NOT reopened when their agent drops', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceTtlMs: 1000, presenceDropMs: 5000 });
  const w = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker' });
  const t = store.createTask({ agentId: w.id, title: 'finished work' });
  store.claimTask({ taskId: t.id, agentId: w.id });
  store.setTaskState({ taskId: t.id, agentId: w.id, state: 'done', result: 'shipped' });

  now.advance(6000);
  store.sweepExpired();

  const after = store.listTasks().find((x) => x.id === t.id);
  assert.equal(after.state, 'done');
  assert.equal(after.result, 'shipped');
  store.close();
  rm(dir);
});

test('handoff authorization: only the claimant or the creator may reassign', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch' });
  const w1 = store.registerAgent({ petSlug: 'gf-sd', handle: 'w1' });
  const w2 = store.registerAgent({ petSlug: 'gf-sd', handle: 'w2' });
  const rogue = store.registerAgent({ petSlug: 'gf-sd', handle: 'rogue' });

  const t = store.createTask({ agentId: orch.id, title: 'seeded packet' });
  store.claimTask({ taskId: t.id, agentId: w1.id });

  // A third party may NOT reassign someone else's claimed task.
  let r = store.handoffTask({ taskId: t.id, agentId: rogue.id, toAgentId: w2.id });
  assert.equal(r.ok, false);
  assert.match(r.error, /claimant or the task creator/);

  // The creator (orchestrator) may; so may the claimant.
  r = store.handoffTask({ taskId: t.id, agentId: orch.id, toAgentId: w2.id });
  assert.equal(r.ok, true);
  r = store.handoffTask({ taskId: t.id, agentId: w2.id, toAgentId: w1.id });
  assert.equal(r.ok, true);

  store.close();
  rm(dir);
});

test('handoff rejects missing or dropped targets without changing ownership', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceDropMs: 5000 });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch-handoff' });
  const claimant = store.registerAgent({ petSlug: 'gf-sd', handle: 'claimant-handoff' });
  const target = store.registerAgent({ petSlug: 'gf-sd', handle: 'target-handoff' });
  const task = store.createTask({ agentId: orch.id, title: 'safe handoff' });
  store.claimTask({ taskId: task.id, agentId: claimant.id });

  let r = store.handoffTask({ taskId: task.id, agentId: claimant.id, toAgentId: 'missing-agent' });
  assert.equal(r.ok, false);
  assert.match(r.error, /not registered or live/);

  now.advance(6000);
  store.touch(orch.id);
  store.touch(claimant.id);
  r = store.handoffTask({ taskId: task.id, agentId: claimant.id, toAgentId: target.id });
  assert.equal(r.ok, false);
  assert.match(r.error, /not registered or live/);
  assert.equal(store.listTasks().find((row) => row.id === task.id).claimedBy, claimant.id);

  store.close();
  rm(dir);
});

test('sweep repairs a legacy task claimed by an identity with no roster record', () => {
  const dir = tmpDir();
  const now = makeClock();
  let store = createStore({ dir, now });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch-orphan' });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker-orphan' });
  const task = store.createTask({ agentId: orch.id, title: 'legacy orphan' });
  store.claimTask({ taskId: task.id, agentId: worker.id });
  store.close();

  // Simulate a pre-WF-G15 snapshot whose claimant record disappeared without
  // the matching task.release event.
  const snapshotPath = path.join(dir, 'snapshot.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  snapshot.agents = snapshot.agents.filter((agent) => agent.id !== worker.id);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot));

  store = createStore({ dir, now });
  store.sweepExpired();
  const repaired = store.listTasks().find((row) => row.id === task.id);
  assert.equal(repaired.state, 'open');
  assert.equal(repaired.claimedBy, null);
  const last = repaired.history[repaired.history.length - 1];
  assert.equal(last.action, 'reaped');
  assert.equal(last.reason, 'orphan claimant missing from roster');
  assert.equal(last.previousClaimant, worker.id);

  store.close();
  rm(dir);
});

// --- multi-orchestrator governance ------------------------------------------

test('campaigns: overlapping leads are refused; a deputy may join the named lead', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const lead = store.registerAgent({ petSlug: 'gf-sd', handle: 'lead-orch' });
  const rival = store.registerAgent({ petSlug: 'gf-sd', handle: 'rival-orch' });
  const deputy = store.registerAgent({ petSlug: 'gf-sd', handle: 'deputy-orch' });

  // A lead campaign reserves an advisory file domain for the wave it supervises.
  const first = store.claimCampaign({
    agentId: lead.id,
    campaignId: 'ui-playtest',
    role: 'lead',
    scope: '2D UI playtest fixes',
    paths: ['src/components/MapPane.tsx'],
    globs: ['src/components/ui/**'],
    wave: 'ui-wave-1',
  });
  assert.equal(first.ok, true);

  // A second lead cannot seed an overlapping domain without coordinating first.
  const blocked = store.claimCampaign({
    agentId: rival.id,
    campaignId: 'rival-ui',
    role: 'lead',
    scope: 'parallel UI wave',
    paths: ['src/components/ui/WindowFrame.tsx'],
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /overlaps active lead campaign/);
  assert.equal(blocked.conflict.campaign.name, 'ui-playtest');
  assert.match(blocked.conflict.campaign.id, /^agora-[0-9a-f]{4}$/);

  // A deputy may explicitly join the lead campaign and declare a bounded lane.
  const joined = store.claimCampaign({
    agentId: deputy.id,
    campaignId: 'ui-playtest-deputy',
    role: 'deputy',
    leadCampaignId: 'ui-playtest',
    scope: 'window-frame lane only',
    paths: ['src/components/ui/WindowFrame.tsx'],
  });
  assert.equal(joined.ok, true);
  assert.equal(joined.campaign.role, 'deputy');
  // The lead is named by its code; the name the caller used still resolves.
  assert.equal(joined.campaign.leadCampaignId, store.canonicalId('ui-playtest'));

  store.close();
  rm(dir);
});

test('campaigns: owner status is tri-state and gone owners can be adopted with history', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceTtlMs: 1000, presenceDropMs: 5000 });
  const firstOwner = store.registerAgent({ petSlug: 'gf-sd', handle: 'first-owner' });
  const successor = store.registerAgent({ petSlug: 'gf-sd', handle: 'successor-owner' });

  const first = store.claimCampaign({
    agentId: firstOwner.id,
    campaignId: 'recoverable-campaign',
    role: 'lead',
    paths: ['tmp/recoverable'],
  });
  assert.equal(first.ok, true);
  assert.equal(store.listCampaigns()[0].ownerStatus, 'online');
  assert.equal(store.listCampaigns()[0].ownerLive, true);

  now.advance(2000);
  store.touch(successor.id);
  assert.equal(store.listCampaigns()[0].ownerStatus, 'stale');
  assert.equal(store.listCampaigns()[0].ownerLive, true);

  now.advance(4000);
  store.touch(successor.id);
  assert.equal(store.listCampaigns()[0].ownerStatus, 'gone');
  assert.equal(store.listCampaigns()[0].ownerLive, false);

  const adopted = store.claimCampaign({
    agentId: successor.id,
    campaignId: 'recoverable-campaign',
    role: 'lead',
    paths: ['tmp/recoverable'],
  });
  assert.equal(adopted.ok, true);
  assert.equal(adopted.campaign.agentId, successor.id);
  assert.equal(adopted.campaign.createdAt, first.campaign.createdAt);
  const last = adopted.campaign.history[adopted.campaign.history.length - 1];
  assert.equal(last.action, 'adopted');
  assert.equal(last.previousOwner, firstOwner.id);
  assert.equal(store.listCampaigns()[0].ownerStatus, 'online');
  assert.equal(store.listCampaigns()[0].ownerLive, true);

  store.close();
  rm(dir);
});

test('campaigns: tasks can be namespaced to a claimed campaign and survive restart', () => {
  const dir = tmpDir();
  let store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'governance-orch' });

  store.claimCampaign({
    agentId: orch.id,
    campaignId: 'governance',
    role: 'lead',
    scope: 'tools/agora governance',
    globs: ['tools/agora/**'],
    wave: 'governance-wave',
  });
  const task = store.createTask({
    agentId: orch.id,
    title: 'PK-governance: seed safe board state',
    campaignId: 'governance',
    wave: 'governance-wave',
  });
  // The task stores the campaign CODE; the name still resolves to it.
  assert.match(task.campaignId, /^agora-[0-9a-f]{4}$/);
  assert.equal(store.canonicalId('governance'), task.campaignId);
  assert.equal(task.wave, 'governance-wave');
  store.close();

  // Snapshot/replay keeps both the campaign ownership and task namespace.
  store = createStore({ dir });
  const campaigns = store.listCampaigns();
  assert.equal(campaigns.length, 1);
  assert.equal(campaigns[0].name, 'governance');
  assert.match(campaigns[0].id, /^agora-[0-9a-f]{4}$/);
  const restored = store.listTasks().find((t) => t.id === task.id);
  assert.match(restored.campaignId, /^agora-[0-9a-f]{4}$/);
  assert.equal(store.canonicalId('governance'), restored.campaignId);
  assert.equal(restored.wave, 'governance-wave');
  store.close();
  rm(dir);
});

// --- stale-holder force release ----------------------------------------------

test('locks: force release works only when the holder is stale or gone', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceTtlMs: 1000, presenceDropMs: 60000 });
  const holder = store.registerAgent({ petSlug: 'gf-sd', handle: 'holder' });
  const other = store.registerAgent({ petSlug: 'gf-sd', handle: 'other' });
  const { lock } = store.acquireLock({ agentId: holder.id, paths: ['src/x.ts'] });

  // Holder online -> force refused.
  let r = store.releaseLock({ lockId: lock.id, agentId: other.id, force: true });
  assert.equal(r.ok, false);
  assert.match(r.error, /online/);

  // Non-force by non-holder always refused.
  now.advance(2000); // holder now stale
  store.touch(other.id);
  r = store.releaseLock({ lockId: lock.id, agentId: other.id });
  assert.equal(r.ok, false);

  // Holder stale -> force succeeds.
  r = store.releaseLock({ lockId: lock.id, agentId: other.id, force: true });
  assert.equal(r.ok, true);
  assert.deepEqual(store.listLocks(), []);

  store.close();
  rm(dir);
});

// --- persistence of the new fields --------------------------------------------

test('persistence: orchestration fields and both result dispositions survive snapshot + journal replay', () => {
  const dir = tmpDir();
  let store = createStore({ dir });
  const me = store.registerAgent({ petSlug: 'gf-sd', handle: 'orch' });
  const a = store.createTask({ agentId: me.id, title: 'A' });
  const b = store.createTask({
    agentId: me.id, title: 'B', deps: [a.id], priority: 7, refs: ['worldforge:G3'],
  });
  const triageTask = store.createTask({ agentId: me.id, title: 'large review' });
  store.claimTask({ taskId: a.id, agentId: me.id });
  store.setTaskState({
    taskId: a.id,
    agentId: me.id,
    state: 'done',
    result: 'proof: 4 tests',
    resultDisposition: 'substantive',
    finding: 'The dependency is now satisfied.',
    evidence: 'Four focused tests passed.',
  });
  store.setTaskState({
    taskId: triageTask.id,
    agentId: me.id,
    state: 'done',
    result: 'SKIP TOO-BIG',
    resultDisposition: 'triage_only',
  });
  store.close(); // snapshots

  store = createStore({ dir });
  const tasks = store.listTasks();
  const a2 = tasks.find((t) => t.id === a.id);
  const b2 = tasks.find((t) => t.id === b.id);
  const triage2 = tasks.find((t) => t.id === triageTask.id);
  assert.equal(a2.result, 'proof: 4 tests');
  assert.equal(a2.resultDisposition, 'substantive');
  assert.equal(a2.finding, 'The dependency is now satisfied.');
  assert.equal(a2.evidence, 'Four focused tests passed.');
  assert.equal(triage2.resultDisposition, 'triage_only');
  assert.equal(triage2.result, 'SKIP TOO-BIG');
  assert.deepEqual(b2.deps, [{ id: a.id, type: 'blocks' }]);
  assert.equal(b2.priority, 7);
  assert.deepEqual(b2.refs, ['worldforge:G3']);
  // B is ready now that A is done — readiness computed from restored state.
  assert.deepEqual(store.listTasks({ ready: true }).map((t) => t.id), [b.id]);
  store.close();
  rm(dir);
});

// WF-G88: the listing could not filter by campaign, and it IGNORED a campaignId
// argument instead of refusing it — so a caller believed it had filtered while
// it received the whole board. Measured on the live daemon: a filtered request
// returned all 120 tasks while exactly 1 carried that campaign.
test('tasks: listTasks filters by campaign and refuses an unknown campaign id', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'lane-orch' });

  store.claimCampaign({
    agentId: orch.id,
    campaignId: 'lane-a',
    role: 'lead',
    scope: 'lane A',
    paths: ['src/lane-a.ts'],
  });
  store.claimCampaign({
    agentId: orch.id,
    campaignId: 'lane-b',
    role: 'lead',
    scope: 'lane B',
    paths: ['src/lane-b.ts'],
  });

  const a1 = store.createTask({ agentId: orch.id, title: 'A one', campaignId: 'lane-a' });
  const a2 = store.createTask({ agentId: orch.id, title: 'A two', campaignId: 'lane-a' });
  const b1 = store.createTask({ agentId: orch.id, title: 'B one', campaignId: 'lane-b' });
  const loose = store.createTask({ agentId: orch.id, title: 'no campaign' });

  // The whole board, when no lane is named.
  assert.equal(store.listTasks().length, 4);

  // One lane only — not the board.
  const laneA = store.listTasks({ campaignId: 'lane-a' });
  assert.deepEqual(laneA.map((t) => t.id).sort(), [a1.id, a2.id].sort());
  assert.deepEqual(store.listTasks({ campaignId: 'lane-b' }).map((t) => t.id), [b1.id]);

  // A task with no campaign belongs to no lane.
  assert.ok(!laneA.some((t) => t.id === loose.id));

  // Filters compose rather than replace each other.
  store.setTaskState({ taskId: a2.id, agentId: orch.id, state: 'blocked', reason: 'test (WF-G86)' });
  assert.deepEqual(
    store.listTasks({ campaignId: 'lane-a', state: 'blocked' }).map((t) => t.id),
    [a2.id],
  );

  // The defect itself: an unknown id must FAIL, never return everything.
  assert.throws(
    () => store.listTasks({ campaignId: 'lane-typo' }),
    /unknown campaign: lane-typo/,
  );

  store.close();
  rm(dir);
});

// ---------------------------------------------------------------------------
// D-M / D-T: the ten dependency types
// ---------------------------------------------------------------------------

test('deps: all ten types are accepted and an unknown type is refused', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'dep-orch' });
  const base = store.createTask({ agentId: orch.id, title: 'base' });

  // Every declared type must be usable. A vocabulary with an unreachable
  // member is a vocabulary nobody can trust.
  assert.equal(Object.keys(TASK_DEP_TYPES).length, 10);
  for (const type of Object.keys(TASK_DEP_TYPES)) {
    const t = store.createTask({
      agentId: orch.id,
      title: 'uses ' + type,
      deps: [{ id: base.id, type }],
    });
    assert.deepEqual(t.deps, [{ id: base.id, type }]);
  }

  // Exactly four of the ten gate readiness.
  const blocking = Object.keys(TASK_DEP_TYPES).filter(isBlockingDepType);
  assert.deepEqual(blocking.sort(), ['blocks', 'conditional-blocks', 'parent-child', 'waits-for']);

  // THE DECISION ITSELF: an unknown type must throw, not fall back to the
  // default. Silent coercion is what let WF-G80 hold illegal values for days.
  assert.throws(
    () => store.createTask({ agentId: orch.id, title: 'bad', deps: [{ id: base.id, type: 'depends-on' }] }),
    /unknown dependency type: depends-on/,
  );

  // A bare id still works and means what it always meant: a hard gate.
  const legacy = store.createTask({ agentId: orch.id, title: 'legacy', deps: [base.id] });
  assert.deepEqual(legacy.deps, [{ id: base.id, type: 'blocks' }]);

  store.close();
  rm(dir);
});

test('deps: only a blocking type holds a task back', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'gate-orch' });
  const open = store.createTask({ agentId: orch.id, title: 'still open' });

  const gated = store.createTask({
    agentId: orch.id,
    title: 'gated',
    deps: [{ id: open.id, type: 'waits-for' }],
  });
  const noted = store.createTask({
    agentId: orch.id,
    title: 'merely related',
    deps: [{ id: open.id, type: 'supersedes' }],
  });

  const rows = store.listTasks();
  const byId = new Map(rows.map((r) => [r.id, r]));
  assert.equal(byId.get(gated.id).ready, false, 'a waits-for edge gates');
  assert.equal(byId.get(noted.id).ready, true, 'a supersedes edge does not gate');

  // gates counts only what is actually held back — one, not two.
  assert.equal(byId.get(open.id).gates, 1);

  // The type travels with the edge, so a reader never looks it up elsewhere.
  assert.deepEqual(byId.get(noted.id).depStates, [
    { id: open.id, type: 'supersedes', blocking: false, state: 'open', title: 'still open' },
  ]);

  // The refusal to claim names the type as well as the id.
  const claim = store.claimTask({ taskId: gated.id, agentId: orch.id });
  assert.equal(claim.ok, false);
  assert.match(claim.error, /waits-for/);

  store.close();
  rm(dir);
});

test('deps: migration types every old edge in ONE event that rewrites no past event', () => {
  const dir = tmpDir();

  // Build a genuine PRE-MIGRATION journal: a task.create event carrying the
  // old untyped shape, exactly as the live board holds it today. Reaching in
  // through a test-only setter would prove the migration against a fixture
  // rather than against the thing it has to convert.
  const base = {
    id: crypto.randomUUID(), title: 'base', body: '', category: '', campaignId: '', wave: '',
    state: 'done', createdBy: 'seed', creatorAgent: null, claimedBy: null, claimedAgent: null,
    assignedPet: null, retraceFiles: [], deps: [], priority: 0, refs: [], result: 'done',
    resultDisposition: null, finding: null, evidence: null,
    createdAt: 1, updatedAt: 1, history: [{ at: 1, by: 'seed', action: 'created', state: 'open' }],
  };
  const child = { ...base, id: crypto.randomUUID(), title: 'child', state: 'open', result: null, deps: [base.id] };
  fs.writeFileSync(
    path.join(dir, 'journal.jsonl'),
    [
      { seq: 1, type: 'task.create', payload: { task: base }, ts: 1 },
      { seq: 2, type: 'task.create', payload: { task: child }, ts: 2 },
    ].map((e) => JSON.stringify(e)).join('\n') + '\n',
  );

  const store = createStore({ dir });

  // A worker must NOT be able to fire this. One call retypes every dep on the
  // board, which is a control-plane act, not something to trip over.
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'mig-worker' });
  const refused = store.migrateTaskDeps({ agentId: worker.id });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /orchestrator, master, human/);

  const orch = store.registerAgent({
    petSlug: 'gf-sd', handle: 'mig-orch', role: 'orchestrator',
    type: 'codex', sessionId: 'thread-mig-orch',
  });

  const result = store.migrateTaskDeps({ agentId: orch.id });
  assert.equal(result.migrated, 1);
  assert.deepEqual(result.changes[0].from, [base.id]);
  assert.deepEqual(result.changes[0].to, [{ id: base.id, type: 'blocks' }]);

  // Idempotent: nothing untyped is left, so no second event is written.
  assert.equal(store.migrateTaskDeps({ agentId: orch.id }).migrated, 0);

  // The change shows in the task's own history rather than by having quietly
  // replaced what the record used to say.
  const after = store.listTasks().find((t2) => t2.id === child.id);
  assert.deepEqual(after.deps, [{ id: base.id, type: 'blocks' }]);
  assert.ok(after.history.some((h) => h.action === 'deps-typed'));

  // The old edge still gates, because `blocks` is what it always meant. The
  // base task is done, so the child is ready either way — check the gate the
  // other way round, against an open dependency.
  assert.equal(after.ready, true);

  store.close();

  // Replay reproduces the migrated shape: the migration is an event like any
  // other, not an edit of the two events that came before it.
  const reopened = createStore({ dir });
  const replayed = reopened.listTasks().find((t2) => t2.id === child.id);
  assert.deepEqual(replayed.deps, [{ id: base.id, type: 'blocks' }]);
  reopened.close();
  rm(dir);
});

// ---------------------------------------------------------------------------
// D-S: hierarchical ids, and the promise that no written-down id ever breaks
// ---------------------------------------------------------------------------

test('ids: a task in a campaign carries that campaign in its own name', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'id-orch' });
  store.claimCampaign({
    agentId: orch.id, campaignId: 'lane-one', scope: 'a lane', paths: ['src/a.ts'],
  });

  const first = store.createTask({ agentId: orch.id, title: 'one', campaignId: 'lane-one' });
  const second = store.createTask({ agentId: orch.id, title: 'two', campaignId: 'lane-one' });
  // D-W: the campaign's CODE is in the task name, the Beads shape.
  const code = store.canonicalId('lane-one');
  assert.match(code, /^agora-[0-9a-f]{4}$/);
  assert.equal(first.id, code + '.1');
  assert.equal(second.id, code + '.2');

  // Membership cannot be omitted, because it is not a separate box any more.
  // That box was missed 119 times out of 119, which is the whole point.
  assert.equal(first.campaignId, store.canonicalId('lane-one'));

  // WF-G85 (2): the creator leads exactly ONE active campaign, so a task
  // created without a campaign defaults INTO it — the correct value is now
  // the lazy value. `campaignId: 'none'` is the explicit way to stay loose.
  const defaulted = store.createTask({ agentId: orch.id, title: 'defaulted' });
  assert.equal(defaulted.campaignId, code);
  assert.equal(defaulted.id, code + '.3');
  const loose = store.createTask({ agentId: orch.id, title: 'loose', campaignId: 'none' });
  assert.match(loose.id, /^agora-[0-9a-f]{4}$/);
  assert.equal(loose.campaignId, '');
  // Two active lead campaigns: no guess, stays standalone.
  store.claimCampaign({ agentId: orch.id, campaignId: 'lane-two', scope: 'b lane', paths: ['src/b.ts'] });
  const ambiguous = store.createTask({ agentId: orch.id, title: 'ambiguous' });
  assert.equal(ambiguous.campaignId, '');

  store.close();
  rm(dir);
});

test('ids: migration renames tasks and EVERY old id keeps resolving, forever', () => {
  const dir = tmpDir();

  // A genuine pre-migration journal: UUID-named tasks, exactly as the live
  // board holds them today.
  const oldA = crypto.randomUUID();
  const oldB = crypto.randomUUID();
  const base = {
    title: '', body: '', category: '', campaignId: 'lane-one', wave: '', state: 'open',
    createdBy: 'seed', creatorAgent: null, claimedBy: null, claimedAgent: null, assignedPet: null,
    retraceFiles: [], deps: [], priority: 0, refs: [], result: null, resultDisposition: null,
    finding: null, evidence: null, createdAt: 1, updatedAt: 1,
    history: [{ at: 1, by: 'seed', action: 'created', state: 'open' }],
  };
  const campaign = {
    id: 'lane-one', role: 'lead', leadCampaignId: '', agentId: 'seed', scope: 'a lane',
    paths: ['src/a.ts'], globs: [], wave: '', state: 'active', warnings: [],
    createdAt: 1, updatedAt: 1, history: [],
  };
  fs.writeFileSync(
    path.join(dir, 'journal.jsonl'),
    [
      { seq: 1, type: 'campaign.claim', payload: { campaign }, ts: 1 },
      { seq: 2, type: 'task.create', payload: { task: { ...base, id: oldA, title: 'first' } }, ts: 2 },
      {
        seq: 3,
        type: 'task.create',
        payload: { task: { ...base, id: oldB, title: 'second', createdAt: 2, deps: [{ id: oldA, type: 'blocks' }] } },
        ts: 3,
      },
    ].map((e) => JSON.stringify(e)).join('\n') + '\n',
  );

  const store = createStore({ dir });

  // Control-plane only: this renames the whole board.
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'id-worker' });
  assert.equal(store.migrateIds({ agentId: worker.id }).ok, false);

  const orch = store.registerAgent({
    petSlug: 'gf-sd', handle: 'id-orch2', role: 'orchestrator',
    type: 'codex', sessionId: 'thread-id-orch2',
  });

  // A dry run changes nothing but shows exactly what would happen.
  const preview = store.migrateIds({ agentId: orch.id, dryRun: true });
  // Two tasks and the campaign that owns them.
  assert.equal(preview.migrated, 3);
  assert.ok(store.listTasks().some((t) => t.id === oldA), 'dry run must not rename');

  const result = store.migrateIds({ agentId: orch.id });
  assert.equal(result.migrated, 3);

  // D-W: the campaign takes a code, and its tasks are named from that code.
  const code = store.canonicalId('lane-one');
  assert.match(code, /^agora-[0-9a-f]{4}$/);
  assert.deepEqual(result.campaigns.map((c) => c.to), [code]);

  // Oldest first, so .1 is the campaign's first task rather than whichever the
  // map happened to yield.
  assert.deepEqual(result.tasks.map((t) => t.to), [code + '.1', code + '.2']);

  const rows = store.listTasks();
  assert.deepEqual(rows.map((t) => t.id).sort(), [code + '.1', code + '.2']);

  // The campaign's own name keeps working and is still shown to a person.
  assert.equal(store.listCampaigns()[0].name, 'lane-one');

  // THE PROMISE: every id ever written down still resolves. Fifteen board
  // results and four gap rows quote one of these.
  assert.equal(store.canonicalId(oldA), code + '.1');
  assert.equal(store.canonicalId(oldB), code + '.2');

  // And it resolves through the real API, not only through the helper.
  const claimed = store.claimTask({ taskId: oldA, agentId: orch.id });
  assert.equal(claimed.ok, true, claimed.error);
  assert.equal(claimed.task.id, code + '.1');

  // What the task used to be called is on the record, not merely inferable.
  const renamed = store.listTasks().find((t) => t.id === code + '.1');
  assert.deepEqual(renamed.formerIds, [oldA]);
  assert.ok(renamed.history.some((h) => h.action === 'id-migrated' && h.from === oldA));

  // A dependency pointing at a renamed task follows it.
  const dependent = store.listTasks().find((t) => t.id === code + '.2');
  assert.deepEqual(dependent.deps, [{ id: code + '.1', type: 'blocks' }]);

  // Idempotent: nothing left to rename.
  assert.equal(store.migrateIds({ agentId: orch.id }).migrated, 0);

  store.close();

  // Aliases are durable. A restart that forgot them would break every written
  // record that quotes an old id — the exact failure this exists to prevent.
  const reopened = createStore({ dir });
  assert.equal(reopened.canonicalId(oldA), code + '.1');
  // The campaign slug resolves after a restart too.
  assert.equal(reopened.canonicalId('lane-one'), code);
  reopened.close();
  rm(dir);
});

// ---------------------------------------------------------------------------
// WF-G103 + membership inference (D-K, D-O, r9q1)
// ---------------------------------------------------------------------------

test('WF-G103: an effort record moves when its work moves', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'span-orch' });
  store.claimCampaign({
    agentId: orch.id, campaignId: 'span-lane', scope: 'x', paths: ['src/a.ts'],
  });

  const code = store.canonicalId('span-lane');
  const born = store.listCampaigns().find((c) => c.id === code).updatedAt;

  // Creating work inside it moves the record.
  now.advance(60000);
  const t = store.createTask({ agentId: orch.id, title: 'work', campaignId: 'span-lane' });
  const afterCreate = store.listCampaigns().find((c) => c.id === code).updatedAt;
  assert.ok(afterCreate > born, 'creating a task must move the campaign');

  // So does that work changing state.
  now.advance(60000);
  store.setTaskState({ taskId: t.id, agentId: orch.id, state: 'blocked', reason: 'test (WF-G86)' });
  const afterState = store.listCampaigns().find((c) => c.id === code).updatedAt;
  assert.ok(afterState > afterCreate, 'a task state change must move the campaign');

  // THE DEFECT ITSELF: the span must no longer be zero.
  const c = store.listCampaigns().find((x) => x.id === code);
  assert.ok(c.updatedAt > c.createdAt, 'an effort must have a real span, not an instant');

  store.close();
  rm(dir);
});

test('membership: places the certain, refuses to break a tie, and calls the rest standalone', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({
    petSlug: 'gf-sd', handle: 'mem-orch', role: 'orchestrator',
    type: 'codex', sessionId: 'thread-mem',
  });

  // Two efforts claiming DIFFERENT files. They cannot claim the same one — an
  // active lead refuses an overlapping lead — so a tie arises the way it really
  // does: one job that touched files belonging to both.
  const a = store.claimCampaign({ agentId: orch.id, campaignId: 'alpha', scope: 'a', paths: ['src/only-a.ts'] });
  const b = store.claimCampaign({ agentId: orch.id, campaignId: 'beta', scope: 'b', paths: ['src/only-b.ts'] });
  assert.equal(a.ok, true, a.error);
  assert.equal(b.ok, true, b.error);
  const alpha = store.canonicalId('alpha');

  // A task that already names its effort.
  const recorded = store.createTask({ agentId: orch.id, title: 'recorded', campaignId: 'alpha' });

  // Orphans, given file evidence through a claim.
  const placeable = store.createTask({ agentId: orch.id, title: 'touches only-a' });
  const tied = store.createTask({ agentId: orch.id, title: 'touches both' });
  const nothing = store.createTask({ agentId: orch.id, title: 'touches nothing' });
  store.claimTask({ taskId: placeable.id, agentId: orch.id });
  store.checkpointTask({ taskId: placeable.id, agentId: orch.id, did: 'x', files: ['src/only-a.ts'] });
  store.claimTask({ taskId: tied.id, agentId: orch.id });
  store.checkpointTask({ taskId: tied.id, agentId: orch.id, did: 'x', files: ['src/only-a.ts', 'src/only-b.ts'] });

  // A worker must not be able to rewrite membership across the whole board.
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'mem-worker' });
  assert.equal(store.inferTaskMembership({ agentId: worker.id }).ok, false);

  // A dry run changes nothing.
  const preview = store.inferTaskMembership({ agentId: orch.id, dryRun: true });
  assert.ok(preview.changed > 0);
  assert.equal(store.listTasks().find((t) => t.id === placeable.id).membership, '');

  const out = store.inferTaskMembership({ agentId: orch.id });
  const by = new Map(store.listTasks().map((t) => [t.id, t]));

  // Already named: nothing is guessed about it.
  assert.equal(by.get(recorded.id).membership, 'recorded');
  assert.equal(by.get(recorded.id).campaignId, alpha);

  // One effort matched: placed, and the evidence is on the record.
  assert.equal(by.get(placeable.id).membership, 'inferred');
  assert.equal(by.get(placeable.id).campaignId, alpha);
  assert.match(by.get(placeable.id).inferredFrom, /file/);

  // THE RULE THAT MATTERS: two efforts matched, so NEITHER was chosen.
  const t = by.get(tied.id);
  assert.equal(t.membership, 'ambiguous');
  assert.equal(t.campaignId, '', 'a tie must leave the effort EMPTY, never guessed');
  assert.equal(t.inferredCandidates.length, 2, 'both candidates must be recorded');
  assert.match(t.inferredFrom, /2 efforts match/);

  // WF-G170: nothing matched, so the verdict is STANDALONE, not 'unknown'.
  // 'unknown' read as "the board did not look"; the board looked and found
  // nothing, and the verdict now names the evidence that was absent.
  assert.equal(by.get(nothing.id).membership, 'standalone');
  assert.equal(by.get(nothing.id).campaignId, '');
  assert.match(by.get(nothing.id).inferredFrom, /no roadmap reference, wave/);
  assert.equal(out.tally.unknown, 0, 'no task may end as unknown');
  assert.ok(out.tally.standalone >= 1);

  // Every change is on the task's own history.
  assert.ok(by.get(tied.id).history.some((h) => h.action === 'membership'));
  assert.equal(out.tally.ambiguous, 1);

  store.close();

  // One journal event, so replay reproduces every verdict.
  const again = createStore({ dir });
  const replayed = again.listTasks().find((x) => x.id === tied.id);
  assert.equal(replayed.membership, 'ambiguous');
  assert.equal(replayed.campaignId, '');
  again.close();
  rm(dir);
});

// ---------------------------------------------------------------------------
// 2026-09-09 sweep: WF-G83 / WF-G86 / WF-G91
// ---------------------------------------------------------------------------
test('WF-G86: task and campaign state history carries from + reason; blocked refuses without one', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'hist-orch', role: 'orchestrator', sessionId: 'hist-orch-thread' });
  store.claimCampaign({ agentId: orch.id, campaignId: 'hist-lane', scope: 'x', paths: ['src/h.ts'] });
  const t = store.createTask({ agentId: orch.id, title: 'h' });
  store.claimTask({ taskId: t.id, agentId: orch.id });

  const refused = store.setTaskState({ taskId: t.id, agentId: orch.id, state: 'blocked' });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /needs a reason/);

  const blocked = store.setTaskState({ taskId: t.id, agentId: orch.id, state: 'blocked', reason: 'waiting on src/h.ts lock' });
  assert.equal(blocked.ok, true);
  const entry = blocked.task.history[blocked.task.history.length - 1];
  assert.equal(entry.action, 'state');
  assert.equal(entry.from, 'claimed');
  assert.equal(entry.state, 'blocked');
  assert.equal(entry.reason, 'waiting on src/h.ts lock');

  const code = store.canonicalId('hist-lane');
  const noReason = store.setCampaignState({ campaignId: code, agentId: orch.id, state: 'done' });
  assert.equal(noReason.ok, false);
  const closed = store.setCampaignState({ campaignId: code, agentId: orch.id, state: 'done', reason: 'all packets landed' });
  assert.equal(closed.ok, true);
  const centry = closed.campaign.history[closed.campaign.history.length - 1];
  assert.equal(centry.from, 'active');
  assert.equal(centry.state, 'done');
  assert.equal(centry.reason, 'all packets landed');
  store.close();
  rm(dir);
});

test('WF-G83: the command channel may close an UNATTENDED campaign it does not own, with a reason', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceTtlMs: 1000, presenceDropMs: 5000 });
  const owner = store.registerAgent({ petSlug: 'gf-sd', handle: 'gone-owner' });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'a-worker', role: 'worker' });
  const master = store.registerAgent({ petSlug: 'gf-sd', handle: 'the-master', role: 'orchestrator', sessionId: 'master-thread' });
  store.claimCampaign({ agentId: owner.id, campaignId: 'abandoned', scope: 'x', paths: ['tmp/abandoned'] });
  const code = store.canonicalId('abandoned');

  // Owner still live: nobody else may touch it.
  let r = store.setCampaignState({ campaignId: code, agentId: master.id, state: 'done', reason: 'tidy' });
  assert.equal(r.ok, false);
  assert.match(r.error, /owner/);

  now.advance(6000);
  store.touch(master.id);
  store.touch(worker.id);
  assert.equal(store.listCampaigns()[0].ownerStatus, 'gone');
  assert.equal(store.listCampaigns()[0].attended, false);

  // A worker is not the command channel.
  r = store.setCampaignState({ campaignId: code, agentId: worker.id, state: 'done', reason: 'tidy' });
  assert.equal(r.ok, false);
  // The command channel needs a reason.
  r = store.setCampaignState({ campaignId: code, agentId: master.id, state: 'done' });
  assert.equal(r.ok, false);
  assert.match(r.error, /reason/);
  // With one, the abandoned campaign finally has a closure path.
  r = store.setCampaignState({ campaignId: code, agentId: master.id, state: 'done', reason: 'owner session ended 2026-08-28; no tasks; sweep 2026-09-09' });
  assert.equal(r.ok, true);
  assert.equal(r.campaign.state, 'done');
  const entry = r.campaign.history[r.campaign.history.length - 1];
  assert.equal(entry.adoptedClosure, true);
  assert.equal(entry.previousOwner, owner.id);
  assert.equal(entry.from, 'active');
  store.close();
  rm(dir);
});

test('WF-G91: a lock whose path is a suffix of another agent held path IN THE SAME REPO is granted with a warning', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'prefixed' });
  const b = store.registerAgent({ petSlug: 'gf-sd', handle: 'bare' });
  // WF-G119 (2026-09-09) narrowed this warning. It used to fire on
  // 'entity-forge/src/mesh/sdf.ts' vs 'src/mesh/sdf.ts', which are two files in
  // two checkouts and never a conflict — the false alarm taught agents to ignore
  // the warning, which is worse than not having it. The warning now compares
  // only locks whose repo field matches, so the case it was BUILT for is a
  // sub-path spelling inside ONE repo, which is what this test now uses.
  const first = store.acquireLock({ agentId: a.id, paths: ['packages/world/src/mesh/sdf.ts'] });
  assert.equal(first.ok, true);
  assert.deepEqual(first.warnings, []);
  const second = store.acquireLock({ agentId: b.id, paths: ['src/mesh/sdf.ts'] });
  assert.equal(second.ok, true, 'not a provable conflict, so still granted');
  assert.equal(second.warnings.length, 1);
  assert.match(second.warnings[0], /same file/);
  assert.match(second.warnings[0], /packages\/world\/src\/mesh\/sdf\.ts/);
  // An unrelated path warns about nothing.
  const third = store.acquireLock({ agentId: b.id, paths: ['src/mesh/other.ts'] });
  assert.deepEqual(third.warnings, []);
  store.close();
  rm(dir);
});

test('WF-G119: the same relative path in two different checkouts is not a same-file warning', () => {
  const dir = tmpDir();
  const store = createStore({ dir, workspaceRoot: 'F:/Repos/Aralia' });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'in-generator' });
  const b = store.registerAgent({ petSlug: 'gf-sd', handle: 'in-aralia' });
  const REL = 'src/systems/entities3d/three/baseMeshCatalog.ts';
  const foreign = store.acquireLock({ agentId: a.id, paths: ['Entity-Generator/' + REL] });
  assert.equal(foreign.ok, true);
  assert.equal(foreign.lock.repo, 'Entity-Generator');
  const local = store.acquireLock({ agentId: b.id, paths: [REL] });
  assert.equal(local.ok, true);
  assert.equal(local.lock.repo, 'Aralia', "an unprefixed path belongs to the daemon's own workspace");
  assert.deepEqual(local.warnings, [], 'agora-caea coordinated a non-conflict because of this warning');
  store.close();
  rm(dir);
});

// --- WF-G169 / WF-G170 / WF-G171: campaign membership at intake and after ---

test('WF-G171: a task records WHO decided its campaign and why', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({
    petSlug: 'gf-sd', handle: 'intake-orch', role: 'orchestrator',
    type: 'codex', sessionId: 'thread-intake',
  });
  const claimed = store.claimCampaign({ agentId: orch.id, campaignId: 'hull', scope: 's', paths: ['src/hull'] });
  assert.equal(claimed.ok, true, claimed.error);
  const hull = store.canonicalId('hull');

  // A named campaign is the decision.
  const named = store.createTask({ agentId: orch.id, title: 'named', campaignId: 'hull' });
  assert.equal(named.campaignId, hull);
  assert.equal(named.campaignDecision.kind, 'campaign');
  assert.equal(named.membership, 'recorded');

  // WF-G85: the ONE active campaign the creator owns is also a decision, and
  // the record says it was defaulted rather than typed.
  const defaulted = store.createTask({ agentId: orch.id, title: 'defaulted' });
  assert.equal(defaulted.campaignId, hull);
  assert.equal(defaulted.campaignDecision.kind, 'defaulted');
  assert.equal(store.defaultCampaignFor(orch.id), hull);

  // An opt-out is a decision too, and it carries its reason.
  const alone = store.createTask({
    agentId: orch.id, title: 'alone', standalone: true, standaloneReason: 'one-off repair, no effort owns it',
  });
  assert.equal(alone.campaignId, '');
  assert.equal(alone.campaignDecision.kind, 'standalone');
  assert.equal(alone.campaignDecision.reason, 'one-off repair, no effort owns it');
  assert.equal(alone.membership, 'standalone');
  assert.equal(alone.history[0].campaignDecision, 'standalone');
  assert.equal(alone.history[0].reason, 'one-off repair, no effort owns it');

  // An opt-out without a reason is not a decision; it is an omission.
  assert.throws(
    () => store.createTask({ agentId: orch.id, title: 'silent', standalone: true }),
    /standalone task needs a reason/,
  );

  // A creator who owns NO campaign and names none leaves the decision absent,
  // which the HTTP intake refuses. The store records it plainly.
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'intake-worker' });
  const absent = store.createTask({ agentId: worker.id, title: 'absent' });
  assert.equal(absent.campaignDecision.kind, 'absent');
  assert.equal(store.defaultCampaignFor(worker.id), '');

  store.close();
  rm(dir);
});

test('WF-G169: setTaskCampaign moves a task, records the move, and guards every edge', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const orch = store.registerAgent({
    petSlug: 'gf-sd', handle: 'move-orch', role: 'orchestrator',
    type: 'codex', sessionId: 'thread-move',
  });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'move-worker' });
  assert.equal(store.claimCampaign({ agentId: orch.id, campaignId: 'keel', scope: 'k', paths: ['src/keel'] }).ok, true);
  assert.equal(store.claimCampaign({ agentId: orch.id, campaignId: 'mast', scope: 'm', paths: ['src/mast'] }).ok, true);
  const keel = store.canonicalId('keel');
  const mast = store.canonicalId('mast');
  const task = store.createTask({ agentId: orch.id, title: 'plank', campaignId: 'keel' });

  // A worker may not rewrite membership.
  const denied = store.setTaskCampaign({ taskId: task.id, agentId: worker.id, campaignId: 'mast', reason: 'because' });
  assert.equal(denied.ok, false);
  assert.match(denied.error, /needs one of/);

  // A move needs a reason, a real campaign, and an actual change.
  assert.match(store.setTaskCampaign({ taskId: task.id, agentId: orch.id, campaignId: 'mast' }).error, /needs a reason/);
  assert.match(store.setTaskCampaign({ taskId: task.id, agentId: orch.id, campaignId: 'ghost', reason: 'r' }).error, /unknown campaign/);
  assert.match(store.setTaskCampaign({ taskId: task.id, agentId: orch.id, campaignId: 'keel', reason: 'r' }).error, /already in campaign/);
  assert.match(store.setTaskCampaign({ taskId: task.id, agentId: orch.id, reason: 'r' }).error, /name a campaign, or say standalone/);
  assert.match(store.setTaskCampaign({ taskId: 'no-such-task', agentId: orch.id, campaignId: 'mast', reason: 'r' }).error, /task not found/);

  // The move itself.
  const moved = store.setTaskCampaign({
    taskId: task.id, agentId: orch.id, campaignId: 'mast', reason: 'review found the right effort',
  });
  assert.equal(moved.ok, true, moved.error);
  assert.equal(moved.from, keel);
  assert.equal(moved.to, mast);
  assert.equal(moved.task.campaignId, mast);
  assert.equal(moved.task.membership, 'recorded');
  // The id keeps its old spelling on purpose: finished results quote it.
  assert.equal(moved.task.id, task.id);

  // Both sides now agree, which is the acceptance WF-G169 names.
  assert.deepEqual(store.campaignView(mast).tasks.map((x) => x.id), [task.id]);
  assert.deepEqual(store.campaignView(keel).tasks.map((x) => x.id), []);

  // The audit entry holds prior campaign, new campaign, actor and reason.
  const entry = moved.task.history.find((h) => h.action === 'campaign');
  assert.ok(entry, 'the move must leave a history entry');
  assert.equal(entry.from, keel);
  assert.equal(entry.to, mast);
  assert.equal(entry.by, orch.id);
  assert.equal(entry.reason, 'review found the right effort');

  // A finished effort cannot take new work.
  assert.equal(store.setCampaignState({ campaignId: 'keel', agentId: orch.id, state: 'done', reason: 'finished' }).ok, true);
  assert.match(
    store.setTaskCampaign({ taskId: task.id, agentId: orch.id, campaignId: 'keel', reason: 'undo' }).error,
    /is done/,
  );

  // Standalone is a supported destination, with its own reason.
  const loosed = store.setTaskCampaign({
    taskId: task.id, agentId: orch.id, standalone: true, reason: 'split out of the effort',
  });
  assert.equal(loosed.ok, true, loosed.error);
  assert.equal(loosed.task.campaignId, '');
  assert.equal(loosed.task.membership, 'standalone');
  assert.match(loosed.task.inferredFrom, /split out of the effort/);
  assert.match(
    store.setTaskCampaign({ taskId: task.id, agentId: orch.id, standalone: true, reason: 'again' }).error,
    /already standalone/,
  );

  store.close();

  // The move replays: it travels in the ordinary task.edit journal event.
  const again = createStore({ dir });
  const replayed = again.listTasks().find((x) => x.id === task.id);
  assert.equal(replayed.campaignId, '');
  assert.ok(replayed.history.some((h) => h.action === 'campaign' && h.to === mast));
  again.close();
  rm(dir);
});

test('WF-G170: the campaign mapping is pure, and a domain label alone never places a task', () => {
  const campaigns = [
    { id: 'agora-aa11', name: 'combat', paths: ['src/combat'], globs: [], wave: 'w1' },
    { id: 'agora-bb22', name: 'spell-rework', paths: ['src/spells'], globs: [], wave: 'w1' },
    { id: 'agora-cc33', name: 'worldforge/interiors', paths: [], globs: [], wave: '' },
  ];

  // Rank 0 — already recorded.
  assert.deepEqual(
    inferCampaignForTask({ task: { campaignId: 'agora-aa11' }, campaigns }),
    { membership: 'recorded', campaignId: 'agora-aa11', evidence: '', candidates: [] },
  );

  // Rank 1 — a Plan Map reference beats every weaker rank.
  const byRef = inferCampaignForTask({
    task: { refs: ['planmap:worldforge/interiors'], wave: 'w1', category: 'combat' },
    campaigns,
  });
  assert.equal(byRef.membership, 'inferred');
  assert.equal(byRef.campaignId, 'agora-cc33');

  // Rank 2 — a shared wave that two campaigns carry is a tie and places
  // nothing. D-O: never break a tie automatically.
  const tied = inferCampaignForTask({ task: { wave: 'w1' }, campaigns });
  assert.equal(tied.membership, 'ambiguous');
  assert.equal(tied.campaignId, '');
  assert.equal(tied.candidates.length, 2);

  // Rank 3 — a claimed file.
  const byFile = inferCampaignForTask({ task: { retraceFiles: ['src/spells/cast.ts'] }, campaigns });
  assert.equal(byFile.membership, 'inferred');
  assert.equal(byFile.campaignId, 'agora-bb22');

  // Rank 4 — a campaign NAMED for the category places the task.
  const byCategory = inferCampaignForTask({ task: { category: 'combat' }, campaigns });
  assert.equal(byCategory.membership, 'inferred');
  assert.equal(byCategory.campaignId, 'agora-aa11');

  // THE CATEGORY RULE: a domain label with no campaign of that name is NOT
  // evidence. The task is standalone, and the verdict says why.
  const label = inferCampaignForTask({ task: { category: 'races' }, campaigns });
  assert.equal(label.membership, 'standalone');
  assert.equal(label.campaignId, '');
  assert.match(label.evidence, /domain label/);

  // No evidence at all is still a verdict, never 'unknown'.
  const bare = inferCampaignForTask({ task: { category: 'uncategorized' }, campaigns });
  assert.equal(bare.membership, 'standalone');
  assert.match(bare.evidence, /no roadmap reference, wave, claimed file or category/);

  // Pure: the same input always gives the same verdict.
  assert.deepEqual(
    inferCampaignForTask({ task: { category: 'combat' }, campaigns }),
    inferCampaignForTask({ task: { category: 'combat' }, campaigns }),
  );
});
