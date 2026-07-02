// Tests for the fresh-agent onboarding + heartbeat commands.
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
let idDir;
let gapsRoot;
let baseUrl;
let env;

before(async () => {
  serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-onboard-srv-'));
  idDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-onboard-id-'));
  gapsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-onboard-gaps-'));
  fs.mkdirSync(path.join(gapsRoot, 'spells'), { recursive: true });
  fs.writeFileSync(
    path.join(gapsRoot, 'spells', 'GAPS.md'),
    '| Gap ID | Status | Gap | Next action |\n|-|-|-|-|\n| G7 | open | upcast broken | fix slots |\n',
  );
  app = createAgoraServer({ dir: serverDir });
  await new Promise((resolve) => app.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  env = { AGORA_DIR: idDir };
});

after(async () => {
  if (app) await app.close();
  for (const d of [serverDir, idDir, gapsRoot]) if (d) fs.rmSync(d, { recursive: true, force: true });
});

function cli(argv, extra = {}) {
  return run(argv, { env, baseUrl, ...extra });
}

test('onboard: registers and prints the full situational briefing in one shot', async () => {
  // Pre-existing board state the newcomer should be shown.
  const senior = await cli(['register', 'senior-agent', '--note', 'already here']);
  assert.equal(senior.code, 0);
  await cli(['lock', 'src/held.ts', '--reason', 'mid-edit']);
  await cli(['task', 'new', 'ready work item', '--priority', '4']);

  // Fresh identity dir = a truly fresh agent.
  const freshId = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-onboard-fresh-'));
  const r = await run(['onboard', 'newcomer', '--note', 'fresh worker', '--gaps', gapsRoot], {
    env: { AGORA_DIR: freshId },
    baseUrl,
  });
  assert.equal(r.code, 0);
  const out = r.lines.join('\n');
  assert.match(out, /Registered as "newcomer"/);
  assert.match(out, /WHO IS HERE/i);
  assert.match(out, /senior-agent/);
  assert.match(out, /ACTIVE LOCKS/i);
  assert.match(out, /src\/held\.ts/);
  assert.match(out, /READY TASKS/i);
  assert.match(out, /ready work item/);
  assert.match(out, /OPEN GAPS/i);
  assert.match(out, /spells/); // fixture project surfaced
  assert.match(out, /THE RULES/i);
  assert.match(out, /lock BEFORE editing/i);
  assert.match(out, /--result/); // done-with-proof is part of the taught contract
  fs.rmSync(freshId, { recursive: true, force: true });
});

test('heartbeat: beats N times and keeps presence fresh', async () => {
  const r = await cli(['heartbeat', '--every', '0.05', '--count', '3']);
  assert.equal(r.code, 0);
  assert.equal(r.beats, 3);
  // The agent registered in the previous test is still online.
  const agents = app.store.listAgents();
  const me = agents.find((a) => a.handle === 'senior-agent');
  assert.equal(me.status, 'online');
});
