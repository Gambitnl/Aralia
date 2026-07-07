// tools/agora/store.retrace.test.mjs
// Wave 2 of the fleet-coordination epic: agent-retrace. Preserve-on-reap dossier,
// reapCount, and the resumable checkpoint. Node built-in runner only.
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
  const a = store.registerAgent({ handle: 'worker.dead', type: 'codex', spawnedBy: 'orch.x', campaign: 'c1' });
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
  const a = store.registerAgent({ handle: 'worker.cp', role: 'worker' });
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

test('a clean retire does not stamp a crash dossier or bump reapCount', () => {
  const store = S.createStore({ dir: tmpDir(), now: makeClock() });
  const a = store.registerAgent({ handle: 'worker.clean', role: 'worker' });
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

  const a1 = store.registerAgent({ handle: 'worker.v1' });
  const task = store.createTask({ agentId: a1.id, title: 'cursed' });
  store.claimTask({ taskId: task.id, agentId: a1.id });
  now.advance(20000);
  store.sweepExpired();

  const a2 = store.registerAgent({ handle: 'worker.v2' });
  store.claimTask({ taskId: task.id, agentId: a2.id });
  now.advance(20000);
  store.sweepExpired();

  const t = store.listTasks().find((x) => x.id === task.id);
  assert.equal(t.reapCount, 2);
});
