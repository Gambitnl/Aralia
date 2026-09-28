// tools/agora/server.orchestration.test.mjs
// API tests for the orchestrator-upgrade endpoints: task deps/priority/refs,
// ready filter, claim-next, classified review results, and force lock release.
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
const TEST_PET = 'gf-sd';

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
  const r = await request('POST', '/agents/register', { body: { handle, petSlug: TEST_PET } });
  assert.equal(r.status, 201);
  return r.json;
}

// WF-G130 (2026-09-09): PATCH /tasks/:id edits authored fields in place.
test('PATCH /tasks/:id edits title and refs for the creator, 403 for a bystander, 404 unknown', async () => {
  const orch = await registerAgent('orch-editor');
  const other = await registerAgent('orch-bystander');
  const made = await request('POST', '/tasks', { token: orch.token, body: { title: 'wrong title', refs: ['GG-1'] } });
  assert.equal(made.status, 201);
  const id = made.json.task.id;
  const ok = await request('PATCH', `/tasks/${id}`, { token: orch.token, body: { title: 'right title', refs: ['GG-2'], reason: 'typo' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.task.id, id);
  assert.equal(ok.json.task.title, 'right title');
  assert.deepEqual(ok.json.task.refs, ['GG-2']);
  assert.deepEqual(ok.json.changed, ['title', 'refs']);
  const denied = await request('PATCH', `/tasks/${id}`, { token: other.token, body: { title: 'hijack' } });
  assert.equal(denied.status, 403);
  const missing = await request('PATCH', '/tasks/agora-zzzz', { token: orch.token, body: { title: 'x' } });
  assert.equal(missing.status, 404);
  const bad = await request('PATCH', `/tasks/${id}`, { token: orch.token, body: { priority: 'high' } });
  assert.equal(bad.status, 400);
  // Leave the shared ready pool as this test found it: later tests assert its order.
  const closed = await request('POST', `/tasks/${id}/state`, { token: orch.token, body: { state: 'done', result: 'edit test over' } });
  assert.equal(closed.status, 200);
  const late = await request('PATCH', `/tasks/${id}`, { token: orch.token, body: { title: 'too late' } });
  assert.equal(late.status, 400, 'a done task is a record');
});

test('tasks: deps/priority/refs round-trip; unknown dep -> 400; ?ready=1 respects deps + priority', async () => {
  const orch = await registerAgent('orch');

  const a = await request('POST', '/tasks', { token: orch.token, body: { title: 'A: prep' } });
  assert.equal(a.status, 201);

  const b = await request('POST', '/tasks', {
    token: orch.token,
    body: { title: 'B: build', deps: [a.json.task.id], priority: 5, refs: ['spells:G12'] },
  });
  assert.equal(b.status, 201);
  assert.deepEqual(b.json.task.deps, [{ id: a.json.task.id, type: 'blocks' }]);
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

test('tasks: result disposition validates, round-trips, and permits a later substantive review', async () => {
  const reviewer = await registerAgent('triage-api-reviewer');
  const created = await request('POST', '/tasks', {
    token: reviewer.token,
    body: { title: 'review broad TODO' },
  });
  assert.equal(created.status, 201);
  const taskId = created.json.task.id;
  await request('POST', `/tasks/${taskId}/claim`, { token: reviewer.token });

  // The API refuses unknown taxonomy and malformed review detail instead of
  // silently dropping fields that an operator thought were durable.
  const invalidDisposition = await request('POST', `/tasks/${taskId}/state`, {
    token: reviewer.token,
    body: { state: 'done', result: 'declined', resultDisposition: 'too_big' },
  });
  assert.equal(invalidDisposition.status, 400);
  assert.match(invalidDisposition.json.error, /invalid result disposition/);
  const invalidFinding = await request('POST', `/tasks/${taskId}/state`, {
    token: reviewer.token,
    body: { state: 'done', result: 'reviewed', finding: { text: 'wrong shape' } },
  });
  assert.equal(invalidFinding.status, 400);
  assert.match(invalidFinding.json.error, /finding must be a string/);
  const incompleteReview = await request('POST', `/tasks/${taskId}/state`, {
    token: reviewer.token,
    body: {
      state: 'done',
      resultDisposition: 'substantive',
      finding: 'finding without evidence',
    },
  });
  assert.equal(incompleteReview.status, 400);
  assert.match(incompleteReview.json.error, /requires non-empty finding and evidence/);

  const triage = await request('POST', `/tasks/${taskId}/state`, {
    token: reviewer.token,
    body: {
      state: 'done',
      result: 'SKIP TOO-BIG: cross-file and visual work deferred',
      resultDisposition: 'triage_only',
    },
  });
  assert.equal(triage.status, 200);
  assert.equal(triage.json.task.state, 'done');
  assert.equal(triage.json.task.resultDisposition, 'triage_only');
  assert.equal(triage.json.task.result, 'SKIP TOO-BIG: cross-file and visual work deferred');

  // Public board reads retain the classification, and the same task can be
  // claimed for the substantive review rather than becoming terminal.
  const listed = await request('GET', '/tasks');
  assert.equal(listed.json.tasks.find((task) => task.id === taskId).resultDisposition, 'triage_only');
  const reclaimed = await request('POST', `/tasks/${taskId}/claim`, { token: reviewer.token });
  assert.equal(reclaimed.status, 200);
  assert.equal(reclaimed.json.task.state, 'claimed');

  // Another bare result cannot silently promote the refusal. Only an explicit
  // substantive disposition with both proof fields replaces the triage label.
  const stillTriage = await request('POST', `/tasks/${taskId}/state`, {
    token: reviewer.token,
    body: { state: 'done', result: 'another unclassified result' },
  });
  assert.equal(stillTriage.status, 200);
  assert.equal(stillTriage.json.task.resultDisposition, 'triage_only');
  const substantive = await request('POST', `/tasks/${taskId}/state`, {
    token: reviewer.token,
    body: {
      state: 'done',
      result: 'Review completed after triage.',
      resultDisposition: 'substantive',
      finding: 'The healing branch reads damage dice before healing dice.',
      evidence: 'Focused fixture reproduced the incorrect total.',
    },
  });
  assert.equal(substantive.status, 200);
  assert.equal(substantive.json.task.resultDisposition, 'substantive');
  assert.equal(substantive.json.task.finding, 'The healing branch reads damage dice before healing dice.');
  assert.equal(substantive.json.task.evidence, 'Focused fixture reproduced the incorrect total.');

  // A fresh legacy caller still succeeds, but its result is explicitly not a
  // substantive review until a future API call classifies it with full proof.
  const legacyCreated = await request('POST', '/tasks', {
    token: reviewer.token,
    body: { title: 'legacy result API probe' },
  });
  const legacyDone = await request('POST', `/tasks/${legacyCreated.json.task.id}/state`, {
    token: reviewer.token,
    body: { state: 'done', result: 'bare legacy result' },
  });
  assert.equal(legacyDone.status, 200);
  assert.equal(legacyDone.json.task.result, 'bare legacy result');
  assert.equal(legacyDone.json.task.resultDisposition, null);
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
  assert.equal(claimed.json.campaign.name, 'governance-api');
  assert.match(claimed.json.campaign.id, /^agora-[0-9a-f]{4}$/);

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
  assert.equal(task.json.task.campaignId, claimed.json.campaign.id);
  assert.equal(task.json.task.wave, 'governance-api-wave');

  const campaigns = await request('GET', '/campaigns');
  assert.equal(campaigns.status, 200);
  const listed = campaigns.json.campaigns.find((c) => c.name === 'governance-api');
  assert.ok(listed);
  assert.equal(listed.ownerStatus, 'online');
  assert.equal(listed.ownerLive, true);
});

test('docs: /docs lists the whitelisted reference files; /docs/:name serves them; others 404', async () => {
  const list = await request('GET', '/docs');
  assert.equal(list.status, 200);
  const names = list.json.docs.map((d) => d.name).sort();
  assert.deepEqual(names, ['CO-ORCHESTRATION.md', 'COLD_START_ORCHESTRATOR_PROMPT.md', 'ORCHESTRATOR.md', 'PROTOCOL.md', 'VEGA.md', 'WORKFLOW_GAPS.md']);
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

// WF-G88: GET /tasks accepted no campaign filter and SILENTLY IGNORED one, so a
// caller received the whole board believing it had filtered. The same lane
// filter already worked on POST /tasks/claim-next, so the concept was
// filterable when claiming and unfilterable when listing.
// WF-G128 (2026-09-09): one task by id, no board listing and no state guess.
// WF-G147 (2026-09-09): /health carries the loop-lag and snapshot numbers.
test('GET /health reports event-loop lag and the last snapshot cost', async () => {
  const r = await request('GET', '/health');
  // 2026-09-13: the header shows open workflow gaps; the count must always be a number.
  assert.equal(typeof r.json.counts.gapsOpen, 'number');
  assert.equal(r.status, 200);
  assert.equal(typeof r.json.loop.lagMs, 'number');
  assert.equal(typeof r.json.loop.maxLagMs60s, 'number');
  assert.ok(r.json.loop.maxLagMs60s < 5000, 'a test process is not stalled');
  assert.ok('snapshot' in r.json, 'snapshot stats key present (null until the first snapshot)');
});

test('GET /tasks/:id returns one task in any state and 404 for an unknown id', async () => {
  const orch = await registerAgent('orch-single-read');
  const made = await request('POST', '/tasks', { token: orch.token, body: { title: 'single read target' } });
  assert.equal(made.status, 201);
  const id = made.json.task.id;
  const one = await request('GET', `/tasks/${id}`);
  assert.equal(one.status, 200);
  assert.equal(one.json.task.id, id);
  assert.equal(one.json.task.title, 'single read target');
  const upper = await request('GET', `/tasks/${id.toUpperCase()}`);
  assert.equal(upper.status, 200, 'id match is case-insensitive');
  const missing = await request('GET', '/tasks/agora-zzzz');
  assert.equal(missing.status, 404);
  const depTypes = await request('GET', '/tasks/dep-types');
  assert.equal(depTypes.status, 200, 'the dep-types route still wins');
  assert.ok(Array.isArray(depTypes.json.depTypes));
});

test('GET /tasks filters by campaign; an unknown campaign is 400, not the whole board', async () => {
  const orch = await registerAgent('orch-listing-filter');

  for (const [id, pathName] of [['list-lane-a', 'a'], ['list-lane-b', 'b']]) {
    const campaign = await request('POST', '/campaigns', {
      token: orch.token,
      body: { id, role: 'lead', paths: [`tmp/list-filter-${pathName}`] },
    });
    assert.equal(campaign.status, 201);
  }

  const made = [];
  for (const [title, campaignId] of [
    ['listing A one', 'list-lane-a'],
    ['listing A two', 'list-lane-a'],
    ['listing B one', 'list-lane-b'],
  ]) {
    const r = await request('POST', '/tasks', { token: orch.token, body: { title, campaignId } });
    assert.equal(r.status, 201);
    made.push(r.json.task);
  }
  const loose = await request('POST', '/tasks', {
    token: orch.token,
    body: { title: 'listing with no campaign' },
  });
  assert.equal(loose.status, 201);

  // Unfiltered still returns the whole board, so the default is unchanged.
  const all = await request('GET', '/tasks');
  assert.equal(all.status, 200);
  const allIds = all.json.tasks.map((t) => t.id);
  for (const t of made) assert.ok(allIds.includes(t.id));
  assert.ok(allIds.includes(loose.json.task.id));

  // One lane only. This is the assertion that would have failed before.
  const laneA = await request('GET', '/tasks?campaignId=list-lane-a');
  assert.equal(laneA.status, 200);
  assert.deepEqual(
    laneA.json.tasks.map((t) => t.id).sort(),
    [made[0].id, made[1].id].sort(),
  );
  assert.ok(!laneA.json.tasks.some((t) => t.id === loose.json.task.id));

  // The ?campaign= spelling works too, matching claim-next.
  const laneB = await request('GET', '/tasks?campaign=list-lane-b');
  assert.equal(laneB.status, 200);
  assert.deepEqual(laneB.json.tasks.map((t) => t.id), [made[2].id]);

  // A typo must fail loudly. Returning every task is the defect being fixed.
  const typo = await request('GET', '/tasks?campaignId=list-lane-typo');
  assert.equal(typo.status, 400);
  assert.match(typo.json.error, /unknown campaign/);
});

test('GET /tasks/dep-types serves all ten, and an unknown type is a 400 not a default', async () => {
  const orch = await registerAgent('deptype-orch');

  // The vocabulary is served, not only documented. A client can check its own
  // value before it posts, rather than learning the ten names from a refusal.
  const list = await request('GET', '/tasks/dep-types');
  assert.equal(list.status, 200);
  assert.equal(list.json.depTypes.length, 10);
  assert.equal(list.json.defaultType, 'blocks');
  assert.deepEqual(
    list.json.depTypes.filter((d) => d.blocking).map((d) => d.type).sort(),
    ['blocks', 'conditional-blocks', 'parent-child', 'waits-for'],
  );

  const base = await request('POST', '/tasks', { token: orch.token, body: { title: 'base' } });
  assert.equal(base.status, 201);

  // A named type round-trips.
  const typed = await request('POST', '/tasks', {
    token: orch.token,
    body: { title: 'replaces base', deps: [{ id: base.json.task.id, type: 'supersedes' }] },
  });
  assert.equal(typed.status, 201);
  assert.deepEqual(typed.json.task.deps, [{ id: base.json.task.id, type: 'supersedes' }]);

  // A non-blocking edge must not gate: this task is ready despite an open dep.
  const ready = await request('GET', '/tasks?ready=1');
  assert.ok(ready.json.tasks.some((t) => t.title === 'replaces base'));

  // THE REFUSAL. A plausible-but-wrong name fails loudly rather than becoming
  // the default edge — which is the whole reason the vocabulary is enforced.
  const bad = await request('POST', '/tasks', {
    token: orch.token,
    body: { title: 'bad type', deps: [{ id: base.json.task.id, type: 'depends-on' }] },
  });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /unknown dependency type: depends-on/);
});

test('POST /tasks/deps/migrate is control-plane only', async () => {
  const worker = await registerAgent('migrate-worker');
  const refused = await request('POST', '/tasks/deps/migrate', { token: worker.token, body: {} });
  assert.equal(refused.status, 403);
  assert.match(refused.json.error, /orchestrator, master, human/);
});

test('POST /tasks/ids/migrate previews with ?dry=1 and is control-plane only', async () => {
  const worker = await registerAgent('idmig-worker');
  const refused = await request('POST', '/tasks/ids/migrate', { token: worker.token, body: {} });
  assert.equal(refused.status, 403);
  assert.match(refused.json.error, /orchestrator, master, human/);

  // A dry run must be readable by the same gate and change nothing. Renaming
  // the whole board without a preview is not something to offer.
  const dry = await request('POST', '/tasks/ids/migrate?dry=1', { token: worker.token, body: {} });
  assert.equal(dry.status, 403, 'the gate applies to the preview too');
});

// --- WF-G169 / WF-G171: campaign reassignment and the intake gate ----------

/** A second daemon whose intake mode is chosen by the test. The shared `app`
 *  above stays in the default `legacy` mode, which is what every suite written
 *  before WF-G171 expects. */
async function withServer(campaignIntake, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-intake-test-'));
  const server = createAgoraServer({ dir, campaignIntake });
  await new Promise((resolve) => server.listen(0, resolve));
  const localPort = server.server.address().port;
  const call = (method, pathname, opts) => requestOn(localPort, method, pathname, opts);
  try {
    await run(call);
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function requestOn(localPort, method, pathname, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port: localPort, method, path: pathname, headers }, (res) => {
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

async function signIn(call, handle, role) {
  // An orchestrator must name its own task/thread id at sign-in.
  const sessionId = role ? 'thread-' + handle : undefined;
  const r = await call('POST', '/agents/register', { body: { handle, petSlug: TEST_PET, role, sessionId } });
  assert.equal(r.status, 201, r.raw);
  return r.json;
}

test('WF-G171: POST /tasks refuses a campaignless task and names both ways out', async () => {
  await withServer('required', async (call) => {
    const worker = await signIn(call, 'intake-http-worker');

    const bare = await call('POST', '/tasks', { token: worker.token, body: { title: 'no decision' } });
    assert.equal(bare.status, 400, bare.raw);
    assert.match(bare.json.error, /explicit campaign decision/);
    assert.match(bare.json.error, /campaignId/);
    assert.match(bare.json.error, /standaloneReason/);
    assert.match(bare.json.error, /WF-G171/);

    // The refusal is total: nothing reached the board.
    const board = await call('GET', '/tasks');
    assert.equal(board.json.tasks.length, 0);

    // An opt-out without a reason is an omission, not a decision.
    const silent = await call('POST', '/tasks', {
      token: worker.token, body: { title: 'silent opt-out', standalone: true },
    });
    assert.equal(silent.status, 400, silent.raw);
    assert.match(silent.json.error, /standaloneReason/);

    // An opt-out WITH a reason is accepted and the reason is kept.
    const alone = await call('POST', '/tasks', {
      token: worker.token,
      body: { title: 'lone repair', body: 'Repair the lone issue.', standalone: true, standaloneReason: 'one-off repair, no effort owns it' },
    });
    assert.equal(alone.status, 201, alone.raw);
    assert.equal(alone.json.task.campaignId, '');
    assert.equal(alone.json.task.membership, 'standalone');
    assert.equal(alone.json.task.campaignDecision.kind, 'standalone');
    assert.equal(alone.json.task.campaignDecision.reason, 'one-off repair, no effort owns it');

    // A named campaign is accepted the same way it always was.
    const orch = await signIn(call, 'intake-http-orch', 'orchestrator');
    const claimed = await call('POST', '/campaigns', {
      token: orch.token, body: { campaignId: 'rigging', scope: 'r', paths: ['src/rigging'] },
    });
    assert.equal(claimed.status, 201, claimed.raw);
    const code = claimed.json.campaign.id;
    const named = await call('POST', '/tasks', {
      token: worker.token, body: { title: 'named work', body: 'Complete the named work.', campaignId: code },
    });
    assert.equal(named.status, 201, named.raw);
    assert.equal(named.json.task.campaignId, code);
    assert.equal(named.json.task.campaignDecision.kind, 'campaign');

    // WF-G85: the owner's ONE active campaign counts as the decision, so an
    // orchestrator is not forced to retype a campaign it already owns.
    const defaulted = await call('POST', '/tasks', { token: orch.token, body: { title: 'owner work', body: 'Complete the owner work.' } });
    assert.equal(defaulted.status, 201, defaulted.raw);
    assert.equal(defaulted.json.task.campaignId, code);
    assert.equal(defaulted.json.task.campaignDecision.kind, 'defaulted');
  });
});

test('WF-G293: required task intake refuses a title-only task with no body or refs', async () => {
  await withServer('required', async (call) => {
    const worker = await signIn(call, 'empty-task-intake-worker');
    const decision = { standalone: true, standaloneReason: 'one-off task' };
    for (const body of [
      { title: 'empty instructions', ...decision },
      { title: 'whitespace instructions', body: '   \n  ', refs: [], ...decision },
    ]) {
      const refused = await call('POST', '/tasks', { token: worker.token, body });
      assert.equal(refused.status, 400, refused.raw);
      assert.match(refused.json.error, /body.*refs|refs.*body/i);
      assert.match(refused.json.error, /WF-G293/);
    }
    assert.deepEqual((await call('GET', '/tasks')).json.tasks, []);

    const bodyTask = await call('POST', '/tasks', { token: worker.token,
      body: { title: 'body supplied', body: 'Repair the named module and verify its test.', ...decision } });
    assert.equal(bodyTask.status, 201, bodyTask.raw);
    const refTask = await call('POST', '/tasks', { token: worker.token,
      body: { title: 'ref supplied', refs: ['src/services/EntityResolverService.ts'], ...decision } });
    assert.equal(refTask.status, 201, refTask.raw);
  });
});

test('WF-G171: the legacy intake mode is the documented escape hatch, and it is explicit', async () => {
  await withServer('legacy', async (call) => {
    const worker = await signIn(call, 'legacy-http-worker');
    const bare = await call('POST', '/tasks', { token: worker.token, body: { title: 'no decision' } });
    assert.equal(bare.status, 201, bare.raw);
    // The task is created, and it SAYS the decision was absent, so a later
    // reviewer can tell it apart from a deliberate standalone task.
    assert.equal(bare.json.task.campaignDecision.kind, 'absent');
    assert.equal(bare.json.task.membership, '');
  });
});

test('WF-G169: POST /tasks/:id/campaign moves a task, and task show plus campaign show agree', async () => {
  await withServer('required', async (call) => {
    const orch = await signIn(call, 'move-http-orch', 'orchestrator');
    const worker = await signIn(call, 'move-http-worker');
    const keel = await call('POST', '/campaigns', {
      token: orch.token, body: { campaignId: 'keel-http', scope: 'k', paths: ['src/keel'] },
    });
    assert.equal(keel.status, 201, keel.raw);
    const mast = await call('POST', '/campaigns', {
      token: orch.token, body: { campaignId: 'mast-http', scope: 'm', paths: ['src/mast'] },
    });
    assert.equal(mast.status, 201, mast.raw);
    const keelId = keel.json.campaign.id;
    const mastId = mast.json.campaign.id;

    const made = await call('POST', '/tasks', {
      token: worker.token, body: { title: 'plank', body: 'Complete the plank task.', campaignId: keelId },
    });
    assert.equal(made.status, 201, made.raw);
    const id = made.json.task.id;

    // A worker cannot rewrite membership.
    const denied = await call('POST', `/tasks/${id}/campaign`, {
      token: worker.token, body: { campaignId: mastId, reason: 'try' },
    });
    assert.equal(denied.status, 403, denied.raw);

    // An unknown task is a 404, an unknown campaign is a 404, a missing reason
    // is a 400. Each refusal names what is wrong.
    assert.equal((await call('POST', '/tasks/no-such/campaign', {
      token: orch.token, body: { campaignId: mastId, reason: 'r' },
    })).status, 404);
    assert.equal((await call('POST', `/tasks/${id}/campaign`, {
      token: orch.token, body: { campaignId: 'ghost-campaign', reason: 'r' },
    })).status, 404);
    const noReason = await call('POST', `/tasks/${id}/campaign`, { token: orch.token, body: { campaignId: mastId } });
    assert.equal(noReason.status, 400, noReason.raw);
    assert.match(noReason.json.error, /needs a reason/);

    // The move.
    const moved = await call('POST', `/tasks/${id}/campaign`, {
      token: orch.token, body: { campaignId: mastId, reason: 'review found the right effort' },
    });
    assert.equal(moved.status, 200, moved.raw);
    assert.equal(moved.json.from, keelId);
    assert.equal(moved.json.to, mastId);

    // BOTH SIDES AGREE — the acceptance WF-G169 names.
    const shown = await call('GET', `/tasks/${id}`);
    assert.equal(shown.json.task.campaignId, mastId);
    const mastView = await call('GET', `/campaigns/${mastId}`);
    assert.deepEqual(mastView.json.tasks.map((t) => t.id), [id]);
    const keelView = await call('GET', `/campaigns/${keelId}`);
    assert.deepEqual(keelView.json.tasks.map((t) => t.id), []);

    // The audit entry is on the task.
    const entry = shown.json.task.history.find((h) => h.action === 'campaign');
    assert.ok(entry, 'the move must leave a history entry');
    assert.equal(entry.from, keelId);
    assert.equal(entry.to, mastId);
    assert.equal(entry.reason, 'review found the right effort');

    // Standalone is a supported destination.
    const loosed = await call('POST', `/tasks/${id}/campaign`, {
      token: orch.token, body: { standalone: true, reason: 'split out of the effort' },
    });
    assert.equal(loosed.status, 200, loosed.raw);
    assert.equal(loosed.json.task.campaignId, '');
    assert.equal(loosed.json.task.membership, 'standalone');
  });
});
