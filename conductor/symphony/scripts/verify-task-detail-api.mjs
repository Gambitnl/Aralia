import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the first task-detail API surface. The dashboard has a
// navigator and compact preview, but future task pages and task-scoped Codex chat
// need a stable read-only endpoint for one draft or handoff without creating a
// second task store or mutating Jules, GitHub, Linear, or local Git.

const BASE_URL = 'http://127.0.0.1:8197';

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const orchestrator = {
  getConfig() {
    return { tracker: { kind: 'linear', apiKey: 'test-key', projectSlug: 'aralia' } };
  },
  getDashboardBaseUrl() {
    return BASE_URL;
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-20T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { input_tokens: 3, output_tokens: 5, total_tokens: 8, seconds_running: 13 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: BASE_URL },
    };
  },
};

const generatedAt = '2026-05-20T00:00:00.000Z';
const server = new HttpServer(8197, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [{
        id: 'draft-detail',
        title: 'Clarify bounded Jules task',
        body: 'Clarify the task before creating Linear tracking.',
        expectedFiles: ['conductor/symphony/src/server.ts'],
        verificationCommands: ['npm run verify:jules-contract'],
        executor: 'jules',
        status: 'ready_for_handoff',
        linearIssueId: null,
        linearIssueIdentifier: null,
        linearIssueUrl: null,
        linearIssueCreatedAt: null,
        createdAt: generatedAt,
        updatedAt: generatedAt,
      }],
      handoffs: [{
        id: 'handoff-detail',
        draftId: 'draft-detail',
        title: 'ARA-6 weapon proficiency regression',
        executor: 'jules',
        status: 'sent_to_jules',
        prompt: 'Add regression coverage and keep scope bounded.',
        expectedFiles: [
          'src/commands/factory/__tests__/AbilityCommandFactory.test.ts',
          'src/hooks/combat/__tests__/useActionExecutor.test.ts',
        ],
        verificationCommands: ['npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts'],
        createdAt: generatedAt,
        updatedAt: generatedAt,
        gitPreflight: null,
        baseCommitDrift: null,
        runId: 'run-detail',
        manifestPath: '.jules/runs/run-detail/manifest.json',
        launchCommand: 'npx tsx .jules/orchestrator/cli.ts launch .jules/runs/run-detail/manifest.json',
        launchOutput: null,
        launchError: null,
        launchedAt: generatedAt,
        statusCommand: 'npx tsx .jules/orchestrator/cli.ts status run-detail',
        reviewCommand: null,
        pullCommand: null,
        recordsPath: '.jules/runs/run-detail',
        lastStatusRefreshAt: generatedAt,
        julesSessionId: '4101281510355198885',
        julesSessionUrl: 'https://jules.google.com/session/4101281510355198885',
        julesState: 'COMPLETED',
        linearIssueId: 'linear-detail',
        linearIssueIdentifier: 'ARA-6',
        linearIssueUrl: 'https://linear.app/aralia/issue/ARA-6/example',
        linearIssueCreatedAt: generatedAt,
        githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
        githubPullRequestState: 'OPEN',
        githubPullRequestIsDraft: false,
        githubPullRequestMergeable: 'MERGEABLE',
        githubPullRequestReviewDecision: null,
        githubPullRequestHeadRef: 'add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885',
        githubPullRequestBaseRef: 'master',
        githubPullRequestChecks: { total: 4, passed: 0, failed: 4, pending: 0, skipped: 0, unknown: 0, conclusion: 'failure', artifacts: [] },
        githubPullRequestFiles: { total: 3, additions: 127, deletions: 19, files: [] },
        githubPullRequestFeedback: { totalComments: 0, julesFeedback: [], scoutConflictComments: [], externalReviewComments: [], summary: 'No PR feedback recorded.' },
        githubPullRequestNextAction: {
          label: 'Resolve CI Setup Blocker',
          summary: 'Prepare a marked Jules feedback comment if the local setup repair is rejected.',
          feedbackCommand: 'gh pr comment https://github.com/Gambitnl/Aralia/pull/931 --body-file .jules/feedback/handoff-detail-pr-feedback.md',
        },
        githubPullRequestRefreshError: null,
        lastPullRequestRefreshAt: generatedAt,
        pullRequestViewCommand: 'gh pr view 931 --repo Gambitnl/Aralia',
        pullRequestChecksCommand: 'gh pr checks 931 --repo Gambitnl/Aralia',
        pullRequestMergeCommand: null,
        scoutReviewCommand: null,
        coreValidationCommand: null,
        coreMergeCommand: null,
        localSyncCommand: null,
        localSyncStatus: null,
        localSyncOutput: null,
        localSyncError: null,
        lastLocalSyncAt: null,
        operatorMessages: [{ body: 'Observed ready for review in Jules.', sentAt: generatedAt }],
        planApprovals: [{ planId: 'plan-detail', approvedAt: generatedAt, status: 'approved' }],
        repairPushReadiness: {
          status: 'awaiting_operator_push_approval',
          branch: 'codex/pr-931-setup-repair',
          commit: '19eb1cd4',
          worktreePath: 'F:\\Repos\\Aralia\\.worktrees\\pr-931-setup-repair',
          pushCommand: 'git push origin codex/pr-931-setup-repair:add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885',
          targetPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
          mutatesExternalSystemsIfRun: true,
          mutatesLocalFiles: false,
        },
        repairPushResult: null,
        operatorQuestion: {
          status: 'waiting_for_operator',
          question: 'How should Symphony handle the setup blocker?',
          choices: [],
          quietHours: { active: false },
        },
        handoffTimeline: {
          generatedAt,
          events: [
            { stage: 'jules_launch', label: 'Jules launched', occurredAt: generatedAt, source: 'symphony', status: 'recorded' },
            { stage: 'github_pr', label: 'PR detected', occurredAt: generatedAt, source: 'github', status: 'recorded' },
          ],
        },
        next_action: {
          code: 'refresh_pr',
          label: 'Refresh GitHub PR',
          summary: 'Refresh PR state after external evidence changes.',
          endpoint: '/api/v1/jules-handoffs/handoff-detail/refresh-pr',
          method: 'POST',
        },
      }],
      preflight: {
        ok: true,
        checkedAt: generatedAt,
        repoRoot: 'F:\\Repos\\Aralia',
        baseBranch: 'master',
        remoteBranch: 'origin/master',
        currentBranch: 'master',
        localCommit: 'local',
        remoteCommit: 'remote',
        ahead: 0,
        behind: 0,
        dirtyFiles: 0,
        untrackedFiles: 0,
        blockers: [],
        summary: 'Ready: master matches origin/master and the working tree is clean.',
        details: [],
        dirtyFileSamples: [],
        untrackedFileSamples: [],
        resolutionPacket: { commands: {} },
        remediation: [],
        nextAction: { code: 'ready', tone: 'ready', label: 'GitHub Sync Ready', command: 'git status --short', summary: 'Clean checkout.', steps: [] },
        commands: {},
      },
      gitDisposition: {
        categories: [],
        decidedCount: 0,
        totalRequired: 0,
        readyForHumanSync: true,
        summary: 'No Git disposition decisions required.',
        updatedAt: null,
      },
      gitSyncPlan: {
        generatedAt,
        status: 'ready',
        mutatesGit: false,
        canExecute: false,
        summary: 'Git sync is already clean.',
        requiredDispositions: [],
        blockers: [],
        steps: [],
      },
      taskRouting: {
        generatedAt,
        route: 'jules_task',
        subjectId: 'handoff-detail',
        subjectTitle: 'ARA-6 weapon proficiency regression',
        summary: 'Follow the Jules/GitHub boundary.',
        reasons: [],
        nextAction: { code: 'refresh', label: 'Refresh GitHub PR', detail: 'Read-only PR refresh.', pauseSeconds: 300, nextNudgeAt: null },
        candidates: [],
      },
      taskNudges: {
        total: 0,
        summary: 'No nudges recorded.',
        latest: null,
        recent: [],
        nextNudgeAt: null,
        scheduler: {
          checkedAt: generatedAt,
          status: 'idle',
          summary: 'No nudges due.',
          dueCount: 0,
          waitingCount: 0,
          blockedCount: 0,
          nextDueAt: null,
          mutatesExternalSystems: false,
          due: [],
          waiting: [],
          blocked: [],
        },
      },
    };
  },
};

try {
  await server.start();

  const draftDetail = await getJson(`${BASE_URL}/api/v1/tasks/draft-detail`);
  assert.equal(draftDetail.kind, 'draft');
  assert.equal(draftDetail.id, 'draft-detail');
  assert.equal(draftDetail.title, 'Clarify bounded Jules task');
  assert.equal(draftDetail.mutatesExternalSystems, false);
  assert.equal(draftDetail.mutatesLocalFiles, false);
  assert.equal(draftDetail.mutatesGit, false);
  assert.match(draftDetail.links.self, /\/api\/v1\/tasks\/draft-detail$/);
  assert.match(draftDetail.links.source, /\/api\/v1\/task-drafts$/);
  assert.match(draftDetail.currentBoundary.label, /Linear Issue/);
  assert.equal(draftDetail.expectedFiles.length, 1);
  assert.equal(draftDetail.verificationCommands.length, 1);

  const handoffDetail = await getJson(`${BASE_URL}/api/v1/tasks/handoff-detail`);
  assert.equal(handoffDetail.kind, 'handoff');
  assert.equal(handoffDetail.id, 'handoff-detail');
  assert.equal(handoffDetail.needsHumanInput, true);
  assert.equal(handoffDetail.mutatesExternalSystems, false);
  assert.equal(handoffDetail.mutatesLocalFiles, false);
  assert.equal(handoffDetail.mutatesGit, false);
  assert.match(handoffDetail.links.self, /\/api\/v1\/tasks\/handoff-detail$/);
  assert.match(handoffDetail.links.source, /\/api\/v1\/task-drafts$/);
  assert.match(handoffDetail.links.taskDisposition, /\/api\/v1\/tasks\/handoff-detail\/disposition$/);
  assert.match(handoffDetail.links.operatorAnswer, /\/api\/v1\/jules-handoffs\/handoff-detail\/operator-answer$/);
  assert.match(handoffDetail.links.repairPushResult, /\/api\/v1\/jules-handoffs\/handoff-detail\/repair-push-result$/);
  assert.match(handoffDetail.links.julesSession, /jules\.google\.com/);
  assert.match(handoffDetail.links.githubPullRequest, /github\.com\/Gambitnl\/Aralia\/pull\/931/);
  assert.match(handoffDetail.links.linearIssue, /linear\.app\/aralia/);
  assert.equal(handoffDetail.timeline.events.length, 2);
  assert.match(handoffDetail.timeline.summary, /Timeline events: 2/);
  assert.match(handoffDetail.currentBoundary.label, /Needs human input/);
  assert.equal(handoffDetail.operatorQuestion.question, 'How should Symphony handle the setup blocker?');
  assert.equal(handoffDetail.taskDisposition, null);
  assert.equal(handoffDetail.julesPrompt.status, 'manifest_staged');
  assert.match(handoffDetail.julesPrompt.prompt, /Add regression coverage/);
  assert.equal(handoffDetail.julesPrompt.mutatesExternalSystems, false);
  assert.equal(handoffDetail.julesDialogue.operatorMessages.length, 1);
  assert.equal(handoffDetail.julesDialogue.planApprovals.length, 1);
  assert.match(handoffDetail.julesDialogue.summary, /1 operator-to-Jules message/);
  assert.equal(handoffDetail.julesDialogue.mutatesExternalSystems, false);
  assert.equal(handoffDetail.githubPullRequestChecks.failed, 4);
  assert.equal(handoffDetail.githubPullRequestChecks.conclusion, 'failure');
  assert.match(handoffDetail.githubPullRequestNextAction.label, /Resolve CI Setup Blocker/);
  assert.match(handoffDetail.pullRequestChecksCommand, /gh pr checks 931/);
  assert.equal(handoffDetail.githubPullRequestState, 'OPEN');
  assert.equal(handoffDetail.guardedActions.length, 3);
  assert.deepEqual(handoffDetail.guardedActions.map(action => action.code), [
    'current_boundary',
    'jules_pr_feedback',
    'repair_push',
  ]);
  assert.equal(handoffDetail.guardedActions[0].mutatesExternalSystemsIfRun, false);
  assert.equal(handoffDetail.guardedActions[1].mutatesExternalSystemsIfRun, true);
  assert.equal(handoffDetail.guardedActions[2].mutatesExternalSystemsIfRun, true);
  assert.match(handoffDetail.guardedActions[1].command, /gh pr comment/);
  assert.match(handoffDetail.guardedActions[2].command, /git -C F:\\Repos\\Aralia\\\.worktrees\\pr-931-setup-repair push origin codex\/pr-931-setup-repair/);
  assert.equal(handoffDetail.approvalCheckpoint.status, 'waiting_for_operator');
  assert.match(handoffDetail.approvalCheckpoint.label, /Operator decision required/);
  assert.match(handoffDetail.approvalCheckpoint.question, /setup blocker/);
  assert.equal(handoffDetail.approvalCheckpoint.externalMutationIfRun, true);
  assert.equal(handoffDetail.approvalCheckpoint.mutatesExternalSystems, false);
  assert.equal(handoffDetail.approvalCheckpoint.mutatesLocalFiles, false);
  assert.equal(handoffDetail.approvalCheckpoint.mutatesGit, false);
  assert.equal(handoffDetail.approvalCheckpoint.externalAction.code, 'repair_push');
  assert.match(handoffDetail.approvalCheckpoint.safetyNote, /does not approve plans, send Jules feedback, comment on GitHub, push branches, rerun checks, merge, pull, or edit local files/);

  const missingDetail = await getJson(`${BASE_URL}/api/v1/tasks/missing-task`, { expectStatus: 404 });
  assert.equal(missingDetail.error.code, 'task_not_found');
  assert.match(missingDetail.error.message, /missing-task/);
} finally {
  await server.stop();
}

async function getJson(url, options = {}) {
  return await new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        const expectedStatus = options.expectStatus ?? 200;
        if (response.statusCode !== expectedStatus) {
          reject(new Error(`Expected HTTP ${expectedStatus}, got ${response.statusCode}: ${body}`));
          return;
        }
        resolve(JSON.parse(body));
      });
    }).on('error', reject);
  });
}
