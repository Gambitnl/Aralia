// Tests for board-seeded plans: `orchestrate seed` creates one task per packet
// (priority/refs/deps from the plan), and buildPrompt makes workers CLAIM the
// seeded task instead of inventing their own — the board IS the plan.
//   node --test "tools/agora/*.test.mjs"
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { validatePlan, buildPrompt, seedPlan } from './orchestrate.mjs';

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
    baseUrl,
    packets: [
      // Qualified refs — bare ids are ambiguity-checked against the REAL index at seed time.
      { id: 'PK-a', handle: 'w-a', agent: 'claude', scope: 'prep shared types', files: ['src/t.ts'], issues: ['seedtest:X1'], priority: 9 },
      { id: 'PK-b', handle: 'w-b', agent: 'claude', scope: 'build on the types', files: ['src/u.ts'], issues: ['seedtest:X2'], after: ['PK-a'] },
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
  assert.equal(a.priority, 9);
  assert.deepEqual(a.refs, ['seedtest:X1']);
  assert.equal(a.campaignId, 'seed-test');
  assert.equal(a.wave, 'seed-test');
  assert.deepEqual(b.deps, [a.id], 'after: [PK-a] became a task dep');

  const campaign = app.store.listCampaigns().find((c) => c.id === 'seed-test');
  assert.equal(campaign.role, 'lead');
  assert.equal(campaign.scope, 'wave:seed-test coordinator');
  assert.deepEqual(campaign.paths.sort(), ['src/t.ts', 'src/u.ts'].sort());

  // The dependency actually gates the board: only PK-a is ready.
  const ready = app.store.listTasks({ ready: true });
  assert.deepEqual(ready.map((t) => t.id), [a.id]);
});

test('seedPlan refuses to seed when another lead owns an overlapping campaign scope', async () => {
  const blocker = app.store.registerAgent({ handle: 'seed-blocker' });
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
    baseUrl,
    packets: [
      {
        id: 'PK-roadmap',
        handle: 'roadmap-worker',
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
  assert.equal(task.campaignId, 'planmap:tooling:roadmap-topic');

  const campaign = app.store.listCampaigns().find((c) => c.id === 'planmap:tooling:roadmap-topic');
  assert.equal(campaign.scope, 'Tooling: Roadmap Topic - tracker-owned scope');
  assert.equal(campaign.wave, 'roadmap-topic-wave');
  assert.deepEqual(campaign.paths, ['tools/agora/roadmap-feature.mjs']);
});

test('buildPrompt with a seeded taskId has the worker CLAIM it (no task new)', () => {
  const plan = makePlan();
  const p = buildPrompt(plan, plan.packets[0], { taskId: 'seeded-task-123' });
  assert.match(p, /TID=seeded-task-123/);
  assert.match(p, /task claim "\$TID"/);
  assert.doesNotMatch(p, /task new/);
  // Wrap-up contract unchanged: done-with-result + unlock + WORKFLOW.
  assert.match(p, /task done "\$TID" --result/);
});

test('buildPrompt without a seeded taskId keeps the create-your-own fallback', () => {
  const plan = makePlan();
  const p = buildPrompt(plan, plan.packets[0]);
  assert.match(p, /task new/);
});
