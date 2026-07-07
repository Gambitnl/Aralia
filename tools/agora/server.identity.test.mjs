// tools/agora/server.identity.test.mjs
// API tests for the agent-identity Wave 1 additions: register passthrough of the
// new provenance fields, and the clean-exit retire endpoint.
//   node --test "tools/agora/*.test.mjs"

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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-srv-id-'));
  app = createAgoraServer({ dir: tmpDir });
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
    if (token) headers['Authorization'] = `Bearer ${token}`;
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

test('register accepts and echoes the identity fields', async () => {
  const r = await request('POST', '/agents/register', {
    body: { handle: 'orch.planmap', type: 'claude-subagent', spawnedBy: 'master.desktop', campaign: 'planmap-ui', cwd: 'F:/Repos/Aralia' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.type, 'claude-subagent');
  assert.equal(r.json.spawnedBy, 'master.desktop');
  assert.equal(r.json.campaign, 'planmap-ui');
  assert.equal(r.json.cwd, 'F:/Repos/Aralia');
  assert.equal(r.json.handleValid, true);
});

test('GET /agents surfaces the identity fields', async () => {
  await request('POST', '/agents/register', { body: { handle: 'worker.srv', type: 'codex', campaign: 'c1' } });
  const r = await request('GET', '/agents');
  const a = r.json.agents.find((x) => x.handle === 'worker.srv');
  assert.equal(a.type, 'codex');
  assert.equal(a.campaign, 'c1');
});

test('POST /agents/retire drops the agent and frees its locks', async () => {
  const reg = await request('POST', '/agents/register', { body: { handle: 'worker.retire-srv' } });
  const token = reg.json.token;
  const lock = await request('POST', '/locks', { token, body: { paths: ['src/a.ts'], reason: 'edit' } });
  assert.equal(lock.status, 201);

  const ret = await request('POST', '/agents/retire', { token });
  assert.equal(ret.status, 200);
  assert.equal(ret.json.ok, true);

  const agents = await request('GET', '/agents');
  assert.equal(agents.json.agents.find((x) => x.handle === 'worker.retire-srv'), undefined);
  const locks = await request('GET', '/locks');
  assert.equal((locks.json.locks || []).filter((l) => (l.paths || []).includes('src/a.ts')).length, 0);
});

test('POST /agents/retire without a token -> 401', async () => {
  const r = await request('POST', '/agents/retire', {});
  assert.equal(r.status, 401);
});
