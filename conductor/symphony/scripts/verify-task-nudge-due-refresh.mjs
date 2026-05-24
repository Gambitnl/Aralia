import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the "foreman tick" for paused task nudges.
//
// The scheduler can say a nudge is due, but Symphony also needs a safe way to
// act on that fact without becoming an auto-launcher. Due external-read nudges
// may refresh Jules/GitHub/local-sync state; due local-state actions such as
// preparing a Jules handoff must stay skipped until the operator or foreman
// deliberately chooses them.

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  return execFileAsync('git', ['-C', cwd, ...args], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

async function configureUser(cwd) {
  await git(cwd, ['config', 'user.name', 'Symphony Due Nudge Verifier']);
  await git(cwd, ['config', 'user.email', 'symphony-due-nudge-verifier@example.test']);
}

async function makeSyncedRepo(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const remote = join(root, 'remote.git');
  const local = join(root, 'local');

  await execFileAsync('git', ['init', '--bare', remote]);
  await execFileAsync('git', ['clone', remote, local]);
  await configureUser(local);
  await writeFile(join(local, 'README.md'), '# Due nudge fixture\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for due nudge fixture']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  return { root, local };
}

const roots = [];

try {
  const fixture = await makeSyncedRepo('symphony-due-nudge-');
  roots.push(fixture.root);

  const storePath = join(fixture.root, 'task-drafts.json');
  const store = new TaskIntakeStore({
    repoRoot: fixture.local,
    storePath,
  });

  const draftSnapshot = await store.createDraft({
    title: 'Refresh merged Jules local sync readiness',
    body: 'Pretend a Jules PR has merged so the due nudge runner can prove it refreshes the read-only local sync boundary.',
    expectedFiles: ['README.md'],
    verificationCommands: ['npm.cmd run build'],
  });
  const promoted = await store.promoteDraft(draftSnapshot.drafts[0].id);
  const handoff = promoted.handoffs[0];

  const secondDraft = await store.createDraft({
    title: 'Do not auto-promote local state',
    body: 'This due nudge is intentionally local-state-only and must not be executed by the due refresh runner.',
    expectedFiles: ['docs/example.md'],
    verificationCommands: ['npm.cmd run build'],
  });

  const stored = JSON.parse(await readFile(storePath, 'utf8'));
  stored.handoffs[0].githubPullRequestUrl = 'https://github.com/example/aralia/pull/123';
  stored.handoffs[0].githubPullRequestState = 'MERGED';
  await writeFile(storePath, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');

  await store.recordTaskNudge({
    subjectId: handoff.id,
    subjectKind: 'handoff',
    action: 'refresh',
    phase: 'local_sync',
    note: 'Due refresh should check local sync readiness after PR merge.',
    pauseSeconds: 1,
  });
  await store.recordTaskNudge({
    subjectId: secondDraft.drafts[0].id,
    subjectKind: 'draft',
    action: 'send_to_jules',
    phase: 'jules_plan',
    note: 'Due refresh must not promote this draft automatically.',
    pauseSeconds: 1,
  });

  const dueStore = JSON.parse(await readFile(storePath, 'utf8'));
  for (const record of dueStore.taskNudges) {
    record.createdAt = '2026-05-17T00:00:00.000Z';
    record.nextNudgeAt = '2026-05-17T00:00:01.000Z';
  }
  await writeFile(storePath, `${JSON.stringify(dueStore, null, 2)}\n`, 'utf8');

  const refreshed = await store.refreshDueTaskNudges();

  assert.equal(refreshed.taskNudgeRefresh.mutatesExternalSystems, false);
  assert.equal(refreshed.taskNudgeRefresh.dueCount, 2);
  assert.equal(refreshed.taskNudgeRefresh.localSyncRefreshes, 1);
  assert.equal(refreshed.taskNudgeRefresh.skipped, 1);
  const refreshedResult = refreshed.taskNudgeRefresh.results.find(result => result.status === 'refreshed');
  const skippedResult = refreshed.taskNudgeRefresh.results.find(result => result.status === 'skipped');
  assert.ok(refreshedResult, 'One due nudge should refresh an external-read boundary.');
  assert.ok(skippedResult, 'One due nudge should be skipped because it needs a deliberate operator action.');
  assert.match(refreshedResult.summary, /local sync/i);
  assert.match(skippedResult.summary, /operator/i);

  const afterStore = JSON.parse(await readFile(storePath, 'utf8'));
  assert.equal(afterStore.handoffs.length, 1, 'The due runner must not promote draft nudges into extra handoffs.');

  const afterSnapshot = await store.snapshot();
  assert.ok(afterSnapshot.handoffs[0].localSyncStatus, 'Due local-sync refresh should update the handoff readiness snapshot.');
  const rescheduledLocalSyncNudge = afterSnapshot.taskNudges.scheduler.waiting.find(
    item => item.subjectId === handoff.id && item.phase === 'local_sync'
  );
  assert.ok(rescheduledLocalSyncNudge, 'Refreshed external-read nudges should move back to the waiting queue.');
  assert.equal(rescheduledLocalSyncNudge.pauseSeconds, 300);
  assert.ok(
    new Date(rescheduledLocalSyncNudge.nextNudgeAt).getTime() > new Date(refreshed.taskNudgeRefresh.checkedAt).getTime(),
    'Refreshed external-read nudges should not be immediately due again.'
  );

  const server = await readFile(join(process.cwd(), 'src', 'server.ts'), 'utf8');
  const dashboard = await readFile(join(process.cwd(), 'public', 'dashboard.js'), 'utf8');
  const packageJson = await readFile(join(process.cwd(), 'package.json'), 'utf8');

  assert.match(server, /task-nudges\/refresh-due/);
  assert.match(dashboard, /runDueTaskNudges/);
  assert.match(dashboard, /Due nudge refresh/);
  const runVerifiers = await readFile(join(process.cwd(), 'scripts', 'run-all-verifiers.mjs'), 'utf8');
  assert.ok(
    packageJson.includes('verify-task-nudge-due-refresh.mjs') ||
    (packageJson.includes('run-all-verifiers.mjs') && runVerifiers.includes('verify-task-nudge-due-refresh.mjs')),
    'verify-task-nudge-due-refresh.mjs must be registered in either package.json or run-all-verifiers.mjs'
  );
} finally {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
}
