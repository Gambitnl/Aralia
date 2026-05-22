import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the dashboard-first handoff boundary discovered during
// Spell Phase 1 Package 2. If Jules reports COMPLETED but Symphony has no PR
// URL, the dashboard must stop telling the operator to refresh status forever.
// The next boundary is explicit evidence inspection: open Jules, determine
// whether there is a PR, a failure, or a no-code completion, and record that
// result before filing the task.

const BASE_URL = 'http://127.0.0.1:8207';
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
  id: 'handoff-completed-no-pr',
  draftId: 'draft-completed-no-pr',
  title: 'Completed Jules handoff with missing PR',
  executor: 'jules',
  status: 'sent_to_jules',
  prompt: 'Return a PR or explain why no PR was created.',
  expectedFiles: ['public/premade-characters/*.json'],
  verificationCommands: ['npm run validate:spells'],
  createdAt: generatedAt,
  updatedAt: generatedAt,
  gitPreflight: null,
  baseCommitDrift: null,
  runId: 'run-completed-no-pr',
  manifestPath: '.jules/runs/run-completed-no-pr/manifest.json',
  launchCommand: 'npx tsx .jules/orchestrator/cli.ts launch .jules/runs/run-completed-no-pr/manifest.json',
  launchOutput: null,
  launchError: null,
  launchedAt: generatedAt,
  statusCommand: 'npx tsx .jules/orchestrator/cli.ts status run-completed-no-pr',
  reviewCommand: null,
  pullCommand: null,
  recordsPath: '.jules/runs/run-completed-no-pr',
  lastStatusRefreshAt: generatedAt,
  julesSessionId: '15527431301408060204',
  julesSessionUrl: 'https://jules.google.com/session/15527431301408060204',
  julesState: 'COMPLETED',
  linearIssueId: 'linear-completed-no-pr',
  linearIssueIdentifier: 'ARA-7',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARA-7/example',
  linearIssueCreatedAt: generatedAt,
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
  repairPushReadiness: null,
  repairPushResult: null,
  operatorQuestion: null,
  handoffTimeline: null,
  next_action: null,
};

const olderPackage2PrHandoff = {
  ...handoff,
  id: 'handoff-older-package-2-pr',
  draftId: 'draft-older-package-2-pr',
  title: 'Spell Phase 1 Package 2: premade party and gear',
  status: 'sent_to_jules',
  julesState: 'COMPLETED',
  githubPullRequestUrl: 'https://github.com/Gambitnl/Aralia/pull/935',
  githubPullRequestState: 'MERGED',
};

const server = new HttpServer(8207, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [],
      // The current Package 3-style handoff has no PR. The older Package 2
      // handoff does have a merged PR, and this fixture proves the middleman
      // path does not accidentally borrow that historical PR as the active
      // review boundary.
      handoffs: [handoff, olderPackage2PrHandoff],
      preflight: {
        ok: false,
        checkedAt: generatedAt,
        repoRoot: 'F:\\Repos\\Aralia',
        baseBranch: 'master',
        remoteBranch: 'origin/master',
        currentBranch: 'codex/dashboard-proof',
        localCommit: 'local',
        remoteCommit: 'remote',
        ahead: 0,
        behind: 0,
        dirtyFiles: 1,
        untrackedFiles: 0,
        blockers: ['Working tree has local receipt edits.'],
        summary: 'GitHub sync gate is blocked by local receipt edits.',
        details: [],
        dirtyFileSamples: ['docs/tasks/spells/PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md'],
        untrackedFileSamples: [],
        resolutionPacket: { commands: {} },
        remediation: [],
        nextAction: { code: 'review_git_disposition', tone: 'blocked', label: 'Review Git Disposition', command: null, summary: 'Record local receipt disposition.', steps: [] },
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
        summary: 'Git sync is blocked by local receipt edits.',
        requiredDispositions: [],
        blockers: ['Working tree has local receipt edits.'],
        steps: [],
      },
      taskRouting: null,
      taskNudges: null,
    };
  },
};

try {
  await server.start();

  const taskDetail = await getJson(`${BASE_URL}/api/v1/tasks/handoff-completed-no-pr`);
  assert.equal(taskDetail.summary, 'Jules reported COMPLETED, but Symphony has no PR URL or completion result. Open the visible Jules session before deciding whether this handoff produced a PR, failed, or completed without code changes.');
  assert.equal(taskDetail.currentBoundary.label, 'Inspect Jules Completion');
  assert.equal(taskDetail.currentBoundary.endpoint, 'https://jules.google.com/session/15527431301408060204');
  assert.equal(taskDetail.currentBoundary.method, 'GET');
  assert.equal(taskDetail.links.githubPullRequest, null);

  const queue = await getJson(`${BASE_URL}/api/v1/task-drafts`);
  assert.equal(queue.middleman_path.currentBoundary, 'jules_session');
  assert.equal(queue.middleman_path.foremanAction.label, 'Inspect Jules Completion');
  assert.equal(queue.middleman_path.foremanAction.safety, 'external_read');
  assert.equal(queue.middleman_path.foremanAction.endpoint, 'https://jules.google.com/session/15527431301408060204');
  assert.match(queue.middleman_path.foremanAction.instruction, /visible Jules session result/);
  const githubStage = queue.middleman_path.stages.find(stage => stage.id === 'github_pr');
  assert.equal(githubStage.sourceId, 'handoff-completed-no-pr');
  assert.equal(githubStage.status, 'waiting');
  assert.equal(githubStage.receipt, null);

  // The Jules no-PR completion boundary is reusable across packages. This
  // assertion protects Package 3 and later handoffs from inheriting Package 2
  // wording that would send the operator to file the wrong follow-up task.
  assert.doesNotMatch(JSON.stringify(queue.middleman_path), /Package 2/);
  assert.match(JSON.stringify(queue.middleman_path), /before filing the next handoff/i);
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

