// tools/agora/client.identity.test.mjs
// CLI tests for the agent-identity Wave 1 additions: register provenance flags,
// whois / lineage / tree, and retire. Boots the real server in-process.
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
  serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-id-srv-'));
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-id-cli-'));
  app = createAgoraServer({ dir: serverDir });
  await new Promise((resolve) => app.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  env = { AGORA_DIR: clientDir };
});

after(async () => {
  if (app) await app.close();
  for (const d of [serverDir, clientDir]) if (d) fs.rmSync(d, { recursive: true, force: true });
});

const cli = (argv) => run(argv, { env, baseUrl });

test('register provenance flags are stored and whois shows them', async () => {
  const reg = await cli(['register', 'master.desktop', '--role', 'master', '--type', 'claude-session', '--campaign', 'agora-fleet', '--cwd', 'F:/Repos/Aralia']);
  assert.equal(reg.code, 0);

  const who = await cli(['whois', 'master.desktop']);
  assert.equal(who.code, 0);
  const txt = who.lines.join('\n');
  assert.match(txt, /type:\s+claude-session/);
  assert.match(txt, /role:\s+master/);
  assert.match(txt, /campaign:\s+agora-fleet/);
});

test('lineage walks the spawnedBy chain, root first', async () => {
  await cli(['register', 'orch.lin', '--type', 'codex', '--spawned-by', 'master.desktop', '--campaign', 'linc']);
  await cli(['register', 'worker.lin', '--type', 'claude-subagent', '--spawned-by', 'orch.lin', '--campaign', 'linc']);

  const lin = await cli(['lineage', 'worker.lin']);
  assert.equal(lin.code, 0);
  const txt = lin.lines.join('\n');
  assert.ok(txt.indexOf('master.desktop') < txt.indexOf('orch.lin'), 'root before middle');
  assert.ok(txt.indexOf('orch.lin') < txt.indexOf('worker.lin'), 'middle before leaf');
});

test('tree groups agents by campaign', async () => {
  await cli(['register', 'orch.tree', '--campaign', 'treec', '--type', 'codex']);
  await cli(['register', 'worker.tree', '--campaign', 'treec', '--spawned-by', 'orch.tree']);

  const tr = await cli(['tree']);
  assert.equal(tr.code, 0);
  const txt = tr.lines.join('\n');
  assert.match(txt, /treec/);
  assert.match(txt, /orch\.tree/);
  assert.match(txt, /worker\.tree/);
});

test('retire removes the current agent from the roster', async () => {
  const reg = await cli(['register', 'worker.bye', '--type', 'codex']);
  assert.equal(reg.code, 0);

  const ret = await cli(['retire']);
  assert.equal(ret.code, 0);

  const who = await cli(['whois', 'worker.bye']);
  assert.equal(who.code, 1); // no longer on the roster
});
