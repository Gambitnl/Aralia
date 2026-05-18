import assert from 'node:assert/strict';
import http from 'node:http';
import { HttpServer } from '../dist/server.js';

// This verifier protects the non-mutating Linear boundary preview. The dashboard
// should be able to show the exact issue packet it will create later, while the
// GitHub sync gate is still blocked, without contacting Linear or pretending the
// issue already exists.

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
  localCommit: 'local-preview',
  remoteCommit: 'remote-preview',
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
    summary: 'Resolve Git sync before Linear issue creation.',
    steps: ['Record Git disposition decisions.'],
  },
  commands: {},
};

const draft = {
  id: 'draft-linear-preview',
  title: 'Linear preview proof',
  body: 'Show the issue packet before mutating Linear.',
  expectedFiles: ['conductor/symphony/src/server.ts'],
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
    return 'http://127.0.0.1:8195';
  },
  getSnapshot() {
    return {
      generated_at: '2026-05-17T00:00:00.000Z',
      counts: { running: 0, retrying: 0, completed_since_start: 0 },
      codex_totals: { total_tokens: 0, seconds_running: 0 },
      running: [],
      retrying: [],
      worker_roster: [],
      dashboard: { base_url: 'http://127.0.0.1:8195' },
    };
  },
};

const server = new HttpServer(8195, orchestrator, logger);
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

  const preview = await getJson('http://127.0.0.1:8195/api/v1/task-drafts/draft-linear-preview/linear-preview');
  assert.equal(preview.draftId, 'draft-linear-preview');
  assert.equal(preview.projectSlug, 'aralia-jules');
  assert.equal(preview.canCreateNow, false);
  assert.equal(preview.wouldCreateLinearIssue, true);
  assert.equal(preview.mutatesExternalSystems, false);
  assert.equal(preview.createLinearIssueUrl, 'http://127.0.0.1:8195/api/v1/task-drafts/draft-linear-preview/create-linear');
  assert.deepEqual(preview.blockers, blockedPreflight.blockers);
  assert.equal(preview.issueTitle, 'Linear preview proof');
  assert.match(preview.issueDescription, /Created from the Symphony dashboard as a Jules delegation task/);
  assert.match(preview.issueDescription, /Show the issue packet before mutating Linear/);
  assert.match(preview.issueDescription, /conductor\/symphony\/src\/server\.ts/);
  assert.match(preview.issueDescription, /npm\.cmd run verify:jules-contract/);
  assert.match(preview.issueDescription, /Synced base: `origin\/master @ remote-preview`/);
  assert.match(preview.safetyNote, /does not call Linear/);

  const html = await getText('http://127.0.0.1:8195/proof');
  assert.match(html, /Linear Issue Preview/);
  assert.match(html, /Linear preview proof/);
  assert.match(html, /Can create now: no/);
  assert.match(html, /Mutates external systems: no/);
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
