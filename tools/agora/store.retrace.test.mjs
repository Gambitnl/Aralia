// tools/agora/store.retrace.test.mjs
// This file proves Agora can recover a crashed worker's task trail without
// trusting expired locks or unauthorized checkpoint writers. It exercises the
// durable store directly with a controllable clock, including production-order
// lock expiry before active-task reap, checkpoint ownership, and reapCount.
// Node built-in runner only.
//   node --test "tools/agora/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import * as S from './store.mjs';

function tmpDir() {
  const d = path.join(os.tmpdir(), 'agora-retrace-test', crypto.randomUUID());
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function makeClock(start = 1_000_000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
}

test('preserve-on-reap: reaping an agent stamps a retrace dossier and reapCount on its reopened task', () => {
  const now = makeClock();
  const store = S.createStore({ dir: tmpDir(), now, presenceTtlMs: 1000, presenceDropMs: 5000 });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.dead', type: 'codex', sessionId: 'thread-dead', spawnedBy: 'orch.x', campaign: 'c1' });
  store.acquireLock({ agentId: a.id, paths: ['src/z.ts'], reason: 'editing z' });
  const task = store.createTask({ agentId: a.id, title: 'do z' });
  store.claimTask({ taskId: task.id, agentId: a.id });
  store.postMessage({ agentId: a.id, body: 'PROGRESS: wired half of z' });

  now.advance(20000); // past 2x the drop horizon (the agent holds work)
  store.sweepExpired();

  const t = store.listTasks().find((x) => x.id === task.id);
  assert.equal(t.state, 'open');
  assert.equal(t.reapCount, 1);
  assert.ok(t.retrace, 'retrace dossier present');
  assert.equal(t.retrace.agent.handle, 'worker.dead');
  assert.equal(t.retrace.agent.type, 'codex');
  assert.equal(t.retrace.agent.spawnedBy, 'orch.x');
  assert.deepEqual(t.retrace.filesHeld.flatMap((f) => f.paths), ['src/z.ts']);
  assert.ok(t.retrace.sayTail.some((m) => /PROGRESS/.test(m.body)), 'say breadcrumbs captured');
  assert.equal(t.history[t.history.length - 1].action, 'reaped');
});

test('checkpointTask records a latest-wins note that is captured into the dossier on reap', () => {
  const now = makeClock();
  const store = S.createStore({ dir: tmpDir(), now, presenceTtlMs: 1000, presenceDropMs: 5000 });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.cp', role: 'worker' });
  const task = store.createTask({ agentId: a.id, title: 'do cp' });
  store.claimTask({ taskId: task.id, agentId: a.id });
  store.checkpointTask({ taskId: task.id, agentId: a.id, did: 'step 1', next: 'step 2' });
  store.checkpointTask({ taskId: task.id, agentId: a.id, did: 'step 2', next: 'step 3', files: ['a.ts', 'b.ts'] });

  const mid = store.listTasks().find((x) => x.id === task.id);
  assert.equal(mid.checkpoint.did, 'step 2'); // latest wins
  assert.deepEqual(mid.checkpoint.files, ['a.ts', 'b.ts']);

  now.advance(20000);
  store.sweepExpired();
  const t = store.listTasks().find((x) => x.id === task.id);
  assert.equal(t.retrace.checkpoint.did, 'step 2');
  assert.equal(t.retrace.checkpoint.next, 'step 3');
});

test('checkpointTask accepts only the current claimant of a claimed or in-progress task', () => {
  const dir = tmpDir();
  const store = S.createStore({ dir, now: makeClock() });
  const owner = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.checkpoint-owner' });
  const intruder = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.checkpoint-intruder' });
  const task = store.createTask({ agentId: owner.id, title: 'guard the checkpoint' });

  // Creation does not imply ownership: an open/unclaimed task cannot receive a
  // checkpoint, even from its creator.
  const unclaimed = store.checkpointTask({ taskId: task.id, agentId: owner.id, did: 'too early' });
  assert.equal(unclaimed.ok, false);
  assert.equal(unclaimed.code, 'task_not_active');

  store.claimTask({ taskId: task.id, agentId: owner.id });

  // Authentication is not enough. A different registered agent cannot replace
  // the active claimant's recovery note.
  const crossAgent = store.checkpointTask({ taskId: task.id, agentId: intruder.id, did: 'overwrite' });
  assert.equal(crossAgent.ok, false);
  assert.equal(crossAgent.code, 'not_task_claimant');

  const accepted = store.checkpointTask({ taskId: task.id, agentId: owner.id, did: 'owned step' });
  assert.equal(accepted.ok, true);

  // Blocked and completed tasks retain their last valid note but reject new
  // writes because neither state represents active claimant work.
  store.setTaskState({ taskId: task.id, agentId: owner.id, state: 'blocked' });
  const blocked = store.checkpointTask({ taskId: task.id, agentId: owner.id, did: 'blocked overwrite' });
  assert.equal(blocked.code, 'task_not_active');
  store.setTaskState({ taskId: task.id, agentId: owner.id, state: 'done' });
  const done = store.checkpointTask({ taskId: task.id, agentId: owner.id, did: 'done overwrite' });
  assert.equal(done.code, 'task_not_active');
  assert.equal(store.listTasks().find((row) => row.id === task.id).checkpoint.did, 'owned step');

  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('production ordering preserves expired-lock and checkpoint files until the later active-task reap', () => {
  const dir = tmpDir();
  const now = makeClock();
  // These are the production defaults: locks expire at 30 minutes, while a
  // claimed task doubles the 60-minute presence horizon to 120 minutes.
  let store = S.createStore({ dir, now, presenceDropMs: 3_600_000, lockTtlMs: 1_800_000 });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.production-order' });
  const task = store.createTask({ agentId: worker.id, title: 'survive the timing gap' });
  store.claimTask({ taskId: task.id, agentId: worker.id });
  store.setTaskState({ taskId: task.id, agentId: worker.id, state: 'in_progress' });
  store.acquireLock({ agentId: worker.id, paths: ['src/expired-lock.ts'], reason: 'production repair' });
  store.checkpointTask({
    taskId: task.id,
    agentId: worker.id,
    did: 'created a new helper',
    next: 'finish integration',
    files: ['src/checkpoint-only.ts'],
  });

  // The first sweep observes real production order: the lock disappears after
  // 30 minutes, but the task and claimant remain live on the board.
  now.advance(1_800_001);
  store.sweepExpired();
  assert.equal(store.listLocks().length, 0);
  assert.equal(store.listTasks().find((row) => row.id === task.id).state, 'in_progress');

  // Restart from the durable snapshot before reap. This proves the recovered
  // scope is persisted board evidence, not an in-memory side effect of the
  // earlier lock object.
  store.close();
  store = S.createStore({ dir, now, presenceDropMs: 3_600_000, lockTtlMs: 1_800_000 });

  // Once total silence exceeds 120 minutes, the reap dossier must still carry
  // both the expired-lock path and the checkpoint-only file.
  now.advance(5_400_001);
  store.sweepExpired();
  const reopened = store.listTasks().find((row) => row.id === task.id);
  assert.equal(reopened.state, 'open');
  assert.deepEqual(reopened.retrace.filesHeld, [], 'no live lock remains at reap time');
  assert.deepEqual(
    [...reopened.retrace.files].sort(),
    ['src/checkpoint-only.ts', 'src/expired-lock.ts'],
  );

  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a clean retire does not stamp a crash dossier or bump reapCount', () => {
  const store = S.createStore({ dir: tmpDir(), now: makeClock() });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.clean', role: 'worker' });
  const task = store.createTask({ agentId: a.id, title: 'do clean' });
  store.claimTask({ taskId: task.id, agentId: a.id });

  store.retireAgent(a.id, { note: 'done properly' });

  const t = store.listTasks().find((x) => x.id === task.id);
  assert.equal(t.state, 'open');
  assert.equal(t.retrace, undefined, 'no crash dossier on a clean exit');
  assert.ok(t.reapCount === undefined || t.reapCount === 0, 'reapCount not bumped by retire');
  assert.equal(t.history[t.history.length - 1].action, 'retired');
});

test('reapCount rises across repeated reaps of the same task', () => {
  const now = makeClock();
  const store = S.createStore({ dir: tmpDir(), now, presenceTtlMs: 1000, presenceDropMs: 5000 });

  const a1 = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.v1' });
  const task = store.createTask({ agentId: a1.id, title: 'cursed' });
  store.claimTask({ taskId: task.id, agentId: a1.id });
  now.advance(20000);
  store.sweepExpired();

  const a2 = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.v2' });
  store.claimTask({ taskId: task.id, agentId: a2.id });
  now.advance(20000);
  store.sweepExpired();

  const t = store.listTasks().find((x) => x.id === task.id);
  assert.equal(t.reapCount, 2);
});
