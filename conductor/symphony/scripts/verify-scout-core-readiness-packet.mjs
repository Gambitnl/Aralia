import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the GitHub PR review bridge between Jules' PR and
// Core's merge. The packet must stay read-only: Scout can inspect and classify
// PR risk, but Core merge remains an explicit operator command and local sync
// remains a later boundary after GitHub reports the PR merged.

const BASE_URL = 'http://127.0.0.1:8206';

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
  id: 'handoff-scout-core',
  draftId: 'draft-scout-core',
  title: 'Scout Core proof handoff',
  executor: 'jules',
  status: 'sent_to_jules',
  prompt: 'Prove Scout/Core readiness.',
  expectedFiles: ['conductor/symphony/src/server.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:01:00.000Z',
  gitPreflight: cleanPreflight,
  baseCommitDrift: null,
  runId: 'run-scout-core',
  manifestPath: '.jules/runs/run-scout-core/manifest.json',
  launchCommand: 'npx tsx .jules/orchestrator/cli.ts launch .jules/runs/run-scout-core/manifest.json',
  launchOutput: null,
  launchError: null,
  launchedAt: '2026-05-17T00:02:00.000Z',
  statusCommand: 'npx tsx .jules/orchestrator/cli.ts status run-scout-core',
  reviewCommand: null,
  pullCommand: null,
  recordsPath: '.jules/runs/run-scout-core',
  lastStatusRefreshAt: '2026-05-17T00:03:00.000Z',
  julesSessionId: 'jules-session-scout-core',
  julesSessionUrl: 'https://jules.google.com/session/jules-session-scout-core',
  julesState: 'COMPLETED',
  linearIssueId: 'lin-scout-core',
  linearIssueIdentifier: 'ARALIA-303',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARALIA-303/scout-core-proof',
  linearIssueCreatedAt: '2026-05-17T00:01:00.000Z',
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/903',
  githubPullRequestState: 'OPEN',
  githubPullRequestIsDraft: false,
  githubPullRequestMergeable: 'MERGEABLE',
  githubPullRequestReviewDecision: 'APPROVED',
  githubPullRequestHeadRef: 'jules/scout-core-proof',
  githubPullRequestBaseRef: 'master',
  githubPullRequestChecks: checks('passing'),
  githubPullRequestFiles: files('low'),
  githubPullRequestFeedback: feedback(),
  githubPullRequestNextAction: nextAction('core_validate_and_merge', 'ready', 'Core Validate and Merge', 'The PR looks ready for Core validation and merge after Scout clears it.'),
  githubPullRequestRefreshError: null,
  lastPullRequestRefreshAt: '2026-05-17T00:04:00.000Z',
  pullRequestViewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/903',
  pullRequestChecksCommand: 'gh pr checks https://github.com/Gambitnl/Aralia/pull/903',
  pullRequestMergeCommand: 'gh pr merge https://github.com/Gambitnl/Aralia/pull/903 --squash --delete-branch',
  scoutReviewCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/903 --comments --files',
  coreValidationCommand: 'gh pr view https://github.com/Gambitnl/Aralia/pull/903 --json state,isDraft,mergeable,reviewDecision,statusCheckRollup,files',
  coreMergeCommand: 'gh pr merge https://github.com/Gambitnl/Aralia/pull/903 --squash --delete-branch',
  localSyncCommand: 'git pull --ff-only origin master',
  localSyncStatus: null,
  localSyncOutput: null,
  localSyncError: null,
  lastLocalSyncAt: null,
  operatorMessages: [],
  planApprovals: [],
};

const riskyHandoff = {
  ...baseHandoff,
  id: 'handoff-scout-core-risk',
  title: 'Risky Scout Core proof handoff',
  githubPullRequestFiles: files('high', ['src/systems/combat/rules.ts'], ['Risky shared rules file changed outside expected scope.']),
  githubPullRequestFeedback: feedback({ scoutConflictComments: 2 }),
  githubPullRequestNextAction: nextAction('scout_bridge_risk', 'blocked', 'Scout Bridge Risk', 'Changed files need Scout review before Core merges.', 'Have Scout review risky files.'),
};

const pendingHandoff = {
  ...baseHandoff,
  id: 'handoff-scout-core-pending',
  title: 'Pending checks Scout Core proof handoff',
  githubPullRequestChecks: checks('pending'),
  githubPullRequestNextAction: nextAction('wait_for_checks', 'waiting', 'Wait for PR Checks', 'GitHub checks are not conclusively passing yet.'),
};

const mergedHandoff = {
  ...baseHandoff,
  id: 'handoff-scout-core-merged',
  title: 'Merged Scout Core proof handoff',
  githubPullRequestState: 'MERGED',
  githubPullRequestNextAction: nextAction('check_local_sync', 'ready', 'Check Local Sync', 'GitHub reports the PR merged. The next step is the guarded local sync check.'),
};

const observedHandoff = {
  ...baseHandoff,
  id: 'handoff-scout-core-observed',
  title: 'Observed Scout Core proof handoff',
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

let handoffs = [baseHandoff, riskyHandoff, pendingHandoff, mergedHandoff, observedHandoff];
const server = new HttpServer(8206, orchestrator, logger);
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
          packageId: 'scout-core-proof',
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
          safetyChecklist: ['Inspect Scout/Core readiness before merge.'],
          expectedNextProof: 'Scout/Core readiness packet.',
        },
      },
      taskRouting: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        route: 'wait_external',
        subjectId: baseHandoff.id,
        subjectTitle: baseHandoff.title,
        summary: 'Waiting for Scout/Core.',
        reasons: [],
        nextAction: { code: 'wait', label: 'Wait', detail: 'Wait for Scout/Core.', pauseSeconds: 0, nextNudgeAt: null },
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
  const [ready, risky, pending, merged, observed] = snapshot.handoffs;

  assert.equal(ready.scout_core_readiness.status, 'ready_for_core');
  assert.equal(ready.scout_core_readiness.canScoutReviewNow, true);
  assert.equal(ready.scout_core_readiness.canCoreValidateNow, true);
  assert.equal(ready.scout_core_readiness.canCoreMergeNow, true);
  assert.equal(ready.scout_core_readiness.mutatesGitIfRun, false);
  assert.equal(ready.scout_core_readiness.mutatesExternalSystemsIfCoreMerges, true);
  assert.equal(ready.scout_core_readiness.pr.url, baseHandoff.githubPullRequestUrl);
  assert.equal(ready.scout_core_readiness.evidence.checksConclusion, 'passing');
  assert.equal(ready.scout_core_readiness.expectedNextProof, 'Core validation receipt, merge receipt, refreshed PR state, then local sync readiness.');

  assert.equal(risky.scout_core_readiness.status, 'blocked_by_scout');
  assert.equal(risky.scout_core_readiness.canCoreValidateNow, false);
  assert.equal(risky.scout_core_readiness.canCoreMergeNow, false);
  assert.match(risky.scout_core_readiness.blockers.join(' '), /Scout review/);
  assert.equal(risky.scout_core_readiness.evidence.scoutConflictComments, 2);

  assert.equal(pending.scout_core_readiness.status, 'waiting');
  assert.equal(pending.scout_core_readiness.canCoreValidateNow, false);
  assert.match(pending.scout_core_readiness.blockers.join(' '), /checks/);

  assert.equal(merged.scout_core_readiness.status, 'merged');
  assert.equal(merged.scout_core_readiness.canCoreMergeNow, false);
  assert.equal(merged.scout_core_readiness.nextBoundary, 'local_sync');

  assert.equal(observed.scout_core_readiness.status, 'observed');
  assert.equal(observed.scout_core_readiness.canScoutReviewNow, true);
  assert.equal(observed.scout_core_readiness.canCoreMergeNow, false);
  assert.match(observed.scout_core_readiness.blockers.join(' '), /Observed PR records are read-only/);

  const proof = await getText(`${BASE_URL}/proof`);
  assert.match(proof, /Scout\/Core Readiness/);
  assert.match(proof, /Core validation receipt, merge receipt, refreshed PR state, then local sync readiness/);
  assert.match(proof, /Observed PR records are read-only/);
  assert.doesNotMatch(proof, /<script/i);
} finally {
  await server.stop();
}

function checks(conclusion) {
  return {
    total: 1,
    passed: conclusion === 'passing' ? 1 : 0,
    failed: conclusion === 'failing' ? 1 : 0,
    pending: conclusion === 'pending' ? 1 : 0,
    skipped: 0,
    unknown: conclusion === 'unknown' ? 1 : 0,
    conclusion,
    artifacts: [],
  };
}

function files(risk, outOfScopeFiles = [], riskReasons = []) {
  return {
    total: 1,
    additions: 20,
    deletions: 4,
    risk,
    riskReasons,
    scopeFiles: ['conductor/symphony/src/server.ts'],
    outOfScopeFiles,
    files: [
      {
        path: outOfScopeFiles[0] ?? 'conductor/symphony/src/server.ts',
        additions: 20,
        deletions: 4,
        risk,
        reason: riskReasons[0] ?? null,
      },
    ],
  };
}

function feedback(input = {}) {
  return {
    totalComments: (input.scoutConflictComments ?? 0) + (input.externalReviewComments ?? 0),
    julesFeedback: [],
    scoutConflictComments: Array.from({ length: input.scoutConflictComments ?? 0 }, (_, index) => ({
      author: 'scout',
      body: `Scout conflict ${index + 1}`,
      url: `https://github.com/Gambitnl/Aralia/pull/903#issuecomment-${index + 1}`,
      createdAt: '2026-05-17T00:04:00.000Z',
      source: 'comment',
      conflictFile: 'src/systems/combat/rules.ts',
      priorityPullRequest: 901,
    })),
    externalReviewComments: [],
    summary: `${input.scoutConflictComments ?? 0} Scout conflict comment(s).`,
  };
}

function nextAction(code, tone, label, summary, step = 'Refresh PR state after action.') {
  const prUrl = 'https://github.com/Gambitnl/Aralia/pull/903';

  return {
    code,
    tone,
    label,
    command: code === 'core_validate_and_merge'
      ? `gh pr view ${prUrl} --json state,isDraft,mergeable,reviewDecision,statusCheckRollup,files`
      : `gh pr view ${prUrl} --comments --files`,
    feedbackCommand: tone === 'blocked' ? `gh pr comment ${prUrl} --body "[Jules feedback] ..."` : null,
    url: `${BASE_URL}/api/v1/jules-handoffs/handoff-scout-core/refresh-pr`,
    summary,
    steps: [step],
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
