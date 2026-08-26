// tools/agora/server.triage.test.mjs
// The charter and triage routes, proven over the real daemon (design §72).
//
//   node --test tools/agora/server.triage.test.mjs
//
// store.triage.test.mjs proves the rules. This file proves the two things only
// the route layer decides: WHICH STATUS a refusal carries (the mapping matches
// the store's error text, so a reworded error would silently turn a permission
// refusal into a bad request), and WHICH ROUTE a path reaches — `triage/start`
// and `triage/:taskId` have the same length, and the router takes the first
// pattern that matches.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { createStore } from './store.mjs';

const TOPICS = { topics: [{ id: 'coord', status: 'active', features: [{ title: 'Charter contract', status: 'active' }] }] };

let app;
let port;
let tmpDir;
let clock = Date.UTC(2026, 8, 13, 9, 0, 0);

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-server-triage-test-'));
  app = createAgoraServer({
    dir: tmpDir,
    storeFactory: ({ dir }) => createStore({
      dir,
      now: () => clock,
      presenceTtlMs: 1000,
      presenceDropMs: 5000,
      seatRosterPath: null,
      readPlanmap: () => TOPICS,
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
async function registerAgent(handle, role = 'worker') {
  const pets = (await request('GET', '/pets')).json.pets;
  const body = { handle, petSlug: pets[++petCursor].slug, sessionId: `thread-${handle}`, role, note: 'triage route test' };
  const r = await request('POST', '/agents/register', { body });
  assert.equal(r.status, 201, r.raw);
  return { id: r.json.agentId, token: r.json.token };
}

function charter(over = {}) {
  return {
    mission: 'm', outcome: 'o', currentState: 'c', planMapPrimary: 'planmap:coord/charter-contract',
    scope: ['s'], nonScope: ['n'], tier: 'large', effort: { taskCount: 4, fileCount: 6 },
    risk: 'high', riskReason: 'daemon', affectedDomains: ['tools/agora'], milestones: [{ id: 'M1' }],
    workstreams: [{ id: 'W1' }], dependencies: ['planmap:coord'],
    acceptance: [{ text: 'refused when bad', evidence: 'route test' }], verification: 'tests',
    adoptionPolicy: 'escalate', owner: 'me', author: 'me', openDecisions: [{ text: 'D1' }], escalationPath: 'wake the operator',
    ...over,
  };
}

test('charter routes: a refused charter is 400 with every error, an orchestrator approving a large one is 403, a human is 200', async () => {
  const orch = await registerAgent('triage-routes.orch', 'orchestrator');
  const human = await registerAgent('triage-routes.human', 'human');
  const claimed = await request('POST', '/campaigns', { token: orch.token, body: { id: 'route-trial', scope: 'x', paths: ['tools/route'] } });
  assert.equal(claimed.status, 201, claimed.raw);
  const code = claimed.json.campaign.id;

  const bad = await request('POST', `/campaigns/${code}/charter`, { token: orch.token, body: { charter: charter({ workstreams: [] }), summary: 'v1' } });
  assert.equal(bad.status, 400, bad.raw);
  assert.ok(bad.json.errors.includes('missing required field for tier large: workstreams'));

  const good = await request('POST', `/campaigns/${code}/charter`, { token: orch.token, body: { charter: charter(), summary: 'v1' } });
  assert.equal(good.status, 200, good.raw);

  const notAllowed = await request('POST', `/campaigns/${code}/charter/approve`, { token: orch.token, body: { note: 'read' } });
  assert.equal(notAllowed.status, 403, notAllowed.raw);

  const approved = await request('POST', `/campaigns/${code}/charter/approve`, { token: human.token, body: { note: 'read every section' } });
  assert.equal(approved.status, 200, approved.raw);
  assert.equal(approved.json.charter.status, 'approved');

  const view = await request('GET', `/campaigns/${code}`);
  assert.equal(view.status, 200, view.raw);
  assert.equal(view.json.validation.ok, true);
  assert.equal((await request('GET', '/campaigns/agora-nope')).status, 404);
});

test('triage routes: the report is token-free, start is not mistaken for a task id, and a destructive disposition is 403 without the human', async () => {
  const owner = await registerAgent('triage-routes.owner');
  const claimed = await request('POST', '/campaigns', { token: owner.token, body: { id: 'route-abandoned', scope: 'x', paths: ['tools/abandoned'] } });
  const code = claimed.json.campaign.id;
  const task = await request('POST', '/tasks', { token: owner.token, body: { title: 'left behind', campaignId: code } });
  assert.equal(task.status, 201, task.raw);

  clock += 60_000; // every agent registered so far falls past the drop horizon
  const master = await registerAgent('triage-routes.master', 'orchestrator');
  const human = await registerAgent('triage-routes.op', 'human');

  const report = await request('GET', `/campaigns/${code}/triage`);
  assert.equal(report.status, 200, report.raw);
  assert.equal(report.json.readOnly, true);
  assert.equal(report.json.campaign.adoptable, true);

  const started = await request('POST', `/campaigns/${code}/triage/start`, { token: master.token, body: { reason: 'owner gone' } });
  assert.equal(started.status, 200, started.raw);
  const twice = await request('POST', `/campaigns/${code}/triage/start`, { token: master.token, body: { reason: 'again' } });
  assert.equal(twice.status, 409, twice.raw);

  const taskId = task.json.task.id;
  const refused = await request('POST', `/campaigns/${code}/triage/${taskId}`, { token: master.token, body: { disposition: 'close-obsolete', reason: 'gone' } });
  assert.equal(refused.status, 403, refused.raw);

  const early = await request('POST', `/campaigns/${code}/triage/finish`, { token: master.token, body: { reason: 'done' } });
  assert.equal(early.status, 400, early.raw);
  assert.deepEqual(early.json.missing, [taskId]);

  const closed = await request('POST', `/campaigns/${code}/triage/${taskId}`, {
    token: human.token,
    body: { disposition: 'close-obsolete', reason: 'the work was removed', approvalQuote: 'yes, close it' },
  });
  assert.equal(closed.status, 200, closed.raw);
  assert.equal(closed.json.task.state, 'done');

  const finished = await request('POST', `/campaigns/${code}/triage/finish`, { token: master.token, body: { reason: 'one task, one disposition' } });
  assert.equal(finished.status, 200, finished.raw);
  assert.equal(finished.json.campaign.triage.state, 'applied');
});
