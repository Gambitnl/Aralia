// tools/agora/client.orchestration.test.mjs
// CLI tests for the orchestrator-upgrade commands: task new --dep/--priority/--ref,
// task next, task done --result, tasks --ready.
//   node --test "tools/agora/*.test.mjs"

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { run } from './client.mjs';

let app;
let serverDir;
let clientDir;
let baseUrl;
let env;

before(async () => {
  serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-cli-orch-srv-'));
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-cli-orch-id-'));
  app = createAgoraServer({ dir: serverDir });
  await new Promise((resolve) => app.listen(0, resolve));
  const port = app.server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  env = { AGORA_DIR: clientDir };
});

after(async () => {
  if (app) await app.close();
  for (const d of [serverDir, clientDir]) {
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

function cli(argv, extra = {}) {
  return run(argv, { env, baseUrl, ...extra });
}

test('orchestration flow: deps + priority + next + done --result + ready view', async () => {
  const reg = await cli(['register', 'orch-cli', '--note', 'cli orchestration test']);
  assert.equal(reg.code, 0);

  // Create a prep task and a gated, high-priority build task referencing a gap.
  const a = await cli(['task', 'new', 'prep the fixtures', '--id-only']);
  assert.equal(a.code, 0);
  const aId = a.lines[0];

  const b = await cli([
    'task', 'new', 'build the feature',
    '--dep', aId, '--priority', '8', '--ref', 'spells:G12', '--id-only',
  ]);
  assert.equal(b.code, 0);
  assert.deepEqual(b.task.deps, [aId]);
  assert.equal(b.task.priority, 8);
  assert.deepEqual(b.task.refs, ['spells:G12']);

  // Ready queue: only the dep-free prep task.
  let ready = await cli(['tasks', '--ready']);
  assert.equal(ready.tasks.length, 1);
  assert.equal(ready.tasks[0].title, 'prep the fixtures');

  // Worker pulls it, completes it with a recorded result.
  const next = await cli(['task', 'next']);
  assert.equal(next.task.id, aId);
  const done = await cli(['task', 'done', aId, '--result', 'fixtures staged; 4 tests green']);
  assert.equal(done.code, 0);
  assert.equal(done.task.result, 'fixtures staged; 4 tests green');

  // The gated task is now the ready head; `tasks` shows the recorded result.
  ready = await cli(['tasks', '--ready']);
  assert.equal(ready.tasks[0].title, 'build the feature');
  const board = await cli(['tasks']);
  assert.match(board.lines.join('\n'), /result: fixtures staged; 4 tests green/);

  // Drain: next claims the build task, then reports an empty queue.
  const next2 = await cli(['task', 'next']);
  assert.equal(next2.task.title, 'build the feature');
  const dry = await cli(['task', 'next']);
  assert.equal(dry.task, null);
  assert.match(dry.lines.join('\n'), /no ready tasks/);
});
