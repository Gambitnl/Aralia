import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the handoff-to-repair transition.
//
// When the operator chooses the setup-repair lane, Symphony creates a local
// repair draft. That draft is now the next actionable thing, so the routing
// packet must focus on it instead of continuing to wait on the older Jules
// handoff that discovered the setup failure.

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
  await writeFile(join(local, 'README.md'), '# Setup repair routing fixture\n', 'utf8');
  await git(local, ['add', 'README.md']);
  await git(local, ['commit', '-m', 'base commit for setup repair routing fixture']);
  await git(local, ['branch', '-M', 'master']);
  await git(local, ['push', '-u', 'origin', 'master']);

  return { root, local };
}

const roots = [];

try {
  const repo = await makeSyncedRepo('symphony-setup-repair-routing-');
  roots.push(repo.root);

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
      expectedFiles: ['src/game/combat.ts'],
      verificationCommands: ['npm run test -- weapon-proficiency'],
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

  const store = new TaskIntakeStore({
    repoRoot: repo.local,
    storePath,
    baseBranch: 'master',
    remoteName: 'origin',
  });

  const snapshot = await store.executeSelectedRepairLane(handoffId);
  const repairDraft = snapshot.drafts.find(draft => draft.title.includes('Setup repair for ARA-6'));
  assert(repairDraft);

  assert.equal(snapshot.preflight.ok, true);
  assert.equal(snapshot.taskRouting.subjectId, repairDraft.id);
  assert.equal(snapshot.taskRouting.route, 'local_agent');
  assert.equal(snapshot.taskRouting.nextAction.code, 'assign_local_agent');
  assert.equal(snapshot.taskRouting.workerMode.mode, 'local_careful');
  assert.equal(snapshot.taskRouting.workerMode.canDispatchNow, true);
  assert.match(snapshot.taskRouting.summary, /setup repair/i);
  assert.ok(snapshot.taskRouting.reasons.some(reason => /setup repair/i.test(reason)));
} finally {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
}
