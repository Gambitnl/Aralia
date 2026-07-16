// tools/agora/store.identity.test.mjs
// Wave 1 of the fleet-coordination epic: agent identity & provenance.
// Node built-in test runner only — no vitest.  node --test "tools/agora/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import * as S from './store.mjs';

function tmpDir() {
  const d = path.join(os.tmpdir(), 'agora-identity-test', crypto.randomUUID());
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function makeClock(start = 1_000_000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
}

// --- validateHandle: structured, provenance-encoding grammar --------------

test('validateHandle accepts structured role.domain[/child] handles', () => {
  for (const h of ['master.desktop', 'orch.planmap', 'orch.planmap/glossary', 'worker.combat-view', 'orch.a/b/c']) {
    const r = S.validateHandle(h);
    assert.equal(r.ok, true, `expected "${h}" valid but got: ${r.reason}`);
  }
});

test('validateHandle rejects opaque, single-segment, empty and malformed handles', () => {
  for (const h of ['agent-16d417', 'alice', '', 'Orch.Planmap', 'orch.', '.desktop', 'orch..planmap', 'a b.c']) {
    const r = S.validateHandle(h);
    assert.equal(r.ok, false, `expected "${h}" invalid but it passed`);
    assert.ok(r.reason && r.reason.length > 0, `expected a reason for "${h}"`);
  }
});

// --- identity fields on the agent record ----------------------------------

test('registerAgent carries identity + provenance fields', () => {
  const store = S.createStore({ dir: tmpDir(), now: makeClock() });
  const a = store.registerAgent({
    handle: 'orch.planmap',
    type: 'claude-subagent',
    role: 'worker',
    model: 'opus-4.8',
    spawnedBy: 'master.desktop',
    campaign: 'planmap-ui',
    cwd: 'F:/Repos/Aralia',
  });
  assert.equal(a.type, 'claude-subagent');
  assert.equal(a.role, 'worker');
  assert.equal(a.spawnedBy, 'master.desktop');
  assert.equal(a.campaign, 'planmap-ui');
  assert.equal(a.cwd, 'F:/Repos/Aralia');
});

test('registerAgent defaults identity fields to empty strings', () => {
  const store = S.createStore({ dir: tmpDir(), now: makeClock() });
  const a = store.registerAgent({ handle: 'worker.x' });
  assert.equal(a.type, '');
  assert.equal(a.spawnedBy, '');
  assert.equal(a.campaign, '');
  assert.equal(a.cwd, '');
  // role is fable's field, not ours; it defaults to 'worker', not ''.
  assert.equal(a.role, 'worker');
});

test('registerAgent stamps handleValid from the grammar', () => {
  const store = S.createStore({ dir: tmpDir(), now: makeClock() });
  assert.equal(store.registerAgent({ handle: 'orch.planmap' }).handleValid, true);
  assert.equal(store.registerAgent({ handle: 'agent-16d417' }).handleValid, false);
});

test('listAgents surfaces the identity fields', () => {
  const store = S.createStore({ dir: tmpDir(), now: makeClock() });
  store.registerAgent({ handle: 'orch.x', role: 'orchestrator', type: 'codex' });
  const found = store.listAgents().find((x) => x.handle === 'orch.x');
  assert.equal(found.role, 'orchestrator');
  assert.equal(found.type, 'codex');
});

// --- clean exit: retire ----------------------------------------------------

test('retireAgent releases locks, reopens in-flight tasks with a clean "retired" marker, and drops the agent', () => {
  const store = S.createStore({ dir: tmpDir(), now: makeClock() });
  const a = store.registerAgent({ handle: 'worker.retire', role: 'worker' });

  assert.equal(store.acquireLock({ agentId: a.id, paths: ['src/x.ts'], reason: 'edit' }).ok, true);
  assert.equal(store.reserveFiles({ agentId: a.id, paths: ['src/next.ts'], reason: 'later' }).ok, true);
  const task = store.createTask({ agentId: a.id, title: 'do x' });
  assert.equal(store.claimTask({ taskId: task.id, agentId: a.id }).ok, true);

  const res = store.retireAgent(a.id);
  assert.equal(res.ok, true);

  assert.equal(store.listAgents().find((x) => x.id === a.id), undefined, 'agent dropped from roster');
  assert.equal(store.listLocks().filter((l) => l.agentId === a.id).length, 0, 'locks released');
  assert.equal(store.listReservations().filter((r) => r.agentId === a.id).length, 0, 'reservations released');

  const t = store.listTasks().find((x) => x.id === task.id);
  assert.equal(t.state, 'open', 'task reopened');
  assert.equal(t.claimedBy, null, 'task unassigned');
  const last = t.history[t.history.length - 1];
  assert.equal(last.action, 'retired', 'clean "retired" marker, not "reaped"');
});

test('retireAgent records an optional final note on the reopened task', () => {
  const store = S.createStore({ dir: tmpDir(), now: makeClock() });
  const a = store.registerAgent({ handle: 'worker.note', role: 'worker' });
  const task = store.createTask({ agentId: a.id, title: 'do y' });
  store.claimTask({ taskId: task.id, agentId: a.id });

  store.retireAgent(a.id, { note: 'left after step 2; next is wiring' });

  const t = store.listTasks().find((x) => x.id === task.id);
  const last = t.history[t.history.length - 1];
  assert.equal(last.action, 'retired');
  assert.equal(last.note, 'left after step 2; next is wiring');
});

test('retireAgent on an unknown agent returns not-ok', () => {
  const store = S.createStore({ dir: tmpDir(), now: makeClock() });
  assert.equal(store.retireAgent('nope').ok, false);
});
