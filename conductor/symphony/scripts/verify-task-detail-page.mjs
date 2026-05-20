import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the first standalone task page. The page must read
// from the existing single-task detail packet and local task-message endpoint,
// not from a new task store or any external Jules/GitHub/Linear mutation path.

const BASE_URL = 'http://127.0.0.1:8199';
const generatedAt = '2026-05-20T02:00:00.000Z';

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
      generated_at: generatedAt,
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { input_tokens: 3, output_tokens: 5, total_tokens: 8, seconds_running: 13 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: BASE_URL },
    };
  },
};

const server = new HttpServer(8199, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [],
      handoffs: [{
        id: 'handoff-detail-page',
        draftId: 'draft-detail-page',
        title: 'ARA-6 task page proof',
        executor: 'jules',
        status: 'sent_to_jules',
        prompt: 'Show the operator one task workspace without sending Jules feedback.',
        expectedFiles: ['conductor/symphony/src/server.ts', 'conductor/symphony/public/dashboard.css'],
        verificationCommands: ['npm run verify:jules-contract'],
        createdAt: generatedAt,
        updatedAt: generatedAt,
        operatorMessages: [{
          id: 'message-to-jules',
          body: 'Operator note sent to Jules before the PR was ready.',
          sentAt: generatedAt,
          status: 'sent',
        }],
        planApprovals: [{
          id: 'approval-detail-page',
          planId: 'plan-detail-page',
          approvedAt: generatedAt,
          status: 'approved',
        }],
        taskMessages: [{
          id: 'task-message-existing',
          taskId: 'handoff-detail-page',
          taskKind: 'handoff',
          author: 'operator',
          body: 'Keep this message local to Symphony.',
          createdAt: generatedAt,
          source: 'task_chat',
          mutatesExternalSystems: false,
          mutatesLocalFiles: false,
          mutatesGit: false,
        }],
        taskClarifications: [{
          id: 'clarification-existing',
          taskId: 'handoff-detail-page',
          taskKind: 'handoff',
          status: 'waiting_for_operator',
          question: 'Should Jules be allowed to edit CI setup files?',
          answer: null,
          requestedBy: 'codex_foreman',
          answeredBy: null,
          createdAt: generatedAt,
          answeredAt: null,
          source: 'foreman_clarification',
          mutatesExternalSystems: false,
          mutatesLocalFiles: false,
          mutatesGit: false,
        }],
        handoffTimeline: {
          generatedAt,
          summary: 'Timeline events: 2',
          events: [
            { stage: 'jules_launch', label: 'Jules launched', occurredAt: generatedAt, source: 'symphony', status: 'recorded' },
            { stage: 'github_pr', label: 'PR detected', occurredAt: generatedAt, source: 'github', status: 'recorded', url: 'https://github.com/Gambitnl/Aralia/pull/931' },
          ],
        },
        operatorQuestion: {
          status: 'waiting_for_operator',
          plainLanguageQuestion: 'How should Symphony handle the setup blocker?',
          plainLanguageSummary: 'The prepared repair needs a human decision before Symphony crosses a boundary.',
          sourceStage: 'repair_push_approval',
          question: 'How should Symphony handle the setup blocker?',
          choices: [],
          quietHours: { active: false },
        },
        repairPushReadiness: {
          handoffId: 'handoff-detail-page',
          status: 'awaiting_operator_push_approval',
          source: 'local_commit',
          recordedAt: generatedAt,
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
          verificationCommands: ['npm ci --dry-run'],
          verificationSummary: 'Local setup repair passed before push.',
          pushCommand: 'git push origin codex/pr-931-setup-repair:add-regression-coverage-for-non-proficient-weapon-attack-penalties-4101281510355198885',
          canPushNow: false,
          mutatesExternalSystemsIfRun: true,
          mutatesLocalFiles: false,
          postPushFollowUp: {
            refreshEndpoint: '/api/v1/jules-handoffs/handoff-detail-page/refresh-pr',
          },
          nextExpectedProof: 'Operator pushes, GitHub checks rerun, Symphony refreshes PR.',
          summary: 'Local repair is ready for push.',
        },
        repairPushResult: null,
        julesStateReconciliation: {
          status: 'reconciled_from_external_evidence',
          summary: 'Jules API/GitHub evidence found the PR.',
        },
        delegationRoiLedger: {
          status: 'roi_unknown',
          separatesMeasuredFactsFromEstimates: true,
          verdict: 'ROI unknown until measured task-scoped Codex spend and avoided-work estimate are recorded.',
          measuredFacts: {
            codexTokens: { input: null, output: null, total: null, source: 'missing' },
            taskScopedForemanUsage: {
              inputTokens: null,
              outputTokens: null,
              totalTokens: null,
              activeRuntimeSeconds: null,
              foremanTurns: null,
              source: 'missing',
              receiptCount: 0,
            },
            goalContextForemanUsage: {
              inputTokens: null,
              outputTokens: null,
              totalTokens: 1163311,
              activeRuntimeSeconds: null,
              foremanTurns: null,
              source: 'goal_context_foreman_usage',
              receiptCount: 1,
            },
            codexActiveRuntimeSeconds: null,
            codexForemanEventCount: 0,
            julesElapsedSeconds: null,
            githubElapsedSeconds: null,
            humanInterventionCount: 2,
            localCodexEditedProductionFiles: null,
            dataSources: ['goal_context_foreman_usage'],
          },
          estimatedAvoidedCodexWork: {
            status: 'missing_estimate',
            estimatedLocalCodexImplementationTurns: null,
            estimatedLocalCodexTokens: null,
            estimatedDebuggingCycles: null,
            confidence: 'missing',
            method: null,
            caveats: [],
          },
        },
        linearIssueIdentifier: 'ARA-6',
        linearIssueUrl: 'https://linear.app/aralia/issue/ARA-6/example',
        julesSessionId: '4101281510355198885',
        julesSessionUrl: 'https://jules.google.com/session/4101281510355198885',
        julesState: 'COMPLETED',
        githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/931',
        githubPullRequestState: 'OPEN',
        githubPullRequestChecks: { total: 4, passed: 0, failed: 4, pending: 0, skipped: 0, unknown: 0, conclusion: 'failure', artifacts: [] },
        githubPullRequestFeedback: { totalComments: 0, julesFeedback: [], scoutConflictComments: [], externalReviewComments: [], summary: 'No PR feedback recorded.' },
        githubPullRequestNextAction: {
          label: 'Resolve CI Setup Blocker',
          summary: 'Prepare a marked Jules feedback comment if the operator rejects the setup repair.',
          feedbackCommand: 'gh pr comment https://github.com/Gambitnl/Aralia/pull/931 --body-file .jules/feedback/handoff-detail-page-pr-feedback.md',
        },
        next_action: {
          label: 'Resolve CI Setup Blocker',
          summary: 'Repair the setup blocker before judging Jules implementation quality.',
          detail: 'Checks fail before the task regression can be evaluated.',
          endpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-detail-page/refresh-pr`,
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
        summary: 'Ready.',
        details: [],
        dirtyFileSamples: [],
        untrackedFileSamples: [],
        resolutionPacket: { commands: {} },
        remediation: [],
        nextAction: { code: 'ready', tone: 'ready', label: 'Ready', command: null, summary: 'Ready.', steps: [] },
        commands: {},
      },
      gitDisposition: { categories: [], decidedCount: 0, totalRequired: 0, readyForHumanSync: true, summary: 'No decisions.', updatedAt: null },
      gitSyncPlan: { generatedAt, status: 'ready', mutatesGit: false, canExecute: false, summary: 'Ready.', requiredDispositions: [], blockers: [], steps: [] },
      taskRouting: null,
      taskNudges: {
        total: 0,
        summary: 'No nudges.',
        latest: null,
        recent: [],
        nextNudgeAt: null,
        scheduler: { checkedAt: generatedAt, status: 'idle', summary: 'No nudges due.', dueCount: 0, waitingCount: 0, blockedCount: 0, nextDueAt: null, mutatesExternalSystems: false, due: [], waiting: [], blocked: [] },
      },
    };
  },
};

try {
  await server.start();

  const page = await getText(`${BASE_URL}/tasks/handoff-detail-page`);
  assert.match(page.headers['content-type'], /text\/html/);
  assert.match(page.body, /ARA-6 task page proof/);
  assert.match(page.body, /Current Boundary/);
  assert.match(page.body, /Needs human input/);
  assert.match(page.body, /Task Messages/);
  assert.match(page.body, /Author/);
  assert.match(page.body, /Codex foreman/);
  assert.match(page.body, /Record Task Message/);
  assert.match(page.body, /This does not send feedback to Jules/);
  assert.match(page.body, /Keep this message local to Symphony/);
  assert.match(page.body, /Task Clarifications/);
  assert.match(page.body, /Record Clarification/);
  assert.match(page.body, /Should Jules be allowed to edit CI setup files\?/);
  assert.match(page.body, /This does not send feedback to Jules, create Linear work, push to GitHub, or mutate Git/);
  assert.match(page.body, /data-task-clarification-url="http:\/\/127\.0\.0\.1:8199\/api\/v1\/tasks\/handoff-detail-page\/clarifications"/);
  assert.match(page.body, /Guarded Operator Actions/);
  assert.match(page.body, /This section does not run them/);
  assert.match(page.body, /Resolve CI Setup Blocker/);
  assert.match(page.body, /Prepare Jules PR feedback comment/);
  assert.match(page.body, /gh pr comment/);
  assert.match(page.body, /Push prepared repair to PR branch/);
  assert.match(page.body, /Approval Checkpoint/);
  assert.match(page.body, /Operator decision required/);
  assert.match(page.body, /External mutation if run<\/dt><dd>Yes/);
  assert.match(page.body, /Records local proof only<\/dt><dd>Yes/);
  assert.match(page.body, /Decision needed:/);
  assert.match(page.body, /Operator-run command:/);
  assert.match(page.body, /This checkpoint is read-only local guidance|does not approve plans, send Jules feedback, comment on GitHub, push branches, rerun checks, merge, pull, or edit local files/);
  assert.match(page.body, /Operator Answer/);
  assert.match(page.body, /Record Operator Answer/);
  assert.match(page.body, /Approve repair push/);
  assert.match(page.body, /data-task-operator-answer-url="http:\/\/127\.0\.0\.1:8199\/api\/v1\/jules-handoffs\/handoff-detail-page\/operator-answer"/);
  assert.match(page.body, /does not send Jules feedback, create Linear work, push to GitHub, or mutate Git/);
  assert.match(page.body, /Repair Push Result/);
  assert.match(page.body, /Record Repair Push Result/);
  assert.match(page.body, /git -C F:\\Repos\\Aralia\\\.worktrees\\pr-931-setup-repair push origin codex\/pr-931-setup-repair/);
  assert.match(page.body, /data-task-repair-push-result-url="http:\/\/127\.0\.0\.1:8199\/api\/v1\/jules-handoffs\/handoff-detail-page\/repair-push-result"/);
  assert.match(page.body, /This does not push, rerun checks, merge, pull, or edit local files/);
  assert.match(page.body, /Task Filing/);
  assert.match(page.body, /Record Task Filing/);
  assert.match(page.body, /This does not close Linear, message Jules, change GitHub, or mutate Git/);
  assert.match(page.body, /Task Timeline/);
  assert.match(page.body, /Jules launched/);
  assert.match(page.body, /PR detected/);
  assert.match(page.body, /Task Activity Mirror/);
  assert.match(page.body, /View-only terminal-style trail/);
  assert.match(page.body, /does not read terminal scrollback or mutate external systems/);
  assert.match(page.body, /symphony: Jules launched/);
  assert.match(page.body, /Operator: Task message/);
  assert.match(page.body, /Codex foreman: Clarification requested/);
  assert.match(page.body, /Expected Files/);
  assert.match(page.body, /Verification Commands/);
  assert.match(page.body, /Task detail JSON/);
  assert.match(page.body, /Full receipt/);
  assert.match(page.body, /Jules Handoff Prompt/);
  assert.match(page.body, /Show the operator one task workspace without sending Jules feedback/);
  assert.match(page.body, /Jules Dialogue And Approvals/);
  assert.match(page.body, /Operator note sent to Jules before the PR was ready/);
  assert.match(page.body, /plan-detail-page/);
  assert.match(page.body, /Jules State Reconciliation/);
  assert.match(page.body, /ROI Evidence/);
  assert.match(page.body, /Task-scoped foreman receipts<\/dt><dd>0/);
  assert.match(page.body, /Task-scoped foreman tokens<\/dt><dd>Missing/);
  assert.match(page.body, /Goal-context tokens<\/dt><dd>1163311/);
  assert.match(page.body, /Avoided-work estimate<\/dt><dd>missing_estimate/);
  assert.match(page.body, /Missing before any savings claim: task-scoped Codex foreman usage receipt, documented avoided-work estimate/);
  assert.match(page.body, /Goal-context usage documents the broader Codex thread cost only/);
  assert.match(page.body, /Delegation ROI Ledger/);
  assert.match(page.body, /Mutates external systems<\/dt><dd>No/);

  const missing = await getText(`${BASE_URL}/tasks/does-not-exist`, 404);
  assert.match(missing.body, /Task not found/);
} finally {
  await server.stop();
}

function getText(url, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode !== expectedStatus) {
          reject(new Error(`Expected HTTP ${expectedStatus}, got ${response.statusCode}: ${body}`));
          return;
        }

        resolve({ body, headers: response.headers });
      });
    }).on('error', reject);
  });
}
