import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the staged-handoff launch readiness packet.
//
// Once a manifest is staged, the next boundary is a real Jules cloud launch.
// Symphony needs a read-only packet that names the launch command, the exact
// GitHub base, what will mutate if the operator launches, and what proof must
// appear after launch. Without that packet, the dashboard has a button but not
// a foreman-grade launch contract.

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
  checkedAt: '2026-05-17T00:00:00.000Z',
  repoRoot: 'F:\\Repos\\Aralia',
  baseBranch: 'master',
  remoteBranch: 'origin/master',
  currentBranch: 'master',
  localCommit: 'launchbase',
  remoteCommit: 'launchbase',
  ahead: 0,
  behind: 0,
  dirtyFiles: 0,
  untrackedFiles: 0,
  blockers: [],
  summary: 'Ready: master matches origin/master and the working tree is clean.',
  details: [],
  dirtyFileSamples: [],
  untrackedFileSamples: [],
  remediation: [],
  nextAction: {
    code: 'ready_for_jules',
    tone: 'ready',
    label: 'GitHub Sync Ready',
    command: null,
    summary: 'GitHub sync is ready.',
    steps: ['Launch Jules from the staged manifest.'],
  },
  commands: {},
};

const stagedHandoff = {
  id: 'handoff-launch-ready',
  draftId: 'draft-launch-ready',
  title: 'Launch readiness proof',
  executor: 'jules',
  status: 'manifest_ready',
  prompt: 'Launch Jules only from the staged manifest.',
  expectedFiles: ['conductor/symphony/src/task-intake.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:01:00.000Z',
  gitPreflight: cleanPreflight,
  baseCommitDrift: null,
  runId: 'symphony-handoff-launch-ready',
  manifestPath: 'F:\\Repos\\Aralia\\.jules\\runs\\symphony-handoff-launch-ready\\manifest.json',
  launchCommand: 'npx tsx .jules/orchestrator/cli.ts launch .jules/runs/symphony-handoff-launch-ready/manifest.json',
  launchOutput: null,
  launchError: null,
  launchedAt: null,
  statusCommand: 'npx tsx .jules/orchestrator/cli.ts status .jules/runs/symphony-handoff-launch-ready/manifest.json',
  reviewCommand: 'npx tsx .jules/orchestrator/cli.ts review .jules/runs/symphony-handoff-launch-ready/manifest.json',
  pullCommand: null,
  recordsPath: 'F:\\Repos\\Aralia\\.jules\\runs\\symphony-handoff-launch-ready\\records.json',
  lastStatusRefreshAt: null,
  julesSessionId: null,
  julesSessionUrl: null,
  julesState: null,
  linearIssueId: 'lin-launch',
  linearIssueIdentifier: 'ARA-777',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARA-777/launch-readiness-proof',
  linearIssueCreatedAt: '2026-05-17T00:00:30.000Z',
  githubPullRequestUrl: null,
  githubPullRequestState: null,
  githubPullRequestIsDraft: null,
  githubPullRequestMergeable: null,
  githubPullRequestReviewDecision: null,
  githubPullRequestHeadRef: null,
  githubPullRequestBaseRef: null,
  githubPullRequestChecks: null,
  githubPullRequestFiles: null,
  githubPullRequestFeedback: null,
  githubPullRequestNextAction: null,
  githubPullRequestRefreshError: null,
  lastPullRequestRefreshAt: null,
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
};

const launchedHandoff = {
  ...stagedHandoff,
  id: 'handoff-launched',
  status: 'sent_to_jules',
  launchedAt: '2026-05-17T00:02:00.000Z',
  julesSessionId: 'jules-session-777',
  julesSessionUrl: 'https://jules.google/session/777',
  julesState: 'AWAITING_PLAN_APPROVAL',
};

const orchestrator = {
  getConfig() {
    return { tracker: { kind: 'linear', apiKey: 'linear-test-key', projectSlug: 'aralia-jules' } };
  },
  getDashboardBaseUrl() {
    return 'http://127.0.0.1:8202';
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-17T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: 'http://127.0.0.1:8202' },
    };
  },
};

const server = new HttpServer(8202, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [],
      handoffs: [stagedHandoff, launchedHandoff],
      preflight: cleanPreflight,
      gitDisposition: {
        categories: [],
        decidedCount: 0,
        totalRequired: 4,
        readyForHumanSync: false,
        summary: 'No Git disposition decisions are needed while preflight is clean.',
        updatedAt: null,
      },
      gitSyncPlan: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        status: 'ready',
        mutatesGit: false,
        canExecute: false,
        summary: 'GitHub sync gate already passes.',
        requiredDispositions: [],
        blockers: [],
        steps: [],
        executionPacket: {
          packageId: 'git-sync-clean-launch',
          generatedAt: '2026-05-17T00:00:00.000Z',
          status: 'ready',
          mutatesGit: false,
          canExecute: false,
          requiresHumanConfirmation: true,
          summary: 'GitHub sync already passes.',
          requiredDispositions: [],
          blockedReasons: [],
          readOnlyCommands: ['git status --short'],
          mutatingCommands: [],
          verificationCommands: ['git fetch origin'],
          safetyChecklist: ['Continue to Jules launch from the clean GitHub sync gate.'],
          expectedNextProof: 'Launch Jules and capture the session receipt.',
        },
      },
      taskRouting: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        route: 'jules_task',
        subjectId: stagedHandoff.id,
        subjectTitle: stagedHandoff.title,
        summary: 'Manifest is staged; launch Jules or wait for session state.',
        reasons: ['Manifest path is ready.'],
        nextAction: { code: 'send_to_jules', label: 'Launch Jules', detail: 'Launch the staged manifest.', pauseSeconds: 0, nextNudgeAt: null },
        candidates: [],
      },
      taskNudges: {
        total: 0,
        summary: 'No nudges recorded.',
        latest: null,
        recent: [],
        nextNudgeAt: null,
        scheduler: {
          checkedAt: '2026-05-17T00:00:00.000Z',
          status: 'waiting',
          summary: 'No due nudges.',
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

  const queue = await getJson('http://127.0.0.1:8202/api/v1/task-drafts');
  const ready = queue.handoffs.find(handoff => handoff.id === 'handoff-launch-ready');
  assert.equal(ready.links.launchReadiness, 'http://127.0.0.1:8202/api/v1/jules-handoffs/handoff-launch-ready/launch-readiness');
  assert.equal(ready.launch_readiness.status, 'ready');
  assert.equal(ready.launch_readiness.canLaunchNow, true);
  assert.equal(ready.launch_readiness.mutatesExternalSystemsIfRun, true);
  assert.equal(ready.launch_readiness.mutatesLocalFilesIfRun, true);
  assert.equal(ready.launch_readiness.launchCommand, stagedHandoff.launchCommand);
  assert.equal(ready.launch_readiness.base.branch, 'origin/master');
  assert.equal(ready.launch_readiness.base.commit, 'launchbase');
  assert.equal(ready.launch_readiness.linearIssue.identifier, 'ARA-777');
  assert.equal(ready.launch_readiness.expectedNextProof, 'Jules session receipt with session id, session URL, state, launch timestamp, and status refresh command.');
  assert.deepEqual(ready.launch_readiness.blockers, []);
  assert.ok(ready.launch_readiness.safetyChecklist.some(item => /Review the staged manifest/i.test(item)));
  assert.ok(ready.launch_readiness.safetyChecklist.some(item => /Refresh Jules status/i.test(item)));

  const launched = queue.handoffs.find(handoff => handoff.id === 'handoff-launched');
  assert.equal(launched.launch_readiness.status, 'launched');
  assert.equal(launched.launch_readiness.canLaunchNow, false);
  assert.equal(launched.launch_readiness.mutatesLocalFilesIfRun, false);
  assert.equal(launched.launch_readiness.sessionReceipt.sessionId, 'jules-session-777');
  assert.equal(launched.launch_readiness.sessionReceipt.state, 'AWAITING_PLAN_APPROVAL');
  assert.equal(launched.launch_readiness.expectedNextProof, 'Refresh Jules status, approve the plan if requested, or wait for the PR/session boundary.');

  const endpoint = await getJson('http://127.0.0.1:8202/api/v1/jules-handoffs/handoff-launch-ready/launch-readiness');
  assert.equal(endpoint.handoffId, 'handoff-launch-ready');
  assert.equal(endpoint.canLaunchNow, true);

  const dashboard = await import('node:fs/promises').then(fs => fs.readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8'));
  assert.match(dashboard, /Launch readiness/);
  assert.match(dashboard, /renderJulesLaunchReadiness/);
} finally {
  await server.stop();
}

async function getJson(url) {
  const body = await getText(url);
  return JSON.parse(body);
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
