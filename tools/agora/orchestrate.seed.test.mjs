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
  assert.deepEqual(b.deps, [a.id], 'after: [PK-a] became a task dep');

  // The dependency actually gates the board: only PK-a is ready.
  const ready = app.store.listTasks({ ready: true });
  assert.deepEqual(ready.map((t) => t.id), [a.id]);
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
