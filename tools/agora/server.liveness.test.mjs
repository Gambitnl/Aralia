// tools/agora/server.liveness.test.mjs
// Deadlock/liveness handling proven end-to-end through the REAL daemon
// (createAgoraServer) on an ephemeral port with an injected clock.
//
//   node --test tools/agora/server.liveness.test.mjs
//
// The store-level rules already have unit coverage (store.test.mjs
// 'locks: auto-expiry ...', 'locks: sweepExpired emits one lock.expiring ...',
// store.orchestration.test.mjs 'reaping: a dropped agent frees its locks ...').
// What those cannot show is that a worker sitting on the HTTP surface actually
// SEES the recovery: that the freed file becomes lockable by someone else, that
// the reaped worker's bearer stops working, and that a heartbeat is enough to
// keep a lock alive right up to the heartbeat-only lease and no further. A
// deadlocked board is the failure this daemon exists to prevent, so the proof
// belongs at the surface the board talks to.
//
// The clock is injected: the real horizons are 60 min / 2 h, and no test may
// wait for them. The sweep is driven explicitly via app.store.sweepExpired()
// rather than the daemon's 30 s setInterval, for the same reason.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { createStore } from './store.mjs';

// A tiny catalog keeps pet assignment deterministic without coupling this test
// to whichever humanoids are in the shipped gallery.
const TEST_PETS = [
  { slug: 'liveness-a', displayName: 'Liveness A', kind: 'humanoid', localSpritesheet: 'pets/a/spritesheet.webp' },
  { slug: 'liveness-b', displayName: 'Liveness B', kind: 'humanoid', localSpritesheet: 'pets/b/spritesheet.webp' },
  { slug: 'liveness-c', displayName: 'Liveness C', kind: 'humanoid', localSpritesheet: 'pets/c/spritesheet.webp' },
  { slug: 'liveness-d', displayName: 'Liveness D', kind: 'humanoid', localSpritesheet: 'pets/d/spritesheet.webp' },
];

// Short horizons in the same PROPORTIONS as production (drop = 6x presence TTL,
// heartbeat-only lease = 2x drop), so the ordering the daemon relies on is what
// is being tested, not a set of unrelated numbers.
const PRESENCE_TTL_MS = 10_000;
const PRESENCE_DROP_MS = 60_000;
const HEARTBEAT_LEASE_MS = 120_000;

let app;
let port;
let tmpDir;
let clock = Date.UTC(2026, 8, 9, 9, 0, 0);
const now = () => clock;
const advance = (ms) => { clock += ms; return clock; };

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-liveness-test-'));
  app = createAgoraServer({
    dir: tmpDir,
    storeFactory: ({ dir }) => createStore({
      dir,
      now,
      petCatalog: TEST_PETS,
      presenceTtlMs: PRESENCE_TTL_MS,
      presenceDropMs: PRESENCE_DROP_MS,
      heartbeatOnlyLeaseMs: HEARTBEAT_LEASE_MS,
      // The seat roster is a tracked repo file; a test must never write it.
      seatRosterPath: null,
    }),
  });
  await new Promise((resolve) => app.listen(0, resolve));
  port = app.server.address().port;
});

after(async () => {
  if (app) await app.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function request(method, pathname, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let petCursor = -1;
async function registerAgent(handle) {
  petCursor += 1;
  const r = await request('POST', '/agents/register', {
    body: { handle, petSlug: TEST_PETS[petCursor % TEST_PETS.length].slug, sessionId: `session-${handle}`, note: 'liveness test' },
  });
  assert.equal(r.status, 201, r.raw);
  return { id: r.json.agentId, token: r.json.token };
}

// A meaningful authenticated call — the thing a heartbeat deliberately is NOT.
// It renews presence AND restarts the heartbeat-only lease, which is how a
// working agent stays alive across a long test timeline.
async function stayAlive(agent) {
  const r = await request('POST', '/messages', { token: agent.token, body: { to: 'all', body: 'still working' } });
  assert.equal(r.status, 201, r.raw);
}

test('a crashed worker is reaped: its lock frees long before the lock TTL, its task reopens, and its token dies', async () => {
  const doomed = await registerAgent('doomed-worker');
  const FILE = 'src/systems/liveness/crashed.ts';

  // The crashed worker holds BOTH a long lock and a claimed task — the exact
  // shape that would deadlock the board if reaping waited for the lock TTL.
  const created = await request('POST', '/tasks', {
    token: doomed.token,
    body: { title: 'work the crashed worker was holding', body: 'liveness probe' },
  });
  assert.equal(created.status, 201, created.raw);
  const taskId = created.json.task.id;
  const claimed = await request('POST', `/tasks/${taskId}/claim`, { token: doomed.token });
  assert.equal(claimed.status, 200, claimed.raw);

  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const lock = await request('POST', '/locks', {
    token: doomed.token,
    body: { paths: [FILE], reason: 'agora-dd1a.3 crash probe', ttlMs: THREE_HOURS },
  });
  assert.equal(lock.status, 201, lock.raw);
  const lockExpiresAt = lock.json.lock.expiresAt;

  // The worker dies. A silent worker holding a claimed task gets DOUBLE the
  // drop horizon (WF-G4 grace), so at 1x it must still be untouched.
  advance(PRESENCE_DROP_MS + 1000);
  app.store.sweepExpired();
  assert.equal(
    (await request('GET', '/locks')).json.locks.filter((l) => l.id === lock.json.lock.id).length,
    1,
    'a quiet worker mid-task keeps its lock inside the doubled grace',
  );

  // Past 2x the horizon it is presumed crashed.
  advance(PRESENCE_DROP_MS + 1000);
  app.store.sweepExpired();

  // The lock is gone even though its own TTL is nearly three hours away: reap
  // frees locks NOW, it does not wait out the TTL.
  assert.ok(lockExpiresAt - clock > 2 * 60 * 60 * 1000, 'the lock TTL has not lapsed');
  const locksAfter = (await request('GET', '/locks')).json.locks;
  assert.equal(locksAfter.filter((l) => l.id === lock.json.lock.id).length, 0, 'reap released the lock');

  // The successor arrives after the crash, as a replacement worker would.
  const successor = await registerAgent('successor-worker');
  // The successor can take the file — the deadlock the daemon exists to prevent.
  const retake = await request('POST', '/locks', {
    token: successor.token,
    body: { paths: [FILE], reason: 'inheriting the file' },
  });
  assert.equal(retake.status, 201, retake.raw);

  // The task went back to open, unclaimed, with a "reaped" history entry.
  const task = (await request('GET', '/tasks?state=open')).json.tasks.find((t) => t.id === taskId);
  assert.ok(task, 'the reaped worker\'s task is back on the open board');
  assert.equal(task.state, 'open');
  assert.ok(!task.claimedBy, 'the dead worker no longer owns the task');
  assert.equal(task.history[task.history.length - 1].action, 'reaped');

  // The reaped bearer stops authenticating, so a zombie cannot resume editing.
  const zombie = await request('POST', '/agents/heartbeat', { token: doomed.token });
  assert.equal(zombie.status, 401, zombie.raw);

  await request('DELETE', `/locks/${retake.json.lock.id}`, { token: successor.token });
});

test('a heartbeat keeps a lock alive past the drop horizon, and the heartbeat-only lease ends it at 2x', async () => {
  const beater = await registerAgent('heartbeat-worker');
  const FILE = 'src/systems/liveness/heartbeat.ts';
  const leaseStart = clock; // registration is the last meaningful activity

  const lock = await request('POST', '/locks', {
    token: beater.token,
    body: { paths: [FILE], reason: 'held while quiet', ttlMs: 4 * 60 * 60 * 1000 },
  });
  assert.equal(lock.status, 201, lock.raw);

  // Quiet but alive: heartbeats every half presence-TTL carry the worker well
  // past the drop horizon without a single meaningful call.
  for (let elapsed = 0; elapsed < PRESENCE_DROP_MS + 20_000; elapsed += PRESENCE_TTL_MS / 2) {
    advance(PRESENCE_TTL_MS / 2);
    const beat = await request('POST', '/agents/heartbeat', { token: beater.token });
    assert.equal(beat.status, 200, beat.raw);
    app.store.sweepExpired();
  }
  assert.ok(clock - leaseStart > PRESENCE_DROP_MS, 'we are past the drop horizon');
  assert.equal(
    (await request('GET', '/locks')).json.locks.filter((l) => l.id === lock.json.lock.id).length,
    1,
    'heartbeats alone kept the lock',
  );
  const listed = (await request('GET', '/locks')).json.locks.find((l) => l.id === lock.json.lock.id);
  assert.equal(listed.holderStatus, 'online');

  // Heartbeats are not work: the heartbeat-only lease is capped at 2x the drop
  // horizon from the last MEANINGFUL call. Past it the next beat is 410 and the
  // same cleanup runs immediately.
  advance(HEARTBEAT_LEASE_MS);
  const expired = await request('POST', '/agents/heartbeat', { token: beater.token });
  assert.equal(expired.status, 410, expired.raw);
  assert.equal(expired.json.code, 'heartbeat_lease_expired');
  assert.equal(
    (await request('GET', '/locks')).json.locks.filter((l) => l.id === lock.json.lock.id).length,
    0,
    'the expired lease released the lock',
  );
});

test('a lapsing lock warns its holder once and then expires on the live daemon feed', async () => {
  const holder = await registerAgent('lapse-worker');
  const FILE = 'src/systems/liveness/lapse.ts';
  const events = [];
  const unsubscribe = app.store.subscribe((e) => {
    if (e.type === 'lock.expiring' || e.type === 'lock.expired') events.push(e);
  });

  // A 6-minute lock with the production 5-minute warning window.
  const lock = await request('POST', '/locks', {
    token: holder.token,
    body: { paths: [FILE], reason: 'about to lapse', ttlMs: 360_000 },
  });
  assert.equal(lock.status, 201, lock.raw);
  const lockId = lock.json.lock.id;

  // The holder keeps working throughout: this test is about the LOCK lapsing
  // under a live holder, not about the holder being reaped (that is test 1).
  advance(30_000);
  await stayAlive(holder);
  app.store.sweepExpired();
  assert.equal(events.length, 0, 'no warning outside the 5-minute window');

  advance(60_000); // 90 s in, 270 s remaining — inside the warn window
  await stayAlive(holder);
  app.store.sweepExpired();
  app.store.sweepExpired(); // one-shot: sweeping twice must not double-warn
  const warnings = events.filter((e) => e.type === 'lock.expiring' && e.payload.lockId === lockId);
  assert.equal(warnings.length, 1, 'exactly one T-minus warning per TTL window');
  assert.ok(warnings[0].payload.remainingMs > 0 && warnings[0].payload.remainingMs <= 300_000);

  // Past the TTL the daemon stops serving the lock and emits lock.expired. The
  // holder keeps checking in in small steps so it is the LOCK that lapses.
  for (let i = 0; i < 10; i += 1) {
    advance(30_000);
    await stayAlive(holder);
  }
  assert.equal(
    (await request('GET', '/locks')).json.locks.filter((l) => l.id === lockId).length,
    0,
    'GET /locks never returns a lapsed lock, sweep or no sweep',
  );
  app.store.sweepExpired();
  assert.equal(events.filter((e) => e.type === 'lock.expired' && e.payload.lockId === lockId).length, 1);

  if (typeof unsubscribe === 'function') unsubscribe();
});
