import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the final "do not start Jules from stale GitHub"
// guardrail. A handoff may sit on the dashboard after its manifest is staged;
// if origin/master moves during that time, launch must stop before contacting
// Jules and force the operator to re-sync/re-stage from the current base.

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  await execFileAsync('git', args, { cwd });
}

async function addJulesOrchestratorPlaceholder(repo) {
  // This verifier is about launch preflight, not the Jules CLI internals. A
  // tiny placeholder keeps the existing .jules/orchestrator path present so
  // manifest staging can focus on base-commit safety.
  await mkdir(join(repo, '.jules', 'orchestrator'), { recursive: true });
  await writeFile(join(repo, '.jules', 'orchestrator', 'cli.ts'), 'export {};\n', 'utf8');
}

async function prepareSyncedRepo() {
  const root = await mkdtemp(join(tmpdir(), 'symphony-launch-contract-'));
  const repo = join(root, 'repo');
  const remote = join(root, 'remote.git');
  const secondClone = join(root, 'second-clone');
  const storePath = join(root, 'store', 'task-drafts.json');

  // The first clone is the local operator workspace that Symphony controls.
  // The bare repo stands in for GitHub, because Jules reads from GitHub rather
  // than from files that only exist in the operator's checkout.
  await git(root, ['init', '--bare', remote]);
  await git(root, ['clone', remote, repo]);
  await git(repo, ['checkout', '-b', 'master']);
  await git(repo, ['config', 'user.email', 'symphony@example.invalid']);
  await git(repo, ['config', 'user.name', 'Symphony Contract Test']);
  await writeFile(join(repo, 'README.md'), '# temporary repo\n', 'utf8');
  await addJulesOrchestratorPlaceholder(repo);
  await git(repo, ['add', 'README.md', '.jules']);
  await git(repo, ['commit', '-m', 'Initial synced base']);
  await git(repo, ['push', '-u', 'origin', 'master']);

  return { root, repo, remote, secondClone, storePath };
}

async function advanceRemoteBehindLocalControl(remote, secondClone) {
  // This second clone simulates someone else pushing to GitHub after the
  // operator staged a Jules manifest. Symphony must notice this before launch,
  // because otherwise Jules would clone a newer commit than the reviewed
  // manifest and prompt described.
  await git(join(secondClone, '..'), ['clone', remote, secondClone]);
  await git(secondClone, ['checkout', 'master']);
  await git(secondClone, ['config', 'user.email', 'symphony@example.invalid']);
  await git(secondClone, ['config', 'user.name', 'Symphony Contract Test']);
  await execFileAsync('node', ['-e', "require('fs').appendFileSync('README.md', 'remote moved\\n')"], { cwd: secondClone });
  await git(secondClone, ['add', 'README.md']);
  await git(secondClone, ['commit', '-m', 'Move GitHub base after staging']);
  await git(secondClone, ['push', 'origin', 'master']);
}

const { root, repo, remote, secondClone, storePath } = await prepareSyncedRepo();

try {
  const intake = new TaskIntakeStore({
    repoRoot: repo,
    storePath,
    baseBranch: 'master',
    remoteName: 'origin',
  });

  const created = await intake.createDraft({
    title: 'Launch must respect latest master',
    body: 'Prove Symphony blocks Jules launch if GitHub moves after staging.',
    expectedFiles: 'src/components/Widget',
    verificationCommands: 'npm.cmd run build',
  });
  const draft = created.drafts[0];

  await intake.attachLinearIssueToDraft(draft.id, {
    id: 'linear-launch-id',
    identifier: 'ARA-1000',
    url: 'https://linear.app/example/issue/ARA-1000',
  });

  const promoted = await intake.promoteDraft(draft.id, { requireLinearIssue: true });
  const handoff = promoted.handoffs[0];
  const staged = await intake.stageHandoffManifest(handoff.id);
  const stagedHandoff = staged.handoffs[0];
  const manifestBeforeRemoteMoved = JSON.parse(await readFile(stagedHandoff.manifestPath, 'utf8'));

  await advanceRemoteBehindLocalControl(remote, secondClone);

  await assert.rejects(
    () => intake.launchHandoff(handoff.id),
    /GitHub sync gate is blocked:/
  );

  const afterBlockedLaunch = await intake.snapshot();
  const blockedHandoff = afterBlockedLaunch.handoffs.find(item => item.id === handoff.id);
  const manifestAfterBlockedLaunch = JSON.parse(await readFile(stagedHandoff.manifestPath, 'utf8'));

  // A blocked launch must leave the reviewed manifest intact and keep the
  // handoff in the pre-launch state. That gives the operator a clear dashboard
  // recovery path: sync master, re-stage, then launch from the new base.
  assert.equal(afterBlockedLaunch.preflight.ok, false);
  assert(afterBlockedLaunch.preflight.blockers.some(item => item.includes('behind')));
  assert.equal(blockedHandoff.status, 'blocked_by_git_sync');
  assert.equal(blockedHandoff.julesSessionId, null);
  assert.equal(blockedHandoff.launchError, null);
  assert.equal(manifestAfterBlockedLaunch.startingCommit, manifestBeforeRemoteMoved.startingCommit);
} finally {
  await rm(root, { recursive: true, force: true });
}
