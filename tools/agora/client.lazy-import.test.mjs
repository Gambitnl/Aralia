// WF-G217: a broken task-lint helper must not take unrelated Agora commands offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createAgoraServer } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

test('WF-G217: board commands survive an invalid taskLint module', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-lazy-lint-'));
  const copyDir = path.join(root, 'client');
  const serverDir = path.join(root, 'server');
  const identityDir = path.join(root, 'identity');
  fs.mkdirSync(copyDir);
  for (const name of ['client.mjs', 'client-usage.txt', 'identity-policy.mjs', 'gapIndex.mjs', 'gapAppend.mjs']) {
    fs.copyFileSync(path.join(here, name), path.join(copyDir, name));
  }
  fs.writeFileSync(path.join(copyDir, 'taskLint.mjs'), 'export const broken = ;\n');

  const app = createAgoraServer({ dir: serverDir, campaignIntake: 'required' });
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    const { run } = await import(pathToFileURL(path.join(copyDir, 'client.mjs')).href);
    const env = { AGORA_DIR: identityDir, AGORA_AGENT_ID: 'lazy-lint-probe', AGORA_PET: 'gf-sd' };
    const call = (argv) => run(argv, { env, baseUrl });

    assert.equal((await call(['help'])).code, 0);
    const registered = await call(['register', 'lazy-lint-probe', '--pet', 'gf-sd']);
    assert.equal(registered.code, 0, registered.lines.join('\n'));
    assert.equal((await call(['tasks'])).code, 0);

    const creation = await call([
      'task', 'new', 'lint helper is broken', '--standalone', '--reason', 'isolated import test',
    ]);
    assert.equal(creation.code, 1);
    assert.match(creation.lines.join('\n'), /taskLint|task lint module/i);
    const board = await call(['tasks']);
    assert.equal(board.code, 0);
    assert.deepEqual(board.tasks, []);
  } finally {
    await app.close();
    const target = path.resolve(root);
    const tempRoot = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(target.startsWith(tempRoot), 'cleanup stays inside the test temp directory');
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('WF-G219: raw backticks in help prose cannot break client commands', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-help-isolation-'));
  const copyDir = path.join(root, 'client');
  fs.mkdirSync(copyDir);
  try {
    for (const name of ['client.mjs', 'client-usage.txt', 'identity-policy.mjs', 'gapIndex.mjs', 'gapAppend.mjs']) {
      fs.copyFileSync(path.join(here, name), path.join(copyDir, name));
    }
    const helpFile = path.join(copyDir, 'client-usage.txt');
    const help = fs.readFileSync(helpFile, 'utf8');
    assert.match(help, /task new --category <name> warns/);
    fs.writeFileSync(helpFile, help.replace(
      'task new --category <name> warns',
      '`task new --category <name>` warns',
    ));

    const copiedClient = path.join(copyDir, 'client.mjs');
    const syntax = spawnSync(process.execPath, ['--check', copiedClient], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
    const { run } = await import(pathToFileURL(copiedClient).href);
    const opts = {
      env: { AGORA_DIR: path.join(root, 'identity'), AGORA_AGENT_ID: 'help-isolation-probe' },
      baseUrl: 'http://127.0.0.1:1',
    };
    const shown = await run(['help'], opts);
    assert.equal(shown.code, 0);
    assert.match(shown.lines.join('\n'), /`task new --category <name>` warns/);
    fs.unlinkSync(helpFile);
    const unavailable = await run(['help'], opts);
    assert.equal(unavailable.code, 0);
    assert.match(unavailable.lines.join('\n'), /help unavailable/i);
    const who = await run(['whoami'], opts);
    assert.equal(who.code, 1);
    assert.match(who.lines.join('\n'), /not registered/);
  } finally {
    const target = path.resolve(root);
    const tempRoot = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(target.startsWith(tempRoot), 'cleanup stays inside the test temp directory');
    fs.rmSync(target, { recursive: true, force: true });
  }
});
