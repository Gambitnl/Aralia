import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the operator-facing queue after a package finishes and
// a newer package draft is created. Old stale handoffs should stay visible in
// the task list, but they must not steal the top "what now?" action from the
// newest ready draft.

const BASE_URL = 'http://127.0.0.1:8218';
const generatedAt = '2026-05-26T05:15:00.000Z';

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

const freshPackage15Draft = {
  id: 'draft-package-15',
  title: 'Spell Phase 1 Package 15 summons and controlled entities',
  body: 'Launch the next package from the current tracker boundary.',
  expectedFiles: ['docs/tasks/spells/PACKAGE_15_SUMMON_CONTROLLED_ENTITY_JULES_TASK.md'],
  verificationCommands: ['npm run validate:spells'],
  createdAt: '2026-05-26T05:00:00.000Z',
  updatedAt: '2026-05-26T05:00:00.000Z',
  status: 'ready_for_handoff',
  linearIssueId: null,
  linearIssueIdentifier: null,
  linearIssueUrl: null,
  linearIssueCreatedAt: null,
};

const completedPackage14Handoff = {
  id: 'handoff-package-14',
  draftId: 'draft-package-14',
  title: 'Spell Phase 1 Package 14 vision, light, and sound mechanics',
  executor: 'jules',
  status: 'sent_to_jules',
  prompt: 'Historical completed package.',
  expectedFiles: ['docs/tasks/spells/PACKAGE_14_VISION_LIGHT_SOUND_JULES_TASK.md'],
  verificationCommands: ['npm run validate:spells'],
  createdAt: '2026-05-26T02:40:00.000Z',
  updatedAt: '2026-05-26T05:03:00.000Z',
  gitPreflight: null,
  baseCommitDrift: null,
  runId: 'run-package-14',
  manifestPath: '.jules/runs/run-package-14/manifest.json',
  launchCommand: 'npx tsx .jules/orchestrator/cli.ts launch .jules/runs/run-package-14/manifest.json',
  launchOutput: null,
  launchError: null,
  launchedAt: '2026-05-26T02:42:00.000Z',
  statusCommand: null,
  reviewCommand: null,
  pullCommand: null,
  recordsPath: '.jules/runs/run-package-14',
  lastStatusRefreshAt: generatedAt,
  julesSessionId: 'session-package-14',
  julesSessionUrl: 'https://jules.google.com/session/session-package-14',
  julesState: 'COMPLETED',
  linearIssueId: 'linear-package-14',
  linearIssueIdentifier: 'ARA-23',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARA-23/package-14',
  linearIssueCreatedAt: '2026-05-26T02:41:00.000Z',
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/1110',
  githubPullRequestState: 'MERGED',
  githubPullRequestIsDraft: false,
  githubPullRequestMergeable: 'MERGEABLE',
  githubPullRequestReviewDecision: null,
  githubPullRequestChecks: null,
  githubPullRequestFiles: null,
  githubPullRequestFeedback: null,
  githubPullRequestNextAction: {
    code: 'check_local_sync',
    tone: 'ready',
    label: 'Check Local Sync',
    command: null,
    feedbackCommand: null,
    url: null,
    summary: 'GitHub reports the PR merged. The next step is the guarded local sync check.',
    steps: ['Run Check Local Sync.'],
  },
  githubPullRequestRefreshError: null,
  lastPullRequestRefreshAt: generatedAt,
  pullRequestViewCommand: null,
  pullRequestChecksCommand: null,
  pullRequestMergeCommand: null,
  scoutReviewCommand: null,
  coreValidationCommand: null,
  coreMergeCommand: null,
  localSyncCommand: null,
  localSyncStatus: {
    safeToPull: false,
    upToDate: true,
    checkedAt: generatedAt,
    repoRoot: 'F:\\Repos\\Aralia-dashboard-p9',
    baseBranch: 'master',
    remoteBranch: 'origin/master',
    currentBranch: 'codex/example',
    localCommit: 'b7f7c51',
    remoteCommit: 'b7f7c51',
    ahead: 0,
    behind: 0,
    dirtyFiles: 0,
    untrackedFiles: 0,
    blockers: [],
    remediation: [],
    summary: 'master is already up to date with origin/master.',
    details: ['No local sync command is needed.'],
    pullCommand: 'git pull --ff-only origin master',
    nextAction: {
      code: 'handle_local_commits',
      tone: 'blocked',
      label: 'Handle Local Commits',
      command: null,
      summary: 'Historical safety text that should not outrank up-to-date proof.',
      steps: ['Do not show this while upToDate is true.'],
    },
  },
  localSyncOutput: null,
  localSyncError: null,
  lastLocalSyncAt: generatedAt,
  operatorMessages: [],
  planApprovals: [],
  repairPushReadiness: null,
  repairPushResult: null,
  operatorQuestion: null,
  handoffTimeline: null,
  next_action: null,
};

const staleDuplicateHandoff = {
  ...completedPackage14Handoff,
  id: 'handoff-old-duplicate',
  draftId: 'draft-old-duplicate',
  title: 'Spell Phase 1 Package 11 duplicate stale handoff',
  status: 'base_commit_stale',
  createdAt: '2026-05-25T18:57:00.000Z',
  updatedAt: '2026-05-25T18:57:00.000Z',
  runId: null,
  manifestPath: null,
  launchedAt: null,
  julesSessionId: null,
  julesSessionUrl: null,
  julesState: null,
  linearIssueId: 'linear-package-11',
  linearIssueIdentifier: 'ARA-20',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARA-20/package-11',
  githubPullRequestUrl: null,
  githubPullRequestState: null,
  githubPullRequestNextAction: null,
  localSyncStatus: null,
  baseCommitDrift: {
    previousCommit: 'old',
    currentCommit: 'new',
    summary: 'origin/master moved after this stale duplicate handoff was prepared.',
    nextExpectedProof: 'Re-stage only if this old duplicate is intentionally revived.',
  },
};

const server = new HttpServer(8218, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [freshPackage15Draft],
      handoffs: [completedPackage14Handoff, staleDuplicateHandoff],
      preflight: {
        ok: true,
        checkedAt: generatedAt,
        repoRoot: 'F:\\Repos\\Aralia-dashboard-p9',
        baseBranch: 'master',
        remoteBranch: 'origin/master',
        currentBranch: 'codex/example',
        localCommit: 'b7f7c51',
        remoteCommit: 'b7f7c51',
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
        nextAction: null,
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
      gitSyncPlan: null,
      taskRouting: null,
      taskNudges: null,
    };
  },
};

try {
  await server.start();

  const queue = await getJson(`${BASE_URL}/api/v1/task-drafts`);

  assert.equal(queue.next_action.code, 'create_linear_issue');
  assert.equal(queue.next_action.source_type, 'draft');
  assert.equal(queue.next_action.source_id, 'draft-package-15');
  assert.equal(queue.middleman_path.currentBoundary, 'linear_issue');
  assert.equal(queue.middleman_path.foremanAction.label, 'Run Linear issue');

  const completedHandoff = queue.handoffs.find(item => item.id === 'handoff-package-14');
  assert.equal(completedHandoff.next_action.code, 'complete');
  assert.equal(completedHandoff.next_action.label, 'Local Checkout Current');
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
