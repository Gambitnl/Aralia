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
import { createStore } from './store.mjs';
import { execFileSync } from 'node:child_process';

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
  // The same scoped identity is reused by the main CLI fixture.
  env = { AGORA_DIR: clientDir, AGORA_AGENT_ID: 'client-test', AGORA_PET: 'gf-sd' };
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
  const idFile = path.join(clientDir, 'client-identity.client-test.json');
  assert.ok(fs.existsSync(idFile), 'identity file written');
  const ids = JSON.parse(fs.readFileSync(idFile, 'utf8'));
  assert.ok(ids[baseUrl], 'identity keyed by baseUrl');
  assert.equal(ids[baseUrl].handle, 'tester');
  assert.equal(ids[baseUrl].agentId, reg.identity.agentId);
  assert.equal(ids[baseUrl].pet.slug, 'gf-sd');

  // --- whoami (local, reads the stored identity) ---
  const who = await cli(['whoami']);
  assert.equal(who.code, 0);
  assert.match(who.lines.join('\n'), /^stored identity:/);
  assert.match(who.lines.join('\n'), /handle:\s+tester/);
  assert.match(who.lines.join('\n'), /pet:.*\(gf-sd\)/);
  assert.doesNotMatch(who.lines.join('\n'), new RegExp(testerToken));

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

  // WF-G296: an atomic batch grants none of its paths when just one conflicts.
  const atomic = await cli(['lock', 'src/foo.ts', 'src/atomic-free.ts']);
  assert.equal(atomic.code, 1);
  assert.match(atomic.lines.join('\n'), /No locks acquired by this atomic call/);
  assert.match(atomic.lines.join('\n'), /NOT ACQUIRED path "src\/atomic-free\.ts"/);
  const afterAtomic = await fetch(`${baseUrl}/locks`).then((r) => r.json());
  assert.equal(afterAtomic.locks.some((item) => item.paths.includes('src/atomic-free.ts')), false);

  // WF-G311/WF-G331: opt-in partial mode reports actual per-target results,
  // takes free paths/globs, and still exits non-zero for an incomplete batch.
  const partial = await cli(['lock', 'src/foo.ts', 'src/partial-free.ts', '--glob', 'src/partial/*.ts', '--partial']);
  assert.equal(partial.code, 1);
  assert.deepEqual(partial.results.map((item) => item.status), ['conflict', 'acquired', 'acquired']);
  assert.equal(partial.locks.length, 2);
  assert.match(partial.lines.join('\n'), /NOT ACQUIRED path "src\/foo\.ts"/);
  assert.match(partial.lines.join('\n'), /ACQUIRED path "src\/partial-free\.ts"/);
  assert.match(partial.lines.join('\n'), /ACQUIRED glob "src\/partial\/\*\.ts"/);
  assert.match(partial.lines.join('\n'), /Only ACQUIRED targets may be edited/);
  const afterPartial = await fetch(`${baseUrl}/locks`).then((r) => r.json());
  for (const item of partial.locks) assert.ok(afterPartial.locks.some((held) => held.id === item.id));
  assert.equal(afterPartial.locks.some((item) => item.agentId === reg2.identity.agentId && item.paths.includes('src/foo.ts')), false);

  const ambiguousPartial = await cli(['lock', 'src/not-taken.ts', '--partial', '--id-only']);
  assert.equal(ambiguousPartial.code, 1);
  assert.match(ambiguousPartial.lines.join('\n'), /cannot be combined with --id-only/);
  assert.equal((await fetch(`${baseUrl}/locks`).then((r) => r.json())).locks.some((item) => item.paths.includes('src/not-taken.ts')), false);
  assert.equal((await cli(['unlock', '--mine'])).code, 0); // rival's partial locks only

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
// Registration scope continuity
// ---------------------------------------------------------------------------
// Registration must never tell an already-onboarded agent to change the scope
// that selected its identity file. This reproduces the safe AGORA_DIR-only flow
// and proves the literal printed advice leaves the first owned lock usable.
// ---------------------------------------------------------------------------
test('onboarding without AGORA_AGENT_ID preserves its existing identity scope for the next lock', async () => {
  const continuityDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-scope-continuity-'));
  const continuityEnv = { AGORA_DIR: continuityDir, AGORA_PET: 'battle-damaged-idle' };
  let onboard;
  try {
    // A unique AGORA_DIR is already a safe identity scope. Onboarding should
    // tell the agent to preserve it, never to add AGORA_AGENT_ID afterward.
    onboard = await run([
      'onboard', 'scope-continuity-worker', '--session', 'thread-scope-continuity', '--legacy-unscoped',
    ], { env: continuityEnv, baseUrl });
    assert.equal(onboard.code, 0);
    const printed = onboard.lines.join('\n');
    assert.match(printed, /Keep AGORA_AGENT_ID and AGORA_DIR unchanged for later commands/);
    assert.doesNotMatch(printed, /TIP: export AGORA_AGENT_ID=/);
    assert.doesNotMatch(printed, new RegExp(onboard.identity.token));

    // Following that advice verbatim means reusing the unchanged environment.
    // The stored bearer remains private while the real server accepts the lock.
    const lock = await run([
      'lock', 'tools/agora/scope-continuity-proof.mjs', '--reason', 'scope continuity regression',
    ], { env: continuityEnv, baseUrl });
    assert.equal(lock.code, 0);
    assert.match(lock.lines.join('\n'), /Lock acquired/);
    assert.doesNotMatch(lock.lines.join('\n'), new RegExp(onboard.identity.token));
  } finally {
    // Retiring through the unchanged scope releases any owned proof lock and
    // prevents this focused case from affecting later tests in the same server.
    if (onboard?.code === 0) {
      await run(['retire'], { env: continuityEnv, baseUrl });
    }
    fs.rmSync(continuityDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Stored identity liveness diagnosis
// ---------------------------------------------------------------------------
// This isolated server uses a controlled clock so the test can prove that the
// live check reads authentication state without extending the presence lease.
// It then exercises both ways saved identity can stop authenticating: reaping
// by the server and a locally corrupted bearer token.
// ---------------------------------------------------------------------------
test('whoami --live distinguishes live, reaped, and invalid saved identity without renewing presence', async () => {
  const isolatedServerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-whoami-live-srv-'));
  const isolatedClientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-whoami-live-id-'));
  let currentMs = 10_000;
  const isolatedApp = createAgoraServer({
    dir: isolatedServerDir,
    storeFactory: ({ dir }) => createStore({
      dir,
      now: () => currentMs,
      presenceTtlMs: 100,
      presenceDropMs: 1_000,
    }),
  });
  try {
    await new Promise((resolve) => isolatedApp.listen(0, resolve));
    const isolatedBaseUrl = `http://127.0.0.1:${isolatedApp.server.address().port}`;
    const isolatedEnv = { AGORA_DIR: isolatedClientDir, AGORA_AGENT_ID: 'whoami-live', AGORA_PET: 'nous-girl' };

    // Registration establishes a saved token at the controlled starting time.
    const registered = await run(['register', 'whoami-live-worker'], {
      env: isolatedEnv,
      baseUrl: isolatedBaseUrl,
    });
    assert.equal(registered.code, 0);
    const initialLastSeen = isolatedApp.store.listAgents()[0].lastSeen;

    // Moving the clock makes the identity stale. A successful live check must
    // report that stored identity yet leave lastSeen at its original value.
    currentMs += 500;
    const live = await run(['whoami', '--live'], { env: isolatedEnv, baseUrl: isolatedBaseUrl });
    assert.equal(live.code, 0);
    assert.equal(live.live, true);
    assert.match(live.lines.join('\n'), /live status: current \(stale\)/);
    assert.equal(isolatedApp.store.listAgents()[0].lastSeen, initialLastSeen, 'diagnosis did not renew presence');
    assert.doesNotMatch(live.lines.join('\n'), new RegExp(registered.identity.token));

    // Once the controlled clock passes the drop horizon and the store reaps the
    // agent, the unchanged saved file must be diagnosed as no longer live.
    currentMs += 501;
    isolatedApp.store.sweepExpired();
    const reaped = await run(['whoami', '--live'], { env: isolatedEnv, baseUrl: isolatedBaseUrl });
    assert.equal(reaped.code, 1);
    assert.equal(reaped.live, false);
    assert.match(reaped.lines.join('\n'), /stored identity was reaped or retired/);
    assert.doesNotMatch(reaped.lines.join('\n'), /saved bearer is invalid/);

    // A new registration proves the same response also covers a malformed
    // local bearer while its real server-side presence remains current.
    const replacement = await run(['register', 'whoami-invalid-worker'], {
      env: isolatedEnv,
      baseUrl: isolatedBaseUrl,
    });
    assert.equal(replacement.code, 0);
    const identityFile = path.join(isolatedClientDir, 'client-identity.whoami-live.json');
    const saved = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
    saved[isolatedBaseUrl].token = 'deliberately-invalid-token';
    fs.writeFileSync(identityFile, JSON.stringify(saved, null, 2) + '\n');
    const invalid = await run(['whoami', '--live'], { env: isolatedEnv, baseUrl: isolatedBaseUrl });
    assert.equal(invalid.code, 1);
    assert.equal(invalid.live, false);
    assert.match(invalid.lines.join('\n'), /stored presence exists, but its saved bearer is invalid/);
    assert.doesNotMatch(invalid.lines.join('\n'), /identity was reaped or retired/);
    assert.doesNotMatch(invalid.lines.join('\n'), /deliberately-invalid-token/);
  } finally {
    await isolatedApp.close();
    fs.rmSync(isolatedServerDir, { recursive: true, force: true });
    fs.rmSync(isolatedClientDir, { recursive: true, force: true });
  }
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

test('WF-G303: task help prints canonical task usage without daemon or identity', async () => {
  const options = { env: {}, baseUrl: 'http://127.0.0.1:1' };
  const all = await run(['task', '--help'], options);
  assert.equal(all.code, 0);
  assert.match(all.lines.join('\n'), /task checkpoint <taskId> --did/);
  assert.match(all.lines.join('\n'), /task new <title>/);
  assert.doesNotMatch(all.lines.join('\n'), /unknown task subcommand/);

  const specific = await run(['task', 'checkpoint', '--help'], options);
  assert.equal(specific.code, 0);
  assert.match(specific.lines.join('\n'), /--did "\.\.\." --next "\.\.\." \[--files/);
  assert.doesNotMatch(specific.lines.join('\n'), /task new <title>/);
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

test('WF-G156: unlock <a> <b> releases every named path of a multi-path lock', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-unlock-multi-'));
  const env = { AGORA_DIR: dir, AGORA_AGENT_ID: 'multi-unlock-agent', AGORA_PET: 'cyberman' };
  try {
    const reg = await run(['register', 'multi-unlock-agent'], { env, baseUrl });
    assert.equal(reg.code, 0);
    const lock = await run(['lock', 'src/a-multi.ts', 'src/b-multi.ts', 'src/c-multi.ts', '--reason', 'three files'], { env, baseUrl });
    assert.equal(lock.code, 0);
    const un = await run(['unlock', 'src/a-multi.ts', 'src/b-multi.ts'], { env, baseUrl });
    assert.equal(un.code, 0);
    const after = await fetch(`${baseUrl}/locks`).then((r) => r.json());
    const mine = after.locks.filter((l) => l.agentId === reg.identity.agentId);
    const held = mine.flatMap((l) => l.paths || []);
    assert.deepEqual(held, ['src/c-multi.ts'], 'only the third path stays held');
    await run(['unlock', '--mine'], { env, baseUrl });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Legacy default identity safety
// ---------------------------------------------------------------------------
// These cases keep all identity files in fresh temporary directories. The
// first proves the old shared default slot cannot be silently overwritten; the
// second proves explicit per-agent scopes still isolate destructive commands.
// ---------------------------------------------------------------------------
test('default onboarding refuses to overwrite a live identity and keeps later commands bound to the first agent', async () => {
  const defaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-default-safety-'));
  const defaultEnv = { AGORA_PET: 'king-david' };
  try {
    // A claims the unscoped default slot and owns a lock through that identity.
    const onboardA = await run(['onboard', 'legacy-default-a', '--legacy-unscoped'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(onboardA.code, 0);
    const lockA = await run(['lock', 'src/default-a.ts'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(lockA.code, 0);

    // B's second default onboarding must stop before registration, preserving
    // both the saved A identity and the live roster rather than replacing A.
    const rosterBefore = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    const onboardB = await run(['onboard', 'legacy-default-b', '--pet', 'king-solomon', '--legacy-unscoped'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(onboardB.code, 1);
    assert.match(onboardB.lines.join('\n'), /default identity still belongs to live agent "legacy-default-a"/);
    assert.match(onboardB.lines.join('\n'), /AGORA_AGENT_ID or AGORA_DIR/);

    const defaultFile = path.join(defaultDir, 'client-identity.json');
    const saved = JSON.parse(fs.readFileSync(defaultFile, 'utf8'));
    assert.equal(saved[baseUrl].agentId, onboardA.identity.agentId);
    assert.equal(saved[baseUrl].handle, 'legacy-default-a');
    const rosterAfter = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(rosterAfter.agents.length, rosterBefore.agents.length, 'refused onboarding did not POST a new presence');
    assert.equal(rosterAfter.agents.some((agent) => agent.handle === 'legacy-default-b'), false);

    // Since B never replaced the file, default-scope unlock and retire remain
    // authenticated as A and affect only A's lock and presence.
    const unlockA = await run(['unlock', '--mine'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(unlockA.code, 0);
    assert.match(unlockA.lines.join('\n'), new RegExp(lockA.lock.id));
    const retireA = await run(['retire'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(retireA.code, 0);
    const finalRoster = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(finalRoster.agents.some((agent) => agent.id === onboardA.identity.agentId), false);

    // Once A is no longer live, the same default slot is reusable. This keeps
    // the safety stop bounded to real collisions instead of requiring cleanup.
    const onboardBAfterRetire = await run(['onboard', 'legacy-default-b', '--legacy-unscoped'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(onboardBAfterRetire.code, 0);
    const retireB = await run(['retire'], {
      env: defaultEnv,
      baseUrl,
      identityDirOverride: defaultDir,
    });
    assert.equal(retireB.code, 0);
  } finally {
    fs.rmSync(defaultDir, { recursive: true, force: true });
  }
});

test('WF-G344/WF-G345: unscoped registration is refused beside scoped identities, and a late key names the missing file', async () => {
  const sharedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-missed-scope-'));
  const lateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-late-scope-'));
  const scopedEnv = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'wf-g344-owner', AGORA_PET: 'warrior' };
  const unscopedEnv = { AGORA_DIR: sharedDir, AGORA_PET: 'mage' };
  const legacyEnv = { AGORA_DIR: lateDir, AGORA_PET: 'dollman' };
  let scopedRegistration;
  let legacyRegistration;
  try {
    scopedRegistration = await run(['register', 'wf-g344-owner'], { env: scopedEnv, baseUrl });
    assert.equal(scopedRegistration.code, 0);
    const rosterBefore = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    const refused = await run(['register', 'wf-g344-unscoped'], { env: unscopedEnv, baseUrl });
    assert.equal(refused.code, 1);
    assert.match(refused.lines.join('\n'), /AGORA_AGENT_ID is unset.*scoped identity file/);
    assert.match(refused.lines.join('\n'), /No presence was created/);
    assert.equal(fs.existsSync(path.join(sharedDir, 'client-identity.json')), false);
    const rosterAfter = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(rosterAfter.agents.length, rosterBefore.agents.length);
    assert.equal(rosterAfter.agents.some((agent) => agent.handle === 'wf-g344-unscoped'), false);
    assert.equal((await run(['whoami'], { env: scopedEnv, baseUrl })).identity.agentId, scopedRegistration.identity.agentId);

    // Even a fresh checkout must refuse before POST. The earlier scoped-file
    // guard did not cover this case, so it silently created a stranded token.
    const freshEnv = { AGORA_PET: 'dollman' };
    const freshRoster = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    const freshRefused = await run(['register', 'wf-g344-fresh'], {
      env: freshEnv, baseUrl, identityDirOverride: lateDir,
    });
    assert.equal(freshRefused.code, 1);
    assert.match(freshRefused.lines.join('\n'), /AGORA_AGENT_ID is unset/);
    assert.match(freshRefused.lines.join('\n'), /No presence was created/);
    assert.equal(fs.existsSync(path.join(lateDir, 'client-identity.json')), false);
    const afterFresh = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(afterFresh.agents.length, freshRoster.agents.length);

    // Deliberate single-agent compatibility remains explicit. Adding a key
    // only afterward still cannot borrow its token or another agent's locks.
    legacyRegistration = await run(['register', 'wf-g344-legacy', '--legacy-unscoped'], { env: legacyEnv, baseUrl });
    assert.equal(legacyRegistration.code, 0);
    const lateEnv = { ...legacyEnv, AGORA_AGENT_ID: 'wf-g344-late' };
    const missing = await run(['lock', 'src/wf-g344-not-owned.ts'], { env: lateEnv, baseUrl });
    assert.equal(missing.code, 1);
    assert.match(missing.lines.join('\n'), /client-identity\.wf-g344-late\.json/);
    assert.match(missing.lines.join('\n'), /setting it only afterward does not move an unscoped identity/);
    const locks = await fetch(`${baseUrl}/locks`).then((response) => response.json());
    assert.equal(locks.locks.some((lock) => lock.paths.includes('src/wf-g344-not-owned.ts')), false);
  } finally {
    if (scopedRegistration?.code === 0) await run(['retire'], { env: scopedEnv, baseUrl });
    if (legacyRegistration?.code === 0) await run(['retire'], { env: legacyEnv, baseUrl });
    fs.rmSync(sharedDir, { recursive: true, force: true });
    fs.rmSync(lateDir, { recursive: true, force: true });
  }
});

test('explicit A and B scopes keep B locked and live when A unlocks and retires', async () => {
  const sharedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-client-explicit-safety-'));
  const envA = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'explicit-a', AGORA_PET: 'mansui' };
  const envB = { AGORA_DIR: sharedDir, AGORA_AGENT_ID: 'explicit-b', AGORA_PET: 'dollman' };
  try {
    // Both explicit scopes get independent identity files and own one lock.
    const regA = await run(['register', 'explicit-safety-a'], { env: envA, baseUrl });
    const regB = await run(['register', 'explicit-safety-b'], { env: envB, baseUrl });
    assert.equal(regA.code, 0);
    assert.equal(regB.code, 0);
    const lockA = await run(['lock', 'src/explicit-a.ts'], { env: envA, baseUrl });
    const lockB = await run(['lock', 'src/explicit-b.ts'], { env: envB, baseUrl });
    assert.equal(lockA.code, 0);
    assert.equal(lockB.code, 0);

    // A may release all of A's own locks without matching B's agent id.
    const unlockA = await run(['unlock', '--mine'], { env: envA, baseUrl });
    assert.equal(unlockA.code, 0);
    assert.match(unlockA.lines.join('\n'), new RegExp(lockA.lock.id));
    const locksAfterUnlock = await fetch(`${baseUrl}/locks`).then((response) => response.json());
    assert.ok(locksAfterUnlock.locks.some((lock) => lock.id === lockB.lock.id), "B's lock survived A's unlock --mine");

    // A's retirement removes A alone. B remains present and continues to own
    // the same lock, proving the saved tokens never crossed identity scopes.
    const retireA = await run(['retire'], { env: envA, baseUrl });
    assert.equal(retireA.code, 0);
    const rosterAfterRetire = await fetch(`${baseUrl}/agents`).then((response) => response.json());
    assert.equal(rosterAfterRetire.agents.some((agent) => agent.id === regA.identity.agentId), false);
    assert.equal(rosterAfterRetire.agents.some((agent) => agent.id === regB.identity.agentId), true);
    const locksAfterRetire = await fetch(`${baseUrl}/locks`).then((response) => response.json());
    assert.ok(locksAfterRetire.locks.some((lock) => lock.id === lockB.lock.id), "B's lock survived A's retire");

    // Clean the isolated B presence so this regression leaves no state behind
    // for later tests sharing the same in-process server.
    const retireB = await run(['retire'], { env: envB, baseUrl });
    assert.equal(retireB.code, 0);
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

// ---------------------------------------------------------------------------
// Board task agora-6f81 / WF-G64: short task-id prefixes on state-changing verbs.
// ---------------------------------------------------------------------------
test('task state/done accept a unique short-id prefix, ignore case, and refuse an ambiguous one', async () => {
  const reg = await cli(['register', 'prefix-tester', '--note', 'prefix test']);
  assert.equal(reg.code, 0);
  const token = reg.identity.token;
  const a = await cli(['task', 'new', 'prefix alpha', '--campaign', 'none', '--token', token]);
  const b = await cli(['task', 'new', 'prefix beta', '--campaign', 'none', '--token', token]);
  assert.equal(a.code, 0);
  assert.equal(b.code, 0);
  await cli(['task', 'claim', a.task.id, '--token', token]);

  // 1. Case does not matter: the upper-cased full id still names the task.
  const upper = await cli(['task', 'state', a.task.id.toUpperCase(), 'in_progress', '--token', token]);
  assert.equal(upper.code, 0, upper.lines.join('\n'));
  assert.equal(upper.task.id, a.task.id);

  // 2. A prefix shared by every task on the board is refused, with the candidates listed.
  const ambiguous = await cli(['task', 'state', 'agora-', 'in_progress', '--token', token]);
  assert.equal(ambiguous.code, 1);
  assert.match(ambiguous.lines.join('\n'), /ambiguous task id "agora-" matches \d+ tasks/);

  // 3. The shortest prefix that is unique on the board resolves to the full id.
  const board = await cli(['tasks']);
  assert.equal(board.code, 0);
  const all = (await (await fetch(`${baseUrl}/tasks`)).json()).tasks.map((t) => t.id);
  let prefix = a.task.id;
  while (prefix.length > 1 && all.filter((id) => id.startsWith(prefix.slice(0, -1))).length === 1) prefix = prefix.slice(0, -1);
  assert.notEqual(prefix, a.task.id, 'the board must allow at least one char to be dropped');
  const done = await cli(['task', 'done', prefix, '--result', 'prefix ok', '--token', token]);
  assert.equal(done.code, 0, done.lines.join('\n'));
  assert.equal(done.task.id, a.task.id);
  assert.equal(done.task.state, 'done');
});

// WF-G129 (2026-09-09): a free lock on a dirty file must say so.
test('WF-G129: dirtyInWorktree names files that already differ from HEAD and stays silent on clean ones', async () => {
  const { dirtyInWorktree } = await import('./client.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-dirty-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    fs.writeFileSync(path.join(root, 'clean.ts'), 'a\n');
    fs.writeFileSync(path.join(root, 'dirty.ts'), 'a\n');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    fs.writeFileSync(path.join(root, 'dirty.ts'), 'b\n');
    const oldWrite = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(root, 'dirty.ts'), oldWrite, oldWrite);
    fs.writeFileSync(path.join(root, 'new.ts'), 'c\n');
    const hints = dirtyInWorktree(['clean.ts', 'dirty.ts', 'new.ts'], root);
    assert.equal(hints.length, 2, hints.join('\n'));
    assert.match(hints.find((h) => h.startsWith('dirty.ts')), /already modified/);
    assert.match(hints.find((h) => h.startsWith('new.ts')), /untracked/);
    // WF-G275: git ls-files --eol is silently empty for untracked files, so
    // the lock warning itself must report the on-disk line endings.
    assert.match(hints.find((h) => h.startsWith('new.ts')), /EOL: LF \(1 LF, 0 CRLF, 0 bare CR\)/);
    fs.writeFileSync(path.join(root, 'crlf.ts'), 'a\r\nb\r\n');
    fs.writeFileSync(path.join(root, 'mixed.ts'), 'a\nb\r\n');
    fs.writeFileSync(path.join(root, 'no-newline.ts'), 'a');
    fs.writeFileSync(path.join(root, 'binary.bin'), Buffer.from([0, 13, 10]));
    fs.writeFileSync(path.join(root, 'large.ts'), `a\n${'x'.repeat(256 * 1024)}b\r\n`);
    assert.match(dirtyInWorktree(['crlf.ts'], root)[0], /EOL: CRLF \(0 LF, 2 CRLF, 0 bare CR\)/);
    assert.match(dirtyInWorktree(['mixed.ts'], root)[0], /EOL: mixed \(1 LF, 1 CRLF, 0 bare CR\)/);
    assert.match(dirtyInWorktree(['no-newline.ts'], root)[0], /EOL: no line endings detected/);
    assert.match(dirtyInWorktree(['binary.bin'], root)[0], /EOL: unavailable \(binary-looking file\)/);
    assert.match(dirtyInWorktree(['large.ts'], root)[0], /EOL: LF \(1 LF, 0 CRLF, 0 bare CR; sampled first 262144 byte\(s\)\)/);
    assert.ok(hints.every((h) => /Git cannot identify who made the change/.test(h)), hints.join('\n'));
    assert.ok(hints.every((h) => !/sibling's in-flight work/.test(h)), hints.join('\n'));
    const granted = dirtyInWorktree(['dirty.ts'], root, { lockGranted: true });
    assert.match(granted[0], /granted this lock without a conflicting active lock/);
    assert.doesNotMatch(granted[0], /sibling's in-flight work/);
    // WF-G238: age is evidence, not an authorship claim. A days-old deferral
    // should not read as if a live sibling were editing the file right now.
    const age = Number(granted[0].match(/last written (\d+) minute\(s\) ago/)?.[1]);
    assert.ok(age >= 4000, granted[0]);
    // WF-G292: the next step must also work when a packet prohibits Git.
    assert.match(granted[0], /Read the current file before editing/i);
    assert.doesNotMatch(granted[0], /run git diff/i);
    fs.unlinkSync(path.join(root, 'dirty.ts'));
    const deleted = dirtyInWorktree(['dirty.ts'], root);
    assert.match(deleted.find((h) => /deleted before your lock/.test(h)), /Check why it was removed before recreating it/i);
    assert.deepEqual(dirtyInWorktree(['clean.ts'], root), []);
    assert.deepEqual(dirtyInWorktree([], root), []);
    // WF-G183: a path that is not there is judged by git HISTORY, not by mere
    // absence. A warning that fires on every new-file lock trains agents to
    // ignore it, and that is exactly when the real stale-path case is ignored.
    //
    // 1. A brand-new path under a directory that EXISTS is a correct lock for a
    //    file this task creates: it says nothing at all.
    assert.deepEqual(dirtyInWorktree(['brand-new.ts'], root), []);
    // WF-G279: a typo can look like a new file under an existing directory.
    // If the same filename already exists elsewhere, the lock must name the
    // real candidate instead of silently granting a false sense of ownership.
    fs.mkdirSync(path.join(root, 'src', 'hooks', 'combat'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'hooks', 'useBattleMap.ts'), 'export {};\n');
    git('add', 'src/hooks/useBattleMap.ts');
    git('commit', '-q', '-m', 'add hook');
    const misplaced = dirtyInWorktree(['src/hooks/combat/useBattleMap.ts'], root);
    assert.equal(misplaced.length, 1, misplaced.join('\n'));
    assert.match(misplaced[0], /src\/hooks\/combat\/useBattleMap\.ts.*does not exist.*src\/hooks\/useBattleMap\.ts/);
    assert.deepEqual(dirtyInWorktree(['src/hooks/combat/newModule.ts'], root), []);
    // 2. A path whose parent directory does not exist either is worth naming.
    const ghost = dirtyInWorktree(['moved/away.test.ts'], root);
    assert.equal(ghost.length, 1);
    assert.match(ghost[0], /neither does its parent directory/);
    // 3. A path a RENAME moved away is the real stale-path case, and the hint
    //    names where it went.
    git('mv', 'clean.ts', 'renamed.ts');
    git('commit', '-q', '-am', 'rename');
    const stale = dirtyInWorktree(['clean.ts'], root);
    assert.equal(stale.length, 1, stale.join(String.fromCharCode(10)));
    assert.match(stale[0], /RENAMED to renamed\.ts/);
    // WF-G144: a path into a SIBLING checkout is checked there, not here.
    const sib = path.join(path.dirname(root), path.basename(root) + '-sibling');
    fs.mkdirSync(sib, { recursive: true });
    try {
      const sgit = (...args) => execFileSync('git', args, { cwd: sib, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      sgit('init', '-q');
      sgit('config', 'user.email', 't@t');
      sgit('config', 'user.name', 't');
      const sibName = path.basename(sib);
      // A repo with NO commits gets one summary line instead of per-file hints.
      fs.writeFileSync(path.join(sib, 'first.md'), 'x\n');
      const bare = dirtyInWorktree([`${sibName}/first.md`], root);
      assert.equal(bare.length, 1, bare.join('\n'));
      assert.match(bare[0], /has no commits/);
      sgit('add', '.');
      sgit('commit', '-q', '-m', 'base');
      fs.writeFileSync(path.join(sib, 'README.md'), 'hi\n');
      const viaSibling = dirtyInWorktree([`${sibName}/README.md`, `${sibName}/missing.md`], root);
      // WF-G183: missing.md is a path that checkout has never held, under a
      // directory that exists, so it is a correct new-file lock and says nothing.
      assert.equal(viaSibling.filter((h) => /does not exist/.test(h)).length, 0, viaSibling.join('\n'));
      // The sibling checkout is still the one that gets read, not this one.
      assert.match(viaSibling.find((h) => /untracked/.test(h)), /README\.md \[.*-sibling\]/);
      // A path the SIBLING has held and then lost is still named there.
      sgit('rm', '-q', 'first.md');
      sgit('commit', '-q', '-m', 'drop first');
      const lost = dirtyInWorktree([`${sibName}/first.md`], root);
      assert.equal(lost.length, 1, lost.join('\n'));
      assert.match(lost[0], /does not exist in the worktree/);
    } finally {
      fs.rmSync(sib, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('task edit: in-place correction, append-body, and note annotations (WF-G149, WF-G153)', async () => {
  const reg = await cli(['register', 'orch.task-editor', '--role', 'orchestrator', '--session', 'sess-edit-1']);
  assert.equal(reg.code, 0, reg.lines.join('\n'));
  const created = await cli(['task', 'new', 'Initial title', '--body', 'line 1']);
  assert.equal(created.code, 0);
  const taskId = created.task.id;

  // Edit title and append body (WF-G153)
  const edited = await cli(['task', 'edit', taskId, '--title', 'Updated title', '--append-body', 'line 2', '--reason', 'clarification']);
  assert.equal(edited.code, 0);
  assert.equal(edited.task.title, 'Updated title');
  assert.equal(edited.task.body, 'line 1\nline 2');

  // Reason-only annotation by orchestrator (WF-G149)
  const annotated = await cli(['task', 'edit', taskId, '--reason', 'PARKED: waiting for human']);
  assert.equal(annotated.code, 0);
  const lastHist = annotated.task.history[annotated.task.history.length - 1];
  assert.equal(lastHist.action, 'note');
  assert.equal(lastHist.reason, 'PARKED: waiting for human');
});

test('campaign list --mine and campaign show: lead + deputies with open/done counts (WF-G154)', async () => {
  const reg = await cli(['register', 'orch.camp-tester', '--role', 'orchestrator', '--session', 'sess-camp-1']);
  assert.equal(reg.code, 0);

  // Claim a lead campaign
  const claimLead = await cli(['campaign', 'claim', 'camp-lead-1', '--role', 'lead', '--scope', 'Lead scope', '--path', 'tools/agora/path-a']);
  assert.equal(claimLead.code, 0);
  const leadId = claimLead.campaign.id;

  // Claim a deputy campaign under that lead
  const claimDep = await cli(['campaign', 'claim', 'camp-dep-1', '--role', 'deputy', '--lead', leadId, '--scope', 'Deputy scope', '--path', 'tools/agora/path-a']);
  assert.equal(claimDep.code, 0);
  const depId = claimDep.campaign.id;

  // Create tasks in lead and deputy campaigns
  const tLead1 = await cli(['task', 'new', 'Lead Task 1', '--campaign', leadId]);
  assert.equal(tLead1.code, 0);
  const tLead2 = await cli(['task', 'new', 'Lead Task 2', '--campaign', leadId]);
  assert.equal(tLead2.code, 0);
  const tDep1 = await cli(['task', 'new', 'Deputy Task 1', '--campaign', depId]);
  assert.equal(tDep1.code, 0);

  // Complete one task in lead campaign
  const doneLead1 = await cli(['task', 'done', tLead1.task.id, '--result', 'proof']);
  assert.equal(doneLead1.code, 0);

  // 1. Test campaign list --mine
  const listMine = await cli(['campaign', 'list', '--mine']);
  assert.equal(listMine.code, 0);
  const listText = listMine.lines.join('\n');
  assert.match(listText, new RegExp(leadId));
  assert.match(listText, new RegExp(depId));
  assert.match(listText, /tasks: 1 open, 1 done \(2 total\)/);
  assert.match(listText, /tasks: 1 open, 0 done \(1 total\)/);

  // 2. Test campaign show <leadId>
  const showLead = await cli(['campaign', 'show', leadId]);
  assert.equal(showLead.code, 0);
  const showText = showLead.lines.join('\n');
  assert.match(showText, /deputies \(1\):/);
  assert.match(showText, new RegExp(depId));
  assert.match(showText, /tasks by state:/);
  assert.match(showText, /1 done/);
  assert.match(showText, /1 open/);
  assert.match(showText, /attended: no/);
});

test('WF-G338: numbered pet briefs register with an available catalog identity', async () => {
  const privateServerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-numbered-pet-srv-'));
  const privateClientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-numbered-pet-id-'));
  const privateApp = createAgoraServer({ dir: privateServerDir });
  try {
    await new Promise((resolve) => privateApp.listen(0, resolve));
    const privateUrl = `http://127.0.0.1:${privateApp.server.address().port}`;
    const assigned = [];
    for (const [index, requested] of ['chef-4', 'chef-5', 'chef-6', 'chef-7'].entries()) {
      const handle = `numbered-chef-${index + 1}`;
      const result = await run(['register', handle, '--pet', requested], {
        baseUrl: privateUrl,
        env: { AGORA_DIR: privateClientDir, AGORA_AGENT_ID: handle },
      });
      assert.equal(result.code, 0, `${requested}: ${result.lines.join('\n')}`);
      assert.match(result.lines.join('\n'), new RegExp(`Requested pet "${requested}".*registered with`));
      assigned.push(result.identity.pet.slug);
    }
    assert.deepEqual(assigned.slice(0, 3), ['chef', 'chef-2', 'chef-3']);
    assert.equal(new Set(assigned).size, 4, 'concurrent workers cannot receive the same pet');

    const invalid = await run(['register', 'unknown-family-worker', '--pet', 'not-a-family-4'], {
      baseUrl: privateUrl,
      env: { AGORA_DIR: privateClientDir, AGORA_AGENT_ID: 'unknown-family-worker' },
    });
    assert.equal(invalid.code, 1, 'unrelated unknown slugs remain invalid');
    assert.match(invalid.lines.join('\n'), /unknown petSlug/i);
    const roster = await fetch(`${privateUrl}/agents`).then((response) => response.json());
    assert.equal(roster.agents.length, 4);
  } finally {
    await privateApp.close();
    fs.rmSync(privateServerDir, { recursive: true, force: true });
    fs.rmSync(privateClientDir, { recursive: true, force: true });
  }
});
