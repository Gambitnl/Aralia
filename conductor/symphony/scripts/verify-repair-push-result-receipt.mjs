import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the handoff after a human-approved repair push.
// Symphony should be able to record that the push happened and what should be
// watched next, while still not pushing, rerunning checks, merging, or pulling
// local Git on its own.

const tempRoot = await mkdir(join(tmpdir(), `symphony-repair-push-result-${Date.now()}`), { recursive: true });
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
    expectedFiles: ['package-lock.json'],
    verificationCommands: ['npx -p npm@10.8.2 npm ci --dry-run --no-audit --no-fund'],
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
    githubPullRequestChecks: null,
    githubPullRequestFiles: null,
    githubPullRequestFeedback: null,
    githubPullRequestNextAction: null,
    githubPullRequestRepairDecision: null,
    delegationRoiEstimate: null,
    delegationRoiLedger: null,
    handoffTimeline: null,
    operatorQuestion: null,
    operatorAnswers: [],
    repairLaneExecutions: [],
    repairPushReadiness: {
      handoffId,
      status: 'awaiting_operator_push_approval',
      source: 'local_commit',
      recordedAt: '2026-05-20T10:00:00.000Z',
      worktreePath: 'F:\\Repos\\Aralia\\.worktrees\\pr-931-setup-repair',
      branch: 'codex/pr-931-setup-repair',
      commit: '19eb1cd4',
      repairBaseCommit: '0c0d9480',
      targetPullRequestHeadCommit: '0c0d9480',
      freshnessStatus: 'matches_current_pr_head',
      isBasedOnCurrentPullRequestHead: true,
      freshnessSummary: 'Repair base matches current PR head.',
      targetPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
      changedFiles: ['package-lock.json'],
      verificationCommands: ['npx -p npm@10.8.2 npm ci --dry-run --no-audit --no-fund'],
      verificationSummary: 'Local setup repair passed before push.',
      pushCommand: 'git push origin codex/pr-931-setup-repair:add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885',
      canPushNow: false,
      mutatesExternalSystemsIfRun: true,
      mutatesLocalFiles: false,
      postPushFollowUp: {
        status: 'waiting_for_operator_push',
        expectedSequence: ['operator_pushes_repair', 'github_checks_rerun', 'symphony_refreshes_pr', 'scout_core_readiness_updates'],
        checksCommand: 'gh pr checks 931 --repo Gambitnl/Aralia',
        refreshEndpoint: '/api/v1/jules-handoffs/handoff-ara6/refresh-pr',
        scoutCoreReadinessEndpoint: '/api/v1/task-drafts',
        mutatesExternalSystems: false,
        mutatesLocalFiles: false,
        summary: 'After push, watch checks and refresh Symphony.',
      },
      nextExpectedProof: 'Operator pushes, GitHub checks rerun, Symphony refreshes PR.',
      summary: 'Local repair is ready for push.',
    },
    repairPushResult: null,
    deploymentEvidence: null,
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

  const snapshot = await store.recordRepairPushResult(handoffId, {
    status: 'pushed',
    pushedCommit: '19eb1cd4',
    targetPullRequestHeadCommit: '19eb1cd4',
    pushedAt: '2026-05-20T10:15:00.000Z',
    pushedBy: 'operator',
    evidenceUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
    summary: 'Operator pushed the setup repair branch to PR #931.',
  });

  const handoff = snapshot.handoffs.find(item => item.id === handoffId);
  assert(handoff?.repairPushResult);
  assert.equal(handoff.repairPushResult.status, 'pushed');
  assert.equal(handoff.repairPushResult.pushedCommit, '19eb1cd4');
  assert.equal(handoff.repairPushResult.targetPullRequestHeadCommit, '19eb1cd4');
  assert.equal(handoff.repairPushResult.mutatesExternalSystems, false);
  assert.equal(handoff.repairPushResult.mutatesLocalFiles, false);
  assert.equal(handoff.repairPushResult.nextBoundary, 'github_checks_rerun');
  assert.match(handoff.repairPushResult.checksCommand, /gh pr checks 931 --repo Gambitnl\/Aralia/);
  assert.match(handoff.repairPushResult.refreshEndpoint, /refresh-pr/);
  assert.match(handoff.repairPushResult.nextExpectedProof, /GitHub checks complete/i);

  const persisted = JSON.parse(await readFile(storePath, 'utf8'));
  assert.equal(persisted.handoffs[0].repairPushResult.status, 'pushed');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /renderRepairPushResult/);
assert.match(dashboard, /Repair push result/);
assert.match(dashboard, /repairPushResult/);
assert.match(dashboard, /recordRepairPushResult/);
assert.match(dashboard, /record-repair-push-result/);
assert.match(dashboard, /data-repair-push-result="pushedCommit"/);
assert.match(dashboard, /Record Repair Push Result/);

const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
assert.match(server, /repair-push-result/);
assert.match(server, /recordRepairPushResult/);
