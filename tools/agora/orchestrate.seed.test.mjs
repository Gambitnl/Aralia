// Tests for board-seeded plans: `orchestrate seed` creates one task per packet
// (priority/refs/deps from the plan), and buildPrompt makes workers CLAIM the
// seeded task instead of inventing their own — the board IS the plan.
//   node --test "tools/agora/*.test.mjs"
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { createAgoraServer } from './server.mjs';
import { validatePlan, buildPrompt, seedPlan } from './orchestrate.mjs';

const execFileAsync = promisify(execFile);
const clientPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client.mjs');

let app;
let serverDir;
let idDir;
let baseUrl;
let env;

before(async () => {
  serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-seed-srv-'));
  idDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-seed-id-'));
  app = createAgoraServer({ dir: serverDir });
  await new Promise((resolve) => app.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  env = { AGORA_DIR: idDir };
});

after(async () => {
  if (app) await app.close();
  for (const d of [serverDir, idDir]) if (d) fs.rmSync(d, { recursive: true, force: true });
});

function makePlan() {
  return {
    wave: 'seed-test',
    pet: 'gf-sd',
    baseUrl,
    packets: [
      // Qualified refs — bare ids are ambiguity-checked against the REAL index at seed time.
      { id: 'PK-a', handle: 'w-a', pet: 'dream-girl', agent: 'claude', scope: 'prep shared types', files: ['src/t.ts'], issues: ['seedtest:X1'], priority: 9 },
      { id: 'PK-b', handle: 'w-b', pet: 'nous-girl', agent: 'claude', scope: 'build on the types', files: ['src/u.ts'], issues: ['seedtest:X2'], after: ['PK-a'] },
    ],
  };
}

test('validatePlan rejects an `after` reference to a packet not in the plan', () => {
  const bad = makePlan();
  bad.packets[1].after = ['PK-nope'];
  assert.throws(() => validatePlan(bad), /after.*PK-nope/i);
});

test('seedPlan creates one board task per packet with priority/refs/deps wired', async () => {
  const plan = makePlan();
  validatePlan(plan);
  const seeded = await seedPlan(plan, { env });

  assert.ok(seeded['PK-a'], 'PK-a task id returned');
  assert.ok(seeded['PK-b'], 'PK-b task id returned');

  const tasks = app.store.listTasks();
  const a = tasks.find((t) => t.id === seeded['PK-a']);
  const b = tasks.find((t) => t.id === seeded['PK-b']);
  assert.match(a.title, /PK-a: prep shared types/);
  assert.match(a.body, /Packet PK-a: prep shared types/);
  assert.match(a.body, /Owned files: src\/t\.ts/);
  assert.match(a.body, /Acceptance:.*concrete verification/);
  assert.equal(a.priority, 9);
  assert.deepEqual(a.refs, ['seedtest:X1']);
  assert.match(a.campaignId, /^agora-[0-9a-f]{4}$/);
  assert.equal(a.wave, 'seed-test');
  assert.deepEqual(b.deps, [{ id: a.id, type: 'blocks' }], 'after: [PK-a] became a typed task dep');

  // D-W: campaigns are found by the name a person chose; the id is a code.
  const campaign = app.store.listCampaigns().find((c) => c.name === 'seed-test');
  assert.equal(campaign.role, 'lead');
  assert.equal(campaign.scope, 'wave:seed-test coordinator');
  assert.deepEqual(campaign.paths.sort(), ['src/t.ts', 'src/u.ts'].sort());

  // The dependency actually gates the board: only PK-a is ready.
  const ready = app.store.listTasks({ ready: true });
  assert.deepEqual(ready.map((t) => t.id), [a.id]);
});

test('seedPlan refuses to seed when another lead owns an overlapping campaign scope', async () => {
  const blocker = app.store.registerAgent({ handle: 'seed-blocker', petSlug: 'cyberman' });
  app.store.claimCampaign({
    agentId: blocker.id,
    campaignId: 'seed-blocker-campaign',
    role: 'lead',
    scope: 'owns seed packet file',
    paths: ['src/t.ts'],
  });

  await assert.rejects(
    () => seedPlan({ ...makePlan(), wave: 'seed-conflict' }, { env: { AGORA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'agora-seed-conflict-id-')) } }),
    /overlaps active lead campaign/,
  );
});

test('seedPlan derives campaign identity and task refs from Plan Map topic refs', async () => {
  const planMapData = {
    campaigns: {
      tooling: { label: 'Tooling', color: 'gray' },
    },
    topics: [
      {
        id: 'roadmap-topic',
        title: 'Roadmap Topic',
        sub: 'tracker-owned scope',
        campaign: 'tooling',
      },
    ],
  };
  const plan = {
    wave: 'roadmap-topic-wave',
    pet: 'fiufiu-witch-2',
    baseUrl,
    packets: [
      {
        id: 'PK-roadmap',
        handle: 'roadmap-worker',
        pet: 'explorer-zombie',
        agent: 'claude',
        scope: 'Build the roadmap-tracked feature',
        files: ['tools/agora/roadmap-feature.mjs'],
        refs: ['planmap:roadmap-topic/build-the-roadmap-tracked-feature'],
      },
    ],
  };

  const seeded = await seedPlan(plan, {
    env: { AGORA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'agora-planmap-id-')) },
    planMapData,
  });
  const task = app.store.listTasks().find((t) => t.id === seeded['PK-roadmap']);
  assert.deepEqual(task.refs, ['planmap:roadmap-topic/build-the-roadmap-tracked-feature']);
  assert.match(task.campaignId, /^agora-[0-9a-f]{4}$/);

  const campaign = app.store.listCampaigns().find((c) => c.name === 'planmap:tooling:roadmap-topic');
  assert.equal(campaign.scope, 'Tooling: Roadmap Topic - tracker-owned scope');
  assert.equal(campaign.wave, 'roadmap-topic-wave');
  assert.deepEqual(campaign.paths, ['tools/agora/roadmap-feature.mjs']);
});

test('buildPrompt with a seeded taskId has the worker CLAIM it (no task new)', () => {
  const plan = makePlan();
  const p = buildPrompt(plan, plan.packets[0], { taskId: 'seeded-task-123' });
  assert.match(p, /task claim "seeded-task-123"/);
  assert.doesNotMatch(p, /task new/);
  // Wrap-up contract unchanged: done-with-result + unlock + WORKFLOW.
  assert.match(p, /task done "seeded-task-123" --result/);
  // WF-G160: prompt warns against piping scripts with backslashes through heredocs
  assert.match(p, /SCRIPTS WITH BACKSLASHES \(WF-G160\)/);
});

test('buildPrompt without a seeded taskId keeps the create-your-own fallback', () => {
  const plan = makePlan();
  const p = buildPrompt(plan, plan.packets[0]);
  assert.match(p, /task new/);
});

test('WF-G344: fresh identity directory survives register and live whoami in separate processes', async () => {
  const freshDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-wfg344-fresh-'));
  const workerEnv = { ...process.env, AGORA_DIR: freshDir, AGORA_AGENT_ID: 'wfg344-fresh-worker' };
  const call = (...args) => execFileAsync(process.execPath, [clientPath, ...args, '--url', baseUrl], { env: workerEnv });
  try {
    const registered = await call('register', 'wfg344-fresh-worker', '--pet', 'dream-girl', '--session', 'wfg344-test-thread');
    assert.match(registered.stdout, /Registered as "wfg344-fresh-worker"/);
    assert.equal(fs.existsSync(path.join(freshDir, 'client-identity.json')), false, 'no shared identity file');
    assert.equal(fs.existsSync(path.join(freshDir, 'client-identity.wfg344-fresh-worker.json')), true);

    const verified = await call('whoami', '--live');
    assert.match(verified.stdout, /live status: current/);
    assert.match(verified.stdout, /handle:\s+wfg344-fresh-worker/);
    await call('retire', '--note', 'WF-G344 test cleanup');
  } finally {
    fs.rmSync(freshDir, { recursive: true, force: true });
  }
});

test('seedPlan seeds one lead with two deputies from plan.campaign.deputies (WF-G152)', async () => {
  const plan = {
    ...makePlan(),
    wave: 'seed-deputies-wave',
    campaign: {
      id: 'umbrella-lead',
      scope: 'umbrella sweep coordinator',
      paths: ['src/w.ts', 'src/x.ts'],
      deputies: [
        { id: 'deputy-cluster-1', scope: 'cluster 1 scope', paths: ['src/w.ts'] },
        { id: 'deputy-cluster-2', scope: 'cluster 2 scope', paths: ['src/x.ts'] },
      ],
    },
    packets: [
      { id: 'PK-dep1', handle: 'w-dep1', pet: 'dream-girl', agent: 'claude', scope: 'task for cluster 1', files: ['src/w.ts'], campaign: 'deputy-cluster-1' },
      { id: 'PK-dep2', handle: 'w-dep2', pet: 'nous-girl', agent: 'claude', scope: 'task for cluster 2', files: ['src/x.ts'], campaign: 'deputy-cluster-2' },
    ],
  };

  const seeded = await seedPlan(plan, {
    env: { AGORA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'agora-deputies-id-')) },
  });

  assert.ok(seeded['PK-dep1']);
  assert.ok(seeded['PK-dep2']);

  const campaigns = app.store.listCampaigns();
  const lead = campaigns.find((c) => c.name === 'umbrella-lead');
  const dep1 = campaigns.find((c) => c.name === 'deputy-cluster-1');
  const dep2 = campaigns.find((c) => c.name === 'deputy-cluster-2');

  assert.ok(lead, 'lead campaign exists');
  assert.equal(lead.role, 'lead');

  assert.ok(dep1, 'deputy 1 exists');
  assert.equal(dep1.role, 'deputy');
  assert.equal(dep1.leadCampaignId, lead.id);

  assert.ok(dep2, 'deputy 2 exists');
  assert.equal(dep2.role, 'deputy');
  assert.equal(dep2.leadCampaignId, lead.id);

  const t1 = app.store.listTasks().find((t) => t.id === seeded['PK-dep1']);
  const t2 = app.store.listTasks().find((t) => t.id === seeded['PK-dep2']);
  assert.equal(t1.campaignId, dep1.id);
  assert.equal(t2.campaignId, dep2.id);
});

test('WF-G225: seed refuses mismatched claimed-task refs before campaign or task writes', async () => {
  const author = app.store.registerAgent({ handle: 'wfg225-preflight-author', petSlug: 'cyberman' });
  const task = app.store.createTask({
    agentId: author.id,
    title: 'Change a race leaf',
    refs: ['src/race/leaf.tsx'],
    standalone: true,
    standaloneReason: 'test fixture',
  });
  const plan = {
    ...makePlan(),
    wave: 'wfg225-preflight-wave',
    packets: [
      {
        id: 'PK-bridge',
        handle: 'wfg225-bridge-worker',
        pet: 'dream-girl',
        agent: 'claude',
        scope: 'bridge only',
        files: ['src/combat/bridge.ts'],
        taskIds: [task.id],
      },
    ],
  };
  const campaignsBefore = app.store.listCampaigns().length;
  const tasksBefore = app.store.listTasks().length;
  await assert.rejects(() => seedPlan(plan, { env }), /outside its owned files/);
  assert.equal(app.store.listCampaigns().length, campaignsBefore);
  assert.equal(app.store.listTasks().length, tasksBefore);
});
