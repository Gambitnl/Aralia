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

import { createStore } from './store.mjs';

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
  assert.deepEqual(b.deps, [a.id]);
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
  assert.equal(blocked.conflict.campaign.id, 'ui-playtest');

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
  assert.equal(joined.campaign.leadCampaignId, 'ui-playtest');

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
  assert.equal(task.campaignId, 'governance');
  assert.equal(task.wave, 'governance-wave');
  store.close();

  // Snapshot/replay keeps both the campaign ownership and task namespace.
  store = createStore({ dir });
  const campaigns = store.listCampaigns();
  assert.equal(campaigns.length, 1);
  assert.equal(campaigns[0].id, 'governance');
  const restored = store.listTasks().find((t) => t.id === task.id);
  assert.equal(restored.campaignId, 'governance');
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
  assert.deepEqual(b2.deps, [a.id]);
  assert.equal(b2.priority, 7);
  assert.deepEqual(b2.refs, ['worldforge:G3']);
  // B is ready now that A is done — readiness computed from restored state.
  assert.deepEqual(store.listTasks({ ready: true }).map((t) => t.id), [b.id]);
  store.close();
  rm(dir);
});
