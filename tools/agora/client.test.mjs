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
  const testerToken = reg.identity.token;

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

  // --- reservations: agents can queue for files before locking them ---
  const reserve = await cli(['reserve', 'src/reserved.ts', '--reason', 'next pass', '--token', testerToken]);
  assert.equal(reserve.code, 0);
  assert.equal(reserve.reservation.position, 1);
  assert.match(reserve.lines.join('\n'), /Reservation queued/);

  const reservations = await cli(['reservations']);
  assert.equal(reservations.code, 0);
  assert.ok(reservations.reservations.some((r) => r.id === reserve.reservation.id));
  assert.match(reservations.lines.join('\n'), /#1/);
  assert.match(reservations.lines.join('\n'), /src\/reserved\.ts/);

  const unreserve = await cli(['unreserve', reserve.reservation.id, '--token', testerToken]);
  assert.equal(unreserve.code, 0);
  assert.match(unreserve.lines.join('\n'), /Released reservation/);

  // --- lock conflict: a SECOND agent locking the same path -> 409 + exit 1 ---
  const reg2 = await cli(['register', 'rival']); // overwrites identity for this baseUrl
  assert.equal(reg2.code, 0);
  const conflict = await cli(['lock', 'src/foo.ts']);
  assert.equal(conflict.code, 1, 'conflicting lock exits non-zero');
  assert.ok(conflict.conflict, 'conflict surfaced');
  assert.match(conflict.lines.join('\n'), /CONFLICT/);
  assert.match(conflict.lines.join('\n'), /tester/); // holder resolved to handle

  // --- task new / claim / state (explicit --token to avoid identity churn) ---
  const tnew = await cli(['task', 'new', 'Wire the thing', '--body', 'details', '--token', testerToken]);
  assert.equal(tnew.code, 0);
  const taskId = tnew.task.id;
  assert.equal(tnew.task.state, 'open');
  assert.equal(tnew.task.creatorAgent.id, reg.identity.agentId);
  assert.equal(tnew.task.creatorAgent.handle, 'tester');

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

test('AGORA_AGENT_ID scopes identity: unlock --mine cannot release another agent\'s locks from the same checkout', async () => {
  // Two concurrent agents share ONE checkout (same AGORA_DIR) but set distinct
  // AGORA_AGENT_ID values. Regression for 2026-07-04: with a shared identity
  // file, `unlock --mine` from agent B released agent A's locks mid-edit.
  const sharedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-shared-'));
  const envA = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'prop-agent' };
  const envB = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'veg-agent' };
  try {
    const regA = await run(['register', 'prop-agent'], { env: envA, baseUrl });
    const regB = await run(['register', 'veg-agent'], { env: envB, baseUrl });
    assert.equal(regA.code, 0);
    assert.equal(regB.code, 0);

    // Separate identity files, separate agentIds.
    assert.ok(fs.existsSync(path.join(sharedDir, 'client-identity.prop-agent.json')));
    assert.ok(fs.existsSync(path.join(sharedDir, 'client-identity.veg-agent.json')));
    assert.notEqual(regA.identity.agentId, regB.identity.agentId);

    // B registering did NOT clobber A: A's whoami still resolves to A.
    const whoA = await run(['whoami'], { env: envA, baseUrl });
    assert.equal(whoA.identity.agentId, regA.identity.agentId);

    // A locks a file; B runs `unlock --mine` — A's lock must survive.
    const lockA = await run(['lock', 'src/props.ts', '--reason', 'prop placement'], { env: envA, baseUrl });
    assert.equal(lockA.code, 0);
    const unlockB = await run(['unlock', '--mine'], { env: envB, baseUrl });
    assert.equal(unlockB.code, 0);
    assert.match(unlockB.lines.join('\n'), /no locks held by you/);

    const locksAfter = await fetch(`${baseUrl}/locks`).then((r) => r.json());
    assert.ok(locksAfter.locks.some((l) => l.id === lockA.lock.id), "A's lock survived B's unlock --mine");

    // A can still release its own lock.
    const unlockA = await run(['unlock', '--mine'], { env: envA, baseUrl });
    assert.equal(unlockA.code, 0);
    assert.match(unlockA.lines.join('\n'), new RegExp(lockA.lock.id));
  } finally {
    fs.rmSync(sharedDir, { recursive: true, force: true });
  }
});

test('handle-claim uniqueness: registering a live agent\'s handle -> 409; --random auto-claims a free name', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-claim-'));
  try {
    // First agent claims "solo-worker".
    const first = await run(['register', 'solo-worker'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'first' }, baseUrl });
    assert.equal(first.code, 0);

    // A second agent trying the SAME live handle is refused (no silent shared identity).
    const clash = await run(['register', 'solo-worker'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'second' }, baseUrl });
    assert.equal(clash.code, 1);
    assert.match(clash.lines.join('\n'), /already claimed/);

    // --random claims a distinct, unique handle instead.
    const rnd = await run(['register', '--random', 'solo-worker'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'second' }, baseUrl });
    assert.equal(rnd.code, 0);
    assert.notEqual(rnd.identity.handle, 'solo-worker');
    assert.match(rnd.identity.handle, /^solo-worker-[0-9a-f]{6}$/);
    assert.notEqual(rnd.identity.agentId, first.identity.agentId);

    // --allow-duplicate opts out of the claim check (legacy escape hatch).
    const dup = await run(['register', 'solo-worker', '--allow-duplicate'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'third' }, baseUrl });
    assert.equal(dup.code, 0);
    assert.equal(dup.identity.handle, 'solo-worker');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('agent provenance: register stamps model + session id; whoami and agents surface them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-prov-'));
  const e = { AGORA_DIR: dir, AGORA_AGENT_ID: 'prov' };
  try {
    const reg = await run(
      ['register', 'prov-agent', '--model', 'claude-opus-4-8', '--session', 'conv-abc123'],
      { env: e, baseUrl },
    );
    assert.equal(reg.code, 0);
    assert.equal(reg.identity.model, 'claude-opus-4-8');
    assert.equal(reg.identity.sessionId, 'conv-abc123');
    assert.ok(reg.identity.registeredAt, 'checkout timestamp returned');

    // The identity file persists them so the agent can query itself offline.
    const who = await run(['whoami'], { env: e, baseUrl });
    assert.equal(who.code, 0);
    const w = who.lines.join('\n');
    assert.match(w, /model:\s+claude-opus-4-8/);
    assert.match(w, /sessionId:\s+conv-abc123/);
    assert.match(w, /checkedIn:\s+\d{4}-\d{2}-\d{2}T/);

    // The roster shows the model + how long ago each agent checked in.
    const agents = await run(['agents'], { env: e, baseUrl });
    const holder = agents.agents.find((a) => a.handle === 'prov-agent');
    assert.ok(holder, 'agent present in roster');
    assert.equal(holder.model, 'claude-opus-4-8');
    assert.ok(holder.registeredAt, 'registeredAt exposed on the roster');
    assert.match(agents.lines.join('\n'), /\[claude-opus-4-8\]/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
