import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier covers Git blocker shapes that cannot be proven from the live
// Aralia checkout without mutating the user's branch. Temporary repositories
// let the contract exercise wrong-branch, missing-remote, non-repo, and diverged
// states while preserving the real workspace exactly as it is.

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  await execFileAsync('git', args, { cwd });
}

async function writeAndCommit(repo, fileName, contents, message) {
  await writeFile(join(repo, fileName), contents, 'utf8');
  await git(repo, ['add', fileName]);
  await git(repo, ['commit', '-m', message]);
}

async function prepareSyncedRepo(root) {
  const repo = join(root, 'repo');
  const remote = join(root, 'remote.git');

  await git(root, ['init', '--bare', remote]);
  await git(root, ['clone', remote, repo]);
  await git(repo, ['checkout', '-b', 'master']);
  await git(repo, ['config', 'user.email', 'symphony@example.invalid']);
  await git(repo, ['config', 'user.name', 'Symphony Contract Test']);
  await writeAndCommit(repo, 'README.md', '# temporary repo\n', 'Initial synced base');
  await git(repo, ['push', '-u', 'origin', 'master']);

  return { repo, remote };
}

const root = await mkdtemp(join(tmpdir(), 'symphony-git-preflight-'));

try {
  const nonRepo = join(root, 'not-a-repo');
  await writeFile(join(root, 'placeholder.txt'), 'root marker\n', 'utf8');
  await execFileAsync('node', ['-e', "require('fs').mkdirSync(process.argv[1])", nonRepo]);

  const nonRepoPreflight = await new TaskIntakeStore({
    repoRoot: nonRepo,
    storePath: join(root, 'stores', 'non-repo.json'),
  }).runGitSyncPreflight();

  // A missing Git checkout is not a branch-selection problem. The dashboard
  // should ask the operator to inspect the configured repo path and Git command
  // output instead of recommending a checkout command that cannot work.
  assert.equal(nonRepoPreflight.ok, false);
  assert(nonRepoPreflight.blockers.some(item => item.includes('Could not fetch origin.')));
  assert(nonRepoPreflight.blockers.some(item => item.includes('Could not determine the current branch.')));
  assert.equal(nonRepoPreflight.nextAction.code, 'inspect_git_state');
  assert.match(nonRepoPreflight.nextAction.summary, /could not read the local Git branch/i);

  const missingRemoteRoot = join(root, 'missing-remote');
  await execFileAsync('node', ['-e', "require('fs').mkdirSync(process.argv[1])", missingRemoteRoot]);
  await git(missingRemoteRoot, ['init']);
  await git(missingRemoteRoot, ['checkout', '-b', 'master']);
  await git(missingRemoteRoot, ['config', 'user.email', 'symphony@example.invalid']);
  await git(missingRemoteRoot, ['config', 'user.name', 'Symphony Contract Test']);
  await writeAndCommit(missingRemoteRoot, 'README.md', '# local only\n', 'Initial local-only base');

  const missingRemotePreflight = await new TaskIntakeStore({
    repoRoot: missingRemoteRoot,
    storePath: join(root, 'stores', 'missing-remote.json'),
  }).runGitSyncPreflight();

  assert.equal(missingRemotePreflight.ok, false);
  assert(missingRemotePreflight.blockers.some(item => item.includes('Could not fetch origin.')));
  assert(missingRemotePreflight.blockers.some(item => item.includes('Could not read the GitHub origin/master commit.')));
  assert.equal(missingRemotePreflight.nextAction.code, 'inspect_git_state');

  const wrongBranchRoot = join(root, 'wrong-branch');
  await execFileAsync('node', ['-e', "require('fs').mkdirSync(process.argv[1])", wrongBranchRoot]);
  const wrongBranch = await prepareSyncedRepo(wrongBranchRoot);
  await git(wrongBranch.repo, ['checkout', '-b', 'feature/local-work']);

  const wrongBranchPreflight = await new TaskIntakeStore({
    repoRoot: wrongBranch.repo,
    storePath: join(root, 'stores', 'wrong-branch.json'),
  }).runGitSyncPreflight();

  assert.equal(wrongBranchPreflight.ok, false);
  assert(wrongBranchPreflight.blockers.some(item => item.includes('Current branch is feature/local-work, not master.')));
  assert.equal(wrongBranchPreflight.nextAction.code, 'switch_base_branch');

  const divergedRoot = join(root, 'diverged');
  await execFileAsync('node', ['-e', "require('fs').mkdirSync(process.argv[1])", divergedRoot]);
  const diverged = await prepareSyncedRepo(divergedRoot);
  const collaborator = join(divergedRoot, 'collaborator');

  await git(divergedRoot, ['clone', diverged.remote, collaborator]);
  await git(collaborator, ['checkout', 'master']);
  await git(collaborator, ['config', 'user.email', 'symphony@example.invalid']);
  await git(collaborator, ['config', 'user.name', 'Symphony Contract Test']);
  await writeAndCommit(collaborator, 'REMOTE.md', 'remote moved\n', 'Move GitHub base');
  await git(collaborator, ['push', 'origin', 'master']);
  await writeAndCommit(diverged.repo, 'LOCAL.md', 'local moved\n', 'Move local base');

  const divergedPreflight = await new TaskIntakeStore({
    repoRoot: diverged.repo,
    storePath: join(root, 'stores', 'diverged.json'),
  }).runGitSyncPreflight();

  assert.equal(divergedPreflight.ok, false);
  assert.equal(divergedPreflight.ahead, 1);
  assert.equal(divergedPreflight.behind, 1);
  assert(divergedPreflight.blockers.some(item => item.includes('master has 1 unpushed commit(s).')));
  assert(divergedPreflight.blockers.some(item => item.includes('master is behind origin/master by 1 commit(s).')));
  assert.equal(divergedPreflight.nextAction.code, 'resolve_divergence');
  assert.match(divergedPreflight.nextAction.summary, /fast-forward pull is not safe/);
  assert(divergedPreflight.remediation.some(item => item.includes('Inspect branch divergence')));
} finally {
  await rm(root, { recursive: true, force: true });
}
