import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the guarded Git sync plan.
//
// The plan is the bridge between "we know what is blocking Jules" and "a human
// can intentionally repair GitHub sync." It must remain read-only, must stay
// blocked until every disposition category is resolved, and must turn resolved
// dispositions into an ordered human execution plan instead of silently running
// Git mutations.

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), 'symphony-git-sync-plan-'));
const remote = join(root, 'remote.git');
const local = join(root, 'local');
const collaborator = join(root, 'collaborator');

async function git(cwd, args) {
  return execFileAsync('git', ['-C', cwd, ...args], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

async function configureUser(cwd) {
  await git(cwd, ['config', 'user.name', 'Symphony Verifier']);
  await git(cwd, ['config', 'user.email', 'symphony-verifier@example.test']);
}

try {
  await execFileAsync('git', ['init', '--bare', remote]);
  await execFileAsync('git', ['clone', remote, local]);
  await configureUser(local);

  await writeFile(join(local, 'README.md'), '# Sync plan\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for sync plan']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  await execFileAsync('git', ['clone', remote, collaborator]);
  await configureUser(collaborator);
  await writeFile(join(collaborator, 'REMOTE.md'), 'remote-only work\n', 'utf8');
  await git(collaborator, ['add', 'REMOTE.md']);
  await git(collaborator, ['commit', '-m', 'remote-only update for sync plan']);
  await git(collaborator, ['push', 'origin', 'master']);

  await writeFile(join(local, 'LOCAL.md'), 'local-only work\n', 'utf8');
  await git(local, ['add', 'LOCAL.md']);
  await git(local, ['commit', '-m', 'local-only update for sync plan']);
  await writeFile(join(local, 'README.md'), '# Sync plan\n\ntracked edit\n', 'utf8');
  await writeFile(join(local, 'generated-proof.txt'), 'proof artifact\n', 'utf8');

  const store = new TaskIntakeStore({
    repoRoot: local,
    storePath: join(root, 'task-drafts.json'),
  });

  const blocked = await store.snapshot();
  assert.equal(blocked.preflight.ok, false);
  assert.equal(blocked.gitSyncPlan.mutatesGit, false);
  assert.equal(blocked.gitSyncPlan.status, 'blocked_by_disposition');
  assert.equal(blocked.gitSyncPlan.canExecute, false);
  assert.match(blocked.gitSyncPlan.summary, /4 Git disposition categories still need decisions/);
  assert.equal(blocked.gitSyncPlan.executionPacket.mutatesGit, false);
  assert.equal(blocked.gitSyncPlan.executionPacket.canExecute, false);
  assert.equal(blocked.gitSyncPlan.executionPacket.requiresHumanConfirmation, true);
  assert.match(blocked.gitSyncPlan.executionPacket.summary, /not executable/i);
  assert.equal(blocked.gitSyncPlan.executionPacket.mutatingCommands.length, 0);
  assert.ok(blocked.gitSyncPlan.executionPacket.readOnlyCommands.some(command => command.includes('status')));
  assert.deepEqual(blocked.gitSyncPlan.executionPacket.requiredDispositions, [
    'local_commits',
    'tracked_changes',
    'untracked_artifacts',
    'remote_commits',
  ]);
  assert.match(blocked.gitSyncPlan.executionPacket.expectedNextProof, /Record Git dispositions/i);
  assert.deepEqual(blocked.gitSyncPlan.requiredDispositions, [
    'local_commits',
    'tracked_changes',
    'untracked_artifacts',
    'remote_commits',
  ]);
  assert.match(blocked.gitSyncPlan.steps[0].label, /Record Git dispositions/);

  await store.recordGitDisposition({
    category: 'local_commits',
    decision: 'commit_for_jules_base',
    note: 'Push the local-only base commit after tracked work is resolved.',
  });
  await store.recordGitDisposition({
    category: 'tracked_changes',
    decision: 'commit_for_jules_base',
    note: 'Commit the tracked README edit into the Jules base.',
  });
  await store.recordGitDisposition({
    category: 'untracked_artifacts',
    decision: 'generated_proof',
    note: 'Generated proof should not block the Jules base after it is moved or ignored.',
  });
  const needsReview = await store.recordGitDisposition({
    category: 'remote_commits',
    decision: 'needs_review',
    note: 'Remote commits need inspection before fast-forward.',
  });

  assert.equal(needsReview.gitSyncPlan.status, 'blocked_by_review');
  assert.equal(needsReview.gitSyncPlan.canExecute, false);
  assert.match(needsReview.gitSyncPlan.summary, /needs review/);

  const ready = await store.recordGitDisposition({
    category: 'remote_commits',
    decision: 'integrate_after_local_safe',
    note: 'Fast-forward after local work is intentionally handled.',
  });

  assert.equal(ready.gitSyncPlan.status, 'ready_for_human_execution');
  assert.equal(ready.gitSyncPlan.canExecute, true);
  assert.equal(ready.gitSyncPlan.mutatesGit, false);
  assert.match(ready.gitSyncPlan.summary, /Human execution plan is ready/);
  assert.equal(ready.gitSyncPlan.executionPacket.canExecute, true);
  assert.equal(ready.gitSyncPlan.executionPacket.mutatesGit, false);
  assert.equal(ready.gitSyncPlan.executionPacket.requiresHumanConfirmation, true);
  assert.ok(ready.gitSyncPlan.executionPacket.packageId.startsWith('git-sync-'));
  assert.ok(ready.gitSyncPlan.executionPacket.readOnlyCommands.some(command => command.includes('status')));
  assert.ok(ready.gitSyncPlan.executionPacket.mutatingCommands.some(command => command.includes('push')));
  assert.ok(ready.gitSyncPlan.executionPacket.mutatingCommands.some(command => command.includes('pull --ff-only')));
  assert.ok(ready.gitSyncPlan.executionPacket.verificationCommands.some(command => command.includes('status --short')));
  assert.match(ready.gitSyncPlan.executionPacket.expectedNextProof, /Check GitHub Sync/i);
  assert.ok(ready.gitSyncPlan.steps.some(step => step.command?.includes('git -C')));
  assert.ok(ready.gitSyncPlan.steps.some(step => step.label.includes('Push intended local commits')));
  assert.ok(ready.gitSyncPlan.steps.some(step => step.label.includes('Fast-forward after local work is safe')));
  assert.ok(ready.gitSyncPlan.steps.at(-1).label.includes('Re-run Check GitHub Sync'));

  const dashboard = await import('node:fs/promises').then(fs => fs.readFile(join(process.cwd(), 'public', 'dashboard.js'), 'utf8'));
  assert.match(dashboard, /renderGitSyncExecutionPacket/);
  assert.match(dashboard, /Execution packet/);
} finally {
  await rm(root, { recursive: true, force: true });
}
