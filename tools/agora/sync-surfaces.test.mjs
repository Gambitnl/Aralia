// tools/agora/sync-surfaces.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSync } from './sync-surfaces.mjs';
import { createAgoraServer } from './server.mjs';
import { createStore } from './store.mjs';

// Build a minimal fake repo: planmap + one project docset.
const mkRepo = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'syncrepo-'));
  fs.mkdirSync(path.join(root, 'public', 'planmap'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'projects', 'combat'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public', 'planmap', 'topics.json'), JSON.stringify({
    campaigns: { combat: { title: 'Combat' } },
    topics: [{
      id: 'fip', title: 'Fight in place', campaign: 'combat', status: 'active',
      updated: '2026-07-01', docset: 'combat', tier: 'strategic',
      features: [{ title: 'Camera', status: 'active' }],
    }],
  }, null, 2));
  fs.writeFileSync(path.join(root, 'docs', 'projects', 'combat', 'NORTH_STAR.md'),
    '---\nschema_version: 1\nslug: combat\nstatus: active\nlast_updated: 2026-07-01\n---\n# Combat\n');
  fs.writeFileSync(path.join(root, 'docs', 'projects', 'combat', 'GAPS.md'),
    '---\nopen_gap_count: 7\n---\n');
  return root;
};

test('health step writes health.json with ages and gap counts', async () => {
  const root = mkRepo();
  const res = await runSync({ repoRoot: root, now: new Date('2026-07-14'), steps: ['health'], tasksProvider: async () => [] });
  assert.equal(res.ok, true);
  const health = JSON.parse(fs.readFileSync(path.join(root, 'public', 'planmap', 'health.json'), 'utf8'));
  assert.equal(health.topics.fip.ageDays, 13);
  assert.equal(health.topics.fip.openGaps, 7);
});

test('run-twice golden: byte-identical outputs', async () => {
  const root = mkRepo();
  const now = new Date('2026-07-14');
  await runSync({ repoRoot: root, now, steps: ['board', 'docs', 'health'], tasksProvider: async () => [] });
  const snap = (p) => fs.readFileSync(path.join(root, p), 'utf8');
  const first = [snap('public/planmap/topics.json'), snap('public/planmap/health.json'), snap('docs/projects/combat/NORTH_STAR.md')];
  await runSync({ repoRoot: root, now, steps: ['board', 'docs', 'health'], tasksProvider: async () => [] });
  const second = [snap('public/planmap/topics.json'), snap('public/planmap/health.json'), snap('docs/projects/combat/NORTH_STAR.md')];
  assert.deepEqual(second, first);
});

test('a transient file lock does not lose the step', async () => {
  // Something holds topics.json open for a few seconds at a time (reproduced
  // 2026-07-28: two failures, then success). Giving up on the first failure is
  // what froze health.json for three days.
  const root = mkRepo();
  const target = path.join(root, 'public', 'planmap', 'health.json');
  const realWrite = fs.writeFileSync;
  let failures = 0;
  fs.writeFileSync = (file, ...rest) => {
    if (String(file).includes('health.json') && failures < 2) {
      failures++;
      const e = new Error('UNKNOWN: unknown error, open');
      e.code = 'UNKNOWN';
      throw e;
    }
    return realWrite(file, ...rest);
  };
  try {
    const res = await runSync({
      repoRoot: root, now: new Date('2026-07-14'), steps: ['health'], tasksProvider: async () => [],
    });
    assert.equal(res.ok, true, 'the health step must survive a transient lock');
    assert.equal(failures, 2, 'the write should have been retried past both failures');
    assert.ok(fs.existsSync(target), 'health.json should exist after the retry');
  } finally {
    fs.writeFileSync = realWrite;
  }
});

test('writes leave no .tmp files behind', async () => {
  const root = mkRepo();
  await runSync({ repoRoot: root, now: new Date('2026-07-14'), steps: ['board', 'health'], tasksProvider: async () => [] });
  const leftovers = fs.readdirSync(path.join(root, 'public', 'planmap')).filter((f) => f.includes('.tmp'));
  assert.deepEqual(leftovers, []);
});

// Boot a real daemon on an ephemeral port over a temp store dir. Returns the
// pieces the caller needs plus a close().
const mkDaemon = async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncdaemon-'));
  const store = createStore({ dir });
  const app = createAgoraServer({ dir, storeFactory: () => store });
  await new Promise((resolve) => app.listen(0, resolve));
  const agoraUrl = `http://127.0.0.1:${app.server.address().port}`;
  return {
    store,
    agoraUrl,
    close: async () => {
      await app.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
};

test('tidy archives stale done tasks against a live daemon with no stored identity', async () => {
  // The proof that tidy can actually authenticate. Nothing seeds a token here:
  // the step has to claim its own identity from the daemon, which is exactly
  // the path that was dead while it relied on a stored client identity.
  const root = mkRepo();
  const daemon = await mkDaemon();
  try {
    // Tasks need a registered creator; this seed agent is the board's author,
    // not the identity tidy authenticates with.
    const author = daemon.store.registerAgent({ handle: 'board-author', petSlug: 'gf-sd' });
    const task = daemon.store.createTask({ agentId: author.id, title: 'long-finished work' });
    daemon.store.setTaskState({ taskId: task.id, state: 'done' });
    daemon.store.__setTaskUpdatedAt(task.id, Date.now() - 30 * 86400000);

    const res = await runSync({
      repoRoot: root, agoraUrl: daemon.agoraUrl, now: new Date('2026-07-14'),
      steps: ['tidy'], tasksProvider: async () => [],
    });

    assert.equal(res.ok, true);
    assert.equal(res.stepResults[0].changed, true);
    assert.match(res.stepResults[0].detail, /1 task\(s\) archived/);
    // Archived means gone from the live board, not merely flagged.
    assert.equal(daemon.store.listTasks().some((t) => t.id === task.id), false);
  } finally {
    await daemon.close();
  }
});

test('tidy leaves no identity behind in Presence', async () => {
  // A batch program that parks an identity in Presence gets reaped later and
  // logged as a crashed agent. Tidy retires the identity it claims.
  const root = mkRepo();
  const daemon = await mkDaemon();
  try {
    await runSync({
      repoRoot: root, agoraUrl: daemon.agoraUrl, now: new Date('2026-07-14'),
      steps: ['tidy'], tasksProvider: async () => [],
    });
    assert.deepEqual(daemon.store.listAgents(), []);
  } finally {
    await daemon.close();
  }
});

test('tidy names what the daemon actually said instead of guessing', async () => {
  // "daemon unreachable or refused" sent a reader hunting for a dead daemon
  // when the daemon was up and answering 401. A surface that reports freshness
  // has to be precise about its own failures.
  const root = mkRepo();
  const realFetch = globalThis.fetch;
  const run = () => runSync({ repoRoot: root, now: new Date('2026-07-14'), steps: ['tidy'], tasksProvider: async () => [] });

  try {
    // A daemon that hands out an identity and then refuses the admin call.
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.endsWith('/pets')) return Response.json({ pets: [{ slug: 'gf-sd' }] });
      if (u.endsWith('/agents/register')) return Response.json({ token: 't', agentId: 'a' }, { status: 201 });
      return new Response('nope', { status: 401 });
    };
    const refused = await run();
    assert.match(refused.stepResults[0].detail, /refused/);
    assert.match(refused.stepResults[0].detail, /401/);

    globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
    const down = await run();
    assert.match(down.stepResults[0].detail, /unreachable/);
    assert.doesNotMatch(down.stepResults[0].detail, /refused/);

    // Registration itself refused: say so, don't blame the admin endpoint.
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.endsWith('/pets')) return Response.json({ pets: [{ slug: 'gf-sd' }] });
      return Response.json({ error: 'petSlug (string) is required' }, { status: 400 });
    };
    const noIdentity = await run();
    assert.match(noIdentity.stepResults[0].detail, /identity/);
    assert.match(noIdentity.stepResults[0].detail, /400/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('invalid topics.json refuses all writes', async () => {
  const root = mkRepo();
  fs.writeFileSync(path.join(root, 'public', 'planmap', 'topics.json'), '{ not json');
  const res = await runSync({ repoRoot: root, now: new Date('2026-07-14'), steps: ['health'], tasksProvider: async () => [] });
  assert.equal(res.ok, false);
  assert.equal(fs.existsSync(path.join(root, 'public', 'planmap', 'health.json')), false);
});
