import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpServer } from '../dist/server.js';
import { TaskIntakeStore } from '../dist/task-intake.js';

// This verifier protects the handoff from "deployment should be checked" to
// "deployment proof is recorded." The receipt is local state only: it can record
// a Pages success, failure, or explicit operator waiver, but it must not create
// deployments, rerun GitHub Actions, or pull local Git.

const BASE_URL = 'http://127.0.0.1:8210';
const tempRoot = await mkdir(join(tmpdir(), `symphony-deployment-evidence-${Date.now()}`), { recursive: true });
const storePath = join(tempRoot, 'task-drafts.json');
const handoffId = 'handoff-deployment-evidence';

await writeFile(storePath, JSON.stringify({
  drafts: [],
  gitDisposition: [],
  taskNudges: [],
  handoffs: [{
    id: handoffId,
    draftId: 'draft-deployment-evidence',
    title: 'Deployment evidence proof handoff',
    executor: 'jules',
    status: 'sent_to_jules',
    prompt: 'Prove deployment evidence recording.',
    expectedFiles: ['conductor/symphony/src/server.ts'],
    verificationCommands: ['npm run verify:jules-contract'],
    createdAt: '2026-05-20T02:00:00.000Z',
    updatedAt: '2026-05-20T02:01:00.000Z',
    gitPreflight: null,
    baseCommitDrift: null,
    runId: 'run-deployment-evidence',
    manifestPath: '.jules/runs/run-deployment-evidence/manifest.json',
    launchCommand: null,
    launchOutput: null,
    launchError: null,
    launchedAt: '2026-05-20T02:02:00.000Z',
    statusCommand: null,
    reviewCommand: null,
    pullCommand: null,
    recordsPath: null,
    lastStatusRefreshAt: '2026-05-20T02:03:00.000Z',
    julesSessionId: '4101281510355198885',
    julesSessionUrl: 'https://jules.google.com/session/4101281510355198885',
    julesState: 'COMPLETED',
    linearIssueId: null,
    linearIssueIdentifier: 'ARA-DEPLOY',
    linearIssueUrl: 'https://linear.app/aralia/issue/ARA-DEPLOY/example',
    linearIssueCreatedAt: '2026-05-20T02:01:00.000Z',
    githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/932',
    githubPullRequestState: 'MERGED',
    githubPullRequestIsDraft: false,
    githubPullRequestMergeable: 'MERGEABLE',
    githubPullRequestReviewDecision: 'APPROVED',
    githubPullRequestHeadRef: 'jules/deployment-proof',
    githubPullRequestBaseRef: 'master',
    githubPullRequestChecks: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0, unknown: 0, conclusion: 'passing', artifacts: [] },
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
    repairPushReadiness: null,
    deploymentEvidence: null,
    githubPullRequestRefreshError: null,
    lastPullRequestRefreshAt: '2026-05-20T02:04:00.000Z',
    pullRequestViewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/932',
    pullRequestChecksCommand: 'gh pr checks https://github.com/Gambitnl/Aralia/pull/932',
    pullRequestMergeCommand: 'gh pr merge https://github.com/Gambitnl/Aralia/pull/932 --squash --delete-branch',
    scoutReviewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/932 --comments --files',
    coreValidationCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/932 --json state,isDraft,mergeable,reviewDecision,statusCheckRollup,files',
    coreMergeCommand: 'gh pr merge https://github.com/Gambitnl/Aralia/pull/932 --squash --delete-branch',
    localSyncCommand: 'git pull --ff-only origin master',
    localSyncStatus: {
      safeToPull: true,
      upToDate: false,
      checkedAt: '2026-05-20T02:05:00.000Z',
      repoRoot: process.cwd(),
      baseBranch: 'master',
      remoteBranch: 'origin/master',
      currentBranch: 'master',
      localCommit: 'base',
      remoteCommit: 'merged',
      ahead: 0,
      behind: 1,
      dirtyFiles: 0,
      untrackedFiles: 0,
      blockers: [],
      remediation: [],
      summary: 'Local master can fast-forward to origin/master.',
      details: [],
      pullCommand: 'git pull --ff-only origin master',
      nextAction: {
        code: 'sync_local_master',
        tone: 'ready',
        label: 'Sync Local Master',
        command: 'git pull --ff-only origin master',
        summary: 'master can fast-forward from GitHub.',
        steps: ['Run the guarded fast-forward command.'],
      },
    },
    localSyncOutput: null,
    localSyncError: null,
    lastLocalSyncAt: null,
    operatorMessages: [],
    planApprovals: [],
  }],
}, null, 2));

const logger = {
  child() { return logger; },
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
      generated_at: '2026-05-20T02:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: BASE_URL },
    };
  },
};

const store = new TaskIntakeStore({
  repoRoot: process.cwd(),
  storePath,
  baseBranch: 'master',
  remoteName: 'origin',
});
const server = new HttpServer(8210, orchestrator, logger);
server.taskIntake = store;

try {
  await server.start();

  const before = await getJson(`${BASE_URL}/api/v1/task-drafts`);
  assert.equal(before.handoffs[0].deployment_readiness.status, 'needs_check');
  assert.equal(before.handoffs[0].deployment_readiness.canProceedToLocalSync, false);
  assert.equal(before.handoffs[0].local_sync_readiness.canSyncNow, false);
  assert.match(before.handoffs[0].local_sync_readiness.blockers.join(' '), /Deployment proof or operator waiver/);

  const after = await postJson(`${BASE_URL}/api/v1/jules-handoffs/${handoffId}/deployment-evidence`, {
    status: 'passed',
    source: 'github_pages_latest_build',
    evidenceUrl: 'https://github.com/Gambitnl/Aralia/deployments/github-pages',
    summary: 'GitHub Pages deployment completed successfully for the merged PR.',
  });
  const handoff = after.handoffs[0];
  assert.equal(handoff.deploymentEvidence.status, 'passed');
  assert.equal(handoff.deploymentEvidence.mutatesExternalSystems, false);
  assert.equal(handoff.deploymentEvidence.mutatesLocalFiles, false);
  assert.equal(handoff.deployment_readiness.status, 'passed');
  assert.equal(handoff.deployment_readiness.canProceedToLocalSync, true);
  assert.equal(handoff.local_sync_readiness.canSyncNow, true);

  const persisted = JSON.parse(await readFile(storePath, 'utf8'));
  assert.equal(persisted.handoffs[0].deploymentEvidence.status, 'passed');

  const dashboard = await readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8');
  assert.match(dashboard, /record-deployment-evidence/);
  assert.match(dashboard, /Record Deployment Evidence/);
  assert.match(dashboard, /deployment-evidence/);
} finally {
  await server.stop();
  await rm(tempRoot, { recursive: true, force: true });
}

async function postJson(url, payload) {
  return JSON.parse(await new Promise((resolve, reject) => {
    const request = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}: ${body}`));
          return;
        }
        resolve(body);
      });
    });
    request.on('error', reject);
    request.end(JSON.stringify(payload));
  }));
}

async function getJson(url) {
  return JSON.parse(await new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}: ${body}`));
          return;
        }
        resolve(body);
      });
    }).on('error', reject);
  }));
}
