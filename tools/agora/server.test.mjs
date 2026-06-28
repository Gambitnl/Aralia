// tools/agora/server.test.mjs
// API tests for the Agora HTTP daemon. Node built-in runner only.
//   node --test "tools/agora/*.test.mjs"
//
// Boots the app on an ephemeral port (port 0) in a fresh temp dir, exercises the
// routing table + auth + status codes, then tears down server, store, and temp dir.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';

let app;
let port;
let tmpDir;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-server-test-'));
  app = createAgoraServer({ dir: tmpDir });
  await new Promise((resolve) => app.listen(0, resolve));
  port = app.server.address().port;
});

after(async () => {
  if (app) await app.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

// --- tiny JSON HTTP helper --------------------------------------------------
function request(method, pathname, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch {
          json = null;
        }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function registerAgent(handle) {
  const r = await request('POST', '/agents/register', { body: { handle } });
  assert.equal(r.status, 201);
  return r.json; // { agentId, token, handle }
}

// ---------------------------------------------------------------------------
test('register returns a token; authed heartbeat works; unauthed mutation -> 401', async () => {
  const a = await registerAgent('alice');
  assert.ok(a.token, 'token returned');
  assert.equal(a.handle, 'alice');

  const ok = await request('POST', '/agents/heartbeat', { token: a.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.ok, true);

  // mutating endpoint without a token -> 401
  const unauth = await request('POST', '/locks', { body: { paths: ['x'] } });
  assert.equal(unauth.status, 401);

  // bad token -> 401
  const badTok = await request('POST', '/locks', { token: 'nope', body: { paths: ['x'] } });
  assert.equal(badTok.status, 401);
});

test('locks: acquire (201), overlap conflict (409), release by holder (200) / non-holder (403)', async () => {
  const a = await registerAgent('lock-a');
  const b = await registerAgent('lock-b');

  const acq = await request('POST', '/locks', {
    token: a.token,
    body: { paths: ['src/foo.ts'], reason: 'editing' },
  });
  assert.equal(acq.status, 201);
  assert.ok(acq.json.lock.id);
  const lockId = acq.json.lock.id;

  // overlapping lock by a second agent -> 409 with conflict
  const conflict = await request('POST', '/locks', {
    token: b.token,
    body: { paths: ['src/foo.ts'] },
  });
  assert.equal(conflict.status, 409);
  assert.ok(conflict.json.conflict, 'conflict payload present');
  assert.equal(conflict.json.conflict.path, 'src/foo.ts');

  // bad input (no paths/globs) -> 400
  const bad = await request('POST', '/locks', { token: a.token, body: {} });
  assert.equal(bad.status, 400);

  // GET /locks open (no auth)
  const list = await request('GET', '/locks');
  assert.equal(list.status, 200);
  assert.ok(list.json.locks.some((l) => l.id === lockId));

  // release by NON-holder -> 403
  const wrongRelease = await request('DELETE', `/locks/${lockId}`, { token: b.token });
  assert.equal(wrongRelease.status, 403);

  // release by holder -> 200
  const release = await request('DELETE', `/locks/${lockId}`, { token: a.token });
  assert.equal(release.status, 200);
  assert.equal(release.json.ok, true);

  // releasing a missing lock -> 404
  const missing = await request('DELETE', `/locks/${lockId}`, { token: a.token });
  assert.equal(missing.status, 404);
});

test('tasks: create -> claim -> in_progress -> done; double-claim -> 409', async () => {
  const a = await registerAgent('task-a');
  const b = await registerAgent('task-b');

  const create = await request('POST', '/tasks', {
    token: a.token,
    body: { title: 'do the thing', body: 'details' },
  });
  assert.equal(create.status, 201);
  const id = create.json.task.id;
  assert.equal(create.json.task.state, 'open');

  const claim = await request('POST', `/tasks/${id}/claim`, { token: a.token });
  assert.equal(claim.status, 200);
  assert.equal(claim.json.task.state, 'claimed');
  assert.equal(claim.json.task.claimedBy, a.agentId);

  const inProg = await request('POST', `/tasks/${id}/state`, {
    token: a.token,
    body: { state: 'in_progress' },
  });
  assert.equal(inProg.status, 200);
  assert.equal(inProg.json.task.state, 'in_progress');

  const done = await request('POST', `/tasks/${id}/state`, {
    token: a.token,
    body: { state: 'done' },
  });
  assert.equal(done.status, 200);
  assert.equal(done.json.task.state, 'done');

  // bad state -> 400
  const badState = await request('POST', `/tasks/${id}/state`, {
    token: a.token,
    body: { state: 'banana' },
  });
  assert.equal(badState.status, 400);

  // second agent claiming an already-claimed (in_progress) task -> 409
  const create2 = await request('POST', '/tasks', { token: a.token, body: { title: 't2' } });
  const id2 = create2.json.task.id;
  await request('POST', `/tasks/${id2}/claim`, { token: a.token });
  const doubleClaim = await request('POST', `/tasks/${id2}/claim`, { token: b.token });
  assert.equal(doubleClaim.status, 409);

  // GET /tasks?state=done filters
  const doneList = await request('GET', '/tasks?state=done');
  assert.equal(doneList.status, 200);
  assert.ok(doneList.json.tasks.every((t) => t.state === 'done'));
  assert.ok(doneList.json.tasks.some((t) => t.id === id));
});

test('messages: broadcast + direct; ?since cursor; ?to=me resolves via token', async () => {
  const a = await registerAgent('msg-a');
  const b = await registerAgent('msg-b');

  const m1 = await request('POST', '/messages', {
    token: a.token,
    body: { to: 'all', body: 'hello everyone' },
  });
  assert.equal(m1.status, 201);
  const seq1 = m1.json.message.seq;

  const m2 = await request('POST', '/messages', {
    token: a.token,
    body: { to: b.agentId, body: 'hi b' },
  });
  assert.equal(m2.status, 201);

  // ?since filters by cursor: only the second message after seq1
  const after = await request('GET', `/messages?since=${seq1}&to=all`);
  assert.equal(after.status, 200);
  assert.ok(after.json.messages.every((m) => m.seq > seq1));
  assert.ok(after.json.messages.some((m) => m.body === 'hi b'));

  // ?to=me resolves to agent b: sees broadcast + direct-to-b, not nothing
  const meB = await request('GET', '/messages?to=me', { token: b.token });
  assert.equal(meB.status, 200);
  const bodies = meB.json.messages.map((m) => m.body);
  assert.ok(bodies.includes('hello everyone'), 'b sees broadcast');
  assert.ok(bodies.includes('hi b'), 'b sees direct message');

  // ?to=me with no token behaves as 'all'
  const meAnon = await request('GET', '/messages?to=me');
  assert.equal(meAnon.status, 200);
});

test('GET /health returns ok:true and sensible counts', async () => {
  const h = await request('GET', '/health');
  assert.equal(h.status, 200);
  assert.equal(h.json.ok, true);
  assert.equal(h.json.version, '0.1.0');
  assert.ok(typeof h.json.counts.agents === 'number');
  assert.ok(h.json.counts.agents >= 1);
  assert.ok(typeof h.json.lastSeq === 'number');
  assert.ok(typeof h.json.uptime === 'number');
});

test('GET / serves a dashboard placeholder when index.html is absent', async () => {
  const r = await request('GET', '/');
  assert.equal(r.status, 200);
  assert.match(r.raw, /Agora/);
});

test('SSE: connect receives hello then a live message event', async () => {
  const a = await registerAgent('sse-a');

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('SSE timeout: did not receive hello + message event in time'));
    }, 2000);

    let buffer = '';
    let sawHello = false;

    const req = http.request(
      { host: '127.0.0.1', port, method: 'GET', path: '/events', headers: { Accept: 'text/event-stream' } },
      (res) => {
        assert.equal(res.statusCode, 200);
        assert.match(res.headers['content-type'], /text\/event-stream/);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          if (!sawHello && /event: hello/.test(buffer)) {
            sawHello = true;
            // Now trigger a mutation via a separate request.
            request('POST', '/messages', { token: a.token, body: { to: 'all', body: 'sse-ping' } }).catch(
              reject,
            );
          }
          if (sawHello && /event: message\.post/.test(buffer) && /sse-ping/.test(buffer)) {
            clearTimeout(timer);
            req.destroy(); // close the stream cleanly from the client side
            resolve();
          }
        });
        res.on('error', () => {
          /* destroy() surfaces as an error; ignored once resolved */
        });
      },
    );
    req.on('error', (e) => {
      // Ignore the abort that our own destroy() triggers after resolve.
      if (e.code !== 'ECONNRESET' && !sawHello) reject(e);
    });
    req.end();
  });
});
