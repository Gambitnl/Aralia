import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the pause-aware nudge scheduler.
//
// The ledger proves that Symphony remembered a nudge. The scheduler goes one
// step further: it tells a foreman whether that record is due now, still
// waiting, or blocked on human input. That is the contract that prevents both
// tight polling loops and forgotten Jules/GitHub boundaries.

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  return execFileAsync('git', ['-C', cwd, ...args], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

async function configureUser(cwd) {
  await git(cwd, ['config', 'user.name', 'Symphony Scheduler Verifier']);
  await git(cwd, ['config', 'user.email', 'symphony-scheduler-verifier@example.test']);
}

async function makeSyncedRepo(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const remote = join(root, 'remote.git');
  const local = join(root, 'local');

  await execFileAsync('git', ['init', '--bare', remote]);
  await execFileAsync('git', ['clone', remote, local]);
  await configureUser(local);
  await writeFile(join(local, 'README.md'), '# Scheduler fixture\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for scheduler fixture']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  return { root, local };
}

const roots = [];

try {
  const fixture = await makeSyncedRepo('symphony-nudge-scheduler-');
  roots.push(fixture.root);

  const storePath = join(fixture.root, 'task-drafts.json');
  const store = new TaskIntakeStore({
    repoRoot: fixture.local,
    storePath,
  });
  const draftSnapshot = await store.createDraft({
    title: 'Plan multi-stage Jules scheduler proof',
    body: 'Ask Jules to plan first so the scheduler has a future nudge to wait on before refreshing.',
    expectedFiles: [
      'src/systems/encounters/generator.ts',
      'src/data/bestiary/index.ts',
      'docs/encounters.md',
      'conductor/symphony/public/dashboard.js',
    ],
    verificationCommands: ['npm.cmd run build', 'npm.cmd run test'],
  });

  const futureSnapshot = await store.recordTaskNudge({
    subjectId: draftSnapshot.taskRouting.subjectId,
    subjectKind: 'draft',
    action: 'send_to_jules',
    phase: 'jules_plan',
    note: 'Wait for Jules plan before refreshing.',
  });

  assert.equal(futureSnapshot.taskNudges.scheduler.status, 'waiting');
  assert.equal(futureSnapshot.taskNudges.scheduler.dueCount, 0);
  assert.equal(futureSnapshot.taskNudges.scheduler.waitingCount, 1);
  assert.match(futureSnapshot.taskNudges.scheduler.summary, /pause/i);
  assert.ok(futureSnapshot.taskNudges.scheduler.nextDueAt, 'Future scheduler should expose nextDueAt.');
  assert.equal(futureSnapshot.taskNudges.scheduler.mutatesExternalSystems, false);

  const persisted = JSON.parse(await readFile(storePath, 'utf8'));
  persisted.taskNudges[0].createdAt = '2026-05-17T00:00:00.000Z';
  persisted.taskNudges[0].nextNudgeAt = '2026-05-17T00:00:01.000Z';
  await writeFile(storePath, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');

  const dueSnapshot = await store.snapshot();
  assert.equal(dueSnapshot.taskNudges.scheduler.status, 'due');
  assert.equal(dueSnapshot.taskNudges.scheduler.dueCount, 1);
  assert.equal(dueSnapshot.taskNudges.scheduler.waitingCount, 0);
  assert.equal(dueSnapshot.taskNudges.scheduler.due[0].action, 'send_to_jules');
  assert.match(dueSnapshot.taskNudges.scheduler.due[0].recommendedEndpoint, /task-drafts\/.+\/promote/);
  assert.equal(dueSnapshot.taskNudges.scheduler.due[0].mutatesExternalSystems, false);
  assert.equal(dueSnapshot.taskNudges.scheduler.due[0].actionPacket.method, 'POST');
  assert.match(dueSnapshot.taskNudges.scheduler.due[0].actionPacket.endpoint, /task-drafts\/.+\/promote/);
  assert.equal(dueSnapshot.taskNudges.scheduler.due[0].actionPacket.safety, 'local_state_only');
  assert.equal(dueSnapshot.taskNudges.scheduler.due[0].actionPacket.canRunNow, true);
  assert.equal(dueSnapshot.taskNudges.scheduler.due[0].actionPacket.mutatesExternalSystems, false);
  assert.match(dueSnapshot.taskNudges.scheduler.due[0].actionPacket.label, /Prepare Jules handoff/i);
  assert.match(dueSnapshot.taskNudges.scheduler.summary, /due/i);

  const blocked = await makeSyncedRepo('symphony-nudge-scheduler-blocked-');
  roots.push(blocked.root);
  await writeFile(join(blocked.local, 'README.md'), '# Scheduler fixture\n\nlocal edit\n', 'utf8');

  const blockedStore = new TaskIntakeStore({
    repoRoot: blocked.local,
    storePath: join(blocked.root, 'task-drafts.json'),
  });
  const blockedDraft = await blockedStore.createDraft({
    title: 'Blocked scheduler wait proof',
    body: 'Git sync is blocked, so the scheduler should show operator-blocked wait evidence instead of a timed due action.',
    expectedFiles: ['README.md'],
    verificationCommands: ['npm.cmd run build'],
  });
  const blockedSnapshot = await blockedStore.recordTaskNudge({
    subjectId: blockedDraft.taskRouting.subjectId,
    subjectKind: 'draft',
    action: 'wait',
    phase: 'git_sync',
    note: 'Wait for Git disposition.',
  });

  assert.equal(blockedSnapshot.taskNudges.scheduler.status, 'blocked');
  assert.equal(blockedSnapshot.taskNudges.scheduler.blockedCount, 1);
  assert.equal(blockedSnapshot.taskNudges.scheduler.dueCount, 0);
  assert.equal(blockedSnapshot.taskNudges.scheduler.blocked[0].actionPacket.method, 'NONE');
  assert.equal(blockedSnapshot.taskNudges.scheduler.blocked[0].actionPacket.canRunNow, false);
  assert.equal(blockedSnapshot.taskNudges.scheduler.blocked[0].actionPacket.requiresOperator, true);
  assert.equal(blockedSnapshot.taskNudges.scheduler.blocked[0].actionPacket.safety, 'operator_only');
  assert.match(blockedSnapshot.taskNudges.scheduler.blocked[0].actionPacket.blockedReason, /operator/i);
  assert.match(blockedSnapshot.taskNudges.scheduler.summary, /operator/i);

  const dashboardJs = await readFile(join(process.cwd(), 'public', 'dashboard.js'), 'utf8');
  const dashboardCss = await readFile(join(process.cwd(), 'public', 'dashboard.css'), 'utf8');

  assert.match(dashboardJs, /Nudge scheduler/);
  assert.match(dashboardJs, /renderTaskNudgeScheduler/);
  assert.match(dashboardJs, /Action packet/);
  assert.match(dashboardCss, /\.task-nudge-scheduler/);
} finally {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
}
