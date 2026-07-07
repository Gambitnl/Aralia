// tools/agora/store.test.mjs
// Unit tests for the Agora store. Node built-in test runner only — no vitest.
//   node --test tools/agora/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { createStore } from './store.mjs';

// --- helpers ---------------------------------------------------------------

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

/** A controllable clock. */
function makeClock(start = 1_000_000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => {
    t += ms;
    return t;
  };
  now.set = (v) => {
    t = v;
    return t;
  };
  return now;
}

// --- presence --------------------------------------------------------------

test('presence: online -> stale -> dropped as the clock advances', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceTtlMs: 1000, presenceDropMs: 5000 });

  const a = store.registerAgent({ handle: 'alice', note: 'hi' });
  assert.equal(a.handle, 'alice');
  assert.equal(a.status, 'online');
  assert.ok(a.token);

  let agents = store.listAgents();
  assert.equal(agents.length, 1);
  assert.equal(agents[0].status, 'online');

  // within TTL -> still online
  now.advance(500);
  assert.equal(store.listAgents()[0].status, 'online');

  // past TTL but within drop -> stale
  now.advance(1000); // total 1500 > 1000
  assert.equal(store.listAgents()[0].status, 'stale');

  // touch refreshes
  store.touch(a.id);
  assert.equal(store.listAgents()[0].status, 'online');

  // beyond drop -> gone from active list
  now.advance(6000);
  assert.equal(store.listAgents().length, 0);

  store.close();
  rm(dir);
});

test('getAgentByToken returns the agent or null', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  const a = store.registerAgent({ handle: 'bob' });
  assert.equal(store.getAgentByToken(a.token).id, a.id);
  assert.equal(store.getAgentByToken('nope'), null);
  assert.equal(store.getAgentByToken(), null);
  store.close();
  rm(dir);
});

// --- locks -----------------------------------------------------------------

test('locks: free path succeeds, different agent overlap conflicts, holder releases', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now });
  const a = store.registerAgent({ handle: 'a' });
  const b = store.registerAgent({ handle: 'b' });

  const r1 = store.acquireLock({ agentId: a.id, paths: ['src/foo.ts'], reason: 'edit' });
  assert.equal(r1.ok, true);
  assert.ok(r1.lock.id);

  // different agent, same path -> conflict
  const r2 = store.acquireLock({ agentId: b.id, paths: ['src/foo.ts'] });
  assert.equal(r2.ok, false);
  assert.equal(r2.conflict.path, 'src/foo.ts');
  assert.equal(r2.conflict.heldBy, a.id);
  assert.equal(r2.conflict.lock.id, r1.lock.id);

  // same agent re-locking its own path is allowed (no conflict)
  const r3 = store.acquireLock({ agentId: a.id, paths: ['src/foo.ts'] });
  assert.equal(r3.ok, true);

  // non-holder cannot release
  const rel1 = store.releaseLock({ lockId: r1.lock.id, agentId: b.id });
  assert.equal(rel1.ok, false);
  assert.match(rel1.error, /holder/);

  // holder releases
  const rel2 = store.releaseLock({ lockId: r1.lock.id, agentId: a.id });
  assert.equal(rel2.ok, true);

  // now b can lock it (note r3 is also still held by a; release that too)
  store.releaseLock({ lockId: r3.lock.id, agentId: a.id });
  const r4 = store.acquireLock({ agentId: b.id, paths: ['src/foo.ts'] });
  assert.equal(r4.ok, true);

  store.close();
  rm(dir);
});

test('locks: glob overlap — A locks src/**/*.ts, B locking src/foo.ts conflicts', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  const a = store.registerAgent({ handle: 'a' });
  const b = store.registerAgent({ handle: 'b' });

  const r1 = store.acquireLock({ agentId: a.id, globs: ['src/**/*.ts'] });
  assert.equal(r1.ok, true);

  const conflict = store.acquireLock({ agentId: b.id, paths: ['src/foo.ts'] });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.conflict.path, 'src/foo.ts');

  const nested = store.acquireLock({ agentId: b.id, paths: ['src/deep/bar.ts'] });
  assert.equal(nested.ok, false);

  // a non-matching path is fine
  const ok = store.acquireLock({ agentId: b.id, paths: ['docs/readme.md'] });
  assert.equal(ok.ok, true);

  // two equal globs conflict
  const eq = store.acquireLock({ agentId: b.id, globs: ['src/**/*.ts'] });
  assert.equal(eq.ok, false);

  store.close();
  rm(dir);
});

test('locks: auto-expiry — sweepExpired drops past-TTL lock and emits lock.expired', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now });
  const a = store.registerAgent({ handle: 'a' });

  const events = [];
  store.subscribe((e) => events.push(e));

  const r = store.acquireLock({ agentId: a.id, paths: ['x'], ttlMs: 100 });
  assert.equal(r.ok, true);
  assert.equal(store.listLocks().length, 1);

  // before expiry
  now.advance(50);
  store.sweepExpired();
  assert.equal(store.listLocks().length, 1);

  // after expiry
  now.advance(100); // total 150 > 100
  // even before sweep, listLocks filters expired
  assert.equal(store.listLocks().length, 0);
  store.sweepExpired();
  assert.equal(store.listLocks().length, 0);

  const expired = events.filter((e) => e.type === 'lock.expired');
  assert.equal(expired.length, 1);
  assert.equal(expired[0].payload.lockId, r.lock.id);

  store.close();
  rm(dir);
});

test('reservations: queued agents keep FIFO dibs and the head is fulfilled by locking', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  const a = store.registerAgent({ handle: 'a' });
  const b = store.registerAgent({ handle: 'b' });

  const first = store.reserveFiles({ agentId: a.id, paths: ['tools/agora/dashboard/index.html'], reason: 'dashboard edit' });
  assert.equal(first.ok, true);
  assert.equal(first.reservation.position, 1);
  assert.equal(first.reservation.queueSeq, 1);

  const second = store.reserveFiles({ agentId: b.id, paths: ['tools/agora/dashboard/index.html'], reason: 'follow-up edit' });
  assert.equal(second.ok, true);
  assert.equal(second.reservation.position, 2);
  assert.equal(second.reservation.queueSeq, 2);

  const jump = store.acquireLock({ agentId: b.id, paths: ['tools/agora/dashboard/index.html'] });
  assert.equal(jump.ok, false);
  assert.equal(jump.conflict.type, 'reservation');
  assert.equal(jump.conflict.reservation.agentId, a.id);
  assert.equal(jump.conflict.reservation.position, 1);

  const lock = store.acquireLock({ agentId: a.id, paths: ['tools/agora/dashboard/index.html'] });
  assert.equal(lock.ok, true);

  const remaining = store.listReservations();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].agentId, b.id);
  assert.equal(remaining[0].position, 1);

  store.close();
  rm(dir);
});

test('reservations: holder can cancel by id or covered path', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  const a = store.registerAgent({ handle: 'a' });

  const first = store.reserveFiles({ agentId: a.id, paths: ['src/a.ts'], reason: 'later' });
  assert.equal(first.ok, true);

  const byPath = store.releaseReservation({ agentId: a.id, target: 'src/a.ts' });
  assert.equal(byPath.ok, true);
  assert.equal(store.listReservations().length, 0);

  const second = store.reserveFiles({ agentId: a.id, paths: ['src/b.ts'], reason: 'later' });
  assert.equal(second.ok, true);

  const byId = store.releaseReservation({ agentId: a.id, target: second.reservation.id });
  assert.equal(byId.ok, true);
  assert.equal(store.listReservations().length, 0);

  store.close();
  rm(dir);
});

// --- tasks -----------------------------------------------------------------

test('task lifecycle: create -> claim -> in_progress -> done; double-claim rejected; handoff', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  const a = store.registerAgent({ handle: 'a' });
  const b = store.registerAgent({ handle: 'b' });

  const t = store.createTask({ agentId: a.id, title: 'do thing', body: 'details' });
  assert.equal(t.state, 'open');
  assert.equal(t.createdBy, a.id);
  assert.deepEqual(t.creatorAgent, {
    id: a.id,
    handle: 'a',
    note: '',
    model: '',
    sessionId: '',
  });
  assert.equal('token' in t.creatorAgent, false);
  assert.equal(t.history.length, 1);

  assert.throws(
    () => store.createTask({ agentId: 'missing-agent', title: 'bad creator' }),
    /registered creator agent is required/,
  );

  const c = store.claimTask({ taskId: t.id, agentId: a.id });
  assert.equal(c.ok, true);
  assert.equal(c.task.state, 'claimed');
  assert.equal(c.task.claimedBy, a.id);

  // double-claim by another agent rejected
  const c2 = store.claimTask({ taskId: t.id, agentId: b.id });
  assert.equal(c2.ok, false);
  assert.match(c2.error, /already claimed/);

  const s1 = store.setTaskState({ taskId: t.id, agentId: a.id, state: 'in_progress' });
  assert.equal(s1.ok, true);
  assert.equal(s1.task.state, 'in_progress');

  const s2 = store.setTaskState({ taskId: t.id, agentId: a.id, state: 'done' });
  assert.equal(s2.ok, true);
  assert.equal(s2.task.state, 'done');
  // history accumulated: created, claimed, in_progress, done
  assert.equal(s2.task.history.length, 4);

  // invalid state rejected
  const bad = store.setTaskState({ taskId: t.id, agentId: a.id, state: 'frobnicate' });
  assert.equal(bad.ok, false);

  // handoff reassigns claimedBy
  const t2 = store.createTask({ agentId: a.id, title: 'second' });
  store.claimTask({ taskId: t2.id, agentId: a.id });
  const h = store.handoffTask({ taskId: t2.id, agentId: a.id, toAgentId: b.id });
  assert.equal(h.ok, true);
  assert.equal(h.task.claimedBy, b.id);

  // listTasks filter
  assert.equal(store.listTasks({ state: 'done' }).length, 1);
  assert.equal(store.listTasks().length, 2);

  store.close();
  rm(dir);
});

// --- messaging -------------------------------------------------------------

test('messages: command channel is role-gated and filtered separately', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  const worker = store.registerAgent({ handle: 'w' }); // role defaults to worker
  const orch = store.registerAgent({ handle: 'o', role: 'orchestrator' });
  const human = store.registerAgent({ handle: 'h', role: 'human' });
  const master = store.registerAgent({ handle: 'm', role: 'master' });

  // Workers may not post on the command channel.
  const refused = store.postMessage({ agentId: worker.id, to: 'all', body: 'sneak', channel: 'command' });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /command channel/);

  // Orchestrator, human, and master may.
  for (const sender of [orch, human, master]) {
    const r = store.postMessage({ agentId: sender.id, to: 'all', body: 'directive', channel: 'command' });
    assert.equal(r.ok, true);
    assert.equal(r.message.channel, 'command');
  }

  // Workers still post fine on main, and an unknown channel lands on main.
  assert.equal(store.postMessage({ agentId: worker.id, to: 'all', body: 'status' }).ok, true);
  assert.equal(store.postMessage({ agentId: worker.id, to: 'all', body: 'odd', channel: 'weird' }).message.channel, 'main');

  // Channel filtering: default read = main only; command and all opt in.
  assert.equal(store.getMessages({}).length, 2);
  assert.equal(store.getMessages({ channel: 'command' }).length, 3);
  assert.equal(store.getMessages({ channel: 'all' }).length, 5);

  store.close();
  rm(dir);
});

test('messages: broadcast + direct routing, since cursor', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  const a = store.registerAgent({ handle: 'a' });
  const b = store.registerAgent({ handle: 'b' });
  const c = store.registerAgent({ handle: 'c' });

  const m1 = store.postMessage({ agentId: a.id, to: 'all', body: 'hello all' });
  assert.equal(m1.ok, true);
  assert.equal(m1.message.seq, 1);
  const m2 = store.postMessage({ agentId: a.id, to: b.id, body: 'psst b' });
  assert.equal(m2.ok, true);
  assert.equal(m2.message.seq, 2);

  // b sees broadcast + its direct
  const forB = store.getMessages({ to: b.id });
  assert.equal(forB.length, 2);

  // c sees only the broadcast (not a->b direct)
  const forC = store.getMessages({ to: c.id });
  assert.equal(forC.length, 1);
  assert.equal(forC[0].body, 'hello all');

  // sender a sees both (broadcast + its own direct via from===to)
  const forA = store.getMessages({ to: a.id });
  assert.equal(forA.length, 2);

  // since cursor
  const after1 = store.getMessages({ since: 1 });
  assert.equal(after1.length, 1);
  assert.equal(after1[0].seq, 2);

  // since + to combined
  const after1B = store.getMessages({ since: 1, to: b.id });
  assert.equal(after1B.length, 1);
  assert.equal(after1B[0].seq, 2);

  store.close();
  rm(dir);
});

// --- pub/sub ---------------------------------------------------------------

test('subscribe: subscriber receives an event per mutation; unsubscribe stops them', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  const events = [];
  const unsub = store.subscribe((e) => events.push(e));

  const a = store.registerAgent({ handle: 'a' }); // agent.register
  store.acquireLock({ agentId: a.id, paths: ['p'] }); // lock.acquire
  store.postMessage({ agentId: a.id, to: 'all', body: 'x' }); // message.post

  assert.deepEqual(
    events.map((e) => e.type),
    ['agent.register', 'lock.acquire', 'message.post'],
  );
  // each event has a monotonic seq + ts
  assert.ok(events.every((e, i) => e.seq === i + 1 && typeof e.ts === 'number'));

  unsub();
  store.postMessage({ agentId: a.id, to: 'all', body: 'y' });
  assert.equal(events.length, 3); // no new events after unsubscribe

  store.close();
  rm(dir);
});

// --- durability ------------------------------------------------------------

test('durability: snapshot + journal replay reconstructs identical state', () => {
  const dir = tmpDir();
  const now = makeClock();

  // First store: a bunch of mutations, then close (final snapshot).
  let s1 = createStore({ dir, now });
  const a = s1.registerAgent({ handle: 'alice' });
  const b = s1.registerAgent({ handle: 'bob' });
  s1.acquireLock({ agentId: a.id, globs: ['src/**/*.ts'], reason: 'refactor' });
  const t = s1.createTask({ agentId: a.id, title: 'task one', body: 'body' });
  s1.claimTask({ taskId: t.id, agentId: a.id });
  s1.setTaskState({ taskId: t.id, agentId: a.id, state: 'in_progress' });
  s1.postMessage({ agentId: a.id, to: 'all', body: 'broadcast' });
  s1.postMessage({ agentId: a.id, to: b.id, body: 'direct' });

  const before = {
    agents: s1.listAgents(),
    locks: s1.listLocks(),
    tasks: s1.listTasks(),
    messages: s1.getMessages(),
    lastSeq: s1.lastSeq,
  };
  s1.close();

  // Second store on the SAME dir — must rebuild identical state.
  const s2 = createStore({ dir, now });
  const after = {
    agents: s2.listAgents(),
    locks: s2.listLocks(),
    tasks: s2.listTasks(),
    messages: s2.getMessages(),
    lastSeq: s2.lastSeq,
  };

  assert.deepEqual(after.agents, before.agents);
  assert.deepEqual(after.locks, before.locks);
  assert.deepEqual(after.tasks, before.tasks);
  assert.deepEqual(after.messages, before.messages);
  assert.equal(after.lastSeq, before.lastSeq);

  s2.close();
  rm(dir);
});

test('durability: replay works without a snapshot (journal-only, mid-session crash)', () => {
  const dir = tmpDir();
  const now = makeClock();

  // Mutate but DO NOT close (no snapshot) — simulate a crash by abandoning s1.
  const s1 = createStore({ dir, now });
  const a = s1.registerAgent({ handle: 'alice' });
  s1.acquireLock({ agentId: a.id, paths: ['x.ts'] });
  s1.createTask({ agentId: a.id, title: 'survive' });
  // no s1.close() — snapshot.json absent, journal.jsonl has the events.

  const s2 = createStore({ dir, now });
  assert.equal(s2.listAgents().length, 1);
  assert.equal(s2.listLocks().length, 1);
  assert.equal(s2.listTasks().length, 1);
  assert.equal(s2.listTasks()[0].title, 'survive');

  s2.close();
  rm(dir);
});
