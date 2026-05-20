import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the first guarded repair-lane execution. When the
// operator chooses "create setup repair task", Symphony should create a new
// local draft only. It must not create a Linear issue, send Jules feedback,
// comment on GitHub, or touch local Git.

const tempRoot = await mkdir(join(tmpdir(), `symphony-repair-lane-${Date.now()}`), { recursive: true });
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
    expectedFiles: ['package-lock.json', '.github/workflows/ci.yml'],
    verificationCommands: ['npm ci --no-audit --no-fund'],
    createdAt: '2026-05-19T21:30:00.000Z',
    updatedAt: '2026-05-20T00:20:00.000Z',
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
    operatorAnswers: [{
      id: 'operator-answer-1',
      handoffId,
      selectedAction: 'create_setup_repair_task',
      answer: 'Create a separate setup repair task before sending Jules feedback.',
      answeredBy: 'operator',
      answeredAt: '2026-05-20T00:21:00.000Z',
      sourceQuestion: 'Which repair lane should Symphony use?',
      sourceStage: 'repair_decision',
      mutatesExternalSystems: false,
      mutatesLocalFiles: false,
    }],
    repairLaneExecutions: [],
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

  const snapshot = await store.executeSelectedRepairLane(handoffId);
  const repairDraft = snapshot.drafts.find(draft => draft.title.includes('Setup repair for ARA-6'));
  assert(repairDraft);
  assert.match(repairDraft.body, /package-lock\.json is out of sync/);
  assert.match(repairDraft.body, /GitHub PR: https:\/\/github\.com\/Gambitnl\/Aralia\/pull\/931/);
  assert.deepEqual(repairDraft.expectedFiles, ['package-lock.json', 'package.json', '.github/workflows/ci.yml']);
  assert(repairDraft.verificationCommands.includes('npm ci --no-audit --no-fund'));
  assert.equal(repairDraft.linearIssueId, null);

  const handoff = snapshot.handoffs.find(item => item.id === handoffId);
  assert(handoff);
  assert.equal(handoff.repairLaneExecutions.length, 1);
  assert.equal(handoff.repairLaneExecutions[0].selectedAction, 'create_setup_repair_task');
  assert.equal(handoff.repairLaneExecutions[0].createdDraftId, repairDraft.id);
  assert.equal(handoff.repairLaneExecutions[0].mutatesExternalSystems, false);
  assert.equal(handoff.repairLaneExecutions[0].mutatesLocalFiles, false);

  const persisted = JSON.parse(await readFile(storePath, 'utf8'));
  assert.equal(persisted.drafts.length, 1);
  assert.equal(persisted.handoffs[0].repairLaneExecutions.length, 1);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
assert.match(dashboard, /execute-repair-lane/);
assert.match(dashboard, /executeSelectedRepairLane/);

const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
assert.match(server, /execute-repair-lane/);
assert.match(server, /executeSelectedRepairLane/);
