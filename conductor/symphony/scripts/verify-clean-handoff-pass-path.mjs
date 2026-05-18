import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the clean-Git handoff pass path.
//
// The blocked-state rehearsals prove Symphony stops safely. This test proves
// the other side of the gate: once GitHub sync is clean, the dashboard must show
// the exact next boundary, which actions become runnable, which later boundary
// is still waiting, and what proof should be captured after each human-approved
// mutation.

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
  localCommit: 'clean-pass',
  remoteCommit: 'clean-pass',
  ahead: 0,
  behind: 0,
  dirtyFiles: 0,
  untrackedFiles: 0,
  blockers: [],
  summary: 'Ready: master matches origin/master and the working tree is clean.',
  details: ['master matches origin/master.'],
  dirtyFileSamples: [],
  untrackedFileSamples: [],
  remediation: [],
  nextAction: {
    code: 'ready_for_jules',
    tone: 'ready',
    label: 'GitHub Sync Ready',
    command: null,
    summary: 'GitHub sync is ready for the next handoff boundary.',
    steps: ['Create the Linear issue, then prepare the Jules handoff.'],
  },
  commands: {},
};

const draftWithoutLinear = {
  id: 'draft-clean-before-linear',
  title: 'Clean pass path before Linear',
  body: 'Show the exact handoff path after Git sync passes but before Linear exists.',
  expectedFiles: ['conductor/symphony/src/server.ts'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  executor: 'jules',
  status: 'ready_for_handoff',
  linearIssueId: null,
  linearIssueIdentifier: null,
  linearIssueUrl: null,
  linearIssueCreatedAt: null,
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
};

const draftWithLinear = {
  ...draftWithoutLinear,
  id: 'draft-clean-after-linear',
  title: 'Clean pass path after Linear',
  body: 'Show the exact handoff path after Git sync passes and Linear is linked.',
  linearIssueId: 'lin-clean-pass',
  linearIssueIdentifier: 'ARA-123',
  linearIssueUrl: 'https://linear.app/aralia/issue/ARA-123/clean-pass-path',
  linearIssueCreatedAt: '2026-05-17T00:01:00.000Z',
};

const orchestrator = {
  getConfig() {
    return { tracker: { kind: 'linear', apiKey: 'linear-test-key', projectSlug: 'aralia-jules' } };
  },
  getDashboardBaseUrl() {
    return 'http://127.0.0.1:8201';
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-17T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: 'http://127.0.0.1:8201' },
    };
  },
};

const server = new HttpServer(8201, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [draftWithoutLinear, draftWithLinear],
      handoffs: [],
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
          packageId: 'git-sync-clean',
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
          safetyChecklist: ['Continue to Linear/Jules from the clean GitHub sync gate.'],
          expectedNextProof: 'Create the Linear issue or prepare the Jules handoff.',
        },
      },
      taskRouting: {
        generatedAt: '2026-05-17T00:00:00.000Z',
        route: 'jules_plan',
        subjectId: draftWithoutLinear.id,
        subjectTitle: draftWithoutLinear.title,
        summary: 'GitHub sync is ready; route the draft through Linear and Jules.',
        reasons: ['Clean Git base is available.'],
        nextAction: { code: 'send_to_jules', label: 'Prepare Jules plan', detail: 'Create Linear, then stage the handoff.', pauseSeconds: 0, nextNudgeAt: null },
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

  const before = await getJson('http://127.0.0.1:8201/api/v1/task-drafts/draft-clean-before-linear/handoff-readiness');
  assert.equal(before.status, 'ready');
  assert.equal(before.summary, 'Handoff readiness is ready for Linear issue creation.');
  assert.equal(before.nextOperatorAction.label, 'Create Linear issue before Jules handoff');
  assert.equal(before.passPath.currentBoundary, 'linear_issue');
  assert.equal(before.passPath.nextExpectedProof, 'Linear issue receipt with identifier, URL, synced branch, and synced commit.');
  assert.equal(before.passPath.actions[0].id, 'git_sync');
  assert.equal(before.passPath.actions[0].status, 'complete');
  assert.equal(before.passPath.actions[1].id, 'linear_issue');
  assert.equal(before.passPath.actions[1].status, 'ready');
  assert.equal(before.passPath.actions[1].canRunNow, true);
  assert.equal(before.passPath.actions[1].mutatesExternalSystemsIfRun, true);
  assert.equal(before.passPath.actions[2].id, 'jules_manifest');
  assert.equal(before.passPath.actions[2].status, 'waiting');
  assert.equal(before.passPath.actions[2].canRunNow, false);
  assert.deepEqual(before.passPath.actions[2].blockedBy, ['Create Linear Issue before preparing a Jules handoff.']);
  assert.equal(before.passPath.actions[3].id, 'first_nudge');
  assert.equal(before.passPath.actions[3].mutatesExternalSystemsIfRun, false);
  assert.equal(before.mutatesExternalSystems, false);
  assert.equal(before.mutatesLocalFiles, false);

  const after = await getJson('http://127.0.0.1:8201/api/v1/task-drafts/draft-clean-after-linear/handoff-readiness');
  assert.equal(after.status, 'ready');
  assert.equal(after.nextOperatorAction.label, 'Prepare Jules handoff from linked Linear issue');
  assert.equal(after.nextOperatorAction.endpoint, 'http://127.0.0.1:8201/api/v1/task-drafts/draft-clean-after-linear/promote');
  assert.equal(after.passPath.currentBoundary, 'jules_manifest');
  assert.equal(after.passPath.nextExpectedProof, 'Staged .jules/orchestrator manifest path plus launch/status commands.');
  assert.equal(after.passPath.actions[1].status, 'complete');
  assert.equal(after.passPath.actions[1].receipt, 'ARA-123');
  assert.equal(after.passPath.actions[2].status, 'ready');
  assert.equal(after.passPath.actions[2].canRunNow, true);
  assert.equal(after.passPath.actions[2].mutatesLocalFilesIfRun, true);
  assert.deepEqual(after.passPath.actions[2].blockedBy, []);

  const taskState = await getJson('http://127.0.0.1:8201/api/v1/task-drafts');
  assert.equal(taskState.drafts[0].handoff_readiness.passPath.currentBoundary, 'linear_issue');
  assert.equal(taskState.drafts[1].handoff_readiness.passPath.currentBoundary, 'jules_manifest');

  const dashboard = await import('node:fs/promises').then(fs => fs.readFile(new URL('../public/dashboard.js', import.meta.url), 'utf8'));
  assert.match(dashboard, /Pass path/);
  assert.match(dashboard, /renderHandoffPassPath/);
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
