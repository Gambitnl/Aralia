import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAgoraServer } from './server.mjs';
import { run } from './client.mjs';

test('WF-G236: incomplete argv is refused and a file-backed body survives intake intact', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-body-intake-'));
  const app = createAgoraServer({ dir: path.join(root, 'data') });
  const env = { AGORA_DIR: path.join(root, 'identity'), AGORA_AGENT_ID: 'body-intake-test', AGORA_PET: 'gf-sd' };
  let listening = false;
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    listening = true;
    const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    const cli = (argv) => run(argv, { env, baseUrl });
    const count = async () => (await (await fetch(`${baseUrl}/tasks`)).json()).tasks.length;
    const reg = await cli(['register', 'body-intake-test', '--pet', 'gf-sd']);
    assert.equal(reg.code, 0, reg.lines.join('\n'));

    const before = await count();
    const unquoted = await cli([
      'task', 'new', 'Companion naming requirement', '--standalone', '--reason', 'one-off',
      '--body', 'CompanionGenerator.generateSkeleton initializes generated companions with the placeholder name Generated',
      'Character and must replace it with a generated name',
    ]);
    assert.equal(unquoted.code, 1, unquoted.lines.join('\n'));
    assert.match(unquoted.lines.join('\n'), /unexpected.*positional|quote.*body/i);
    assert.equal(await count(), before, 'an unquoted tail must not create a shortened task');

    const bodyPath = path.join(root, 'complete-requirement.txt');
    const completeBody = 'CompanionGenerator.generateSkeleton initializes generated companions with the placeholder name "Generated Character".\nReplace the placeholder with a generated name tied to species and role; preserve explicitly authored names.';
    fs.writeFileSync(bodyPath, completeBody, 'utf8');
    const created = await cli([
      'task', 'new', 'Companion naming requirement', '--standalone', '--reason', 'one-off',
      '--body-file', bodyPath,
    ]);
    assert.equal(created.code, 0, created.lines.join('\n'));
    assert.equal(created.task.body, completeBody);
    const board = await (await fetch(`${baseUrl}/tasks`)).json();
    assert.equal(board.tasks.find((task) => task.id === created.task.id).body, completeBody);
    const shown = await cli(['task', 'show', created.task.id]);
    assert.equal(shown.code, 0, shown.lines.join('\n'));
    for (const line of completeBody.split('\n')) assert.ok(shown.lines.includes(`    ${line}`), shown.lines.join('\n'));

    const after = await count();
    const both = await cli([
      'task', 'new', 'Ambiguous body', '--standalone', '--reason', 'one-off',
      '--body', 'inline', '--body-file', bodyPath,
    ]);
    assert.equal(both.code, 1, both.lines.join('\n'));
    assert.match(both.lines.join('\n'), /body.*body-file.*(both|choose|one)/i);
    const missing = await cli([
      'task', 'new', 'Missing body file', '--standalone', '--reason', 'one-off',
      '--body-file', path.join(root, 'absent.txt'),
    ]);
    assert.equal(missing.code, 1, missing.lines.join('\n'));
    assert.match(missing.lines.join('\n'), /body-file.*(read|exist|file)/i);
    assert.equal(await count(), after, 'malformed file-backed invocations must not create tasks');
  } finally {
    if (listening) await app.close();
    if (path.dirname(root) === os.tmpdir()) fs.rmSync(root, { recursive: true, force: true });
  }
});
