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
  env = { AGORA_DIR: clientDir, AGORA_PET: 'gf-sd' };
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
  assert.equal(ids[baseUrl].pet.slug, 'gf-sd');

  // --- whoami (local, reads the stored identity) ---
  const who = await cli(['whoami']);
  assert.equal(who.code, 0);
  assert.match(who.lines.join('\n'), /handle:\s+tester/);
  assert.match(who.lines.join('\n'), /pet:.*\(gf-sd\)/);

  // --- agents ---
  const agents = await cli(['agents']);
  assert.equal(agents.code, 0);
  assert.equal(agents.agents.length, 1);
  assert.equal(agents.agents[0].handle, 'tester');
  assert.equal(agents.agents[0].pet.slug, 'gf-sd');

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
  assert.notEqual(reg2.identity.pet.slug, 'gf-sd', 'the already-claimed pet is substituted');
  assert.equal(reg2.identity.petSubstituted, true);
  assert.match(reg2.lines.join('\n'), /already claimed; Agora assigned/);
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
  assert.equal(tclaim.task.assignedPet.kind, 'humanoid');
  assert.match(tclaim.lines.join('\n'), /pet: .+ \(.+\)/);

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

// ---------------------------------------------------------------------------
// Task-creation onboarding failures
// ---------------------------------------------------------------------------
// These cases use an isolated identity directory and the real in-process Agora
// server. Neither failure may add a board task, and both must show the complete
// safe onboarding command instead of a generic registration hint or raw 401.
// ---------------------------------------------------------------------------
test('task new directs missing and rejected identities to safe onboarding without creating a task', async () => {
  const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-task-onboarding-'));
  const isolatedEnv = { AGORA_DIR: isolatedDir, AGORA_AGENT_ID: 'task-onboarding-regression' };
  try {
    const tasksBefore = await fetch(`${baseUrl}/tasks`).then((response) => response.json());

    // With no stored identity, the client stops before contacting the task endpoint.
    const missingIdentity = await run(['task', 'new', 'Must not be created'], {
      env: isolatedEnv,
      baseUrl,
    });
    assert.notEqual(missingIdentity.code, 0);
    assert.match(missingIdentity.lines.join('\n'), /onboard <handle>/);
    assert.match(missingIdentity.lines.join('\n'), /--pet <slug>/);
    assert.match(missingIdentity.lines.join('\n'), /--session <task\/thread-id>/);

    // An explicit but invalid token reaches the server, receives 401, and gets
    // the same actionable recovery command rather than exposing only the status.
    const rejectedToken = await run([
      'task', 'new', 'Also must not be created', '--token', 'invalid-task-token',
    ], { env: isolatedEnv, baseUrl });
    assert.notEqual(rejectedToken.code, 0);
    assert.match(rejectedToken.lines.join('\n'), /task new failed \(401\)/);
    assert.match(rejectedToken.lines.join('\n'), /onboard <handle>/);
    assert.match(rejectedToken.lines.join('\n'), /--pet <slug>/);
    assert.match(rejectedToken.lines.join('\n'), /--session <task\/thread-id>/);

    // The board count is the acceptance boundary: neither rejected attempt may
    // leak a task into shared coordination state.
    const tasksAfter = await fetch(`${baseUrl}/tasks`).then((response) => response.json());
    assert.equal(tasksAfter.tasks.length, tasksBefore.tasks.length);
  } finally {
    fs.rmSync(isolatedDir, { recursive: true, force: true });
  }
});

test('pet discovery works before registration and the CLI refuses petless presence', async () => {
  const pets = await run(['pets'], { env: { AGORA_DIR: clientDir }, baseUrl });
  assert.equal(pets.code, 0);
  assert.ok(pets.pets.length >= 50);
  assert.match(pets.lines.join('\n'), /^gf-sd\s+/m);

  const petlessDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-petless-'));
  try {
    const rejected = await run(['register', 'petless-cli-worker'], {
      env: { AGORA_DIR: petlessDir, AGORA_AGENT_ID: 'petless-cli-worker' },
      baseUrl,
    });
    assert.equal(rejected.code, 1);
    assert.match(rejected.lines.join('\n'), /--pet <slug> is required/);
    assert.equal(fs.existsSync(path.join(petlessDir, 'client-identity.petless-cli-worker.json')), false);
    const roster = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(roster.agents.some((agent) => agent.handle === 'petless-cli-worker'), false);
  } finally {
    fs.rmSync(petlessDir, { recursive: true, force: true });
  }
});

test('CLI refuses Codex and orchestrator presence without the current task/thread id', async () => {
  const gateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-thread-gate-'));
  const gateEnv = { AGORA_DIR: gateDir, AGORA_AGENT_ID: 'codex-cli-thread-gate', AGORA_PET: 'gf-sd' };
  try {
    const rejected = await run(['register', 'codex-cli-thread-gate', '--model', 'gpt-5.6-sol'], {
      env: gateEnv,
      baseUrl,
    });
    assert.equal(rejected.code, 1);
    assert.match(rejected.lines.join('\n'), /task\/thread id.*required/i);
    assert.equal(fs.existsSync(path.join(gateDir, 'client-identity.codex-cli-thread-gate.json')), false);

    const accepted = await run([
      'register', 'codex-cli-thread-gate', '--model', 'gpt-5.6-sol', '--session', 'thread-cli-proof',
    ], { env: gateEnv, baseUrl });
    assert.equal(accepted.code, 0);
    assert.equal(accepted.identity.sessionId, 'thread-cli-proof');
  } finally {
    fs.rmSync(gateDir, { recursive: true, force: true });
  }
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

test('heartbeat is finite by default and stops at the bounded duration', async () => {
  const reg = await cli(['register', 'worker.bounded-heartbeat']);
  assert.equal(reg.code, 0);
  let currentMs = 0;
  const res = await cli(['heartbeat', '--every', '60'], {
    heartbeatOpts: {
      defaultForMin: 1,
      now: () => currentMs,
      sleep: async (ms) => { currentMs += ms; },
    },
  });
  assert.equal(res.code, 0);
  assert.equal(res.beats, 1);
  assert.equal(res.stopped, 'duration');
  assert.match(res.lines.join('\n'), /bounded heartbeat.*at most 1 minute/);
});

test('workflow-gap client surface preserves provenance, evidence, checkpoints, and bounded ownership', async () => {
  const scopedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-gap-surface-'));
  const scopedEnv = { AGORA_DIR: scopedDir, AGORA_AGENT_ID: 'gap-surface', AGORA_PET: 'gf-sd' };
  try {
    const reg = await run([
      'register', 'gap-surface', '--model', 'gpt-5.3-codex-spark', '--reasoning', 'high', '--session', 'thread-gap-surface',
    ], { env: scopedEnv, baseUrl });
    assert.equal(reg.code, 0);
    assert.equal(reg.identity.reasoningEffort, 'high');

    const who = await run(['whoami'], { env: scopedEnv, baseUrl });
    assert.equal(who.code, 0);
    assert.equal('token' in who.identity, false);
    assert.doesNotMatch(who.lines.join('\n'), /token:/i);
    assert.match(who.lines.join('\n'), /reasoning:\s+high/);

    const lock = await run(['lock', 'src/gap-surface.ts', '--ttl', '1'], { env: scopedEnv, baseUrl });
    const renewed = await run(['lock', '--renew', lock.lock.id, '--ttl', '5'], { env: scopedEnv, baseUrl });
    assert.equal(renewed.code, 0);
    assert.ok(renewed.lock.expiresAt > lock.lock.expiresAt);
    const ambiguous = await run(['lock', 'src/not-a-lock.ts', '--reason', 'unquoted', 'reason'], { env: scopedEnv, baseUrl });
    assert.equal(ambiguous.code, 1);
    assert.match(ambiguous.lines.join('\n'), /quote the complete --reason/);
    const phantomPaths = await run([
      'lock', 'src/not-a-lock.ts', 'inspector', 'and', 'assignment', '--reason', 'Readable',
    ], { env: scopedEnv, baseUrl });
    assert.equal(phantomPaths.code, 1);
    assert.match(phantomPaths.lines.join('\n'), /unrecognised bare path token/);

    const task = await run(['task', 'new', 'Gap surface task'], { env: scopedEnv, baseUrl });
    await run(['task', 'claim', task.task.id], { env: scopedEnv, baseUrl });
    const started = await run(['task', 'start', task.task.id, '--result', 'inspection started'], { env: scopedEnv, baseUrl });
    assert.equal(started.code, 0);
    assert.equal(started.task.state, 'in_progress');
    assert.equal(started.task.result, 'inspection started');

    const checkpoint = await run([
      'task', 'checkpoint', task.task.id, '--did', 'one', '--next', 'two', '--files', 'a.ts', '--files', 'b.ts,c.ts',
    ], { env: scopedEnv, baseUrl });
    assert.deepEqual(checkpoint.checkpoint.files, ['a.ts', 'b.ts', 'c.ts']);
    const rejectedCheckpoint = await run([
      'task', 'checkpoint', task.task.id, '--did', 'one', '--next', 'two', '--files', 'a.ts', 'b.ts',
    ], { env: scopedEnv, baseUrl });
    assert.equal(rejectedCheckpoint.code, 1);
    assert.match(rejectedCheckpoint.lines.join('\n'), /comma-separated or repeated --files/);

    const spawns = [];
    const detached = await run(['heartbeat', '--daemonize', '--every', '600'], {
      env: scopedEnv,
      baseUrl,
      heartbeatOpts: {
        spawnDetached: (...args) => {
          spawns.push(args);
          return { pid: 4242, unref() {} };
        },
      },
    });
    assert.equal(detached.code, 0);
    assert.equal(detached.detached, true);
    assert.equal(spawns.length, 1);
    assert.equal(spawns[0][2].detached, true);
    assert.equal(spawns[0][1].includes('--daemonize'), false);
  } finally {
    fs.rmSync(scopedDir, { recursive: true, force: true });
  }
});

test('heartbeat stops when its explicit owner process exits', async () => {
  const reg = await cli(['register', 'worker.owned-heartbeat']);
  assert.equal(reg.code, 0);
  let ownerRunning = true;
  const res = await cli(['heartbeat', '--every', '1', '--count', '2', '--owner-pid', '4242'], {
    heartbeatOpts: {
      ownerAlive: () => ownerRunning,
      sleep: async () => { ownerRunning = false; },
    },
  });
  assert.equal(res.code, 0);
  assert.equal(res.beats, 1);
  assert.equal(res.stopped, 'owner_exited');
  assert.match(res.lines.join('\n'), /owner PID 4242 exited/);
});

test('heartbeat requires explicit, unambiguous lifetime mode', async () => {
  const reg = await cli(['register', 'worker.heartbeat-flags']);
  assert.equal(reg.code, 0);
  const res = await cli(['heartbeat', '--forever', '--count', '1']);
  assert.equal(res.code, 1);
  assert.equal(res.beats, 0);
  assert.match(res.lines.join('\n'), /only one of --count, --for, or --forever/);
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
  const envA = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'prop-agent', AGORA_PET: 'gf-sd' };
  const envB = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'veg-agent', AGORA_PET: 'dream-girl' };
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
    const first = await run(['register', 'solo-worker'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'first', AGORA_PET: 'gf-sd' }, baseUrl });
    assert.equal(first.code, 0);

    // A second agent trying the SAME live handle is refused (no silent shared identity).
    const clash = await run(['register', 'solo-worker'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'second', AGORA_PET: 'dream-girl' }, baseUrl });
    assert.equal(clash.code, 1);
    assert.match(clash.lines.join('\n'), /already claimed/);

    // --random claims a distinct, unique handle instead.
    const rnd = await run(['register', '--random', 'solo-worker'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'second', AGORA_PET: 'dream-girl' }, baseUrl });
    assert.equal(rnd.code, 0);
    assert.notEqual(rnd.identity.handle, 'solo-worker');
    assert.match(rnd.identity.handle, /^solo-worker-[0-9a-f]{6}$/);
    assert.notEqual(rnd.identity.agentId, first.identity.agentId);

    // --allow-duplicate opts out of the claim check (legacy escape hatch).
    const dup = await run(['register', 'solo-worker', '--allow-duplicate'], { env: { AGORA_DIR: dir, AGORA_AGENT_ID: 'third', AGORA_PET: 'nous-girl' }, baseUrl });
    assert.equal(dup.code, 0);
    assert.equal(dup.identity.handle, 'solo-worker');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('agent provenance: register stamps model + session id; whoami and agents surface them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-prov-'));
  const e = { AGORA_DIR: dir, AGORA_AGENT_ID: 'prov', AGORA_PET: 'gf-sd' };
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
