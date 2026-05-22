import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the future happy path for the global foreman action.
// The live repo is currently blocked at Git disposition, so these synthetic
// snapshots prove the same middleman packet will keep pointing at the right
// boundary, safety class, mutation endpoint, and read-only evidence endpoint
// after the operator clears the local Git gate.

const BASE_URL = 'http://127.0.0.1:8204';

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

const cleanGitDisposition = {
  categories: [],
  decidedCount: 4,
  totalRequired: 4,
  readyForHumanSync: true,
  summary: 'Git disposition is complete.',
  updatedAt: '2026-05-17T00:00:00.000Z',
};

const cleanGitSyncPlan = {
  generatedAt: '2026-05-17T00:00:00.000Z',
  status: 'ready',
  mutatesGit: false,
  canExecute: false,
  summary: 'GitHub sync is already clean.',
  requiredDispositions: [],
  blockers: [],
  steps: [],
  executionPacket: {
    packageId: 'git-sync-pass-path',
    generatedAt: '2026-05-17T00:00:00.000Z',
    status: 'ready',
    mutatesGit: false,
    canExecute: false,
    requiresHumanConfirmation: true,
    summary: 'No Git mutation is required.',
    requiredDispositions: [],
    blockedReasons: [],
    readOnlyCommands: ['git status --short'],
    mutatingCommands: [],
    verificationCommands: ['git fetch origin'],
    safetyChecklist: ['Keep the dashboard as the source of truth.'],
    expectedNextProof: 'Clean GitHub sync preflight.',
  },
};

const taskRouting = {
  generatedAt: '2026-05-17T00:00:00.000Z',
  route: 'jules_task',
  subjectId: 'draft-pass-path',
  subjectTitle: 'Pass-path proof draft',
  summary: 'Synthetic pass-path route.',
  reasons: [],
  nextAction: { code: 'send_to_jules', label: 'Send to Jules', detail: 'Continue the middleman path.', pauseSeconds: 0, nextNudgeAt: null },
  candidates: [],
};

const taskNudges = {
  total: 0,
  summary: 'No durable nudge evidence recorded.',
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
};

const draft = {
  id: 'draft-pass-path',
  title: 'Pass-path proof draft',
  body: 'Small dashboard-first proof task.',
  expectedFiles: ['conductor/symphony/src/server.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  executor: 'jules',
  status: 'ready_for_handoff',
  linearIssueId: null,
  linearIssueIdentifier: null,
  linearIssueUrl: null,
  linearIssueCreatedAt: null,
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:01:00.000Z',
};

const linearDraft = {
  ...draft,
  linearIssueId: 'lin-1',
  linearIssueIdentifier: 'ARALIA-101',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARALIA-101/pass-path-proof',
  linearIssueCreatedAt: '2026-05-17T00:02:00.000Z',
};

const baseHandoff = {
  id: 'handoff-pass-path',
  draftId: draft.id,
  title: 'Pass-path proof handoff',
  executor: 'jules',
  status: 'ready_for_jules',
  prompt: 'Prove the dashboard-first pass path.',
  expectedFiles: ['conductor/symphony/src/server.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  createdAt: '2026-05-17T00:02:00.000Z',
  updatedAt: '2026-05-17T00:03:00.000Z',
  gitPreflight: cleanPreflight,
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
  linearIssueId: 'lin-1',
  linearIssueIdentifier: 'ARALIA-101',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARALIA-101/pass-path-proof',
  linearIssueCreatedAt: '2026-05-17T00:02:00.000Z',
  githubPullRequestUrl: null,
  githubPullRequestState: null,
  githubPullRequestIsDraft: null,
  githubPullRequestMergeable: null,
  githubPullRequestReviewDecision: null,
  githubPullRequestHeadRef: null,
  githubPullRequestBaseRef: null,
  githubPullRequestChecks: null,
  githubPullRequestFiles: null,
  githubPullRequestFeedback: {
    totalComments: 0,
    julesFeedback: [],
    scoutConflictComments: [],
    externalReviewComments: [],
    summary: '0 Jules feedback comment(s), 0 Scout conflict comment(s), 0 external review comment(s).',
  },
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

const stagedHandoff = {
  ...baseHandoff,
  status: 'manifest_ready',
  runId: 'run-pass-path',
  manifestPath: '.jules/runs/run-pass-path/manifest.json',
  launchCommand: 'npx tsx .jules/orchestrator/cli.ts launch .jules/runs/run-pass-path/manifest.json',
  recordsPath: '.jules/runs/run-pass-path',
  statusCommand: 'npx tsx .jules/orchestrator/cli.ts status run-pass-path',
};

const launchedHandoff = {
  ...stagedHandoff,
  status: 'sent_to_jules',
  launchedAt: '2026-05-17T00:04:00.000Z',
  julesSessionId: 'jules-session-pass-path',
  julesSessionUrl: 'https://jules.google.com/session/jules-session-pass-path',
  julesState: 'RUNNING',
};

const prHandoff = {
  ...launchedHandoff,
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/901',
  githubPullRequestState: 'OPEN',
  githubPullRequestIsDraft: false,
  githubPullRequestMergeable: 'MERGEABLE',
  githubPullRequestReviewDecision: 'REVIEW_REQUIRED',
  githubPullRequestHeadRef: 'jules/pass-path-proof',
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
  lastPullRequestRefreshAt: '2026-05-17T00:05:00.000Z',
  pullRequestViewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/901',
  pullRequestChecksCommand: 'gh pr checks https://github.com/Gambitnl/Aralia/pull/901',
};

const mergedHandoff = {
  ...prHandoff,
  githubPullRequestState: 'MERGED',
  localSyncStatus: {
    safeToPull: true,
    upToDate: false,
    checkedAt: '2026-05-17T00:06:00.000Z',
    repoRoot: 'F:\\Repos\\Aralia',
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
      summary: 'Fast-forward is safe.',
      steps: [],
    },
  },
  localSyncCommand: 'git pull --ff-only origin master',
};

const mergedNeedsLocalSyncCheckHandoff = {
  ...prHandoff,
  githubPullRequestState: 'MERGED',
  githubPullRequestNextAction: {
    code: 'check_local_sync',
    tone: 'ready',
    label: 'Check Local Sync',
    command: null,
    feedbackCommand: null,
    url: null,
    summary: 'GitHub reports the PR merged. The next step is the guarded local sync check.',
    steps: ['Run Check Local Sync.', 'Only sync local master if the local sync gate says it is safe.'],
  },
  localSyncStatus: null,
};

const snapshots = {
  linear: makeSnapshot({ drafts: [draft], handoffs: [] }),
  manifest: makeSnapshot({ drafts: [linearDraft], handoffs: [baseHandoff] }),
  launch: makeSnapshot({ drafts: [linearDraft], handoffs: [stagedHandoff] }),
  session: makeSnapshot({ drafts: [linearDraft], handoffs: [launchedHandoff] }),
  pr: makeSnapshot({ drafts: [linearDraft], handoffs: [prHandoff] }),
  localCheck: makeSnapshot({ drafts: [linearDraft], handoffs: [mergedNeedsLocalSyncCheckHandoff] }),
  localSync: makeSnapshot({ drafts: [linearDraft], handoffs: [mergedHandoff] }),
};

let activeSnapshot = snapshots.linear;

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

const server = new HttpServer(8204, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return activeSnapshot;
  },
};

try {
  await server.start();

  await assertForeman('linear', {
    boundary: 'linear_issue',
    safety: 'external_write',
    method: 'POST',
    endpoint: `${BASE_URL}/api/v1/task-drafts/draft-pass-path/create-linear`,
    evidenceEndpoint: `${BASE_URL}/api/v1/task-drafts/draft-pass-path/linear-preview`,
    mutatesExternalSystemsIfRun: true,
    mutatesLocalFilesIfRun: false,
    mutatesGitIfRun: false,
  });

  await assertForeman('manifest', {
    boundary: 'jules_manifest',
    safety: 'local_state_only',
    method: 'POST',
    endpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/stage-manifest`,
    evidenceEndpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/stage-manifest`,
    mutatesExternalSystemsIfRun: false,
    mutatesLocalFilesIfRun: true,
    mutatesGitIfRun: false,
  });

  await assertForeman('launch', {
    boundary: 'jules_launch',
    safety: 'external_write',
    method: 'POST',
    endpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/launch`,
    evidenceEndpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/launch-readiness`,
    mutatesExternalSystemsIfRun: true,
    mutatesLocalFilesIfRun: true,
    mutatesGitIfRun: false,
  });

  await assertForeman('session', {
    boundary: 'jules_session',
    safety: 'external_read',
    method: 'POST',
    endpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/refresh-status`,
    evidenceEndpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/refresh-status`,
    requiresOperator: false,
    instructionPattern: /dashboard refresh control/i,
    mutatesExternalSystemsIfRun: false,
    mutatesLocalFilesIfRun: true,
    mutatesGitIfRun: false,
  });

  await assertForeman('pr', {
    boundary: 'github_pr',
    safety: 'external_read',
    method: 'POST',
    endpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/refresh-pr`,
    evidenceEndpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/refresh-pr`,
    mutatesExternalSystemsIfRun: false,
    mutatesLocalFilesIfRun: false,
    mutatesGitIfRun: false,
  });

  await assertForeman('localCheck', {
    boundary: 'local_sync',
    safety: 'read_only',
    method: 'POST',
    endpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/refresh-local-sync`,
    evidenceEndpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/refresh-local-sync`,
    nextActionUrl: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/refresh-local-sync`,
    requiresOperator: false,
    instructionPattern: /readiness check/i,
    mutatesExternalSystemsIfRun: false,
    mutatesLocalFilesIfRun: false,
    mutatesGitIfRun: false,
  });

  await assertForeman('localSync', {
    boundary: 'local_sync',
    safety: 'git_mutation',
    method: 'POST',
    endpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/sync-local`,
    evidenceEndpoint: `${BASE_URL}/api/v1/jules-handoffs/handoff-pass-path/refresh-local-sync`,
    mutatesExternalSystemsIfRun: false,
    mutatesLocalFilesIfRun: true,
    mutatesGitIfRun: true,
  });
} finally {
  await server.stop();
}

function makeSnapshot({ drafts, handoffs }) {
  return {
    drafts,
    handoffs,
    preflight: cleanPreflight,
    gitDisposition: cleanGitDisposition,
    gitSyncPlan: cleanGitSyncPlan,
    taskRouting,
    taskNudges,
  };
}

async function assertForeman(snapshotName, expected) {
  activeSnapshot = snapshots[snapshotName];
  const response = await getJson(`${BASE_URL}/api/v1/task-drafts`);
  const action = response.middleman_path.foremanAction;

  assert.equal(response.middleman_path.currentBoundary, expected.boundary, `${snapshotName}: current boundary`);
  assert.equal(action.boundary, expected.boundary, `${snapshotName}: action boundary`);
  assert.equal(action.safety, expected.safety, `${snapshotName}: safety`);
  assert.equal(action.method, expected.method, `${snapshotName}: method`);
  assert.equal(action.endpoint, expected.endpoint, `${snapshotName}: endpoint`);
  assert.equal(action.evidenceEndpoint, expected.evidenceEndpoint, `${snapshotName}: evidence endpoint`);
  if (expected.nextActionUrl) {
    assert.equal(response.next_action.url, expected.nextActionUrl, `${snapshotName}: queue next action URL`);
  }
  assert.equal(action.canRunNow, true, `${snapshotName}: canRunNow`);
  // Jules status refresh is an approved monitoring action: it reads Jules and
  // may refresh local receipt state, but it should not stop on an operator
  // approval prompt every time the dashboard needs current status.
  const expectedOperatorRequirement = typeof expected.requiresOperator === 'boolean'
    ? expected.requiresOperator
    : action.mutatesGitIfRun || action.mutatesExternalSystemsIfRun || action.mutatesLocalFilesIfRun;
  assert.equal(action.requiresOperator, expectedOperatorRequirement, `${snapshotName}: operator flag`);
  assert.equal(action.mutatesExternalSystemsIfRun, expected.mutatesExternalSystemsIfRun, `${snapshotName}: external mutation flag`);
  assert.equal(action.mutatesLocalFilesIfRun, expected.mutatesLocalFilesIfRun, `${snapshotName}: local mutation flag`);
  assert.equal(action.mutatesGitIfRun, expected.mutatesGitIfRun, `${snapshotName}: Git mutation flag`);
  // Most foreman actions must explicitly name proof capture. Jules refresh is
  // already the proof-gathering act, so its instruction instead names the
  // visible dashboard control the operator should use.
  assert.match(action.instruction, expected.instructionPattern ?? /capture proof/i, `${snapshotName}: instruction names proof capture`);
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
