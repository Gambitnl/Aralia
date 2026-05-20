import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { HttpServer } from '../dist/server.js';

// This verifier protects the deployment gate between a merged Jules PR and the
// local sync button. The packet is intentionally read-only: it tells the
// operator where to inspect GitHub Pages/deployment state before local master is
// treated as fully returned, but it does not create deployments or pull Git.

const BASE_URL = 'http://127.0.0.1:8209';

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const cleanPreflight = {
  ok: true,
  checkedAt: '2026-05-20T00:00:00.000Z',
  repoRoot: 'F:\\Repos\\Aralia',
  baseBranch: 'master',
  remoteBranch: 'origin/master',
  currentBranch: 'master',
  localCommit: 'base',
  remoteCommit: 'base',
  ahead: 0,
  behind: 0,
  dirtyFiles: 0,
  untrackedFiles: 0,
  blockers: [],
  summary: 'GitHub sync gate passes.',
  details: [],
  dirtyFileSamples: [],
  untrackedFileSamples: [],
  resolutionPacket: { commands: {} },
  remediation: [],
  nextAction: {
    code: 'ready_for_jules',
    tone: 'ready',
    label: 'GitHub Sync Ready',
    command: null,
    summary: 'master matches origin/master.',
    steps: [],
  },
  commands: {},
};

const baseHandoff = {
  id: 'handoff-deployment',
  draftId: 'draft-deployment',
  title: 'Deployment readiness proof handoff',
  executor: 'jules',
  status: 'sent_to_jules',
  prompt: 'Prove the deployment gate.',
  expectedFiles: ['conductor/symphony/src/server.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  createdAt: '2026-05-20T00:00:00.000Z',
  updatedAt: '2026-05-20T00:01:00.000Z',
  gitPreflight: cleanPreflight,
  baseCommitDrift: null,
  runId: 'run-deployment',
  manifestPath: '.jules/runs/run-deployment/manifest.json',
  launchCommand: 'npx tsx .jules/orchestrator/cli.ts launch .jules/runs/run-deployment/manifest.json',
  launchOutput: null,
  launchError: null,
  launchedAt: '2026-05-20T00:02:00.000Z',
  statusCommand: 'npx tsx .jules/orchestrator/cli.ts status run-deployment',
  reviewCommand: null,
  pullCommand: null,
  recordsPath: '.jules/runs/run-deployment',
  lastStatusRefreshAt: '2026-05-20T00:03:00.000Z',
  julesSessionId: 'jules-session-deployment',
  julesSessionUrl: 'https://jules.google.com/session/jules-session-deployment',
  julesState: 'COMPLETED',
  linearIssueId: 'lin-deployment',
  linearIssueIdentifier: 'ARA-DEPLOY',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARA-DEPLOY/deployment-readiness-proof',
  linearIssueCreatedAt: '2026-05-20T00:01:00.000Z',
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/932',
  githubPullRequestState: 'MERGED',
  githubPullRequestIsDraft: false,
  githubPullRequestMergeable: 'MERGEABLE',
  githubPullRequestReviewDecision: 'APPROVED',
  githubPullRequestHeadRef: 'jules/deployment-proof',
  githubPullRequestBaseRef: 'master',
  githubPullRequestChecks: {
    total: 1,
    passed: 1,
    failed: 0,
    pending: 0,
    skipped: 0,
    unknown: 0,
    conclusion: 'passing',
    artifacts: [],
  },
  githubPullRequestFiles: null,
  githubPullRequestFeedback: null,
  githubPullRequestNextAction: null,
  githubPullRequestRefreshError: null,
  lastPullRequestRefreshAt: '2026-05-20T00:04:00.000Z',
  pullRequestViewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/932',
  pullRequestChecksCommand: 'gh pr checks https://github.com/Gambitnl/Aralia/pull/932',
  pullRequestMergeCommand: 'gh pr merge https://github.com/Gambitnl/Aralia/pull/932 --squash --delete-branch',
  scoutReviewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/932 --comments --files',
  coreValidationCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/932 --json state,isDraft,mergeable,reviewDecision,statusCheckRollup,files',
  coreMergeCommand: 'gh pr merge https://github.com/Gambitnl/Aralia/pull/932 --squash --delete-branch',
  localSyncCommand: 'git pull --ff-only origin master',
  localSyncStatus: null,
  localSyncOutput: null,
  localSyncError: null,
  lastLocalSyncAt: null,
  operatorMessages: [],
  planApprovals: [],
};

const waitingHandoff = {
  ...baseHandoff,
  id: 'handoff-deployment-waiting',
  title: 'Waiting deployment proof handoff',
  githubPullRequestState: 'OPEN',
};

const observedHandoff = {
  ...baseHandoff,
  id: 'handoff-deployment-observed',
  title: 'Observed deployment proof handoff',
  status: 'observed_pr',
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
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: BASE_URL },
    };
  },
};

let handoffs = [baseHandoff, waitingHandoff, observedHandoff];
const server = new HttpServer(8209, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [],
      handoffs,
      preflight: cleanPreflight,
      gitDisposition: {
        categories: [],
        decidedCount: 0,
        totalRequired: 0,
        readyForHumanSync: true,
        summary: 'No Git disposition is required.',
        updatedAt: null,
      },
      gitSyncPlan: {
        generatedAt: '2026-05-20T00:00:00.000Z',
        status: 'ready',
        mutatesGit: false,
        canExecute: false,
        summary: 'GitHub sync is already clean.',
        requiredDispositions: [],
        blockers: [],
        steps: [],
        executionPacket: {
          packageId: 'deployment-proof',
          generatedAt: '2026-05-20T00:00:00.000Z',
          status: 'ready',
          mutatesGit: false,
          canExecute: false,
          requiresHumanConfirmation: true,
          summary: 'No Git sync mutation required.',
          requiredDispositions: [],
          blockedReasons: [],
          readOnlyCommands: ['git status --short'],
          mutatingCommands: [],
          verificationCommands: ['git fetch origin'],
          safetyChecklist: ['Inspect deployment readiness before local sync.'],
          expectedNextProof: 'Deployment readiness packet.',
        },
      },
      taskRouting: {
        generatedAt: '2026-05-20T00:00:00.000Z',
        route: 'wait_external',
        subjectId: baseHandoff.id,
        subjectTitle: baseHandoff.title,
        summary: 'Waiting for deployment readiness.',
        reasons: [],
        nextAction: { code: 'wait', label: 'Wait', detail: 'Wait for deployment readiness.', pauseSeconds: 0, nextNudgeAt: null },
        candidates: [],
      },
      taskNudges: {
        total: 0,
        summary: 'No durable nudge evidence recorded yet.',
        latest: null,
        recent: [],
        nextNudgeAt: null,
        scheduler: {
          checkedAt: '2026-05-20T00:00:00.000Z',
          status: 'idle',
          summary: 'No recorded nudges are scheduled.',
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

  const snapshot = await getJson(`${BASE_URL}/api/v1/task-drafts`);
  const [merged, waiting, observed] = snapshot.handoffs;

  assert.equal(merged.deployment_readiness.status, 'needs_check');
  assert.equal(merged.deployment_readiness.canRefreshNow, true);
  assert.equal(merged.deployment_readiness.canProceedToLocalSync, false);
  assert.equal(merged.deployment_readiness.mutatesExternalSystemsIfRun, false);
  assert.equal(merged.deployment_readiness.mutatesLocalFilesIfRun, false);
  assert.match(merged.deployment_readiness.commands.latestPagesBuild, /gh api repos\/Gambitnl\/Aralia\/pages\/builds\/latest/);
  assert.match(merged.deployment_readiness.commands.recentDeployments, /gh api repos\/Gambitnl\/Aralia\/deployments/);
  assert.match(merged.deployment_readiness.expectedNextProof, /GitHub Pages deployment or latest Pages build/);

  const directReadiness = await getJson(`${BASE_URL}/api/v1/jules-handoffs/${merged.id}/deployment-readiness`);
  assert.equal(directReadiness.handoffId, merged.id);
  assert.equal(directReadiness.status, 'needs_check');
  assert.equal(directReadiness.mutatesExternalSystemsIfRun, false);
  assert.equal(directReadiness.mutatesLocalFilesIfRun, false);
  assert.match(directReadiness.safetyNote, /does not create a GitHub Pages deployment/);

  const taskDetail = await getJson(`${BASE_URL}/api/v1/tasks/${merged.id}`);
  assert.equal(
    taskDetail.links.deploymentReadiness,
    `${BASE_URL}/api/v1/jules-handoffs/${merged.id}/deployment-readiness`,
  );
  assert.equal(taskDetail.deploymentReadiness.status, 'needs_check');

  assert.equal(waiting.deployment_readiness.status, 'waiting_for_merge');
  assert.equal(waiting.deployment_readiness.canRefreshNow, false);
  assert.match(waiting.deployment_readiness.blockers.join(' '), /PR is not merged/);

  assert.equal(observed.deployment_readiness.status, 'observed');
  assert.equal(observed.deployment_readiness.canProceedToLocalSync, false);
  assert.match(observed.deployment_readiness.blockers.join(' '), /Observed PR records are read-only/);

  const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  assert.match(dashboard, /Deployment readiness/);
  assert.match(dashboard, /Latest Pages build/);
  assert.match(dashboard, /Mutates external systems/);

  const proof = await getText(`${BASE_URL}/proof`);
  assert.match(proof, /Deployment Readiness/);
  assert.match(proof, /GitHub Pages deployment or latest Pages build/);
  assert.doesNotMatch(proof, /<script/i);
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
