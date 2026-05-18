import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the final return path from Jules/GitHub into the
// operator's local checkout. Local sync is the riskiest dashboard mutation
// because it can pull cloud work into master, so the API needs one read-only
// packet that separates proof, refresh, and the guarded fast-forward action.

const BASE_URL = 'http://127.0.0.1:8205';

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
  id: 'handoff-local-sync',
  draftId: 'draft-local-sync',
  title: 'Local sync proof handoff',
  executor: 'jules',
  status: 'sent_to_jules',
  prompt: 'Prove safe local sync.',
  expectedFiles: ['conductor/symphony/src/server.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:01:00.000Z',
  gitPreflight: cleanPreflight,
  baseCommitDrift: null,
  runId: 'run-local-sync',
  manifestPath: '.jules/runs/run-local-sync/manifest.json',
  launchCommand: 'npx tsx .jules/orchestrator/cli.ts launch .jules/runs/run-local-sync/manifest.json',
  launchOutput: null,
  launchError: null,
  launchedAt: '2026-05-17T00:02:00.000Z',
  statusCommand: 'npx tsx .jules/orchestrator/cli.ts status run-local-sync',
  reviewCommand: null,
  pullCommand: null,
  recordsPath: '.jules/runs/run-local-sync',
  lastStatusRefreshAt: '2026-05-17T00:03:00.000Z',
  julesSessionId: 'jules-session-local-sync',
  julesSessionUrl: 'https://jules.google.com/session/jules-session-local-sync',
  julesState: 'COMPLETED',
  linearIssueId: 'lin-local-sync',
  linearIssueIdentifier: 'ARALIA-202',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARALIA-202/local-sync-proof',
  linearIssueCreatedAt: '2026-05-17T00:01:00.000Z',
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/902',
  githubPullRequestState: 'MERGED',
  githubPullRequestIsDraft: false,
  githubPullRequestMergeable: 'MERGEABLE',
  githubPullRequestReviewDecision: 'APPROVED',
  githubPullRequestHeadRef: 'jules/local-sync-proof',
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
  githubPullRequestFiles: {
    total: 1,
    additions: 20,
    deletions: 4,
    risk: 'low',
    riskReasons: [],
    scopeFiles: ['conductor/symphony/src/server.ts'],
    outOfScopeFiles: [],
    files: [],
  },
  githubPullRequestFeedback: {
    totalComments: 0,
    julesFeedback: [],
    scoutConflictComments: [],
    externalReviewComments: [],
    summary: '0 Jules feedback comment(s), 0 Scout conflict comment(s), 0 external review comment(s).',
  },
  githubPullRequestNextAction: null,
  githubPullRequestRefreshError: null,
  lastPullRequestRefreshAt: '2026-05-17T00:04:00.000Z',
  pullRequestViewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/902',
  pullRequestChecksCommand: 'gh pr checks https://github.com/Gambitnl/Aralia/pull/902',
  pullRequestMergeCommand: 'gh pr merge https://github.com/Gambitnl/Aralia/pull/902 --squash --delete-branch',
  scoutReviewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/902 --comments --files',
  coreValidationCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/902 --json state,isDraft,mergeable,reviewDecision,statusCheckRollup,files',
  coreMergeCommand: 'gh pr merge https://github.com/Gambitnl/Aralia/pull/902 --squash --delete-branch',
  localSyncCommand: 'git pull --ff-only origin master',
  localSyncStatus: null,
  localSyncOutput: null,
  localSyncError: null,
  lastLocalSyncAt: null,
  operatorMessages: [],
  planApprovals: [],
};

const safeHandoff = {
  ...baseHandoff,
  localSyncStatus: localSyncStatus({
    safeToPull: true,
    upToDate: false,
    behind: 1,
    summary: 'Local master can fast-forward to origin/master.',
    blockers: [],
    nextAction: {
      code: 'sync_local_master',
      tone: 'ready',
      label: 'Sync Local Master',
      command: 'git pull --ff-only origin master',
      summary: 'master can fast-forward from GitHub.',
      steps: ['Run the guarded fast-forward command.'],
    },
  }),
};

const blockedHandoff = {
  ...baseHandoff,
  id: 'handoff-local-sync-blocked',
  title: 'Blocked local sync proof handoff',
  localSyncStatus: localSyncStatus({
    safeToPull: false,
    upToDate: false,
    dirtyFiles: 2,
    untrackedFiles: 1,
    summary: 'Local master has uncommitted work.',
    blockers: ['2 tracked file(s) have uncommitted changes.', '1 untracked file(s) are present.'],
    nextAction: {
      code: 'review_local_changes',
      tone: 'blocked',
      label: 'Review Local Changes',
      command: null,
      summary: 'local changes are present.',
      steps: ['Review tracked and untracked files.'],
    },
  }),
};

const observedHandoff = {
  ...safeHandoff,
  id: 'handoff-local-sync-observed',
  title: 'Observed PR local sync proof handoff',
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
      generated_at: '2026-05-17T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: BASE_URL },
    };
  },
};

let handoffs = [safeHandoff, blockedHandoff, observedHandoff];
const server = new HttpServer(8205, orchestrator, logger);
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
        generatedAt: '2026-05-17T00:00:00.000Z',
        status: 'ready',
        mutatesGit: false,
        canExecute: false,
        summary: 'GitHub sync is already clean.',
        requiredDispositions: [],
        blockers: [],
        steps: [],
        executionPacket: {
          packageId: 'local-sync-proof',
          generatedAt: '2026-05-17T00:00:00.000Z',
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
          safetyChecklist: ['Inspect local sync before pulling.'],
          expectedNextProof: 'Local sync readiness packet.',
        },
      },
      taskRouting: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        route: 'wait_external',
        subjectId: safeHandoff.id,
        subjectTitle: safeHandoff.title,
        summary: 'Waiting for local sync.',
        reasons: [],
        nextAction: { code: 'wait', label: 'Wait', detail: 'Wait for local sync.', pauseSeconds: 0, nextNudgeAt: null },
        candidates: [],
      },
      taskNudges: {
        total: 0,
        summary: 'No durable nudge evidence recorded yet.',
        latest: null,
        recent: [],
        nextNudgeAt: null,
        scheduler: {
          checkedAt: '2026-05-17T00:00:00.000Z',
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
  const [safe, blocked, observed] = snapshot.handoffs;

  assert.equal(safe.local_sync_readiness.status, 'ready');
  assert.equal(safe.local_sync_readiness.canSyncNow, true);
  assert.equal(safe.local_sync_readiness.mutatesGitIfRun, true);
  assert.equal(safe.local_sync_readiness.mutatesLocalFilesIfRun, true);
  assert.equal(safe.local_sync_readiness.refreshUrl, `${BASE_URL}/api/v1/jules-handoffs/handoff-local-sync/refresh-local-sync`);
  assert.equal(safe.local_sync_readiness.syncUrl, `${BASE_URL}/api/v1/jules-handoffs/handoff-local-sync/sync-local`);
  assert.equal(safe.local_sync_readiness.evidence.localCommit, 'base');
  assert.equal(safe.local_sync_readiness.expectedNextProof, 'Fast-forward receipt, refreshed GitHub sync preflight, and updated local commit.');

  assert.equal(blocked.local_sync_readiness.status, 'blocked');
  assert.equal(blocked.local_sync_readiness.canSyncNow, false);
  assert.equal(blocked.local_sync_readiness.syncUrl, null);
  assert.equal(blocked.local_sync_readiness.refreshUrl, `${BASE_URL}/api/v1/jules-handoffs/handoff-local-sync-blocked/refresh-local-sync`);
  assert.equal(blocked.local_sync_readiness.mutatesGitIfRun, false);
  assert.match(blocked.local_sync_readiness.blockers.join(' '), /tracked file/);
  assert.equal(blocked.local_sync_readiness.nextAction.code, 'review_local_changes');

  assert.equal(observed.local_sync_readiness.status, 'observed');
  assert.equal(observed.local_sync_readiness.canSyncNow, false);
  assert.equal(observed.local_sync_readiness.syncUrl, null);
  assert.match(observed.local_sync_readiness.blockers.join(' '), /Observed PR records are read-only/);

  const proof = await getText(`${BASE_URL}/proof`);
  assert.match(proof, /Local Sync Readiness/);
  assert.match(proof, /Fast-forward receipt, refreshed GitHub sync preflight, and updated local commit/);
  assert.match(proof, /Observed PR records are read-only/);
  assert.doesNotMatch(proof, /<script/i);
} finally {
  await server.stop();
}

function localSyncStatus(input) {
  return {
    safeToPull: input.safeToPull,
    upToDate: input.upToDate,
    checkedAt: '2026-05-17T00:05:00.000Z',
    repoRoot: 'F:\\Repos\\Aralia',
    baseBranch: 'master',
    remoteBranch: 'origin/master',
    currentBranch: 'master',
    localCommit: 'base',
    remoteCommit: 'merged',
    ahead: input.ahead ?? 0,
    behind: input.behind ?? 0,
    dirtyFiles: input.dirtyFiles ?? 0,
    untrackedFiles: input.untrackedFiles ?? 0,
    blockers: input.blockers,
    remediation: input.blockers.length ? ['Resolve local checkout state.', 'Re-run Check Local Sync.'] : [],
    summary: input.summary,
    details: [],
    pullCommand: 'git pull --ff-only origin master',
    nextAction: input.nextAction,
  };
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
