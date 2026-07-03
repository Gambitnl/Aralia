// tools/agora/store.orchestration.test.mjs
// Orchestrator-upgrade tests: task deps/priority/refs/result, ready-queue +
// claim-next, dead-agent reaping, and stale-holder force lock release.
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
  const me = store.registerAgent({ handle: 'orch' });

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
  const me = store.registerAgent({ handle: 'orch' });
  assert.throws(
    () => store.createTask({ agentId: me.id, title: 'bad', deps: ['nope-no-such-task'] }),
    /unknown dep/,
  );
  store.close();
  rm(dir);
});

test('tasks: done accepts a structured result, stored on the task and in history', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const me = store.registerAgent({ handle: 'worker' });
  const t = store.createTask({ agentId: me.id, title: 'fix the thing' });
  store.claimTask({ taskId: t.id, agentId: me.id });
  const r = store.setTaskState({
    taskId: t.id,
    agentId: me.id,
    state: 'done',
    result: 'edited 3 files; 12 tests green; no tsc errors',
  });
  assert.equal(r.ok, true);
  assert.equal(r.task.result, 'edited 3 files; 12 tests green; no tsc errors');
  const last = r.task.history[r.task.history.length - 1];
  assert.equal(last.result, 'edited 3 files; 12 tests green; no tsc errors');
  store.close();
  rm(dir);
});

test('tasks: claimNextReady atomically claims the top-priority ready task', () => {
  const dir = tmpDir();
  const store = createStore({ dir });
  const me = store.registerAgent({ handle: 'orch' });
  const w = store.registerAgent({ handle: 'worker' });

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

// --- dead-agent reaping ------------------------------------------------------

test('reaping: a dropped agent frees its locks, reopens its tasks, and loses its token', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceTtlMs: 1000, presenceDropMs: 5000 });

  const orch = store.registerAgent({ handle: 'orch' });
  const w = store.registerAgent({ handle: 'doomed-worker' });
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
  const w = store.registerAgent({ handle: 'worker' });
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
  const orch = store.registerAgent({ handle: 'orch' });
  const w1 = store.registerAgent({ handle: 'w1' });
  const w2 = store.registerAgent({ handle: 'w2' });
  const rogue = store.registerAgent({ handle: 'rogue' });

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

// --- stale-holder force release ----------------------------------------------

test('locks: force release works only when the holder is stale or gone', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceTtlMs: 1000, presenceDropMs: 60000 });
  const holder = store.registerAgent({ handle: 'holder' });
  const other = store.registerAgent({ handle: 'other' });
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

test('persistence: deps/priority/refs/result survive snapshot + journal replay', () => {
  const dir = tmpDir();
  let store = createStore({ dir });
  const me = store.registerAgent({ handle: 'orch' });
  const a = store.createTask({ agentId: me.id, title: 'A' });
  const b = store.createTask({
    agentId: me.id, title: 'B', deps: [a.id], priority: 7, refs: ['worldforge:G3'],
  });
  store.claimTask({ taskId: a.id, agentId: me.id });
  store.setTaskState({ taskId: a.id, agentId: me.id, state: 'done', result: 'proof: 4 tests' });
  store.close(); // snapshots

  store = createStore({ dir });
  const tasks = store.listTasks();
  const a2 = tasks.find((t) => t.id === a.id);
  const b2 = tasks.find((t) => t.id === b.id);
  assert.equal(a2.result, 'proof: 4 tests');
  assert.deepEqual(b2.deps, [a.id]);
  assert.equal(b2.priority, 7);
  assert.deepEqual(b2.refs, ['worldforge:G3']);
  // B is ready now that A is done — readiness computed from restored state.
  assert.deepEqual(store.listTasks({ ready: true }).map((t) => t.id), [b.id]);
  store.close();
  rm(dir);
});
