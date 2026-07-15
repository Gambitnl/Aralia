// tools/agora/server.orchestration.test.mjs
// API tests for the orchestrator-upgrade endpoints: task deps/priority/refs,
// ready filter, claim-next, done-with-result, and force lock release.
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-orch-test-'));
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
  return r.json;
}

test('tasks: deps/priority/refs round-trip; unknown dep -> 400; ?ready=1 respects deps + priority', async () => {
  const orch = await registerAgent('orch');

  const a = await request('POST', '/tasks', { token: orch.token, body: { title: 'A: prep' } });
  assert.equal(a.status, 201);

  const b = await request('POST', '/tasks', {
    token: orch.token,
    body: { title: 'B: build', deps: [a.json.task.id], priority: 5, refs: ['spells:G12'] },
  });
  assert.equal(b.status, 201);
  assert.deepEqual(b.json.task.deps, [a.json.task.id]);
  assert.equal(b.json.task.priority, 5);
  assert.deepEqual(b.json.task.refs, ['spells:G12']);

  const bad = await request('POST', '/tasks', {
    token: orch.token,
    body: { title: 'bad', deps: ['no-such-task'] },
  });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /unknown dep/);

  // Only A is ready (B waits on it).
  let ready = await request('GET', '/tasks?ready=1');
  assert.deepEqual(ready.json.tasks.map((t) => t.title), ['A: prep']);

  // Complete A with a result -> stored; B becomes ready.
  await request('POST', `/tasks/${a.json.task.id}/claim`, { token: orch.token });
  const done = await request('POST', `/tasks/${a.json.task.id}/state`, {
    token: orch.token,
    body: { state: 'done', result: 'prep complete: 3 files staged' },
  });
  assert.equal(done.status, 200);
  assert.equal(done.json.task.result, 'prep complete: 3 files staged');

  ready = await request('GET', '/tasks?ready=1');
  assert.deepEqual(ready.json.tasks.map((t) => t.title), ['B: build']);
});

test('tasks: POST /tasks/claim-next claims by priority; 200 with task:null when dry', async () => {
  const orch = await registerAgent('orch2');
  const worker = await registerAgent('worker2');

  // Priorities above anything earlier tests left on the shared board.
  await request('POST', '/tasks', { token: orch.token, body: { title: 'w2-low', priority: 11 } });
  await request('POST', '/tasks', { token: orch.token, body: { title: 'w2-high', priority: 19 } });

  const first = await request('POST', '/tasks/claim-next', { token: worker.token });
  assert.equal(first.status, 200);
  assert.equal(first.json.task.title, 'w2-high');
  assert.equal(first.json.task.claimedBy, worker.agentId);

  const second = await request('POST', '/tasks/claim-next', { token: worker.token });
  assert.equal(second.json.task.title, 'w2-low');

  // Note: earlier tests may have left ready tasks on the shared board; drain them.
  let r;
  do {
    r = await request('POST', '/tasks/claim-next', { token: worker.token });
  } while (r.json.task);
  assert.equal(r.status, 200);
  assert.equal(r.json.task, null);
});

test('tasks: POST /tasks/claim-next accepts campaign and category lane filters', async () => {
  const orch = await registerAgent('orch-filter-api');
  const worker = await registerAgent('worker-filter-api');

  for (const [id, pathName] of [['api-lane-a', 'a'], ['api-lane-b', 'b']]) {
    const campaign = await request('POST', '/campaigns', {
      token: orch.token,
      body: { id, role: 'lead', paths: [`tmp/api-filter-${pathName}`] },
    });
    assert.equal(campaign.status, 201);
  }

  const laneA = await request('POST', '/tasks', {
    token: orch.token,
    body: { title: 'api lane A', campaignId: 'api-lane-a', category: 'backend', priority: 100 },
  });
  const laneB = await request('POST', '/tasks', {
    token: orch.token,
    body: { title: 'api lane B', campaignId: 'api-lane-b', category: 'frontend', priority: 200 },
  });

  const byCampaign = await request('POST', '/tasks/claim-next', {
    token: worker.token,
    body: { campaignId: 'api-lane-a' },
  });
  assert.equal(byCampaign.status, 200);
  assert.equal(byCampaign.json.task.id, laneA.json.task.id);

  const byCategory = await request('POST', '/tasks/claim-next?category=frontend', { token: worker.token });
  assert.equal(byCategory.status, 200);
  assert.equal(byCategory.json.task.id, laneB.json.task.id);

  const dryLane = await request('POST', '/tasks/claim-next', {
    token: worker.token,
    body: { campaignId: 'api-lane-a' },
  });
  assert.equal(dryLane.status, 200);
  assert.equal(dryLane.json.task, null);
});

test('tasks: handoff refuses an unknown target and preserves the claimant', async () => {
  const orch = await registerAgent('orch-handoff-api');
  const worker = await registerAgent('worker-handoff-api');
  const task = await request('POST', '/tasks', {
    token: orch.token,
    body: { title: 'api safe handoff' },
  });
  await request('POST', `/tasks/${task.json.task.id}/claim`, { token: worker.token });

  const rejected = await request('POST', `/tasks/${task.json.task.id}/handoff`, {
    token: orch.token,
    body: { toAgentId: 'missing-agent' },
  });
  // 422 since planning-surface-freshness Task 6: an unknown/dead handoff target
  // is a semantic refusal, not a malformed request.
  assert.equal(rejected.status, 422);
  assert.match(rejected.json.error, /not registered or live/);

  const board = await request('GET', '/tasks');
  assert.equal(board.json.tasks.find((row) => row.id === task.json.task.id).claimedBy, worker.agentId);
});

test('campaigns: API claims lead scopes, rejects overlapping leads, and namespaces tasks', async () => {
  const lead = await registerAgent('campaign-lead');
  const rival = await registerAgent('campaign-rival');

  // Lead campaign claims are first-class board records, not just chat messages.
  const claimed = await request('POST', '/campaigns', {
    token: lead.token,
    body: {
      id: 'governance-api',
      role: 'lead',
      scope: 'tools/agora governance API',
      globs: ['tools/agora/**'],
      wave: 'governance-api-wave',
    },
  });
  assert.equal(claimed.status, 201);
  assert.equal(claimed.json.campaign.id, 'governance-api');

  // A competing lead gets a clear stop before seeding overlapping work.
  const blocked = await request('POST', '/campaigns', {
    token: rival.token,
    body: {
      id: 'governance-api-rival',
      role: 'lead',
      scope: 'competing Agora wave',
      paths: ['tools/agora/store.mjs'],
    },
  });
  assert.equal(blocked.status, 409);
  assert.match(blocked.json.error, /overlaps active lead campaign/);

  const task = await request('POST', '/tasks', {
    token: lead.token,
    body: {
      title: 'PK-api: board namespace',
      campaignId: 'governance-api',
      wave: 'governance-api-wave',
    },
  });
  assert.equal(task.status, 201);
  assert.equal(task.json.task.campaignId, 'governance-api');
  assert.equal(task.json.task.wave, 'governance-api-wave');

  const campaigns = await request('GET', '/campaigns');
  assert.equal(campaigns.status, 200);
  const listed = campaigns.json.campaigns.find((c) => c.id === 'governance-api');
  assert.ok(listed);
  assert.equal(listed.ownerStatus, 'online');
  assert.equal(listed.ownerLive, true);
});

test('docs: /docs lists the whitelisted reference files; /docs/:name serves them; others 404', async () => {
  const list = await request('GET', '/docs');
  assert.equal(list.status, 200);
  const names = list.json.docs.map((d) => d.name).sort();
  assert.deepEqual(names, ['CO-ORCHESTRATION.md', 'COLD_START_ORCHESTRATOR_PROMPT.md', 'ORCHESTRATOR.md', 'PROTOCOL.md', 'WORKFLOW_GAPS.md']);
  assert.ok(list.json.docs.every((d) => d.path.includes('tools')), 'absolute paths returned');

  // Default is the pretty HTML page for humans; ?raw=1 is the plain markdown.
  const pretty = await request('GET', '/docs/PROTOCOL.md');
  assert.equal(pretty.status, 200);
  assert.match(pretty.raw, /<!doctype html>/);
  assert.match(pretty.raw, /view raw markdown/);
  const proto = await request('GET', '/docs/PROTOCOL.md?raw=1');
  assert.equal(proto.status, 200);
  assert.match(proto.raw, /Agora/);
  assert.doesNotMatch(proto.raw, /<!doctype html>/);

  const evil = await request('GET', '/docs/..%2Fserver.mjs');
  assert.equal(evil.status, 404);
  const nope = await request('GET', '/docs/nope.md');
  assert.equal(nope.status, 404);
});

test('SSE: reconnect with ?since= replays the missed events from the ring (WF-G6)', async () => {
  const a = await registerAgent('sse-agent');
  const sinceSeq = (await request('GET', '/health')).json.lastSeq;
  // Mutations AFTER the client's last-seen seq — these must be replayed.
  await request('POST', '/tasks', { token: a.token, body: { title: 'sse-replay-probe' } });
  await request('POST', '/messages', { token: a.token, body: { body: 'sse replay check' } });

  const chunks = await new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: `/events?since=${sinceSeq}` }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      setTimeout(() => { req.destroy(); resolve(buf); }, 700);
    });
    req.on('error', (e) => (String(e.message).includes('socket hang up') ? null : reject(e)));
  });
  assert.match(chunks, /event: hello/);
  assert.match(chunks, /"replayed":true/);
  assert.match(chunks, /sse-replay-probe/); // the missed task.create came through as an EVENT
});

test('locks: DELETE /locks/:id?force=1 refused while holder online (409)', async () => {
  const holder = await registerAgent('force-holder');
  const other = await registerAgent('force-other');
  const acq = await request('POST', '/locks', {
    token: holder.token,
    body: { paths: ['src/force-test.ts'] },
  });
  assert.equal(acq.status, 201);

  const forced = await request('DELETE', `/locks/${acq.json.lock.id}?force=1`, { token: other.token });
  assert.equal(forced.status, 409);
  assert.match(forced.json.error, /online/);

  // Holder itself can still release normally.
  const rel = await request('DELETE', `/locks/${acq.json.lock.id}`, { token: holder.token });
  assert.equal(rel.status, 200);
});
