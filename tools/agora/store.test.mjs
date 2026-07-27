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

// A tiny catalog makes ownership assertions deterministic without coupling
// unit-test meaning to whichever 50 humanoids are currently in the gallery.
const TEST_PETS = [
  { slug: 'test-mage', displayName: 'Test Mage', kind: 'humanoid', localSpritesheet: 'pets/test-mage/spritesheet.webp' },
  { slug: 'test-knight', displayName: 'Test Knight', kind: 'humanoid', localSpritesheet: 'pets/test-knight/spritesheet.webp' },
];

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

  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'alice', note: 'hi' });
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
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'bob' });
  assert.equal(store.getAgentByToken(a.token).id, a.id);
  assert.equal(store.getAgentByToken('nope'), null);
  assert.equal(store.getAgentByToken(), null);
  store.close();
  rm(dir);
});

test('heartbeat-only lease expires an agent and releases its coordination claims', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, heartbeatOnlyLeaseMs: 2000 });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.heartbeat-lease' });
  const lock = store.acquireLock({ agentId: a.id, paths: ['src/lease.ts'] });
  const reservation = store.reserveFiles({ agentId: a.id, paths: ['src/later.ts'] });
  const task = store.createTask({ agentId: a.id, title: 'lease work' });
  store.claimTask({ taskId: task.id, agentId: a.id });
  assert.equal(lock.ok, true);
  assert.equal(reservation.ok, true);

  now.advance(1000);
  assert.equal(store.heartbeatAgent(a.id).ok, true, 'heartbeat works inside the lease');
  now.advance(1000);
  const expired = store.heartbeatAgent(a.id);
  assert.equal(expired.ok, false);
  assert.equal(expired.code, 'heartbeat_lease_expired');
  assert.equal(store.getAgentByToken(a.token), null, 'expired token is invalidated');
  assert.equal(store.listLocks().some((row) => row.agentId === a.id), false);
  assert.equal(store.listReservations().some((row) => row.agentId === a.id), false);
  const reopened = store.listTasks().find((row) => row.id === task.id);
  assert.equal(reopened.state, 'open');
  assert.equal(reopened.history.at(-1).action, 'heartbeat_lease_expired');

  store.close();
  rm(dir);
});

test('meaningful authenticated activity renews the heartbeat-only lease', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, heartbeatOnlyLeaseMs: 2000 });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.heartbeat-renewal' });

  now.advance(1500);
  assert.equal(store.heartbeatAgent(a.id).ok, true);
  store.touch(a.id);
  now.advance(1500);
  assert.equal(store.heartbeatAgent(a.id).ok, true, 'activity resets the heartbeat-only lease');

  store.close();
  rm(dir);
});

test('sweep proactively enforces the heartbeat-only lease for a detached helper', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({
    dir,
    now,
    heartbeatOnlyLeaseMs: 2000,
    presenceDropMs: 10000,
  });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'worker.detached-heartbeat' });
  const task = store.createTask({ agentId: a.id, title: 'detached work' });
  store.claimTask({ taskId: task.id, agentId: a.id });

  now.advance(500);
  assert.equal(store.heartbeatAgent(a.id).ok, true);
  now.advance(1500);
  store.sweepExpired();

  assert.equal(store.getAgentByToken(a.token), null);
  const reopened = store.listTasks().find((row) => row.id === task.id);
  assert.equal(reopened.state, 'open');
  assert.equal(reopened.history.at(-1).action, 'heartbeat_lease_expired');

  store.close();
  rm(dir);
});

// --- locks -----------------------------------------------------------------

test('locks: free path succeeds, different agent overlap conflicts, holder releases', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now });
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'a' });
  const b = store.registerAgent({ petSlug: 'gf-sd', handle: 'b' });

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
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'a' });
  const b = store.registerAgent({ petSlug: 'gf-sd', handle: 'b' });

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
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'a' });

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
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'a' });
  const b = store.registerAgent({ petSlug: 'gf-sd', handle: 'b' });

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
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'a' });

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

test('workflow-gap coordination: canonical FIFO, stale force release, lock renewal, and reasoning provenance', () => {
  const dir = tmpDir();
  const now = makeClock();
  const workspaceRoot = path.resolve('F:/Repos/Aralia');
  const store = createStore({
    dir,
    now,
    presenceTtlMs: 1000,
    workspaceRoot,
    petCatalog: TEST_PETS,
  });
  const a = store.registerAgent({
    petSlug: 'test-mage',
    handle: 'codex-canonical-a',
    model: 'gpt-5.6-sol',
    reasoningEffort: 'medium',
    sessionId: 'thread-a',
  });
  const b = store.registerAgent({ petSlug: 'test-knight', handle: 'canonical-b' });
  assert.equal(store.listAgents().find((agent) => agent.id === a.id).reasoningEffort, 'medium');

  const reservation = store.reserveFiles({ agentId: a.id, paths: ['public/planmap/topics.json'] });
  assert.equal(reservation.ok, true);
  const absoluteEquivalent = path.join(workspaceRoot, 'public', 'planmap', 'topics.json');
  const leapfrog = store.acquireLock({ agentId: b.id, paths: [absoluteEquivalent] });
  assert.equal(leapfrog.ok, false);
  assert.equal(leapfrog.conflict.type, 'reservation');

  const onlineForce = store.releaseReservation({ agentId: b.id, target: reservation.reservation.id, force: true });
  assert.equal(onlineForce.ok, false);
  assert.match(onlineForce.error, /online/);
  now.advance(1001);
  const staleForce = store.releaseReservation({ agentId: b.id, target: reservation.reservation.id, force: true });
  assert.equal(staleForce.ok, true);

  const lock = store.acquireLock({ agentId: b.id, paths: ['src/renew.ts'], ttlMs: 500 });
  assert.equal(lock.ok, true);
  now.advance(100);
  const renewed = store.renewLock({ lockId: lock.lock.id, agentId: b.id, ttlMs: 2000 });
  assert.equal(renewed.ok, true);
  assert.equal(renewed.lock.expiresAt, now() + 2000);
  const deniedRenewal = store.renewLock({ lockId: lock.lock.id, agentId: a.id, ttlMs: 2000 });
  assert.equal(deniedRenewal.ok, false);

  store.close();
  rm(dir);
});

test('sweep releases stale reservations without reaping the holder lock or task', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({
    dir,
    now,
    presenceTtlMs: 1000,
    presenceDropMs: 5000,
    petCatalog: TEST_PETS,
  });
  const holder = store.registerAgent({ petSlug: 'test-mage', handle: 'stale-reserver' });
  const successor = store.registerAgent({ petSlug: 'test-knight', handle: 'queued-successor' });

  // Give the soon-to-be-stale worker a reservation plus unrelated durable work.
  // The stale sweep should unblock the queue without treating quiet work as dead.
  const head = store.reserveFiles({ agentId: holder.id, paths: ['src/queued.ts'] });
  const queued = store.reserveFiles({ agentId: successor.id, paths: ['src/queued.ts'] });
  const heldLock = store.acquireLock({ agentId: holder.id, paths: ['src/in-progress.ts'] });
  const heldTask = store.createTask({ agentId: holder.id, title: 'preserve quiet work' });
  store.claimTask({ taskId: heldTask.id, agentId: holder.id });

  // Exactly at the ten-minute-equivalent boundary the holder is still online,
  // matching the force-release rule's inclusive protection.
  now.advance(1000);
  store.touch(successor.id);
  store.sweepExpired();
  assert.deepEqual(store.listReservations().map((row) => row.id), [head.reservation.id, queued.reservation.id]);

  // One millisecond later only the stale holder loses its queue position. The
  // online successor becomes head and can take the requested lock immediately.
  now.advance(1);
  store.touch(successor.id);
  store.sweepExpired();
  const reservations = store.listReservations();
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0].id, queued.reservation.id);
  assert.equal(reservations[0].position, 1);
  const successorLock = store.acquireLock({ agentId: successor.id, paths: ['src/queued.ts'] });
  assert.equal(successorLock.ok, true);

  // Reservation recovery is intentionally narrower than agent reaping: the
  // stale worker's unrelated lock and claimed task remain protected.
  assert.equal(store.listLocks().some((lock) => lock.id === heldLock.lock.id), true);
  assert.equal(store.listTasks().find((task) => task.id === heldTask.id).state, 'claimed');

  store.close();
  rm(dir);
});

test('pet capacity recovery retires only stale idle presence', () => {
  const dir = tmpDir();
  const now = makeClock();
  const store = createStore({ dir, now, presenceTtlMs: 1000, petCatalog: TEST_PETS });
  const orchestrator = store.registerAgent({
    petSlug: 'test-mage',
    handle: 'capacity-orchestrator',
    role: 'orchestrator',
    sessionId: 'capacity-thread',
  });
  const target = store.registerAgent({ petSlug: 'test-knight', handle: 'capacity-target' });

  const online = store.retireStaleIdleAgent({ requesterId: orchestrator.id, targetAgentId: target.id });
  assert.equal(online.ok, false);
  assert.match(online.error, /online/);

  const held = store.acquireLock({ agentId: target.id, paths: ['src/capacity.ts'] });
  now.advance(1001);
  store.touch(orchestrator.id);
  assert.equal(store.listAgents().find((agent) => agent.id === target.id).capacityRecoverable, false);
  const owning = store.retireStaleIdleAgent({ requesterId: orchestrator.id, targetAgentId: target.id });
  assert.equal(owning.ok, false);
  assert.match(owning.error, /holds locks/);

  store.releaseLock({ lockId: held.lock.id, agentId: target.id });
  assert.equal(store.listAgents().find((agent) => agent.id === target.id).capacityRecoverable, true);
  const recovered = store.retireStaleIdleAgent({ requesterId: orchestrator.id, targetAgentId: target.id });
  assert.equal(recovered.ok, true);
  const replacement = store.registerAgent({ petSlug: 'test-knight', handle: 'capacity-replacement' });
  assert.equal(replacement.pet.slug, 'test-knight');
  assert.equal(new Set(store.listAgents().map((agent) => agent.pet.slug)).size, store.listAgents().length);

  store.close();
  rm(dir);
});

// --- tasks -----------------------------------------------------------------

test('task lifecycle: create -> claim -> in_progress -> done; double-claim rejected; handoff', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock(), petCatalog: TEST_PETS });
  const a = store.registerAgent({ handle: 'a', petSlug: 'test-mage' });
  const b = store.registerAgent({ handle: 'b', petSlug: 'test-knight' });

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
  assert.ok(TEST_PETS.some((pet) => pet.slug === c.task.assignedPet.slug));
  assert.equal(c.task.claimedAgent.pet.slug, c.task.assignedPet.slug);
  assert.equal(c.task.history.at(-1).petSlug, c.task.assignedPet.slug);
  assert.equal(store.listAgents().find((agent) => agent.id === a.id).pet.slug, c.task.assignedPet.slug);

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
  assert.equal(h.task.claimedAgent.id, b.id);
  assert.equal(h.task.claimedAgent.pet.slug, h.task.assignedPet.slug);
  assert.notEqual(h.task.assignedPet.slug, c.task.assignedPet.slug, 'live agents receive different pets while the catalog has room');
  assert.equal(store.listAgents().find((agent) => agent.id === b.id).pet.slug, h.task.assignedPet.slug);

  // A released task has no current owner or pet; the historical handoff entry
  // still retains the pet slug that accompanied the assignment.
  store.retireAgent(b.id, { note: 'test release' });
  const reopened = store.listTasks().find((task) => task.id === t2.id);
  assert.equal(reopened.state, 'open');
  assert.equal(reopened.claimedBy, null);
  assert.equal(reopened.claimedAgent, null);
  assert.equal(reopened.assignedPet, null);
  assert.ok(reopened.history.some((entry) => entry.action === 'handoff' && entry.petSlug));

  // listTasks filter
  assert.equal(store.listTasks({ state: 'done' }).length, 1);
  assert.equal(store.listTasks().length, 2);

  store.close();
  rm(dir);
});

test('presence registration requires an explicit pet at the store boundary', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  assert.throws(
    () => store.registerAgent({ handle: 'petless-worker' }),
    /petSlug.*required/,
  );
  assert.equal(store.listAgents().length, 0);

  store.close();
  rm(dir);
});

test('presence registration fails honestly when no pet catalog is available', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock(), petCatalog: [] });
  assert.throws(
    () => store.registerAgent({ handle: 'catalogless-worker', petSlug: 'test-mage' }),
    /unknown petSlug/,
  );
  assert.equal(store.listAgents().length, 0);

  store.close();
  rm(dir);
});

test('presence pets stay unique, substitute occupied choices, and become reusable after retirement', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock(), petCatalog: TEST_PETS });

  const first = store.registerAgent({ handle: 'first-worker', petSlug: 'test-mage' });
  const second = store.registerAgent({ handle: 'second-worker', petSlug: 'test-mage' });
  assert.equal(first.pet.slug, 'test-mage');
  assert.equal(second.pet.slug, 'test-knight');
  assert.equal(second.requestedPetSlug, 'test-mage');
  assert.equal(second.petSubstituted, true);
  assert.equal(new Set(store.listAgents().map((agent) => agent.pet.slug)).size, 2);

  const catalog = store.listPetIdentities();
  assert.equal(catalog.find((pet) => pet.slug === 'test-mage').available, false);
  assert.equal(catalog.find((pet) => pet.slug === 'test-mage').claimedBy.handle, 'first-worker');
  assert.throws(
    () => store.registerAgent({ handle: 'third-worker', petSlug: 'test-mage' }),
    (error) => error && error.code === 'AGORA_PET_CATALOG_EXHAUSTED',
  );

  // Retiring the original owner releases its identity for the next explicit
  // choice; the substituted second agent keeps its own assignment.
  store.retireAgent(first.id);
  const replacement = store.registerAgent({ handle: 'third-worker', petSlug: 'test-mage' });
  assert.equal(replacement.pet.slug, 'test-mage');
  assert.equal(replacement.petSubstituted, false);

  store.close();
  rm(dir);
});

test('Codex and governance registrations require task/thread provenance at the store boundary', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  for (const registration of [
    { petSlug: 'gf-sd', handle: 'codex-worker' },
    { petSlug: 'gf-sd', handle: 'typed-worker', type: 'codex' },
    { petSlug: 'gf-sd', handle: 'model-worker', model: 'gpt-5.6-sol' },
    { petSlug: 'gf-sd', handle: 'lead', role: 'orchestrator' },
  ]) {
    assert.throws(() => store.registerAgent(registration), /task\/thread id.*required/i);
  }
  assert.equal(store.listAgents().length, 0);

  const codex = store.registerAgent({
    petSlug: 'gf-sd', handle: 'codex-worker', sessionId: '  thread-codex  ',
  });
  const orchestrator = store.registerAgent({
    petSlug: 'gf-sd', handle: 'lead', role: 'orchestrator', sessionId: 'thread-lead',
  });
  assert.equal(codex.sessionId, 'thread-codex');
  assert.equal(orchestrator.sessionId, 'thread-lead');
  assert.equal(store.listAgents().find((agent) => agent.id === codex.id).threadIdRequired, true);

  store.close();
  rm(dir);
});

// --- messaging -------------------------------------------------------------

test('messages: command channel is role-gated and filtered separately', () => {
  const dir = tmpDir();
  const store = createStore({ dir, now: makeClock() });
  const worker = store.registerAgent({ petSlug: 'gf-sd', handle: 'w' }); // role defaults to worker
  const orch = store.registerAgent({ petSlug: 'gf-sd', handle: 'o', role: 'orchestrator', sessionId: 'thread-o' });
  const human = store.registerAgent({ petSlug: 'gf-sd', handle: 'h', role: 'human' });
  const master = store.registerAgent({ petSlug: 'gf-sd', handle: 'm', role: 'master', sessionId: 'thread-m' });

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
  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'a' });
  const b = store.registerAgent({ petSlug: 'gf-sd', handle: 'b' });
  const c = store.registerAgent({ petSlug: 'gf-sd', handle: 'c' });

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

  const a = store.registerAgent({ petSlug: 'gf-sd', handle: 'a' }); // agent.register
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
  const a = s1.registerAgent({ petSlug: 'gf-sd', handle: 'alice' });
  const b = s1.registerAgent({ petSlug: 'gf-sd', handle: 'bob' });
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
  const a = s1.registerAgent({ petSlug: 'gf-sd', handle: 'alice' });
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
