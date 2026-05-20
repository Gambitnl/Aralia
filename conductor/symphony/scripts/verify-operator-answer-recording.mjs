import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the next piece of the human-blocker loop. Symphony can
// already ask a plain-language operator question; this check proves the answer
// can be recorded durably in the local task store without sending Jules
// feedback, creating Linear tasks, mutating GitHub, or touching local Git.

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  return execFileAsync('git', ['-C', cwd, ...args], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}

async function makeSyncedRepo(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const remote = join(root, 'remote.git');
  const local = join(root, 'local');

  await execFileAsync('git', ['init', '--bare', remote]);
  await execFileAsync('git', ['clone', remote, local]);
  await git(local, ['config', 'user.name', 'Symphony Verifier']);
  await git(local, ['config', 'user.email', 'symphony-verifier@example.test']);
  await writeFile(join(local, 'README.md'), '# Operator answer fixture\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for operator answer fixture']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  return { root, local };
}

const repo = await makeSyncedRepo('symphony-operator-answer-');
const storePath = join(repo.root, 'task-drafts.json');
const handoffId = 'handoff-ara6';

await writeFile(storePath, JSON.stringify({
  drafts: [],
  gitDisposition: [],
  taskNudges: [],
  handoffs: [{
    id: handoffId,
    draftId: 'draft-ara6',
    title: 'Add regression coverage for non-proficient weapon attack penalties',
    executor: 'jules',
    status: 'sent_to_jules',
    prompt: 'Prompt',
    expectedFiles: ['src/example.ts'],
    verificationCommands: ['npm test'],
    createdAt: '2026-05-19T21:30:00.000Z',
    updatedAt: '2026-05-19T23:52:00.000Z',
    gitPreflight: null,
    baseCommitDrift: null,
    runId: null,
    manifestPath: null,
    launchCommand: null,
    launchOutput: null,
    launchError: null,
    launchedAt: null,
    statusCommand: null,
    reviewCommand: null,
    pullCommand: null,
    recordsPath: null,
    lastStatusRefreshAt: null,
    julesSessionId: '4101281510355198885',
    julesSessionUrl: 'https://jules.google.com/session/4101281510355198885',
    julesState: 'COMPLETED',
    linearIssueId: null,
    linearIssueIdentifier: 'ARA-6',
    linearIssueUrl: 'https://linear.app/aralia/issue/ARA-6/example',
    linearIssueCreatedAt: '2026-05-19T21:35:00.000Z',
    githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    githubPullRequestState: 'OPEN',
    githubPullRequestIsDraft: false,
    githubPullRequestMergeable: 'MERGEABLE',
    githubPullRequestReviewDecision: null,
    githubPullRequestHeadRef: null,
    githubPullRequestBaseRef: 'master',
    githubPullRequestChecks: null,
    githubPullRequestFiles: null,
    githubPullRequestFeedback: null,
    githubPullRequestNextAction: null,
    githubPullRequestRepairDecision: {
      status: 'needs_operator_decision',
      category: 'workflow_setup',
      question: 'Which repair lane should Symphony use?',
      plainLanguageSummary: 'Setup failed before the task tests could run.',
      recommendedFirstStep: 'Create a small setup repair task.',
      evidence: [],
      options: [],
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
      nextExpectedProof: 'Chosen repair lane.',
    },
    delegationRoiEstimate: null,
    delegationRoiLedger: null,
    handoffTimeline: null,
    operatorQuestion: null,
    operatorAnswers: [],
    githubPullRequestRefreshError: null,
    lastPullRequestRefreshAt: '2026-05-19T23:52:00.000Z',
    pullRequestViewCommand: null,
    pullRequestChecksCommand: null,
    pullRequestMergeCommand: null,
    scoutReviewCommand: null,
    coreValidationCommand: null,
    coreMergeCommand: null,
    localSyncCommand: null,
    localSyncStatus: null,
    localSyncOutput: null,
    localSyncError: null,
    lastLocalSyncAt: null,
    operatorMessages: [],
    planApprovals: [],
  }],
}, null, 2));

try {
  const store = new TaskIntakeStore({
    repoRoot: repo.local,
    storePath,
    baseBranch: 'master',
    remoteName: 'origin',
  });

  const snapshot = await store.recordOperatorAnswer(handoffId, {
    selectedAction: 'create_setup_repair_task',
    answer: 'Create a separate setup repair task before sending Jules feedback.',
    answeredBy: 'operator',
  });

  const handoff = snapshot.handoffs.find(item => item.id === handoffId);
  assert(handoff);
  assert.equal(handoff.operatorAnswers.length, 1);
  assert.equal(handoff.operatorAnswers[0].selectedAction, 'create_setup_repair_task');
  assert.match(handoff.operatorAnswers[0].answer, /separate setup repair task/);
  assert.equal(handoff.operatorAnswers[0].mutatesExternalSystems, false);
  assert.equal(handoff.operatorAnswers[0].mutatesLocalFiles, false);
  assert.equal(handoff.operatorAnswers[0].sourceQuestion, 'Which repair lane should Symphony use?');
  assert.equal(handoff.operatorQuestion?.status, 'waiting_for_operator');

const persisted = JSON.parse(await readFile(storePath, 'utf8'));
assert.equal(persisted.handoffs[0].operatorAnswers.length, 1);
assert.equal(persisted.handoffs[0].operatorAnswers[0].selectedAction, 'create_setup_repair_task');

  const pushSnapshot = await store.recordRepairPushReadiness(handoffId, {
    source: 'local_commit',
    worktreePath: 'F:\\Repos\\Aralia\\.worktrees\\pr-931-setup-repair',
    branch: 'codex/pr-931-setup-repair',
    commit: '19eb1cd4',
    repairBaseCommit: '0c0d9480',
    targetPullRequestHeadCommit: '0c0d9480',
    targetPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    changedFiles: ['package-lock.json'],
    verificationCommands: ['npm ci --dry-run'],
    verificationSummary: 'Lockfile repair verified locally.',
  });
  const pushReadyHandoff = pushSnapshot.handoffs.find(item => item.id === handoffId);
  assert.equal(pushReadyHandoff?.operatorQuestion?.sourceStage, 'repair_push_approval');

  const pushAnswerSnapshot = await store.recordOperatorAnswer(handoffId, {
    selectedAction: 'approve_repair_push',
    answer: 'Approve the prepared push after confirming the repair base still matches the PR head.',
    answeredBy: 'operator',
  });
  const pushAnswerHandoff = pushAnswerSnapshot.handoffs.find(item => item.id === handoffId);
  assert(pushAnswerHandoff);
  assert.equal(pushAnswerHandoff.operatorAnswers[0].selectedAction, 'approve_repair_push');
  assert.equal(pushAnswerHandoff.operatorAnswers[0].sourceStage, 'repair_push_approval');
  assert.match(pushAnswerHandoff.operatorAnswers[0].sourceQuestion ?? '', /approve pushing the prepared repair/i);
  assert.equal(pushAnswerHandoff.operatorAnswers[0].mutatesExternalSystems, false);
  assert.equal(pushAnswerHandoff.operatorAnswers[0].mutatesLocalFiles, false);
  assert.equal(pushAnswerHandoff.repairPushResult, null);
  assert.equal(pushAnswerSnapshot.taskRouting.route, 'ask_operator');
  assert.equal(pushAnswerSnapshot.taskRouting.workerMode.mode, 'operator_only');
  assert.equal(pushAnswerSnapshot.taskRouting.workerMode.canDispatchNow, false);
  assert.equal(pushAnswerSnapshot.taskRouting.nextAction.label, 'Record repair push result');
  assert.match(pushAnswerSnapshot.taskRouting.summary, /Repair push approved locally/i);
  assert.match(pushAnswerSnapshot.taskRouting.nextAction.detail, /git push origin codex\/pr-931-setup-repair/);
  assert.match(pushAnswerSnapshot.taskRouting.reasons.join('\n'), /must still be performed outside this read-only routing packet/);
} finally {
  await rm(repo.root, { recursive: true, force: true });
}

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /record-operator-answer/);
assert.match(dashboard, /recordOperatorAnswer/);

const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
assert.match(server, /operator-answer/);
assert.match(server, /recordOperatorAnswer/);
