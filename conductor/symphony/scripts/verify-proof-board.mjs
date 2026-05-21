import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the compact browser proof surface. The full dashboard
// is intentionally rich, but very large pages can make Codex in-app screenshot
// capture fragile. The proof board must reuse the same task-intake state while
// rendering a small page that shows the current blocker, next action, latest
// draft/handoff, and evidence-ledger links.

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
    return 'http://127.0.0.1:8194';
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-17T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: 'http://127.0.0.1:8194' },
    };
  },
};

const server = new HttpServer(8194, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [{
        id: 'draft-proof',
        title: 'Proof board bounded draft',
        body: 'Draft body',
        expectedFiles: ['conductor/symphony/src/server.ts'],
        verificationCommands: ['npm.cmd run verify:jules-contract'],
        executor: 'jules',
        status: 'blocked_by_git_sync',
        linearIssueId: null,
        linearIssueIdentifier: null,
        linearIssueUrl: null,
        linearIssueCreatedAt: null,
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
      }],
      handoffs: [{
        id: 'observed-pr-proof',
        draftId: 'observed-pr:https://github.com/Gambitnl/Aralia/pull/900',
        title: 'Observed PR #900 proof case',
        executor: 'jules',
        status: 'observed_pr',
        prompt: 'Observed PR proof prompt',
        expectedFiles: ['src/hooks/combat/useTargetValidator.ts'],
        verificationCommands: ['gh pr view 900 --repo Gambitnl/Aralia'],
        createdAt: '2026-05-17T00:00:00.000Z',
        updatedAt: '2026-05-17T00:00:00.000Z',
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
        julesSessionId: null,
        julesSessionUrl: null,
        julesState: null,
        linearIssueId: null,
        linearIssueIdentifier: null,
        linearIssueUrl: null,
        linearIssueCreatedAt: null,
        githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/900',
        githubPullRequestState: 'CLOSED',
        githubPullRequestIsDraft: true,
        githubPullRequestMergeable: 'CONFLICTING',
        githubPullRequestReviewDecision: null,
        githubPullRequestHeadRef: 'proof-branch',
        githubPullRequestBaseRef: 'master',
        githubPullRequestChecks: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0, unknown: 0, conclusion: 'unknown', artifacts: [] },
        githubPullRequestFiles: null,
        githubPullRequestFeedback: { totalComments: 1, julesFeedback: [], scoutConflictComments: [], externalReviewComments: [], summary: '1 external review comment(s).' },
        githubPullRequestNextAction: null,
        githubPullRequestRefreshError: null,
        lastPullRequestRefreshAt: '2026-05-17T00:00:00.000Z',
        pullRequestViewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/900',
        pullRequestChecksCommand: 'gh pr checks https://github.com/Gambitnl/Aralia/pull/900',
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
      preflight: {
        ok: false,
        checkedAt: '2026-05-17T00:00:00.000Z',
        repoRoot: 'F:\\Repos\\Aralia',
        baseBranch: 'master',
        remoteBranch: 'origin/master',
        currentBranch: 'master',
        localCommit: 'local',
        remoteCommit: 'remote',
        ahead: 1,
        behind: 7,
        dirtyFiles: 6,
        untrackedFiles: 17,
        blockers: ['6 tracked file(s) have uncommitted changes.', 'master is behind origin/master by 7 commit(s).'],
        summary: 'Blocked: 6 tracked file(s) have uncommitted changes.',
        details: [],
        dirtyFileSamples: [],
        untrackedFileSamples: [],
        resolutionPacket: { commands: {} },
        remediation: [],
        nextAction: { code: 'review_local_changes', tone: 'blocked', label: 'Review Local Changes', command: 'git status --short', summary: 'local changes are present', steps: [] },
        commands: {},
      },
      gitDisposition: {
        categories: [],
        decidedCount: 0,
        totalRequired: 4,
        readyForHumanSync: false,
        summary: 'No Git disposition decisions recorded.',
        updatedAt: null,
      },
      gitSyncPlan: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        status: 'blocked_by_disposition',
        mutatesGit: false,
        canExecute: false,
        summary: 'Human execution plan is blocked.',
        requiredDispositions: ['local_commits', 'tracked_changes', 'untracked_artifacts', 'remote_commits'],
        blockers: ['Local-only commits is not decided.'],
        steps: [],
        executionPacket: {
          packageId: 'git-sync-proof',
          generatedAt: '2026-05-17T00:00:00.000Z',
          status: 'blocked_by_disposition',
          mutatesGit: false,
          canExecute: false,
          requiresHumanConfirmation: true,
          summary: 'Execution packet is blocked.',
          requiredDispositions: ['local_commits'],
          blockedReasons: ['Local-only commits is not decided.'],
          readOnlyCommands: ['git status --short'],
          mutatingCommands: [],
          verificationCommands: ['git fetch origin'],
          expectedNextProof: 'Record dispositions.',
        },
      },
      taskRouting: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        route: 'blocked',
        subjectId: 'draft-proof',
        subjectTitle: 'Proof board bounded draft',
        summary: 'GitHub sync gate is blocked.',
        reasons: ['Blocked: tracked changes.'],
        nextAction: { code: 'wait', label: 'Wait for Git disposition', detail: 'Resolve sync first.', pauseSeconds: 0, nextNudgeAt: null },
        candidates: [],
      },
      taskNudges: {
        total: 1,
        summary: 'One nudge recorded.',
        latest: null,
        recent: [],
        nextNudgeAt: null,
        scheduler: {
          checkedAt: '2026-05-17T00:00:00.000Z',
          status: 'blocked',
          summary: '1 operator-blocked nudge.',
          dueCount: 0,
          waitingCount: 0,
          blockedCount: 1,
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
  const html = await getText('http://127.0.0.1:8194/proof');

  assert.match(html, /Symphony Proof Board/);
  assert.match(html, /Middleman Path/);
  assert.match(html, /Current boundary: GitHub sync/);
  assert.match(html, /Foreman action: Resolve Git disposition before Linear\/Jules/);
  assert.match(html, /Safety: operator_only/);
  assert.match(html, /Browser Follow-along/);
  assert.match(html, /Codex Browser plugin bridge/);
  assert.match(html, /Use the Codex Browser plugin in-app bridge for live Jules follow-along/);
  assert.match(html, /not as proof that the Jules session cannot be observed/);
  assert.match(html, /Known unreliable path: Direct Playwright MCP transport can report Transport closed/);
  assert.match(html, /Browser tooling health JSON/);
  assert.match(html, /Jules Environment Setup/);
  assert.match(html, /package2_scoped_snapshot_passed/);
  assert.match(html, /Package 2 scoped setup passed/);
  assert.match(html, /Recommended snapshot script/);
  assert.match(html, /npm ci --no-audit --no-fund &amp;&amp; npm run validate:spells &amp;&amp; npx vitest run src\/utils\/combat\/__tests__\/combatUtils_\*\.test\.ts --reporter=verbose/);
  assert.match(html, /Submit Package 2 Symphony task draft can run now: yes/);
  assert.match(html, /Environment setup JSON/);
  assert.match(html, /GitHub sync: blocked/);
  assert.match(html, /Review Local Changes/);
  assert.match(html, /Proof board bounded draft/);
  assert.match(html, /Observed PR #900 proof case/);
  assert.match(html, /Record Observed Learning/);
  assert.match(html, /Human execution plan is blocked/);
  assert.match(html, /conductor\/symphony\/docs\/JULES_MIDDLEMAN_OPERATING_SPEC\.md/);
  assert.match(html, /conductor\/symphony\/JULES_MIDDLEMAN_AUDIT\.md/);
  assert.match(html, /proof-board-2026-05-17/);
  assert.doesNotMatch(html, /<script/i, 'Proof board should stay small and server-rendered for screenshot reliability.');
} finally {
  await server.stop();
}

async function getText(url) {
  return await new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}: ${body}`));
          return;
        }
        resolve(body);
      });
    }).on('error', reject);
  });
}
