// WF-G297: file waiters learn when to try, and holders see who is blocked.
// These tests use disposable journals and a controlled clock. No shared file,
// live presence, or production lock is changed by the fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from './store.mjs';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-queue-notices-'));
  let time = 5000000;
  const options = { dir, now: () => time, seatRosterPath: null, presenceTtlMs: 1000,
    presenceDropMs: 5000, heartbeatOnlyLeaseMs: 10000 };
  let store = createStore(options);
  const holder = store.registerAgent({ handle: 'holder', petSlug: 'gf-sd' });
  const first = store.registerAgent({ handle: 'first', petSlug: 'dream-girl' });
  const second = store.registerAgent({ handle: 'second', petSlug: 'cyberman' });
  return { holder, first, second, options, dir,
    get store() { return store; },
    advance(ms) { time += ms; },
    reload() { store.close(); store = createStore(options); },
    notices(agent) { return store.getMessages({ to: agent.id }).filter(m => m.from === 'system'); },
    available(agent) { return this.notices(agent).filter(m => m.body.includes('available to attempt')); },
    cleanup() {
      store.close();
      assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
      assert.match(path.basename(dir), /^agora-queue-notices-/);
      fs.rmSync(dir, { recursive: true, force: true });
    } };
}

test('WF-G297: holder notices, heartbeat and unlock expose waiters; only the head learns availability', () => {
  const f = fixture();
  try {
    const lock = f.store.acquireLock({ agentId: f.holder.id, paths: ['src/queue.ts'] }).lock;
    const a = f.store.reserveFiles({ agentId: f.first.id, paths: ['src/queue.ts'], reason: 'repair fixtures' }).reservation;
    f.store.reserveFiles({ agentId: f.second.id, paths: ['src/queue.ts'], reason: 'review repair' });
    assert.equal(f.notices(f.holder).length, 2);
    assert.match(f.notices(f.holder)[0].body, /first is waiting at #1.*repair fixtures/);
    const beat = f.store.heartbeatAgent(f.holder.id);
    assert.deepEqual(beat.waiters.map(w => [w.handle, w.position]), [['first', 1], ['second', 2]]);
    assert.equal(f.store.renewLock({ lockId: lock.id, agentId: f.holder.id }).waiters.length, 2);
    assert.equal(f.notices(f.holder).length, 2, 'heartbeat/renew do not spam durable messages');
    assert.equal(f.available(f.first).length, 0);
    const released = f.store.releaseLock({ lockId: lock.id, agentId: f.holder.id });
    assert.deepEqual(released.waiters.map(w => [w.handle, w.ready]), [['first', true], ['second', false]]);
    assert.equal(f.available(f.first).length, 1);
    assert.ok(f.available(f.first)[0].body.includes(a.id));
    assert.match(f.available(f.first)[0].body, /Acquire the real lock before editing/);
    assert.equal(f.available(f.second).length, 0);
    const denied = f.store.acquireLock({ agentId: f.second.id, paths: ['src/queue.ts'] });
    assert.equal(denied.ok, false, 'notice is not a queue bypass');
    const acquired = f.store.acquireLock({ agentId: f.first.id, paths: ['src/queue.ts'] });
    assert.equal(acquired.ok, true);
    assert.equal(f.store.listReservations()[0].position, 1);
    assert.equal(f.available(f.second).length, 0, 'promotion alone cannot free a held file');
    f.store.releaseLock({ agentId: f.first.id, lockId: acquired.lock.id });
    assert.equal(f.available(f.second).length, 1);
  } finally { f.cleanup(); }
});

test('WF-G297: canonical duplicate reservations retain position and notify the holder once', () => {
  const f = fixture();
  try {
    f.store.acquireLock({ agentId: f.holder.id, paths: ['src/queue.ts'] });
    const first = f.store.reserveFiles({ agentId: f.first.id, paths: ['src/queue.ts'], reason: 'first request' });
    const repeat = f.store.reserveFiles({ agentId: f.first.id, paths: [path.resolve('src/queue.ts')], reason: 'retry request' });
    assert.equal(repeat.reused, true);
    assert.equal(repeat.reservation.id, first.reservation.id);
    assert.equal(repeat.reservation.reason, 'first request');
    assert.equal(f.store.listReservations().length, 1);
    assert.equal(f.notices(f.holder).length, 1);
  } finally { f.cleanup(); }
});

test('WF-G297: multi-file and glob waiters are not notified until every held target is free', () => {
  const f = fixture();
  try {
    const a = f.store.acquireLock({ agentId: f.holder.id, paths: ['src/a.ts', 'src/keep.ts'] }).lock;
    const b = f.store.acquireLock({ agentId: f.second.id, paths: ['src/b.ts'] }).lock;
    f.store.reserveFiles({ agentId: f.first.id, globs: ['src/?.ts'], reason: 'both sources needed' });
    const shrunk = f.store.shrinkLock({ agentId: f.holder.id, lockId: a.id, paths: ['src/a.ts'] });
    assert.equal(shrunk.waiters.length, 1);
    assert.equal(shrunk.waiters[0].ready, false);
    assert.deepEqual(shrunk.lock.paths, ['src/keep.ts']);
    assert.equal(f.available(f.first).length, 0);
    f.store.releaseLock({ agentId: f.second.id, lockId: b.id });
    assert.equal(f.available(f.first).length, 1);
    assert.deepEqual(f.store.listLocks().find(l => l.id === a.id).paths, ['src/keep.ts']);
  } finally { f.cleanup(); }
});

for (const mode of ['expiry', 'retire', 'reap', 'heartbeat-lease']) {
  test(`WF-G297: ${mode} frees a held file and notifies a live waiter once`, () => {
    const f = fixture();
    try {
      f.store.acquireLock({ agentId: f.holder.id, paths: ['src/lifecycle.ts'], ttlMs: mode === 'expiry' ? 50 : 60000 });
      f.store.reserveFiles({ agentId: f.first.id, paths: ['src/lifecycle.ts'] });
      if (mode === 'retire') f.store.retireAgent(f.holder.id);
      else {
        if (mode === 'heartbeat-lease') f.store.heartbeatAgent(f.holder.id);
        f.advance(mode === 'expiry' ? 60 : mode === 'reap' ? 6000 : 11000);
        f.store.touch(f.first.id);
        f.store.sweepExpired();
      }
      assert.equal(f.available(f.first).length, 1);
      f.store.sweepExpired();
      f.store.heartbeatAgent(f.first.id);
      assert.equal(f.available(f.first).length, 1);
      assert.equal(f.store.listLocks().length, 0);
    } finally { f.cleanup(); }
  });
}

test('WF-G297: head cancellation and stale-head cleanup notify the next eligible waiter', () => {
  for (const stale of [false, true]) {
    const f = fixture();
    try {
      const first = f.store.reserveFiles({ agentId: f.first.id, paths: ['src/free.ts'] }).reservation;
      f.store.reserveFiles({ agentId: f.second.id, paths: ['src/free.ts'] });
      assert.equal(f.available(f.second).length, 0);
      if (stale) { f.advance(1100); f.store.touch(f.second.id); f.store.sweepExpired(); }
      else f.store.releaseReservation({ agentId: f.first.id, target: first.id });
      assert.equal(f.available(f.second).length, 1);
      assert.equal(f.store.listReservations()[0].agentId, f.second.id);
    } finally { f.cleanup(); }
  }
});

test('WF-G297: availability notices survive snapshot/replay and re-arm only after a new held interval', () => {
  const f = fixture();
  try {
    const lock = f.store.acquireLock({ agentId: f.holder.id, paths: ['src/rearm.ts'], ttlMs: 100 }).lock;
    f.store.reserveFiles({ agentId: f.first.id, paths: ['src/rearm.ts'] });
    f.advance(110);
    f.store.heartbeatAgent(f.first.id);
    assert.equal(f.available(f.first).length, 1);
    // An unswept expired lock can still be deliberately renewed by its owner.
    // The old notice remains evidence, but a later free interval needs a new one.
    f.store.renewLock({ agentId: f.holder.id, lockId: lock.id, ttlMs: 100 });
    f.advance(110);
    f.store.heartbeatAgent(f.first.id);
    assert.equal(f.available(f.first).length, 2);
    f.reload();
    f.store.sweepExpired();
    f.store.heartbeatAgent(f.first.id);
    assert.equal(f.available(f.first).length, 2, 'restart is not a new availability interval');
    const baselineSnapshot = fs.readFileSync(path.join(f.dir, 'snapshot.json'));
    f.store.snapshot();
    f.store.releaseReservation({ agentId: f.first.id, target: f.store.listReservations()[0].id });
    f.store.reserveFiles({ agentId: f.second.id, paths: ['src/replay.ts'] });
    const journal = fs.readFileSync(path.join(f.dir, 'journal.jsonl'));
    const events = journal.toString().trim().split('\n').map(line => JSON.parse(line));
    const delivered = events.find(event => event.payload.message?.body.includes('src/replay.ts'));
    assert.equal(delivered.type, 'message.post');
    assert.equal(delivered.payload.reservationNotice.ready, true, 'delivery and marker share one durable event');
    f.store.close();
    // Restore only fixture bytes to prove recovery from a snapshot plus actual
    // journal events, without leaving any production file handle open.
    fs.writeFileSync(path.join(f.dir, 'snapshot.json'), baselineSnapshot);
    fs.writeFileSync(path.join(f.dir, 'journal.jsonl'), journal);
    const replayed = createStore(f.options);
    try {
      replayed.heartbeatAgent(f.second.id);
      assert.equal(replayed.getMessages({ to: f.second.id }).filter(m => m.body.includes('src/replay.ts')).length, 1);
    } finally { replayed.close(); }
  } finally { f.cleanup(); }
});
