import assert from 'node:assert/strict';
import { HttpServer } from '../dist/server.js';

// This verifier protects the dashboard's queue-level "what now?" signal.
// Symphony can keep completed handoffs visible on their cards, but the top
// queue action should point at the Jules/GitHub work that can still block the
// user's local master sync and next cloud handoff.

const logger = {
  child() {
    return logger;
  },
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const config = {
  tracker: {
    kind: 'local',
  },
  codex: {
    autoApproveAppTools: [],
  },
};

const orchestrator = {
  getConfig() {
    return config;
  },
  getDashboardBaseUrl() {
    return 'http://127.0.0.1:8081';
  },
};

const server = new HttpServer(0, orchestrator, logger);
const withTaskCapabilities = server.withTaskCapabilities.bind(server);

const preflight = {
  ok: true,
  checkedAt: '2026-05-17T00:00:00.000Z',
  status: 'clean_and_synced',
  localBranch: 'master',
  remoteBranch: 'origin/master',
  localCommit: 'abc1234',
  remoteCommit: 'abc1234',
  ahead: 0,
  behind: 0,
  dirtyFiles: [],
  blockers: [],
  syncCommand: 'git fetch origin master',
  nextAction: {
    code: 'ready_for_jules_handoff',
    tone: 'ready',
    label: 'Ready For Jules Handoff',
    summary: 'Local master is synced with GitHub.',
    command: 'POST /api/v1/task-drafts/{id}/handoff',
    steps: ['Prepare or stage the Jules handoff.'],
  },
};

const blockedPreflight = {
  ...preflight,
  ok: false,
  status: 'blocked_by_local_changes',
  blockers: ['Working tree has uncommitted changes.'],
  nextAction: {
    code: 'review_local_changes',
    tone: 'blocked',
    label: 'Review Local Changes',
    summary: 'Local changes must be committed, stashed, or intentionally excluded before Jules starts from GitHub.',
    command: 'git status --short',
    steps: ['Resolve local changes before launching Jules.'],
  },
};

const emptyQueueSnapshot = withTaskCapabilities({
  drafts: [],
  preflight,
  handoffs: [],
});

// An empty queue is the first dashboard-first user path. If the top action says
// to POST a draft, the action should carry the request body shape so operators
// and headless foremen do not need to know the task-drafts route by memory.
assert.equal(emptyQueueSnapshot.next_action.code, 'draft_task');
assert.equal(emptyQueueSnapshot.next_action.url, 'http://127.0.0.1:8081/api/v1/task-drafts');
assert.equal(emptyQueueSnapshot.next_action.method, 'POST');
assert.deepEqual(emptyQueueSnapshot.next_action.request_body_schema, {
  title: 'string',
  body: 'string',
  expectedFiles: 'string[] | newline-separated string',
  verificationCommands: 'string[] | newline-separated string',
});
assert.deepEqual(emptyQueueSnapshot.next_action.request_body_example, {
  title: 'Bounded Jules task title',
  body: 'Plain-language task details, constraints, and intended result.',
  expectedFiles: ['src/path/or/write-scope'],
  verificationCommands: ['npm.cmd run build'],
});

const baseHandoff = {
  draftId: 'draft',
  title: 'Example handoff',
  executor: 'jules',
  status: 'sent_to_jules',
  prompt: 'Example prompt',
  expectedFiles: [],
  verificationCommands: [],
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
  gitPreflight: preflight,
  baseCommitDrift: null,
  runId: 'run',
  manifestPath: '.jules/runs/example/manifest.json',
  launchCommand: null,
  launchOutput: null,
  launchError: null,
  launchedAt: null,
  statusCommand: null,
  reviewCommand: null,
  pullCommand: null,
  recordsPath: null,
  lastStatusRefreshAt: null,
  julesSessionId: 'jules-session',
  julesSessionUrl: null,
  julesState: 'DONE',
  linearIssueId: null,
  linearIssueIdentifier: null,
  linearIssueUrl: null,
  linearIssueCreatedAt: null,
  githubPullRequestUrl: null,
  githubPullRequestState: 'MERGED',
  githubPullRequestIsDraft: null,
  githubPullRequestMergeable: null,
  githubPullRequestReviewDecision: null,
  githubPullRequestHeadRef: null,
  githubPullRequestBaseRef: null,
  githubPullRequestChecks: null,
  githubPullRequestFiles: null,
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

const snapshot = withTaskCapabilities({
  drafts: [],
  preflight,
  handoffs: [
    {
      ...baseHandoff,
      id: 'handoff-complete',
      githubPullRequestUrl: 'https://github.com/example/repo/pull/0',
      lastPullRequestRefreshAt: '2026-05-17T00:01:00.000Z',
      localSyncStatus: {
        safeToPull: false,
        upToDate: true,
        checkedAt: '2026-05-17T00:01:00.000Z',
        repoRoot: 'F:\\Repos\\Aralia',
        baseBranch: 'master',
        remoteBranch: 'origin/master',
        currentBranch: 'master',
        localCommit: 'abc1234',
        remoteCommit: 'abc1234',
        ahead: 0,
        behind: 0,
        dirtyFiles: 0,
        untrackedFiles: 0,
        blockers: [],
        remediation: [],
        summary: 'Local master already contains the merged Jules PR.',
        details: [],
        pullCommand: 'git pull --ff-only origin master',
        nextAction: {
          code: 'local_master_current',
          tone: 'ready',
          label: 'Local Master Current',
          command: null,
          summary: 'Local master already contains the merged Jules PR.',
          steps: ['Start the next bounded Jules task.'],
        },
      },
    },
    {
      ...baseHandoff,
      id: 'handoff-blocked',
      githubPullRequestUrl: 'https://github.com/example/repo/pull/1',
      githubPullRequestState: 'OPEN',
      githubPullRequestMergeable: 'CONFLICTING',
      lastPullRequestRefreshAt: '2026-05-17T00:02:00.000Z',
      githubPullRequestNextAction: {
        code: 'resolve_pull_request_blockers',
        tone: 'blocked',
        title: 'Resolve Pull Request Blockers',
        description: 'Scout/Core should resolve merge blockers before this can sync locally.',
        steps: ['Open the PR', 'Resolve conflicts', 'Refresh the PR status'],
      },
    },
  ],
});

assert.equal(snapshot.handoffs[0].next_action.code, 'local_master_current');
assert.equal(snapshot.handoffs[1].next_action.code, 'resolve_pull_request_blockers');
assert.equal(snapshot.next_action.code, 'resolve_pull_request_blockers');
assert.equal(snapshot.next_action.source_type, 'handoff');
assert.equal(snapshot.next_action.source_id, 'handoff-blocked');
assert.equal(snapshot.next_action.github_pull_request_url, 'https://github.com/example/repo/pull/1');

const blockedPreflightSnapshot = withTaskCapabilities({
  drafts: [],
  preflight: blockedPreflight,
  handoffs: [
    {
      ...snapshot.handoffs[1],
      gitPreflight: blockedPreflight,
    },
  ],
});

// When GitHub sync is red, Symphony should stop workers from launching or
// advancing cloud handoffs until the local base is intentionally reconciled.
// That is the guardrail that keeps Jules from starting on stale GitHub state.
assert.equal(blockedPreflightSnapshot.next_action.code, 'review_local_changes');
assert.equal(blockedPreflightSnapshot.next_action.source_type, 'git_preflight');
assert.equal(blockedPreflightSnapshot.next_action.method, 'POST');

const overlappingPrSnapshot = withTaskCapabilities({
  drafts: [],
  preflight,
  handoffs: [
    {
      ...baseHandoff,
      id: 'handoff-a',
      title: 'Jules PR A',
      githubPullRequestUrl: 'https://github.com/example/repo/pull/10',
      githubPullRequestState: 'OPEN',
      githubPullRequestMergeable: 'MERGEABLE',
      lastPullRequestRefreshAt: '2026-05-17T00:03:00.000Z',
      githubPullRequestFiles: {
        total: 1,
        additions: 10,
        deletions: 1,
        risk: 'low',
        riskReasons: [],
        scopeFiles: ['src/components/Widget'],
        outOfScopeFiles: [],
        files: [
          {
            path: 'src/components/Widget/index.ts',
            additions: 10,
            deletions: 1,
            risk: 'low',
            reason: null,
          },
        ],
      },
    },
    {
      ...baseHandoff,
      id: 'handoff-b',
      title: 'Jules PR B',
      githubPullRequestUrl: 'https://github.com/example/repo/pull/11',
      githubPullRequestState: 'OPEN',
      githubPullRequestMergeable: 'MERGEABLE',
      lastPullRequestRefreshAt: '2026-05-17T00:04:00.000Z',
      githubPullRequestFiles: {
        total: 1,
        additions: 4,
        deletions: 2,
        risk: 'medium',
        riskReasons: ['Registry/index file changed.'],
        scopeFiles: ['src/components/Widget'],
        outOfScopeFiles: [],
        files: [
          {
            path: 'src/components/Widget/index.ts',
            additions: 4,
            deletions: 2,
            risk: 'medium',
            reason: 'Registry/index file changed.',
          },
        ],
      },
    },
  ],
});

// Cross-handoff conflict watch must exist in the API, not only in dashboard
// JavaScript. Headless foremen need this top-level signal when several Jules
// PRs touch the same file and Scout must arbitrate before Core merges either.
assert.equal(overlappingPrSnapshot.conflict_watch.status, 'blocked');
assert.equal(overlappingPrSnapshot.conflict_watch.overlap_files[0].path, 'src/components/Widget/index.ts');
assert.equal(overlappingPrSnapshot.conflict_watch.overlap_files[0].handoffs.length, 2);
assert.equal(overlappingPrSnapshot.next_action.code, 'bridge_cross_handoff_conflicts');
assert.equal(overlappingPrSnapshot.next_action.source_type, 'conflict_watch');
assert.deepEqual(overlappingPrSnapshot.next_action.affected_pr_urls, [
  'https://github.com/example/repo/pull/10',
  'https://github.com/example/repo/pull/11',
]);
assert.deepEqual(overlappingPrSnapshot.next_action.overlap_file_paths, [
  'src/components/Widget/index.ts',
]);

const riskOnlyPrSnapshot = withTaskCapabilities({
  drafts: [],
  preflight,
  handoffs: [
    {
      ...baseHandoff,
      id: 'handoff-risk',
      title: 'Jules risky PR',
      githubPullRequestUrl: 'https://github.com/example/repo/pull/12',
      githubPullRequestState: 'OPEN',
      githubPullRequestMergeable: 'MERGEABLE',
      lastPullRequestRefreshAt: '2026-05-17T00:05:00.000Z',
      githubPullRequestFiles: {
        total: 1,
        additions: 8,
        deletions: 1,
        risk: 'high',
        riskReasons: ['package.json is a shared dependency manifest.'],
        scopeFiles: ['package.json'],
        outOfScopeFiles: [],
        files: [
          {
            path: 'package.json',
            additions: 8,
            deletions: 1,
            risk: 'high',
            reason: 'Shared dependency manifest.',
          },
        ],
      },
    },
  ],
});

// A single Jules PR can still need Scout arbitration when it touches a
// conflict-prone file. The queue-level action should not wait for a second PR
// overlap before telling foremen to bridge risk through Scout before Core.
assert.equal(riskOnlyPrSnapshot.conflict_watch.status, 'attention');
assert.equal(riskOnlyPrSnapshot.conflict_watch.risk_files[0].path, 'package.json');
assert.equal(riskOnlyPrSnapshot.next_action.code, 'bridge_conflict_prone_files');
assert.equal(riskOnlyPrSnapshot.next_action.source_type, 'conflict_watch');
assert.deepEqual(riskOnlyPrSnapshot.next_action.affected_pr_urls, [
  'https://github.com/example/repo/pull/12',
]);
assert.deepEqual(riskOnlyPrSnapshot.next_action.risk_file_paths, [
  'package.json',
]);

const pendingChecksSnapshot = withTaskCapabilities({
  drafts: [],
  preflight,
  handoffs: [
    {
      ...baseHandoff,
      id: 'handoff-pending-checks',
      title: 'Jules pending checks PR',
      githubPullRequestUrl: 'https://github.com/example/repo/pull/13',
      githubPullRequestState: 'OPEN',
      githubPullRequestIsDraft: false,
      githubPullRequestMergeable: 'MERGEABLE',
      lastPullRequestRefreshAt: '2026-05-17T00:06:00.000Z',
      githubPullRequestChecks: {
        total: 2,
        passing: 1,
        failing: 0,
        pending: 1,
        skipped: 0,
        unknown: 0,
        conclusion: 'pending',
      },
      githubPullRequestFiles: {
        total: 1,
        additions: 2,
        deletions: 0,
        risk: 'low',
        riskReasons: [],
        scopeFiles: ['src/components/Widget'],
        outOfScopeFiles: [],
        files: [
          {
            path: 'src/components/Widget/status.ts',
            additions: 2,
            deletions: 0,
            risk: 'low',
            reason: null,
          },
        ],
      },
      githubPullRequestNextAction: {
        code: 'wait_for_checks',
        tone: 'waiting',
        label: 'Wait for PR Checks',
        command: null,
        url: null,
        summary: 'GitHub checks are not conclusively passing yet.',
        steps: [
          'Refresh PR checks after GitHub updates.',
          'Do not ask Core to merge until checks are passing.',
        ],
      },
    },
  ],
});

// The queue-level action should preserve the detailed PR readiness decision.
// If checks are pending, a foreman should wait/refresh checks, not receive a
// generic Scout/Core review instruction that sounds merge-adjacent.
assert.equal(pendingChecksSnapshot.next_action.code, 'wait_for_checks');
assert.equal(pendingChecksSnapshot.next_action.source_type, 'handoff');
assert.equal(pendingChecksSnapshot.next_action.source_id, 'handoff-pending-checks');
assert.equal(pendingChecksSnapshot.next_action.github_pull_request_url, 'https://github.com/example/repo/pull/13');
assert.equal(
  pendingChecksSnapshot.next_action.summary,
  'GitHub checks are not conclusively passing yet.',
);

const localSyncBlockedSnapshot = withTaskCapabilities({
  drafts: [],
  preflight,
  handoffs: [
    {
      ...baseHandoff,
      id: 'handoff-local-sync-blocked',
      title: 'Jules merged PR with local edits',
      githubPullRequestUrl: 'https://github.com/example/repo/pull/14',
      githubPullRequestState: 'MERGED',
      githubPullRequestIsDraft: false,
      githubPullRequestMergeable: 'MERGEABLE',
      lastPullRequestRefreshAt: '2026-05-17T00:07:00.000Z',
      localSyncStatus: {
        safeToPull: false,
        upToDate: false,
        checkedAt: '2026-05-17T00:07:00.000Z',
        repoRoot: 'F:\\Repos\\Aralia',
        baseBranch: 'master',
        remoteBranch: 'origin/master',
        currentBranch: 'master',
        localCommit: 'abc1234',
        remoteCommit: 'def5678',
        ahead: 0,
        behind: 1,
        dirtyFiles: 1,
        untrackedFiles: 0,
        blockers: ['Local changes are present.'],
        remediation: ['Review tracked and untracked files.', 'Re-run Check Local Sync before pulling.'],
        summary: 'local changes are present. Decide what must be preserved before pulling Jules work.',
        details: [],
        pullCommand: 'git pull --ff-only origin master',
        nextAction: {
          code: 'review_local_changes',
          tone: 'blocked',
          label: 'Review Local Changes',
          command: null,
          summary: 'local changes are present. Decide what must be preserved before pulling Jules work.',
          steps: [
            'Review tracked and untracked files.',
            'Commit intended work, stash temporary work, or remove accidental files.',
            'Re-run Check Local Sync before pulling.',
          ],
        },
      },
    },
  ],
});

// Local sync has its own safety decision table. The top queue action should
// preserve that exact result instead of flattening all blocked return-path
// states into a generic "resolve blockers" label.
assert.equal(localSyncBlockedSnapshot.next_action.code, 'review_local_changes');
assert.equal(localSyncBlockedSnapshot.next_action.source_type, 'handoff');
assert.equal(localSyncBlockedSnapshot.next_action.source_id, 'handoff-local-sync-blocked');
assert.equal(
  localSyncBlockedSnapshot.next_action.url,
  'http://127.0.0.1:8081/api/v1/jules-handoffs/handoff-local-sync-blocked/refresh-local-sync',
);
assert.equal(localSyncBlockedSnapshot.next_action.method, 'POST');
assert.equal(
  localSyncBlockedSnapshot.next_action.github_pull_request_url,
  'https://github.com/example/repo/pull/14',
);
assert.deepEqual(localSyncBlockedSnapshot.next_action.local_sync_next_action, {
  code: 'review_local_changes',
  tone: 'blocked',
  label: 'Review Local Changes',
  command: null,
  summary: 'local changes are present. Decide what must be preserved before pulling Jules work.',
  steps: [
    'Review tracked and untracked files.',
    'Commit intended work, stash temporary work, or remove accidental files.',
    'Re-run Check Local Sync before pulling.',
  ],
});

const awaitingPlanSnapshot = withTaskCapabilities({
  drafts: [],
  preflight,
  handoffs: [
    {
      ...baseHandoff,
      id: 'handoff-plan',
      title: 'Jules plan approval handoff',
      githubPullRequestState: null,
      julesSessionId: 'jules-plan-session',
      julesSessionUrl: 'https://jules.google.com/session/jules-plan-session',
      julesState: 'AWAITING_PLAN_APPROVAL',
    },
  ],
});

// Plan approval should be a dashboard-first decision, not a terminal treasure
// hunt. The queue action must carry both the local approval endpoint and the
// exact Jules session URL that the operator/foreman needs to inspect first.
assert.equal(awaitingPlanSnapshot.next_action.code, 'approve_jules_plan');
assert.equal(awaitingPlanSnapshot.next_action.source_type, 'handoff');
assert.equal(awaitingPlanSnapshot.next_action.source_id, 'handoff-plan');
assert.equal(
  awaitingPlanSnapshot.next_action.url,
  'http://127.0.0.1:8081/api/v1/jules-handoffs/handoff-plan/approve-plan',
);
assert.equal(
  awaitingPlanSnapshot.next_action.jules_session_url,
  'https://jules.google.com/session/jules-plan-session',
);
assert.equal(awaitingPlanSnapshot.next_action.jules_session_id, 'jules-plan-session');

const awaitingFeedbackSnapshot = withTaskCapabilities({
  drafts: [],
  preflight,
  handoffs: [
    {
      ...baseHandoff,
      id: 'handoff-feedback',
      title: 'Jules feedback handoff',
      githubPullRequestState: null,
      julesSessionId: 'jules-feedback-session',
      julesSessionUrl: 'https://jules.google.com/session/jules-feedback-session',
      julesState: 'AWAITING_USER_FEEDBACK',
    },
  ],
});

// Jules feedback should be routed through Symphony's existing message bridge,
// not flattened into a generic status refresh. The next action carries both
// the local message endpoint and the cloud session that needs inspection.
assert.equal(awaitingFeedbackSnapshot.next_action.code, 'send_jules_feedback');
assert.equal(awaitingFeedbackSnapshot.next_action.source_type, 'handoff');
assert.equal(awaitingFeedbackSnapshot.next_action.source_id, 'handoff-feedback');
assert.equal(
  awaitingFeedbackSnapshot.next_action.url,
  'http://127.0.0.1:8081/api/v1/jules-handoffs/handoff-feedback/message',
);
assert.equal(awaitingFeedbackSnapshot.next_action.method, 'POST');
assert.equal(
  awaitingFeedbackSnapshot.next_action.jules_session_url,
  'https://jules.google.com/session/jules-feedback-session',
);
assert.equal(awaitingFeedbackSnapshot.next_action.jules_session_id, 'jules-feedback-session');
assert.deepEqual(awaitingFeedbackSnapshot.next_action.request_body_schema, {
  body: 'string',
});
assert.deepEqual(awaitingFeedbackSnapshot.next_action.request_body_example, {
  body: 'Short bounded feedback for Jules after inspecting the session request.',
});
