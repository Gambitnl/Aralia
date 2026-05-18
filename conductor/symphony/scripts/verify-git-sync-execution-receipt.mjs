import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the Git sync execution receipt.
//
// The execution packet is the last dashboard-owned artifact before a human
// leaves Symphony to run Git commands. It must therefore carry the disposition
// decisions, the Git evidence snapshot, and the safety checks that prove which
// facts the command list was built from. Without this receipt, a foreman can see
// commands but cannot prove whether they still match the operator decisions.

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), 'symphony-git-sync-execution-receipt-'));
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

  await writeFile(join(local, 'README.md'), '# Execution receipt\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for execution receipt']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  await execFileAsync('git', ['clone', remote, collaborator]);
  await configureUser(collaborator);
  await writeFile(join(collaborator, 'REMOTE.md'), 'remote-only work\n', 'utf8');
  await git(collaborator, ['add', 'REMOTE.md']);
  await git(collaborator, ['commit', '-m', 'remote-only update for execution receipt']);
  await git(collaborator, ['push', 'origin', 'master']);

  await writeFile(join(local, 'LOCAL.md'), 'local-only work\n', 'utf8');
  await git(local, ['add', 'LOCAL.md']);
  await git(local, ['commit', '-m', 'local-only update for execution receipt']);
  await writeFile(join(local, 'README.md'), '# Execution receipt\n\ntracked edit\n', 'utf8');
  await writeFile(join(local, 'generated-proof.txt'), 'proof artifact\n', 'utf8');

  const store = new TaskIntakeStore({
    repoRoot: local,
    storePath: join(root, 'task-drafts.json'),
  });

  await store.recordGitDisposition({
    category: 'local_commits',
    decision: 'commit_for_jules_base',
    note: 'Push the local-only base commit.',
  });
  await store.recordGitDisposition({
    category: 'tracked_changes',
    decision: 'commit_for_jules_base',
    note: 'Commit the tracked README edit first.',
  });
  await store.recordGitDisposition({
    category: 'untracked_artifacts',
    decision: 'generated_proof',
    note: 'Move the generated proof before launching Jules.',
  });
  const ready = await store.recordGitDisposition({
    category: 'remote_commits',
    decision: 'integrate_after_local_safe',
    note: 'Fast-forward only after local work is handled.',
  });

  const packet = ready.gitSyncPlan.executionPacket;
  assert.equal(packet.status, 'ready_for_human_execution');
  assert.equal(packet.canExecute, true);
  assert.equal(packet.mutatesGit, false);
  assert.equal(packet.requiresHumanConfirmation, true);

  assert.equal(packet.preflightReceipt.ok, false);
  assert.equal(packet.preflightReceipt.baseBranch, 'master');
  assert.equal(packet.preflightReceipt.remoteName, 'origin');
  assert.equal(packet.preflightReceipt.ahead, 1);
  assert.equal(packet.preflightReceipt.behind, 1);
  assert.equal(packet.preflightReceipt.dirtyFiles, 1);
  assert.equal(packet.preflightReceipt.untrackedFiles, 1);
  assert.match(packet.preflightReceipt.summary, /ahead 1, behind 1, tracked 1, untracked 1/);
  assert.ok(packet.preflightReceipt.blockers.some(blocker => blocker.includes('unpushed commit')));

  assert.equal(packet.decisionReceipt.readyForHumanSync, true);
  assert.equal(packet.decisionReceipt.decidedCount, 4);
  assert.equal(packet.decisionReceipt.totalRequired, 4);
  assert.match(packet.decisionReceipt.summary, /4 of 4 Git disposition categories/);
  assert.deepEqual(packet.decisionReceipt.categories.map(category => category.category), [
    'local_commits',
    'tracked_changes',
    'untracked_artifacts',
    'remote_commits',
  ]);
  assert.equal(packet.decisionReceipt.categories[0].decision, 'commit_for_jules_base');
  assert.match(packet.decisionReceipt.categories[0].note, /Push the local-only base commit/);
  assert.ok(packet.decisionReceipt.categories.every(category => typeof category.updatedAt === 'string'));

  assert.ok(packet.safetyChecklist.some(item => /Confirm this packet package id/i.test(item)));
  assert.ok(packet.safetyChecklist.some(item => /Run the read-only commands first/i.test(item)));
  assert.ok(packet.safetyChecklist.some(item => /Do not create Linear or Jules artifacts/i.test(item)));
  assert.ok(packet.safetyChecklist.some(item => /Re-run Check GitHub Sync/i.test(item)));

  const dashboard = await import('node:fs/promises').then(fs => fs.readFile(join(process.cwd(), 'public', 'dashboard.js'), 'utf8'));
  assert.match(dashboard, /Decision receipt/);
  assert.match(dashboard, /Preflight receipt/);
  assert.match(dashboard, /Safety checklist/);
} finally {
  await rm(root, { recursive: true, force: true });
}
