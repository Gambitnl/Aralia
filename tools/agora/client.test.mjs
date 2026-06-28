// tools/agora/client.test.mjs
// Tests for the Agora client CLI. Node built-in runner only:
//   node --test "tools/agora/*.test.mjs"
//
// Boots the REAL server in-process (createAgoraServer) on an ephemeral port in a
// fresh temp dir, points the client at it via an explicit baseUrl + AGORA_DIR env
// (so identity persistence uses the temp dir, not the repo's .agent/agora), and
// drives the happy path by calling run() directly — no subprocesses.

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
  serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-srv-'));
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-id-'));
  app = createAgoraServer({ dir: serverDir });
  await new Promise((resolve) => app.listen(0, resolve));
  const port = app.server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  // Client identity file lands in clientDir/client-identity.json.
  env = { AGORA_DIR: clientDir };
});

after(async () => {
  if (app) await app.close();
  for (const d of [serverDir, clientDir]) {
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

// Convenience: invoke a command with the test env + baseUrl.
function cli(argv, extra = {}) {
  return run(argv, { env, baseUrl, ...extra });
}

test('happy path: register -> lock -> locks -> task -> say -> inbox', async () => {
  // --- register ---
  const reg = await cli(['register', 'tester', '--note', 'unit test agent']);
  assert.equal(reg.code, 0);
  assert.ok(reg.identity && reg.identity.token, 'register returns identity with token');
  assert.match(reg.lines.join('\n'), /Registered as "tester"/);

  // Identity persisted to the temp dir, keyed by baseUrl.
  const idFile = path.join(clientDir, 'client-identity.json');
  assert.ok(fs.existsSync(idFile), 'identity file written');
  const ids = JSON.parse(fs.readFileSync(idFile, 'utf8'));
  assert.ok(ids[baseUrl], 'identity keyed by baseUrl');
  assert.equal(ids[baseUrl].handle, 'tester');
  assert.equal(ids[baseUrl].agentId, reg.identity.agentId);

  // --- whoami (local, reads the stored identity) ---
  const who = await cli(['whoami']);
  assert.equal(who.code, 0);
  assert.match(who.lines.join('\n'), /handle:\s+tester/);

  // --- agents ---
  const agents = await cli(['agents']);
  assert.equal(agents.code, 0);
  assert.equal(agents.agents.length, 1);
  assert.equal(agents.agents[0].handle, 'tester');

  // --- lock (uses stored token automatically) ---
  const lock = await cli(['lock', 'src/foo.ts', '--reason', 'refactor', '--ttl', '5']);
  assert.equal(lock.code, 0);
  assert.ok(lock.lock && lock.lock.id, 'lock returns a lock id');
  assert.deepEqual(lock.lock.paths, ['src/foo.ts']);

  // Daemon state changed: a direct fetch sees the lock.
  const locksFetch = await fetch(`${baseUrl}/locks`).then((r) => r.json());
  assert.equal(locksFetch.locks.length, 1);
  assert.equal(locksFetch.locks[0].id, lock.lock.id);

  // --- locks (renders holder handle) ---
  const locks = await cli(['locks']);
  assert.equal(locks.code, 0);
  assert.equal(locks.locks.length, 1);
  assert.match(locks.lines.join('\n'), /tester/);
  assert.match(locks.lines.join('\n'), /src\/foo\.ts/);

  // --- lock conflict: a SECOND agent locking the same path -> 409 + exit 1 ---
  const reg2 = await cli(['register', 'rival']); // overwrites identity for this baseUrl
  assert.equal(reg2.code, 0);
  const conflict = await cli(['lock', 'src/foo.ts']);
  assert.equal(conflict.code, 1, 'conflicting lock exits non-zero');
  assert.ok(conflict.conflict, 'conflict surfaced');
  assert.match(conflict.lines.join('\n'), /CONFLICT/);
  assert.match(conflict.lines.join('\n'), /tester/); // holder resolved to handle

  // Re-register tester so subsequent commands use tester's token again.
  // (We stored tester's identity earlier; just point --token at it.)
  const testerToken = reg.identity.token;

  // --- task new / claim / state (explicit --token to avoid identity churn) ---
  const tnew = await cli(['task', 'new', 'Wire the thing', '--body', 'details', '--token', testerToken]);
  assert.equal(tnew.code, 0);
  const taskId = tnew.task.id;
  assert.equal(tnew.task.state, 'open');

  const tclaim = await cli(['task', 'claim', taskId, '--token', testerToken]);
  assert.equal(tclaim.code, 0);
  assert.equal(tclaim.task.state, 'claimed');

  const tstate = await cli(['task', 'state', taskId, 'in_progress', '--token', testerToken]);
  assert.equal(tstate.code, 0);
  assert.equal(tstate.task.state, 'in_progress');

  // Board groups by state.
  const tasks = await cli(['tasks']);
  assert.equal(tasks.code, 0);
  assert.match(tasks.lines.join('\n'), /\[in_progress\]/);
  assert.match(tasks.lines.join('\n'), /Wire the thing/);

  // Filtered board.
  const tasksFiltered = await cli(['tasks', '--state', 'open']);
  assert.equal(tasksFiltered.code, 0);
  assert.match(tasksFiltered.lines.join('\n'), /no tasks in state "open"/);

  // --- say (broadcast) ---
  const say = await cli(['say', 'hello', 'world', '--token', testerToken]);
  assert.equal(say.code, 0);
  assert.ok(say.message && say.message.seq >= 1);

  // --- say --to <handle> (handle resolved to agentId) ---
  const sayTo = await cli(['say', '--to', 'rival', 'ping', '--token', testerToken]);
  assert.equal(sayTo.code, 0);
  assert.equal(sayTo.message.to, reg2.identity.agentId, 'handle resolved to agentId');

  // --- inbox ---
  const inbox = await cli(['inbox']);
  assert.equal(inbox.code, 0);
  assert.ok(inbox.messages.length >= 1);
  assert.ok(inbox.maxSeq >= 1, 'inbox reports a max seq');
  assert.match(inbox.lines.join('\n'), /max seq/);

  // --since cursor filters out earlier messages.
  const inboxSince = await cli(['inbox', '--since', String(inbox.maxSeq)]);
  assert.equal(inboxSince.code, 0);
  assert.equal(inboxSince.messages.length, 0);

  // --- health ---
  const health = await cli(['health']);
  assert.equal(health.code, 0);
  assert.equal(health.health.ok, true);
  assert.ok(health.health.counts.locks >= 1);

  // Clean up the lock so the assertion count is self-contained.
  const unlock = await cli(['unlock', lock.lock.id, '--token', testerToken]);
  assert.equal(unlock.code, 0);
});

test('unreachable daemon -> friendly error + non-zero exit', async () => {
  // Point at a dead port; register hits the network and should fail gracefully.
  const res = await run(['agents'], { env, baseUrl: 'http://127.0.0.1:1' });
  assert.equal(res.code, 1);
  assert.match(res.lines.join('\n'), /not reachable/);
});

test('help / no command prints usage', async () => {
  const res = await run([], { env, baseUrl });
  assert.equal(res.code, 0);
  assert.match(res.lines.join('\n'), /Usage:/);
  assert.match(res.lines.join('\n'), /register <handle>/);
});

test('watch connects, receives the hello event, then disconnects', { timeout: 8000 }, async () => {
  // Drive watch with maxEvents:1 so it settles on the `hello` event.
  const res = await run(['watch'], {
    env,
    baseUrl,
    watchOpts: { maxEvents: 1, timeoutMs: 5000 },
  });
  assert.equal(res.code, 0);
  assert.ok(res.events >= 1, 'received at least the hello event');
  assert.match(res.lines.join('\n'), /connected/);
});
