import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the draft-level handoff readiness packet.
//
// The packet is the readable bridge between the separate Git, Linear, Jules,
// and nudge rehearsals. It must tell the operator what can happen next without
// creating a Linear issue, writing `.jules` files, launching Jules, or changing
// Git while the real checkout is still blocked.

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
  localCommit: 'local-readiness',
  remoteCommit: 'remote-readiness',
  ahead: 1,
  behind: 7,
  dirtyFiles: 2,
  untrackedFiles: 4,
  blockers: [
    '2 tracked file(s) have uncommitted changes.',
    'master is behind origin/master by 7 commit(s).',
  ],
  summary: 'Blocked: local Git state is not ready for Jules.',
  details: [],
  dirtyFileSamples: [],
  untrackedFileSamples: [],
  remediation: [],
  nextAction: {
    code: 'review_local_changes',
    tone: 'blocked',
    label: 'Review Local Changes',
    command: 'git status --short',
    summary: 'Resolve Git sync before the handoff chain starts.',
    steps: ['Record Git disposition decisions.'],
  },
  commands: {},
};

const draft = {
  id: 'draft-readiness-packet',
  title: 'Handoff readiness proof',
  body: 'Show one packet that connects Git, Linear, Jules, and the first nudge.',
  expectedFiles: ['conductor/symphony/src/server.ts', 'conductor/symphony/public/dashboard.js'],
  verificationCommands: ['npm.cmd run verify:jules-contract'],
  executor: 'jules',
  status: 'blocked_by_git_sync',
  linearIssueId: null,
  linearIssueIdentifier: null,
  linearIssueUrl: null,
  linearIssueCreatedAt: null,
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
};

const orchestrator = {
  getConfig() {
    return { tracker: { kind: 'linear', apiKey: 'linear-test-key', projectSlug: 'aralia-jules' } };
  },
  getDashboardBaseUrl() {
    return 'http://127.0.0.1:8197';
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-17T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: 'http://127.0.0.1:8197' },
    };
  },
};

const server = new HttpServer(8197, orchestrator, logger);
server.taskIntake = {
  async snapshot() {
    return {
      drafts: [draft],
      handoffs: [],
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
          packageId: 'git-sync-proof',
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

  const readiness = await getJson('http://127.0.0.1:8197/api/v1/task-drafts/draft-readiness-packet/handoff-readiness');
  assert.equal(readiness.draftId, 'draft-readiness-packet');
  assert.equal(readiness.status, 'blocked');
  assert.equal(readiness.summary, 'Handoff readiness is blocked by GitHub sync.');
  assert.equal(readiness.mutatesGit, false);
  assert.equal(readiness.mutatesExternalSystems, false);
  assert.equal(readiness.mutatesLocalFiles, false);
  assert.deepEqual(readiness.blockers, blockedPreflight.blockers);
  assert.equal(readiness.nextOperatorAction.label, 'Resolve GitHub sync before Linear/Jules');
  assert.equal(readiness.nextOperatorAction.method, 'POST');
  assert.equal(readiness.nextOperatorAction.endpoint, 'http://127.0.0.1:8197/api/v1/git-preflight');
  assert.equal(readiness.links.linearIssuePreview, 'http://127.0.0.1:8197/api/v1/task-drafts/draft-readiness-packet/linear-preview');
  assert.equal(readiness.links.julesManifestPreview, 'http://127.0.0.1:8197/api/v1/task-drafts/draft-readiness-packet/jules-manifest-preview');
  assert.equal(readiness.links.taskNudge, 'http://127.0.0.1:8197/api/v1/task-nudges');

  const stagesById = new Map(readiness.stages.map(stage => [stage.id, stage]));
  assert.equal(stagesById.get('git_sync').status, 'blocked');
  assert.equal(stagesById.get('linear_issue').status, 'blocked');
  assert.equal(stagesById.get('jules_manifest').status, 'blocked');
  assert.equal(stagesById.get('jules_launch').status, 'waiting');
  assert.equal(stagesById.get('first_nudge').status, 'ready');
  assert.match(stagesById.get('git_sync').detail, /Blocked: local Git state/);
  assert.match(stagesById.get('linear_issue').detail, /Linear issue packet is previewable/);
  assert.match(stagesById.get('jules_manifest').detail, /\.jules\/runs\/symphony-preview-draft-readiness-packet\/manifest\.json/);

  const taskState = await getJson('http://127.0.0.1:8197/api/v1/task-drafts');
  assert.equal(taskState.drafts[0].links.handoffReadiness, 'http://127.0.0.1:8197/api/v1/task-drafts/draft-readiness-packet/handoff-readiness');
  assert.equal(taskState.drafts[0].handoff_readiness.status, 'blocked');

  const html = await getText('http://127.0.0.1:8197/proof');
  assert.match(html, /Handoff Readiness/);
  assert.match(html, /Handoff readiness proof/);
  assert.match(html, /Status: blocked/);
  assert.match(html, /Mutates Git: no/);
  assert.match(html, /Mutates external systems: no/);
  assert.match(html, /Mutates local files: no/);
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
