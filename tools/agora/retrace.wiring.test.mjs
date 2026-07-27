// tools/agora/retrace.wiring.test.mjs
//
// This file proves the CLIENT + SERVER half of agent-retrace works end to end.
//
// The store already knew how to remember a dead worker's trail (see
// store.retrace.test.mjs). What was missing until now was the plumbing a real
// agent actually touches: a way to LEAVE a checkpoint over HTTP, a way to READ
// the recovered trail from the command line, and a nudge that fires the moment
// you claim a task a previous worker died on. This file exercises exactly those
// three things through the real HTTP daemon and the real CLI:
//
//   1. POST /tasks/:id/checkpoint            — the server endpoint
//   2. `task checkpoint` / `retrace <id>`    — the two new CLI commands
//   3. the "⚠ reaped from ..." successor flag — printed on claim
//
// It boots the genuine server (createAgoraServer) on an ephemeral port with a
// store wired to a fake clock and a short reap horizon, so we can make an agent
// "die" on demand and watch the dossier appear. Node built-in runner only:
//   node --test "tools/agora/*.test.mjs"

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { createAgoraServer } from './server.mjs';
import { createStore } from './store.mjs';
import { run } from './client.mjs';

// ---------------------------------------------------------------------------
// Test harness: a real server with a controllable clock
// ---------------------------------------------------------------------------
// We want to make an agent get reaped without waiting real minutes, so the
// store runs on a fake clock we can fast-forward, with a 5-second reap horizon.
let app;
let baseUrl;
let serverDir;
let clientDir;
let clock;

function makeClock(start = 5_000_000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
}

before(async () => {
  serverDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-retrace-srv-'));
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-retrace-cli-'));
  clock = makeClock();
  // Inject a store with our fake clock and short horizons so reaps are cheap.
  app = createAgoraServer({
    dir: serverDir,
    storeFactory: ({ dir }) => createStore({ dir, now: clock, presenceTtlMs: 1000, presenceDropMs: 5000 }),
  });
  await new Promise((resolve) => app.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  if (app) await app.close();
  for (const d of [serverDir, clientDir]) {
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

// Tiny JSON HTTP helper for the raw-endpoint assertions.
function request(method, pathname, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const u = new URL(baseUrl);
    const req = http.request({ host: u.hostname, port: u.port, method, path: pathname, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Run a CLI command with a per-agent identity file (so two agents in one
// checkout do not share a token — the same scoping the real fleet uses).
function cli(argv, agentId, extra = {}) {
  return run(argv, {
    env: { AGORA_DIR: clientDir, AGORA_AGENT_ID: agentId, AGORA_PET: 'gf-sd' },
    baseUrl,
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// 1. The server endpoint: POST /tasks/:id/checkpoint
// ---------------------------------------------------------------------------
test('POST /tasks/:id/checkpoint stores a latest-wins note; 404 for missing task; 401 unauthed', async () => {
  const reg = await request('POST', '/agents/register', {
    body: { handle: 'cp-endpoint', petSlug: 'gf-sd' },
  });
  assert.equal(reg.status, 201);
  const token = reg.json.token;
  const create = await request('POST', '/tasks', { token, body: { title: 'endpoint task' } });
  const id = create.json.task.id;
  await request('POST', `/tasks/${id}/claim`, { token });

  // First note lands.
  const first = await request('POST', `/tasks/${id}/checkpoint`, {
    token,
    body: { did: 'step one', next: 'step two', files: ['a.ts'] },
  });
  assert.equal(first.status, 200);
  assert.equal(first.json.checkpoint.did, 'step one');
  assert.deepEqual(first.json.checkpoint.files, ['a.ts']);

  // Second note overwrites the first (latest-wins).
  const second = await request('POST', `/tasks/${id}/checkpoint`, {
    token,
    body: { did: 'step two', next: 'step three' },
  });
  assert.equal(second.status, 200);
  assert.equal(second.json.checkpoint.did, 'step two');

  // The board reflects the latest note.
  const list = await request('GET', '/tasks');
  const task = list.json.tasks.find((t) => t.id === id);
  assert.equal(task.checkpoint.did, 'step two');
  assert.equal(task.checkpoint.next, 'step three');

  // A note on a nonexistent task is a 404, not a silent success.
  const missing = await request('POST', '/tasks/does-not-exist/checkpoint', {
    token,
    body: { did: 'x' },
  });
  assert.equal(missing.status, 404);

  // No token is a hard 401 — checkpointing is a mutation.
  const unauth = await request('POST', `/tasks/${id}/checkpoint`, { body: { did: 'x' } });
  assert.equal(unauth.status, 401);
});

test('POST checkpoint rejects cross-agent, unclaimed, blocked, and done writes', async () => {
  const owner = await request('POST', '/agents/register', {
    body: { handle: 'cp-owner', petSlug: 'gf-sd' },
  });
  const intruder = await request('POST', '/agents/register', {
    body: { handle: 'cp-intruder', petSlug: 'dream-girl' },
  });
  const created = await request('POST', '/tasks', {
    token: owner.json.token,
    body: { title: 'authorization target' },
  });
  const id = created.json.task.id;

  // An open task has no current claimant, so creator identity alone cannot
  // manufacture a live-work checkpoint.
  const unclaimed = await request('POST', `/tasks/${id}/checkpoint`, {
    token: owner.json.token,
    body: { did: 'too early' },
  });
  assert.equal(unclaimed.status, 409);

  await request('POST', `/tasks/${id}/claim`, { token: owner.json.token });

  // A second authenticated agent is still forbidden from overwriting the
  // claimant's recovery trail.
  const crossAgent = await request('POST', `/tasks/${id}/checkpoint`, {
    token: intruder.json.token,
    body: { did: 'hostile overwrite' },
  });
  assert.equal(crossAgent.status, 403);

  const accepted = await request('POST', `/tasks/${id}/checkpoint`, {
    token: owner.json.token,
    body: { did: 'owned checkpoint' },
  });
  assert.equal(accepted.status, 200);

  // Once work is blocked or complete, even the claimant cannot mutate the
  // checkpoint until the task returns to an active state.
  await request('POST', `/tasks/${id}/state`, {
    token: owner.json.token,
    body: { state: 'blocked' },
  });
  const blocked = await request('POST', `/tasks/${id}/checkpoint`, {
    token: owner.json.token,
    body: { did: 'blocked overwrite' },
  });
  assert.equal(blocked.status, 409);
  await request('POST', `/tasks/${id}/state`, {
    token: owner.json.token,
    body: { state: 'done' },
  });
  const done = await request('POST', `/tasks/${id}/checkpoint`, {
    token: owner.json.token,
    body: { did: 'done overwrite' },
  });
  assert.equal(done.status, 409);

  const board = await request('GET', '/tasks');
  assert.equal(board.json.tasks.find((task) => task.id === id).checkpoint.did, 'owned checkpoint');
});

// ---------------------------------------------------------------------------
// 2. The CLI: `task checkpoint`
// ---------------------------------------------------------------------------
test('CLI `task checkpoint` posts the note and echoes it back', async () => {
  await cli(['register', 'cp-cli'], 'cp-cli');
  const created = await cli(['task', 'new', 'cli checkpoint task', '--id-only'], 'cp-cli');
  const id = created.task.id;
  await cli(['task', 'claim', id], 'cp-cli');

  const res = await cli(['task', 'checkpoint', id, '--did', 'wired the endpoint', '--next', 'write tests', '--files', 'x.ts,y.ts'], 'cp-cli');
  assert.equal(res.code, 0);
  assert.equal(res.checkpoint.did, 'wired the endpoint');
  assert.deepEqual(res.checkpoint.files, ['x.ts', 'y.ts']);
  const text = res.lines.join('\n');
  assert.match(text, /checkpoint saved/);
  assert.match(text, /wired the endpoint/);
  assert.match(text, /write tests/);
  assert.match(text, /x\.ts, y\.ts/);
});

// ---------------------------------------------------------------------------
// 3. Reap -> successor flag on claim -> `retrace <id>` renders the trail
// ---------------------------------------------------------------------------
test('claiming a reaped task shows the successor flag and retrace prints the dossier + Git evidence', async () => {
  // The doomed worker: registers, locks a file, claims a task, checkpoints,
  // and leaves a breadcrumb — then goes silent.
  await cli(['register', 'doomed', '--model', 'claude-fable-5'], 'doomed');
  // Lock a path with NO working-tree changes so every retrace Git surface is
  // deterministic (empty) regardless of how dirty this checkout is.
  const probePath = 'src/__retrace_probe_nonexistent__.ts';
  await cli(['lock', probePath, '--reason', 'editing the probe'], 'doomed');
  const created = await cli(['task', 'new', 'doomed work', '--id-only'], 'doomed');
  const id = created.task.id;
  await cli(['task', 'claim', id], 'doomed');
  await cli(['task', 'checkpoint', id, '--did', 'started the probe', '--next', 'finish the probe'], 'doomed');
  await cli(['say', 'PROGRESS: halfway through the probe'], 'doomed');

  // Time passes past 2x the reap horizon (the worker held a claimed task, which
  // buys it double grace), then the daemon sweeps it up.
  clock.advance(20000);
  app.store.sweepExpired();

  // The successor claims the now-reopened task. The CLI must flag it.
  await cli(['register', 'successor'], 'successor');
  const claim = await cli(['task', 'claim', id], 'successor');
  assert.equal(claim.code, 0);
  assert.ok(claim.task.retrace, 'reopened task carries a retrace dossier');
  const claimText = claim.lines.join('\n');
  assert.match(claimText, /reaped from doomed/);
  assert.match(claimText, /retrace/);

  // `retrace <id>` prints the full dossier and each scoped Git surface.
  const rt = await cli(['retrace', id], 'successor');
  assert.equal(rt.code, 0);
  const out = rt.lines.join('\n');
  assert.match(out, /reaped:\s+doomed \(claude-fable-5\)/);
  assert.match(out, /filesHeld:.*__retrace_probe_nonexistent__\.ts/);
  assert.match(out, /did:\s+started the probe/);
  assert.match(out, /next:\s+finish the probe/);
  assert.match(out, /PROGRESS: halfway through the probe/);
  // All Git views ran, scoped to the held file; the probe path has no changes.
  assert.match(out, /git diff -- .*__retrace_probe_nonexistent__\.ts/);
  assert.match(out, /no unstaged changes/);
  assert.match(out, /no staged changes/);
  assert.match(out, /no untracked\/new files/);
});

test('retrace explicitly surfaces staged changes and untracked new files in an isolated Git repository', async () => {
  const gitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-retrace-git-'));
  try {
    // Build a tiny repository outside the shared checkout so this integration
    // proof can exercise the index without staging or removing anyone's work.
    execFileSync('git', ['init', '--quiet'], { cwd: gitDir });
    execFileSync('git', ['config', 'user.email', 'agora-test@example.invalid'], { cwd: gitDir });
    execFileSync('git', ['config', 'user.name', 'Agora Test'], { cwd: gitDir });
    execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: gitDir });
    fs.writeFileSync(path.join(gitDir, 'tracked.txt'), 'base\n');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: gitDir });
    execFileSync('git', ['commit', '--quiet', '-m', 'base'], { cwd: gitDir });

    // One recovery file exists only in the index, while the other is brand-new
    // and untracked. A plain `git diff` would incorrectly report a clean scope.
    fs.writeFileSync(path.join(gitDir, 'tracked.txt'), 'base\nstaged repair\n');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: gitDir });
    fs.writeFileSync(path.join(gitDir, 'untracked.txt'), 'new recovery file\n');

    const registration = await cli(['register', 'staged-doomed'], 'staged-doomed');
    assert.equal(registration.code, 0, registration.lines.join('\n'));
    const created = await cli(['task', 'new', 'staged recovery', '--id-only'], 'staged-doomed');
    assert.equal(created.code, 0, created.lines.join('\n'));
    assert.ok(created.task, created.lines.join('\n'));
    const id = created.task.id;
    await cli(['task', 'claim', id], 'staged-doomed');
    await cli([
      'task',
      'checkpoint',
      id,
      '--did',
      'staged one file and created another',
      '--next',
      'resume both',
      '--files',
      'tracked.txt,untracked.txt',
    ], 'staged-doomed');

    clock.advance(20000);
    app.store.sweepExpired();

    const retrace = await cli(['retrace', id], 'staged-reader', { repoRoot: gitDir });
    const output = retrace.lines.join('\n');
    assert.equal(retrace.code, 0);
    assert.match(output, /staged git diff/);
    assert.match(output, /\+staged repair/);
    assert.match(output, /untracked\/new files/);
    assert.match(output, /untracked\.txt/);
  } finally {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }
});

test('retrace on a task that was never reaped says so instead of printing an empty report', async () => {
  await cli(['register', 'calm'], 'calm');
  const created = await cli(['task', 'new', 'calm task', '--id-only'], 'calm');
  const id = created.task.id;
  const rt = await cli(['retrace', id], 'calm');
  assert.equal(rt.code, 0);
  assert.match(rt.lines.join('\n'), /no retrace dossier/);
});
