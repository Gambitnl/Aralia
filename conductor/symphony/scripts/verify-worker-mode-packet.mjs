import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the dynamic worker-mode packet. Task routing already
// decides whether Symphony should wait, stay local, or prepare Jules; this
// packet explains the recommended Codex/Jules mode, model, reasoning effort,
// complexity signals, and override policy without dispatching a worker.

const execFileAsync = promisify(execFile);

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

async function makeSyncedRepo(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const remote = join(root, 'remote.git');
  const local = join(root, 'local');

  await execFileAsync('git', ['init', '--bare', remote]);
  await execFileAsync('git', ['clone', remote, local]);
  await configureUser(local);
  await writeFile(join(local, 'README.md'), '# Worker mode fixture\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for worker mode fixture']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  return { root, local };
}

async function makeStore(prefix) {
  const repo = await makeSyncedRepo(prefix);
  roots.push(repo.root);
  return new TaskIntakeStore({
    repoRoot: repo.local,
    storePath: join(repo.root, 'task-drafts.json'),
  });
}

const roots = [];

try {
  const blockedRepo = await makeSyncedRepo('symphony-worker-mode-blocked-');
  roots.push(blockedRepo.root);
  await writeFile(join(blockedRepo.local, 'README.md'), '# Worker mode fixture\n\nlocal edit\n', 'utf8');
  const blockedStore = new TaskIntakeStore({
    repoRoot: blockedRepo.local,
    storePath: join(blockedRepo.root, 'task-drafts.json'),
  });
  const blocked = await blockedStore.createDraft({
    title: 'Small task blocked by Git',
    body: 'A tiny edit still needs the human Git disposition first.',
    expectedFiles: ['README.md'],
    verificationCommands: ['npm.cmd run build'],
  });

  assert.equal(blocked.taskRouting.workerMode.mode, 'operator_only');
  assert.equal(blocked.taskRouting.workerMode.canDispatchNow, false);
  assert.equal(blocked.taskRouting.workerMode.recommendedReasoningEffort, 'none');
  assert.equal(blocked.taskRouting.workerMode.complexitySignals.blocked, true);

  const sparkStore = await makeStore('symphony-worker-mode-spark-');
  const spark = await sparkStore.createDraft({
    title: 'Scan GitHub and Linear status',
    body: 'Retrieve the latest GitHub PR status and Linear issue summary, then report the checklist without editing code.',
    expectedFiles: ['conductor/symphony/docs/decision-reports/status-report.md'],
    verificationCommands: ['npm.cmd run build'],
  });

  assert.equal(spark.taskRouting.route, 'local_agent');
  assert.equal(spark.taskRouting.workerMode.mode, 'local_spark');
  assert.equal(spark.taskRouting.workerMode.recommendedModel, 'gpt-5.3-codex-spark');
  assert.equal(spark.taskRouting.workerMode.recommendedReasoningEffort, 'low');
  assert.equal(spark.taskRouting.workerMode.complexitySignals.sparkEligible, true);
  assert.equal(spark.taskRouting.workerMode.canDispatchNow, true);

  const fastStore = await makeStore('symphony-worker-mode-fast-');
  const fast = await fastStore.createDraft({
    title: 'Fix dashboard wording typo',
    body: 'Small copy-only dashboard edit.',
    expectedFiles: ['conductor/symphony/public/dashboard.js'],
    verificationCommands: ['npm.cmd run build'],
  });

  assert.equal(fast.taskRouting.route, 'local_agent');
  assert.equal(fast.taskRouting.workerMode.mode, 'local_fast');
  assert.equal(fast.taskRouting.workerMode.recommendedReasoningEffort, 'low');
  assert.equal(fast.taskRouting.workerMode.canDispatchNow, true);

  const carefulStore = await makeStore('symphony-worker-mode-careful-');
  const careful = await carefulStore.createDraft({
    title: 'Dashboard wiring sync label',
    body: 'Small dashboard wiring change that mentions sync state and touches script plus style.',
    expectedFiles: [
      'conductor/symphony/public/dashboard.js',
      'conductor/symphony/public/dashboard.css',
    ],
    verificationCommands: ['npm.cmd run build'],
  });

  assert.equal(careful.taskRouting.route, 'local_agent');
  assert.equal(careful.taskRouting.workerMode.mode, 'local_careful');
  assert.equal(careful.taskRouting.workerMode.recommendedReasoningEffort, 'medium');
  assert.ok(careful.taskRouting.workerMode.complexitySignals.riskyKeywordCount > 0);

  const taskStore = await makeStore('symphony-worker-mode-jules-task-');
  const task = await taskStore.createDraft({
    title: 'Implement bounded renderer feature',
    body: 'Add a focused renderer behavior with a clear verification command.',
    expectedFiles: [
      'conductor/symphony/src/server.ts',
      'conductor/symphony/public/dashboard.js',
      'conductor/symphony/scripts/verify-renderer.mjs',
    ],
    verificationCommands: ['npm.cmd run build'],
  });

  assert.equal(task.taskRouting.route, 'jules_task');
  assert.equal(task.taskRouting.workerMode.mode, 'jules_task');
  assert.equal(task.taskRouting.workerMode.recommendedReasoningEffort, 'medium');

  const planStore = await makeStore('symphony-worker-mode-jules-plan-');
  const plan = await planStore.createDraft({
    title: 'Plan multi-stage Jules handoff for encounter systems',
    body: 'Ask Jules to make a plan first, then tackle a multi-file implementation with architecture implications.',
    expectedFiles: [
      'src/systems/encounters/generator.ts',
      'src/data/bestiary/index.ts',
      'docs/encounters.md',
      'conductor/symphony/public/dashboard.js',
    ],
    verificationCommands: ['npm.cmd run build', 'npm.cmd run test'],
  });

  assert.equal(plan.taskRouting.route, 'jules_plan');
  assert.equal(plan.taskRouting.workerMode.mode, 'jules_plan');
  assert.equal(plan.taskRouting.workerMode.recommendedReasoningEffort, 'high');

  const observeStore = await makeStore('symphony-worker-mode-observe-');
  const observed = await observeStore.watchPullRequest({
    prUrl: 'https://github.com/Gambitnl/Aralia/pull/900',
    title: 'Observed PR wait proof',
    expectedFiles: ['src/example.ts'],
    verificationCommands: ['npm.cmd run build'],
  });

  assert.equal(observed.taskRouting.route, 'wait_external');
  assert.equal(observed.taskRouting.workerMode.mode, 'observe_wait');
  assert.equal(observed.taskRouting.workerMode.canDispatchNow, false);
  assert.equal(observed.taskRouting.workerMode.complexitySignals.externalBoundary, true);
  assert.equal(observed.taskRouting.workerMode.complexitySignals.dashboardStarted, false);
  assert.match(observed.taskRouting.workerMode.overridePolicy, /codex\.model/);
  assert.match(observed.taskRouting.workerMode.overridePolicy, /codex\.reasoning_effort/);
} finally {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
}
