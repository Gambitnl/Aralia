// tools/agora/client.unlock-help.test.mjs
// GG-387 regression: `unlock --help` once released every lock its caller held,
// because the dispatcher did not catch help and cmdUnlockOne read the missing
// path as "release all". One agent lost 35 locks that way.
//
// These tests drive the candidate runtime (client-runtime.mjs) against private
// in-process servers only, never the live :4319 daemon:
//   1. with real owned locks, `unlock --help` / `-h` print usage and every lock
//      survives;
//   2. against a counting stub server, help sends no request at all;
//   3. a bare `unlock` refuses, names `unlock --mine`, and releases nothing,
//      while `unlock --mine` still releases everything.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';

import { createAgoraServer } from './server.mjs';
import { run as runCandidate } from './client-runtime.mjs';

// Boots a disposable real daemon and registers one agent holding two locks.
async function withOwnedLocks(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-unlock-help-'));
  const app = createAgoraServer({ dir: path.join(root, 'state'), seatRosterPath: null });
  try {
    await new Promise((resolve) => app.listen(0, resolve));
    const options = {
      baseUrl: 'http://127.0.0.1:' + app.server.address().port,
      repoRoot: root,
      env: { AGORA_DIR: path.join(root, 'identity'), AGORA_AGENT_ID: 'help-fixture' },
    };
    assert.equal((await runCandidate(['register', 'help-fixture', '--pet', 'dream-girl'], options)).code, 0);
    assert.equal((await runCandidate(['lock', 'src/a.ts', '--reason', 'GG-387 fixture'], options)).code, 0);
    assert.equal((await runCandidate(['lock', 'src/b.ts', '--reason', 'GG-387 fixture'], options)).code, 0);
    assert.equal(app.store.listLocks().length, 2);
    await fn({ app, options });
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('GG-387: unlock --help and unlock -h print usage and keep every owned lock', async () => {
  await withOwnedLocks(async ({ app, options }) => {
    for (const helpFlag of ['--help', '-h']) {
      const result = await runCandidate(['unlock', helpFlag], options);
      assert.equal(result.code, 0, result.lines.join('\n'));
      const text = result.lines.join('\n');
      assert.match(text, /unlock --mine\s+release ALL locks you hold/);
      assert.match(text, /no command was run/);
      assert.doesNotMatch(text, /Released/);
      assert.equal(app.store.listLocks().length, 2, `${helpFlag} must not release any lock`);
    }
  });
});

test('GG-387: command help sends no request to the daemon', async () => {
  const seen = [];
  const stub = createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end('{"error":"stub"}');
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-unlock-help-stub-'));
  try {
    await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve));
    const options = {
      baseUrl: 'http://127.0.0.1:' + stub.address().port,
      repoRoot: root,
      env: { AGORA_DIR: path.join(root, 'identity'), AGORA_AGENT_ID: 'help-stub' },
    };
    for (const argv of [['unlock', '--help'], ['unlock', '-h'], ['lock', '--help'], ['retire', '-h'], ['task', 'done', '-h']]) {
      const result = await runCandidate(argv, options);
      assert.equal(result.code, 0, `${argv.join(' ')}: ${result.lines.join('\n')}`);
      assert.ok(result.lines.join('\n').length > 0, `${argv.join(' ')} printed usage`);
    }
    assert.deepEqual(seen, [], 'help must not contact the daemon');
  } finally {
    await new Promise((resolve) => stub.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('GG-387: bare unlock refuses and names unlock --mine; unlock --mine still releases all', async () => {
  await withOwnedLocks(async ({ app, options }) => {
    for (const argv of [['unlock'], ['unlock', '--all']]) {
      const refused = await runCandidate(argv, options);
      assert.equal(refused.code, 1);
      assert.match(refused.lines.join('\n'), /nothing was released/);
      assert.match(refused.lines.join('\n'), /unlock --mine/);
      assert.equal(app.store.listLocks().length, 2, `${argv.join(' ')} must not release any lock`);
    }
    const released = await runCandidate(['unlock', '--mine'], options);
    assert.equal(released.code, 0, released.lines.join('\n'));
    assert.equal(app.store.listLocks().length, 0);
  });
});
