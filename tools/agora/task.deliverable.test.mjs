import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { createStore } from './store.mjs';
import { run } from './client.mjs';

test('WF-G179: CLI, API, edit, and reload retain the expected output path', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-deliverable-'));
  const dataDir = path.join(root, 'data');
  const env = { AGORA_DIR: path.join(root, 'identity'), AGORA_AGENT_ID: 'deliverable-test', AGORA_PET: 'gf-sd' };
  const app = createAgoraServer({ dir: dataDir });
  let listening = false;
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    listening = true;
    const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    const cli = (argv) => run(argv, { env, baseUrl });
    const reg = await cli(['register', 'deliverable-test', '--pet', 'gf-sd']);
    assert.equal(reg.code, 0, reg.lines.join('\n'));

    const task = await cli([
      'task', 'new', 'Document dialogue boundaries', '--standalone', '--reason', 'one-off deepdive',
      '--body', 'Compare the dialogue models and write the report',
      '--ref', 'src/services/dialogueService.ts',
      '--deliverable', ' docs/deepdives/dialogue-models-boundary.md ',
    ]);
    assert.equal(task.code, 0, task.lines.join('\n'));
    assert.equal(task.task.deliverable, 'docs/deepdives/dialogue-models-boundary.md');

    const board = await (await fetch(`${baseUrl}/tasks`)).json();
    assert.equal(board.tasks.find((entry) => entry.id === task.task.id).deliverable, task.task.deliverable);
    const show = await cli(['task', 'show', task.task.id]);
    assert.equal(show.code, 0);
    const refsLine = show.lines.findIndex((line) => line.includes('refs:'));
    const deliverableLine = show.lines.findIndex((line) => line.includes('deliverable:'));
    assert.ok(refsLine >= 0 && deliverableLine === refsLine + 1, show.lines.join('\n'));
    assert.match(show.lines[deliverableLine], /docs\/deepdives\/dialogue-models-boundary\.md/);

    const edit = await cli([
      'task', 'edit', task.task.id, '--deliverable', 'docs/deepdives/dialogue-models-final.md',
      '--reason', 'final report path',
    ]);
    assert.equal(edit.code, 0, edit.lines.join('\n'));
    assert.equal(edit.task.deliverable, 'docs/deepdives/dialogue-models-final.md');

    const countBefore = (await (await fetch(`${baseUrl}/tasks`)).json()).tasks.length;
    const badCli = await cli([
      'task', 'new', 'Bad output path', '--standalone', '--reason', 'test',
      '--body', 'Must not be created', '--deliverable', '   ',
    ]);
    assert.equal(badCli.code, 1);
    assert.match(badCli.lines.join('\n'), /deliverable.*non-empty/i);
    const badApi = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${reg.identity.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bad API output path', body: 'Must not be created',
        standalone: true, standaloneReason: 'test', deliverable: 42,
      }),
    });
    assert.equal(badApi.status, 400);
    assert.match((await badApi.json()).error, /deliverable.*string/i);
    assert.equal((await (await fetch(`${baseUrl}/tasks`)).json()).tasks.length, countBefore);

    await app.close();
    listening = false;
    const reloaded = createStore({ dir: dataDir });
    try {
      assert.equal(
        reloaded.listTasks().find((entry) => entry.id === task.task.id).deliverable,
        'docs/deepdives/dialogue-models-final.md',
      );
    } finally {
      reloaded.close();
    }
  } finally {
    if (listening) await app.close();
    if (path.dirname(root) === os.tmpdir()) fs.rmSync(root, { recursive: true, force: true });
  }
});
