import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the boundary between a local repair commit and a
// GitHub mutation. Symphony may record that a repair branch is ready to push,
// but it must show that pushing would mutate GitHub and still require operator
// approval before external state changes.

const tempRoot = await mkdir(join(tmpdir(), `symphony-repair-push-${Date.now()}`), { recursive: true });
const storePath = join(tempRoot, 'task-drafts.json');
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
    expectedFiles: ['src/commands/factory/__tests__/AbilityCommandFactory.test.ts'],
    verificationCommands: ['npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts'],
    createdAt: '2026-05-19T21:30:00.000Z',
    updatedAt: '2026-05-20T01:35:00.000Z',
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
    githubPullRequestHeadRef: 'add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885',
    githubPullRequestBaseRef: 'master',
    githubPullRequestChecks: {
      conclusion: 'failing',
      total: 4,
      passed: 0,
      failed: 4,
      pending: 0,
      skipped: 0,
      unknown: 0,
      artifacts: [],
      blockers: [{
        category: 'workflow_setup',
        severity: 'blocking',
        checkNames: ['Build', 'Tests'],
        evidence: ['npm ci failed because package-lock.json is out of sync.'],
        summary: 'Setup failed before task tests ran.',
        nextAction: 'Create setup repair task.',
        mutatesExternalSystems: false,
      }],
    },
    githubPullRequestFiles: null,
    githubPullRequestFeedback: null,
    githubPullRequestNextAction: null,
    githubPullRequestRepairDecision: {
      status: 'needs_operator_decision',
      category: 'workflow_setup',
      question: 'Which repair lane should Symphony use?',
      plainLanguageSummary: 'Setup failed before the task tests could run.',
      recommendedFirstStep: 'Create a small setup repair task.',
      evidence: ['npm ci failed because package-lock.json is out of sync.'],
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
    repairLaneExecutions: [],
    repairPushReadiness: null,
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
    repoRoot: process.cwd(),
    storePath,
    baseBranch: 'master',
    remoteName: 'origin',
  });

  const snapshot = await store.recordRepairPushReadiness(handoffId, {
    source: 'local_commit',
    worktreePath: 'F:\\Repos\\Aralia\\.worktrees\\pr-931-setup-repair',
    branch: 'codex/pr-931-setup-repair',
    commit: '19eb1cd4',
    repairBaseCommit: '0c0d9480',
    targetPullRequestHeadCommit: '0c0d9480',
    targetPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    changedFiles: ['package-lock.json'],
    verificationCommands: [
      'npx -p npm@10.8.2 npm ci --dry-run --no-audit --no-fund',
      'npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts',
    ],
    verificationSummary: 'npm 10.8.2 setup and 11 task-specific tests passed locally.',
  });

  const handoff = snapshot.handoffs.find(item => item.id === handoffId);
  assert(handoff);
  assert(handoff.repairPushReadiness);
  assert.equal(handoff.repairPushReadiness.status, 'awaiting_operator_push_approval');
  assert.equal(handoff.repairPushReadiness.commit, '19eb1cd4');
  assert.equal(handoff.repairPushReadiness.repairBaseCommit, '0c0d9480');
  assert.equal(handoff.repairPushReadiness.targetPullRequestHeadCommit, '0c0d9480');
  assert.equal(handoff.repairPushReadiness.freshnessStatus, 'matches_current_pr_head');
  assert.equal(handoff.repairPushReadiness.isBasedOnCurrentPullRequestHead, true);
  assert.equal(handoff.repairPushReadiness.postPushFollowUp.status, 'waiting_for_operator_push');
  assert.equal(handoff.repairPushReadiness.postPushFollowUp.mutatesExternalSystems, false);
  assert.equal(handoff.repairPushReadiness.postPushFollowUp.mutatesLocalFiles, false);
  assert.match(handoff.repairPushReadiness.postPushFollowUp.checksCommand, /gh pr checks 931/);
  assert.match(handoff.repairPushReadiness.postPushFollowUp.refreshEndpoint, /refresh-pr/);
  assert.deepEqual(handoff.repairPushReadiness.postPushFollowUp.expectedSequence, [
    'operator_pushes_repair',
    'github_checks_rerun',
    'symphony_refreshes_pr',
    'scout_core_readiness_updates',
  ]);
  assert.equal(handoff.repairPushReadiness.branch, 'codex/pr-931-setup-repair');
  assert.deepEqual(handoff.repairPushReadiness.changedFiles, ['package-lock.json']);
  assert.equal(handoff.repairPushReadiness.canPushNow, false);
  assert.equal(handoff.repairPushReadiness.mutatesExternalSystemsIfRun, true);
  assert.equal(handoff.repairPushReadiness.mutatesLocalFiles, false);
  assert.match(handoff.repairPushReadiness.pushCommand, /git push origin codex\/pr-931-setup-repair/);
  assert.match(handoff.repairPushReadiness.nextExpectedProof, /GitHub checks rerun/i);
  assert.match(handoff.repairPushReadiness.freshnessSummary, /repair base .* matches the current PR head/i);

  const persisted = JSON.parse(await readFile(storePath, 'utf8'));
  assert.equal(persisted.handoffs[0].repairPushReadiness.commit, '19eb1cd4');

  const staleSnapshot = await store.recordRepairPushReadiness(handoffId, {
    source: 'local_commit',
    worktreePath: 'F:\\Repos\\Aralia\\.worktrees\\pr-931-setup-repair',
    branch: 'codex/pr-931-setup-repair',
    commit: '19eb1cd4',
    repairBaseCommit: 'old-head',
    targetPullRequestHeadCommit: 'new-head',
    targetPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    changedFiles: ['package-lock.json'],
    verificationCommands: [
      'npx -p npm@10.8.2 npm ci --dry-run --no-audit --no-fund',
    ],
    verificationSummary: 'The local repair was prepared before the PR head moved.',
  });
  const staleHandoff = staleSnapshot.handoffs.find(item => item.id === handoffId);
  assert(staleHandoff?.repairPushReadiness);
  assert.equal(staleHandoff.repairPushReadiness.freshnessStatus, 'stale_pr_head');
  assert.equal(staleHandoff.repairPushReadiness.isBasedOnCurrentPullRequestHead, false);
  assert.match(staleHandoff.repairPushReadiness.freshnessSummary, /do not push this repair/i);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /renderRepairPushReadiness/);
assert.match(dashboard, /Repair push readiness/);
assert.match(dashboard, /Freshness/);
assert.match(dashboard, /repairBaseCommit/);
assert.match(dashboard, /targetPullRequestHeadCommit/);
assert.match(dashboard, /Post-push follow-up/);
assert.match(dashboard, /postPushFollowUp/);

const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
assert.match(server, /repair-push-readiness/);
assert.match(server, /recordRepairPushReadiness/);
