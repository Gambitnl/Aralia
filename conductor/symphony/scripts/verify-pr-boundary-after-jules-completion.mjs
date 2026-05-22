import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the dashboard-first route after Jules has returned a
// PR. Once a PR URL exists, the global foreman boundary must move forward to
// PR review/check repair. It should not keep sending the operator back to the
// old Jules-status refresh just because the Jules session still has a receipt.

const BASE_URL = 'http://127.0.0.1:8211';
const generatedAt = '2026-05-22T00:00:00.000Z';

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
      codex_totals: { input_tokens: 0, output_tokens: 0, total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: BASE_URL },
    };
  },
};

const handoff = {
  id: 'handoff-pr-returned',
  draftId: 'draft-pr-returned',
  title: 'Jules handoff with PR and failed checks',
  executor: 'jules',
  status: 'sent_to_jules',
  prompt: 'Return a PR and let Scout/Core review it.',
  expectedFiles: ['public/premade-characters/*.json'],
  verificationCommands: ['npm run validate:spells'],
  createdAt: generatedAt,
  updatedAt: generatedAt,
  gitPreflight: null,
  baseCommitDrift: null,
  runId: 'run-pr-returned',
  manifestPath: '.jules/runs/run-pr-returned/manifest.json',
  launchCommand: 'npx tsx .jules/orchestrator/cli.ts launch .jules/runs/run-pr-returned/manifest.json',
  launchOutput: null,
  launchError: null,
  launchedAt: generatedAt,
  statusCommand: 'npx tsx .jules/orchestrator/cli.ts status run-pr-returned',
  reviewCommand: null,
  pullCommand: null,
  recordsPath: '.jules/runs/run-pr-returned',
  lastStatusRefreshAt: generatedAt,
  julesSessionId: '15527431301408060204',
  julesSessionUrl: 'https://jules.google.com/session/15527431301408060204',
  julesState: 'COMPLETED',
  linearIssueId: 'linear-pr-returned',
  linearIssueIdentifier: 'ARA-7',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARA-7/example',
  linearIssueCreatedAt: generatedAt,
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/935',
  githubPullRequestState: 'OPEN',
  githubPullRequestIsDraft: false,
  githubPullRequestMergeable: 'MERGEABLE',
  githubPullRequestReviewDecision: null,
  githubPullRequestHeadRef: 'jules/example',
  githubPullRequestBaseRef: 'master',
  githubPullRequestChecks: {
    conclusion: 'failing',
    total: 2,
    passed: 0,
    failed: 2,
    pending: 0,
    skipped: 0,
    unknown: 0,
    artifacts: [],
    blockers: [{
      category: 'workflow_config',
      severity: 'blocking',
      checkNames: ['review / review'],
      evidence: ['Review automation failed before task code feedback was useful.'],
      summary: 'Workflow configuration failed.',
      nextAction: 'Repair workflow configuration.',
      mutatesExternalSystems: false,
    }],
  },
  githubPullRequestFiles: { risk: 'medium', riskReasons: ['Large diff.'], outOfScopeFiles: [] },
  githubPullRequestFeedback: null,
  githubPullRequestNextAction: null,
  githubPullRequestRefreshError: null,
  lastPullRequestRefreshAt: generatedAt,
  pullRequestViewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/935',
  pullRequestChecksCommand: 'gh pr checks https://github.com/Gambitnl/Aralia/pull/935',
  pullRequestMergeCommand: 'gh pr merge https://github.com/Gambitnl/Aralia/pull/935 --squash',
  scoutReviewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/935 --comments --files',
  coreValidationCommand: null,
  coreMergeCommand: null,
  localSyncCommand: null,
  localSyncStatus: null,
  localSyncOutput: null,
  localSyncError: null,
  lastLocalSyncAt: null,
  operatorMessages: [],
  planApprovals: [],
  repairPushReadiness: null,
  repairPushResult: null,
  operatorQuestion: null,
  operatorAnswers: [],
  handoffTimeline: null,
  next_action: null,
};

const server = new HttpServer(8211, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [],
      handoffs: [handoff],
      preflight: {
        ok: false,
        checkedAt: generatedAt,
        repoRoot: 'F:\\Repos\\Aralia',
        baseBranch: 'master',
        remoteBranch: 'origin/master',
        currentBranch: 'codex/dashboard-proof',
        localCommit: 'local',
        remoteCommit: 'remote',
        ahead: 3,
        behind: 0,
        dirtyFiles: 0,
        untrackedFiles: 0,
        blockers: ['Current branch has unpublished dashboard proof commits.'],
        summary: 'GitHub sync gate is blocked by local branch commits.',
        details: [],
        dirtyFileSamples: [],
        untrackedFileSamples: [],
        resolutionPacket: { commands: {} },
        remediation: [],
        nextAction: { code: 'review_git_disposition', tone: 'blocked', label: 'Review Git Disposition', command: null, summary: 'Record local branch disposition.', steps: [] },
        commands: {},
      },
      gitDisposition: {
        categories: [],
        decidedCount: 0,
        totalRequired: 0,
        readyForHumanSync: true,
        summary: 'No Git disposition decisions required for this proof.',
        updatedAt: null,
      },
      gitSyncPlan: {
        generatedAt,
        status: 'blocked_by_disposition',
        mutatesGit: false,
        canExecute: false,
        summary: 'Git sync is blocked by local branch commits.',
        requiredDispositions: [],
        blockers: ['Current branch has unpublished dashboard proof commits.'],
        steps: [],
      },
      taskRouting: null,
      taskNudges: null,
    };
  },
};

try {
  await server.start();

  const queue = await getJson(`${BASE_URL}/api/v1/task-drafts`);
  assert.equal(queue.middleman_path.currentBoundary, 'github_pr');
  assert.equal(queue.middleman_path.currentBoundaryLabel, 'GitHub PR');
  assert.equal(queue.middleman_path.foremanAction.label, 'Run GitHub PR');
  assert.equal(queue.middleman_path.foremanAction.safety, 'external_read');
  assert.equal(queue.middleman_path.foremanAction.endpoint, `${BASE_URL}/api/v1/jules-handoffs/handoff-pr-returned/refresh-pr`);

  const julesStage = queue.middleman_path.stages.find(stage => stage.id === 'jules_session');
  assert.equal(julesStage.status, 'complete');
} finally {
  await server.stop();
}

async function getJson(url) {
  return JSON.parse(await getText(url));
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
