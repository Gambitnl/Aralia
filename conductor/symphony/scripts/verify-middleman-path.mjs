import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the global middleman path packet.
//
// Individual cards already know about Git sync, Linear previews, Jules manifest
// previews, launch readiness, PR state, and local sync. The missing foreman
// surface is one compact ladder that says where the whole dashboard-first path
// currently is, what proof exists, and which boundary blocks the next move.

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const blockedPreflight = {
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
  blockers: [
    '6 tracked file(s) have uncommitted changes.',
    'master is behind origin/master by 7 commit(s).',
  ],
  summary: 'Blocked: 6 tracked file(s) have uncommitted changes.',
  details: [],
  dirtyFileSamples: [],
  untrackedFileSamples: [],
  resolutionPacket: { commands: {} },
  remediation: [],
  nextAction: {
    code: 'review_local_changes',
    tone: 'blocked',
    label: 'Review Local Changes',
    command: 'git status --short',
    summary: 'local changes are present',
    steps: [],
  },
  commands: {},
};

const draft = {
  id: 'draft-middleman',
  title: 'Middleman ladder proof draft',
  body: 'Small but real dashboard-first task.',
  expectedFiles: ['conductor/symphony/src/server.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  executor: 'jules',
  status: 'blocked_by_git_sync',
  linearIssueId: null,
  linearIssueIdentifier: null,
  linearIssueUrl: null,
  linearIssueCreatedAt: null,
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:01:00.000Z',
};

const observedHandoff = {
  id: 'observed-pr-middleman',
  draftId: 'observed-pr:https://github.com/Gambitnl/Aralia/pull/900',
  title: 'Observed PR #900 ladder proof',
  executor: 'jules',
  status: 'observed_pr',
  prompt: 'Observed PR proof prompt.',
  expectedFiles: ['src/hooks/combat/useTargetValidator.ts'],
  verificationCommands: ['gh pr view 900 --repo Gambitnl/Aralia'],
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:02:00.000Z',
  gitPreflight: blockedPreflight,
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
  githubPullRequestChecks: {
    total: 0,
    passed: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
    unknown: 0,
    conclusion: 'unknown',
    artifacts: [],
  },
  githubPullRequestFiles: null,
  githubPullRequestFeedback: {
    totalComments: 1,
    julesFeedback: [],
    scoutConflictComments: [],
    externalReviewComments: [],
    summary: '1 external review comment(s).',
  },
  githubPullRequestNextAction: null,
  githubPullRequestRefreshError: null,
  lastPullRequestRefreshAt: '2026-05-17T00:02:00.000Z',
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
};

const orchestrator = {
  getConfig() {
    return { tracker: { kind: 'linear', apiKey: 'test-key', projectSlug: 'aralia' } };
  },
  getDashboardBaseUrl() {
    return 'http://127.0.0.1:8203';
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-17T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: 'http://127.0.0.1:8203' },
    };
  },
};

const server = new HttpServer(8203, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [draft],
      handoffs: [observedHandoff],
      preflight: blockedPreflight,
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
          packageId: 'git-sync-middleman',
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
          safetyChecklist: ['Record human-owned Git dispositions first.'],
          expectedNextProof: 'Record dispositions.',
        },
      },
      taskRouting: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        route: 'blocked',
        subjectId: draft.id,
        subjectTitle: draft.title,
        summary: 'GitHub sync gate is blocked.',
        reasons: ['Blocked: tracked changes.'],
        nextAction: { code: 'wait', label: 'Wait for Git disposition', detail: 'Resolve sync first.', pauseSeconds: 0, nextNudgeAt: null },
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

  const snapshot = await getJson('http://127.0.0.1:8203/api/v1/task-drafts');
  assert.equal(snapshot.middleman_path.status, 'blocked');
  assert.equal(snapshot.middleman_path.currentBoundary, 'git_sync');
  assert.equal(snapshot.middleman_path.nextExpectedProof, 'Human-owned Git disposition and a passing GitHub sync preflight.');
  assert.equal(snapshot.middleman_path.stages.length, 8);
  assert.equal(snapshot.middleman_path.foremanAction.boundary, 'git_sync');
  assert.equal(snapshot.middleman_path.foremanAction.label, 'Resolve Git disposition before Linear/Jules');
  assert.equal(snapshot.middleman_path.foremanAction.method, 'NONE');
  assert.equal(snapshot.middleman_path.foremanAction.endpoint, null);
  assert.equal(snapshot.middleman_path.foremanAction.evidenceEndpoint, 'http://127.0.0.1:8203/api/v1/git-disposition/review');
  assert.equal(snapshot.middleman_path.foremanAction.recordEndpoint, 'http://127.0.0.1:8203/api/v1/git-disposition');
  assert.equal(snapshot.middleman_path.foremanAction.canRunNow, false);
  assert.equal(snapshot.middleman_path.foremanAction.requiresOperator, true);
  assert.equal(snapshot.middleman_path.foremanAction.safety, 'operator_only');
  assert.equal(snapshot.middleman_path.foremanAction.mutatesGitIfRun, false);
  assert.match(snapshot.middleman_path.foremanAction.blockedReason, /behind origin\/master/);

  const gitStage = snapshot.middleman_path.stages.find(stage => stage.id === 'git_sync');
  assert.equal(gitStage.status, 'blocked');
  assert.equal(gitStage.canRunNow, false);
  assert.equal(gitStage.mutatesGitIfRun, false);
  assert.match(gitStage.detail, /6 tracked file/);
  assert.ok(gitStage.blockedBy.some(reason => /behind origin\/master/.test(reason)));

  const linearStage = snapshot.middleman_path.stages.find(stage => stage.id === 'linear_issue');
  assert.equal(linearStage.status, 'waiting');
  assert.equal(linearStage.sourceId, 'draft-middleman');
  assert.equal(linearStage.method, 'POST');
  assert.equal(linearStage.endpoint, 'http://127.0.0.1:8203/api/v1/task-drafts/draft-middleman/create-linear');

  const observedPrStage = snapshot.middleman_path.stages.find(stage => stage.id === 'github_pr');
  assert.equal(observedPrStage.status, 'observed');
  assert.equal(observedPrStage.sourceId, 'observed-pr-middleman');
  assert.equal(observedPrStage.receipt, 'https://github.com/Gambitnl/Aralia/pull/900');
  assert.equal(observedPrStage.mutatesExternalSystemsIfRun, false);

  const localSyncStage = snapshot.middleman_path.stages.find(stage => stage.id === 'local_sync');
  assert.equal(localSyncStage.status, 'waiting');
  assert.equal(localSyncStage.mutatesGitIfRun, false);
  assert.equal(localSyncStage.endpoint, null, 'Observed PRs must not expose local sync endpoints.');

  const proof = await getText('http://127.0.0.1:8203/proof');
  assert.match(proof, /Middleman Path/);
  assert.match(proof, /Foreman action: Resolve Git disposition before Linear\/Jules/);
  assert.match(proof, /Safety: operator_only/);
  assert.match(proof, /Current boundary: GitHub sync/);
  assert.match(proof, /Human-owned Git disposition and a passing GitHub sync preflight/);
  assert.match(proof, /Observed PR #900 ladder proof/);
  assert.doesNotMatch(proof, /<script/i);

  const runningJulesHandoff = {
    ...observedHandoff,
    id: 'handoff-running-jules',
    draftId: 'draft-running-jules',
    title: 'Running Jules handoff proof',
    status: 'sent_to_jules',
    manifestPath: '.jules/runs/running-jules/manifest.json',
    launchedAt: '2026-05-21T21:55:00.000Z',
    julesSessionId: '15527431301408060204',
    julesSessionUrl: 'https://jules.google.com/session/15527431301408060204',
    julesState: 'QUEUED',
    linearIssueIdentifier: 'ARA-7',
    linearIssueUrl: 'https://linear.app/aralia/issue/ARA-7/spell-phase-1-package-2-premade-party-and-gear',
    githubPullRequestUrl: null,
    githubPullRequestState: null,
    lastPullRequestRefreshAt: null,
    githubPullRequestFeedback: null,
  };

  server.taskIntake.snapshot = async () => ({
    drafts: [],
    handoffs: [runningJulesHandoff],
    preflight: blockedPreflight,
    gitDisposition: {
      categories: [],
      decidedCount: 0,
      totalRequired: 4,
      readyForHumanSync: false,
      summary: 'No Git disposition decisions recorded.',
      updatedAt: null,
    },
    gitSyncPlan: null,
    taskRouting: null,
    taskNudges: {
      total: 0,
      summary: 'No durable nudge evidence recorded yet.',
      latest: null,
      recent: [],
      nextNudgeAt: null,
      scheduler: {
        checkedAt: '2026-05-21T21:55:00.000Z',
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
  });

  const runningSnapshot = await getJson('http://127.0.0.1:8203/api/v1/task-drafts');
  assert.equal(runningSnapshot.middleman_path.status, 'active');
  assert.equal(runningSnapshot.middleman_path.currentBoundary, 'jules_session');
  assert.equal(runningSnapshot.middleman_path.foremanAction.label, 'Refresh Jules Status');
  assert.equal(runningSnapshot.middleman_path.foremanAction.safety, 'external_read');
  assert.equal(runningSnapshot.middleman_path.foremanAction.canRunNow, true);

  const runningGitStage = runningSnapshot.middleman_path.stages.find(stage => stage.id === 'git_sync');
  assert.equal(runningGitStage.status, 'blocked');
  assert.match(runningGitStage.detail, /6 tracked file/);

  const runningJulesStage = runningSnapshot.middleman_path.stages.find(stage => stage.id === 'jules_session');
  assert.equal(runningJulesStage.status, 'active');
  assert.equal(runningJulesStage.receipt, 'https://jules.google.com/session/15527431301408060204');

  const cleanPreflight = {
    ...blockedPreflight,
    ok: true,
    currentBranch: 'codex/package14-dashboard-launch',
    localCommit: 'merged-head',
    remoteCommit: 'merged-head',
    ahead: 0,
    behind: 0,
    dirtyFiles: 0,
    untrackedFiles: 0,
    blockers: [],
    summary: 'Ready: checkout matches origin/master and the working tree is clean.',
    nextAction: {
      code: 'complete',
      tone: 'ready',
      label: 'GitHub Synced',
      summary: 'GitHub sync gate is clean.',
      steps: [],
    },
  };
  const mergedHandoffWithOldRisk = {
    ...runningJulesHandoff,
    id: 'handoff-merged-risk',
    title: 'Merged PR with stale risk evidence',
    githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/1096',
    githubPullRequestState: 'MERGED',
    githubPullRequestChecks: {
      total: 7,
      passed: 7,
      failed: 0,
      pending: 0,
      skipped: 0,
      unknown: 0,
      conclusion: 'passing',
      artifacts: [],
    },
    githubPullRequestFiles: {
      files: [{
        path: 'src/commands/effects/TerrainCommand.ts',
        risk: 'medium',
        reason: 'conflict-prone runtime file',
      }],
    },
    githubPullRequestNextAction: {
      code: 'check_local_sync',
      tone: 'ready',
      label: 'Check Local Sync',
      summary: 'The PR is merged. Symphony needs one final local safety check before pulling.',
      steps: ['Click Check Local Sync.'],
    },
    localSyncStatus: {
      checkedAt: '2026-05-26T02:02:55.000Z',
      upToDate: true,
      safeToPull: false,
      summary: 'The merged Jules work is already present on local master.',
      blockers: [],
      currentBranch: 'codex/package14-dashboard-launch',
      currentBranchCanStandInForBase: true,
      localCommit: 'merged-head',
      remoteCommit: 'merged-head',
      ahead: 0,
      behind: 0,
      dirtyFiles: 0,
      untrackedFiles: 0,
      nextAction: {
        code: 'local_master_current',
        tone: 'ready',
        label: 'Local checkout is current',
        summary: 'The merged Jules work is already present on local master.',
        steps: ['Use the dashboard to draft the next bounded Jules task.'],
      },
    },
  };

  // A merged PR can keep historical file-risk data on its card, but that old
  // Scout/Core warning must not keep the global path blocked after local sync
  // proves the merged work is already present.
  server.taskIntake.snapshot = async () => ({
    drafts: [],
    handoffs: [mergedHandoffWithOldRisk],
    preflight: cleanPreflight,
    gitDisposition: {
      categories: [],
      decidedCount: 0,
      totalRequired: 0,
      readyForHumanSync: true,
      summary: 'No Git disposition decisions required.',
      updatedAt: null,
    },
    gitSyncPlan: null,
    taskRouting: null,
    taskNudges: {
      total: 0,
      summary: 'No durable nudge evidence recorded yet.',
      latest: null,
      recent: [],
      nextNudgeAt: null,
      scheduler: {
        checkedAt: '2026-05-26T02:02:55.000Z',
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
  });

  const mergedSnapshot = await getJson('http://127.0.0.1:8203/api/v1/task-drafts');
  assert.equal(mergedSnapshot.middleman_path.status, 'complete');
  assert.equal(mergedSnapshot.middleman_path.currentBoundary, 'local_sync');
  assert.equal(mergedSnapshot.middleman_path.stages.find(stage => stage.id === 'scout_core').status, 'complete');
  assert.equal(mergedSnapshot.middleman_path.stages.find(stage => stage.id === 'local_sync').status, 'complete');
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
