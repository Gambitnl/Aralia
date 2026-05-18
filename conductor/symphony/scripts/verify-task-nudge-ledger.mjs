import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the durable task-nudging ledger.
//
// Routing advice is useful only if Symphony can also remember that a foreman
// waited, refreshed, nudged Jules, or assigned local Codex. These checks prove
// that the ledger is persisted beside task drafts, derives cadence from the
// current routing recommendation, and remains a tracking surface rather than a
// hidden dispatcher.

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  return execFileAsync('git', ['-C', cwd, ...args], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

async function configureUser(cwd) {
  await git(cwd, ['config', 'user.name', 'Symphony Nudge Verifier']);
  await git(cwd, ['config', 'user.email', 'symphony-nudge-verifier@example.test']);
}

async function makeSyncedRepo(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const remote = join(root, 'remote.git');
  const local = join(root, 'local');

  await execFileAsync('git', ['init', '--bare', remote]);
  await execFileAsync('git', ['clone', remote, local]);
  await configureUser(local);
  await writeFile(join(local, 'README.md'), '# Nudge fixture\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for nudge fixture']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  return { root, local };
}

const roots = [];

try {
  const broad = await makeSyncedRepo('symphony-nudge-ledger-');
  roots.push(broad.root);
  const broadStorePath = join(broad.root, 'task-drafts.json');
  const broadStore = new TaskIntakeStore({
    repoRoot: broad.local,
    storePath: broadStorePath,
  });

  const broadSnapshot = await broadStore.createDraft({
    title: 'Plan multi-stage Jules handoff with tracking cadence',
    body: 'Ask Jules to make a plan first for a multi-stage implementation, then let Symphony wait before refreshing or nudging.',
    expectedFiles: [
      'src/systems/encounters/generator.ts',
      'src/data/bestiary/index.ts',
      'docs/encounters.md',
      'conductor/symphony/public/dashboard.js',
    ],
    verificationCommands: ['npm.cmd run build', 'npm.cmd run test'],
  });

  assert.equal(broadSnapshot.taskRouting.route, 'jules_plan');
  assert.equal(broadSnapshot.taskRouting.nextAction.pauseSeconds, 300);

  const recordedBroad = await broadStore.recordTaskNudge({
    subjectId: broadSnapshot.taskRouting.subjectId,
    subjectKind: 'draft',
    action: 'send_to_jules',
    phase: 'jules_plan',
    note: 'Asked Jules for a plan; pause before the next status refresh.',
  });

  assert.equal(recordedBroad.taskNudges.recent.length, 1);
  assert.equal(recordedBroad.taskNudges.recent[0].action, 'send_to_jules');
  assert.equal(recordedBroad.taskNudges.recent[0].phase, 'jules_plan');
  assert.equal(recordedBroad.taskNudges.recent[0].pauseSeconds, 300);
  assert.ok(recordedBroad.taskNudges.recent[0].nextNudgeAt, 'Jules plan nudges should record a next nudge time.');
  assert.match(recordedBroad.taskNudges.summary, /durable nudge/i);
  assert.match(recordedBroad.taskNudges.summary, /next nudge/i);

  const persisted = JSON.parse(await readFile(broadStorePath, 'utf8'));
  assert.equal(persisted.taskNudges.length, 1);
  assert.equal(persisted.taskNudges[0].mutatesExternalSystems, false);

  const blocked = await makeSyncedRepo('symphony-blocked-nudge-');
  roots.push(blocked.root);
  await writeFile(join(blocked.local, 'README.md'), '# Nudge fixture\n\nlocal edit\n', 'utf8');

  const blockedStore = new TaskIntakeStore({
    repoRoot: blocked.local,
    storePath: join(blocked.root, 'task-drafts.json'),
  });
  const blockedSnapshot = await blockedStore.createDraft({
    title: 'Small task blocked before worker routing',
    body: 'Small local edit, but Git sync is blocked so Symphony should record a wait rather than dispatch.',
    expectedFiles: ['README.md'],
    verificationCommands: ['npm.cmd run build'],
  });

  const recordedBlocked = await blockedStore.recordTaskNudge({
    subjectId: blockedSnapshot.taskRouting.subjectId,
    subjectKind: 'draft',
    action: 'wait',
    phase: 'git_sync',
    note: 'Wait for operator Git disposition before assigning any worker.',
  });

  assert.equal(recordedBlocked.taskNudges.recent[0].action, 'wait');
  assert.equal(recordedBlocked.taskNudges.recent[0].pauseSeconds, 0);
  assert.equal(recordedBlocked.taskNudges.recent[0].nextNudgeAt, null);
  assert.equal(recordedBlocked.taskNudges.recent[0].mutatesExternalSystems, false);

  await assert.rejects(
    () => blockedStore.recordTaskNudge({
      subjectId: '',
      subjectKind: 'draft',
      action: 'wait',
      phase: 'git_sync',
      note: 'Missing subject should not produce ambiguous evidence.',
    }),
    /subject/i,
  );

  const dashboardJs = await readFile(join(process.cwd(), 'public', 'dashboard.js'), 'utf8');
  const dashboardCss = await readFile(join(process.cwd(), 'public', 'dashboard.css'), 'utf8');

  assert.match(dashboardJs, /record-task-nudge/);
  assert.match(dashboardJs, /Task nudge ledger/);
  assert.match(dashboardCss, /\.task-nudge-ledger/);
} finally {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
}
