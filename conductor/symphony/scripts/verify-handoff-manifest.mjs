import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the most important bridge in the Jules workflow:
// a dashboard draft becomes a durable Jules manifest. The manifest must carry
// the synced GitHub base commit, the operator's write scope, requested checks,
// and the Linear tracking issue so Jules, Scout, and Core all review the same
// bounded task instead of a vague cloud instruction.

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  await execFileAsync('git', args, { cwd });
}

async function addJulesOrchestratorPlaceholder(repo) {
  // The verifier is not exercising the Jules CLI itself; it only needs the
  // existing orchestrator path to be present so staging can prove it is writing
  // a manifest for that bridge instead of inventing a second launch surface.
  await mkdir(join(repo, '.jules', 'orchestrator'), { recursive: true });
  await writeFile(join(repo, '.jules', 'orchestrator', 'cli.ts'), 'export {};\n', 'utf8');
}

async function prepareSyncedRepo(opts = { includeJulesOrchestrator: true }) {
  const root = await mkdtemp(join(tmpdir(), 'symphony-manifest-contract-'));
  const repo = join(root, 'repo');
  const remote = join(root, 'remote.git');
  const storePath = join(root, 'store', 'task-drafts.json');

  // The temporary repository mirrors the real preflight rule: local master must
  // match origin/master before Symphony can stage a Jules manifest.
  await git(root, ['init', '--bare', remote]);
  await git(root, ['clone', remote, repo]);
  await git(repo, ['checkout', '-b', 'master']);
  await git(repo, ['config', 'user.email', 'symphony@example.invalid']);
  await git(repo, ['config', 'user.name', 'Symphony Contract Test']);
  await writeFile(join(repo, 'README.md'), '# temporary repo\n', 'utf8');
  if (opts.includeJulesOrchestrator) {
    await addJulesOrchestratorPlaceholder(repo);
  }
  await git(repo, opts.includeJulesOrchestrator
    ? ['add', 'README.md', '.jules']
    : ['add', 'README.md']);
  await git(repo, ['commit', '-m', 'Initial synced base']);
  await git(repo, ['push', '-u', 'origin', 'master']);

  return { root, repo, storePath };
}

const missingCliRepo = await prepareSyncedRepo({ includeJulesOrchestrator: false });
try {
  const intake = new TaskIntakeStore({
    repoRoot: missingCliRepo.repo,
    storePath: missingCliRepo.storePath,
    baseBranch: 'master',
    remoteName: 'origin',
  });

  const created = await intake.createDraft({
    title: 'Missing Jules orchestrator proof',
    body: 'Prove Symphony does not stage a manifest when the existing Jules bridge is unavailable.',
    expectedFiles: 'src/components/Widget',
    verificationCommands: 'npm.cmd run build',
  });
  const promoted = await intake.promoteDraft(created.drafts[0].id);

  await assert.rejects(
    () => intake.stageHandoffManifest(promoted.handoffs[0].id),
    /Jules orchestrator CLI is missing at \.jules\/orchestrator\/cli\.ts/
  );
} finally {
  await rm(missingCliRepo.root, { recursive: true, force: true });
}

const { root, repo, storePath } = await prepareSyncedRepo();

try {
  const intake = new TaskIntakeStore({
    repoRoot: repo,
    storePath,
    baseBranch: 'master',
    remoteName: 'origin',
  });

  const created = await intake.createDraft({
    title: 'Tighten the Widget controls',
    body: 'Adjust the Widget controls without touching unrelated systems.',
    expectedFiles: 'src/components/Widget\nsrc/components/Widget/index.ts',
    verificationCommands: 'npm.cmd run build\nnpm.cmd test -- Widget',
  });
  const draft = created.drafts[0];

  await intake.attachLinearIssueToDraft(draft.id, {
    id: 'linear-issue-id',
    identifier: 'ARA-999',
    url: 'https://linear.app/example/issue/ARA-999',
  });

  const promoted = await intake.promoteDraft(draft.id, { requireLinearIssue: true });
  const handoff = promoted.handoffs[0];
  const staged = await intake.stageHandoffManifest(handoff.id);
  const stagedHandoff = staged.handoffs[0];
  const manifest = JSON.parse(await readFile(stagedHandoff.manifestPath, 'utf8'));
  const task = manifest.tasks[0];

  // The manifest should prove exactly which GitHub commit Jules is starting
  // from. This is the hard-sync evidence that prevents local-only work from
  // silently becoming the wrong cloud base.
  assert.equal(staged.preflight.ok, true);
  assert.equal(manifest.startingBranch, 'master');
  assert.equal(manifest.startingCommit, staged.preflight.remoteCommit);
  assert.equal(staged.preflight.localCommit, staged.preflight.remoteCommit);

  // The dashboard's task fields must survive Linear promotion and manifest
  // staging. These are the practical boundaries Scout/Core later compare
  // against when a Jules PR comes back from GitHub.
  assert.equal(manifest.requirePlanApproval, true);
  assert.deepEqual(task.writeScopes, ['src/components/Widget', 'src/components/Widget/index.ts']);
  assert(task.forbiddenFiles.includes('package-lock.json'));
  assert(task.prompt.includes('Linear issue: `ARA-999`'));
  assert(task.prompt.includes('Treat `origin/master` at commit'));
  assert(task.prompt.includes('- `npm.cmd run build`'));
  assert(task.prompt.includes('- `npm.cmd test -- Widget`'));
  assert(task.prompt.includes('- `src/components/Widget`'));
  assert(task.verification.some(line => line.includes('npm.cmd run build')));
  assert(task.verification.some(line => line.includes('Scout to bridge conflicts before Core validates')));
} finally {
  await rm(root, { recursive: true, force: true });
}
