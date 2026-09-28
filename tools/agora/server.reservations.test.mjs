// tools/agora/server.reservations.test.mjs
// WF-G116 (reservation order on lock EXPIRY, holder idle time on `locks`) and
// WF-G119 (the `repo` field on locks and campaigns), proven through the real
// HTTP daemon with an injected clock.
//
//   node --test tools/agora/server.reservations.test.mjs
//
// The 2026-09-09 board reported that a worker who reserved src/types/world.ts at
// 08:22 lost it to a LATER reserver when the holder's lock lapsed. FIFO dibs are
// the only fairness the board offers, so "does expiry behave like unlock?" is
// the question these tests answer — and the answer is yes: expiry is passive
// (activeLocks() simply stops returning the lapsed lock) and the reservation
// queue keeps guarding the file, exactly as it does after an unlock.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { createStore } from './store.mjs';

const TEST_PET_A = 'gf-sd';
let app;
let port;
let tmpDir;
// A controllable clock: the daemon's whole liveness model is time-based, so a
// test that waits on wall-clock time would be both slow and flaky.
let clock = Date.UTC(2026, 8, 9, 8, 0, 0);

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-reservations-test-'));
  app = createAgoraServer({
    dir: tmpDir,
    storeFactory: ({ dir }) => createStore({
      dir,
      now: () => clock,
      seatRosterPath: null,
      // Sibling checkouts a lock here may legitimately name (WF-G119).
      workspaceRoot: 'F:/Repos/Aralia',
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

let petCursor = 0;
async function registerAgent(handle) {
  // Pet identity is unique per LIVE agent, so each registration takes the next
  // free catalog entry rather than a fixed slug.
  const pets = (await request('GET', '/pets')).json.pets;
  const pet = handle === 'holder' ? TEST_PET_A : pets[++petCursor].slug;
  const r = await request('POST', '/agents/register', {
    body: { handle, petSlug: pet, sessionId: `session-${handle}`, note: 'reservation order test' },
  });
  assert.equal(r.status, 201, r.raw);
  return { id: r.json.agentId, token: r.json.token };
}

test('a lock that EXPIRES hands the file to reservation #1 while #2 keeps waiting', async () => {
  const holder = await registerAgent('holder');
  const first = await registerAgent('first-in-line');
  const second = await registerAgent('second-in-line');
  const FILE = 'src/types/world.ts';

  // The holder takes the file for ten minutes.
  const lock = await request('POST', '/locks', {
    token: holder.token,
    body: { paths: [FILE], reason: 'holding', ttlMs: 600000 },
  });
  assert.equal(lock.status, 201, lock.raw);

  // Two waiters queue behind it, in order.
  const r1 = await request('POST', '/reservations', { token: first.token, body: { paths: [FILE], reason: 'first' } });
  assert.equal(r1.status, 201, r1.raw);
  assert.equal(r1.json.reservation.position, 1);
  const r2 = await request('POST', '/reservations', { token: second.token, body: { paths: [FILE], reason: 'second' } });
  assert.equal(r2.status, 201, r2.raw);
  assert.equal(r2.json.reservation.position, 2);

  // While the lock is live, neither waiter may take the file.
  const earlyGrab = await request('POST', '/locks', { token: first.token, body: { paths: [FILE] } });
  assert.equal(earlyGrab.status, 409, earlyGrab.raw);

  // The lock LAPSES — nobody unlocked it. Advance past its TTL, but stay inside
  // the presence horizon so no reservation is dropped as stale.
  clock += 600001;
  await request('POST', '/agents/heartbeat', { token: first.token });
  await request('POST', '/agents/heartbeat', { token: second.token });

  // #2 must NOT jump the queue: the head reservation still guards the file.
  const jump = await request('POST', '/locks', { token: second.token, body: { paths: [FILE] } });
  assert.equal(jump.status, 409, jump.raw);
  assert.equal(jump.json.conflict.type, 'reservation');
  assert.equal(jump.json.conflict.reservation.id, r1.json.reservation.id);

  // #1 takes it, exactly as it would after an unlock.
  const granted = await request('POST', '/locks', { token: first.token, body: { paths: [FILE], reason: 'my turn' } });
  assert.equal(granted.status, 201, granted.raw);

  // Taking the lock consumes #1's reservation and promotes #2 to head.
  const queue = await request('GET', '/reservations');
  const remaining = queue.json.reservations.filter((r) => (r.paths || []).includes(FILE));
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, r2.json.reservation.id);
  assert.equal(remaining[0].position, 1);

  // ...and #2 still waits, because the file is locked again.
  const stillWaiting = await request('POST', '/locks', { token: second.token, body: { paths: [FILE] } });
  assert.equal(stillWaiting.status, 409, stillWaiting.raw);

  await request('DELETE', `/locks/${granted.json.lock.id}`, { token: first.token });
});

test('GET /locks reports holder lastSeen, idle time and presence status (WF-G116)', async () => {
  const holder = await registerAgent('idle-holder');
  const lock = await request('POST', '/locks', {
    token: holder.token,
    body: { paths: ['src/idle/example.ts'], reason: 'idle probe', ttlMs: 10800000 },
  });
  assert.equal(lock.status, 201, lock.raw);
  const seenAt = clock;

  clock += 7 * 60000; // seven quiet minutes
  const listed = (await request('GET', '/locks')).json.locks.find((l) => l.id === lock.json.lock.id);
  assert.equal(listed.holderHandle, 'idle-holder');
  assert.equal(listed.holderLastSeen, seenAt);
  assert.equal(listed.holderIdleMs, 7 * 60000);
  // Past the 10-minute presence TTL the holder would read 'stale'; at 7 minutes
  // a waiter can see the hold is still live work.
  assert.equal(listed.holderStatus, 'online');

  clock += 5 * 60000; // now twelve minutes quiet
  const later = (await request('GET', '/locks')).json.locks.find((l) => l.id === lock.json.lock.id);
  assert.equal(later.holderIdleMs, 12 * 60000);
  assert.equal(later.holderStatus, 'stale');

  await request('DELETE', `/locks/${lock.json.lock.id}`, { token: holder.token });
});

test('locks carry a repo field and cross-repo same-path locks raise no WF-G91 warning', async () => {
  const here = await registerAgent('repo-here');
  const there = await registerAgent('repo-there');
  const REL = 'src/systems/entities3d/three/baseMeshCatalog.ts';

  const mine = await request('POST', '/locks', { token: here.token, body: { paths: [REL], reason: 'aralia side' } });
  assert.equal(mine.status, 201, mine.raw);
  // The daemon's own workspace basename, not a guess.
  assert.equal(mine.json.lock.repo, 'Aralia');
  assert.deepEqual(mine.json.warnings, []);

  // The SAME relative path under a sibling checkout root is a different file.
  const foreign = await request('POST', '/locks', {
    token: there.token,
    body: { paths: [`Entity-Generator/${REL}`], reason: 'generator side' },
  });
  assert.equal(foreign.status, 201, foreign.raw);
  assert.equal(foreign.json.lock.repo, 'Entity-Generator');
  assert.deepEqual(foreign.json.warnings, [], 'a cross-repo pair must not warn (WF-G119)');

  await request('DELETE', `/locks/${foreign.json.lock.id}`, { token: there.token });

  // Two spellings of ONE file in ONE repo still warn, exactly as WF-G91 intended.
  const sameRepoSuffix = await request('POST', '/locks', {
    token: there.token,
    body: { paths: ['three/baseMeshCatalog.ts'], reason: 'same repo, shorter spelling' },
  });
  assert.equal(sameRepoSuffix.status, 201, sameRepoSuffix.raw);
  assert.equal(sameRepoSuffix.json.warnings.length, 1, sameRepoSuffix.raw);
  assert.match(sameRepoSuffix.json.warnings[0], /may be the same file/);

  await request('DELETE', `/locks/${sameRepoSuffix.json.lock.id}`, { token: there.token });
  await request('DELETE', `/locks/${mine.json.lock.id}`, { token: here.token });
});

test('campaigns carry the same repo field (WF-G119)', async () => {
  const lead = await registerAgent('repo-campaign-lead');
  const r = await request('POST', '/campaigns', {
    token: lead.token,
    body: { id: 'repo-field-probe', role: 'lead', scope: 'probe', paths: ['Entity-Generator/src/probe'] },
  });
  assert.equal(r.status, 201, r.raw);
  assert.equal(r.json.campaign.repo, 'Entity-Generator');

  const local = await request('POST', '/campaigns', {
    token: lead.token,
    body: { id: 'repo-field-probe-local', role: 'lead', scope: 'probe', paths: ['src/probe-local'] },
  });
  assert.equal(local.status, 201, local.raw);
  assert.equal(local.json.campaign.repo, 'Aralia');
});
